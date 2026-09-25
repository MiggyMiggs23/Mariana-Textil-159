import { Router, type Request, type Response, type NextFunction } from "express";
import { z } from "zod";
import { requireRole, requireSession } from "../middlewares/auth";
import { COMMERCIAL_RETURNS_ENABLED, COMMERCIAL_RETURN_PATH, CommercialReturnError } from "../lib/commercial-return-contract";
import { postCommercialReturn, previewCommercialReturn } from "../lib/commercial-return";
import { getRequestIp } from "../lib/request";

const router = Router();
const input = z.object({
  uuidCliente: z.string().uuid(),
  ticketId: z.number().int().positive(), lineaId: z.number().int().positive(),
  ubicacionRecepcionId: z.number().int().positive(), sesionCajaId: z.number().int().positive(),
  cantidad: z.string().regex(/^(0|[1-9][0-9]{0,6})\.[0-9]{3}$/),
  motivo: z.string().trim().min(1).max(400),
  revision: z.object({
    importeRollo: z.string().regex(/^(0|[1-9][0-9]*)\.[0-9]{2}$/),
    deudaCancelada: z.string().regex(/^(0|[1-9][0-9]*)\.[0-9]{2}$/),
    efectivoDevuelto: z.string().regex(/^(0|[1-9][0-9]*)\.[0-9]{2}$/),
  }).strict().optional(),
}).strict();
router.use(COMMERCIAL_RETURN_PATH, (_req, res, next) => {
  if (!COMMERCIAL_RETURNS_ENABLED) {
    res.status(403).json({ error: { code: "DEVOLUCION_COMERCIAL_CERRADA", message: "Devolución comercial no habilitada." } });
    return;
  }
  next();
});
router.post(COMMERCIAL_RETURN_PATH, requireSession, requireRole("ADMIN"), async (req, res, next) => {
  try { res.status(201).json(await postCommercialReturn(req.auth!.user.id, input.required({ revision: true }).parse(req.body), getRequestIp(req))); }
  catch (error) { next(error); }
});
router.post(`${COMMERCIAL_RETURN_PATH}/vista-previa`, requireSession, requireRole("ADMIN"), async (req, res, next) => {
  try { res.json(await previewCommercialReturn(req.auth!.user.id, input.parse(req.body), getRequestIp(req))); }
  catch (error) { next(error); }
});
router.use(COMMERCIAL_RETURN_PATH, (error: unknown, _req: Request, res: Response, next: NextFunction) => {
  if (error instanceof CommercialReturnError) {
    res.status(error.status).json({ error: { code: error.code, message: error.message } }); return;
  }
  if (error instanceof z.ZodError) {
    res.status(400).json({ error: { code: "DEVOLUCION_DATOS_INVALIDOS", message: "Datos de devolución inválidos." } }); return;
  }
  next(error);
});
export default router;