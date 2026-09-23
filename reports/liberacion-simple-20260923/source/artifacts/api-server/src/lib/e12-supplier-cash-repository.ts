import { sql } from "drizzle-orm";
import type { Tx } from "./inventario";
import { transactionAdvisoryLock, ADVISORY_LOCK_NAMESPACES } from "@workspace/db/advisory-locks";
import { registrarPago, reversarPago } from "./compras-proveedor";
import { readSessionCash } from "./caja-corte-reader";
import { movimientoProveedorFondoEnTransaccion, saldoFondoEnTransaccion } from "./fondo";
import { e12FondoExecutor } from "./e12-fondo-executor";
import { E12_SUPPLIER_CASH_ENABLED, E12Error, e12Scope, type E12Repository, type E12Detail, type E12Actor, type E12Result } from "./e12-supplier-cash";
import type { E12Executor } from "./e12-cash-ledger";

export async function e12CashBalance(tx: Tx, sessionId: number): Promise<string> {
  const rows = await tx.execute<{ id: number; estado: string; fondoInicial: string; efectivoContado: string | null }>(sql`
    SELECT id, estado, fondo_inicial AS "fondoInicial", efectivo_contado AS "efectivoContado"
    FROM sesiones_caja WHERE id=${sessionId}`);
  const session = rows.rows[0];
  if (!session || session.estado !== "ABIERTA") throw new E12Error("E12_SESSION_CLOSED", "Sesión de caja cerrada.", 409);
  return (await readSessionCash(tx, session, { efectivoEsperado: "0.00", diferencia: null })).efectivoEsperado;
}
export async function readE12Detail(database: E12Executor, paymentId: number, role: string, enabled = E12_SUPPLIER_CASH_ENABLED): Promise<E12Detail | undefined> {
  if (!enabled || role !== "ADMIN") return undefined;
  const result = await database.execute(sql`SELECT jsonb_set(detail,'{retorno}',COALESCE(retorno,'null'::jsonb)) AS detail
    FROM proveedor_efectivo_e12 WHERE pago_proveedor_id=${paymentId} OR (retorno->>'reversoProveedorId')::integer=${paymentId}`);
  return result.rows[0]?.detail as E12Detail | undefined;
}
export async function enrichE12Rows<T extends { id: number }>(database: E12Executor, rows: T[], role: string): Promise<(T & { efectivoE12?: E12Detail })[]> {
  if (!E12_SUPPLIER_CASH_ENABLED || role !== "ADMIN") return rows;
  return Promise.all(rows.map(async row => {
    const detail = await readE12Detail(database, row.id, role);
    return detail ? { ...row, efectivoE12: detail } : row;
  }));
}
export async function e12Options(tx: Tx, actor: E12Actor, provider: number) {
  if (!E12_SUPPLIER_CASH_ENABLED) return { enabled: false, motivoInactivo: "E12 aún no está liberado." };
  e12Scope(actor);
  const repo = e12Repository(tx);
  if (!await repo.provider(provider)) throw new E12Error("E12_PROVIDER", "Proveedor inexistente o inactivo.", 404);
  const session = await repo.session(null);
  return { enabled: true, ubicacionId: 1, sesionCajaId: session?.id ?? null,
    saldoCaja: session ? await repo.cashBalance(session) : null, puedeDesbloquearCaja: actor.rol === "ADMIN",
    ...(actor.rol === "ADMIN" ? { fondo: await repo.fundBalance() } : {}) };
}
export function e12Repository(tx: Tx): E12Repository {
  const fondo = e12FondoExecutor(tx);
  const operation = async (actor: E12Actor, key: string, content: string, result: E12Result) => {
    await tx.execute(sql`INSERT INTO proveedor_operaciones_e12 (clave,actor_id,contenido,resultado)
      VALUES (${key}::uuid,${actor.id},${content},${JSON.stringify(result)}::jsonb)`);
    // Existing auditoria list/detail/export privacy already excludes modulo FONDO
    // for every non-ADMIN; never put source amounts in an unclassified audit row.
    await tx.execute(sql`INSERT INTO auditoria (usuario_id,modulo,accion,entidad,entidad_id,datos_despues,ip)
      VALUES (${actor.id},'FONDO','PROVEEDOR_EFECTIVO_E12','pagos_proveedor',${String(result.pago.id)},${JSON.stringify(result.efectivoE12)}::jsonb,${actor.ip})`);
  };
  return {
    async lock(key, supplier) {
      await transactionAdvisoryLock(tx, ADVISORY_LOCK_NAMESPACES.SUPPLIER_LEDGER, supplier);
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${'proveedor-e12:' + key},0))`);
    },
    async replay(key) {
      const result = await tx.execute(sql`SELECT actor_id AS "actorId", contenido AS content, resultado AS result
        FROM proveedor_operaciones_e12 WHERE clave=${key}::uuid`);
      return result.rows[0] as { actorId: number; content: string; result: E12Result } | undefined;
    },
    async provider(id) {
      const result = await tx.execute(sql`SELECT id FROM proveedores WHERE id=${id} AND activo FOR SHARE`);
      return result.rows.length === 1;
    },
    async session(id) {
      const result = await tx.execute<{ id: number; estado: string; ubicacionId: number }>(id === null
        ? sql`SELECT id,estado,ubicacion_id AS "ubicacionId" FROM sesiones_caja
            WHERE ubicacion_id=1 AND estado='ABIERTA' ORDER BY id FOR UPDATE`
        : sql`SELECT id,estado,ubicacion_id AS "ubicacionId" FROM sesiones_caja WHERE id=${id} FOR UPDATE`);
      if (result.rows.length > 1) throw new E12Error("E12_SESSION_AMBIGUOUS", "Hay más de una sesión abierta de Mariana.", 409);
      return result.rows[0];
    },
    cashBalance: session => e12CashBalance(tx, session.id),
    fundBalance: () => saldoFondoEnTransaccion(fondo),
    async payment(input, actor) {
      if (input.documentoDirigidoId === undefined) {
        const reserved = await tx.execute(sql`SELECT 1 FROM proveedor_solicitudes_e12 WHERE clave=${input.split.claveOperacion}::uuid`);
        if (reserved.rows.length) throw new E12Error("E12_IDEMPOTENCY_CONFLICT", "La clave pertenece a una solicitud dirigida.", 409);
      }
      const result = await registrarPago(tx, { proveedorId: input.proveedorId, importe: Number(input.importe),
        formaPago: "EFECTIVO", fecha: input.fecha ? new Date(input.fecha) : null,
        referencia: input.referencia, notas: input.notas, usuarioId: actor.id, ip: actor.ip,
        documentoDirigidoId: input.documentoDirigidoId, e12Integration: true });
      return { ...result.pago, saldoDisponible: result.saldoAFavor, aplicaciones: result.asignaciones };
    },
    async outflow(session, amount, supplier, key, actor, reason) {
      const result = await tx.execute<{ id: number }>(sql`INSERT INTO salidas_dinero_caja
        (sesion_caja_id,monto,motivo,proveedor_id,cuenta_origen,creado_por_id)
        VALUES (${session},${amount},${reason},${supplier},'CAJA_FISICA',${actor.id}) RETURNING id`);
      const id = result.rows[0]!.id;
      // Reuse E4 classification, never its insertion producer a second time.
      const revision = { tipo: "PROVEEDOR", estado: "NO_APLICA", version: 0, claveOperacion: key, historial: [] };
      await tx.execute(sql`INSERT INTO caja_salidas_e4 (salida_id,revision) VALUES (${id},${JSON.stringify(revision)}::jsonb)`);
      return id;
    },
    async fund(amount, key, actor, reason, original, kind) {
      const result = await movimientoProveedorFondoEnTransaccion(fondo, actor, {
        importe: amount, clave: key, motivo: reason, original, naturalezaRetorno: kind,
      });
      return result.value.id;
    },
    async save(detail, actor, key, content, result) {
      await tx.execute(sql`INSERT INTO proveedor_efectivo_e12
        (pago_proveedor_id,salida_caja_id,movimiento_fondo_id,detail)
        VALUES (${detail.pagoProveedorId},${detail.salidaCajaId},${detail.movimientoFondoId}::uuid,${JSON.stringify(detail)}::jsonb)`);
      if (detail.desbloqueoCaja) await tx.execute(sql`INSERT INTO caja_desbloqueos_e12 (salida_id,evidencia)
        VALUES (${detail.salidaCajaId},${JSON.stringify(detail.desbloqueoCaja)}::jsonb)`);
      await operation(actor, key, content, result);
    },
    async original(id, supplier) {
      const result = await tx.execute(sql`SELECT jsonb_set(e.detail,'{retorno}',COALESCE(e.retorno,'null'::jsonb)) detail
        FROM proveedor_efectivo_e12 e JOIN pagos_proveedor p ON p.id=e.pago_proveedor_id
        WHERE p.id=${id} AND p.proveedor_id=${supplier} FOR UPDATE OF e`);
      return result.rows[0]?.detail as E12Detail | undefined;
    },
    async reverse(id, supplier, reason, actor) {
      return reversarPago(tx, { proveedorId: supplier, pagoId: id, motivo: reason, usuarioId: actor.id, ip: actor.ip, e12Integration: true });
    },
    async income(session, amount, payment, kind, actor, reason) {
      const result = await tx.execute<{ id: number }>(sql`INSERT INTO caja_retornos_proveedor_e12
        (sesion_caja_id,importe,pago_proveedor_id,naturaleza,usuario_id,motivo)
        VALUES (${session},${amount},${payment},${kind},${actor.id},${reason}) RETURNING id`);
      return result.rows[0]!.id;
    },
    async saveReturn(detail, actor, key, content, result) {
      const updated = await tx.execute(sql`UPDATE proveedor_efectivo_e12 SET retorno=${JSON.stringify(detail.retorno)}::jsonb
        WHERE pago_proveedor_id=${detail.pagoProveedorId} AND retorno IS NULL RETURNING pago_proveedor_id`);
      if (updated.rows.length !== 1) throw new E12Error("E12_ALREADY_RETURNED", "Pago ya recuperado.", 409);
      await operation(actor, key, content, result);
    },
  };
}