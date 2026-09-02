import {
  index,
  integer,
  numeric,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { ubicacionesTable } from "./locations";
import { proveedoresTable } from "./proveedores";
import { usuariosTable } from "./users";

// ── Entradas ───────────────────────────────────────────────────────────────
// Immutable header record for a whole inventory entry (recepción). Each entry
// groups the DISPONIBLE rolls it created (via rollos.recepcion_id) and the
// RECEPCION movements written in the same transaction. Rows are never updated
// or deleted.

export const entradasTable = pgTable(
  "entradas",
  {
    id: serial("id").primaryKey(),
    /** Human-facing folio, consecutive within its site. */
    folio: integer("folio").notNull(),
    ubicacionId: integer("ubicacion_id")
      .notNull()
      .references(() => ubicacionesTable.id),
    proveedorId: integer("proveedor_id").references(() => proveedoresTable.id),
    usuarioId: integer("usuario_id")
      .notNull()
      .references(() => usuariosTable.id),
    /** User-supplied entry date */
    fecha: timestamp("fecha", { withTimezone: true }).notNull(),
    observaciones: text("observaciones"),
    totalRollos: integer("total_rollos").notNull(),
    /** Null means the entry is pending administrative cost capture. */
    totalCosto: numeric("total_costo", { precision: 12, scale: 2 }),
    /** Client-supplied UUID for idempotency of the whole entry */
    uuidCliente: uuid("uuid_cliente").notNull().unique(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("entradas_ubicacion_folio_uidx").on(
      table.ubicacionId,
      table.folio,
    ),
    index("entradas_folio_idx").on(table.folio),
    index("entradas_ubicacion_idx").on(table.ubicacionId),
    index("entradas_proveedor_idx").on(table.proveedorId),
    index("entradas_fecha_idx").on(table.fecha),
    index("entradas_fecha_id_idx").on(table.fecha, table.id),
    index("entradas_uuid_cliente_idx").on(table.uuidCliente),
  ],
);

// ── Folio control ────────────────────────────────────────────────────────────
// One rollback-safe atomic folio counter per site. New sites start at zero, so
// their first entry receives folio 1.

export const entradaFolioTable = pgTable("entrada_folio", {
  ubicacionId: integer("ubicacion_id")
    .primaryKey()
    .references(() => ubicacionesTable.id),
  ultimoFolio: integer("ultimo_folio").notNull().default(0),
});

export const insertEntradaSchema = createInsertSchema(entradasTable).omit({
  id: true,
  createdAt: true,
});

export type InsertEntrada = z.infer<typeof insertEntradaSchema>;
export type Entrada = typeof entradasTable.$inferSelect;
export type EntradaFolio = typeof entradaFolioTable.$inferSelect;
