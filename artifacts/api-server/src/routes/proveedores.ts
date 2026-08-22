import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import {
  CreateProveedorBody,
  CreateProveedorResponse,
  GetProveedorParams,
  GetProveedorResponse,
  ListProveedoresResponse,
  UpdateProveedorBody,
  UpdateProveedorParams,
  UpdateProveedorResponse,
} from "@workspace/api-zod";
import {
  auditoriaTable,
  db,
  proveedoresTable,
  type TipoProveedor,
  type Moneda,
} from "@workspace/db";
import { requireRole, requireSession } from "../middlewares/auth";
import { getRequestIp } from "../lib/request";

const router: IRouter = Router();

const ALLOWED_ROLES = ["ADMIN", "INVENTARIOS", "BODEGA"] as const;

router.use("/proveedores", requireSession, requireRole(...ALLOWED_ROLES));

// ── helpers ────────────────────────────────────────────────────────────────

function presentProveedor(row: typeof proveedoresTable.$inferSelect) {
  return {
    id: row.id,
    nombre: row.nombre,
    tipo: row.tipo,
    monedaDefault: row.monedaDefault,
    contactoNombre: row.contactoNombre,
    telefono: row.telefono,
    correo: row.correo,
    pais: row.pais,
    notas: row.notas,
    activo: row.activo,
    createdAt: row.createdAt,
  };
}

// ── list ───────────────────────────────────────────────────────────────────

router.get("/proveedores", async (_req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(proveedoresTable)
    .orderBy(proveedoresTable.nombre);
  res.json(ListProveedoresResponse.parse(rows.map(presentProveedor)));
});

// ── create ─────────────────────────────────────────────────────────────────

router.post("/proveedores", async (req, res): Promise<void> => {
  const parsed = CreateProveedorBody.safeParse(req.body);
  if (!parsed.success) {
    req.log.warn({ err: parsed.error.message }, "Datos del proveedor inválidos");
    res.status(400).json({ error: "Datos del proveedor inválidos." });
    return;
  }

  const created = await db.transaction(async (tx) => {
    const [proveedor] = await tx
      .insert(proveedoresTable)
      .values({
        nombre: parsed.data.nombre.trim(),
        tipo: parsed.data.tipo as TipoProveedor,
        monedaDefault: (parsed.data.monedaDefault ?? "MXN") as Moneda,
        contactoNombre: parsed.data.contactoNombre ?? null,
        telefono: parsed.data.telefono ?? null,
        correo: parsed.data.correo ?? null,
        pais: parsed.data.pais ?? null,
        notas: parsed.data.notas ?? null,
      })
      .returning();
    await tx.insert(auditoriaTable).values({
      usuarioId: req.auth!.user.id,
      accion: "CREAR",
      entidad: "proveedores",
      entidadId: String(proveedor!.id),
      datosDespues: { ...proveedor! } as Record<string, unknown>,
      ip: getRequestIp(req),
    });
    return proveedor!;
  });

  res.status(201).json(CreateProveedorResponse.parse(presentProveedor(created)));
});

// ── get detail ─────────────────────────────────────────────────────────────

router.get("/proveedores/:id", async (req, res): Promise<void> => {
  const params = GetProveedorParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "ID inválido." });
    return;
  }

  const [proveedor] = await db
    .select()
    .from(proveedoresTable)
    .where(eq(proveedoresTable.id, params.data.id))
    .limit(1);

  if (!proveedor) {
    res.status(404).json({ error: "Proveedor no encontrado." });
    return;
  }

  res.json(GetProveedorResponse.parse(presentProveedor(proveedor)));
});

// ── update ─────────────────────────────────────────────────────────────────

router.patch("/proveedores/:id", async (req, res): Promise<void> => {
  const params = UpdateProveedorParams.safeParse(req.params);
  const body = UpdateProveedorBody.safeParse(req.body);
  if (!params.success || !body.success || Object.keys(body.data).length === 0) {
    res.status(400).json({ error: "Datos del proveedor inválidos." });
    return;
  }

  const [before] = await db
    .select()
    .from(proveedoresTable)
    .where(eq(proveedoresTable.id, params.data.id))
    .limit(1);

  if (!before) {
    res.status(404).json({ error: "Proveedor no encontrado." });
    return;
  }

  // Only ADMIN may change activo
  if (body.data.activo !== undefined && req.auth!.user.rol !== "ADMIN") {
    res.status(403).json({
      error: "Solo ADMIN puede activar/desactivar proveedores.",
    });
    return;
  }

  const updates: {
    nombre?: string;
    tipo?: TipoProveedor;
    monedaDefault?: Moneda;
    contactoNombre?: string | null;
    telefono?: string | null;
    correo?: string | null;
    pais?: string | null;
    notas?: string | null;
    activo?: boolean;
  } = {};

  if (body.data.nombre !== undefined) updates.nombre = body.data.nombre.trim();
  if (body.data.tipo !== undefined) updates.tipo = body.data.tipo as TipoProveedor;
  if (body.data.monedaDefault !== undefined)
    updates.monedaDefault = body.data.monedaDefault as Moneda;
  if ("contactoNombre" in body.data)
    updates.contactoNombre = body.data.contactoNombre ?? null;
  if ("telefono" in body.data) updates.telefono = body.data.telefono ?? null;
  if ("correo" in body.data) updates.correo = body.data.correo ?? null;
  if ("pais" in body.data) updates.pais = body.data.pais ?? null;
  if ("notas" in body.data) updates.notas = body.data.notas ?? null;
  if (body.data.activo !== undefined) updates.activo = body.data.activo;

  const updated = await db.transaction(async (tx) => {
    const [proveedor] = await tx
      .update(proveedoresTable)
      .set(updates)
      .where(eq(proveedoresTable.id, params.data.id))
      .returning();
    await tx.insert(auditoriaTable).values({
      usuarioId: req.auth!.user.id,
      accion: "ACTUALIZAR",
      entidad: "proveedores",
      entidadId: String(params.data.id),
      datosAntes: { ...before } as Record<string, unknown>,
      datosDespues: { ...proveedor! } as Record<string, unknown>,
      ip: getRequestIp(req),
    });
    return proveedor!;
  });

  res.json(UpdateProveedorResponse.parse(presentProveedor(updated)));
});

export default router;
