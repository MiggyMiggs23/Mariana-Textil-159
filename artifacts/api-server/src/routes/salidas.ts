import { Router } from "express";
import ExcelJS from "exceljs";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import {
  CancelarSalidaBody,
  CancelarSalidaParams,
  CancelarSalidaResponse,
  CrearSalidaBody,
  EscanearRolloSalidaParams,
  EscanearRolloSalidaResponse,
  EnviarSalidaBody,
  EnviarSalidaParams,
  EnviarSalidaResponse,
  ExportarSalidasQueryParams,
  GetSalidaParams,
  GetSalidaRecepcionParams,
  GetSalidaRecepcionResponse,
  GetUbicacionesSalidaResponse,
  ListSalidasRecepcionResponse,
  ListSalidasQueryParams,
  RecibirSalidaBody,
  RecibirSalidaParams,
  RecibirSalidaResponse,
} from "@workspace/api-zod";
import { db, productosTable, rollosTable, salidasTable, ubicacionesTable, usuariosTable, type EstadoSalida } from "@workspace/db";
import { requireSession, type AuthContext } from "../middlewares/auth";
import { requierePermiso } from "../lib/permisos";
import { InventarioError } from "../lib/inventario";
import { buildSalidaDetail, cancelarSalida, crearSalida, enviarSalida, listarSalidas, recibirSalida } from "../lib/salidas";
import { normalizeUsername } from "../lib/auth-identifiers";
import {
  EXCEL_NUMBER_FORMAT,
  toExcelNumber,
} from "@workspace/number-format";
import { interpretarCodigoEscaneado } from "@workspace/scanned-code";

const router = Router();

const ESTADOS: EstadoSalida[] = [
  "ARMANDO",
  "EN_TRANSITO",
  "RECIBIDA",
  "CANCELADA",
];

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

async function loadHeader(id: number) {
  const [salida] = await db
    .select()
    .from(salidasTable)
    .where(eq(salidasTable.id, id))
    .limit(1);
  return salida ?? null;
}

function canRead(auth: AuthContext, origenId: number, destinoId: number): boolean {
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
          ? canOperate(auth, salida.destinoId)
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
  if (error.code === "SALIDA_LOCATION_FORBIDDEN") return 403;
  if (
    [
      "INVALID_SALIDA_STATE",
      "ROLLO_UNAVAILABLE",
      "ROLLO_RESERVED",
      "ROLLO_NOT_PENDING",
      "PENDING_ROLLOS",
    ].includes(error.code)
  ) {
    return 409;
  }
  return 400;
}

