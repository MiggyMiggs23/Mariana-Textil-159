import {
  bigint,
  boolean,
  check,
  integer,
  index,
  numeric,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { productosTable } from "./productos";
import { ubicacionesTable } from "./locations";
import { usuariosTable } from "./users";
import { movimientosTable } from "./rollos";

/**
 * Site-level switch for the minimum-stock engine.  A missing row is equivalent
 * to a disabled site; the startup migration deliberately does not seed rows.
 */
export const stockMinimoSitiosTable = pgTable("stock_minimo_sitios", {
  ubicacionId: integer("ubicacion_id")
    .primaryKey()
    .references(() => ubicacionesTable.id),
  habilitado: boolean("habilitado").notNull().default(false),
  updatedBy: integer("updated_by").references(() => usuariosTable.id),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/**
 * Configuration is separate from existencias because existencias is a
 * reconstructible inventory cache.  The same product can therefore have a
 * different minimum at every site.
 */
export const stockMinimosTable = pgTable(
  "stock_minimos",
  {
    id: serial("id").primaryKey(),
    productoId: integer("producto_id")
      .notNull()
      .references(() => productosTable.id),
    ubicacionId: integer("ubicacion_id")
      .notNull()
      .references(() => ubicacionesTable.id),
    cantidad: numeric("cantidad", { precision: 18, scale: 3 }).notNull(),
    updatedBy: integer("updated_by").references(() => usuariosTable.id),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("stock_minimos_producto_ubicacion_uidx").on(
      table.productoId,
      table.ubicacionId,
    ),
    index("stock_minimos_ubicacion_idx").on(table.ubicacionId),
    check("stock_minimos_cantidad_nonnegative_check", sql`${table.cantidad} >= 0`),
  ],
);

/**
 * An episode is the durable low-stock condition.  Its partial unique index
 * permits history while preventing two active episodes for the same pair.
 */
export const stockMinimoEpisodiosTable = pgTable(
  "stock_minimo_episodios",
  {
    id: serial("id").primaryKey(),
    productoId: integer("producto_id")
      .notNull()
      .references(() => productosTable.id),
    ubicacionId: integer("ubicacion_id")
      .notNull()
      .references(() => ubicacionesTable.id),
    minimo: numeric("minimo", { precision: 18, scale: 3 }).notNull(),
    existencia: numeric("existencia", { precision: 18, scale: 3 }).notNull(),
    diferencia: numeric("diferencia", { precision: 18, scale: 3 }).notNull(),
    abiertoAt: timestamp("abierto_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    cerradoAt: timestamp("cerrado_at", { withTimezone: true }),
    /**
     * Evidence for why this episode was opened. A movement id below is a
     * snapshot unless this field explicitly says MOVIMIENTO.
     */
    causa: text("causa")
      .$type<"MOVIMIENTO" | "CONFIGURACION" | "SNAPSHOT">()
      .notNull()
      .default("SNAPSHOT"),
    movimientoId: bigint("movimiento_id", { mode: "number" }).references(
      () => movimientosTable.id,
    ),
  },
  (table) => [
    uniqueIndex("stock_minimo_episodios_activo_uidx")
      .on(table.productoId, table.ubicacionId)
      .where(sql`${table.cerradoAt} IS NULL`),
    index("stock_minimo_episodios_ubicacion_abierto_idx").on(
      table.ubicacionId,
      table.cerradoAt,
    ),
    check("stock_minimo_episodios_minimo_nonnegative_check", sql`${table.minimo} >= 0`),
    check(
      "stock_minimo_episodios_existencia_nonnegative_check",
      sql`${table.existencia} >= 0`,
    ),
    check(
      "stock_minimo_episodios_diferencia_nonnegative_check",
      sql`${table.diferencia} >= 0`,
    ),
  ],
);

export type StockMinimoSitio = typeof stockMinimoSitiosTable.$inferSelect;
export type StockMinimo = typeof stockMinimosTable.$inferSelect;
export type StockMinimoEpisodio = typeof stockMinimoEpisodiosTable.$inferSelect;