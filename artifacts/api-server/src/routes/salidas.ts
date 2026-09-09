import { Router } from "express";
import { z } from "zod";
import ExcelJS from "exceljs";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import {
  AgregarRolloBorradorSalidaBody,
  AgregarRolloBorradorSalidaResponse,
  CancelarSalidaBody,
  CancelarSalidaParams,
  CancelarSalidaResponse,
  CrearSalidaMostradorBody,
  CrearSalidaMostradorResponse,
  EnviarSalidaBody,
  EnviarSalidaParams,
  EnviarSalidaResponse,
  ExportarSalidasQueryParams,
  GetBorradorSalidaQueryParams,
  GetBorradorSalidaResponse,
  GetDocumentoSalidaParams,
  GetDocumentoSalidaResponse,
  GetSalidaParams,
  GetSalidaRecepcionParams,
  GetSalidaRecepcionResponse,
  GetUbicacionesSalidaResponse,
  ListSalidasRecepcionResponse,
  ListSalidasQueryParams,
  QuitarRolloBorradorSalidaParams,
  QuitarRolloBorradorSalidaResponse,
  RecibirSalidaBody,
  RecibirSalidaParams,
  RecibirSalidaResponse,
  CrearEnviarSalidaVentaClienteBody,
  CrearEnviarSalidaVentaClienteResponse,
  ListSalidasVentaPendientesPorClienteResponse,
  GenerarVentaDesdeSalidasBody,
  GenerarVentaDesdeSalidasResponse,
  EntregarSalidaVentaClienteParams,
  EntregarSalidaVentaClienteBody,
  EntregarSalidaVentaClienteResponse,
  VerificarAutorizacionVentaSalidasResponse,
} from "@workspace/api-zod";
import { db, salidasTable, ubicacionesTable, usuariosTable, viajeSalidasTable, salidaRollosTable, rollosTable, productosTable, clientesTable, ticketsTable, ticketLineasTable, type EstadoSalida } from "@workspace/db";
import { requireSession, type AuthContext } from "../middlewares/auth";
import { requierePermiso, resolvePermiso } from "../lib/permisos";
import { InventarioError } from "../lib/inventario";
import { canDeliverVenta, canReadLinkedVentaTrace } from "../lib/venta-trace-access";
import {
  agregarRolloBorradorSalida,
  buildSalidaDetail,
  cancelarSalida,
  cancelarSalidaODocumentoLigado,
  crearSalidaMostrador,
  enviarSalida,
  listarSalidas,
  obtenerBorradorSalida,
  quitarRolloBorradorSalida,
  recibirSalida,
  crearEnviarSalidaVentaCliente,
  entregarSalidaVenta,
  prepararVentaDesdeSalidas,
  validarORecuperarGeneracionVenta,
} from "../lib/salidas";
import { buildTicketDetail, cancelarTicket, crearTicket, PosError } from "../lib/pos";
import { normalizeUsername } from "../lib/auth-identifiers";
import {
  EXCEL_NUMBER_FORMAT,
  toExcelNumber,
} from "@workspace/number-format";
import { interpretarCodigoEscaneado } from "@workspace/scanned-code";

const router = Router();
const SerieEntregaInvalidaErrorSchema = z.object({
  error: z.string(),
  code: z.literal("SERIE_ENTREGA_INVALIDA"),
  details: z.array(z.object({
    serieEscaneada: z.string(),
    razon: z.enum(["FALTANTE", "DUPLICADA", "NO_RESERVADA", "PERTENECE_A_OTRA_SALIDA"]),
    clienteId: z.number().nullable().optional(),
    nombreCliente: z.string().nullable().optional(),
    rolloId: z.number().nullable().optional(),
    productoId: z.number().nullable().optional(),
    ubicacionId: z.number().nullable().optional(),
    salida: z.object({ id: z.number(), folioFormateado: z.string(), origenId: z.number(), nombreOrigen: z.string(), href: z.string() }).nullable(),
    documentoVenta: z.object({ id: z.number(), folio: z.number(), documentoTipo: z.enum(["TICKET", "NOTA"]), href: z.string() }).nullable(),
  })).min(1),
});

const ESTADOS: EstadoSalida[] = [
  "ARMANDO",
  "EN_TRANSITO",
  "RECIBIDA",
  "ENTREGADA",
  "CANCELADA",
];

router.post("/salidas/venta-cliente", requireSession, requierePermiso("salidas", "crear"), async (req, res, next) => {
  try {
    const body = CrearEnviarSalidaVentaClienteBody.parse(req.body);
    if (req.auth!.user.rol !== "ADMIN" && req.auth!.user.ubicacionId !== body.origenId) throw new InventarioError("No puedes operar desde ese origen.", "SALIDA_LOCATION_FORBIDDEN");
    const result = await db.transaction(tx => crearEnviarSalidaVentaCliente(tx, { ...body, usuarioId: req.auth!.user.id, series: body.series }));
    res.status(201).json(CrearEnviarSalidaVentaClienteResponse.parse(result));
  } catch (e) { if (!sendError(e, res)) next(e); }
});

