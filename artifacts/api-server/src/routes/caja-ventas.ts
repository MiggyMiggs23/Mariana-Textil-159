import { Router, type IRouter } from "express";
import {
  ListCajaTiendaVentasParams,
  ListCajaTiendaVentasQueryParams,
  ListCajaTiendaVentasResponse,
} from "@workspace/api-zod";
import { requireSession } from "../middlewares/auth";
import {
  AnalyticsInputError,
  listStoreSales,
  parseAnalyticsFilters,
} from "../lib/admin-analytics";
import { requierePermiso } from "../lib/permisos";
import { omitSupervisorSensitiveFields } from "../lib/sensitive-data";
import { resolveReadScope } from "./inventario";

const router: IRouter = Router();

router.get(
  "/caja/tiendas/:ubicacionId/ventas",
  requireSession,
  requierePermiso("resumen_caja", "ver"),
  async (req, res, next): Promise<void> => {
    try {
      const { ubicacionId: requestedUbicacionId } = ListCajaTiendaVentasParams.parse(req.params);
      const query = ListCajaTiendaVentasQueryParams.parse(req.query);
      // Resolve on every request; PROPIA/CAJA cannot select another store.
      const { ubicacionId, scopeError } = resolveReadScope(req.auth!, requestedUbicacionId);
      if (scopeError || ubicacionId == null) {
        res.status(403).json({ error: scopeError ?? "Se requiere una ubicación concreta." });
        return;
      }
      if (ubicacionId !== requestedUbicacionId) {
        res.status(403).json({ error: "No tienes acceso a las ventas de esa tienda." });
        return;
      }
      const result = ListCajaTiendaVentasResponse.parse(await listStoreSales(
        { ...parseAnalyticsFilters(query), ubicacionId },
        query.formaPago,
        query.page,
        query.pageSize,
      ));
      res.json(omitSupervisorSensitiveFields(
        result,
        req.auth!.user.rol === "SUPERVISOR",
      ));
    } catch (error) {
      if (error instanceof AnalyticsInputError) {
        res.status(400).json({ error: error.message, code: "VALIDATION_ERROR" });
        return;
      }
      next(error);
    }
  },
);

export default router;