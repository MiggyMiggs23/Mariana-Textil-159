import {
  Router,
  type IRouter,
  type NextFunction,
  type Request,
  type Response,
} from "express";
import { eq } from "drizzle-orm";
import { z } from "zod";
import {
  CreateChoferBody,
  GetChoferParams,
  ListChoferesQueryParams,
  UpdateChoferBody,
  UpdateChoferParams,
} from "@workspace/api-zod";
import { auditoriaTable, choferesTable, db } from "@workspace/db";
import { requireSession } from "../middlewares/auth";
import { requierePermiso } from "../lib/permisos";
import { getRequestIp } from "../lib/request";

const router: IRouter = Router();

export function normalizeChoferText(value: string): string {
  return value.trim();
}

const phoneNumber = z.string().trim().min(1).max(32);
const phoneList = z.array(z.object({
  numero: phoneNumber,
  etiqueta: z.string().trim().min(1).max(40).optional(),
})).min(1);
// Trim before validating length. Never coerce numbers (leading zeros matter).
const phoneFields = {
  telefono: phoneNumber,
  telefonos: phoneList.optional(),
};
const consistentPhones = (data: {
  telefono?: string;
  telefonos?: { numero: string; etiqueta?: string }[];
}) => data.telefono === undefined || data.telefonos === undefined ||
  data.telefono === data.telefonos[0]?.numero;
const createBody = CreateChoferBody.extend(phoneFields).refine(consistentPhones, {
  message: "telefono debe coincidir con el primer numero de telefonos.",
});
const updateBody = UpdateChoferBody.extend({
  ...phoneFields,
  telefono: phoneNumber.optional(),
}).refine(consistentPhones, {
  message: "telefono debe coincidir con el primer numero de telefonos.",
});

export function presentChofer(row: typeof choferesTable.$inferSelect) {
  return {
    id: row.id,
    nombreCompleto: row.nombreCompleto,
    telefono: row.telefono,
    telefonos: row.telefonos ?? [{ numero: row.telefono }],
    activo: row.activo,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function requiereGestorChoferes(action: "crear" | "editar") {
  return [
    requierePermiso("choferes", action),
    (req: Request, res: Response, next: NextFunction) => {
      if (req.auth?.user.rol !== "ADMIN" && req.auth?.user.rol !== "SISTEMAS") {
        res
          .status(403)
          .json({
            error:
              "Solo ADMIN o SISTEMAS pueden modificar el catálogo de choferes.",
          });
        return;
      }
      next();
    },
  ];
}

router.use("/choferes", requireSession);

router.get(
  "/choferes",
  requierePermiso("choferes", "ver"),
  async (req, res, next): Promise<void> => {
    try {
      const { activo = "all" } = ListChoferesQueryParams.parse(req.query);
      const rows =
        activo === "all"
          ? await db
              .select()
              .from(choferesTable)
              .orderBy(choferesTable.nombreCompleto, choferesTable.id)
          : await db
              .select()
              .from(choferesTable)
              .where(eq(choferesTable.activo, activo === "true"))
              .orderBy(choferesTable.nombreCompleto, choferesTable.id);
      res.json(rows.map(presentChofer));
    } catch (error) {
      next(error);
    }
  },
);

router.post(
  "/choferes",
  ...requiereGestorChoferes("crear"),
  async (req, res, next): Promise<void> => {
    try {
      const parsed = createBody.safeParse(req.body);
      const nombreCompleto = parsed.success
        ? normalizeChoferText(parsed.data.nombreCompleto)
        : "";
      const telefono = parsed.success
        ? normalizeChoferText(parsed.data.telefono)
        : "";
      if (!parsed.success || !nombreCompleto || !telefono) {
        res.status(400).json({ error: "Datos del chofer inválidos." });
        return;
      }
      const created = await db.transaction(async (tx) => {
        const [row] = await tx
          .insert(choferesTable)
          .values({
            ...parsed.data,
            nombreCompleto,
            telefono,
            telefonos: parsed.data.telefonos ?? [{ numero: telefono }],
          })
          .returning();
        await tx.insert(auditoriaTable).values({
          usuarioId: req.auth!.user.id,
          sitioId: null,
          accion: "CREAR",
          entidad: "choferes",
          entidadId: String(row!.id),
          datosDespues: presentChofer(row!) as Record<string, unknown>,
          ip: getRequestIp(req),
        });
        return row!;
      });
      res.status(201).json(presentChofer(created));
    } catch (error) {
      next(error);
    }
  },
);

router.get(
  "/choferes/:id",
  requierePermiso("choferes", "ver"),
  async (req, res, next): Promise<void> => {
    try {
      const id = GetChoferParams.safeParse(req.params);
      if (!id.success) {
        res.status(400).json({ error: "ID inválido." });
        return;
      }
      const [row] = await db
        .select()
        .from(choferesTable)
        .where(eq(choferesTable.id, id.data.id))
        .limit(1);
      if (!row) {
        res.status(404).json({ error: "Chofer no encontrado." });
        return;
      }
      res.json(presentChofer(row));
    } catch (error) {
      next(error);
    }
  },
);

router.patch(
  "/choferes/:id",
  ...requiereGestorChoferes("editar"),
  async (req, res, next): Promise<void> => {
    try {
      const id = UpdateChoferParams.safeParse(req.params);
      const parsed = updateBody.safeParse(req.body);
      const nombreCompleto =
        parsed.success && parsed.data.nombreCompleto !== undefined
          ? normalizeChoferText(parsed.data.nombreCompleto)
          : undefined;
      const telefono =
        parsed.success && parsed.data.telefono !== undefined
          ? normalizeChoferText(parsed.data.telefono)
          : undefined;
      if (
        !id.success ||
        !parsed.success ||
        Object.keys(parsed.data).length === 0 ||
        nombreCompleto === "" ||
        telefono === ""
      ) {
        res.status(400).json({ error: "Datos del chofer inválidos." });
        return;
      }
      const updated = await db.transaction(async (tx) => {
        const [before] = await tx
          .select()
          .from(choferesTable)
          .where(eq(choferesTable.id, id.data.id))
          .limit(1)
          .for("update");
        if (!before) throw new Error("NOT_FOUND");
        // Resolve legacy writes only after acquiring the row lock, so another
        // writer's extra phones/label cannot be lost to a stale read.
        const telefonos = parsed.data.telefonos ?? (
          telefono === undefined ? undefined : [
            { ...presentChofer(before).telefonos[0]!, numero: telefono },
            ...presentChofer(before).telefonos.slice(1),
          ]
        );
        const [row] = await tx
          .update(choferesTable)
          .set({
            ...parsed.data,
            nombreCompleto,
            telefono: telefonos?.[0]?.numero,
            telefonos,
            updatedAt: new Date(),
          })
          .where(eq(choferesTable.id, id.data.id))
          .returning();
        await tx.insert(auditoriaTable).values({
          usuarioId: req.auth!.user.id,
          sitioId: null,
          accion: "ACTUALIZAR",
          entidad: "choferes",
          entidadId: String(id.data.id),
          datosAntes: presentChofer(before) as Record<string, unknown>,
          datosDespues: presentChofer(row!) as Record<string, unknown>,
          ip: getRequestIp(req),
        });
        return row!;
      });
      res.json(presentChofer(updated));
    } catch (error) {
      if (error instanceof Error && error.message === "NOT_FOUND") {
        res.status(404).json({ error: "Chofer no encontrado." });
        return;
      }
      next(error);
    }
  },
);

export default router;
