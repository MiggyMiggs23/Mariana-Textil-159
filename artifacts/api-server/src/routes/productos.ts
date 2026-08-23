import { Router, type IRouter } from "express";
import { and, eq, ilike, ne, or, sql } from "drizzle-orm";
import {
  CreateProductoBody,
  CreateProductoResponse,
  ConfirmImportProductosBody,
  ConfirmImportProductosResponse,
  GetProductoParams,
  GetProductoResponse,
  ListProductosResponse,
  PreviewImportProductosBody,
  PreviewImportProductosResponse,
  UpdateProductoBody,
  UpdateProductoParams,
  UpdateProductoResponse,
} from "@workspace/api-zod";
import {
  auditoriaTable,
  db,
  productosTable,
  ubicacionesTable,
  type UnidadProducto,
} from "@workspace/db";
import { generateBaseSku, generateSku } from "@workspace/db/sku";
import { requireSession } from "../middlewares/auth";
import { requierePermiso } from "../lib/permisos";
import { getRequestIp } from "../lib/request";
import { omitTerminalSensitiveFields } from "../lib/sensitive-data";
import {
  parseFileBase64,
  buildPreview,
  type PreviewRow,
} from "../lib/catalog-import";

const router: IRouter = Router();

router.use("/productos", requireSession);

// ── advisory locking ─────────────────────────────────────────────────────────
// A single application-defined key namespacing the product SKU/catalog. All
// operations that allocate or mutate SKUs / variant uniqueness acquire the same
// transaction-scoped advisory lock so concurrent transactions serialize.
// The key is arbitrary but constant across the process; 0x50524f44 = "PROD".
const PRODUCT_CATALOG_LOCK_KEY = 0x50524f44;

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

async function acquireCatalogLock(tx: Tx): Promise<void> {
  await tx.execute(sql`SELECT pg_advisory_xact_lock(${PRODUCT_CATALOG_LOCK_KEY})`);
}

// ── normalization ──────────────────────────────────────────────────────────
// Title-case: capitalize first character, lowercase the rest, collapse whitespace.
// Accent removal is done only for SKU generation, not for stored values.

function normalizeVariantText(s: string): string {
  const trimmed = s.trim().replace(/\s+/g, " ");
  if (!trimmed) return trimmed;
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
}

/**
 * Normalize a custom SKU input: uppercase, keep alphanumeric and hyphens only,
 * strip accents/spaces/special chars. Reject if result is empty.
 */
function normalizeCustomSku(raw: string): string | null {
  const normalized = raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, "")
    .trim();
  return normalized.length > 0 ? normalized : null;
}

// ── helpers ────────────────────────────────────────────────────────────────

/** Fetch the 7 real TIENDA/BODEGA location rows from DB. */
async function getRealLocations() {
  return db
    .select({ id: ubicacionesTable.id, nombre: ubicacionesTable.nombre })
    .from(ubicacionesTable)
    .where(
      or(
        eq(ubicacionesTable.tipo, "TIENDA"),
        eq(ubicacionesTable.tipo, "BODEGA"),
      ),
    )
    .orderBy(ubicacionesTable.id);
}

function emptyInventario(
  locations: { id: number; nombre: string }[],
) {
  return locations.map((loc) => ({
    ubicacionId: loc.id,
    nombre: loc.nombre,
    rollos: 0,
    cantidad: "0.000",
  }));
}

