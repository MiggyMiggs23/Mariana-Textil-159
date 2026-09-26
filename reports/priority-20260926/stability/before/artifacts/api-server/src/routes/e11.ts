import { Router, type Request, type Response, type NextFunction } from "express";
import { z } from "zod";
import {
  AssignE11PerfilBody, CreateE11ConciliacionBody, DecideE11ConciliacionBody, PrepareE11AplicacionBody,
  GetE11IdentidadResponse, AssignE11PerfilResponse, ListE11PerfilHistorialResponse,
  ListE11FiscalClientesResponse, ListE11FiscalVentasResponse, GetE11FiscalFacturaResponse,
  ListE11FinanzasClientesResponse, ListE11FinanzasNotasResponse, GetE11FinanzasEstadoCuentaResponse,
  ListE11ConciliacionesResponse, GetE11ConciliacionResponse, ListE11ConciliacionVentasResponse,
  ListE11PreparacionesResponse, GetE11PreparacionResponse,
} from "@workspace/api-zod";
import { requireSession } from "../middlewares/auth";
import { getRequestIp } from "../lib/request";
import { E11_ENABLED, E11_PROFILE_ASSIGNMENT_ENABLED, E11_RECONCILIATION_ENABLED, E11_E5_PREPARATION_ENABLED } from "../lib/e11-feature";
import { E5_ENABLED, E5_CONTADOR_A_ENABLED } from "../lib/e5-feature";
import { E5Error } from "../lib/e5";
import { E11Error, e11ErrorBody, e11Id, e11Uuid, e11Page, e11Hash, e11Paginate, type E11Identity } from "../lib/e11";
import {
  e11Identity, e11Execute, e11AssignProfile, e11ProfileHistory,
  e11FiscalClients, e11FiscalSales, e11FinanceClients, e11FinanceNotes, e11FinanceStatement,
  e11Periods, e11CreateSnapshot, e11Snapshot, e11SnapshotSales, e11DecideSnapshot,
  e11Preparations, e11Preparation, e11Prepare, type E11Sql,
  e11Recovery, e11Resolve, E11RecoveryTarget, E11RecoveryInput, E11RecoveryOutput,
} from "../lib/e11-repository";

const router = Router();
router.use("/e11", (req, res, next) => {
  if (req.method === "GET" && req.path === "/disponibilidad") {
    res.json({ enabled: E11_ENABLED, perfiles: E11_ENABLED && E11_PROFILE_ASSIGNMENT_ENABLED,
      conciliacion: E11_ENABLED && E11_RECONCILIATION_ENABLED,
      preparacionE5: E11_ENABLED && E11_E5_PREPARATION_ENABLED && E5_ENABLED && E5_CONTADOR_A_ENABLED });
    return;
  }
  if (!E11_ENABLED) {
    res.status(403).json(e11ErrorBody(new E11Error("E11_DISABLED", "E11 no está habilitado.", 403))); return;
  }
  next();
});
router.use("/e11", requireSession);
const dateRange = { desde: z.string(), hastaExclusivo: z.string() };
type Handler = (tx: E11Sql, actor: E11Identity, req: Request) => Promise<unknown>;
function endpoint(capability: string | null, output: { parse(value: unknown): unknown }, work: Handler, exclusive = false) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.auth!.user.id, session = req.auth!.sessionId;
      await e11Execute({
        userId, sessionId: session, capability, exclusive,
        mutationUuid: ["POST", "PUT"].includes(req.method) ? e11Uuid.parse(req.body?.uuid) : undefined,
        work: (tx, identity) => work(tx, identity, req),
        parse: value => output.parse(value),
        deliver(payload, current) {
          res.setHeader("Cache-Control", "no-store");
          res.setHeader("X-E11-Perfil", current.perfil ?? "NINGUNO");
          res.setHeader("X-E11-Perfil-Version", String(current.perfilVersion));
          res.setHeader("X-E11-Permisos-Version", current.permisosVersion);
          res.json(payload);
        },
      });
    } catch (error) { next(error); }
  };
}
function page<T>(items: T[], actor: E11Identity, req: Request, filters: unknown, revision = e11Hash(items)) {
  const query = e11Page.parse(req.query);
  return { ...e11Paginate(items, query, actor, filters, revision), fuenteRevision: revision };
}
router.get("/e11/identidad", endpoint(null, GetE11IdentidadResponse, async (_tx, actor) => actor));
router.get("/e11/operaciones/:actorId/:accion/:uuidOriginal", endpoint("FISCAL_LEER", E11RecoveryOutput, async (tx, actor, req) => {
  z.object({}).strict().parse(req.query);
  return e11Recovery(tx, actor, E11RecoveryTarget.parse(req.params));
}));
router.post("/e11/operaciones/:actorId/:accion/:uuidOriginal/resolucion", endpoint("FISCAL_LEER", E11RecoveryOutput, async (tx, actor, req) => {
  z.object({}).strict().parse(req.query);
  return e11Resolve(tx, actor, E11RecoveryTarget.parse(req.params), E11RecoveryInput.parse(req.body));
}));
router.get("/e11/usuarios/:usuarioId/perfil", endpoint("PERFILES_ADMINISTRAR", GetE11IdentidadResponse, async (tx, _a, req) => {
  const identity = await e11Identity(tx, e11Id.parse(req.params.usuarioId));
  if (identity.rolBase !== "CONTADOR") throw new E11Error("USUARIO_NO_CONTADOR", "El destinatario no es CONTADOR.", 422);
  return identity;
}));
router.put("/e11/usuarios/:usuarioId/perfil", endpoint("PERFILES_ADMINISTRAR", AssignE11PerfilResponse, async (tx, a, req) =>
  e11AssignProfile(tx, a, e11Id.parse(req.params.usuarioId), AssignE11PerfilBody.strict().parse(req.body)), true));
