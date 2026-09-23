import type { RequestHandler } from "express";
import { E9_ENABLED } from "./e9-feature";
/** Mount at /e9 before auth, permission reads, transactions or schema access. */
export const e9OffBoundary: RequestHandler = (req, res, next) => {
  if (E9_ENABLED) { next(); return; }
  if (req.method === "GET" && req.path === "/disponibilidad") {
    res.json({ enabled: false, motivoInactivo: "E9 todavía no está habilitado." }); return;
  }
  res.status(403).json({ error: { code: "E9_DISABLED", message: "E9 todavía no está habilitado." } });
};