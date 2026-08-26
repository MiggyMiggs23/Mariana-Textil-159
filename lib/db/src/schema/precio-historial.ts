import {
  boolean,
  index,
  integer,
  numeric,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { productosTable } from "./productos";
import { usuariosTable } from "./users";

/** Immutable ledger of catalog list-price changes. */
export const precioHistorialTable = pgTable(
  "precio_historial",
  {
    id: serial("id").primaryKey(),
    productoId: integer("producto_id")
      .notNull()
      .references(() => productosTable.id),
    precioListaAnterior: numeric("precio_lista_anterior", {
      precision: 12,
      scale: 2,
    }).notNull(),
    precioListaNuevo: numeric("precio_lista_nuevo", {
      precision: 12,
      scale: 2,
    }).notNull(),
    costoUnitarioPonderado: numeric("costo_unitario_ponderado", {
      precision: 12,
      scale: 2,
    }),
    margenPesosUnidad: numeric("margen_pesos_unidad", {
      precision: 12,
      scale: 2,
    }),
    margenPorcentajeSubtotal: numeric("margen_porcentaje_subtotal", {
      precision: 7,
      scale: 4,
    }),
    motivo: text("motivo").notNull(),
    advertenciaBajoCosto: boolean("advertencia_bajo_costo").notNull().default(false),
    usuarioId: integer("usuario_id")
      .notNull()
      .references(() => usuariosTable.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("precio_historial_producto_created_idx").on(
      table.productoId,
      table.createdAt,
    ),
  ],
);

export type PrecioHistorial = typeof precioHistorialTable.$inferSelect;