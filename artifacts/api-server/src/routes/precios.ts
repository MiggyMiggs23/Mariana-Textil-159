import { Router, type IRouter } from "express";
import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { z } from "zod";
import {
  ChangePrecioBody,
  ChangePrecioParams,
  ChangePrecioResponse,
  ChangePreciosMasivoBody,
  ChangePreciosMasivoResponse,
  GetPrecioParams,
  GetPrecioResponse,
  ListPreciosQueryParams,
  ListPreciosResponse,
  UpdatePrecioVentaPorMetroBody,
  UpdatePrecioVentaPorMetroParams,
  UpdatePrecioVentaPorMetroResponse,
} from "@workspace/api-zod";
import {
  auditoriaTable,
  db,
  precioHistorialTable,
  productosTable,
  rollosTable,
} from "@workspace/db";
import {
  ADVISORY_LOCK_NAMESPACES,
  transactionAdvisoryLock,
} from "@workspace/db/advisory-locks";
import { requireSession } from "../middlewares/auth";
import { requierePermiso } from "../lib/permisos";
import { getRequestIp } from "../lib/request";
import { priceMetrics, validPositiveMoney, weightedCurrentUnitCost } from "../lib/precios";
import { meteredReferenceCost } from "../lib/metered-reference-cost";

const router: IRouter = Router();
router.use("/precios", requireSession);

type Product = typeof productosTable.$inferSelect;
type History = typeof precioHistorialTable.$inferSelect;
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type ModoPrecio = "ROLLO" | "MAYOREO" | "MENUDEO";

const StrictChangePreciosMasivoBody = ChangePreciosMasivoBody.extend({
  productoIds: z.array(z.number().int().positive()).min(1).max(200),
}).strict();

async function currentCost(database: Pick<typeof db, "select">, productId: number) {
  const rows = await database
    .select({
      cantidadActual: rollosTable.cantidadActual,
      costoUnitario: rollosTable.costoUnitario,
      estado: rollosTable.estado,
    })
    .from(rollosTable)
    .where(eq(rollosTable.productoId, productId));
  return weightedCurrentUnitCost(rows);
}

function presentHistory(row: History) {
  return {
    id: row.id,
    modoPrecio: row.modoPrecio,
    precioListaAnterior: row.precioListaAnterior,
    precioListaNuevo: row.precioListaNuevo,
    costoUnitarioPonderado: row.costoUnitarioPonderado,
    costoUnitarioBase: row.costoUnitarioPonderado,
    margenPesosUnidad: row.margenPesosUnidad,
    margenPorcentajeSubtotal: row.margenPorcentajeSubtotal,
    motivo: row.motivo,
    advertenciaBajoCosto: row.advertenciaBajoCosto,
    usuarioId: row.usuarioId,
    createdAt: row.createdAt,
  };
}

async function mutateLockedPrecio(
  tx: Tx,
  before: Product,
  input: {
    precioListaNuevo: string;
    modoPrecio: ModoPrecio;
    motivo: string;
    usuarioId: number;
    ip: string;
  },
) {
  const isMeteredMode = input.modoPrecio !== "ROLLO";
  const cost = isMeteredMode
    ? (await meteredReferenceCost(tx, before.id, new Date())).cost
    : await currentCost(tx, before.id);
  const metrics = priceMetrics(input.precioListaNuevo, cost);
  const previousPrice = input.modoPrecio === "ROLLO"
    ? before.precioSugerido
    : input.modoPrecio === "MAYOREO" ? before.precioMayoreo : before.precioMenudeo;
  const updateValues = input.modoPrecio === "ROLLO"
    ? { precioSugerido: input.precioListaNuevo }
    : input.modoPrecio === "MAYOREO"
      ? { precioMayoreo: input.precioListaNuevo }
      : { precioMenudeo: input.precioListaNuevo };
  const [updated] = await tx.update(productosTable).set(updateValues).where(eq(productosTable.id, before.id)).returning();
  const [change] = await tx.insert(precioHistorialTable).values({
    productoId: before.id,
    precioListaAnterior: previousPrice,
    precioListaNuevo: input.precioListaNuevo,
    costoUnitarioPonderado: cost,
    modoPrecio: input.modoPrecio,
    margenPesosUnidad: metrics.margenPesosUnidad,
    margenPorcentajeSubtotal: metrics.margenPorcentajeSubtotal,
    motivo: input.motivo,
    advertenciaBajoCosto: cost !== null && Number(input.precioListaNuevo) < Number(cost),
    usuarioId: input.usuarioId,
  }).returning();
  await tx.insert(auditoriaTable).values({
    usuarioId: input.usuarioId,
    accion: "CAMBIAR_PRECIO",
    entidad: "productos",
    entidadId: String(before.id),
    datosAntes: { modoPrecio: input.modoPrecio, precioLista: previousPrice },
    datosDespues: {
      modoPrecio: input.modoPrecio,
      precioLista: input.precioListaNuevo,
      motivo: input.motivo,
      ...metrics,
      advertenciaBajoCosto: change!.advertenciaBajoCosto,
    },
    ip: input.ip,
  });
  return { kind: "updated", product: updated!, change: change! } as const;
}

