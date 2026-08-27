import { Router, type IRouter, type NextFunction, type Request, type Response } from "express";
import { and, eq, ne } from "drizzle-orm";
import {
  CreateCamionetaBody,
  GetCamionetaParams,
  ListCamionetasQueryParams,
  UpdateCamionetaBody,
  UpdateCamionetaParams,
} from "@workspace/api-zod";
import { auditoriaTable, camionetasTable, db, type TipoCamioneta } from "@workspace/db";
import { requireSession } from "../middlewares/auth";
import { requierePermiso } from "../lib/permisos";
import { getRequestIp } from "../lib/request";

const router: IRouter = Router();

/** Preserves plate punctuation while making comparisons predictable. */
export function normalizePlacas(placas: string): string {
  return placas.trim().toUpperCase();
}

function presentCamioneta(row: typeof camionetasTable.$inferSelect) {
  return {
    id: row.id,
    nombre: row.nombre,
    placas: row.placas,
    marca: row.marca ?? null,
    modelo: row.modelo ?? null,
    tipo: row.tipo,
    activa: row.activa,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function requiereGestorCamionetas(action: "crear" | "editar") {
  return [
    requierePermiso("camionetas", action),
    (req: Request, res: Response, next: NextFunction) => {
      if (req.auth?.user.rol !== "ADMIN" && req.auth?.user.rol !== "SOPORTE") {
        res.status(403).json({ error: "Solo ADMIN o SOPORTE pueden modificar el catálogo de camionetas." });
        return;
      }
      next();
    },
  ];
}

router.use("/camionetas", requireSession);

router.get("/camionetas", requierePermiso("camionetas", "ver"), async (req, res, next): Promise<void> => {
  try {
    const { activa = "all" } = ListCamionetasQueryParams.parse(req.query);
    const rows = activa === "all"
      ? await db.select().from(camionetasTable).orderBy(camionetasTable.nombre, camionetasTable.id)
      : await db.select().from(camionetasTable)
        .where(eq(camionetasTable.activa, activa === "true"))
        .orderBy(camionetasTable.nombre, camionetasTable.id);
    res.json(rows.map(presentCamioneta));
  } catch (error) {
    next(error);
  }
});

router.post("/camionetas", ...requiereGestorCamionetas("crear"), async (req, res, next): Promise<void> => {
  try {
    const parsed = CreateCamionetaBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Datos de la camioneta inválidos." });
      return;
    }
    const placas = normalizePlacas(parsed.data.placas);
    const created = await db.transaction(async (tx) => {
      const [duplicate] = await tx.select({ id: camionetasTable.id }).from(camionetasTable)
        .where(eq(camionetasTable.placas, placas)).limit(1);
      if (duplicate) throw new Error("DUPLICATE_PLATES");
      const [row] = await tx.insert(camionetasTable).values({
        ...parsed.data,
        placas,
        tipo: parsed.data.tipo as TipoCamioneta,
        marca: parsed.data.marca ?? null,
        modelo: parsed.data.modelo ?? null,
      }).returning();
      await tx.insert(auditoriaTable).values({
        usuarioId: req.auth!.user.id, sitioId: null, accion: "CREAR", entidad: "camionetas",
        entidadId: String(row!.id), datosDespues: presentCamioneta(row!) as Record<string, unknown>, ip: getRequestIp(req),
      });
      return row!;
    });
    res.status(201).json(presentCamioneta(created));
  } catch (error) {
    if (error instanceof Error && (error.message === "DUPLICATE_PLATES" || (error as { code?: string }).code === "23505")) {
      res.status(409).json({ error: "Las placas ya están registradas en el historial de camionetas." });
      return;
    }
    next(error);
  }
});

router.get("/camionetas/:id", requierePermiso("camionetas", "ver"), async (req, res, next): Promise<void> => {
  try {
    const id = GetCamionetaParams.safeParse(req.params);
    if (!id.success) { res.status(400).json({ error: "ID inválido." }); return; }
    const [row] = await db.select().from(camionetasTable).where(eq(camionetasTable.id, id.data.id)).limit(1);
    if (!row) { res.status(404).json({ error: "Camioneta no encontrada." }); return; }
    res.json(presentCamioneta(row));
  } catch (error) { next(error); }
});

router.patch("/camionetas/:id", ...requiereGestorCamionetas("editar"), async (req, res, next): Promise<void> => {
  try {
    const id = UpdateCamionetaParams.safeParse(req.params);
    const parsed = UpdateCamionetaBody.safeParse(req.body);
    if (!id.success || !parsed.success || Object.keys(parsed.data).length === 0) {
      res.status(400).json({ error: "Datos de la camioneta inválidos." }); return;
    }
    const updated = await db.transaction(async (tx) => {
      const [before] = await tx.select().from(camionetasTable).where(eq(camionetasTable.id, id.data.id)).limit(1);
      if (!before) throw new Error("NOT_FOUND");
      const placas = parsed.data.placas === undefined ? undefined : normalizePlacas(parsed.data.placas);
      if (placas !== undefined) {
        const [duplicate] = await tx.select({ id: camionetasTable.id }).from(camionetasTable)
          .where(and(eq(camionetasTable.placas, placas), ne(camionetasTable.id, id.data.id))).limit(1);
        if (duplicate) throw new Error("DUPLICATE_PLATES");
      }
      const [row] = await tx.update(camionetasTable).set({
        ...parsed.data, placas, tipo: parsed.data.tipo as TipoCamioneta | undefined,
        marca: parsed.data.marca === undefined ? undefined : parsed.data.marca ?? null,
        modelo: parsed.data.modelo === undefined ? undefined : parsed.data.modelo ?? null,
        updatedAt: new Date(),
      }).where(eq(camionetasTable.id, id.data.id)).returning();
      await tx.insert(auditoriaTable).values({
        usuarioId: req.auth!.user.id, sitioId: null, accion: "ACTUALIZAR", entidad: "camionetas",
        entidadId: String(id.data.id), datosAntes: presentCamioneta(before) as Record<string, unknown>,
        datosDespues: presentCamioneta(row!) as Record<string, unknown>, ip: getRequestIp(req),
      });
      return row!;
    });
    res.json(presentCamioneta(updated));
  } catch (error) {
    if (error instanceof Error && error.message === "NOT_FOUND") { res.status(404).json({ error: "Camioneta no encontrada." }); return; }
    if (error instanceof Error && (error.message === "DUPLICATE_PLATES" || (error as { code?: string }).code === "23505")) {
      res.status(409).json({ error: "Las placas ya están registradas en el historial de camionetas." }); return;
    }
    next(error);
  }
});

export default router;