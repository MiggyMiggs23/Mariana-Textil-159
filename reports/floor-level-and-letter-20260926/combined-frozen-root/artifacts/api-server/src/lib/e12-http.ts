import { z } from "zod";
import { E12Error, E12_SUPPLIER_CASH_ENABLED, requireE12, type E12Actor, type E12Split } from "./e12-supplier-cash";
const money = z.string().regex(/^(0|[1-9][0-9]*)\.[0-9]{2}$/);
export const e12OverrideSchema = z.object({ motivo: z.string().trim().min(1).max(1000) }).strict();
export const e12SplitSchema = z.object({
  claveOperacion: z.string().uuid(), caja: money, fondo: money.optional(),
  sesionCajaId: z.number().int().positive().nullable().optional(), desbloqueoCaja: e12OverrideSchema.optional(),
}).strict();
export const e12ApprovalSchema = z.object({ claveOperacion: z.string().uuid(), desbloqueoCaja: e12OverrideSchema.optional() }).strict();
export function e12ApprovedSplit(source: E12Split, approval: unknown): E12Split {
  const parsed = e12ApprovalSchema.parse(approval);
  return { ...source, claveOperacion: parsed.claveOperacion,
    desbloqueoCaja: parsed.desbloqueoCaja ?? source.desbloqueoCaja };
}
export const e12ReturnSchema = z.object({ claveOperacion: z.string().uuid(),
  naturaleza: z.enum(["CORRECCION_CAPTURA", "RECUPERACION_EFECTIVO"]),
}).strict();
export function e12Actor(user: { id: number; nombre: string; rol: string; ubicacionId: number | null }, ip: string): E12Actor {
  return { id: user.id, nombre: user.nombre, rol: user.rol, ubicacionId: user.ubicacionId, ip };
}
export function e12NumberAmount(value: number): string {
  if (!Number.isFinite(value) || value <= 0 || !Number.isSafeInteger(Math.round(value * 100)) ||
    Math.abs(value * 100 - Math.round(value * 100)) > 0.000001)
    throw new E12Error("E12_AMOUNT", "Importe positivo, finito y exacto a centavos obligatorio.");
  return value.toFixed(2);
}
export function e12CaptureInput(forma: string, raw: unknown) {
  if (raw !== undefined) {
    requireE12();
    if (forma !== "EFECTIVO") throw new E12Error("E12_PAYMENT_METHOD", "Solo efectivo admite reparto caja/Fondo.");
  }
  if (!E12_SUPPLIER_CASH_ENABLED || forma !== "EFECTIVO") return undefined;
  return e12SplitSchema.parse(raw);
}