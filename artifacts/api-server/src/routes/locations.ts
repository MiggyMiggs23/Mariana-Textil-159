import { Router, type IRouter } from "express";
import { and, eq, inArray } from "drizzle-orm";
import {
  ListLocationsResponse,
  UpdateLocationBody,
  UpdateLocationParams,
  UpdateLocationResponse,
} from "@workspace/api-zod";
import {
  auditoriaTable,
  db,
  ubicacionesTable,
} from "@workspace/db";
import { requireSession } from "../middlewares/auth";
import { requierePermiso } from "../lib/permisos";
import { presentLocation } from "../lib/presenters";
import { getRequestIp } from "../lib/request";

const router: IRouter = Router();

router.use("/locations", requireSession, requierePermiso("ubicaciones", "ver"));

router.get("/locations", async (_req, res): Promise<void> => {
  const locations = await db
    .select()
    .from(ubicacionesTable)
    .where(inArray(ubicacionesTable.tipo, ["TIENDA", "BODEGA"]))
    .orderBy(ubicacionesTable.id);
  res.json(ListLocationsResponse.parse(locations.map(presentLocation)));
});

router.patch("/locations/:id", requierePermiso("ubicaciones", "editar"), async (req, res): Promise<void> => {
  const params = UpdateLocationParams.safeParse(req.params);
  const body = UpdateLocationBody.safeParse(req.body);
  if (!params.success || !body.success || Object.keys(body.data).length === 0) {
    res.status(400).json({ error: "Datos de ubicación inválidos." });
    return;
  }

  const [before] = await db
    .select()
    .from(ubicacionesTable)
    .where(eq(ubicacionesTable.id, params.data.id))
    .limit(1);
  if (!before) {
    res.status(404).json({ error: "Ubicación no encontrada." });
    return;
  }
  if (before.tipo === "TRANSITO" || before.tipo === "EXTERNO") {
    res.status(403).json({ error: "Las ubicaciones del sistema no se editan." });
    return;
  }

  try {
    const updated = await db.transaction(async (tx) => {
      const [after] = await tx
        .update(ubicacionesTable)
        .set(body.data)
        .where(
          and(
            eq(ubicacionesTable.id, params.data.id),
            inArray(ubicacionesTable.tipo, ["TIENDA", "BODEGA"]),
          ),
        )
        .returning();
      await tx.insert(auditoriaTable).values({
        usuarioId: req.auth!.user.id,
        accion: "ACTUALIZAR",
        entidad: "ubicaciones",
        entidadId: String(params.data.id),
        datosAntes: presentLocation(before),
        datosDespues: presentLocation(after),
        ip: getRequestIp(req),
      });
      return after;
    });
    res.json(UpdateLocationResponse.parse(presentLocation(updated)));
  } catch (error) {
    if ((error as { code?: string }).code === "23505") {
      res.status(400).json({ error: "Ya existe una ubicación con ese nombre." });
      return;
    }
    throw error;
  }
});

export default router;