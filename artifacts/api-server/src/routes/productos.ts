import { Router, type IRouter } from "express";
import { and, eq, ilike, inArray, ne, or, sql } from "drizzle-orm";
import {
  CreateProductoBody,
  CreateProductoResponse,
  ConfirmImportProductosBody,
  ConfirmImportProductosResponse,
  GetProductoParams,
  GetProductoResponse,
  ListProductosQueryParams,
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
  existenciasTable,
  productosTable,
  pisosTable,
  rollosTable,
  ubicacionesTable,
  type UnidadProducto,
} from "@workspace/db";
import {
  ADVISORY_LOCK_NAMESPACES,
  transactionAdvisoryLock,
} from "@workspace/db/advisory-locks";
import {
  generateBaseSku,
  generateSku,
} from "@workspace/db/sku";
import { requireSession } from "../middlewares/auth";
import { requierePermiso } from "../lib/permisos";
import { getRequestIp } from "../lib/request";
import { omitTerminalSensitiveFields } from "../lib/sensitive-data";
import { isPostgresUniqueViolation } from "../lib/postgres-errors";
import { resolveReadScope } from "./inventario";
import {
  parseFileBase64,
  buildPreview,
  type PreviewRow,
} from "../lib/catalog-import";
import {
  canEditProductColorHex,
  normalizeProductColorHex,
} from "../lib/product-color";

const router: IRouter = Router();

router.use("/productos", requireSession);

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type ProductSkuExecutor = Pick<typeof db, "execute">;

class ProductSkuUnavailableError extends Error {}

async function acquireCatalogLock(tx: Tx): Promise<void> {
  await transactionAdvisoryLock(
    tx,
    ADVISORY_LOCK_NAMESPACES.PRODUCT_CATALOG,
  );
}

