import { Router, type IRouter } from "express";
import { and, asc, eq, inArray } from "drizzle-orm";
import {
  CreateLocationBody,
  CreateLocationResponse,
  ListLocationsResponse,
  UpdateLocationBody,
  UpdateLocationParams,
  UpdateLocationResponse,
  ListPisosLocationParams,
  ListPisosLocationResponse,
  CreatePisoLocationParams,
  CreatePisoLocationBody,
  CreatePisoLocationResponse,
  UpdatePisoLocationParams,
  UpdatePisoLocationBody,
  UpdatePisoLocationResponse,
} from "@workspace/api-zod";
import {
  auditoriaTable,
  db,
  ubicacionesTable,
  pisosTable,
} from "@workspace/db";
import { requireSession } from "../middlewares/auth";
import { requierePermiso } from "../lib/permisos";
import { presentLocation } from "../lib/presenters";
import { getRequestIp } from "../lib/request";

const router: IRouter = Router();

router.use("/locations", requireSession);

router.get(
  "/locations",
  requierePermiso("ubicaciones", "ver"),
  async (_req, res): Promise<void> => {
  const locations = await db
    .select()
    .from(ubicacionesTable)
    .where(
      and(
        inArray(ubicacionesTable.tipo, ["TIENDA", "BODEGA"]),
        eq(ubicacionesTable.activa, true),
      ),
    )
    .orderBy(ubicacionesTable.id);
  res.json(ListLocationsResponse.parse(locations.map(presentLocation)));
  },
);

router.post(
  "/locations",
  requierePermiso("ubicaciones", "crear"),
  async (req, res): Promise<void> => {
    const body = CreateLocationBody.safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: "Datos de ubicación inválidos." });
      return;
    }
    try {
      const created = await db.transaction(async (tx) => {
        const [row] = await tx
          .insert(ubicacionesTable)
          .values({
            nombre: body.data.nombre.trim(),
            iniciales: body.data.iniciales,
            tipo: body.data.tipo,
          })
          .returning();
        await tx.insert(auditoriaTable).values({
          usuarioId: req.auth!.user.id,
          accion: "CREAR",
          entidad: "ubicaciones",
          entidadId: String(row.id),
          datosDespues: presentLocation(row),
          ip: getRequestIp(req),
        });
        return row;
      });
      res.status(201).json(CreateLocationResponse.parse(presentLocation(created)));
    } catch (error) {
      if ((error as { code?: string }).code === "23505") {
        res.status(400).json({ error: "Ya existe un sitio con ese nombre o iniciales." });
        return;
      }
      throw error;
    }
  },
);

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
        .set({
          ...body.data,
          nombre: body.data.nombre?.trim(),
        })
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
        res.status(400).json({ error: "Ya existe un sitio con ese nombre o iniciales." });
      return;
    }
    throw error;
  }
});

function presentPiso(row: typeof pisosTable.$inferSelect) {
  return {
    id: row.id,
    ubicacionId: row.ubicacionId,
    nombre: row.nombre,
    activo: row.activo,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

router.get("/locations/:id/pisos", requierePermiso("ubicaciones", "ver"), async (req, res): Promise<void> => {
  const params = ListPisosLocationParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Sitio inválido." });
    return;
  }
  const [site] = await db.select({ id: ubicacionesTable.id }).from(ubicacionesTable)
    .where(and(eq(ubicacionesTable.id, params.data.id), inArray(ubicacionesTable.tipo, ["TIENDA", "BODEGA"]))).limit(1);
  if (!site) {
    res.status(404).json({ error: "Ubicación no encontrada." });
    return;
  }
  const rows = await db.select().from(pisosTable)
    .where(and(eq(pisosTable.ubicacionId, site.id), req.auth!.user.rol === "ADMIN" ? undefined : eq(pisosTable.activo, true)))
    .orderBy(asc(pisosTable.nombre));
  res.json(ListPisosLocationResponse.parse(rows.map(presentPiso)));
});

router.post("/locations/:id/pisos", requierePermiso("ubicaciones", "crear"), async (req, res): Promise<void> => {
  if (req.auth!.user.rol !== "ADMIN") {
    res.status(403).json({ error: "Solo ADMIN administra pisos." });
    return;
  }
  const params = CreatePisoLocationParams.safeParse(req.params);
  const body = CreatePisoLocationBody.safeParse(req.body);
  const nombre = body.success ? body.data.nombre.trim().replace(/\s+/g, " ") : "";
  if (!params.success || !body.success || !nombre) {
    res.status(400).json({ error: "Datos de piso inválidos." });
    return;
  }
  try {
    const piso = await db.transaction(async (tx) => {
      const [site] = await tx.select({ id: ubicacionesTable.id }).from(ubicacionesTable)
        .where(and(eq(ubicacionesTable.id, params.data.id), inArray(ubicacionesTable.tipo, ["TIENDA", "BODEGA"]))).limit(1);
      if (!site) return null;
      const [created] = await tx.insert(pisosTable).values({ ubicacionId: site.id, nombre, activo: body.data.activo }).returning();
      await tx.insert(auditoriaTable).values({ usuarioId: req.auth!.user.id, accion: "CREAR", entidad: "pisos", entidadId: String(created!.id), datosDespues: presentPiso(created!), ip: getRequestIp(req) });
      return created!;
    });
    if (!piso) { res.status(404).json({ error: "Ubicación no encontrada." }); return; }
    res.status(201).json(CreatePisoLocationResponse.parse(presentPiso(piso)));
  } catch (error) {
    if ((error as { code?: string }).code === "23505") { res.status(409).json({ error: "Ya existe un piso con ese nombre en este sitio." }); return; }
    throw error;
  }
});

router.patch("/locations/:id/pisos/:pisoId", requierePermiso("ubicaciones", "editar"), async (req, res): Promise<void> => {
  if (req.auth!.user.rol !== "ADMIN") { res.status(403).json({ error: "Solo ADMIN administra pisos." }); return; }
  const params = UpdatePisoLocationParams.safeParse(req.params);
  const body = UpdatePisoLocationBody.safeParse(req.body);
  const nombre = body.success && body.data.nombre !== undefined ? body.data.nombre.trim().replace(/\s+/g, " ") : undefined;
  if (!params.success || !body.success || !Object.keys(body.data).length || nombre === "") { res.status(400).json({ error: "Datos de piso inválidos." }); return; }
  const [before] = await db.select().from(pisosTable).where(and(eq(pisosTable.id, params.data.pisoId), eq(pisosTable.ubicacionId, params.data.id))).limit(1);
  if (!before) { res.status(404).json({ error: "Piso no encontrado." }); return; }
  try {
    const [after] = await db.transaction(async (tx) => {
      const updated = await tx.update(pisosTable).set({ ...body.data, nombre }).where(eq(pisosTable.id, before.id)).returning();
      await tx.insert(auditoriaTable).values({ usuarioId: req.auth!.user.id, accion: "ACTUALIZAR", entidad: "pisos", entidadId: String(before.id), datosAntes: presentPiso(before), datosDespues: presentPiso(updated[0]!), ip: getRequestIp(req) });
      return updated;
    });
    res.json(UpdatePisoLocationResponse.parse(presentPiso(after!)));
  } catch (error) {
    if ((error as { code?: string }).code === "23505") { res.status(409).json({ error: "Ya existe un piso con ese nombre en este sitio." }); return; }
    throw error;
  }
});

export default router;