async function presentProduct(product: Product, database: Pick<typeof db, "select"> = db) {
  const [cost, meteredCost] = await Promise.all([
    currentCost(database, product.id),
    meteredReferenceCost(database, product.id, new Date()),
  ]);
  const metrics = priceMetrics(product.precioSugerido, cost);
  const meteredReference = {
    costoUnitario: meteredCost.cost,
    estado: meteredCost.status,
    esMayorA12Meses: meteredCost.isOlderThan12Months,
    rollosIncluidos: meteredCost.rollsIncluded,
    fechaUltimaRecepcion: meteredCost.latestReceptionDate,
  };
  const modeSummary = (modo: "ROLLO" | "MAYOREO" | "MENUDEO", price: string | null, baseCost: string | null) => ({
    modo,
    precioLista: price,
    costoUnitarioBase: baseCost,
    ...priceMetrics(price, baseCost),
  });
  const [last] = await database
    .select({ createdAt: precioHistorialTable.createdAt })
    .from(precioHistorialTable)
    .where(eq(precioHistorialTable.productoId, product.id))
    .orderBy(desc(precioHistorialTable.createdAt))
    .limit(1);
  return {
    id: product.id,
    sku: product.sku,
    tela: product.tela,
    color: product.color,
    unidad: product.unidad,
    seVendePorMetro: product.seVendePorMetro,
    activo: product.activo,
    precioLista: product.precioSugerido,
    precioMayoreo: product.precioMayoreo,
    precioMenudeo: product.precioMenudeo,
    costoReferenciaMetreado: meteredReference,
    preciosPorModo: {
      ROLLO: modeSummary("ROLLO", product.precioSugerido, cost),
      MAYOREO: modeSummary("MAYOREO", product.precioMayoreo, meteredCost.cost),
      MENUDEO: modeSummary("MENUDEO", product.precioMenudeo, meteredCost.cost),
    },
    ...metrics,
    ultimoCambioPrecio: last?.createdAt ?? null,
  };
}

router.get("/precios", requierePermiso("precios", "ver"), async (req, res): Promise<void> => {
  const query = ListPreciosQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: "Filtros de precios inválidos." });
    return;
  }
  const modoPrecio = query.data.modoPrecio ?? "ROLLO";
  const conditions = [];
  if (query.data.search?.trim()) {
    const search = `%${query.data.search.trim()}%`;
    conditions.push(or(ilike(productosTable.sku, search), ilike(productosTable.tela, search), ilike(productosTable.color, search)));
  }
  if (query.data.unidad) conditions.push(eq(productosTable.unidad, query.data.unidad));
  const products = await db.select().from(productosTable).where(conditions.length ? and(...conditions) : undefined)
    .orderBy(productosTable.tela, productosTable.color);
  const rows = (await Promise.all(products.map((product) => presentProduct(product)))).filter(
    (row) =>
      (!query.data.semaforo ||
        row.preciosPorModo[modoPrecio].semaforo === query.data.semaforo) &&
      (!query.data.sinPrecio ||
        row.preciosPorModo[modoPrecio].precioLista == null),
  );
  res.json(ListPreciosResponse.parse(rows));
});

