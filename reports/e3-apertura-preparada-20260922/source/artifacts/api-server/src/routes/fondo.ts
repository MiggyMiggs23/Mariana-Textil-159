import { Router, type IRouter, type RequestHandler } from "express";
import { z } from "zod";
import {
  FondoError,
  type FondoActor,
  type FondoPool,
  crearArqueoFondo,
  crearMovimientoFondo,
  invertirMovimientoFondo,
  listarArqueosFondo,
  obtenerArqueoFondo,
  obtenerMovimientoFondo,
  obtenerResumenEHistorialFondo,
} from "../lib/fondo";

const uuid = z.string().uuid().regex(/^[0-9a-f-]+$/);
const money = z.string().regex(/^(0|[1-9][0-9]*)\.[0-9]{2}$/);
const reason = z.string().trim().min(1).max(500);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const category = z.enum(["SALDO_INICIAL", "CAPITAL", "OTRO_INGRESO", "RETIRO"]);
const strictEmpty = z.object({}).strict();
const idParams = z.object({ id: uuid }).strict();
const range = z.object({ desde: date.optional(), hasta: date.optional() }).strict().superRefine((value, ctx) => {
  if (Boolean(value.desde) !== Boolean(value.hasta) || (value.desde && value.hasta && value.desde > value.hasta)) {
    ctx.addIssue({ code: "custom", message: "El rango de fechas es inválido." });
  }
});
const movementQuery = z.object({
  desde: date.optional(), hasta: date.optional(),
  naturaleza: z.enum(["INGRESO", "RETIRO"]).optional(), categoria: category.optional(),
}).strict().superRefine((value, ctx) => {
  if (Boolean(value.desde) !== Boolean(value.hasta) || (value.desde && value.hasta && value.desde > value.hasta)) {
    ctx.addIssue({ code: "custom", message: "El rango de fechas es inválido." });
  }
});
const movementInput = z.object({
  idempotencyKey: uuid,
  categoria: category,
  importe: money,
  motivo: reason,
  conciliacionInicial: z.object({
    efectivoFisicoContado: money,
    declaracionSinDuplicacion: z.literal(true),
    evidencia: z.string().trim().min(1).max(1000),
  }).strict().optional(),
}).strict().superRefine((value, ctx) => {
  if (value.categoria === "SALDO_INICIAL") {
    if (value.motivo !== "saldo inicial" || !value.conciliacionInicial) ctx.addIssue({ code: "custom", message: "Saldo inicial requiere conciliación y motivo exacto." });
  } else if (value.conciliacionInicial) ctx.addIssue({ code: "custom", message: "La conciliación sólo corresponde al saldo inicial." });
});
const inverseInput = z.object({ idempotencyKey: uuid, motivo: reason }).strict();
const auditInput = z.object({
  idempotencyKey: uuid, efectivoContado: money, expectedVersionSaldo: uuid.nullable(), motivo: reason,
}).strict();
const exportQuery = z.object({ tipo: z.enum(["movimientos", "arqueos"]) }).strict();

function actor(req: Parameters<RequestHandler>[0]): FondoActor {
  if (!req.auth || req.auth.user.rol !== "ADMIN") throw new FondoError(403, "FORBIDDEN", "No tienes permisos para esta operación.");
  return { id: req.auth.user.id, nombre: req.auth.user.nombre, rol: req.auth.user.rol, ip: req.ip ?? "unknown" };
}

export const enforceFondoAdmin: RequestHandler = (req, res, next) => {
  if (!req.auth || req.auth.user.rol !== "ADMIN") {
    res.status(403).json({ error: "No tienes permisos para esta operación." });
    return;
  }
  next();
};
function csvCell(value: unknown): string {
  const text = value == null ? "" : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}
export function neutralizeFondoCsvText(value: string): string {
  return /^[\u0000-\u0020]*[=+\-@]/.test(value) ? `'${value}` : value;
}
function csv(rows: unknown[][]): string { return `\uFEFF${rows.map((row) => row.map(csvCell).join(",")).join("\r\n")}\r\n`; }