router.get("/salidas/venta-cliente/pendientes", requireSession, requierePermiso("salidas_venta", "ver"), async (_req, res, next) => {
  try {
    const rows = await db.select({ clienteId: salidasTable.clienteId, nombreCliente: clientesTable.nombre, id: salidasTable.id, folio: salidasTable.folio, origenId: salidasTable.origenId, nombreOrigen: ubicacionesTable.nombre, createdAt: salidasTable.createdAt, salidaRolloId: salidaRollosTable.id, rolloId: rollosTable.id, serie: rollosTable.serie, productoId: productosTable.id, sku: productosTable.sku, tela: productosTable.tela, color: productosTable.color, unidad: productosTable.unidad, cantidad: salidaRollosTable.cantidadEnviada, precioSugerido: productosTable.precioSugerido })
      .from(salidasTable).innerJoin(clientesTable, eq(salidasTable.clienteId, clientesTable.id)).innerJoin(ubicacionesTable, eq(salidasTable.origenId, ubicacionesTable.id)).innerJoin(salidaRollosTable, eq(salidaRollosTable.salidaId, salidasTable.id)).innerJoin(rollosTable, eq(salidaRollosTable.rolloId, rollosTable.id)).innerJoin(productosTable, eq(rollosTable.productoId, productosTable.id))
      .where(and(eq(salidasTable.modalidad, "VENTA_CLIENTE"), eq(salidasTable.estado, "EN_TRANSITO"))).orderBy(asc(salidasTable.id), asc(salidaRollosTable.id));
    const groups = new Map<number, any>();
    for (const r of rows) {
      let g = groups.get(r.clienteId!); if (!g) { g = { clienteId: r.clienteId, nombreCliente: r.nombreCliente, salidas: [] }; groups.set(r.clienteId!, g); }
      let s = g.salidas.find((x: any) => x.id === r.id); if (!s) { s = { id: r.id, folio: r.folio, folioFormateado: `${r.nombreOrigen}-${String(r.folio).padStart(6, "0")}`, origenId: r.origenId, nombreOrigen: r.nombreOrigen, seleccionada: true, createdAt: r.createdAt, lineas: [] }; g.salidas.push(s); }
      s.lineas.push({ salidaRolloId: r.salidaRolloId, rolloId: r.rolloId, serie: r.serie, productoId: r.productoId, sku: r.sku, tela: r.tela, color: r.color, unidad: r.unidad, cantidad: r.cantidad, precioSugerido: r.precioSugerido });
    }
    res.json(ListSalidasVentaPendientesPorClienteResponse.parse([...groups.values()]));
  } catch (e) { if (!sendError(e, res)) next(e); }
});

router.post("/salidas/venta-cliente/generar-venta", requireSession, requierePermiso("salidas_venta", "crear"), async (req, res, next) => {
  try {
    const requestedLocationId =
      req.body !== null && typeof req.body === "object"
        ? (req.body as Record<string, unknown>).ubicacionId
        : undefined;
    if (!Number.isInteger(requestedLocationId) || Number(requestedLocationId) <= 0) {
      throw new PosError(
        "Selecciona la tienda activa desde la que se emitirá la venta.",
        "SALE_LOCATION_REQUIRED",
      );
    }
    const body = GenerarVentaDesdeSalidasBody.parse(req.body);
    if (!canOperate(req.auth!, body.ubicacionId)) {
      throw new InventarioError(
        "No tienes permiso para emitir ventas desde la tienda seleccionada.",
        "SALE_LOCATION_FORBIDDEN",
      );
    }
    const [saleLocation] = await db
      .select({
        id: ubicacionesTable.id,
        activa: ubicacionesTable.activa,
        tipo: ubicacionesTable.tipo,
      })
      .from(ubicacionesTable)
      .where(eq(ubicacionesTable.id, body.ubicacionId))
      .limit(1);
    if (!saleLocation || !saleLocation.activa || saleLocation.tipo !== "TIENDA") {
      throw new PosError(
        "La tienda seleccionada no está activa o no es una tienda operativa. Selecciona otra tienda.",
        "INVALID_LOCATION",
      );
    }
    const result = await db.transaction(async tx => {
      const existingTicketId = await validarORecuperarGeneracionVenta(tx, {
        uuidCliente: body.uuidCliente,
        salidaIds: body.salidaIds,
        clienteId: body.clienteId,
        documentoTipo: body.documentoTipo,
        diasPlazo: body.documentoTipo === "NOTA" ? body.diasPlazo : null,
        precios: body.precios,
      });
      if (existingTicketId != null) return buildTicketDetail(tx, existingTicketId, true);
      const lockedLines = await prepararVentaDesdeSalidas(tx, { salidaIds: body.salidaIds, clienteId: body.clienteId });
      const price = new Map(body.precios.map(p => [p.salidaRolloId, String(p.precioUnitario)]));
      const selectedRolloIds = new Set(lockedLines.map((line) => line.salidaRolloId));
      if (price.size !== body.precios.length || price.size !== selectedRolloIds.size || [...price.keys()].some(id => !selectedRolloIds.has(id))) {
        throw new InventarioError("Debe enviarse exactamente un precio por cada rollo seleccionado, sin extras.", "INVALID_PRICE_SET");
      }
      const ticket = await crearTicket(tx, {
        ubicacionId: body.ubicacionId,
        usuarioTerminalId: req.auth!.user.id,
        clienteId: body.clienteId,
        documentoTipo: body.documentoTipo,
        facturado: false,
        diasPlazo: body.documentoTipo === "NOTA" ? body.diasPlazo : null,
        uuidCliente: body.uuidCliente,
        deferInventory: true,
        owningSalidaIds: body.salidaIds,
        lineas: lockedLines.map((l: any) => ({
          rolloId: l.rolloId, productoId: l.productoId, ubicacionId: l.origenId, tipo: "NORMAL",
          cantidad: l.cantidad,
          precioUnitario: price.get(l.salidaRolloId) ?? String(l.precio ?? "0"),
        })),
        ip: req.ip ?? "desconocida",
      }, true);
      await tx.update(salidasTable).set({ ticketId: ticket!.id, estado: "RECIBIDA", recibidaAt: new Date(), usuarioRecibeId: req.auth!.user.id, actividadAt: new Date() }).where(inArray(salidasTable.id, body.salidaIds));
      return buildTicketDetail(tx, ticket!.id, true);
    });
    res.status(201).json(GenerarVentaDesdeSalidasResponse.parse(result));
  } catch (e) { if (!sendError(e, res)) next(e); }
});

