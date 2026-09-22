import { createHash } from "node:crypto";
import { sql, type SQL } from "drizzle-orm";
import { validateCashSnapshot } from "./caja-cash-ledger";
import { E9_ENABLED } from "./e9-feature";

export type E9Sql = { execute(query: SQL): Promise<{ rows: Record<string, unknown>[] }> };
export class E9CutError extends Error {
  readonly code = "E9_CORTE_STALE";
  readonly status = 409;
}
export type E9CutSession = { id: number; ubicacionId: number; estado: string; fechaOperativa: string; cerradaAt: Date | string | null; efectivoContado: string | null };
export function e9Canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(e9Canonical).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value)
    .filter(([, item]) => item !== undefined).sort(([a], [b]) => a.localeCompare(b))
    .map(([key, item]) => `${JSON.stringify(key)}:${e9Canonical(item)}`).join(",")}}`;
  return JSON.stringify(value);
}
/** No live cash arithmetic, no fallback to expected cash or a historical guess. */
export function e9FrozenCut(session: E9CutSession, snapshots: unknown[]) {
  if (session.estado !== "CERRADA" || !session.cerradaAt || snapshots.length === 0) return undefined;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(session.fechaOperativa ?? "")) throw new E9CutError("E9: falta periodo operativo original del corte.");
  if (snapshots.length !== 1) throw new E9CutError("E9: evidencia canónica de cierre duplicada.");
  let snapshot;
  try { snapshot = validateCashSnapshot(snapshots[0], session.id); }
  catch { throw new E9CutError("E9: evidencia congelada inválida; no se infiere efectivo."); }
  if (snapshot.efectivoContado !== session.efectivoContado) throw new E9CutError("E9: contado y cierre congelado no coinciden.");
  const fechaCorte = new Date(session.cerradaAt).toISOString();
  const versionCorte = `e9:v1:${createHash("sha256").update(e9Canonical({
    corteId: session.id, ubicacionId: session.ubicacionId, fechaOperativa: session.fechaOperativa, fechaCorte, snapshot,
  })).digest("hex")}`;
  return { corteId: session.id, versionCorte, fechaCorte, fechaOperativa: session.fechaOperativa, importeEnviado: snapshot.efectivoContado };
}
export async function readE9FrozenCut(database: E9Sql, session: E9CutSession, enabled = E9_ENABLED) {
  if (!enabled || session.estado !== "CERRADA") return undefined;
  const result = await database.execute(sql`SELECT datos_despues->'cashSnapshot' AS snapshot
    FROM auditoria WHERE accion='CERRAR_CAJA' AND entidad='sesiones_caja'
    AND entidad_id=${String(session.id)} AND datos_despues ? 'cashSnapshot'`);
  return e9FrozenCut(session, result.rows.map(row => row.snapshot));
}