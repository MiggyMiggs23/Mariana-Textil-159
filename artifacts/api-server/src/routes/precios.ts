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
    precioListaAnterior: row.precioListaAnterior,
    precioListaNuevo: row.precioListaNuevo,
    costoUnitarioPonderado: row.costoUnitarioPonderado,
    margenPesosUnidad: row.margenPesosUnidad,
    margenPorcentajeSubtotal: row.margenPorcentajeSubtotal,
    motivo: row.motivo,
    advertenciaBajoCosto: row.advertenciaBajoCosto,
    usuarioId: row.usuarioId,
    createdAt: row.createdAt,
  };
}

async function presentProduct(product: Product, database: Pick<typeof db, "select"> = db) {
  const cost = await currentCost(database, product.id);
  const metrics = priceMetrics(product.precioSugerido, cost);
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
    activo: product.activo,
    precioLista: product.precioSugerido,
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
  const conditions = [];
  if (query.data.search?.trim()) {
    const search = `%${query.data.search.trim()}%`;
    conditions.push(or(ilike(productosTable.sku, search), ilike(productosTable.tela, search), ilike(productosTable.color, search)));
  }
  if (query.data.unidad) conditions.push(eq(productosTable.unidad, query.data.unidad));
  const products = await db.select().from(productosTable).where(conditions.length ? and(...conditions) : undefined)
    .orderBy(productosTable.tela, productosTable.color);
  const rows = (await Promise.all(products.map((product) => presentProduct(product)))).filter(
    (row) => !query.data.semaforo || row.semaforo === query.data.semaforo,
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
  const body = ChangePrecioBody.safeParse(req.body);
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
    const cost = await currentCost(tx, before.id);
    const metrics = priceMetrics(body.data.precioListaNuevo, cost);
    const [updated] = await tx.update(productosTable).set({ precioSugerido: body.data.precioListaNuevo }).where(eq(productosTable.id, before.id)).returning();
    const [change] = await tx.insert(precioHistorialTable).values({
      productoId: before.id, precioListaAnterior: before.precioSugerido,
      precioListaNuevo: body.data.precioListaNuevo, costoUnitarioPonderado: cost,
      margenPesosUnidad: metrics.margenPesosUnidad, margenPorcentajeSubtotal: metrics.margenPorcentajeSubtotal,
      motivo: reason, advertenciaBajoCosto: cost !== null && Number(body.data.precioListaNuevo) < Number(cost),
      usuarioId: req.auth!.user.id,
    }).returning();
    await tx.insert(auditoriaTable).values({
      usuarioId: req.auth!.user.id, accion: "CAMBIAR_PRECIO", entidad: "productos", entidadId: String(before.id),
      datosAntes: { precioSugerido: before.precioSugerido },
      datosDespues: { precioSugerido: updated!.precioSugerido, motivo: reason, ...metrics, advertenciaBajoCosto: change!.advertenciaBajoCosto },
      ip: getRequestIp(req),
    });
    return { product: updated!, change: change! };
  });
  if (!result) {
    res.status(404).json({ error: "Producto no encontrado." });
    return;
  }
  const product = await presentProduct(result.product);
  res.json(ChangePrecioResponse.parse({ producto: { ...product, ultimoCambioPrecio: result.change.createdAt }, cambio: presentHistory(result.change) }));
});

export default router;