router.get(
  "/salidas/ubicaciones",
  requireSession,
  requierePermiso("salidas", "ver"),
  async (_req, res, next) => {
    try {
      const ubicaciones = await db
        .select({
          id: ubicacionesTable.id,
          nombre: ubicacionesTable.nombre,
          tipo: ubicacionesTable.tipo,
          activa: ubicacionesTable.activa,
        })
        .from(ubicacionesTable)
        .where(
          and(
            eq(ubicacionesTable.activa, true),
            inArray(ubicacionesTable.tipo, ["TIENDA", "BODEGA"]),
          ),
        )
        .orderBy(asc(ubicacionesTable.nombre));
      res.json(GetUbicacionesSalidaResponse.parse(ubicaciones));
    } catch (error) {
      next(error);
    }
  },
);

router.get("/salidas/venta-cliente/verificar-autorizacion", requireSession, async (req, res, next) => {
  try {
    const folio = Number(req.query.folio);
    const [row] = await db.select({ id: salidasTable.id, folio: ticketsTable.folio, origenId: salidasTable.origenId, ticketId: salidasTable.ticketId, ticketEstado: ticketsTable.estado, documentoTipo: ticketsTable.documentoTipo, cobrado: ticketsTable.cobrado, autorizacionEstado: ticketsTable.autorizacionEstado, autorizadoAt: ticketsTable.autorizadoAt })
      .from(salidasTable).innerJoin(ticketsTable, eq(salidasTable.ticketId, ticketsTable.id)).where(eq(ticketsTable.folio, folio)).limit(1);
    if (!row || row.ticketId == null) throw new InventarioError("Salida o documento de venta no encontrado.", "SALIDA_NOT_FOUND");
    const autorizada = row.ticketEstado === "VENDIDO" && (row.documentoTipo === "TICKET" ? row.cobrado : row.autorizacionEstado === "AUTORIZADA");
    const estado = row.ticketEstado === "CANCELADO" ? "CANCELADA" : autorizada ? "AUTORIZADA" : row.documentoTipo === "TICKET" ? "PENDIENTE_COBRO" : "PENDIENTE_AUTORIZACION";
    const linked = await db.select({ id: salidasTable.id, folio: salidasTable.folio, origenId: salidasTable.origenId, nombreOrigen: ubicacionesTable.nombre, iniciales: ubicacionesTable.iniciales }).from(salidasTable).innerJoin(ubicacionesTable, eq(salidasTable.origenId, ubicacionesTable.id)).where(eq(salidasTable.ticketId, row.ticketId));
    const auth = req.auth!;
    const [ventaPermiso, salidaPermiso] = await Promise.all([
      resolvePermiso(auth.user.id, auth.user.rol, "salidas_venta"),
      resolvePermiso(auth.user.id, auth.user.rol, "salidas"),
    ]);
    const allowed = canReadLinkedVentaTrace({
      rol: auth.user.rol, ubicacionId: auth.user.ubicacionId,
      puedeVerSalidas: salidaPermiso?.puedeVer === true,
      puedeVerSalidasVenta: ventaPermiso?.puedeVer === true,
      linkedOrigins: linked.map(s => s.origenId),
    });
    if (!allowed) throw new InventarioError("No tienes permiso para verificar este documento.", "SALIDA_LOCATION_FORBIDDEN");
    res.json(VerificarAutorizacionVentaSalidasResponse.parse({ ticketId: row.ticketId, folio: row.folio, folioFormateado: `${row.documentoTipo}-${String(row.folio).padStart(6, "0")}`, documentoTipo: row.documentoTipo, autorizada, estado, autorizadoAt: row.autorizadoAt, documentoHref: `/tickets/${row.ticketId}`, salidas: linked.map(s => ({ id: s.id, folioFormateado: `${s.iniciales}-${String(s.folio).padStart(6, "0")}`, origenId: s.origenId, nombreOrigen: s.nombreOrigen, href: `/salidas/${s.id}` })) }));
  } catch (e) { if (!sendError(e, res)) next(e); }
});

