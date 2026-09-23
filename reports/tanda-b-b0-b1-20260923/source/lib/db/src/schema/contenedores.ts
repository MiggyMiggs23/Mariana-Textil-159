import {
  check,
  date,
  index,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { entradasTable } from "./entradas";
import { ubicacionesTable } from "./locations";
import { proveedoresTable } from "./proveedores";
import { usuariosTable } from "./users";

export const contenedoresTable = pgTable(
  "contenedores",
  {
    id: serial("id").primaryKey(),
    /** Database-allocated human-facing sequence; its sequence starts at 1. */
    folio: serial("folio").notNull(),
    proveedorId: integer("proveedor_id")
      .notNull()
      .references(() => proveedoresTable.id),
    referencia: text("referencia"),
    fechaPedido: date("fecha_pedido", { mode: "string" }),
    fechaEstimadaLlegada: date("fecha_estimada_llegada", {
      mode: "string",
    }).notNull(),
    fechaRealLlegada: date("fecha_real_llegada", { mode: "string" }),
    sitioDestinoId: integer("sitio_destino_id")
      .notNull()
      .references(() => ubicacionesTable.id),
    entradaId: integer("entrada_id").references(() => entradasTable.id),
    estado: text("estado").notNull().default("EN_TRANSITO"),
    notas: text("notas"),
    motivoCancelacion: text("motivo_cancelacion"),
    usuarioId: integer("usuario_id")
      .notNull()
      .references(() => usuariosTable.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    unique("contenedores_folio_unique").on(table.folio),
    unique("contenedores_entrada_unique").on(table.entradaId),
    check(
      "contenedores_estado_check",
      sql`${table.estado} IN ('EN_TRANSITO', 'RECIBIDO', 'CANCELADO')`,
    ),
    check(
      "contenedores_cancelacion_check",
      sql`${table.estado} <> 'CANCELADO' OR char_length(${table.motivoCancelacion}) >= 10`,
    ),
    check(
      "contenedores_recepcion_check",
      sql`${table.estado} <> 'RECIBIDO' OR (${table.entradaId} IS NOT NULL AND ${table.fechaRealLlegada} IS NOT NULL)`,
    ),
    index("contenedores_estado_idx").on(table.estado),
    index("contenedores_proveedor_idx").on(table.proveedorId),
    index("contenedores_fecha_estimada_idx").on(table.fechaEstimadaLlegada),
    index("contenedores_sitio_estado_idx").on(
      table.sitioDestinoId,
      table.estado,
    ),
  ],
);

export const insertContenedorSchema = createInsertSchema(
  contenedoresTable,
).omit({
  id: true,
  folio: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertContenedor = z.infer<typeof insertContenedorSchema>;
export type Contenedor = typeof contenedoresTable.$inferSelect;
export type EstadoContenedor = "EN_TRANSITO" | "RECIBIDO" | "CANCELADO";