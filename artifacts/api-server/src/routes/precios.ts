import { Router, type IRouter, type NextFunction, type Request, type Response } from "express";
import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import {
  ChangePrecioBody,
  ChangePrecioParams,
  ChangePrecioResponse,
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
import { requireSession } from "../middlewares/auth";
import { getRequestIp } from "../lib/request";
import { priceMetrics, validPositiveMoney, weightedCurrentUnitCost } from "../lib/precios";
import { meteredReferenceCost } from "../lib/metered-reference-cost";

const router: IRouter = Router();
router.use("/precios", requireSession);

function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (req.auth?.user.rol !== "ADMIN") {
    res.status(403).json({ error: "Este módulo es exclusivo para ADMIN." });
    return;
  }
  next();
}

type Product = typeof productosTable.$inferSelect;
type History = typeof precioHistorialTable.$inferSelect;

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

router.get("/precios", requireAdmin, async (req, res): Promise<void> => {
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
      !query.data.semaforo ||
      row.preciosPorModo[modoPrecio].semaforo === query.data.semaforo,
  );
  res.json(ListPreciosResponse.parse(rows));
});

router.get("/precios/:id", requireAdmin, async (req, res): Promise<void> => {
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

router.post("/precios/:id/cambiar", requireAdmin, async (req, res): Promise<void> => {
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
    await tx.execute(sql`SELECT pg_advisory_xact_lock(1347569993, ${params.data.id})`);
    const [before] = await tx.select().from(productosTable).where(eq(productosTable.id, params.data.id)).for("update").limit(1);
    if (!before) return null;
    const modoPrecio = body.data.modoPrecio ?? "ROLLO";
    const isMeteredMode = modoPrecio !== "ROLLO";
    if (isMeteredMode && !before.seVendePorMetro) {
      return { kind: "metered-disabled" } as const;
    }
    const cost = isMeteredMode
      ? (await meteredReferenceCost(tx, before.id, new Date())).cost
      : await currentCost(tx, before.id);
    const metrics = priceMetrics(body.data.precioListaNuevo, cost);
    const previousPrice = modoPrecio === "ROLLO"
      ? before.precioSugerido
      : modoPrecio === "MAYOREO" ? before.precioMayoreo : before.precioMenudeo;
    const updateValues = modoPrecio === "ROLLO"
      ? { precioSugerido: body.data.precioListaNuevo }
      : modoPrecio === "MAYOREO"
        ? { precioMayoreo: body.data.precioListaNuevo }
        : { precioMenudeo: body.data.precioListaNuevo };
    const [updated] = await tx.update(productosTable).set(updateValues).where(eq(productosTable.id, before.id)).returning();
    const [change] = await tx.insert(precioHistorialTable).values({
      productoId: before.id, precioListaAnterior: previousPrice,
      precioListaNuevo: body.data.precioListaNuevo, costoUnitarioPonderado: cost,
      modoPrecio,
      margenPesosUnidad: metrics.margenPesosUnidad, margenPorcentajeSubtotal: metrics.margenPorcentajeSubtotal,
      motivo: reason, advertenciaBajoCosto: cost !== null && Number(body.data.precioListaNuevo) < Number(cost),
      usuarioId: req.auth!.user.id,
    }).returning();
    await tx.insert(auditoriaTable).values({
      usuarioId: req.auth!.user.id, accion: "CAMBIAR_PRECIO", entidad: "productos", entidadId: String(before.id),
      datosAntes: { modoPrecio, precioLista: previousPrice },
      datosDespues: { modoPrecio, precioLista: body.data.precioListaNuevo, motivo: reason, ...metrics, advertenciaBajoCosto: change!.advertenciaBajoCosto },
      ip: getRequestIp(req),
    });
    return { product: updated!, change: change! };
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

router.patch("/precios/:id/venta-por-metro", requireAdmin, async (req, res): Promise<void> => {
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
    if (before.unidad === "KILO") {
      return { kind: "kilo" } as const;
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
  if (result.kind === "kilo") {
    res.status(400).json({
      error: "Los productos por KILO nunca pueden habilitarse para venta por metro.",
      code: "KILO_VENTA_POR_METRO_NO_PERMITIDA",
    });
    return;
  }
  res.json(UpdatePrecioVentaPorMetroResponse.parse(await presentProduct(result.product)));
});

export default router;