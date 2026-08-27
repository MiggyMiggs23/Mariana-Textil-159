import { index, integer, pgTable, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { camionetasTable } from "./camionetas";
import { choferesTable } from "./choferes";
import { ubicacionesTable } from "./locations";
import { salidasTable } from "./salidas";
import { ticketsTable } from "./pos";
import { usuariosTable } from "./users";

/** Historical dispatch record. A trip deliberately has no completion lifecycle. */
export const viajesTable = pgTable("viajes", {
  id: serial("id").primaryKey(),
  folio: integer("folio").notNull(),
  origenId: integer("origen_id").notNull().references(() => ubicacionesTable.id),
  camionetaId: integer("camioneta_id").notNull().references(() => camionetasTable.id),
  choferId: integer("chofer_id").notNull().references(() => choferesTable.id),
  salidaAt: timestamp("salida_at", { withTimezone: true }).notNull(),
  observaciones: text("observaciones"),
  creadoPorId: integer("creado_por_id").notNull().references(() => usuariosTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("viajes_origen_folio_uidx").on(table.origenId, table.folio),
  index("viajes_salida_at_idx").on(table.salidaAt),
  index("viajes_camioneta_idx").on(table.camionetaId),
  index("viajes_chofer_idx").on(table.choferId),
]);

/** Stable links enforce that a source document is dispatched in at most one trip. */
export const viajeTicketsTable = pgTable("viaje_tickets", {
  viajeId: integer("viaje_id").notNull().references(() => viajesTable.id),
  ticketId: integer("ticket_id").notNull().references(() => ticketsTable.id),
}, (table) => [
  uniqueIndex("viaje_tickets_ticket_uidx").on(table.ticketId),
  index("viaje_tickets_viaje_idx").on(table.viajeId),
]);

export const viajeSalidasTable = pgTable("viaje_salidas", {
  viajeId: integer("viaje_id").notNull().references(() => viajesTable.id),
  salidaId: integer("salida_id").notNull().references(() => salidasTable.id),
}, (table) => [
  uniqueIndex("viaje_salidas_salida_uidx").on(table.salidaId),
  index("viaje_salidas_viaje_idx").on(table.viajeId),
]);

export const viajeFolioTable = pgTable("viaje_folio", {
  ubicacionId: integer("ubicacion_id").primaryKey().references(() => ubicacionesTable.id),
  ultimoFolio: integer("ultimo_folio").notNull().default(0),
});

export type Viaje = typeof viajesTable.$inferSelect;