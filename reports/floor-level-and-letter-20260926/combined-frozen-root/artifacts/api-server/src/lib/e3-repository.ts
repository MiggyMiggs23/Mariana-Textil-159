import { and, eq, sql } from "drizzle-orm";
import {
  db, auditoriaTable, aplicacionesCreditoTable, clientesTable, sesionesCajaTable, usuariosTable, ubicacionesTable,
} from "@workspace/db";
import { ADVISORY_LOCK_NAMESPACES, transactionAdvisoryLock } from "@workspace/db/advisory-locks";
import type { Request } from "express";
import { getRequestIp } from "./request";
import { e3ContextSite, type E3Context } from "./e3-context";
import { loadCustomerCreditLedgerInTransaction } from "./credit-aging-read-model";
import { centsToMoney } from "./credit-allocation";
import { assertCreditEvidenceAccess, assertCreditEvidenceScope, claimCreditOperation, insertCreditMovementE1 } from "./credit-evidence";
import { evaluateAbonoEvidence, finalizePhysicalAbonoEvidence } from "./credit-abono-evidence";
import { e3Evidence, E3Error, validateE3Receipt, type E3Input, type E3Origin, type E3Receipt, type E3Repository } from "./e3-collection";

/** No second ledger engine or direct unclassified movement INSERT. */
export function e3Repository(req: Request): E3Repository {
  return {
    transaction: work => db.transaction(async tx => {
      let current: { input: E3Input; origin: E3Origin } | undefined;
      return work({
        async lockAndLoad(input, origin) {
          current = { input, origin };
          // UUID serialization covers retries before the CUSTOMER_CREDIT row lock.
          await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${`e3:${input.operacionClave}`}, 0))`);
          await assertCreditEvidenceAccess(req, e3Evidence(input, origin), tx);
          await transactionAdvisoryLock(tx, ADVISORY_LOCK_NAMESPACES.CUSTOMER_CREDIT, input.clienteId);
          const [client] = await tx.select().from(clientesTable).where(eq(clientesTable.id, input.clienteId)).for("update").limit(1);
          if (!client || !client.activo || client.esSistema) throw new E3Error("CLIENT_UNAVAILABLE", "Cliente inexistente, inactivo o de sistema.");
          // Replays still require actor/site access, but not reopening a previously closed shift.
          const prior = await tx.execute(sql`SELECT 1 FROM recibos_abono_e3 WHERE operacion_clave=${input.operacionClave}::uuid`);
          await assertCreditEvidenceScope(req, { ...e3Evidence(input, origin), sesionCajaId: null }, tx);
          if (origin === "CAJA" && prior.rows.length === 0) {
            const [session] = await tx.select().from(sesionesCajaTable)
              .where(and(eq(sesionesCajaTable.id, input.sesionCajaId!), eq(sesionesCajaTable.ubicacionId, input.sitioId))).for("update").limit(1);
            if (!session || session.estado !== "ABIERTA" || session.cerradaAt !== null) {
              throw new E3Error("CAJA_CLOSED", "La caja del sitio ya no está abierta.");
            }
          }
          const [site] = await tx.select({ nombre: ubicacionesTable.nombre }).from(ubicacionesTable).where(eq(ubicacionesTable.id, input.sitioId)).limit(1);
          const [actor] = await tx.select({ nombre: usuariosTable.nombre }).from(usuariosTable).where(eq(usuariosTable.id, req.auth!.user.id)).limit(1);
          if (!site || !actor) throw new E3Error("EVIDENCE_MISSING", "Falta nombre del receptor o sitio.");
          return { clienteNombre: client.nombre, clienteTelefono: client.telefono, clienteRfc: client.rfc,
            sitioNombre: site.nombre, actorNombre: actor.nombre, movements: await loadCustomerCreditLedgerInTransaction(input.clienteId, tx) };
        },
        async findReceipt(key) {
          const result = await tx.execute(sql`SELECT intent_hash, snapshot FROM recibos_abono_e3 WHERE operacion_clave=${key}::uuid`);
          const row = result.rows[0];
          return row ? { intentHash: String(row.intent_hash), receipt: validateE3Receipt(row.snapshot) } : null;
        },
        async findPreview(key) {
          const result = await tx.execute(sql`SELECT intent_hash FROM vistas_abono_e3 WHERE operacion_clave=${key}::uuid`);
          return result.rows[0] ? { intentHash: String(result.rows[0].intent_hash) } : null;
        },
        async savePreview(key, token, actorId, at, intentHash) {
          const updated = await tx.execute(sql`INSERT INTO vistas_abono_e3(operacion_clave,token,actor_id,emitida_at,intent_hash)
            VALUES (${key}::uuid,${token},${actorId},${at.toISOString()}::timestamptz,${intentHash})
            ON CONFLICT (operacion_clave) DO UPDATE SET token=EXCLUDED.token,emitida_at=EXCLUDED.emitida_at
            WHERE vistas_abono_e3.actor_id=EXCLUDED.actor_id AND vistas_abono_e3.intent_hash=EXCLUDED.intent_hash
            RETURNING operacion_clave`);
          if (!updated.rows.length) throw new E3Error("IDEMPOTENCY_CONFLICT", "Vista previa vinculada a otra intención.");
        },
        async allocateFolio(sitioId) {
          // Existing per-site counter pattern (entradas/salidas), separate receipt namespace.
          const result = await tx.execute(sql`INSERT INTO recibo_folio_e3(sitio_id,ultimo_folio)
            VALUES (${sitioId},1) ON CONFLICT (sitio_id) DO UPDATE
            SET ultimo_folio=recibo_folio_e3.ultimo_folio+1 RETURNING ultimo_folio`);
          return `E3-${sitioId}-${String(result.rows[0]!.ultimo_folio).padStart(8, "0")}`;
        },
        async hasPreview(key, token, actorId, at) {
          const found = await tx.execute(sql`SELECT 1 FROM vistas_abono_e3 WHERE operacion_clave=${key}::uuid
            AND token=${token} AND actor_id=${actorId}
            AND emitida_at <= ${at.toISOString()}::timestamptz
            AND emitida_at >= ${at.toISOString()}::timestamptz - interval '10 minutes'`);
          return found.rows.length === 1;
        },
        async insertMovement(input, evidence, at, actor) {
          const claim = await claimCreditOperation(tx, {
            productor: "ABONO_ORDINARIO", clave: input.operacionClave, naturaleza: evidence.naturaleza,
            actorId: actor.id, contenido: { origen: current!.origin, clienteId: input.clienteId,
              importe: centsToMoney(input.importeCentavos), formaPago: input.formaPago, cuentaDestino: input.cuentaDestino,
              sitioId: input.sitioId, sesionCajaId: input.sesionCajaId, motivo: input.motivo ?? null,
              fechaRecepcion: input.fechaRecepcion ?? null },
          });
          if (claim.replay) throw new E3Error("RECEIPT_INCOMPLETE", "Operación existente sin snapshot E3; no se reconstruye.");
          const movement = await insertCreditMovementE1(tx, {
            clienteId: input.clienteId, ticketId: null, tipo: "ABONO", importe: centsToMoney(-input.importeCentavos),
            usuarioId: actor.id, formaPago: input.formaPago, cuentaDestino: input.cuentaDestino,
            notas: input.motivo ?? "Abono real recibido desde Caja", createdAt: at,
            metadata: JSON.stringify({ origen: current!.origin, operacionE3: input.operacionClave }),
          }, evidence, "ABONO_ORDINARIO");
          return movement.id;
        },
        async saveAllocations(movementId, allocations) {
          if (allocations.length) await tx.insert(aplicacionesCreditoTable).values(allocations.map(a => ({
            abonoMovimientoId: movementId, ventaMovimientoId: a.movimientoVentaId, importe: centsToMoney(a.aplicadoCentavos),
          })));
          const { input, origin } = current!;
          await finalizePhysicalAbonoEvidence(tx, {
            movementId, productor: "ABONO_ORDINARIO", formaPago: input.formaPago, cuentaDestino: input.cuentaDestino,
            evidence: e3Evidence(input, origin), evaluation: evaluateAbonoEvidence(input.importeCentavos,
              allocations.map(a => ({ targetId: a.movimientoVentaId, appliedCents: a.aplicadoCentavos }))),
          });
        },
        async saveReceipt(key, intentHash, receipt) {
          await tx.execute(sql`INSERT INTO recibos_abono_e3
            (operacion_clave,intent_hash,folio,movimiento_id,cliente_id,sesion_operativa_id,origen,snapshot)
            VALUES (${key}::uuid,${intentHash},${receipt.folio},${receipt.movimientoId},${receipt.clienteId},
              ${receipt.sesionCajaId},${receipt.origen},${JSON.stringify(receipt)}::jsonb)`);
          await tx.insert(auditoriaTable).values({
            usuarioId: req.auth!.user.id, accion: "E3_ABONO_REGISTRADO", entidad: "movimientos_credito",
            entidadId: String(receipt.movimientoId), datosDespues: receipt, ip: getRequestIp(req),
          });
        },
      });
    }),
  };
}
export async function readE3Receipts(filter: { folio?: string; clienteId?: number; movimientoId?: number; sesionCajaId?: number }): Promise<E3Receipt[]> {
  const rows = await db.execute(sql`SELECT snapshot FROM recibos_abono_e3 WHERE
    (${filter.folio ?? null}::text IS NULL OR folio=${filter.folio ?? null})
    AND (${filter.clienteId ?? null}::int IS NULL OR cliente_id=${filter.clienteId ?? null})
    AND (${filter.movimientoId ?? null}::int IS NULL OR movimiento_id=${filter.movimientoId ?? null})
    AND (${filter.sesionCajaId ?? null}::int IS NULL OR sesion_operativa_id=${filter.sesionCajaId ?? null})
    ORDER BY movimiento_id DESC`);
  return rows.rows.map(row => validateE3Receipt(row.snapshot));
}
export async function recordE3Print(folio: string, motivo: string, actorId: number, ip: string) {
  const receipts = await readE3Receipts({ folio });
  if (!receipts.length) throw new E3Error("RECEIPT_NOT_FOUND", "No existe snapshot E3. Históricos sin evidencia no se reconstruyen.", 404);
  await db.insert(auditoriaTable).values({
    usuarioId: actorId, accion: "E3_RECIBO_IMPRESION_SOLICITADA", entidad: "recibos_abono_e3",
    entidadId: folio, ip, datosDespues: { motivo, folio, evidencia: "SOLICITUD_NO_CONFIRMACION_FISICA" },
  });
}

/** Operational lookup only: no credit/debt/limits, no general customer/location permission. */
export async function readE3Context(req: Request, buscar: string, requestedSite?: number): Promise<E3Context> {
  const siteId = e3ContextSite(req.auth!.user, requestedSite);
  const sites = await db.execute(sql`SELECT u.id,u.nombre,s.id AS sesion_id,s.fecha_operativa
    FROM ubicaciones u LEFT JOIN sesiones_caja s ON s.ubicacion_id=u.id AND s.estado='ABIERTA' AND s.cerrada_at IS NULL
    WHERE u.activa AND u.tipo='TIENDA' AND (${siteId}::int IS NULL OR u.id=${siteId}) ORDER BY u.nombre,s.id`);
  const sitios: E3Context["sitios"] = [];
  for (const row of sites.rows) {
    let site = sitios.find(s => s.id === Number(row.id));
    if (!site) { site = { id: Number(row.id), nombre: String(row.nombre), sesiones: [] }; sitios.push(site); }
    if (row.sesion_id != null) site.sesiones.push({ id: Number(row.sesion_id), ubicacionId: site.id, fechaOperativa: String(row.fecha_operativa) });
  }
  const matches = buscar.trim().length >= 2 ? await db.execute(sql`SELECT id,nombre,telefono FROM clientes
    WHERE activo AND NOT es_sistema AND strpos(lower(nombre),lower(${buscar.trim()}))>0 ORDER BY nombre,id LIMIT 50`) : { rows: [] };
  return { sitios, clientes: matches.rows.map(row => ({ id: Number(row.id), nombre: String(row.nombre), telefono: row.telefono == null ? null : String(row.telefono) })) };
}