function presentProducto(row: typeof productosTable.$inferSelect) {
  return {
    id: row.id,
    sku: row.sku,
    tela: row.tela,
    color: row.color,
    unidad: row.unidad,
    precioSugerido: row.precioSugerido,
    notas: row.notas,
    activo: row.activo,
    rollos: 0,
    cantidad: "0.000",
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function presentProductoDetail(
  row: typeof productosTable.$inferSelect,
  locations: { id: number; nombre: string }[],
) {
  return {
    ...presentProducto(row),
    skuBloqueado: false,
    unidadBloqueada: false,
    inventarioPorUbicacion: emptyInventario(locations),
  };
}

// ── list ───────────────────────────────────────────────────────────────────

router.get("/productos", requierePermiso("productos", "ver"), async (req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(productosTable)
    .orderBy(productosTable.tela, productosTable.color);
  const response = ListProductosResponse.parse(rows.map(presentProducto));
  res.json(
    omitTerminalSensitiveFields(
      response,
      req.auth!.user.rol === "TERMINAL",
    ),
  );
});

// ── create (ADMIN only) ────────────────────────────────────────────────────

router.post(
  "/productos",
  requierePermiso("productos", "crear"),
  async (req, res): Promise<void> => {
    const parsed = CreateProductoBody.safeParse(req.body);
    if (!parsed.success) {
      req.log.warn({ err: parsed.error.message }, "Datos del producto inválidos");
      res.status(400).json({ error: "Datos del producto inválidos." });
      return;
    }

    const tela = normalizeVariantText(parsed.data.tela);
    const color = normalizeVariantText(parsed.data.color);

    // Validate custom SKU (if provided) before opening the transaction.
    let customSku: string | undefined;
    if (parsed.data.sku) {
      const cleaned = normalizeCustomSku(parsed.data.sku);
      if (!cleaned) {
        res.status(400).json({ error: "El SKU personalizado no es válido." });
        return;
      }
      customSku = cleaned;
    }

    try {
      const created = await db.transaction(async (tx) => {
        // Serialize SKU allocation / variant uniqueness across concurrent txns.
        await acquireCatalogLock(tx);

        let sku: string;
        if (customSku) {
          // Custom SKU: allocated under the lock; unique constraint is final guard.
          sku = customSku;
        } else {
          // Auto SKU: look up existing SKUs and generate collision-safe value,
          // all inside the lock so no other txn can allocate the same value.
          const baseSku = generateBaseSku(tela, color);
          const existingRows = await tx
            .select({ sku: productosTable.sku })
            .from(productosTable)
            .where(ilike(productosTable.sku, `${baseSku}%`));
          const existingSkus = new Set(existingRows.map((r) => r.sku));
          sku = generateSku(tela, color, existingSkus);
        }

        const [producto] = await tx
          .insert(productosTable)
          .values({
            sku,
            tela,
            color,
            unidad: parsed.data.unidad as UnidadProducto,
            precioSugerido: parsed.data.precioSugerido,
            notas: parsed.data.notas ?? null,
          })
          .returning();
        await tx.insert(auditoriaTable).values({
          usuarioId: req.auth!.user.id,
          accion: "CREAR",
          entidad: "productos",
          entidadId: String(producto!.id),
          datosDespues: { ...producto! } as Record<string, unknown>,
          ip: getRequestIp(req),
        });
        return producto!;
      });
      res.status(201).json(CreateProductoResponse.parse(presentProducto(created)));
    } catch (error) {
      if ((error as { code?: string }).code === "23505") {
        res.status(400).json({
          error:
            "Ya existe un producto con ese SKU o con la misma combinación tela/color.",
        });
        return;
      }
      throw error;
    }
  },
);

// ── import preview (ADMIN only) ────────────────────────────────────────────

router.post(
  "/productos/import/preview",
  requierePermiso("productos", "crear"),
  async (req, res): Promise<void> => {
    const parsed = PreviewImportProductosBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Datos de importación inválidos." });
      return;
    }

    let sheet;
    try {
      sheet = await parseFileBase64(parsed.data.fileName, parsed.data.content);
    } catch {
      res.status(400).json({ error: "No se pudo leer el archivo." });
      return;
    }

    if (sheet.error) {
      res.status(400).json({ error: sheet.error });
      return;
    }

    const existingRows = await db
      .select({
        tela: productosTable.tela,
        color: productosTable.color,
        sku: productosTable.sku,
      })
      .from(productosTable);

    const existingVariants = new Set(
      existingRows.map(
        (r) => `${r.tela.toUpperCase()}|${r.color.toUpperCase()}`,
      ),
    );
    const existingSkus = new Set(existingRows.map((r) => r.sku));

    let preview: PreviewRow[];
    try {
      preview = buildPreview({
        headers: sheet.headers,
        rows: sheet.rows,
        existingVariants,
        existingSkus,
      });
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
      return;
    }

    res.json(PreviewImportProductosResponse.parse(preview));
  },
);

// ── import confirm (ADMIN only) ────────────────────────────────────────────

router.post(
  "/productos/import/confirm",
  requierePermiso("productos", "crear"),
  async (req, res): Promise<void> => {
    const parsed = ConfirmImportProductosBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Datos de importación inválidos." });
      return;
    }

    // Server-authoritative: re-parse the uploaded file. Never trust client rows.
    let sheet;
    try {
      sheet = await parseFileBase64(parsed.data.fileName, parsed.data.content);
    } catch {
      res.status(400).json({ error: "No se pudo leer el archivo." });
      return;
    }

    if (sheet.error) {
      res.status(400).json({ error: sheet.error });
      return;
    }

    let result: { insertados: number; duplicados: number; errores: number };
    try {
      result = await db.transaction(async (tx) => {
        // Serialize catalog SKU/variant allocation across concurrent imports.
        await acquireCatalogLock(tx);

        // Load current variants/SKUs *inside* the lock for authoritative state.
        const existingRows = await tx
          .select({
            tela: productosTable.tela,
            color: productosTable.color,
            sku: productosTable.sku,
          })
          .from(productosTable);

        const existingVariants = new Set(
          existingRows.map(
            (r) => `${r.tela.toUpperCase()}|${r.color.toUpperCase()}`,
          ),
        );
        const existingSkus = new Set(existingRows.map((r) => r.sku));

        // Build the authoritative preview from the freshly parsed sheet.
        const preview = buildPreview({
          headers: sheet.headers,
          rows: sheet.rows,
          existingVariants,
          existingSkus,
        });

        const nuevoRows = preview.filter((r) => r.estado === "NUEVO");
        const duplicados = preview.filter(
          (r) => r.estado === "DUPLICADO",
        ).length;
        const errores = preview.filter((r) => r.estado === "ERROR").length;

        // Track allocations made within this transaction for intra-batch safety.
        const txVariants = new Set(existingVariants);
        const txSkus = new Set(existingSkus);
        let insertados = 0;

        for (const row of nuevoRows) {
          const variantKey = `${row.tela.toUpperCase()}|${row.color.toUpperCase()}`;
          if (txVariants.has(variantKey)) continue;

          // buildPreview already produced a collision-safe SKU against existing
          // state; re-check against intra-transaction allocations as a guard.
          let sku = row.sku;
          if (txSkus.has(sku)) {
            const base = sku.replace(/\d+$/, "");
            let counter = 2;
            while (txSkus.has(`${base}${counter}`)) counter++;
            sku = `${base}${counter}`;
          }

          const [inserted] = await tx
            .insert(productosTable)
            .values({
              sku,
              tela: row.tela,
              color: row.color,
              unidad: row.unidad as UnidadProducto,
              precioSugerido: row.precioSugerido,
              notas: row.notas ?? null,
            })
            .onConflictDoNothing()
            .returning();

          if (inserted) {
            txVariants.add(variantKey);
            txSkus.add(sku);
            insertados++;
          }
        }

        // Always write exactly one audit record, even when insertados is 0.
        await tx.insert(auditoriaTable).values({
          usuarioId: req.auth!.user.id,
          accion: "IMPORTAR",
          entidad: "productos",
          entidadId: null,
          datosDespues: {
            fileName: parsed.data.fileName,
            insertados,
            duplicados,
            errores,
          } as Record<string, unknown>,
          ip: getRequestIp(req),
        });

        return { insertados, duplicados, errores };
      });
    } catch (err) {
      // buildPreview throws on missing/invalid headers — mirror preview's 400.
      res.status(400).json({ error: (err as Error).message });
      return;
    }

    res.json(ConfirmImportProductosResponse.parse(result));
  },
);

