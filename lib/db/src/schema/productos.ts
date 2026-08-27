import {
  boolean,
  check,
  index,
  numeric,
  pgTable,
  serial,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { unidadProductoEnum } from "./enums";

export const productosTable = pgTable(
  "productos",
  {
    id: serial("id").primaryKey(),
    sku: text("sku").notNull().unique(),
    tela: text("tela").notNull(),
    color: text("color").notNull(),
    colorHex: text("color_hex"),
    unidad: unidadProductoEnum("unidad").notNull(),
    precioSugerido: numeric("precio_sugerido", {
      precision: 12,
      scale: 2,
    }).notNull(),
    precioMayoreo: numeric("precio_mayoreo", {
      precision: 12,
      scale: 2,
    }),
    precioMenudeo: numeric("precio_menudeo", {
      precision: 12,
      scale: 2,
    }),
    notas: text("notas"),
    activo: boolean("activo").notNull().default(true),
    seVendePorMetro: boolean("se_vende_por_metro").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    unique("productos_tela_color_unique").on(table.tela, table.color),
    index("productos_tela_color_idx").on(table.tela, table.color),
    index("productos_sku_idx").on(table.sku),
    check(
      "productos_kilo_no_venta_metro_check",
      sql`${table.unidad} <> 'KILO' OR ${table.seVendePorMetro} = false`,
    ),
    check(
      "productos_color_hex_check",
      sql`${table.colorHex} IS NULL OR ${table.colorHex} ~ '^#[0-9A-F]{6}$'`,
    ),
  ],
);

export const insertProductoSchema = createInsertSchema(productosTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertProducto = z.infer<typeof insertProductoSchema>;
export type Producto = typeof productosTable.$inferSelect;
