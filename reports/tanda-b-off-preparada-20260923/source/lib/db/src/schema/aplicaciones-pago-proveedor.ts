import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  numeric,
  pgTable,
  serial,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { pagosProveedorTable } from "./pagos-proveedor";

/** Immutable evidence that a supplier payment settled a supplier purchase. */
export const aplicacionesPagoProveedorTable = pgTable(
  "aplicaciones_pago_proveedor",
  {
    id: serial("id").primaryKey(),
    pagoProveedorId: integer("pago_proveedor_id")
      .notNull()
      .references(() => pagosProveedorTable.id),
    compraProveedorId: integer("compra_proveedor_id")
      .notNull()
      .references(() => pagosProveedorTable.id),
    importe: numeric("importe", { precision: 12, scale: 2 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check("aplicaciones_pago_proveedor_importe_check", sql`${table.importe} > 0`),
    unique("aplicaciones_pago_proveedor_pago_compra_uidx").on(
      table.pagoProveedorId,
      table.compraProveedorId,
    ),
    index("aplicaciones_pago_proveedor_compra_idx").on(table.compraProveedorId),
  ],
);

export const insertAplicacionPagoProveedorSchema = createInsertSchema(
  aplicacionesPagoProveedorTable,
).omit({ id: true, createdAt: true });
export type InsertAplicacionPagoProveedor = z.infer<typeof insertAplicacionPagoProveedorSchema>;
export type AplicacionPagoProveedor = typeof aplicacionesPagoProveedorTable.$inferSelect;