export function createFondoRouter(options: { db: FondoPool; authorizeAdmin: RequestHandler[]; enabled?: () => boolean }): IRouter {
  const router: IRouter = Router();
  const enabled = options.enabled ?? (() => process.env.FONDO_E10_ENABLED === "true");
  if (options.authorizeAdmin.length > 0) {
    router.use("/fondo", ...options.authorizeAdmin);
  }
  router.use("/fondo", enforceFondoAdmin);
  router.use("/fondo", (_req, res, next) => {
    if (!enabled()) { res.status(404).json({ error: "Fondo no está habilitado.", code: "FONDO_DISABLED" }); return; }
    next();
  });
  const handle = (handler: RequestHandler): RequestHandler => async (req, res, next) => {
    try { await handler(req, res, next); }
    catch (error) {
      if (error instanceof FondoError) { res.status(error.status).json({ error: error.message, code: error.code }); return; }
      next(error);
    }
  };

  router.get("/fondo", handle(async (req, res) => {
    strictEmpty.parse(req.body ?? {});
    strictEmpty.parse(req.query);
    res.json((await obtenerResumenEHistorialFondo(options.db)).summary);
  }));
  router.get("/fondo/movimientos", handle(async (req, res) => {
    strictEmpty.parse(req.body ?? {});
    const query = movementQuery.parse(req.query);
    res.json((await obtenerResumenEHistorialFondo(options.db, query)).movimientos);
  }));
  router.get("/fondo/movimientos/:id", handle(async (req, res) => {
    strictEmpty.parse(req.body ?? {});
    strictEmpty.parse(req.query);
    const { id } = idParams.parse(req.params);
    res.json(await obtenerMovimientoFondo(options.db, id));
  }));
  router.post("/fondo/movimientos", handle(async (req, res) => {
    strictEmpty.parse(req.query);
    const result = await crearMovimientoFondo(options.db, actor(req), movementInput.parse(req.body));
    if (result.replay) res.setHeader("Idempotent-Replay", "true");
    res.status(result.replay ? 200 : 201).json(result.value);
  }));
  router.post("/fondo/movimientos/:id/inverso", handle(async (req, res) => {
    strictEmpty.parse(req.query);
    const { id } = idParams.parse(req.params);
    const result = await invertirMovimientoFondo(options.db, actor(req), id, inverseInput.parse(req.body));
    if (result.replay) res.setHeader("Idempotent-Replay", "true");
    res.status(result.replay ? 200 : 201).json(result.value);
  }));
  router.get("/fondo/arqueos", handle(async (req, res) => {
    strictEmpty.parse(req.body ?? {});
    res.json(await listarArqueosFondo(options.db, range.parse(req.query)));
  }));
  router.get("/fondo/arqueos/:id", handle(async (req, res) => {
    strictEmpty.parse(req.body ?? {});
    strictEmpty.parse(req.query);
    const { id } = idParams.parse(req.params);
    res.json(await obtenerArqueoFondo(options.db, id));
  }));
  router.post("/fondo/arqueos", handle(async (req, res) => {
    strictEmpty.parse(req.query);
    const result = await crearArqueoFondo(options.db, actor(req), auditInput.parse(req.body));
    if (result.replay) res.setHeader("Idempotent-Replay", "true");
    res.status(result.replay ? 200 : 201).json(result.value);
  }));
  router.get("/fondo/exportar", handle(async (req, res) => {
    strictEmpty.parse(req.body ?? {});
    const { tipo } = exportQuery.parse(req.query);
    if (tipo === "movimientos") {
      const data = (await obtenerResumenEHistorialFondo(options.db)).movimientos.items;
      res.type("text/csv; charset=utf-8");
      res.attachment("fondo-mariana-movimientos.csv");
      res.send(csv([
        ["id", "ordinal", "naturaleza", "categoria", "importe", "importeFirmado", "motivo", "fecha", "autorId", "autor", "esInverso", "advertencia", "efectivoFisicoContado", "declaracionSinDuplicacion", "evidenciaConciliacion", "originalId", "inversoId"],
        ...data.map((item) => [item.id, item.ordinal, item.naturaleza, item.categoria, item.importe, item.importeFirmado, neutralizeFondoCsvText(item.motivo), item.fecha, item.autor.id, neutralizeFondoCsvText(item.autor.nombre), item.esInverso, item.advertencia, item.conciliacionInicial?.efectivoFisicoContado, item.conciliacionInicial?.declaracionSinDuplicacion, item.conciliacionInicial ? neutralizeFondoCsvText(item.conciliacionInicial.evidencia) : null, item.originalId, item.inversoId]),
      ]));
    } else {
      const data = (await listarArqueosFondo(options.db)).items;
      res.type("text/csv; charset=utf-8");
      res.attachment("fondo-mariana-arqueos.csv");
      res.send(csv([
        ["id", "saldoSistema", "efectivoContado", "diferencia", "versionSaldo", "motivo", "fecha", "autorId", "autor"],
        ...data.map((item) => [item.id, item.saldoSistema, item.efectivoContado, item.diferencia, item.versionSaldo, neutralizeFondoCsvText(item.motivo), item.fecha, item.autor.id, neutralizeFondoCsvText(item.autor.nombre)]),
      ]));
    }
  }));
  return router;
}