function sendError(error: unknown, res: Parameters<Parameters<typeof router.get>[1]>[1]): boolean {
  if (!(error instanceof InventarioError)) return false;
  res.status(errorStatus(error)).json({ error: error.message, code: error.code });
  return true;
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

router.post(
  "/salidas",
  requireSession,
  requierePermiso("salidas", "crear"),
  async (req, res, next) => {
    try {
      const body = CrearSalidaBody.parse(req.body);
      const auth = req.auth!;
      if (rejectCajaMutation(auth)) {
        res.status(403).json({ error: "El rol CAJA solo puede consultar salidas recibidas." });
        return;
      }
      let origenId = body.origenId;
      if (auth.user.rol !== "ADMIN" && auth.user.rol !== "SUPERVISOR") {
        if (auth.user.ubicacionId == null) {
          res.status(403).json({ error: "No tienes una ubicación asignada." });
          return;
        }
        if (origenId !== auth.user.ubicacionId) {
          throw new InventarioError("El origen debe ser tu ubicación asignada.", "SALIDA_LOCATION_FORBIDDEN");
        }
        origenId = auth.user.ubicacionId;
      }
      const result = await db.transaction((tx) =>
        crearSalida(tx, {
          ...body,
          origenId,
          usuarioSolicitaId: auth.user.id,
          rolloIds: body.rolloIds,
          transportista: body.transportista,
          observaciones: body.observaciones,
        }),
      );
      res.status(201).json(result);
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
        folio: String(item.folio), estado: item.estado, origen: item.nombreOrigen, destino: item.nombreDestino,
        usuario: item.nombreUsuario, rollos: toExcelNumber(item.totalRollos), metros: toExcelNumber(item.totalMetros), kilos: toExcelNumber(item.totalKilos),
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
  "/salidas/recepcion/:folio",
  requireSession,
  async (req, res, next) => {
    try {
      const { folio } = GetSalidaRecepcionParams.parse(req.params);
      const [header] = await db
        .select()
        .from(salidasTable)
        .where(eq(salidasTable.folio, folio))
        .limit(1);
      if (!header) {
        throw new InventarioError("Salida no encontrada.", "SALIDA_NOT_FOUND");
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
  "/salidas/rollos/serie/:serie",
  requireSession,
  requierePermiso("salidas", "crear"),
  async (req, res, next) => {
    try {
      const origenId = Number(req.query.origenId);
      if (!Number.isInteger(origenId)) throw new InventarioError("origenId es obligatorio.", "VALIDATION_ERROR");
      const { serie: codigoRecibido } = EscanearRolloSalidaParams.parse(req.params);
      const codigo = interpretarCodigoEscaneado(codigoRecibido);
      const serie = codigo.serie ?? codigo.textoOriginal.trim();
      if (!canOperate(req.auth!, origenId)) throw new InventarioError("No puedes operar desde ese origen.", "SALIDA_LOCATION_FORBIDDEN");
      const [rollo] = await db.select({
        id: rollosTable.id, serie: rollosTable.serie, estado: rollosTable.estado,
        ubicacionId: rollosTable.ubicacionId, cantidadActual: rollosTable.cantidadActual,
        productoId: productosTable.id, sku: productosTable.sku, tela: productosTable.tela,
        color: productosTable.color, unidad: productosTable.unidad,
      }).from(rollosTable).innerJoin(productosTable, eq(rollosTable.productoId, productosTable.id))
        .where(eq(rollosTable.serie, serie)).limit(1);
      if (!rollo) throw new InventarioError("Serie no encontrada.", "ROLLO_NOT_FOUND");
      if (rollo.ubicacionId !== origenId) throw new InventarioError(`La serie ${rollo.serie} está en la ubicación ${rollo.ubicacionId}.`, "LOCATION_MISMATCH");
      if (rollo.estado !== "DISPONIBLE") throw new InventarioError(`La serie ${rollo.serie} no está DISPONIBLE.`, "ROLLO_UNAVAILABLE");
      res.json(EscanearRolloSalidaResponse.parse(rollo));
    } catch (error) { if (!sendError(error, res)) next(error); }
  },
);

router.get(
  "/salidas/:id",
  requireSession,
  requierePermiso("salidas", "ver"),
  async (req, res, next) => {
    try {
      const { id } = GetSalidaParams.parse(req.params);
      await requireSalidaAccess(req.auth!, id, "read");
      const detail = await buildSalidaDetail(db, id);
      res.json(detail);
    } catch (error) {
      if (!sendError(error, res)) next(error);
    }
  },
);

router.post(
  "/salidas/:id/enviar",
  requireSession,
  requierePermiso("salidas", "editar"),
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
  async (req, res, next) => {
    try {
      const { id } = RecibirSalidaParams.parse(req.params);
      const body = RecibirSalidaBody.parse(req.body);
      const header = await loadHeader(id);
      if (!header) {
        throw new InventarioError("Salida no encontrada.", "SALIDA_NOT_FOUND");
      }
      requireReceivingSite(req.auth!, header.destinoId);
      const detail = await db.transaction((tx) =>
        recibirSalida(tx, {
          salidaId: id,
          usuarioId: req.auth!.user.id,
          completa: body.completa,
          nota: body.nota,
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
        const detail = await cancelarSalida(tx, id, auth.user.id, body.motivo);
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