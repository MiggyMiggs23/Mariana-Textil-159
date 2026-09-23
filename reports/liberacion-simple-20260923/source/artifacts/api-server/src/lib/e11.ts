import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import { parseMexicoDateQuery } from "./mexico-date";

export class E11Error extends Error {
  constructor(public code: string, message: string, public status = 409) { super(message); }
}
/** No original cause or protected DTO may cross a post-commit authorization boundary. */
export class E11OutcomeError extends E11Error {
  constructor(public uuid: string, confirmed: boolean) {
    super(confirmed ? "RESULTADO_CONFIRMADO_NO_CONSULTABLE" : "RESULTADO_INCIERTO",
      confirmed
        ? "La intención quedó confirmada, pero su resultado no puede consultarse ahora. Conserva el UUID original; no repitas con otro UUID."
        : "No se puede determinar si la intención quedó confirmada. Conserva el UUID y cuerpo originales; no repitas con otro UUID.",
      confirmed ? 409 : 503);
  }
}
export const e11ErrorBody = (error: E11Error) => ({
  code: error.code, message: error.message, requestId: randomUUID(),
  ...(error instanceof E11OutcomeError ? { uuid: error.uuid } : {}),
});
export const e11Id = z.coerce.number().int().positive().max(2147483647);
export const e11Uuid = z.string().uuid().transform(s => s.toLowerCase());
export const e11Page = z.object({
  cursor: z.string().max(2048).optional(), limit: z.coerce.number().int().min(1).max(100).default(50),
});
export type E11Identity = {
  usuarioId: number; rolBase: string; perfil: "A" | "F" | null;
  perfilVersion: number; permisosVersion: string; capacidades: string[];
};
export function e11Canonical(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(e11Canonical).join(",")}]`;
  return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${JSON.stringify(k)}:${e11Canonical(v)}`).join(",")}}`;
}
export const e11Hash = (value: unknown) => createHash("sha256").update(e11Canonical(value)).digest("hex");
export function e11Money(cents: bigint) {
  const abs = cents < 0n ? -cents : cents;
  return `${cents < 0n ? "-" : ""}${abs / 100n}.${String(abs % 100n).padStart(2, "0")}`;
}
export function e11Cents(value: string): bigint {
  if (!/^-?\d+\.\d{2}$/.test(value)) throw new E11Error("DEPENDENCIA_NO_DISPONIBLE", "Importe canónico inválido.", 503);
  return BigInt(value.replace(".", ""));
}
export function e11Date(value: string): Date {
  const date = parseMexicoDateQuery(value, "start");
  if (!date) throw new E11Error("VALIDACION", "Fecha calendario inválida.", 400);
  return date;
}
export function e11LocalDate(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Mexico_City",
    year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const get = (k: string) => parts.find(p => p.type === k)!.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}
const calendar = (date: string) => new Date(`${date}T12:00:00Z`);
export function e11Advance(date: string, days: number) {
  const d = calendar(date); d.setUTCDate(d.getUTCDate() + days); return d.toISOString().slice(0, 10);
}
export type E11PeriodType = "DIA" | "SEMANA" | "MES";
export function e11Period(tipo: E11PeriodType, inicio: string, now = new Date()) {
  e11Date(inicio);
  const d = calendar(inicio);
  if ((tipo === "SEMANA" && d.getUTCDay() !== 1) || (tipo === "MES" && d.getUTCDate() !== 1))
    throw new E11Error("VALIDACION", "El inicio no corresponde al periodo calendario.", 400);
  if (tipo === "MES") d.setUTCMonth(d.getUTCMonth() + 1);
  const finExclusivo = tipo === "MES" ? d.toISOString().slice(0, 10) : e11Advance(inicio, tipo === "SEMANA" ? 7 : 1);
  return { tipo, inicio, finExclusivo, zona: "America/Mexico_City" as const, obligatorio: tipo !== "DIA",
    estado: e11Date(finExclusivo) > now ? "ABIERTO" : "PENDIENTE", ultimaConciliacionId: null as string | null };
}
export function e11Range(desde: string, hasta: string) {
  const start = e11Date(desde), end = e11Date(hasta);
  if (start >= end) throw new E11Error("VALIDACION", "Rango vacío o invertido.", 400);
  return { start, end };
}
export function e11Capability(identity: E11Identity, capability: string) {
  if (!identity.capacidades.includes(capability))
    throw new E11Error("PERFIL_DENEGADO", "El perfil vigente no autoriza esta operación.", 403);
}
/** Cursor is not authorization: its entire scope hash is compared to a freshly authorized read. */
export function e11Paginate<T>(items: T[], query: { cursor?: string; limit: number }, identity: E11Identity,
  filters: unknown, revision: string) {
  const scope = e11Hash({ identity, filters, revision });
  let offset = 0;
  if (query.cursor) {
    try {
      const cursor = z.object({ scope: z.string(), offset: z.number().int().nonnegative() }).strict()
        .parse(JSON.parse(Buffer.from(query.cursor, "base64url").toString("utf8")));
      if (cursor.scope !== scope) throw new Error("scope");
      offset = cursor.offset;
    } catch { throw new E11Error("FUENTE_CAMBIADA", "El cursor perdió vigencia; reinicia la consulta."); }
  }
  const end = offset + query.limit;
  return { items: items.slice(offset, end),
    nextCursor: end < items.length ? Buffer.from(JSON.stringify({ scope, offset: end })).toString("base64url") : null };
}