router.get("/e11/usuarios/:usuarioId/perfil/historial", endpoint("PERFILES_ADMINISTRAR", ListE11PerfilHistorialResponse, async (tx, a, req) => {
  e11Page.strict().parse(req.query);
  const id = e11Id.parse(req.params.usuarioId);
  return page(await e11ProfileHistory(tx, id), a, req, { route: "historial", id });
}));
router.get("/e11/fiscal/clientes", endpoint("FISCAL_LEER", ListE11FiscalClientesResponse, async (tx, a, req) => {
  e11Page.strict().parse(req.query);
  return page(await e11FiscalClients(tx), a, req, { route: "clientesF" });
}));
router.get("/e11/fiscal/ventas", endpoint("FISCAL_LEER", ListE11FiscalVentasResponse, async (tx, a, req) => {
  const query = e11Page.extend({ ...dateRange, clienteId: e11Id.optional() }).strict().parse(req.query);
  const sales = await e11FiscalSales(tx, query.desde, query.hastaExclusivo, query.clienteId);
  return { ...page(sales.items, a, req, { route: "ventasF", desde: query.desde,
    hasta: query.hastaExclusivo, clienteId: query.clienteId ?? null }, sales.fuenteRevision), totalFacturado: sales.totalFacturado };
}));
router.get("/e11/fiscal/facturas/:facturaId", endpoint("FISCAL_LEER", GetE11FiscalFacturaResponse, async (tx, _a, req) => {
  z.object({}).strict().parse(req.query);
  const id = e11Id.parse(req.params.facturaId);
  const sale = (await e11FiscalSales(tx)).items.find(s => s.facturaId === id);
  if (!sale) throw new E11Error("NO_ENCONTRADO", "Documento fiscal no encontrado.", 404);
  return sale;
}));
router.get("/e11/finanzas/clientes", endpoint("FINANZAS_LIMITADAS_LEER", ListE11FinanzasClientesResponse, async (tx, a, req) => {
  e11Page.strict().parse(req.query);
  return page(await e11FinanceClients(tx), a, req, { route: "clientesA" });
}));
router.get("/e11/finanzas/clientes/:clienteId/notas", endpoint("FINANZAS_LIMITADAS_LEER", ListE11FinanzasNotasResponse, async (tx, a, req) => {
  e11Page.strict().parse(req.query); const id = e11Id.parse(req.params.clienteId);
  return page(await e11FinanceNotes(tx, id), a, req, { route: "notasA", id });
}));
router.get("/e11/finanzas/clientes/:clienteId/estado-cuenta", endpoint("FINANZAS_LIMITADAS_LEER", GetE11FinanzasEstadoCuentaResponse, async (tx, a, req) => {
  e11Page.strict().parse(req.query); const id = e11Id.parse(req.params.clienteId);
  const statement = await e11FinanceStatement(tx, id);
  return { ...page(statement.items, a, req, { route: "estadoA", id }, e11Hash(statement)), cliente: statement.cliente };
}));
router.get("/e11/conciliaciones", endpoint("FISCAL_LEER", ListE11ConciliacionesResponse, async (tx, a, req) => {
  const query = e11Page.extend(dateRange).strict().parse(req.query);
  return page(await e11Periods(tx, query.desde, query.hastaExclusivo), a, req,
    { route: "periodos", desde: query.desde, hasta: query.hastaExclusivo });
}));
router.post("/e11/conciliaciones", endpoint("FISCAL_CONCILIAR", GetE11ConciliacionResponse, async (tx, a, req) =>
  e11CreateSnapshot(tx, a, CreateE11ConciliacionBody.strict().parse(req.body))));
