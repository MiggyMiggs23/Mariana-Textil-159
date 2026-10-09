import type { RequestHandler } from "express";
import { E5_ENABLED } from "./e5-feature";
import { E5Error } from "./e5";

/** Drizzle wraps PostgreSQL errors in cause. Never leak SQL or documentary payloads. */
export function e5DatabaseError(error: unknown): E5Error | undefined {
  let cause = error;
  const seen = new Set<unknown>();
  while (cause && typeof cause === "object" && !seen.has(cause)) {
    seen.add(cause);
    const value = cause as { code?: string; message?: string; constraint?: string; cause?: unknown };
    if (["E1P01", "E1C01", "42P01", "42703"].includes(value.code ?? "") ||
        (value.code === "23514" && value.constraint === "operaciones_productor_naturaleza_ck_e1") ||
        (value.code === "P0001" && (value.message?.startsWith("E5_DISABLED:") ||
          value.message?.startsWith("E1: productor incompatible con tipo/signo/incobrable")))) {
      return new E5Error("E5_DEPENDENCY_DISABLED", "Dependencia E5 no habilitada; no se registró la operación.", 409);
    }
    if (["23505", "23503", "23514", "40001", "40P01"].includes(value.code ?? "") ||
        (value.code === "P0001" && value.message?.startsWith("E5:"))) {
      return new E5Error("E5_STATE_CONFLICT", "La operación no pudo conservar su integridad; recarga y confirma otra vez.", 409);
    }
    cause = value.cause;
  }
  return undefined;
}
export const e5OffBoundary: RequestHandler = (req, res, next) => {
  if (E5_ENABLED) { next(); return; }
  if (req.method === "GET" && req.path.replace(/\/$/, "") === "/disponibilidad") {
    res.json({ enabled: false, capacidades: { puedeRecibir: false, puedePreparar: false,
      puedeAutorizar: false, puedeRechazar: false, puedeDevolver: false,
      puedeVerAvisos: false, puedeImprimir: false, preparacionADisponible: false } });
    return;
  }
  res.status(403).json({ error: { code: "E5_DISABLED", message: "E5 no está habilitado." } });
};