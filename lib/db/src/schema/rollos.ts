import {
  bigserial,
  index,
  integer,
  numeric,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  boolean,
  uuid,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { estadoRolloEnum, tipoMovimientoEnum } from "./enums";
import { productosTable } from "./productos";
import { ubicacionesTable } from "./locations";
import { proveedoresTable } from "./proveedores";
import { usuariosTable } from "./users";

// ── Rollos ───────────────────────────────────────────────────────────────────
// Each rollo is a physical roll of fabric with a globally unique numeric series.
// serie stores only the numeric string (e.g. "1000042"); the QR payload
// (SKU-SERIE) is composed in the frontend.

export const rollosTable = pgTable(
  "rollos",
  {
    id: serial("id").primaryKey(),
    /** Globally unique numeric series string e.g. "1000042" */
    serie: text("serie").notNull().unique(),
    productoId: integer("producto_id")
      .notNull()
      .references(() => productosTable.id),
    /** Current physical location */
    ubicacionId: integer("ubicacion_id")
      .notNull()
      .references(() => ubicacionesTable.id),
    proveedorId: integer("proveedor_id").references(() => proveedoresTable.id),
    /** FK to a reception record (future use, nullable now) */
    recepcionId: integer("recepcion_id"),
    /** Self-referential FK for split rolls (future use, nullable) */
    rolloOrigenId: integer("rollo_origen_id"),
    estado: estadoRolloEnum("estado").notNull().default("PROGRAMADO"),
    /** Original quantity at intake */
    cantidadInicial: numeric("cantidad_inicial", {
      precision: 10,
      scale: 3,
    }).notNull(),
    /** Current quantity (decremented on adjustments / cuts) */
    cantidadActual: numeric("cantidad_actual", {
      precision: 10,
      scale: 3,
    }).notNull(),
    costoUnitario: numeric("costo_unitario", {
      precision: 12,
      scale: 2,
    }),
    costoTotal: numeric("costo_total", { precision: 12, scale: 2 }),
    notas: text("notas"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("rollos_producto_idx").on(table.productoId),
    index("rollos_ubicacion_idx").on(table.ubicacionId),
    index("rollos_estado_idx").on(table.estado),
    index("rollos_serie_idx").on(table.serie),
  ],
);

// ── Movimientos ──────────────────────────────────────────────────────────────
// Immutable accounting ledger. Every inventory change MUST produce a movement
// inside the same transaction. Rows are never deleted.

export const movimientosTable = pgTable(
  "movimientos",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    rolloId: integer("rollo_id")
      .notNull()
      .references(() => rollosTable.id),
    productoId: integer("producto_id")
      .notNull()
      .references(() => productosTable.id),
    ubicacionId: integer("ubicacion_id")
      .notNull()
      .references(() => ubicacionesTable.id),
    tipo: tipoMovimientoEnum("tipo").notNull(),
    /** Signed quantity: positive = stock in, negative = stock out */
    cantidad: numeric("cantidad", { precision: 10, scale: 3 }).notNull(),
    /** Running ledger total after this movement (producto × ubicacion) */
    saldoPosterior: numeric("saldo_posterior", {
      precision: 10,
      scale: 3,
    }).notNull(),
    /** Reference document type (e.g. "ORDEN_COMPRA", "FACTURA") */
    documentoTipo: text("documento_tipo"),
    /** Reference document identifier */
    documentoId: text("documento_id"),
    /** Self-FK: the movement this one cancels/reverses */
    movimientoOrigenId: integer("movimiento_origen_id"),
    /** Non-null: every movement must be attributed */
    usuarioId: integer("usuario_id")
      .notNull()
      .references(() => usuariosTable.id),
    justificacion: text("justificacion"),
    /** True for normal movements; false for adjustments pending review */
    revisado: boolean("revisado").notNull().default(true),
    revisadoPor: integer("revisado_por").references(() => usuariosTable.id),
    revisadoAt: timestamp("revisado_at", { withTimezone: true }),
    /**
     * Client-supplied UUID for idempotency.
     * Duplicate uuid_cliente returns the original result without re-inserting.
     */
    uuidCliente: uuid("uuid_cliente").unique(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("movimientos_rollo_idx").on(table.rolloId),
    index("movimientos_producto_ubicacion_idx").on(
      table.productoId,
      table.ubicacionId,
    ),
    index("movimientos_tipo_idx").on(table.tipo),
    index("movimientos_created_idx").on(table.createdAt),
    index("movimientos_revisado_idx").on(table.revisado),
    index("movimientos_uuid_cliente_idx").on(table.uuidCliente),
  ],
);

// ── Existencias ──────────────────────────────────────────────────────────────
// Materialized cache: (producto_id, ubicacion_id) composite PK.
// cantidad_total MUST equal SUM(movimientos.cantidad) for that pair.
// rollos_count is the count of DISPONIBLE rolls physically on hand.

export const existenciasTable = pgTable(
  "existencias",
  {
    productoId: integer("producto_id")
      .notNull()
      .references(() => productosTable.id),
    ubicacionId: integer("ubicacion_id")
      .notNull()
      .references(() => ubicacionesTable.id),
    cantidadTotal: numeric("cantidad_total", {
      precision: 10,
      scale: 3,
    })
      .notNull()
      .default("0"),
    rollosCount: integer("rollos_count").notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    primaryKey({ columns: [table.productoId, table.ubicacionId] }),
    index("existencias_producto_idx").on(table.productoId),
    index("existencias_ubicacion_idx").on(table.ubicacionId),
  ],
);

// ── Insert schemas / types ────────────────────────────────────────────────────

export const insertRolloSchema = createInsertSchema(rollosTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertMovimientoSchema = createInsertSchema(movimientosTable).omit(
  { id: true, createdAt: true },
);

export const insertExistenciaSchema = createInsertSchema(existenciasTable).omit(
  { updatedAt: true },
);

export type InsertRollo = z.infer<typeof insertRolloSchema>;
export type Rollo = typeof rollosTable.$inferSelect;
export type InsertMovimiento = z.infer<typeof insertMovimientoSchema>;
export type Movimiento = typeof movimientosTable.$inferSelect;
export type InsertExistencia = z.infer<typeof insertExistenciaSchema>;
export type Existencia = typeof existenciasTable.$inferSelect;