router.post("/salidas/:id/entregar", requireSession, async (req, res, next) => {
  try {
    const { id } = EntregarSalidaVentaClienteParams.parse(req.params);
    const body = EntregarSalidaVentaClienteBody.parse(req.body);
    const header = await loadHeader(id);
    if (!header || header.modalidad !== "VENTA_CLIENTE") throw new InventarioError("Salida no encontrada.", "SALIDA_NOT_FOUND");
    const auth = req.auth!;
    const permiso = await resolvePermiso(auth.user.id, auth.user.rol, "salidas");
    if (!canDeliverVenta({
      rol: auth.user.rol, assignedLocationId: auth.user.ubicacionId,
      originId: header.origenId, puedeVerSalidas: permiso?.puedeVer === true,
      puedeEditarSalidas: permiso?.puedeEditar === true,
    })) throw new InventarioError("Solo el origen autorizado puede entregar esta salida.", "SALIDA_LOCATION_FORBIDDEN");
    const result = await db.transaction(tx => entregarSalidaVenta(tx, id, req.auth!.user.id, body.series, body.nota));
    res.json(EntregarSalidaVentaClienteResponse.parse(result));
  } catch (e) { if (!sendError(e, res)) next(e); }
});

async function loadHeader(id: number) {
  const [salida] = await db
    .select()
    .from(salidasTable)
    .where(eq(salidasTable.id, id))
    .limit(1);
  return salida ?? null;
}

function canRead(auth: AuthContext, origenId: number, destinoId: number | null): boolean {
  if (auth.user.rol === "CAJA") {
    return auth.user.ubicacionId != null && auth.user.ubicacionId === destinoId;
  }
  if (
    auth.user.rol === "ADMIN" ||
    auth.user.rol === "SUPERVISOR" ||
    auth.user.alcanceConsulta === "TODAS"
  ) return true;
  return auth.user.ubicacionId === origenId || auth.user.ubicacionId === destinoId;
}

function rejectCajaMutation(auth: AuthContext): boolean {
  return auth.user.rol === "CAJA";
}

function canOperate(auth: AuthContext, ubicacionId: number): boolean {
  return (
    auth.user.rol === "ADMIN" ||
    auth.user.rol === "SUPERVISOR" ||
    auth.user.ubicacionId === ubicacionId
  );
}

function canReceiveAtDestination(auth: AuthContext, destinoId: number): boolean {
  return (
    (auth.user.rol === "ADMIN" && auth.user.alcanceConsulta === "TODAS") ||
    (auth.user.ubicacionId != null && auth.user.ubicacionId === destinoId)
  );
}

function requireReceivingSite(auth: AuthContext, destinoId: number): void {
  if (canReceiveAtDestination(auth, destinoId)) return;
  throw new InventarioError(
    auth.user.ubicacionId == null
      ? "No tienes una ubicación asignada para recibir salidas."
      : "Esta salida está destinada a otra ubicación y no puedes recibirla.",
    "SALIDA_LOCATION_FORBIDDEN",
  );
}

async function requireSalidaAccess(
  auth: AuthContext,
  id: number,
  stage: "read" | "origin" | "destination" | "either",
) {
  const salida = await loadHeader(id);
  if (!salida) throw new InventarioError("Salida no encontrada.", "SALIDA_NOT_FOUND");
  const allowed =
    stage === "read"
      ? canRead(auth, salida.origenId, salida.destinoId)
      : stage === "origin"
        ? canOperate(auth, salida.origenId)
        : stage === "destination"
          ? salida.destinoId != null && canOperate(auth, salida.destinoId)
           : auth.user.rol === "ADMIN" ||
             auth.user.rol === "SUPERVISOR" ||
            auth.user.ubicacionId === salida.origenId ||
            auth.user.ubicacionId === salida.destinoId;
  if (!allowed) {
    throw new InventarioError(
      "No tienes permiso para operar esta salida desde tu ubicación.",
      "SALIDA_LOCATION_FORBIDDEN",
    );
  }
  return salida;
}

