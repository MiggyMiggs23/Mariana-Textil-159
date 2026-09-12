import { and, asc, eq, ilike, inArray, isNull, or } from "drizzle-orm";
import {
  auditoriaTable,
  db,
  existenciasTable,
  notificacionesSistemaTable,
  productosTable,
  stockMinimoEpisodiosTable,
  stockMinimoSitiosTable,
  stockMinimosTable,
  ubicacionesTable,
  usuariosTable,
} from "@workspace/db";
import {
  ADVISORY_LOCK_NAMESPACES,
  transactionAdvisoryLock,
} from "@workspace/db/advisory-locks";
import { evaluateStockMinimum } from "./stock-minimos-engine";

export const STOCK_MINIMUM_POLL_INTERVAL_MS = 30_000;
export const STOCK_MINIMUM_NOTIFICATION_TYPE = "STOCK_MINIMO";
const STOCK_MINIMUM_EPISODE_ENTITY = "stock_minimo_episodios";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export class StockMinimumError extends Error {
  constructor(
    message: string,
    readonly code:
      | "LOCATION_NOT_FOUND"
      | "PRODUCT_NOT_FOUND"
      | "INVALID_CONFIGURATION",
  ) {
    super(message);
    this.name = "StockMinimumError";
  }
}

export type StockMinimumConfig = {
  ubicacionId: number;
  habilitado: boolean;
};

export type StockMinimumProduct = {
  productoId: number;
  sku: string;
  tela: string;
  color: string;
  unidad: string;
  existencia: number;
  minimo: number | null;
  updatedAt: Date | null;
};

function quantity(value: string | number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error("La cantidad almacenada de inventario es inválida.");
  }
  return parsed;
}

function quantityText(value: number): string {
  return value.toFixed(3);
}

function assertMinimumValue(value: number | null): void {
  const decimalPlaces =
    value == null
      ? 0
      : (() => {
          const [coefficient, exponentText] = value
            .toString()
            .toLowerCase()
            .split("e");
          const exponent = exponentText == null ? 0 : Number(exponentText);
          return Math.max(
            0,
            (coefficient.split(".")[1]?.length ?? 0) - exponent,
          );
        })();
  if (
    value != null &&
    (!Number.isFinite(value) ||
      value < 0 ||
      decimalPlaces > 3)
  ) {
    throw new StockMinimumError(
      "El mínimo debe ser un número no negativo con hasta tres decimales.",
      "INVALID_CONFIGURATION",
    );
  }
}

async function lockSiteConfiguration(
  tx: Tx,
  ubicacionId: number,
  createIfMissing: boolean,
): Promise<typeof stockMinimoSitiosTable.$inferSelect | null> {
  // The site lock is shared by settings changes and scheduled evaluators. The
  // partial active-episode index is the final duplicate guard.
  await transactionAdvisoryLock(
    tx,
    ADVISORY_LOCK_NAMESPACES.STOCK_MINIMUM,
    ubicacionId,
  );

  let [site] = await tx
    .select()
    .from(stockMinimoSitiosTable)
    .where(eq(stockMinimoSitiosTable.ubicacionId, ubicacionId))
    .for("update")
    .limit(1);

  if (!site && createIfMissing) {
    const [location] = await tx
      .select({ id: ubicacionesTable.id, activa: ubicacionesTable.activa })
      .from(ubicacionesTable)
      .where(eq(ubicacionesTable.id, ubicacionId))
      .limit(1);
    if (!location || !location.activa) {
      throw new StockMinimumError(
        "La ubicación no existe o está inactiva.",
        "LOCATION_NOT_FOUND",
      );
    }
    await tx.insert(stockMinimoSitiosTable).values({
      ubicacionId,
      habilitado: false,
    });
    [site] = await tx
      .select()
      .from(stockMinimoSitiosTable)
      .where(eq(stockMinimoSitiosTable.ubicacionId, ubicacionId))
      .for("update")
      .limit(1);
  }

  return site ?? null;
}

async function activeRecipients(tx: Tx, ubicacionId: number): Promise<number[]> {
  const rows = await tx
    .select({ id: usuariosTable.id })
    .from(usuariosTable)
    .where(
      and(
        eq(usuariosTable.activo, true),
        or(
          eq(usuariosTable.ubicacionId, ubicacionId),
          inArray(usuariosTable.rol, ["ADMIN", "SUPERVISOR"]),
        ),
      ),
    );
  return [...new Set(rows.map((row) => row.id))];
}

