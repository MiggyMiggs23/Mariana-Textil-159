import { Router, type Request, type RequestHandler } from "express";
import { z } from "zod";
import { getRequestIp } from "../lib/request";
import type { E3Context } from "../lib/e3-context";
import { confirmE3, E3_ENABLED, E3Error, parseE3Input, previewE3, type E3Origin, type E3Receipt, type E3Repository } from "../lib/e3-collection";
import { CreditEvidenceError } from "../lib/credit-evidence-contract";

export interface E3RouterDependencies {
  authenticate: RequestHandler;
  permission(module: string, action: "crear"): RequestHandler;
  admin: RequestHandler;
  repository(req: Request): E3Repository;
  receipts(filter: { folio?: string; clienteId?: number; movimientoId?: number; sesionCajaId?: number }): Promise<E3Receipt[]>;
  print(folio: string, motivo: string, actorId: number, ip: string): Promise<void>;
  context(req: Request, buscar: string, sitioId?: number): Promise<E3Context>;
}
/** Injected repository enables exercising mounted HTTP handlers with no database import. */
export function createE3Router(deps: E3RouterDependencies) {
  const router = Router();
  const gate: RequestHandler = (_req, res, next) => {
    if (!E3_ENABLED) { res.status(423).json({ code: "E3_CLOSED", error: "E3 no ha sido liberado por el propietario." }); return; }
    next();
  };
  const id = z.coerce.number().int().positive().max(2147483647);
  router.get("/caja/abonos-e3/contexto", gate, deps.authenticate, deps.permission("caja_abonos", "crear"), async (req, res, next) => {
    try {
      const buscar = z.string().max(100).parse(req.query.buscar ?? "");
      const sitioId = req.query.sitioId == null ? undefined : id.parse(req.query.sitioId);
      res.json(await deps.context(req, buscar, sitioId));
    } catch (error) { next(error); }
  });
  const action = (origin: E3Origin, confirm: boolean): RequestHandler => async (req, res, next) => {
    try {
      const now = new Date();
      const raw = origin === "RECAPTURA" ? { ...req.body, clienteId: id.parse(req.params.id) } : req.body;
      if (origin === "RECAPTURA" && req.body.clienteId != null && req.body.clienteId !== raw.clienteId) {
        throw new E3Error("CLIENT_MISMATCH", "El cliente no coincide con la ruta.", 400);
      }
      const input = parseE3Input(raw, origin, now);
      const actor = { id: req.auth!.user.id, rol: req.auth!.user.rol };
      const result = await (confirm ? confirmE3 : previewE3)(deps.repository(req), input, origin, actor, now);
      res.status(confirm ? 201 : 200).json(result);
    } catch (error) { next(error); }
  };
  for (const [base, origin, module] of [
    ["/caja/abonos-e3", "CAJA", "caja_abonos"],
    ["/clientes/:id/recapturas-e3", "RECAPTURA", "clientes_recapturas"],
  ] as const) {
    router.post(`${base}/vista-previa`, gate, deps.authenticate, deps.permission(module, "crear"), action(origin, false));
    router.post(base, gate, deps.authenticate, deps.permission(module, "crear"), action(origin, true));
  }
  router.get("/recibos-e3/:folio", gate, deps.authenticate, deps.admin, async (req, res, next) => {
    try {
      const rows = await deps.receipts({ folio: z.string().regex(/^E3-[1-9][0-9]*-[0-9]{8,10}$/).parse(req.params.folio) });
      if (!rows.length) throw new E3Error("RECEIPT_NOT_FOUND", "Sin snapshot E3: no se reconstruye con saldos actuales.", 404);
      res.json(rows[0]);
    } catch (error) { next(error); }
  });
  const list: RequestHandler = async (req, res, next) => {
    try {
      const filter = {
        clienteId: req.params.id ? id.parse(req.params.id) : undefined,
        movimientoId: req.query.movimientoId ? id.parse(req.query.movimientoId) : undefined,
        sesionCajaId: req.query.sesionCajaId ? id.parse(req.query.sesionCajaId) : undefined,
      };
      if (!filter.clienteId && !filter.sesionCajaId) throw new E3Error("SESSION_REQUIRED", "Indica sesión del corte.", 400);
      res.json(await deps.receipts(filter));
    } catch (error) { next(error); }
  };
  router.get("/clientes/:id/recibos-e3", gate, deps.authenticate, deps.admin, list);
  router.get("/caja/recibos-e3", gate, deps.authenticate, deps.admin, list);
  router.post("/recibos-e3/:folio/impresiones", gate, deps.authenticate, deps.admin, async (req, res, next) => {
    try {
      const { motivo } = z.object({ motivo: z.string().trim().min(1).max(2000) }).strict().parse(req.body);
      await deps.print(z.string().regex(/^E3-[1-9][0-9]*-[0-9]{8,10}$/).parse(req.params.folio), motivo, req.auth!.user.id, getRequestIp(req));
      res.json({ registrado: true });
    } catch (error) { next(error); }
  });
  router.use((error: unknown, _req: Request, res: import("express").Response, next: import("express").NextFunction) => {
    if (error instanceof E3Error) { res.status(error.status).json({ code: error.code, error: error.message }); return; }
    if (error instanceof CreditEvidenceError) { res.status(error.status).json({ code: "E1_EVIDENCE_REJECTED", error: error.message }); return; }
    if (error instanceof z.ZodError) { res.status(400).json({ code: "E3_INVALID_INPUT", error: error.issues.map(i => `${i.path.join(".")}: ${i.message}`).join("; ") }); return; }
    next(error);
  });
  return router;
}