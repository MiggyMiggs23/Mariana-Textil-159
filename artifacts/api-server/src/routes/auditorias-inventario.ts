import { Router, type Request, type Response, type NextFunction } from "express";
import { and, desc, eq, inArray } from "drizzle-orm";
import { interpretarCodigoEscaneado } from "@workspace/scanned-code";
import {
  CancelAuditoriaInventarioBody,
  CancelAuditoriaInventarioParams,
  CancelAuditoriaInventarioResponse,
  CloseAuditoriaInventarioParams,
  CloseAuditoriaInventarioResponse,
  ConfirmAuditoriaInventarioParams,
  ConfirmAuditoriaInventarioResponse,
  CreateAuditoriaInventarioBody,
  CreateAuditoriaInventarioResponse,
  GetAuditoriaInventarioParams,
  GetAuditoriaInventarioResponse,
  ListAuditoriasInventarioQueryParams,
  ListAuditoriasInventarioResponse,
  ListSitiosAuditoriaInventarioResponse,
  ScanAuditoriaInventarioBody,
  ScanAuditoriaInventarioParams,
  ScanAuditoriaInventarioResponse,
} from "@workspace/api-zod";
import {
  auditoriasInventarioTable,
  db,
  ubicacionesTable,
} from "@workspace/db";
import { requireSession } from "../middlewares/auth";
import { requierePermiso } from "../lib/permisos";
import { getRequestIp } from "../lib/request";
import {
  AuditoriaInventarioError,
  buildAuditoriaDetail,
  confirmAuditoria,
  createAuditoria,
  scanAuditoria,
  transitionAuditoria,
} from "../lib/auditoria-inventario";

const router = Router();
const ROLES = new Set(["ADMIN", "SUPERVISOR", "BODEGA", "SISTEMAS"]);

function requireOperationalRole(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (!req.auth || !ROLES.has(req.auth.user.rol)) {
    res.status(403).json({ error: "Tu rol no tiene acceso a auditorías de inventario." });
    return;
  }
  next();
}

function checkSite(req: Request, ubicacionId: number): string | null {
  const user = req.auth!.user;
  if (user.rol !== "BODEGA") return null;
  if (user.ubicacionId == null) return "No tienes un sitio asignado.";
  return user.ubicacionId === ubicacionId
    ? null
    : "Solo puedes operar auditorías de tu propio sitio.";
}

async function getVisibleHeader(req: Request, id: number) {
  const [header] = await db
    .select()
    .from(auditoriasInventarioTable)
    .where(eq(auditoriasInventarioTable.id, id))
    .limit(1);
  if (!header) return { header: null, error: null };
  return { header, error: checkSite(req, header.ubicacionId) };
}

function handleError(error: unknown, res: Response, next: NextFunction): void {
  if (error instanceof AuditoriaInventarioError) {
    const status =
      error.code === "NOT_FOUND"
        ? 404
        : error.code.includes("OPEN") || error.code === "NOT_CLOSED"
          ? 409
          : 400;
    res.status(status).json({ error: error.message, code: error.code });
    return;
  }
  next(error);
}

router.get(
  "/auditorias/sitios",
  requireSession,
  requierePermiso("auditoria_inventario", "ver"),
  requireOperationalRole,
  async (req, res, next): Promise<void> => {
    try {
      const sites = await db
        .select({ id: ubicacionesTable.id, nombre: ubicacionesTable.nombre, iniciales: ubicacionesTable.iniciales })
        .from(ubicacionesTable)
        .where(
          and(
            eq(ubicacionesTable.activa, true),
            inArray(ubicacionesTable.tipo, ["TIENDA", "BODEGA"]),
          ),
        )
        .orderBy(ubicacionesTable.nombre);
      const visible =
        req.auth!.user.rol === "BODEGA"
          ? sites.filter((site) => site.id === req.auth!.user.ubicacionId)
          : sites;
      res.json(ListSitiosAuditoriaInventarioResponse.parse(visible));
    } catch (error) {
      next(error);
    }
  },
);

router.get(
  "/auditorias",
  requireSession,
  requierePermiso("auditoria_inventario", "ver"),
  requireOperationalRole,
  async (req, res, next): Promise<void> => {
    try {
      const query = ListAuditoriasInventarioQueryParams.parse(req.query);
      let headers = await db
        .select({ id: auditoriasInventarioTable.id, ubicacionId: auditoriasInventarioTable.ubicacionId })
        .from(auditoriasInventarioTable)
        .orderBy(desc(auditoriasInventarioTable.abiertaAt))
        .limit(100);
      if (query.ubicacionId) headers = headers.filter((row) => row.ubicacionId === query.ubicacionId);
      if (req.auth!.user.rol === "BODEGA") {
        headers = headers.filter((row) => row.ubicacionId === req.auth!.user.ubicacionId);
      }
      const details = await Promise.all(headers.map((row) => db.transaction((tx) => buildAuditoriaDetail(tx, row.id))));
      res.json(ListAuditoriasInventarioResponse.parse(details.map(({ resultados: _r, participantes: _p, ...summary }) => summary)));
    } catch (error) {
      handleError(error, res, next);
    }
  },
);

