import {
  bigint,
  bigserial,
  check,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { entradasTable } from "./entradas";
import { movimientosTable, rollosTable } from "./rollos";
import { proveedoresTable } from "./proveedores";
import { ticketLineasTable, ticketsTable } from "./pos";

/**
 * Immutable physical consumption evidence for supplier utility.
 *
 * The table is intentionally additive and starts empty. Existing historical
 * tickets are not backfilled without definite physical evidence. Reversals
 * point at the original CONSUMO row instead of mutating/deleting history.
 */
export const ticketLineaConsumosTable = pgTable(
  "ticket_linea_consumos",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    ticketId: integer("ticket_id")
      .notNull()
      .references(() => ticketsTable.id),
    ticketLineaId: integer("ticket_linea_id")
      .notNull()
      .references(() => ticketLineasTable.id),
    movimientoId: bigint("movimiento_id", { mode: "number" })
      .notNull()
      .references(() => movimientosTable.id),
    rolloId: integer("rollo_id")
      .notNull()
      .references(() => rollosTable.id),
    entradaId: integer("entrada_id")
      .notNull()
      .references(() => entradasTable.id),
    proveedorId: integer("proveedor_id")
      .notNull()
      .references(() => proveedoresTable.id),
    cantidadMilesimas: bigint("cantidad_milesimas", {
      mode: "number",
    }).notNull(),
    ingresoCentavos: bigint("ingreso_centavos", {
      mode: "number",
    }).notNull(),
    costoCentavos: bigint("costo_centavos", {
      mode: "number",
    }),
    tipo: text("tipo")
      .$type<"CONSUMO" | "REVERSA">()
      .notNull(),
    reversaDeId: bigint("reversa_de_id", { mode: "number" }).references(
      (): any => ticketLineaConsumosTable.id,
    ),
    idempotencia: text("idempotencia").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("ticket_linea_consumos_ticket_linea_idx").on(table.ticketLineaId),
    index("ticket_linea_consumos_ticket_idx").on(table.ticketId),
    index("ticket_linea_consumos_rollo_idx").on(table.rolloId),
    index("ticket_linea_consumos_proveedor_idx").on(table.proveedorId),
    uniqueIndex("ticket_linea_consumos_idempotencia_uidx").on(
      table.idempotencia,
    ),
    check(
      "ticket_linea_consumos_cantidad_check",
      sql`${table.cantidadMilesimas} > 0`,
    ),
    check(
      "ticket_linea_consumos_importe_check",
      sql`${table.ingresoCentavos} >= 0 AND (${table.costoCentavos} IS NULL OR ${table.costoCentavos} >= 0)`,
    ),
    check(
      "ticket_linea_consumos_tipo_check",
      sql`(${table.tipo} = 'CONSUMO' AND ${table.reversaDeId} IS NULL)
        OR (${table.tipo} = 'REVERSA' AND ${table.reversaDeId} IS NOT NULL)`,
    ),
  ],
);

export type TicketLineaConsumo = typeof ticketLineaConsumosTable.$inferSelect;
export type NewTicketLineaConsumo =
  typeof ticketLineaConsumosTable.$inferInsert;