async function loadUnavailableProductSkus(
  executor: ProductSkuExecutor,
): Promise<Set<string>> {
  const result = await executor.execute(sql`
    SELECT upper(sku)::text AS sku
    FROM productos
    UNION
    SELECT upper(datos_antes->>'sku')::text AS sku
    FROM auditoria
    WHERE entidad = 'productos'
      AND accion = 'PURGAR'
      AND datos_antes->>'sku' IS NOT NULL
  `);
  return new Set(
    (result.rows as Array<{ sku: string }>).map((row) => row.sku),
  );
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

/** Fetch real, active inventory locations, constrained by the resolved read scope. */
async function getRealLocations(ubicacionId?: number | null) {
  const locations = await db
    .select({ id: ubicacionesTable.id, nombre: ubicacionesTable.nombre })
    .from(ubicacionesTable)
    .where(
      and(
        eq(ubicacionesTable.activa, true),
        or(
          eq(ubicacionesTable.tipo, "TIENDA"),
          eq(ubicacionesTable.tipo, "BODEGA"),
        ),
        ubicacionId == null
          ? undefined
          : eq(ubicacionesTable.id, ubicacionId),
      ),
    )
    .orderBy(ubicacionesTable.id);
  return locations;
}

type ExistenciasTotals = {
  rollos: number;
  cantidad: string;
  sitiosConExistencia: number;
};

const EMPTY_EXISTENCIAS_TOTALS: ExistenciasTotals = {
  rollos: 0,
  cantidad: "0.000",
  sitiosConExistencia: 0,
};

/**
 * A product unit gives meaning to every stored quantity and unit price. Once a
 * product is referenced anywhere operationally, changing it would reinterpret
 * that immutable history. Keep this deliberately broader than current stock:
 * depleted rolls and completed tickets must block it too.
 */
async function getUnidadBloqueadaProductoIds(
  executor: Pick<typeof db, "execute">,
  productoIds?: number[],
): Promise<Set<number>> {
  const productFilter = productoIds?.length
    ? sql`WHERE producto_id IN (${sql.join(productoIds.map((id) => sql`${id}`), sql`, `)})`
    : sql``;
  const rows = await executor.execute<{ producto_id: number }>(sql`
    SELECT DISTINCT producto_id
    FROM (
      SELECT producto_id FROM rollos ${productFilter}
      UNION ALL SELECT producto_id FROM movimientos ${productFilter}
      UNION ALL SELECT producto_id FROM ticket_lineas ${productFilter}
      UNION ALL SELECT producto_id FROM salida_lineas ${productFilter}
      UNION ALL SELECT producto_id FROM contenedor_lineas ${productFilter}
      UNION ALL SELECT producto_id FROM precio_historial ${productFilter}
      UNION ALL SELECT producto_id FROM existencias ${productFilter}
    ) AS referencias_historicas
  `);
  return new Set(rows.rows.map((row) => Number(row.producto_id)));
}

async function getCacheByProducto(
  ubicacionIds: number[],
  productoId?: number,
): Promise<Map<number, ExistenciasTotals & { porUbicacion: Map<number, { rollos: number; cantidad: string }> }>> {
  const totals = new Map<number, ExistenciasTotals & {
    porUbicacion: Map<number, { rollos: number; cantidad: string }>;
  }>();
  if (!ubicacionIds.length) return totals;
  const conditions = [inArray(existenciasTable.ubicacionId, ubicacionIds)];
  if (productoId !== undefined) conditions.push(eq(existenciasTable.productoId, productoId));
  const rows = await db
    .select({
      productoId: existenciasTable.productoId,
      ubicacionId: existenciasTable.ubicacionId,
      rollos: existenciasTable.rollosCount,
      cantidad: existenciasTable.cantidadTotal,
    })
    .from(existenciasTable)
    .where(and(...conditions));
  for (const row of rows) {
    const current = totals.get(row.productoId) ?? {
      rollos: 0,
      cantidad: "0.000",
      sitiosConExistencia: 0,
      porUbicacion: new Map(),
    };
    const cantidad = Number(row.cantidad);
    current.rollos += row.rollos;
    current.cantidad = (Number(current.cantidad) + cantidad).toFixed(3);
    if (row.rollos > 0 || cantidad > 0) current.sitiosConExistencia += 1;
    current.porUbicacion.set(row.ubicacionId, {
      rollos: row.rollos,
      cantidad: cantidad.toFixed(3),
    });
    totals.set(row.productoId, current);
  }
  return totals;
}

function presentProducto(
  row: typeof productosTable.$inferSelect,
  totals: ExistenciasTotals,
  unidadBloqueada: boolean,
) {
  return {
    id: row.id,
    sku: row.sku,
    tela: row.tela,
    color: row.color,
    colorHex: row.colorHex,
    anchoCm: row.anchoCm === null ? null : Number(row.anchoCm),
    composicion: row.composicion,
    gramajeGm2: row.gramajeGm2 === null ? null : Number(row.gramajeGm2),
    unidad: row.unidad,
    seVendePorMetro: row.seVendePorMetro,
    precioSugerido: row.precioSugerido,
    notas: row.notas,
    activo: row.activo,
    unidadBloqueada,
    ...totals,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function presentProductoDetail(
  row: typeof productosTable.$inferSelect,
  locations: { id: number; nombre: string }[],
  totals: ExistenciasTotals & { porUbicacion: Map<number, { rollos: number; cantidad: string }> },
  rollosDisponibles: {
    id: number; serie: string; ubicacionId: number; ubicacionNombre: string;
    cantidad: string; estado: "DISPONIBLE"; pisoId: number | null; nombrePiso: string | null;
  }[],
  compras: {
    entrada_id: number;
    folio: number;
    fecha: Date | string;
    proveedor_id: number | null;
    proveedor_nombre: string | null;
    total_costo: string;
    total_cantidad: string;
    total_rollos: string;
  }[],
  unidadBloqueada: boolean,
) {
  const comprasHistorial = compras.map((compra) => {
    const totalCosto = parseFloat(compra.total_costo);
    const totalCantidad = parseFloat(compra.total_cantidad);
    const totalRollos = parseInt(compra.total_rollos, 10);
    return {
      entradaId: compra.entrada_id,
      folio: compra.folio,
      fecha:
        compra.fecha instanceof Date
          ? compra.fecha.toISOString()
          : new Date(compra.fecha).toISOString(),
      proveedorId: compra.proveedor_id,
      proveedorNombre: compra.proveedor_nombre,
      totalCosto: totalCosto.toFixed(2),
      totalCantidad: totalCantidad.toFixed(3),
      totalRollos,
      costoPorUnidad:
        totalCantidad > 0 ? (totalCosto / totalCantidad).toFixed(2) : null,
    };
  });
  const totalCosto = comprasHistorial.reduce(
    (sum, compra) => sum + parseFloat(compra.totalCosto),
    0,
  );
  const totalCantidad = comprasHistorial.reduce(
    (sum, compra) => sum + parseFloat(compra.totalCantidad),
    0,
  );
  const totalRollos = comprasHistorial.reduce(
    (sum, compra) => sum + compra.totalRollos,
    0,
  );
  return {
    ...presentProducto(row, totals, unidadBloqueada),
    skuBloqueado: false,
    unidadBloqueada,
    inventarioPorUbicacion: locations.map((location) => ({
      ubicacionId: location.id,
      nombre: location.nombre,
      rollos: totals.porUbicacion.get(location.id)?.rollos ?? 0,
      cantidad: totals.porUbicacion.get(location.id)?.cantidad ?? "0.000",
    })),
    rollosDisponibles,
    comprasResumen: {
      totalCosto: totalCosto.toFixed(2),
      totalCantidad: totalCantidad.toFixed(3),
      totalRollos,
      costoPorUnidad:
        totalCantidad > 0 ? (totalCosto / totalCantidad).toFixed(2) : null,
    },
    comprasHistorial,
  };
}

// ── list ───────────────────────────────────────────────────────────────────

router.get("/productos", requierePermiso("productos", "ver"), async (req, res): Promise<void> => {
  const query = ListProductosQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: "Filtros de productos inválidos." });
    return;
  }
  const { ubicacionId, scopeError } = resolveReadScope(req.auth!, query.data.ubicacionId);
  if (scopeError) {
    res.status(403).json({ error: scopeError });
    return;
  }
  const locations = await getRealLocations(ubicacionId);
  const totalsByProducto = await getCacheByProducto(locations.map((location) => location.id));
  const rows = await db
    .select()
    .from(productosTable)
    .orderBy(productosTable.tela, productosTable.color);
  const unidadBloqueadaIds = await getUnidadBloqueadaProductoIds(
    db,
    rows.map((row) => row.id),
  );
  const response = ListProductosResponse.parse(rows
    .map((row) => presentProducto(
      row,
      totalsByProducto.get(row.id) ?? EMPTY_EXISTENCIAS_TOTALS,
      unidadBloqueadaIds.has(row.id),
    ))
    .filter((row) => query.data.existencia === "TODOS"
      || (query.data.existencia === "CON_EXISTENCIA" && row.sitiosConExistencia > 0)
      || (query.data.existencia === "AGOTADOS" && row.sitiosConExistencia === 0)));
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

    const tela = parsed.data.tela.trim();
    const color = parsed.data.color.trim();
    if ("colorHex" in parsed.data && !canEditProductColorHex(req.auth!.user.rol)) {
      res.status(403).json({
        error: "Solo ADMIN puede capturar el color hexadecimal del producto.",
      });
      return;
    }
    const colorHex = parsed.data.colorHex === undefined
      ? undefined
      : normalizeProductColorHex(parsed.data.colorHex);

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

        const [variantConflict] = await tx
          .select({ id: productosTable.id })
          .from(productosTable)
          .where(
            and(
              sql`lower(${productosTable.tela}) = lower(${tela})`,
              sql`lower(${productosTable.color}) = lower(${color})`,
            ),
          )
          .limit(1);
        if (variantConflict) {
          throw new ProductSkuUnavailableError(
            `Ya existe un producto con la combinación tela="${tela}" / color="${color}".`,
          );
        }

        const unavailableSkus = await loadUnavailableProductSkus(tx);
        let sku: string;
        if (customSku) {
          if (unavailableSkus.has(customSku)) {
            throw new ProductSkuUnavailableError(
              `El SKU "${customSku}" ya está en uso o quedó reservado por un producto borrado.`,
            );
          }
          sku = customSku;
        } else {
          // Auto SKU: look up existing SKUs and generate collision-safe value,
          // all inside the lock so no other txn can allocate the same value.
          const baseSku = generateBaseSku(tela, color);
          sku = generateSku(tela, color, unavailableSkus);
        }

        const [producto] = await tx
          .insert(productosTable)
          .values({
            sku,
            tela,
            color,
            colorHex,
            anchoCm: parsed.data.anchoCm == null ? null : String(parsed.data.anchoCm),
            composicion: parsed.data.composicion ?? null,
            gramajeGm2: parsed.data.gramajeGm2 == null ? null : String(parsed.data.gramajeGm2),
            unidad: parsed.data.unidad as UnidadProducto,
            precioSugerido: parsed.data.precioSugerido ?? null,
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
      res.status(201).json(
        CreateProductoResponse.parse(
          presentProducto(created, EMPTY_EXISTENCIAS_TOTALS, false),
        ),
      );
    } catch (error) {
      if (error instanceof ProductSkuUnavailableError) {
        res.status(400).json({ error: error.message });
        return;
      }
      if (isPostgresUniqueViolation(error)) {
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

    const [existingRows, existingSkus] = await Promise.all([
      db
        .select({
          tela: productosTable.tela,
          color: productosTable.color,
        })
        .from(productosTable),
      loadUnavailableProductSkus(db),
    ]);

    const existingVariants = new Set(
      existingRows.map(
        (r) => `${r.tela.toUpperCase()}|${r.color.toUpperCase()}`,
      ),
    );
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
        const existingSkus = await loadUnavailableProductSkus(tx);

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

  const { ubicacionId, scopeError } = resolveReadScope(req.auth!);
  if (scopeError) {
    res.status(403).json({ error: scopeError });
    return;
  }
  const locations = await getRealLocations(ubicacionId);
  const unidadBloqueada = (
    await getUnidadBloqueadaProductoIds(db, [producto.id])
  ).has(producto.id);
  const locationIds = locations.map((location) => location.id);
  const totals = (await getCacheByProducto(locationIds, producto.id)).get(producto.id) ?? {
    rollos: 0,
    cantidad: "0.000",
    sitiosConExistencia: 0,
    porUbicacion: new Map(),
  };
  const rollosDisponibles = locationIds.length
    ? await db
      .select({
        id: rollosTable.id,
        serie: rollosTable.serie,
        ubicacionId: rollosTable.ubicacionId,
        ubicacionNombre: ubicacionesTable.nombre,
        pisoId: rollosTable.pisoId,
        nombrePiso: pisosTable.nombre,
        cantidad: rollosTable.cantidadActual,
        estado: rollosTable.estado,
      })
      .from(rollosTable)
      .innerJoin(ubicacionesTable, eq(rollosTable.ubicacionId, ubicacionesTable.id))
      .leftJoin(pisosTable, eq(rollosTable.pisoId, pisosTable.id))
      .where(and(
        eq(rollosTable.productoId, producto.id),
        eq(rollosTable.estado, "DISPONIBLE"),
        inArray(rollosTable.ubicacionId, locationIds),
      ))
      .orderBy(ubicacionesTable.nombre, rollosTable.serie)
    : [];
  const comprasRows = await db.execute<{
    entrada_id: number;
    folio: number;
    fecha: Date | string;
    proveedor_id: number | null;
    proveedor_nombre: string | null;
    total_costo: string;
    total_cantidad: string;
    total_rollos: string;
  }>(sql`
    SELECT
      e.id AS entrada_id,
      e.folio,
      e.fecha,
      e.proveedor_id,
      p.nombre AS proveedor_nombre,
      COALESCE(SUM(r.costo_total), 0)::text AS total_costo,
      COALESCE(SUM(r.cantidad_inicial), 0)::text AS total_cantidad,
      COUNT(r.id)::text AS total_rollos
    FROM rollos r
    JOIN entradas e ON e.id = r.recepcion_id
    LEFT JOIN proveedores p ON p.id = e.proveedor_id
    WHERE r.producto_id = ${params.data.id}
    GROUP BY e.id, e.folio, e.fecha, e.proveedor_id, p.nombre
    ORDER BY e.fecha DESC, e.id DESC
  `);
  const response = GetProductoResponse.parse(
    presentProductoDetail(producto, locations, totals, rollosDisponibles.map((rollo) => ({
      ...rollo,
      cantidad: Number(rollo.cantidad).toFixed(3),
      estado: "DISPONIBLE" as const,
    })), comprasRows.rows as Array<{
      entrada_id: number;
      folio: number;
      fecha: Date | string;
      proveedor_id: number | null;
      proveedor_nombre: string | null;
      total_costo: string;
      total_cantidad: string;
      total_rollos: string;
    }>, unidadBloqueada),
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
    if ("colorHex" in body.data && !canEditProductColorHex(req.auth!.user.rol)) {
      res.status(403).json({
        error: "Solo ADMIN puede editar el color hexadecimal del producto.",
      });
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
    if (
      body.data.precioSugerido !== undefined &&
      body.data.precioSugerido !== before.precioSugerido
    ) {
      res.status(400).json({
        error:
          "El precio de lista debe cambiarse mediante el módulo de Precios.",
      });
      return;
    }
    if (body.data.unidad === "KILO" && before.seVendePorMetro) {
      res.status(400).json({
        error:
          "Deshabilita primero la venta por metro desde el módulo de Precios.",
      });
      return;
    }

    // Human-readable catalog text is trimmed but otherwise stored verbatim.
    const newTela =
      body.data.tela !== undefined
        ? body.data.tela.trim()
        : undefined;
    const newColor =
      body.data.color !== undefined
        ? body.data.color.trim()
        : undefined;
    const newColorHex = body.data.colorHex === undefined
      ? undefined
      : normalizeProductColorHex(body.data.colorHex);

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
      colorHex?: string | null;
      anchoCm?: string | null;
      composicion?: string | null;
      gramajeGm2?: string | null;
      unidad?: UnidadProducto;
      precioSugerido?: string | null;
      notas?: string | null;
      activo?: boolean;
    } = {};

    if (newSku !== undefined) updates.sku = newSku;
    if (newTela !== undefined) updates.tela = newTela;
    if (newColor !== undefined) updates.color = newColor;
    if (newColorHex !== undefined || body.data.colorHex === null) {
      updates.colorHex = newColorHex ?? null;
    }
    if ("anchoCm" in body.data) {
      updates.anchoCm = body.data.anchoCm == null ? null : String(body.data.anchoCm);
    }
    if ("composicion" in body.data) updates.composicion = body.data.composicion ?? null;
    if ("gramajeGm2" in body.data) {
      updates.gramajeGm2 = body.data.gramajeGm2 == null ? null : String(body.data.gramajeGm2);
    }
    if (body.data.unidad !== undefined)
      updates.unidad = body.data.unidad as UnidadProducto;
    if ("notas" in body.data) updates.notas = body.data.notas ?? null;
    if (body.data.activo !== undefined) updates.activo = body.data.activo;

    try {
      const outcome = await db.transaction(async (tx) => {
        // If SKU/tela/color/unidad change, serialize against concurrent
        // allocation/mutation by acquiring the shared catalog advisory lock.
        if (touchesCatalogNamespace) {
          await acquireCatalogLock(tx);
        }
        const [current] = touchesCatalogNamespace
          ? await tx
            .select()
            .from(productosTable)
            .where(eq(productosTable.id, params.data.id))
            .for("update")
            .limit(1)
          : [before];
        if (!current) {
          return { error: "Producto no encontrado." } as const;
        }
        if (
          body.data.unidad !== undefined &&
          body.data.unidad !== current.unidad
        ) {
          // The product row was locked before reading it. That lock conflicts
          // with the KEY SHARE lock PostgreSQL takes for new FK references, so
          // none can appear after this check and before the unit update commits.
          if ((await getUnidadBloqueadaProductoIds(tx, [current.id])).has(current.id)) {
            return {
              error:
                "No se puede cambiar la unidad porque el producto ya tiene historial operativo.",
            } as const;
          }
        }

        // Enforce variant uniqueness (excluding this product) under the lock.
        if (newTela !== undefined || newColor !== undefined) {
          const checkTela = newTela ?? current.tela;
          const checkColor = newColor ?? current.color;
          const [conflict] = await tx
            .select({ id: productosTable.id })
            .from(productosTable)
            .where(
              and(
                sql`lower(${productosTable.tela}) = lower(${checkTela})`,
                sql`lower(${productosTable.color}) = lower(${checkColor})`,
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
          if (
            newSku !== current.sku &&
            (await loadUnavailableProductSkus(tx)).has(newSku)
          ) {
            return {
              error: `El SKU "${newSku}" ya está en uso o quedó reservado por un producto borrado.`,
            } as const;
          }
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

        // A tela/color identity change invalidates an automatically allocated
        // SKU. Regenerate it under the same catalog lock. The current product
        // is excluded, so its old SKU cannot create a false collision. An
        // explicit custom SKU in this PATCH remains authoritative.
        const targetTela = newTela ?? current.tela;
        const targetColor = newColor ?? current.color;
        const variantChanged =
          targetTela !== current.tela || targetColor !== current.color;
        // Many edit clients submit the current SKU with the whole form. Treat
        // that unchanged value as non-custom so identity changes still
        // regenerate it; only a genuinely different explicit SKU overrides.
        if (
          variantChanged &&
          (newSku === undefined || newSku === current.sku)
        ) {
          const unavailableSkus = await loadUnavailableProductSkus(tx);
          unavailableSkus.delete(current.sku.toUpperCase());
          updates.sku = generateSku(
            targetTela,
            targetColor,
            unavailableSkus,
          );
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
          datosAntes: { ...current } as Record<string, unknown>,
          datosDespues: { ...producto! } as Record<string, unknown>,
          ip: getRequestIp(req),
        });
        return { producto: producto! } as const;
      });

      if ("error" in outcome) {
        res.status(400).json({ error: outcome.error });
        return;
      }

      const unidadBloqueada = (
        await getUnidadBloqueadaProductoIds(db, [outcome.producto.id])
      ).has(outcome.producto.id);
      res.json(
        UpdateProductoResponse.parse(
          presentProducto(
            outcome.producto,
            EMPTY_EXISTENCIAS_TOTALS,
            unidadBloqueada,
          ),
        ),
      );
    } catch (error) {
      // Unique DB constraints remain the final protection.
      if (isPostgresUniqueViolation(error)) {
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
