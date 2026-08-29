import { Router, type IRouter } from "express";
import { and, count, eq, inArray } from "drizzle-orm";
import { GetDashboardResponse } from "@workspace/api-zod";
import { db, ubicacionesTable, usuariosTable } from "@workspace/db";
import { requireSession } from "../middlewares/auth";
import { requierePermiso } from "../lib/permisos";
import { getInventarioPorUbicacion } from "../lib/inventario";
import { omitTerminalSensitiveFields } from "../lib/sensitive-data";

const router: IRouter = Router();

router.get(
  "/dashboard",
  requireSession,
  requierePermiso("dashboard", "ver"),
  async (req, res): Promise<void> => {
    const user = req.auth!.user;
    const parsedRequestedLocationId =
      typeof req.query.ubicacionId === "string"
        ? Number(req.query.ubicacionId)
        : null;
    const requestedLocationId =
      parsedRequestedLocationId !== null &&
      Number.isInteger(parsedRequestedLocationId) &&
      parsedRequestedLocationId > 0
        ? parsedRequestedLocationId
        : null;

    const isAllSite =
      user.rol === "ADMIN" || user.rol === "SUPERVISOR";
    if (!isAllSite && user.alcanceConsulta === "PROPIA" && user.ubicacionId === null) {
      res.status(403).json({ error: "No tienes una ubicación asignada." });
      return;
    }

    const visibleLocationIds =
      isAllSite
        ? requestedLocationId !== null
          ? [requestedLocationId]
          : null
        : user.alcanceConsulta === "PROPIA"
          ? [user.ubicacionId!]
          : requestedLocationId !== null
            ? [requestedLocationId]
            : null;

    const locationScope = visibleLocationIds
      ? inArray(ubicacionesTable.id, visibleLocationIds)
      : undefined;
    const realLocations = await db
      .select()
      .from(ubicacionesTable)
      .where(
        locationScope
          ? and(
              inArray(ubicacionesTable.tipo, ["TIENDA", "BODEGA"]),
              eq(ubicacionesTable.activa, true),
              locationScope,
            )
          : and(
              inArray(ubicacionesTable.tipo, ["TIENDA", "BODEGA"]),
              eq(ubicacionesTable.activa, true),
            ),
      )
      .orderBy(ubicacionesTable.id);

    const [stores] = await db
      .select({ value: count() })
      .from(ubicacionesTable)
      .where(
        locationScope
          ? and(
              eq(ubicacionesTable.tipo, "TIENDA"),
              eq(ubicacionesTable.activa, true),
              locationScope,
            )
          : and(
              eq(ubicacionesTable.tipo, "TIENDA"),
              eq(ubicacionesTable.activa, true),
            ),
      );
    const [warehouses] = await db
      .select({ value: count() })
      .from(ubicacionesTable)
      .where(
        locationScope
          ? and(
              eq(ubicacionesTable.tipo, "BODEGA"),
              eq(ubicacionesTable.activa, true),
              locationScope,
            )
          : and(
              eq(ubicacionesTable.tipo, "BODEGA"),
              eq(ubicacionesTable.activa, true),
            ),
      );
    const [activeUsers] = await db
      .select({ value: count() })
      .from(usuariosTable)
      .where(
        locationScope
          ? and(
              eq(usuariosTable.activo, true),
              inArray(usuariosTable.ubicacionId, visibleLocationIds!),
            )
          : eq(usuariosTable.activo, true),
      );

    const inventarioData = await getInventarioPorUbicacion(
      visibleLocationIds ?? undefined,
    );
    const inventarioMap = new Map(
      inventarioData.map((d) => [d.ubicacionId, d]),
    );

    const response = GetDashboardResponse.parse({
        tiendasActivas: Number(stores?.value ?? 0),
        bodegasActivas: Number(warehouses?.value ?? 0),
        usuariosActivos: Number(activeUsers?.value ?? 0),
        inventarioPorUbicacion: realLocations.map((location) => {
          const inv = inventarioMap.get(location.id);
          return {
            ubicacionId: location.id,
            nombre: location.nombre,
            metros: inv?.metros ?? "0.000",
            kilos: inv?.kilos ?? "0.000",
            bolsas: inv?.bolsas ?? "0.000",
            rollos: String(inv?.rollos ?? 0),
          };
        }),
      });
    res.json(
      omitTerminalSensitiveFields(
        response,
        user.rol === "TERMINAL",
      ),
    );
  },
);

export default router;