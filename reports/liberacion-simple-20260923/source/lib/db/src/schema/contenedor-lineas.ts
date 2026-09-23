import {
  check,
  index,
  integer,
  numeric,
  pgTable,
  serial,
  text,
  unique,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { contenedoresTable } from "./contenedores";
import { productosTable } from "./productos";

export const contenedorLineasTable = pgTable(
  "contenedor_lineas",
  {
    id: serial("id").primaryKey(),
    contenedorId: integer("contenedor_id")
      .notNull()
      .references(() => contenedoresTable.id, { onDelete: "cascade" }),
    productoId: integer("producto_id")
      .notNull()
      .references(() => productosTable.id),
    cantidadEsperada: numeric("cantidad_esperada", {
      precision: 10,
      scale: 3,
    }).notNull(),
    rollosEsperados: integer("rollos_esperados"),
    nota: text("nota"),
  },
  (table) => [
    unique("contenedor_lineas_contenedor_producto_unique").on(
      table.contenedorId,
      table.productoId,
    ),
    check(
      "contenedor_lineas_cantidad_check",
      sql`${table.cantidadEsperada} > 0`,
    ),
    check(
      "contenedor_lineas_rollos_check",
      sql`${table.rollosEsperados} IS NULL OR ${table.rollosEsperados} > 0`,
    ),
    index("contenedor_lineas_contenedor_idx").on(table.contenedorId),
    index("contenedor_lineas_producto_idx").on(table.productoId),
  ],
);

export const insertContenedorLineaSchema = createInsertSchema(
  contenedorLineasTable,
).omit({ id: true });

export type InsertContenedorLinea = z.infer<
  typeof insertContenedorLineaSchema
>;
export type ContenedorLinea = typeof contenedorLineasTable.$inferSelect;