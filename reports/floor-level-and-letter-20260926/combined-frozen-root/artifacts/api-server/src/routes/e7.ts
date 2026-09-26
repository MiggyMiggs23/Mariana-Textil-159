import { Router, type Request, type Response, type NextFunction } from "express";
import { z } from "zod";
import {
  E7_ATTRIBUTION_ENABLED,
  E7_CLIENT_FINANCIAL_READS_ENABLED,
  E7_ENABLED,
} from "../lib/e7-feature";
import { E7Error, E7ScopeQuery, E7AttributionQuery, e7Reader } from "../lib/e7-read-model";
import { requireSession } from "../middlewares/auth";
import { e7AttributionWorkbook, e7AttributionPdf } from "../lib/e7-export";

export function e7Error(error: unknown, res: Response, next: NextFunction) {
  if (error instanceof E7Error) {
    res.status(error.status).json({ code: error.code, message: error.message }); return;
  }
  if (error instanceof z.ZodError) {
    res.status(400).json({ code: "VALIDACION", message: "Consulta E7 inválida." }); return;
  }
  const scope = error as { name?: string; status?: number; message?: string };
  if (scope.status === 400 || scope.status === 403) {
    res.status(scope.status).json({ code: "ALCANCE_DENEGADO", message: scope.message }); return;
  }
  // Never silently switch to legacy unscoped data when dependencies are unavailable.
  if (!res.headersSent) res.status(503).json({ code: "E7_DEPENDENCIA_NO_DISPONIBLE", message: "No fue posible leer E7; no se usa una fuente alternativa." });
  else next(error);
}
const router = Router();
router.get("/e7/disponibilidad", (_req, res) => {
  res.json({
    enabled: E7_ENABLED,
    clienteFinanzas: E7_CLIENT_FINANCIAL_READS_ENABLED,
    atribucion: E7_ATTRIBUTION_ENABLED,
  });
});
router.use("/e7", (_req, res, next) => {
  if (!E7_ENABLED) { res.status(403).json({ code: "E7_DISABLED", message: "E7 no está habilitado." }); return; }
  next();
});
router.use("/e7", requireSession);
const session = (req: Request) => ({ userId: req.auth!.user.id, sessionId: req.auth!.sessionId });
router.use(["/e7/atribucion", "/e7/atribucion.xlsx", "/e7/atribucion.pdf"], (_req, res, next) => {
  if (!E7_ATTRIBUTION_ENABLED) {
    res.status(403).json({ code: "E7_ATRIBUCION_DISABLED", message: "La atribución E7 permanece cerrada." });
    return;
  }
  next();
});
router.get("/e7/atribucion", async (req, res, next) => {
  try {
    const result = await e7Reader.attribution(session(req), E7AttributionQuery.parse(req.query));
    res.setHeader("Cache-Control", "no-store"); res.json(result);
  } catch (error) { e7Error(error, res, next); }
});
router.get(["/e7/atribucion.xlsx", "/e7/atribucion.pdf"], async (req, res, next) => {
  try {
    const result = await e7Reader.attribution(session(req), E7AttributionQuery.parse(req.query));
    res.setHeader("Cache-Control", "no-store");
    if (req.path.endsWith(".xlsx")) {
      res.type("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.attachment("atribucion-e7.xlsx"); await e7AttributionWorkbook(result).xlsx.write(res); res.end();
    } else {
      res.type("application/pdf"); res.attachment("atribucion-e7.pdf"); res.send(e7AttributionPdf(result));
    }
  } catch (error) { e7Error(error, res, next); }
});
router.get("/e7/clientes/:clienteId/exportacion", async (req, res, next) => {
  try {
    if (!E7_CLIENT_FINANCIAL_READS_ENABLED)
      throw new E7Error("E7_DISABLED", "Los lectores financieros de clientes permanecen cerrados.", 403);
    const id = z.coerce.number().int().positive().max(2147483647).parse(req.params.clienteId);
    const result = await e7Reader.statement(session(req), id, E7ScopeQuery.parse(req.query));
    res.setHeader("Cache-Control", "no-store"); res.json(result);
  } catch (error) { e7Error(error, res, next); }
});
router.use("/e7", (_req, res) => { res.status(404).json({ code: "NO_ENCONTRADO", message: "Ruta E7 no encontrada." }); });
export default router;