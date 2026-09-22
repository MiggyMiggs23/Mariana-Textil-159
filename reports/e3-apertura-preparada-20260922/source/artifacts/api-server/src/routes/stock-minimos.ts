import { Router, type Request } from "express";
import { z } from "zod";
import { getRequestIp } from "../lib/request";
import { requireSession } from "../middlewares/auth";
import { requierePermiso } from "../lib/permisos";
import { resolveReadScope } from "./inventario";
import {
  getStockMinimumConfig,
  listStockMinimumProducts,
  setStockMinimum,
  setStockMinimumSiteEnabled,
  StockMinimumError,
} from "../lib/stock-minimos";

const router = Router();

const locationQuery = z
  .object({
    ubicacionId: z.coerce.number().int().positive(),
  })
  .strict();

const listQuery = z
  .object({
    ubicacionId: z.coerce.number().int().positive(),
    buscar: z.string().optional(),
  })
  .strict();

const enabledBody = z
  .object({
    habilitado: z.boolean(),
  })
  .strict();

function decimalPlaces(value: number): number {
  const [coefficient, exponentText] = value.toString().toLowerCase().split("e");
  const exponent = exponentText == null ? 0 : Number(exponentText);
  const fractionLength = coefficient.split(".")[1]?.length ?? 0;
  return Math.max(0, fractionLength - exponent);
}

const minimumValue = z
  .number()
  .finite()
  .nonnegative()
  .refine((value) => decimalPlaces(value) <= 3, {
    message: "El mínimo puede tener hasta tres decimales.",
  });

const minimumBody = z
  .object({
    minimo: z.union([minimumValue, z.null()]),
  })
  .strict();

function resolveReadLocation(req: Request, requested: number): number | null {
  const scope = resolveReadScope(req.auth!, requested);
  if (scope.scopeError) {
    return null;
  }
  return scope.ubicacionId == null ? null : scope.ubicacionId;
}

/**
 * Settings writes intentionally do not reuse checkOperationalScope: that
 * helper grants SUPERVISOR a cross-site operational bypass for existing
 * inventory operations. Stock-minimum writes retain the existing ADMIN-only
 * bypass and otherwise require the assigned site.
 */
function operationalSiteError(req: Request, ubicacionId: number): string | null {
  const user = req.auth!.user;
  if (user.rol === "ADMIN") return null;
  if (user.ubicacionId == null) return "No tienes una ubicación asignada.";
  if (user.ubicacionId !== ubicacionId) {
    return "No tienes permiso para operar en esa ubicación.";
  }
  return null;
}

function parseLocation(req: Request): number | null {
  const parsed = locationQuery.safeParse(req.query);
  if (!parsed.success) return null;
  return parsed.data.ubicacionId;
}

function sendStockError(res: {
  status(code: number): { json(body: unknown): void };
}, error: unknown): void {
  if (!(error instanceof StockMinimumError)) {
    throw error;
  }
  const status =
    error.code === "LOCATION_NOT_FOUND" || error.code === "PRODUCT_NOT_FOUND"
      ? 404
      : error.code === "SITE_DISABLED"
        ? 409
        : 400;
  res.status(status).json({ error: error.message, code: error.code });
}

router.use("/stock-minimos", requireSession);

router.get(
  "/stock-minimos/config",
  requierePermiso("inventario", "ver"),
  async (req, res, next): Promise<void> => {
    try {
      const requested = parseLocation(req);
      if (requested == null) {
        res.status(400).json({ error: "ubicacionId es obligatorio." });
        return;
      }
      const ubicacionId = resolveReadLocation(req, requested);
      if (ubicacionId == null) {
        res.status(403).json({ error: "No tienes una ubicación asignada." });
        return;
      }
      res.json(await getStockMinimumConfig(ubicacionId));
    } catch (error) {
      next(error);
    }
  },
);

router.patch(
  "/stock-minimos/config",
  requierePermiso("inventario", "editar"),
  async (req, res, next): Promise<void> => {
    try {
      const requested = parseLocation(req);
      if (requested == null) {
        res.status(400).json({ error: "ubicacionId es obligatorio." });
        return;
      }
      const scopeError = operationalSiteError(req, requested);
      if (scopeError) {
        res.status(403).json({ error: scopeError });
        return;
      }
      const body = enabledBody.parse(req.body);
      const result = await setStockMinimumSiteEnabled({
        ubicacionId: requested,
        habilitado: body.habilitado,
        usuarioId: req.auth!.user.id,
        ip: getRequestIp(req),
      });
      res.json(result);
    } catch (error) {
      if (error instanceof StockMinimumError) {
        sendStockError(res, error);
        return;
      }
      next(error);
    }
  },
);

router.get(
  "/stock-minimos",
  requierePermiso("inventario", "ver"),
  async (req, res, next): Promise<void> => {
    try {
      const parsed = listQuery.safeParse(req.query);
      if (!parsed.success) {
        res.status(400).json({ error: "ubicacionId es obligatorio." });
        return;
      }
      const ubicacionId = resolveReadLocation(req, parsed.data.ubicacionId);
      if (ubicacionId == null) {
        res.status(403).json({ error: "No tienes una ubicación asignada." });
        return;
      }
      const config = await getStockMinimumConfig(ubicacionId);
      const productos = config.habilitado
        ? await listStockMinimumProducts(ubicacionId, parsed.data.buscar)
        : [];
      res.json({ ...config, productos });
    } catch (error) {
      next(error);
    }
  },
);

router.put(
  "/stock-minimos/:productoId",
  requierePermiso("inventario", "editar"),
  async (req, res, next): Promise<void> => {
    try {
      const requested = parseLocation(req);
      const productoId = z.coerce.number().int().positive().safeParse(
        req.params.productoId,
      );
      if (requested == null || !productoId.success) {
        res.status(400).json({ error: "ubicacionId y productoId son obligatorios." });
        return;
      }
      const scopeError = operationalSiteError(req, requested);
      if (scopeError) {
        res.status(403).json({ error: scopeError });
        return;
      }
      const body = minimumBody.parse(req.body);
      await setStockMinimum({
        ubicacionId: requested,
        productoId: productoId.data,
        minimo: body.minimo,
        usuarioId: req.auth!.user.id,
        ip: getRequestIp(req),
      });
      const config = await getStockMinimumConfig(requested);
      res.json(config);
    } catch (error) {
      if (error instanceof StockMinimumError) {
        sendStockError(res, error);
        return;
      }
      next(error);
    }
  },
);

export default router;