router.get("/precios/:id", requierePermiso("precios", "ver"), async (req, res): Promise<void> => {
  const params = GetPrecioParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "ID inválido." });
    return;
  }
  const [product] = await db.select().from(productosTable).where(eq(productosTable.id, params.data.id)).limit(1);
  if (!product) {
    res.status(404).json({ error: "Producto no encontrado." });
    return;
  }
  const history = await db.select().from(precioHistorialTable)
    .where(eq(precioHistorialTable.productoId, product.id))
    .orderBy(desc(precioHistorialTable.createdAt));
  const response = { ...(await presentProduct(product)), historial: history.map(presentHistory), puntosGrafica: [...history].reverse().map(presentHistory) };
  res.json(GetPrecioResponse.parse(response));
});

router.post("/precios/:id/cambiar", requierePermiso("precios", "editar"), async (req, res): Promise<void> => {
  const params = ChangePrecioParams.safeParse(req.params);
  const body = ChangePrecioBody.safeParse({
    ...req.body,
    // Existing callers predate named price modes; their changes remain ROLLO.
    modoPrecio: req.body?.modoPrecio ?? "ROLLO",
  });
  const reason = body.success ? body.data.motivo.trim() : "";
  const newPrice = body.success ? body.data.precioListaNuevo : "";
  if (!params.success || !body.success || reason.length < 5 || !validPositiveMoney(newPrice)) {
    res.status(400).json({ error: "El precio debe ser positivo y el motivo debe tener al menos 5 caracteres." });
    return;
  }
  const result = await db.transaction(async (tx) => {
    // Row lock serializes changes to this product; advisory lock protects the
    // aggregate snapshot against concurrent price changes for the same id.
    await transactionAdvisoryLock(
      tx,
      ADVISORY_LOCK_NAMESPACES.PRODUCT_PRICING,
      params.data.id,
    );
    const [before] = await tx.select().from(productosTable).where(eq(productosTable.id, params.data.id)).for("update").limit(1);
    if (!before) return null;
    const modoPrecio = body.data.modoPrecio ?? "ROLLO";
    const isMeteredMode = modoPrecio !== "ROLLO";
    if (
      isMeteredMode &&
      (!before.seVendePorMetro ||
        before.unidad === "KILO" ||
        before.unidad === "PIEZA")
    ) {
      return { kind: "metered-disabled" } as const;
    }
    return mutateLockedPrecio(tx, before, {
      precioListaNuevo: body.data.precioListaNuevo,
      modoPrecio,
      motivo: reason,
      usuarioId: req.auth!.user.id,
      ip: getRequestIp(req),
    });
  });
  if (!result) {
    res.status(404).json({ error: "Producto no encontrado." });
    return;
  }
  if (result.kind === "metered-disabled") {
    res.status(400).json({ error: "El producto no está habilitado para venta por metro.", code: "VENTA_POR_METRO_DESHABILITADA" });
    return;
  }
  const product = await presentProduct(result.product);
  res.json(ChangePrecioResponse.parse({ producto: { ...product, ultimoCambioPrecio: result.change.createdAt }, cambio: presentHistory(result.change) }));
});