function errorStatus(error: InventarioError): number {
  if (error.code === "SALIDA_NOT_FOUND") return 404;
  if (["SALIDA_LOCATION_FORBIDDEN", "SALE_LOCATION_FORBIDDEN"].includes(error.code)) return 403;
  if (
    [
      "INVALID_SALIDA_STATE",
      "SALIDA_SELECTION_CHANGED",
      "ROLLO_UNAVAILABLE",
      "ROLLO_RESERVED",
      "ROLLO_NOT_PENDING",
      "ROLLO_BLOQUEADO",
      "PENDING_ROLLOS",
      "DRAFT_DESTINATION_MISMATCH",
      "DRAFT_ROLL_CHANGED",
      "SALIDA_HAS_MOVEMENTS",
      "UUID_CONFLICT",
    ].includes(error.code)
  ) {
    return 409;
  }
  if (error.code === "SALIDA_DRAFT_OWNER_REQUIRED") return 403;
  return 400;
}

function sendError(error: unknown, res: Parameters<Parameters<typeof router.get>[1]>[1]): boolean {
  if (error instanceof PosError) {
    res.status(error.status).json({ error: error.message, code: error.code });
    return true;
  }
  if (error instanceof InventarioError) {
    const payload = { error: error.message, code: error.code, ...(error.details === undefined ? {} : { details: error.details }) };
    res.status(errorStatus(error)).json(error.code === "SERIE_ENTREGA_INVALIDA" ? SerieEntregaInvalidaErrorSchema.parse(payload) : payload);
    return true;
  }
  if (error instanceof z.ZodError) {
    res.status(400).json({
      error: "Los datos de la operación no son válidos. Revisa cliente, salidas, precios, tipo de documento y plazo.",
      code: "INVALID_REQUEST",
    });
    return true;
  }
  return false;
}

router.get(
  "/salidas",
  requireSession,
  requierePermiso("salidas", "ver"),
  async (req, res, next) => {
    try {
      const raw = req.query;
      const query = ListSalidasQueryParams.parse({
        ...raw,
        fechaDesde:
          typeof raw.fechaDesde === "string" ? new Date(raw.fechaDesde) : undefined,
        fechaHasta:
          typeof raw.fechaHasta === "string" ? new Date(raw.fechaHasta) : undefined,
      });
      const estados = query.estados
        ? query.estados.split(",").filter((value): value is EstadoSalida =>
            ESTADOS.includes(value as EstadoSalida),
          )
        : undefined;
      if (query.estados && estados?.length !== query.estados.split(",").length) {
        res.status(400).json({ error: "Uno de los estados solicitados no es válido." });
        return;
      }
      const auth = req.auth!;
      if (
        auth.user.rol !== "ADMIN" &&
        auth.user.rol !== "SUPERVISOR" &&
        auth.user.ubicacionId == null
      ) {
        res.status(403).json({ error: "No tienes una ubicación asignada." });
        return;
      }
      const visibleUbicacionId =
        auth.user.rol === "ADMIN" ||
        auth.user.rol === "SUPERVISOR" ||
        auth.user.alcanceConsulta === "TODAS"
          ? undefined
          : auth.user.ubicacionId;
      if (visibleUbicacionId === null) {
        res.status(403).json({ error: "No tienes una ubicación asignada." });
        return;
      }
      if (visibleUbicacionId === null) {
        res.status(403).json({ error: "No tienes una ubicación asignada." });
        return;
      }
      const result = await listarSalidas({
        estados,
        folio: query.folio,
        origenId: query.origenId,
        destinoId:
          auth.user.rol === "CAJA"
            ? auth.user.ubicacionId!
            : query.destinoId,
        productoId: query.productoId,
          usuarioId: query.usuarioId,
          search: query.search,
        fechaDesde: query.fechaDesde,
        fechaHasta: query.fechaHasta,
        page: Math.max(1, query.page ?? 1),
        pageSize: Math.min(100, Math.max(1, query.pageSize ?? 100)),
        visibleUbicacionId,
      });
      res.json(result);
    } catch (error) {
      if (!sendError(error, res)) next(error);
    }
  },
);

router.get(
  "/salidas/borrador",
  requireSession,
  requierePermiso("salidas", "crear"),
  async (req, res, next) => {
    try {
      const { origenId } = GetBorradorSalidaQueryParams.parse(req.query);
      const auth = req.auth!;
      if (rejectCajaMutation(auth)) {
        res.status(403).json({ error: "El rol CAJA no puede armar salidas." });
        return;
      }
      if (!canOperate(auth, origenId)) {
        throw new InventarioError(
          "No puedes operar desde ese origen.",
          "SALIDA_LOCATION_FORBIDDEN",
        );
      }
      const salida = await obtenerBorradorSalida(
        db,
        auth.user.id,
        origenId,
      );
      res.json(GetBorradorSalidaResponse.parse({ salida }));
    } catch (error) {
      if (!sendError(error, res)) next(error);
    }
  },
);

