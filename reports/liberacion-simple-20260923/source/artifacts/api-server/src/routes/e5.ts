import { Router, type Request, type Response, type NextFunction } from "express";
import { z } from "zod";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { requireSession } from "../middlewares/auth";
import { resolvePermiso } from "../lib/permisos";
import { getRequestIp } from "../lib/request";
import { loadCustomerCreditLedgerInTransaction } from "../lib/credit-aging-read-model";
import { readSessionCash } from "../lib/caja-corte-reader";
import { e5OffBoundary, e5DatabaseError } from "../lib/e5-http";
import { E5Error, e5Command, e5Preview, e5Scope, e5Capabilities, e5Print, e5Canonical, type E5Actor, type E5Action } from "../lib/e5";
import { e5Repository, e5Context, readE5Cobro, listE5Cobros, readE5Document, e5RefundOptions, type E5Dependencies } from "../lib/e5-repository";
import { FondoError } from "../lib/fondo";

const router = Router();
router.use("/e5", e5OffBoundary);
router.use("/e5", requireSession, async (req, res, next) => {
  try {
    const user = req.auth!.user;
    const [cash, client] = await Promise.all([
      resolvePermiso(user.id, user.rol, "caja_abonos"), resolvePermiso(user.id, user.rol, "clientes_finanzas"),
    ]);
    const actor: E5Actor = { id: user.id, nombre: user.nombre, rol: user.rol, ubicacionId: user.ubicacionId,
      ip: getRequestIp(req), ver: cash?.puedeVer === true || client?.puedeVer === true,
      recibirCaja: cash?.puedeCrear === true, recibirCliente: client?.puedeCrear === true,
      todas: user.rol === "ADMIN" || user.alcanceConsulta === "TODAS",
      capacidadAE11: false }; // Explicit closed integration; never derive A from legacy CONTADOR.
    if (!actor.ver) throw new E5Error("E5_FORBIDDEN", "Sin permiso efectivo de consulta.", 403);
    // E11 privacy/role migration is later, not an implicit exception here.
    if (["CONTADOR", "SISTEMAS", "BODEGA"].includes(actor.rol))
      throw new E5Error("E5_FORBIDDEN", "Este perfil no tiene acceso E5.", 403);
    res.locals.e5Actor = actor;
    next();
  } catch (error) { next(error); }
});
const actor = (req: Request): E5Actor => req.res!.locals.e5Actor;
const id = (req: Request) => z.string().uuid().transform(v => v.toLowerCase()).parse(req.params.id);
const documentId = (req: Request) => z.string().uuid().transform(v => v.toLowerCase()).parse(req.params.documentoId);
const dependencies: E5Dependencies = {
  ledger: (tx, client) => loadCustomerCreditLedgerInTransaction(client, tx),
  async cash(tx, session) {
    const result = await readSessionCash(tx as Parameters<typeof readSessionCash>[0],
      session as unknown as Parameters<typeof readSessionCash>[1], { efectivoEsperado: "0.00", diferencia: null });
    if (!result.efectivoDesglose || result.efectivoDesglose.version !== "E2")
      throw new E5Error("E5_SOURCE_UNAVAILABLE", "Falta efectivo canónico; no se usa saldo histórico ni cero supuesto.");
    return result.efectivoEsperado;
  },
};
router.get("/e5/disponibilidad", (req, res, next) => {
  try {
    e5Scope(actor(req), z.coerce.number().int().positive().parse(req.query.ubicacionId));
    res.json({ enabled: true, capacidades: e5Capabilities(actor(req)) });
  } catch (error) { next(error); }
});
router.get("/e5/contexto", async (req, res, next) => {
  try {
    const query = z.object({ clienteId: z.coerce.number().int().positive(), ubicacionId: z.coerce.number().int().positive() }).strict().parse(req.query);
    const { deudaGlobal: _debt, ubicacionNombre: _site, ...context } = await db.transaction(tx =>
      e5Context(tx, dependencies, query.clienteId, query.ubicacionId, actor(req)));
    res.json(context);
  } catch (error) { next(error); }
});
const listQuery = z.object({ ubicacionId: z.coerce.number().int().positive(), clienteId: z.coerce.number().int().positive().optional(),
  estado: z.enum(["PENDIENTE", "PARCIAL", "APLICADO", "DEVUELTO"]).optional(), cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25) }).strict();
