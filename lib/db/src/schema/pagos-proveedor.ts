import { sql } from "drizzle-orm";
import {
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { entradasTable } from "./entradas";
import { proveedoresTable } from "./proveedores";
import { usuariosTable } from "./users";

// ── Enums ─────────────────────────────────────────────────────────────────────

/**
 * COMPRA  – positivo: deuda generada al recibir mercancía (linked to entrada)
 * PAGO    – negativo: abono en efectivo / transferencia / cheque
 * AJUSTE  – signed:   corrección manual con justificación
 */
export const tipoPagoProveedorEnum = pgEnum("tipo_pago_proveedor", [
  "COMPRA",
  "PAGO",
  "AJUSTE",
]);

export const formaPagoProveedorEnum = pgEnum("forma_pago_proveedor", [
  "EFECTIVO",
  "TRANSFERENCIA",
  "CHEQUE",
  "OTRO",
]);

export type TipoPagoProveedor =
  (typeof tipoPagoProveedorEnum.enumValues)[number];
export type FormaPagoProveedor =
  (typeof formaPagoProveedorEnum.enumValues)[number];

// ── Table ─────────────────────────────────────────────────────────────────────

/**
 * Ledger of all monetary movements for each supplier.
 *
 * Accounting invariant:
 *   saldo = SUM(importe)  per proveedor_id
 *   COMPRA  → importe > 0  (generates debt)
 *   PAGO    → importe < 0  (reduces debt)
 *   AJUSTE  → signed       (positive or negative correction)
 *
 * Idempotency for COMPRA:
 *   The partial unique index on (entrada_id) WHERE tipo = 'COMPRA' ensures
 *   each entrada generates at most one COMPRA row, supporting insert-only
 *   backfill without duplicates.
 *
 * Rows are immutable once inserted (no UPDATE/DELETE on this table).
 */
export const pagosProveedorTable = pgTable(
  "pagos_proveedor",
  {
    id: serial("id").primaryKey(),
    /** FK to proveedores – identifies whose ledger this row belongs to */
    proveedorId: integer("proveedor_id")
      .notNull()
      .references(() => proveedoresTable.id),
    /** FK to entradas – non-null only for COMPRA rows */
    entradaId: integer("entrada_id").references(() => entradasTable.id),
    /**
     * Signed monetary amount.
     * COMPRA: positive (total cost of the entry)
     * PAGO:   negative (payment reduces debt)
     * AJUSTE: can be positive or negative
     */
    importe: numeric("importe", { precision: 12, scale: 2 }).notNull(),
    tipo: tipoPagoProveedorEnum("tipo").notNull(),
    /** Only for PAGO rows */
    formaPago: formaPagoProveedorEnum("forma_pago"),
    /** External reference: transfer number, cheque number, etc. */
    referencia: text("referencia"),
    /** Effective date of the movement (may differ from created_at) */
    fecha: timestamp("fecha", { withTimezone: true }).notNull(),
    /** Who registered this movement */
    usuarioId: integer("usuario_id")
      .notNull()
      .references(() => usuariosTable.id),
    notas: text("notas"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    // Fast queries for account statement and dashboard
    index("pagos_proveedor_proveedor_fecha_idx").on(
      table.proveedorId,
      table.fecha,
    ),
    // Prevent double-inserting a COMPRA for the same entrada (idempotency)
    uniqueIndex("pagos_proveedor_entrada_compra_idx")
      .on(table.entradaId)
      .where(sql`tipo = 'COMPRA' AND entrada_id IS NOT NULL`),
  ],
);

export const insertPagoProveedorSchema = createInsertSchema(
  pagosProveedorTable,
).omit({ id: true, createdAt: true });

export type InsertPagoProveedor = z.infer<typeof insertPagoProveedorSchema>;
export type PagoProveedor = typeof pagosProveedorTable.$inferSelect;