router.post(
  "/salidas/mostrador",
  requireSession,
  requierePermiso("salidas", "crear"),
  async (req, res, next) => {
    try {
      const body = CrearSalidaMostradorBody.parse(req.body);
      const auth = req.auth!;
      if (auth.user.rol === "CAJA") {
        res.status(403).json({ error: "El rol CAJA no puede crear salidas a mostrador." });
        return;
      }
      const canUseOrigin =
        auth.user.rol === "ADMIN" ||
        (auth.user.ubicacionId != null && auth.user.ubicacionId === body.origenId);
      if (!canUseOrigin) {
        throw new InventarioError(
          auth.user.ubicacionId == null
            ? "No tienes una ubicación asignada."
            : "No puedes operar desde ese origen.",
          "SALIDA_LOCATION_FORBIDDEN",
        );
      }
      const series = body.series.map((raw) => {
        const code = interpretarCodigoEscaneado(raw);
        return (code.serie ?? code.textoOriginal.trim()).toUpperCase();
      });
      const detail = await db.transaction((tx) =>
        crearSalidaMostrador(tx, {
          ...body,
          series,
          usuarioId: auth.user.id,
          ip: req.ip || req.socket.remoteAddress || "desconocida",
        }),
      );
      res.status(201).json(CrearSalidaMostradorResponse.parse(detail));
    } catch (error) {
      if (!sendError(error, res)) next(error);
    }
  },
);

router.post(
  "/salidas/borrador/rollos",
  requireSession,
  requierePermiso("salidas", "crear"),
  async (req, res, next) => {
    try {
      const body = AgregarRolloBorradorSalidaBody.parse(req.body);
      const auth = req.auth!;
      if (rejectCajaMutation(auth)) {
        res.status(403).json({ error: "El rol CAJA no puede armar salidas." });
        return;
      }
      if (!canOperate(auth, body.origenId)) {
        throw new InventarioError(
          "No puedes operar desde ese origen.",
          "SALIDA_LOCATION_FORBIDDEN",
        );
      }
      const codigo = interpretarCodigoEscaneado(body.serie);
      const serie = codigo.serie ?? codigo.textoOriginal.trim();
      const detail = await db.transaction((tx) =>
        agregarRolloBorradorSalida(tx, {
          ...body,
          serie,
          usuarioId: auth.user.id,
        }),
      );
      res.json(AgregarRolloBorradorSalidaResponse.parse(detail));
    } catch (error) {
      if (!sendError(error, res)) next(error);
    }
  },
);

router.get(
  "/salidas/exportar",
  requireSession,
  requierePermiso("salidas", "ver"),
  async (req, res, next) => {
    try {
      const raw = req.query;
      const query = ExportarSalidasQueryParams.parse({
        ...raw,
        fechaDesde: typeof raw.fechaDesde === "string" ? new Date(raw.fechaDesde) : undefined,
        fechaHasta: typeof raw.fechaHasta === "string" ? new Date(raw.fechaHasta) : undefined,
      });
      const auth = req.auth!;
      const visibleUbicacionId =
        auth.user.rol === "ADMIN" ||
        auth.user.rol === "SUPERVISOR" ||
        auth.user.alcanceConsulta === "TODAS"
        ? undefined : auth.user.ubicacionId;
      if (
        visibleUbicacionId == null &&
        auth.user.rol !== "ADMIN" &&
        auth.user.rol !== "SUPERVISOR"
      ) throw new InventarioError("No tienes una ubicación asignada.", "SALIDA_LOCATION_FORBIDDEN");
      const estados = query.estado ? [query.estado] : undefined;
      const result = await listarSalidas({
        estados, origenId: query.origenId,
        destinoId: auth.user.rol === "CAJA" ? auth.user.ubicacionId! : query.destinoId,
        productoId: query.productoId, usuarioId: query.usuarioId, search: query.search,
        fechaDesde: query.fechaDesde, fechaHasta: query.fechaHasta, page: 1, pageSize: 100,
        visibleUbicacionId,
      });
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet("Salidas");
      sheet.columns = [
        { header: "Folio", key: "folio", width: 12 }, { header: "Estado", key: "estado", width: 14 },
        { header: "Origen", key: "origen", width: 24 }, { header: "Destino", key: "destino", width: 24 },
        { header: "Usuario", key: "usuario", width: 24 }, { header: "Rollos", key: "rollos", width: 10 },
        { header: "Metros", key: "metros", width: 14 }, { header: "Kilos", key: "kilos", width: 14 },
        { header: "Transportista", key: "transportista", width: 24 }, { header: "Observaciones", key: "observaciones", width: 35 },
      ];
      for (const item of result.items) sheet.addRow({
        folio: item.folioFormateado, estado: item.estado, origen: item.nombreOrigen, destino: item.nombreDestino,
        usuario: item.nombreUsuario, rollos: toExcelNumber(item.totalRollos), metros: toExcelNumber(item.totalMetros), kilos: toExcelNumber(item.totalKilos), bolsas: toExcelNumber(item.totalBolsas), piezas: toExcelNumber(item.totalPiezas),
        transportista: item.transportista, observaciones: item.observaciones,
      });
      sheet.getColumn("rollos").numFmt = EXCEL_NUMBER_FORMAT.count;
      sheet.getColumn("metros").numFmt = EXCEL_NUMBER_FORMAT.quantity;
      sheet.getColumn("kilos").numFmt = EXCEL_NUMBER_FORMAT.quantity;
      sheet.getRow(1).font = { bold: true };
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", "attachment; filename=salidas.xlsx");
      res.send(Buffer.from(await workbook.xlsx.writeBuffer()));
    } catch (error) { if (!sendError(error, res)) next(error); }
  },
);

