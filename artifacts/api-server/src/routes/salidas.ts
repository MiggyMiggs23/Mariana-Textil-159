import { Router } from "express";
import { eq } from "drizzle-orm";
import {
  AceptarSalidaParams,
  AceptarSalidaResponse,
  CancelarSalidaBody,
  CancelarSalidaParams,
  CancelarSalidaResponse,
  CerrarSalidaParams,
  CerrarSalidaResponse,
  CrearSalidaBody,
  CrearSalidaResponse,
  EnviarSalidaBody,
  EnviarSalidaParams,
  EnviarSalidaResponse,
  GetSalidaParams,
  GetSalidaResponse,
  GetSalidasPendientesCountResponse,
  ListSalidasQueryParams,
  ListSalidasResponse,
  PrepararSalidaBody,
  PrepararSalidaParams,
  PrepararSalidaResponse,
  RecibirSalidaBody,
  RecibirSalidaParams,
  RecibirSalidaResponse,
  RechazarSalidaBody,
  RechazarSalidaParams,
  RechazarSalidaResponse,
} from "@workspace/api-zod";
import { db, salidasTable, type EstadoSalida } from "@workspace/db";
import { requireSession, type AuthContext } from "../middlewares/auth";
import { requierePermiso } from "../lib/permisos";
import { InventarioError } from "../lib/inventario";
import {
  aceptarSalida,
  buildSalidaDetail,
  cancelarSalida,
  cerrarSalida,
  countSalidasPendientes,
  crearSalida,
  enviarSalida,
  listarSalidas,
  prepararSalida,
  recibirSalida,
  rechazarSalida,
} from "../lib/salidas";

const router = Router();

const ESTADOS: EstadoSalida[] = [
  "SOLICITADA",
  "ACEPTADA",
  "RECHAZADA",
  "PREPARADA",
  "ENVIADA",
  "RECIBIDA",
  "CERRADA",
  "CANCELADA",
];

async function loadHeader(id: number) {
  const [salida] = await db
    .select()
    .from(salidasTable)
    .where(eq(salidasTable.id, id))
    .limit(1);
  return salida ?? null;
}

function canRead(auth: AuthContext, origenId: number, destinoId: number): boolean {
  if (auth.user.rol === "ADMIN" || auth.user.alcanceConsulta === "TODAS") return true;
  return auth.user.ubicacionId === origenId || auth.user.ubicacionId === destinoId;
}

function canOperate(auth: AuthContext, ubicacionId: number): boolean {
  return auth.user.rol === "ADMIN" || auth.user.ubicacionId === ubicacionId;
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
      if (auth.user.rol !== "ADMIN" && auth.user.ubicacionId == null) {
        res.status(403).json({ error: "No tienes una ubicación asignada." });
        return;
      }
      const visibleUbicacionId =
        auth.user.rol === "ADMIN" || auth.user.alcanceConsulta === "TODAS"
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
        destinoId: query.destinoId,
        productoId: query.productoId,
        fechaDesde: query.fechaDesde,
        fechaHasta: query.fechaHasta,
        page: Math.max(1, query.page ?? 1),
        pageSize: Math.min(100, Math.max(1, query.pageSize ?? 20)),
        visibleUbicacionId,
      });
      res.json(ListSalidasResponse.parse(result));
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
      let destinoId = body.destinoId;
      if (auth.user.rol !== "ADMIN") {
        if (auth.user.ubicacionId == null) {
          res.status(403).json({ error: "No tienes una ubicación asignada." });
          return;
        }
        destinoId = auth.user.ubicacionId;
      }
      const result = await db.transaction((tx) =>
        crearSalida(tx, {
          ...body,
          destinoId,
          usuarioSolicitaId: auth.user.id,
          lineas: body.lineas.map((linea) => ({
            ...linea,
            rollosSolicitados: linea.rollosSolicitados ?? null,
            nota: linea.nota ?? null,
          })),
        }),
      );
      res.status(201).json(CrearSalidaResponse.parse(result));
    } catch (error) {
      if (!sendError(error, res)) next(error);
    }
  },
);

