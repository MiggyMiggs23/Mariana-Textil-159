import { Router, type Request, type Response, type NextFunction } from "express";
import { z } from "zod";
import { db } from "@workspace/db";
import { requireSession } from "../middlewares/auth";
import { resolvePermiso } from "../lib/permisos";
import { getRequestIp } from "../lib/request";
import { e9OffBoundary } from "../lib/e9-http";
import { E9Error, e9Command, e9Scope, e9Capabilities, type E9Action } from "../lib/e9";
import { e9Repository, readE9Detail, listE9 } from "../lib/e9-repository";
import { FondoError } from "../lib/fondo";
import { E9CutError } from "../lib/e9-cut";

const router = Router();
// Early boundary precedes auth and all DB access. No E9 schema reads while OFF.
router.use("/e9", e9OffBoundary);
router.use("/e9", requireSession, async (req, res, next) => {
  try {
    const user = req.auth!.user;
    const permission = await resolvePermiso(user.id, user.rol, "cortes");
    if (!permission?.puedeVer) throw new E9Error("E9_FORBIDDEN", "Sin permiso de consulta de cortes.", 403);
    res.locals.e9CanSend = permission.puedeCrear;
    next();
  } catch (error) { next(error); }
});
const actor = (req: Request) => ({ ...req.auth!.user, ip: getRequestIp(req), puedeEnviar: req.res?.locals.e9CanSend === true });
const id = (req: Request) => z.string().uuid().parse(req.params.id);
router.get("/e9/disponibilidad", (req, res, next) => {
  try {
    const site = z.coerce.number().int().positive().parse(req.query.ubicacionId);
    e9Scope(actor(req), site);
    res.json({ enabled: true, ubicacionId: site, capacidades: e9Capabilities(actor(req)) });
  } catch (error) { next(error); }
});
router.get("/e9/entregas", async (req, res, next) => {
  try {
    const query = z.object({ ubicacionId: z.coerce.number().int().positive(),
      estado: z.enum(["ENVIADA", "CONTADA", "AUTORIZADA"]).optional(),
      cursor: z.string().uuid().optional(), limit: z.coerce.number().int().min(1).max(100).default(25) }).strict().parse(req.query);
    res.json(await listE9(db, actor(req), query));
  } catch (error) { next(error); }
});
router.get("/e9/entregas/:id", async (req, res, next) => {
  try { res.json(await readE9Detail(db, id(req), actor(req))); } catch (error) { next(error); }
});
function command(action: E9Action) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await db.transaction(tx => e9Command(e9Repository(tx), actor(req), action, req.body,
        action === "ENVIAR" ? undefined : id(req)));
      res.status(action === "ENVIAR" || action === "CONTAR" ? 201 : 200).json(result);
    } catch (error) { next(error); }
  };
}
router.post("/e9/entregas", command("ENVIAR"));
router.post("/e9/entregas/:id/conteos", command("CONTAR"));
router.post("/e9/entregas/:id/autorizar", command("AUTORIZAR"));
router.post("/e9/entregas/:id/investigacion/cierre", command("CERRAR"));
router.use("/e9", (error: unknown, _req: Request, res: Response, next: NextFunction) => {
  if (error instanceof E9Error || error instanceof E9CutError) { res.status(error.status).json({ error: { code: error.code, message: error.message } }); return; }
  if (error instanceof z.ZodError) { res.status(400).json({ error: { code: "E9_VALIDATION", message: "Datos E9 inválidos." } }); return; }
  if (error instanceof FondoError) { res.status(error.status).json({ error: { code: "E9_STATE_CONFLICT", message: error.message } }); return; }
  next(error);
});
export default router;