async function notifyEpisode(
  tx: Tx,
  values: {
    episodeId: number;
    productoId: number;
    sku: string;
    tela: string;
    color: string;
    unidad: string;
    ubicacionId: number;
    ubicacionNombre: string;
    minimo: number;
    existencia: number;
    diferencia: number;
  },
): Promise<void> {
  const recipients = await activeRecipients(tx, values.ubicacionId);
  const title = `Stock mínimo: ${values.tela} · ${values.color}`;
  const message =
    `${values.sku} en ${values.ubicacionNombre} está bajo el mínimo. ` +
    `Mínimo: ${quantityText(values.minimo)} ${values.unidad}; ` +
    `existencia: ${quantityText(values.existencia)} ${values.unidad}; ` +
    `diferencia: ${quantityText(values.diferencia)} ${values.unidad}.`;

  for (const destinatarioUsuarioId of recipients) {
    await tx
      .insert(notificacionesSistemaTable)
      .values({
        tipo: STOCK_MINIMUM_NOTIFICATION_TYPE,
        titulo: title,
        mensaje: message,
        entidad: STOCK_MINIMUM_EPISODE_ENTITY,
        entidadId: String(values.episodeId),
        destinatarioUsuarioId,
      })
      // The episode id is the notification identity. This also protects
      // against a retry after a transaction was interrupted.
      .onConflictDoNothing();
  }
}

/**
 * Evaluates one already-locked enabled site. It reads only the product
 * catalog, the derived existence cache, and the minimum/episode ledgers.
 */
async function evaluateLockedSite(
  tx: Tx,
  ubicacionId: number,
): Promise<void> {
  const [location] = await tx
    .select({ id: ubicacionesTable.id, nombre: ubicacionesTable.nombre })
    .from(ubicacionesTable)
    .where(eq(ubicacionesTable.id, ubicacionId))
    .limit(1);
  if (!location) {
    throw new StockMinimumError(
      "La ubicación no existe o está inactiva.",
      "LOCATION_NOT_FOUND",
    );
  }

  const minimums = await tx
    .select({
      productoId: stockMinimosTable.productoId,
      minimo: stockMinimosTable.cantidad,
      sku: productosTable.sku,
      tela: productosTable.tela,
      color: productosTable.color,
      unidad: productosTable.unidad,
      existencia: existenciasTable.cantidadTotal,
    })
    .from(stockMinimosTable)
    .innerJoin(productosTable, eq(stockMinimosTable.productoId, productosTable.id))
    .leftJoin(
      existenciasTable,
      and(
        eq(existenciasTable.productoId, stockMinimosTable.productoId),
        eq(existenciasTable.ubicacionId, ubicacionId),
      ),
    )
    .where(
      and(
        eq(stockMinimosTable.ubicacionId, ubicacionId),
        eq(productosTable.activo, true),
      ),
    )
    .orderBy(asc(stockMinimosTable.productoId));

  const activeEpisodes = await tx
    .select()
    .from(stockMinimoEpisodiosTable)
    .where(
      and(
        eq(stockMinimoEpisodiosTable.ubicacionId, ubicacionId),
        isNull(stockMinimoEpisodiosTable.cerradoAt),
      ),
    )
    .for("update");
  const activeByProduct = new Map(
    activeEpisodes.map((episode) => [episode.productoId, episode]),
  );
  const configuredProducts = new Set<number>();

  for (const row of minimums) {
    configuredProducts.add(row.productoId);
    const minimo = quantity(row.minimo);
    const existencia = quantity(row.existencia ?? "0");
    const current = activeByProduct.get(row.productoId);
    const transition = evaluateStockMinimum(
      minimo,
      existencia,
      current != null,
    );

    if (transition.action === "CLOSE") {
      if (current) {
        await tx
          .update(stockMinimoEpisodiosTable)
          .set({ cerradoAt: new Date() })
          .where(eq(stockMinimoEpisodiosTable.id, current.id));
      }
      continue;
    }
    if (transition.action === "NONE") continue;

    const diferencia = transition.diferencia ?? 0;
    if (current) {
      await tx
        .update(stockMinimoEpisodiosTable)
        .set({
          minimo: quantityText(minimo),
          existencia: quantityText(existencia),
          diferencia: quantityText(diferencia),
        })
        .where(eq(stockMinimoEpisodiosTable.id, current.id));
      continue;
    }

    const [episode] = await tx
      .insert(stockMinimoEpisodiosTable)
      .values({
        productoId: row.productoId,
        ubicacionId,
        minimo: quantityText(minimo),
        existencia: quantityText(existencia),
        diferencia: quantityText(diferencia),
      })
      .returning({ id: stockMinimoEpisodiosTable.id });
    if (!episode) throw new Error("No se pudo abrir el episodio de stock mínimo.");

    await notifyEpisode(tx, {
      episodeId: episode.id,
      productoId: row.productoId,
      sku: row.sku,
      tela: row.tela,
      color: row.color,
      unidad: row.unidad,
      ubicacionId,
      ubicacionNombre: location.nombre,
      minimo,
      existencia,
      diferencia,
    });
  }

  // A removed minimum resolves its open episode without deleting history.
  for (const episode of activeEpisodes) {
    if (!configuredProducts.has(episode.productoId)) {
      await tx
        .update(stockMinimoEpisodiosTable)
        .set({ cerradoAt: new Date() })
        .where(eq(stockMinimoEpisodiosTable.id, episode.id));
    }
  }
}