router.get(
  "/salidas/pendientes-count",
  requireSession,
  requierePermiso("salidas", "ver"),
  async (req, res, next) => {
    try {
      const auth = req.auth!;
      if (auth.user.rol !== "ADMIN" && auth.user.ubicacionId == null) {
        res.status(403).json({ error: "No tienes una ubicación asignada." });
        return;
      }
      const visibleUbicacionId =
        auth.user.rol === "ADMIN" || auth.user.alcanceConsulta === "TODAS"
          ? undefined
          : auth.user.ubicacionId;
      const result = await countSalidasPendientes(visibleUbicacionId);
      res.json(GetSalidasPendientesCountResponse.parse({ count: result.total }));
    } catch (error) {
      next(error);
    }
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
      res.json(GetSalidaResponse.parse(detail));
    } catch (error) {
      if (!sendError(error, res)) next(error);
    }
  },
);

router.post(
  "/salidas/:id/aceptar",
  requireSession,
  requierePermiso("salidas", "editar"),
  async (req, res, next) => {
    try {
      const { id } = AceptarSalidaParams.parse(req.params);
      await requireSalidaAccess(req.auth!, id, "origin");
      const result = await db.transaction((tx) => aceptarSalida(tx, id, req.auth!.user.id));
      res.json(AceptarSalidaResponse.parse(result));
    } catch (error) {
      if (!sendError(error, res)) next(error);
    }
  },
);

router.post(
  "/salidas/:id/rechazar",
  requireSession,
  requierePermiso("salidas", "editar"),
  async (req, res, next) => {
    try {
      const { id } = RechazarSalidaParams.parse(req.params);
      const body = RechazarSalidaBody.parse(req.body);
      await requireSalidaAccess(req.auth!, id, "origin");
      const result = await db.transaction((tx) =>
        rechazarSalida(tx, id, req.auth!.user.id, body.motivo),
      );
      res.json(RechazarSalidaResponse.parse(result));
    } catch (error) {
      if (!sendError(error, res)) next(error);
    }
  },
);

router.post(
  "/salidas/:id/preparar",
  requireSession,
  requierePermiso("salidas", "editar"),
  async (req, res, next) => {
    try {
      const { id } = PrepararSalidaParams.parse(req.params);
      const body = PrepararSalidaBody.parse(req.body);
      await requireSalidaAccess(req.auth!, id, "origin");
      const result = await db.transaction((tx) =>
        prepararSalida(tx, { salidaId: id, usuarioId: req.auth!.user.id, lineas: body.lineas }),
      );
      res.json(PrepararSalidaResponse.parse(result));
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
      await requireSalidaAccess(req.auth!, id, "origin");
      const result = await db.transaction((tx) =>
        enviarSalida(tx, {
          salidaId: id,
          usuarioId: req.auth!.user.id,
          transportista: body.transportista,
          notaEnvio: body.notaEnvio ?? null,
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
  requierePermiso("salidas", "editar"),
  async (req, res, next) => {
    try {
      const { id } = RecibirSalidaParams.parse(req.params);
      const body = RecibirSalidaBody.parse(req.body);
      await requireSalidaAccess(req.auth!, id, "destination");
      const result = await db.transaction((tx) =>
        recibirSalida(tx, {
          salidaId: id,
          usuarioId: req.auth!.user.id,
          notaRecepcion: body.notaRecepcion ?? null,
          rollos: body.rollos ?? [],
        }),
      );
      res.json(RecibirSalidaResponse.parse(result));
    } catch (error) {
      if (!sendError(error, res)) next(error);
    }
  },
);

router.post(
  "/salidas/:id/cerrar",
  requireSession,
  requierePermiso("salidas", "autorizar"),
  async (req, res, next) => {
    try {
      const { id } = CerrarSalidaParams.parse(req.params);
      await requireSalidaAccess(req.auth!, id, "destination");
      const result = await db.transaction((tx) => cerrarSalida(tx, id, req.auth!.user.id));
      res.json(CerrarSalidaResponse.parse(result));
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
      const body = CancelarSalidaBody.parse(req.body);
      await requireSalidaAccess(req.auth!, id, "either");
      const result = await db.transaction((tx) =>
        cancelarSalida(tx, id, req.auth!.user.id, body.motivo),
      );
      res.json(CancelarSalidaResponse.parse(result));
    } catch (error) {
      if (!sendError(error, res)) next(error);
    }
  },
);

export default router;