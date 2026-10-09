import { sql } from "drizzle-orm";
import type { Tx } from "./inventario";
import { E12_SUPPLIER_CASH_ENABLED, E12Error, canonicalE12, e12Key, e12Money, e12Scope, type E12Actor, type E12Split } from "./e12-supplier-cash";
import { e12Repository } from "./e12-supplier-cash-repository";
import type { E12Executor } from "./e12-cash-ledger";
export async function readE12Directed(database: E12Executor, id: number, role: string): Promise<E12Split | undefined> {
  if (!E12_SUPPLIER_CASH_ENABLED || role !== "ADMIN") return undefined;
  const row = await database.execute(sql`SELECT origen FROM proveedor_solicitudes_e12 WHERE solicitud_id=${id}`);
  return row.rows[0]?.origen as E12Split | undefined;
}
export async function beginE12Directed(tx: Tx, actor: E12Actor, supplier: number, amount: string, split: E12Split, intent: unknown) {
  const key = e12Key(split.claveOperacion), fund = e12Money(split.fondo ?? "0.00"), cash = e12Money(split.caja);
  e12Scope(actor, fund > 0n);
  if (cash + fund !== e12Money(amount) || e12Money(amount) === 0n) throw new E12Error("E12_SPLIT", "Las partes deben sumar exactamente el pago.");
  if (split.desbloqueoCaja && actor.rol !== "ADMIN") throw new E12Error("E12_FORBIDDEN", "Solo ADMIN desbloquea caja.", 403);
  const repo = e12Repository(tx);
  await repo.lock(key, supplier);
  const content = canonicalE12({ intent, split: { ...split, claveOperacion: key } });
  const previous = await tx.execute(sql`SELECT solicitud_id,actor_id,contenido FROM proveedor_solicitudes_e12 WHERE clave=${key}::uuid`);
  if (previous.rows[0]) {
    const row = previous.rows[0];
    if (Number(row.actor_id) !== actor.id || row.contenido !== content) throw new E12Error("E12_IDEMPOTENCY_CONFLICT", "La clave de solicitud ya identifica otra intención.", 409);
    return { previousId: Number(row.solicitud_id), content, key };
  }
  if (await repo.replay(key)) throw new E12Error("E12_IDEMPOTENCY_CONFLICT", "La clave ya identifica un pago, no una solicitud nueva.", 409);
  if (!await repo.provider(supplier)) throw new E12Error("E12_PROVIDER", "Proveedor inexistente o inactivo.", 404);
  if (cash > 0n) {
    if (!split.sesionCajaId) throw new E12Error("E12_SESSION_REQUIRED", "La propuesta caja requiere sesión.", 409);
    const session = await repo.session(split.sesionCajaId);
    if (!session || session.ubicacionId !== 1 || session.estado !== "ABIERTA") throw new E12Error("E12_SESSION_CLOSED", "La propuesta exige sesión abierta Mariana.", 409);
  } else if (split.sesionCajaId != null) throw new E12Error("E12_SESSION_UNUSED", "Fondo puro no lleva sesión.");
  return { previousId: null, content, key };
}
export async function saveE12Directed(tx: Tx, id: number, actor: E12Actor, split: E12Split, claim: { content: string; key: string }) {
  await tx.execute(sql`INSERT INTO proveedor_solicitudes_e12 (solicitud_id,clave,actor_id,contenido,origen)
    VALUES (${id},${claim.key}::uuid,${actor.id},${claim.content},${JSON.stringify(split)}::jsonb)`);
}