router.get(
  "/salidas/recepcion",
  requireSession,
  async (req, res, next) => {
    try {
      const auth = req.auth!;
      const canReceiveAll =
        auth.user.rol === "ADMIN" && auth.user.alcanceConsulta === "TODAS";
      if (!canReceiveAll && auth.user.ubicacionId == null) {
        throw new InventarioError(
          "No tienes una ubicación asignada para recibir salidas.",
          "SALIDA_LOCATION_FORBIDDEN",
        );
      }
      const result = await listarSalidas({
        estados: ["EN_TRANSITO"],
        destinoId: canReceiveAll ? undefined : auth.user.ubicacionId!,
        page: 1,
        pageSize: 100,
      });
      res.json(ListSalidasRecepcionResponse.parse(result.items));
    } catch (error) {
      if (!sendError(error, res)) next(error);
    }
  },
);

router.get(
  "/salidas/recepcion/:id",
  requireSession,
  async (req, res, next) => {
    try {
      const { id } = GetSalidaRecepcionParams.parse(req.params);
      const [header] = await db
        .select()
        .from(salidasTable)
        .where(eq(salidasTable.id, id))
        .limit(1);
      if (!header) {
        throw new InventarioError("Salida no encontrada.", "SALIDA_NOT_FOUND");
      }
      if (header.destinoId == null) {
        throw new InventarioError("La salida no tiene un destino de recepción.", "INVALID_SALIDA_STATE");
      }
      requireReceivingSite(req.auth!, header.destinoId);
      if (header.estado !== "EN_TRANSITO") {
        throw new InventarioError(
          header.estado === "RECIBIDA"
            ? "Esta salida ya fue recibida."
            : `Solo se pueden recibir salidas EN_TRANSITO; esta salida está ${header.estado}.`,
          "INVALID_SALIDA_STATE",
        );
      }
      const detail = await buildSalidaDetail(db, header.id);
      res.json(GetSalidaRecepcionResponse.parse(detail));
    } catch (error) {
      if (!sendError(error, res)) next(error);
    }
  },
);

router.get(
  "/salidas/:id",
  requireSession,
  async (req, res, next) => {
    try {
      const { id } = GetSalidaParams.parse(req.params);
      const header = await loadHeader(id);
      if (!header) throw new InventarioError("Salida no encontrada.", "SALIDA_NOT_FOUND");
      const auth = req.auth!;
      const [salidaPermiso, ventaPermiso] = await Promise.all([
        resolvePermiso(auth.user.id, auth.user.rol, "salidas"),
        resolvePermiso(auth.user.id, auth.user.rol, "salidas_venta"),
      ]);
      const relationRead = header.modalidad === "VENTA_CLIENTE" && ventaPermiso?.puedeVer === true;
      if (!relationRead) {
        if (salidaPermiso?.puedeVer !== true) throw new InventarioError("No tienes permiso para consultar esta salida.", "SALIDA_LOCATION_FORBIDDEN");
        await requireSalidaAccess(auth, id, "read");
      }
      const detail = await buildSalidaDetail(db, id);
      res.json(detail);
    } catch (error) {
      if (!sendError(error, res)) next(error);
    }
  },
);

router.get(
  "/salidas/:id/documento",
  requireSession,
  requierePermiso("salidas", "ver"),
  async (req, res, next) => {
    try {
      const { id } = GetDocumentoSalidaParams.parse(req.params);
      const header = await requireSalidaAccess(req.auth!, id, "read");
      if (!["EN_TRANSITO", "RECIBIDA"].includes(header.estado)) {
        throw new InventarioError(
          "El documento solo se puede imprimir cuando la salida está enviada o recibida.",
          "INVALID_SALIDA_STATE",
        );
      }
      const detail = await buildSalidaDetail(db, id);
      res.json(GetDocumentoSalidaResponse.parse(detail));
    } catch (error) {
      if (!sendError(error, res)) next(error);
    }
  },
);

router.delete(
  "/salidas/:id/rollos/:rolloId",
  requireSession,
  requierePermiso("salidas", "crear"),
  async (req, res, next) => {
    try {
      const { id, rolloId } = QuitarRolloBorradorSalidaParams.parse(req.params);
      if (rejectCajaMutation(req.auth!)) {
        res.status(403).json({ error: "El rol CAJA no puede modificar salidas." });
        return;
      }
      await requireSalidaAccess(req.auth!, id, "origin");
      const detail = await db.transaction((tx) =>
        quitarRolloBorradorSalida(tx, id, rolloId, req.auth!.user.id),
      );
      res.json(QuitarRolloBorradorSalidaResponse.parse(detail));
    } catch (error) {
      if (!sendError(error, res)) next(error);
    }
  },
);

