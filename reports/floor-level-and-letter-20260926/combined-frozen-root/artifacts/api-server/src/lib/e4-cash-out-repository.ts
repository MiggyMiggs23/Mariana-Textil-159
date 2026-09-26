import { sql, type SQL } from "drizzle-orm";
import type { Tx } from "./inventario";
import {
  E4_CASH_OUT_ENABLED, E4CashOutError,
  type E4Repository, type E4Revision, type E4Salida, type E4Session, type E4Operation,
} from "./e4-cash-out";
import { readSessionCash } from "./caja-corte-reader";
import { registrarPago } from "./compras-proveedor";
import { transactionAdvisoryLock, ADVISORY_LOCK_NAMESPACES } from "@workspace/db/advisory-locks";

type Executor = { execute(query: SQL): Promise<{ rows: Record<string, unknown>[] }> };
const baseColumns = sql`s.id, s.sesion_caja_id AS "sesionCajaId", s.monto, s.motivo,
  s.proveedor_id AS "proveedorId", s.cuenta_origen AS "cuentaOrigen",
  s.creado_por_id AS "creadoPorId", s.created_at AS "createdAt"`;

/** Only instantiate inside db.transaction. No connection or schema work at import time. */
export function e4CashOutRepository(tx: Tx): E4Repository {
  return {
    async lockOperation(key) {
      // All E4 intents share a namespace, so reuse across creation/review cannot collide silently.
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${'e4-cash-out:' + key}, 0))`);
    },
    async session(id) {
      const result = await tx.execute<E4Session>(sql`SELECT s.id, s.ubicacion_id AS "ubicacionId", s.estado,
        (u.tipo = 'TIENDA' AND u.activa) AS "esTienda"
        FROM sesiones_caja s JOIN ubicaciones u ON u.id = s.ubicacion_id
        WHERE s.id = ${id} FOR UPDATE OF s`);
      return result.rows[0];
    },
    async operation(key) {
      const result = await tx.execute<E4Operation>(sql`SELECT actor_id AS "actorId", request, response
        FROM caja_salidas_e4_operaciones WHERE clave = ${key}::uuid`);
      return result.rows[0];
    },
    async providerDebt(id) {
      await transactionAdvisoryLock(tx, ADVISORY_LOCK_NAMESPACES.SUPPLIER_LEDGER, id);
      const result = await tx.execute<{ deuda: string }>(sql`SELECT COALESCE(SUM(pp.importe),0)::text AS deuda
        FROM proveedores p LEFT JOIN pagos_proveedor pp ON pp.proveedor_id=p.id
        WHERE p.id=${id} AND p.activo GROUP BY p.id`);
      return result.rows[0]?.deuda;
    },
    async cashBalance(session) {
      const rows = await tx.execute<{ fondoInicial: string; efectivoContado: string | null; abiertaAt: Date; usuarioId: number }>(sql`
        SELECT fondo_inicial AS "fondoInicial", efectivo_contado AS "efectivoContado",
          abierta_at AS "abiertaAt", usuario_id AS "usuarioId"
        FROM sesiones_caja WHERE id=${session.id}`);
      const row = rows.rows[0];
      if (!row) throw new E4CashOutError("Sesión no encontrada.", "E4_SESSION_NOT_FOUND", 404);
      const abiertaAt = row.abiertaAt instanceof Date ? row.abiertaAt : new Date(row.abiertaAt);
      if (Number.isNaN(abiertaAt.getTime()))
        throw new E4CashOutError("Fecha de apertura de caja inválida.", "E4_INVALID_SESSION_DATE", 500);
      return (await readSessionCash(tx, { ...session, ...row, abiertaAt },
        { efectivoEsperado: "0.00", diferencia: null })).efectivoEsperado;
    },
    async insert(input, actor) {
      if (input.tipo === "PROVEEDOR") {
        await registrarPago(tx, {
          proveedorId: input.proveedorId!, importe: Number(input.monto), formaPago: "EFECTIVO",
          notas: input.motivo, usuarioId: actor.id, ip: input.ip,
        });
      }
      // The original financial producer remains the sole source of the egreso.
      const result = await tx.execute<Omit<E4Salida, "e4">>(sql`INSERT INTO salidas_dinero_caja
        (sesion_caja_id, monto, motivo, proveedor_id, cuenta_origen, creado_por_id)
        VALUES (${input.sesionCajaId}, ${input.monto}, ${input.motivo}, ${input.proveedorId ?? null},
          ${input.cuentaOrigen}, ${actor.id})
        RETURNING id, sesion_caja_id AS "sesionCajaId", monto, motivo, proveedor_id AS "proveedorId",
          cuenta_origen AS "cuentaOrigen", creado_por_id AS "creadoPorId", created_at AS "createdAt"`);
      const created = result.rows[0]!;
      const revision: E4Revision = {
        tipo: input.tipo, estado: input.tipo === "EXTRAORDINARIA" ? "PENDIENTE" : "NO_APLICA",
        version: 0, claveOperacion: input.claveOperacion, historial: [],
        desbloqueoCaja: input.desbloqueoCajaEvidence,
      };
      await tx.execute(sql`INSERT INTO caja_salidas_e4 (salida_id, revision)
        VALUES (${created.id}, ${JSON.stringify(revision)}::jsonb)`);
      return { ...created, e4: revision };
    },
    async lockSalida(id) {
      const result = await tx.execute<E4Salida & { ubicacionId: number }>(sql`SELECT ${baseColumns}, e.revision AS e4,
        c.ubicacion_id AS "ubicacionId"
        FROM salidas_dinero_caja s JOIN caja_salidas_e4 e ON e.salida_id = s.id
        JOIN sesiones_caja c ON c.id = s.sesion_caja_id
        WHERE s.id = ${id} FOR UPDATE OF e`);
      if (!result.rows[0]) return undefined;
      const row = result.rows[0];
      return { salida: row, ubicacionId: row.ubicacionId };
    },
    async updateRevision(id, revision) {
      const result = await tx.execute(sql`UPDATE caja_salidas_e4
        SET revision = ${JSON.stringify(revision)}::jsonb
        WHERE salida_id = ${id} AND (revision->>'version')::integer = ${revision.version - 1}
        RETURNING salida_id`);
      if (result.rows.length !== 1) throw new E4CashOutError("La revisión cambió.", "E4_VERSION_CONFLICT", 409);
    },
    async saveOperation(key, salidaId, operation) {
      await tx.execute(sql`INSERT INTO caja_salidas_e4_operaciones (clave, salida_id, actor_id, request, response)
        VALUES (${key}::uuid, ${salidaId}, ${operation.actorId}, ${operation.request}, ${JSON.stringify(operation.response)}::jsonb)`);
    },
    async audit(salidaId, actorId, action, data, ip) {
      await tx.execute(sql`INSERT INTO auditoria (usuario_id, accion, entidad, entidad_id, datos_despues, ip)
        VALUES (${actorId}, ${action}, 'salidas_dinero_caja', ${String(salidaId)}, ${JSON.stringify(data)}::jsonb, ${ip})`);
    },
  };
}

/** Called by the real corte reader, not a separate financial aggregation. */
export async function readE4CashOutRevisions(
  database: Executor, sessionId: number, enabled = E4_CASH_OUT_ENABLED,
): Promise<Map<number, E4Revision>> {
  if (!enabled) return new Map();
  const result = await database.execute(sql`SELECT e.salida_id AS id, e.revision
    FROM caja_salidas_e4 e JOIN salidas_dinero_caja s ON s.id = e.salida_id
    WHERE s.sesion_caja_id = ${sessionId} ORDER BY e.salida_id`);
  return new Map(result.rows.map((row) => [Number(row.id), row.revision as E4Revision]));
}