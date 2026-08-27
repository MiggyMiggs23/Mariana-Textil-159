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
import { movimientosCreditoTable } from "./pos";

/** Immutable evidence of the portion of an ABONO that settled a credit sale. */
export const aplicacionesCreditoTable = pgTable(
  "aplicaciones_credito",
  {
    id: serial("id").primaryKey(),
    abonoMovimientoId: integer("abono_movimiento_id")
      .notNull()
      .references(() => movimientosCreditoTable.id),
    ventaMovimientoId: integer("venta_movimiento_id")
      .notNull()
      .references(() => movimientosCreditoTable.id),
    importe: numeric("importe", { precision: 12, scale: 2 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    check("aplicaciones_credito_importe_check", sql`${table.importe} > 0`),
    unique("aplicaciones_credito_abono_venta_uidx").on(
      table.abonoMovimientoId,
      table.ventaMovimientoId,
    ),
    index("aplicaciones_credito_venta_idx").on(table.ventaMovimientoId),
  ],
);

export const insertAplicacionCreditoSchema = createInsertSchema(
  aplicacionesCreditoTable,
).omit({ id: true, createdAt: true });
export type InsertAplicacionCredito = z.infer<
  typeof insertAplicacionCreditoSchema
>;
export type AplicacionCredito = typeof aplicacionesCreditoTable.$inferSelect;