router.post("/precios/cambiar-masivo", requierePermiso("precios", "editar"), async (req, res): Promise<void> => {
  const body = StrictChangePreciosMasivoBody.safeParse(req.body);
  const reason = body.success ? body.data.motivo.trim() : "";
  const newPrice = body.success ? body.data.precioListaNuevo : "";
  if (!body.success || reason.length < 5 || !validPositiveMoney(newPrice)) {
    res.status(400).json({ error: "El precio debe ser positivo, debe seleccionar de 1 a 200 productos y el motivo debe tener al menos 5 caracteres." });
    return;
  }
  if (new Set(body.data.productoIds).size !== body.data.productoIds.length) {
    res.status(400).json({ error: "Los IDs de producto no pueden repetirse.", code: "PRODUCTOS_DUPLICADOS" });
    return;
  }

  const productoIds = [...body.data.productoIds].sort((a, b) => a - b);
  const result = await db.transaction(async (tx) => {
    // A globally consistent ordering prevents two overlapping batches from
    // deadlocking. Every advisory lock is acquired before any row lock.
    for (const productoId of productoIds) {
      await transactionAdvisoryLock(
        tx,
        ADVISORY_LOCK_NAMESPACES.PRODUCT_PRICING,
        productoId,
      );
    }
    const products: Product[] = [];
    for (const productoId of productoIds) {
      const [product] = await tx
        .select()
        .from(productosTable)
        .where(eq(productosTable.id, productoId))
        .for("update")
        .limit(1);
      if (product) products.push(product);
    }

    // All batch-level validation deliberately happens after all locks and
    // before the shared helper performs the first write.
    const foundIds = new Set(products.map((product) => product.id));
    const missingIds = productoIds.filter((id) => !foundIds.has(id));
    if (missingIds.length) return { kind: "not-found", productoIds: missingIds } as const;
    if (new Set(products.map((product) => product.unidad)).size > 1) {
      return {
        kind: "mixed-units",
        products: products.map((product) => ({ sku: product.sku, unidad: product.unidad })),
      } as const;
    }
    if (body.data.modoPrecio !== "ROLLO") {
      const invalid = products.filter((product) =>
        !product.seVendePorMetro ||
          product.unidad === "KILO" ||
          product.unidad === "PIEZA"
      );
      if (invalid.length) {
        return { kind: "metered-disabled", skus: invalid.map((product) => product.sku) } as const;
      }
    }

    const changes = [];
    for (const product of products) {
      changes.push(await mutateLockedPrecio(tx, product, {
        precioListaNuevo: body.data.precioListaNuevo,
        modoPrecio: body.data.modoPrecio,
        motivo: reason,
        usuarioId: req.auth!.user.id,
        ip: getRequestIp(req),
      }));
    }
    return { kind: "updated", changes } as const;
  });

  if (result.kind === "not-found") {
    res.status(404).json({ error: "Uno o más productos no fueron encontrados.", productoIds: result.productoIds });
    return;
  }
  if (result.kind === "mixed-units") {
    const labels = result.products.map((product) => `${product.sku} (${product.unidad})`);
    res.status(400).json({
      error: `No se pueden mezclar unidades: ${labels.join(", ")}.`,
      code: "UNIDADES_MIXTAS",
      skus: result.products.map((product) => product.sku),
    });
    return;
  }
  if (result.kind === "metered-disabled") {
    res.status(400).json({
      error: `Productos no habilitados para venta por metro: ${result.skus.join(", ")}.`,
      code: "VENTA_POR_METRO_DESHABILITADA",
      skus: result.skus,
    });
    return;
  }
  res.json(ChangePreciosMasivoResponse.parse({
    actualizados: result.changes.length,
  }));
});

router.patch("/precios/:id/venta-por-metro", requierePermiso("precios", "editar"), async (req, res): Promise<void> => {
  const params = UpdatePrecioVentaPorMetroParams.safeParse(req.params);
  const body = UpdatePrecioVentaPorMetroBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: "Valor del interruptor inválido." });
    return;
  }

  const result = await db.transaction(async (tx) => {
    const [before] = await tx
      .select()
      .from(productosTable)
      .where(eq(productosTable.id, params.data.id))
      .for("update")
      .limit(1);
    if (!before) return { kind: "not-found" } as const;
    if (before.unidad === "KILO" || before.unidad === "PIEZA") {
      return { kind: "indivisible-unit", unidad: before.unidad } as const;
    }
    const [updated] = await tx
      .update(productosTable)
      .set({ seVendePorMetro: body.data.seVendePorMetro })
      .where(eq(productosTable.id, before.id))
      .returning();
    await tx.insert(auditoriaTable).values({
      usuarioId: req.auth!.user.id,
      accion: "CAMBIAR_VENTA_POR_METRO",
      entidad: "productos",
      entidadId: String(before.id),
      datosAntes: { seVendePorMetro: before.seVendePorMetro },
      datosDespues: { seVendePorMetro: updated!.seVendePorMetro },
      ip: getRequestIp(req),
    });
    return { kind: "updated", product: updated! } as const;
  });
  if (result.kind === "not-found") {
    res.status(404).json({ error: "Producto no encontrado." });
    return;
  }
  if (result.kind === "indivisible-unit") {
    res.status(400).json({
      error: `Los productos por ${result.unidad} nunca pueden habilitarse para venta por metro.`,
      code: `${result.unidad}_VENTA_POR_METRO_NO_PERMITIDA`,
    });
    return;
  }
  res.json(UpdatePrecioVentaPorMetroResponse.parse(await presentProduct(result.product)));
});

export default router;