export async function getStockMinimumConfig(
  ubicacionId: number,
): Promise<StockMinimumConfig> {
  const [site] = await db
    .select({
      ubicacionId: stockMinimoSitiosTable.ubicacionId,
      habilitado: stockMinimoSitiosTable.habilitado,
    })
    .from(stockMinimoSitiosTable)
    .where(eq(stockMinimoSitiosTable.ubicacionId, ubicacionId))
    .limit(1);
  return {
    ubicacionId,
    habilitado: site?.habilitado ?? false,
  };
}

export async function listStockMinimumProducts(
  ubicacionId: number,
  buscar?: string,
): Promise<StockMinimumProduct[]> {
  // This must remain the first read. Disabled sites must not query products or
  // inventory, preserving the pre-feature behavior exactly.
  const config = await getStockMinimumConfig(ubicacionId);
  if (!config.habilitado) return [];

  const rows = await db
    .select({
      productoId: productosTable.id,
      sku: productosTable.sku,
      tela: productosTable.tela,
      color: productosTable.color,
      unidad: productosTable.unidad,
      existencia: existenciasTable.cantidadTotal,
      minimo: stockMinimosTable.cantidad,
      updatedAt: stockMinimosTable.updatedAt,
    })
    .from(productosTable)
    .leftJoin(
      existenciasTable,
      and(
        eq(existenciasTable.productoId, productosTable.id),
        eq(existenciasTable.ubicacionId, ubicacionId),
      ),
    )
    .leftJoin(
      stockMinimosTable,
      and(
        eq(stockMinimosTable.productoId, productosTable.id),
        eq(stockMinimosTable.ubicacionId, ubicacionId),
      ),
    )
    .where(
      and(
        eq(productosTable.activo, true),
        buscar?.trim()
          ? or(
              ilike(productosTable.sku, `%${buscar.trim()}%`),
              ilike(productosTable.tela, `%${buscar.trim()}%`),
              ilike(productosTable.color, `%${buscar.trim()}%`),
            )
          : undefined,
      ),
    )
    .orderBy(asc(productosTable.tela), asc(productosTable.color), asc(productosTable.sku));

  return rows.map((row) => ({
    productoId: row.productoId,
    sku: row.sku,
    tela: row.tela,
    color: row.color,
    unidad: row.unidad,
    existencia: quantity(row.existencia ?? "0"),
    minimo: row.minimo == null ? null : quantity(row.minimo),
    updatedAt: row.updatedAt ?? null,
  }));
}

export async function setStockMinimumSiteEnabled(input: {
  ubicacionId: number;
  habilitado: boolean;
  usuarioId: number;
  ip: string;
}): Promise<StockMinimumConfig> {
  return db.transaction(async (tx) => {
    const before = await lockSiteConfiguration(tx, input.ubicacionId, true);
    const [updated] = await tx
      .update(stockMinimoSitiosTable)
      .set({
        habilitado: input.habilitado,
        updatedBy: input.usuarioId,
        updatedAt: new Date(),
      })
      .where(eq(stockMinimoSitiosTable.ubicacionId, input.ubicacionId))
      .returning();
    if (!updated) throw new Error("No se pudo actualizar la configuración.");

    if (input.habilitado) {
      await evaluateLockedSite(tx, input.ubicacionId);
    } else {
      // Do not read products or the inventory cache when disabling a site.
      await tx
        .update(stockMinimoEpisodiosTable)
        .set({ cerradoAt: new Date() })
        .where(
          and(
            eq(stockMinimoEpisodiosTable.ubicacionId, input.ubicacionId),
            isNull(stockMinimoEpisodiosTable.cerradoAt),
          ),
        );
    }

    await tx.insert(auditoriaTable).values({
      usuarioId: input.usuarioId,
      sitioId: input.ubicacionId,
      modulo: "inventario",
      accion: "CAMBIAR_CONFIGURACION_STOCK_MINIMO",
      entidad: "stock_minimo_sitios",
      entidadId: String(input.ubicacionId),
      datosAntes: { habilitado: before?.habilitado ?? false },
      datosDespues: { habilitado: input.habilitado },
      ip: input.ip,
    });
    return { ubicacionId: updated.ubicacionId, habilitado: updated.habilitado };
  });
}

