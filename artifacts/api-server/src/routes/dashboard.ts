import { Router, type IRouter } from "express";
import { and, count, eq, inArray } from "drizzle-orm";
import { GetDashboardResponse } from "@workspace/api-zod";
import { db, ubicacionesTable, usuariosTable } from "@workspace/db";
import { requireSession } from "../middlewares/auth";

const router: IRouter = Router();

router.get("/dashboard", requireSession, async (req, res): Promise<void> => {
  const user = req.auth!.user;
  const visibleLocationIds =
    user.rol === "ADMIN" || user.ubicacionId === null
      ? null
      : [user.ubicacionId];

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
            locationScope,
          )
        : inArray(ubicacionesTable.tipo, ["TIENDA", "BODEGA"]),
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
      user.rol === "ADMIN" || user.ubicacionId === null
        ? eq(usuariosTable.activo, true)
        : and(
            eq(usuariosTable.activo, true),
            eq(usuariosTable.ubicacionId, user.ubicacionId),
          ),
    );

  res.json(
    GetDashboardResponse.parse({
      tiendasActivas: Number(stores?.value ?? 0),
      bodegasActivas: Number(warehouses?.value ?? 0),
      usuariosActivos: Number(activeUsers?.value ?? 0),
      inventarioPorUbicacion: realLocations.map((location) => ({
        ubicacionId: location.id,
        nombre: location.nombre,
        metros: "0.000",
        kilos: "0.000",
        rollos: "0.000",
      })),
    }),
  );
});

export default router;