router.get("/e11/conciliaciones/:id", endpoint("FISCAL_LEER", GetE11ConciliacionResponse, async (tx, _a, req) =>
  e11Snapshot(tx, e11Uuid.parse(req.params.id))));
router.get("/e11/conciliaciones/:id/ventas", endpoint("FISCAL_LEER", ListE11ConciliacionVentasResponse, async (tx, a, req) => {
  e11Page.strict().parse(req.query); const id = e11Uuid.parse(req.params.id);
  const sales = await e11SnapshotSales(tx, id);
  return { ...page(sales.items, a, req, { route: "snapshotVentas", id }, sales.fuenteRevision), totalFacturado: sales.totalFacturado };
}));
router.post("/e11/conciliaciones/:id/decisiones", endpoint("FISCAL_CONCILIAR", GetE11ConciliacionResponse, async (tx, a, req) =>
  e11DecideSnapshot(tx, a, e11Uuid.parse(req.params.id), DecideE11ConciliacionBody.strict().parse(req.body))));
router.get("/e11/a/preparaciones", endpoint("E5_PREPARAR", ListE11PreparacionesResponse, async (tx, a, req) => {
  const query = e11Page.extend({ clienteId: e11Id.optional() }).strict().parse(req.query);
  return page(await e11Preparations(tx, a, query.clienteId), a, req, { route: "preparaciones", clienteId: query.clienteId ?? null });
}));
router.get("/e11/a/preparaciones/:cobroId", endpoint("E5_PREPARAR", GetE11PreparacionResponse, async (tx, a, req) =>
  e11Preparation(tx, a, e11Uuid.parse(req.params.cobroId))));
router.post("/e11/a/preparaciones/:cobroId", endpoint("E5_PREPARAR", GetE11PreparacionResponse, async (tx, a, req) =>
  e11Prepare(tx, a, e11Uuid.parse(req.params.cobroId), PrepareE11AplicacionBody.strict().parse(req.body), getRequestIp(req))));
router.use("/e11", (req, res) => {
  res.status(404).json(e11ErrorBody(new E11Error("NO_ENCONTRADO", "Ruta E11 no encontrada.", 404)));
});
export function e11HttpError(error: unknown): E11Error {
  if (error instanceof E11Error) return error;
  if (error instanceof z.ZodError || (error instanceof Error && error.name === "ZodError"))
    return new E11Error("VALIDACION", "Entrada o contrato de respuesta inválido.", 400);
  if (error instanceof E5Error) {
    const codes: Record<string, string> = { E5_DISABLED: "E5_DISABLED", E5_FORBIDDEN: "PERFIL_DENEGADO",
      E5_NOT_FOUND: "NO_ENCONTRADO", E5_NOTA_STALE: "NOTA_SIN_SALDO",
      E5_VERSION_STALE: "REVISION_OBSOLETA", E5_IDEMPOTENCY_CONFLICT: "UUID_REUTILIZADO",
      E5_VALIDATION: "VALIDACION", E5_STATE_CONFLICT: "ESTADO_INVALIDO" };
    return new E11Error(codes[error.code] ?? "DEPENDENCIA_NO_DISPONIBLE", error.message, codes[error.code] ? error.status : 503);
  }
  const pg = error as { code?: string; cause?: { code?: string } };
  if (["40001", "40P01", "23505"].includes(pg?.code ?? pg?.cause?.code ?? ""))
    return new E11Error("REVISION_OBSOLETA", "Conflicto concurrente; recarga y confirma de nuevo.");
  return new E11Error("DEPENDENCIA_NO_DISPONIBLE", "No fue posible completar E11; no se usa un lector alternativo.", 503);
}
router.use("/e11", (error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  const failure = e11HttpError(error);
  if (!res.headersSent) res.status(failure.status).json(e11ErrorBody(failure));
});
export default router;