export async function setStockMinimum(input: {
  productoId: number;
  ubicacionId: number;
  minimo: number | null;
  usuarioId: number;
  ip: string;
}): Promise<void> {
  assertMinimumValue(input.minimo);
  await db.transaction(async (tx) => {
    // Minimums may be prepared while the site switch is off. They remain
    // invisible and unevaluated until the switch is enabled.
    const site = await lockSiteConfiguration(tx, input.ubicacionId, true);

    const [product] = await tx
      .select({ id: productosTable.id, activo: productosTable.activo })
      .from(productosTable)
      .where(eq(productosTable.id, input.productoId))
      .limit(1);
    if (!product || !product.activo) {
      throw new StockMinimumError("Producto no encontrado.", "PRODUCT_NOT_FOUND");
    }

    const [before] = await tx
      .select()
      .from(stockMinimosTable)
      .where(
        and(
          eq(stockMinimosTable.productoId, input.productoId),
          eq(stockMinimosTable.ubicacionId, input.ubicacionId),
        ),
      )
      .for("update")
      .limit(1);

    if (input.minimo == null) {
      await tx
        .delete(stockMinimosTable)
        .where(eq(stockMinimosTable.id, before?.id ?? -1));
    } else if (before) {
      await tx
        .update(stockMinimosTable)
        .set({
          cantidad: quantityText(input.minimo),
          updatedBy: input.usuarioId,
          updatedAt: new Date(),
        })
        .where(eq(stockMinimosTable.id, before.id));
    } else {
      await tx.insert(stockMinimosTable).values({
        productoId: input.productoId,
        ubicacionId: input.ubicacionId,
        cantidad: quantityText(input.minimo),
        updatedBy: input.usuarioId,
      });
    }

    if (site?.habilitado) {
      await evaluateLockedSite(tx, input.ubicacionId);
    }
    await tx.insert(auditoriaTable).values({
      usuarioId: input.usuarioId,
      sitioId: input.ubicacionId,
      modulo: "inventario",
      accion: "CAMBIAR_STOCK_MINIMO",
      entidad: "stock_minimos",
      entidadId: `${input.productoId}:${input.ubicacionId}`,
      datosAntes: { minimo: before?.cantidad == null ? null : quantity(before.cantidad) },
      datosDespues: { minimo: input.minimo },
      ip: input.ip,
    });
  });
}

export async function evaluateEnabledStockMinimumSite(
  ubicacionId: number,
): Promise<void> {
  await db.transaction(async (tx) => {
    const site = await lockSiteConfiguration(tx, ubicacionId, false);
    if (!site?.habilitado) return;
    await evaluateLockedSite(tx, ubicacionId);
  });
}

export async function pollEnabledStockMinimums(): Promise<void> {
  // Configuration is intentionally the only query before the per-site
  // transactions. Disabled sites never reach product/cache reads.
  const sites = await db
    .select({ ubicacionId: stockMinimoSitiosTable.ubicacionId })
    .from(stockMinimoSitiosTable)
    .where(eq(stockMinimoSitiosTable.habilitado, true))
    .orderBy(asc(stockMinimoSitiosTable.ubicacionId));
  for (const site of sites) {
    await evaluateEnabledStockMinimumSite(site.ubicacionId);
  }
}

function waitForPoll(
  signal: AbortSignal,
  milliseconds: number,
): Promise<void> {
  if (signal.aborted) return Promise.resolve();
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, milliseconds);
    const onAbort = () => {
      clearTimeout(timer);
      resolve();
    };
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

export async function runStockMinimumPoller(input: {
  signal: AbortSignal;
  onError?: (error: unknown) => void;
}): Promise<void> {
  while (!input.signal.aborted) {
    try {
      await pollEnabledStockMinimums();
    } catch (error) {
      input.onError?.(error);
    }
    await waitForPoll(input.signal, STOCK_MINIMUM_POLL_INTERVAL_MS);
  }
}
