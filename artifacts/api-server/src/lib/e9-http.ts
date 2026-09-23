import type { RequestHandler } from "express";
import { E9_ENABLED } from "./e9-feature";
/** Mount at /e9 before auth, permission reads, transactions or schema access. */
export function createE9OffBoundary(enabled = E9_ENABLED): RequestHandler {
  return (req, res, next) => {
    if (enabled) { next(); return; }
    if (req.method === "GET" && req.path === "/disponibilidad") {
      res.json({ enabled: false, motivoInactivo: "E9 todavía no está habilitado." }); return;
    }
    res.status(403).json({ error: { code: "E9_DISABLED", message: "E9 todavía no está habilitado." } });
  };
}
export const e9OffBoundary = createE9OffBoundary();