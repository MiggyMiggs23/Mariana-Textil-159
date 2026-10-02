import type { RequestHandler } from "express";
import { E11Error, e11ErrorBody } from "../lib/e11";

/** Pure policy; callers cannot broaden CONTADOR through permission overrides or aliases. */
export function e11LegacyAllowed(enabled: boolean, role: string | undefined, path: string) {
  return !enabled || role !== "CONTADOR" || ["/auth/me", "/auth/logout"].includes(path);
}
/** Authentication remains real in production; fake infrastructure need not mount a DB router. */
export function createE11LegacyBoundary(enabled: boolean, authenticate: RequestHandler): RequestHandler {
  return (req, res, next) => {
    if (!enabled || req.path === "/healthz" || req.path === "/auth/login") { next(); return; }
    Promise.resolve(authenticate(req, res, error => {
      if (error) { next(error); return; }
      if (!e11LegacyAllowed(enabled, req.auth?.user.rol, req.path)) {
        res.status(403).json(e11ErrorBody(new E11Error("PERFIL_DENEGADO", "Utiliza la proyección E11 autorizada.", 403)));
        return;
      }
      next();
    })).catch(next);
  };
}