// ── get detail ─────────────────────────────────────────────────────────────

router.get("/productos/:id", requierePermiso("productos", "ver"), async (req, res): Promise<void> => {
  const params = GetProductoParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "ID inválido." });
    return;
  }

  const [producto] = await db
    .select()
    .from(productosTable)
    .where(eq(productosTable.id, params.data.id))
    .limit(1);

  if (!producto) {
    res.status(404).json({ error: "Producto no encontrado." });
    return;
  }

  const locations = await getRealLocations();
  const response = GetProductoResponse.parse(
    presentProductoDetail(producto, locations),
  );
  res.json(
    omitTerminalSensitiveFields(
      response,
      req.auth!.user.rol === "TERMINAL",
    ),
  );
});

// ── update (ADMIN only) ────────────────────────────────────────────────────

router.patch(
  "/productos/:id",
  requierePermiso("productos", "editar"),
  async (req, res): Promise<void> => {
    const params = UpdateProductoParams.safeParse(req.params);
    const body = UpdateProductoBody.safeParse(req.body);
    if (
      !params.success ||
      !body.success ||
      Object.keys(body.data).length === 0
    ) {
      res.status(400).json({ error: "Datos del producto inválidos." });
      return;
    }

    const [before] = await db
      .select()
      .from(productosTable)
      .where(eq(productosTable.id, params.data.id))
      .limit(1);

    if (!before) {
      res.status(404).json({ error: "Producto no encontrado." });
      return;
    }

    // Normalize tela/color if provided
    const newTela =
      body.data.tela !== undefined
        ? normalizeVariantText(body.data.tela)
        : undefined;
    const newColor =
      body.data.color !== undefined
        ? normalizeVariantText(body.data.color)
        : undefined;

    // Validate and normalize custom SKU if provided (cheap check before txn).
    let newSku: string | undefined;
    if (body.data.sku !== undefined) {
      const cleaned = normalizeCustomSku(body.data.sku);
      if (!cleaned) {
        res.status(400).json({ error: "El SKU personalizado no es válido." });
        return;
      }
      newSku = cleaned;
    }

    // Whether this update touches identity/allocation-sensitive fields.
    const touchesCatalogNamespace =
      newSku !== undefined ||
      newTela !== undefined ||
      newColor !== undefined ||
      body.data.unidad !== undefined;

    const updates: {
      sku?: string;
      tela?: string;
      color?: string;
      unidad?: UnidadProducto;
      precioSugerido?: string;
      notas?: string | null;
      activo?: boolean;
    } = {};

    if (newSku !== undefined) updates.sku = newSku;
    if (newTela !== undefined) updates.tela = newTela;
    if (newColor !== undefined) updates.color = newColor;
    if (body.data.unidad !== undefined)
      updates.unidad = body.data.unidad as UnidadProducto;
    if (body.data.precioSugerido !== undefined)
      updates.precioSugerido = body.data.precioSugerido;
    if ("notas" in body.data) updates.notas = body.data.notas ?? null;
    if (body.data.activo !== undefined) updates.activo = body.data.activo;

    try {
      const outcome = await db.transaction(async (tx) => {
        // If SKU/tela/color/unidad change, serialize against concurrent
        // allocation/mutation by acquiring the shared catalog advisory lock.
        if (touchesCatalogNamespace) {
          await acquireCatalogLock(tx);
        }

        // Enforce variant uniqueness (excluding this product) under the lock.
        if (newTela !== undefined || newColor !== undefined) {
          const checkTela = newTela ?? before.tela;
          const checkColor = newColor ?? before.color;
          const [conflict] = await tx
            .select({ id: productosTable.id })
            .from(productosTable)
            .where(
              and(
                eq(productosTable.tela, checkTela),
                eq(productosTable.color, checkColor),
                ne(productosTable.id, params.data.id),
              ),
            )
            .limit(1);
          if (conflict) {
            return {
              error: `Ya existe un producto con la combinación tela="${checkTela}" / color="${checkColor}".`,
            } as const;
          }
        }

        // Enforce SKU uniqueness (excluding this product) under the lock.
        if (newSku !== undefined) {
          const [skuConflict] = await tx
            .select({ id: productosTable.id })
            .from(productosTable)
            .where(
              and(
                eq(productosTable.sku, newSku),
                ne(productosTable.id, params.data.id),
              ),
            )
            .limit(1);
          if (skuConflict) {
            return {
              error: `El SKU "${newSku}" ya está en uso por otro producto.`,
            } as const;
          }
        }

        const [producto] = await tx
          .update(productosTable)
          .set(updates)
          .where(eq(productosTable.id, params.data.id))
          .returning();
        await tx.insert(auditoriaTable).values({
          usuarioId: req.auth!.user.id,
          accion: "ACTUALIZAR",
          entidad: "productos",
          entidadId: String(params.data.id),
          datosAntes: { ...before } as Record<string, unknown>,
          datosDespues: { ...producto! } as Record<string, unknown>,
          ip: getRequestIp(req),
        });
        return { producto: producto! } as const;
      });

      if ("error" in outcome) {
        res.status(400).json({ error: outcome.error });
        return;
      }

      res.json(UpdateProductoResponse.parse(presentProducto(outcome.producto)));
    } catch (error) {
      // Unique DB constraints remain the final protection.
      if ((error as { code?: string }).code === "23505") {
        res.status(400).json({
          error:
            "Ya existe un producto con ese SKU o con la misma combinación tela/color.",
        });
        return;
      }
      throw error;
    }
  },
);

export default router;