router.get("/e5/cobros", async (req, res, next) => {
  try { res.json(await listE5Cobros(db, actor(req), listQuery.parse(req.query))); } catch (error) { next(error); }
});
router.get("/e5/avisos", async (req, res, next) => {
  try {
    const query = listQuery.omit({ clienteId: true, estado: true }).parse(req.query);
    res.json(await listE5Cobros(db, actor(req), query, true));
  } catch (error) { next(error); }
});
router.get("/e5/cobros/:id", async (req, res, next) => {
  try { res.json(await readE5Cobro(db, id(req), actor(req))); } catch (error) { next(error); }
});
router.post("/e5/cobros/vista-previa", async (req, res, next) => {
  try {
    res.json(await db.transaction(tx => e5Preview(e5Repository(tx, dependencies), actor(req), req.body)));
  } catch (error) { next(error); }
});
function command(action: E5Action) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await db.transaction(tx => e5Command(e5Repository(tx, dependencies), actor(req), action, req.body,
        action === "RECIBIR" ? undefined : id(req)));
      res.status(action === "RECIBIR" || action === "PROPONER" ? 201 : 200).json(result);
    } catch (error) { next(error); }
  };
}
router.post("/e5/cobros", command("RECIBIR"));
router.post("/e5/cobros/:id/propuestas", command("PROPONER"));
router.post("/e5/cobros/:id/autorizar", command("AUTORIZAR"));
router.post("/e5/cobros/:id/rechazar", command("RECHAZAR"));
router.post("/e5/cobros/:id/devolver", command("DEVOLVER"));
router.get("/e5/cobros/:id/devolucion/opciones", async (req, res, next) => {
  try { res.json(await e5RefundOptions(db, id(req), actor(req))); } catch (error) { next(error); }
});
router.get("/e5/cobros/:id/documentos/:documentoId", async (req, res, next) => {
  try { res.json(await readE5Document(db, id(req), documentId(req), actor(req))); } catch (error) { next(error); }
});
router.post("/e5/cobros/:id/documentos/:documentoId/impresiones", async (req, res, next) => {
  try {
    const input = e5Print.parse(req.body), a = actor(req), cobroId = id(req), docId = documentId(req);
    await db.transaction(async tx => {
      await readE5Document(tx, cobroId, docId, a);
      const repo = e5Repository(tx, dependencies);
      await repo.lockKey(input.claveOperacion);
      const content = e5Canonical({ action: "IMPRIMIR", cobroId, docId, input });
      const prior = await repo.replay(input.claveOperacion);
      if (prior) {
        if (prior.actorId !== a.id || prior.content !== content)
          throw new E5Error("E5_IDEMPOTENCY_CONFLICT", "Clave de impresión usada para otra intención.");
        return;
      }
      await tx.execute(sql`INSERT INTO e5_impresiones(clave,documento_id,actor_id,content,motivo)
        VALUES (${input.claveOperacion}::uuid,${docId}::uuid,${a.id},${content},${input.motivo})`);
      await tx.execute(sql`INSERT INTO auditoria(usuario_id,modulo,accion,entidad,entidad_id,datos_despues,ip)
        VALUES (${a.id},'FONDO','E5_IMPRIMIR','e5_documentos',${docId},
        ${JSON.stringify({ cobroId, docId, motivo: input.motivo })}::jsonb,${a.ip})`);
    });
    res.json({ registrado: true });
  } catch (error) { next(error); }
});
router.use("/e5", (error: unknown, _req: Request, res: Response, next: NextFunction) => {
  if (error instanceof E5Error) { res.status(error.status).json({ error: { code: error.code, message: error.message } }); return; }
  if (error instanceof z.ZodError) { res.status(400).json({ error: { code: "E5_VALIDATION", message: "Datos E5 inválidos." } }); return; }
  if (error instanceof FondoError) {
    res.status(error.status).json({ error: { code: error.code === "FONDO_SALDO_INSUFICIENTE" ? "E5_INSUFFICIENT_FUNDS" : "E5_SOURCE_UNAVAILABLE", message: error.message } }); return;
  }
  const databaseError = e5DatabaseError(error);
  if (databaseError) {
    res.status(databaseError.status).json({ error: { code: databaseError.code, message: databaseError.message } }); return;
  }
  next(error);
});
export default router;