router.post(
  "/salidas/:id/enviar",
  requireSession,
  requierePermiso("salidas", "crear"),
  async (req, res, next) => {
    try {
      const { id } = EnviarSalidaParams.parse(req.params);
      const body = EnviarSalidaBody.parse(req.body);
      if (rejectCajaMutation(req.auth!)) {
        res.status(403).json({ error: "El rol CAJA no puede enviar salidas." });
        return;
      }
      await requireSalidaAccess(req.auth!, id, "origin");
      const result = await db.transaction((tx) =>
        enviarSalida(tx, {
          salidaId: id,
          usuarioId: req.auth!.user.id,
          transportista: body.transportista,
          notaEnvio: body.notaEnvio,
        }),
      );
      res.json(EnviarSalidaResponse.parse(result));
    } catch (error) {
      if (!sendError(error, res)) next(error);
    }
  },
);

router.post(
  "/salidas/:id/recibir",
  requireSession,
  requierePermiso("salidas", "crear"),
  async (req, res, next) => {
    try {
      const { id } = RecibirSalidaParams.parse(req.params);
      const body = RecibirSalidaBody.parse(req.body);
      const header = await loadHeader(id);
      if (!header) {
        throw new InventarioError("Salida no encontrada.", "SALIDA_NOT_FOUND");
      }
      if (header.destinoId == null) {
        throw new InventarioError("La salida no tiene un destino de recepción.", "INVALID_SALIDA_STATE");
      }
      requireReceivingSite(req.auth!, header.destinoId);
      const detail = await db.transaction((tx) =>
        recibirSalida(tx, {
          salidaId: id,
          usuarioId: req.auth!.user.id,
          completa: body.completa,
          nota: body.nota,
          pisosPorRollo: body.pisosPorRollo,
          ip: req.ip || req.socket.remoteAddress || "desconocida",
        }),
      );
      res.json(RecibirSalidaResponse.parse(detail));
    } catch (error) {
      if (!sendError(error, res)) next(error);
    }
  },
);

router.post(
  "/salidas/:id/cancelar",
  requireSession,
  requierePermiso("salidas", "autorizar"),
  async (req, res, next) => {
    try {
      const { id } = CancelarSalidaParams.parse(req.params);
      const body = CancelarSalidaBody.parse(req.body) as { motivo: string; adminUsuario?: string; adminPassword?: string };
      if (rejectCajaMutation(req.auth!)) {
        res.status(403).json({ error: "El rol CAJA no puede cancelar salidas." });
        return;
      }
      await requireSalidaAccess(req.auth!, id, "either");
      const auth = req.auth!;
      const result = await db.transaction(async (tx) => {
        let autorizadoPorId: number | null = null;
        if (auth.user.rol !== "ADMIN") {
          if (!body.adminUsuario || !body.adminPassword) {
            throw new InventarioError("Se requieren credenciales de un administrador activo.", "ADMIN_AUTH_REQUIRED");
          }
          const [admin] = await tx.select({ id: usuariosTable.id }).from(usuariosTable).where(and(
            eq(usuariosTable.usuario, normalizeUsername(body.adminUsuario)),
            eq(usuariosTable.rol, "ADMIN"), eq(usuariosTable.activo, true),
            sql`${usuariosTable.passwordHash} = crypt(${body.adminPassword}, ${usuariosTable.passwordHash})`,
          )).limit(1);
          if (!admin) throw new InventarioError("Credenciales de administrador inválidas.", "ADMIN_AUTH_INVALID");
          autorizadoPorId = admin.id;
        }
        const [header] = await tx.select({ salidaId: salidasTable.id, modalidad: salidasTable.modalidad, ticketId: salidasTable.ticketId })
          .from(salidasTable).where(eq(salidasTable.id, id)).limit(1);
        if (!header) throw new InventarioError("Salida no encontrada.", "SALIDA_NOT_FOUND");
        const detail = await cancelarSalidaODocumentoLigado(header, {
          cancelarDocumento: async (ticketId, requestedSalidaId) => {
              await cancelarTicket(tx, {
                ticketId,
                requestedSalidaId,
                usuarioId: auth.user.id,
                autorizadoPor: autorizadoPorId ?? auth.user.id,
                motivo: body.motivo,
                ip: req.ip || req.socket.remoteAddress || "desconocida",
              }, false);
          },
          buildSalida: () => buildSalidaDetail(tx, id),
          cancelarSalida: () => cancelarSalida(tx, id, auth.user.id, body.motivo),
        });
        if (autorizadoPorId != null) {
          await tx.update(salidasTable).set({ autorizadoPorId }).where(eq(salidasTable.id, id));
        }
        return detail;
      });
      res.json(CancelarSalidaResponse.parse(result));
    } catch (error) {
      if (!sendError(error, res)) next(error);
    }
  },
);

export default router;