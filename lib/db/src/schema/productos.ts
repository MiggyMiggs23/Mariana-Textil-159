import {
  boolean,
  index,
  numeric,
  pgTable,
  serial,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";
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
    unidad: unidadProductoEnum("unidad").notNull(),
    precioSugerido: numeric("precio_sugerido", {
      precision: 12,
      scale: 2,
    }).notNull(),
    notas: text("notas"),
    activo: boolean("activo").notNull().default(true),
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
  ],
);

export const insertProductoSchema = createInsertSchema(productosTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertProducto = z.infer<typeof insertProductoSchema>;
export type Producto = typeof productosTable.$inferSelect;