router.post(
  "/auditorias",
  requireSession,
  requierePermiso("auditoria_inventario", "crear"),
  requireOperationalRole,
  async (req, res, next): Promise<void> => {
    try {
      const body = CreateAuditoriaInventarioBody.parse(req.body);
      const scopeError = checkSite(req, body.ubicacionId);
      if (scopeError) {
        res.status(403).json({ error: scopeError });
        return;
      }
      const created = await db.transaction((tx) =>
        createAuditoria(tx, {
          ubicacionId: body.ubicacionId,
          usuarioId: req.auth!.user.id,
          ip: getRequestIp(req),
        }),
      );
      const detail = await db.transaction((tx) => buildAuditoriaDetail(tx, created.id));
      res.status(201).json(CreateAuditoriaInventarioResponse.parse(detail));
    } catch (error) {
      handleError(error, res, next);
    }
  },
);

router.get(
  "/auditorias/:id",
  requireSession,
  requierePermiso("auditoria_inventario", "ver"),
  requireOperationalRole,
  async (req, res, next): Promise<void> => {
    try {
      const { id } = GetAuditoriaInventarioParams.parse(req.params);
      const visible = await getVisibleHeader(req, id);
      if (!visible.header) {
        res.status(404).json({ error: "Auditoría no encontrada." });
        return;
      }
      if (visible.error) {
        res.status(403).json({ error: visible.error });
        return;
      }
      res.json(GetAuditoriaInventarioResponse.parse(await db.transaction((tx) => buildAuditoriaDetail(tx, id))));
    } catch (error) {
      handleError(error, res, next);
    }
  },
);

router.post(
  "/auditorias/:id/escaneos",
  requireSession,
  requierePermiso("auditoria_inventario", "editar"),
  requireOperationalRole,
  async (req, res, next): Promise<void> => {
    try {
      const { id } = ScanAuditoriaInventarioParams.parse(req.params);
      const body = ScanAuditoriaInventarioBody.parse(req.body);
      const visible = await getVisibleHeader(req, id);
      if (!visible.header) {
        res.status(404).json({ error: "Auditoría no encontrada." });
        return;
      }
      if (visible.error) {
        res.status(403).json({ error: visible.error });
        return;
      }
      const interpreted = interpretarCodigoEscaneado(body.serie);
      const serie = interpreted.serie ?? interpreted.textoOriginal.trim();
      const result = await db.transaction((tx) =>
        scanAuditoria(tx, {
          auditoriaId: id,
          serie,
          usuarioId: req.auth!.user.id,
          ip: getRequestIp(req),
        }),
      );
      res.json(ScanAuditoriaInventarioResponse.parse(result));
    } catch (error) {
      handleError(error, res, next);
    }
  },
);

for (const action of ["cerrar", "cancelar"] as const) {
  router.post(
    `/auditorias/:id/${action}`,
    requireSession,
    requierePermiso("auditoria_inventario", "editar"),
    requireOperationalRole,
    async (req, res, next): Promise<void> => {
      try {
        const params =
          action === "cerrar"
            ? CloseAuditoriaInventarioParams.parse(req.params)
            : CancelAuditoriaInventarioParams.parse(req.params);
        const body =
          action === "cancelar" ? CancelAuditoriaInventarioBody.parse(req.body) : undefined;
        const visible = await getVisibleHeader(req, params.id);
        if (!visible.header) {
          res.status(404).json({ error: "Auditoría no encontrada." });
          return;
        }
        if (visible.error) {
          res.status(403).json({ error: visible.error });
          return;
        }
        await db.transaction((tx) =>
          transitionAuditoria(tx, {
            auditoriaId: params.id,
            usuarioId: req.auth!.user.id,
            ip: getRequestIp(req),
            action: action === "cerrar" ? "CERRAR" : "CANCELAR",
            motivo: body?.motivo,
          }),
        );
        const detail = await db.transaction((tx) => buildAuditoriaDetail(tx, params.id));
        res.json(
          action === "cerrar"
            ? CloseAuditoriaInventarioResponse.parse(detail)
            : CancelAuditoriaInventarioResponse.parse(detail),
        );
      } catch (error) {
        handleError(error, res, next);
      }
    },
  );
}

router.post(
  "/auditorias/:id/confirmar",
  requireSession,
  requierePermiso("auditoria_inventario", "autorizar"),
  requireOperationalRole,
  async (req, res, next): Promise<void> => {
    try {
      const { id } = ConfirmAuditoriaInventarioParams.parse(req.params);
      if (req.auth!.user.rol !== "ADMIN") {
        res.status(403).json({ error: "Solo ADMIN puede confirmar y aplicar una auditoría." });
        return;
      }
      await db.transaction((tx) =>
        confirmAuditoria(tx, {
          auditoriaId: id,
          usuarioId: req.auth!.user.id,
          ip: getRequestIp(req),
        }),
      );
      res.json(ConfirmAuditoriaInventarioResponse.parse(await db.transaction((tx) => buildAuditoriaDetail(tx, id))));
    } catch (error) {
      handleError(error, res, next);
    }
  },
);

export default router;