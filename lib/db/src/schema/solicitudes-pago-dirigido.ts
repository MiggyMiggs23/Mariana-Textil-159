import { index, integer, numeric, pgEnum, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usuariosTable } from "./users";

/** A reviewable exception to the normal FIFO payment allocation. */
export const tipoSolicitudPagoDirigidoEnum = pgEnum("tipo_solicitud_pago_dirigido", ["CLIENTE", "PROVEEDOR"]);
export const estadoSolicitudPagoDirigidoEnum = pgEnum("estado_solicitud_pago_dirigido", ["PENDIENTE", "APROBADA", "RECHAZADA"]);

export const solicitudesPagoDirigidoTable = pgTable("solicitudes_pago_dirigido", {
  id: serial("id").primaryKey(),
  tipo: tipoSolicitudPagoDirigidoEnum("tipo").notNull(),
  entidadId: integer("entidad_id").notNull(),
  documentoMovimientoId: integer("documento_movimiento_id").notNull(),
  importe: numeric("importe", { precision: 12, scale: 2 }).notNull(),
  formaPago: text("forma_pago").notNull(),
  cuentaDestino: text("cuenta_destino"),
  fechaEfectiva: timestamp("fecha_efectiva", { withTimezone: true }),
  referencia: text("referencia"),
  notas: text("notas"),
  motivo: text("motivo").notNull(),
  motivoRechazo: text("motivo_rechazo"),
  solicitanteId: integer("solicitante_id").notNull().references(() => usuariosTable.id),
  solicitanteNombre: text("solicitante_nombre").notNull(),
  autorizadorId: integer("autorizador_id").references(() => usuariosTable.id),
  autorizadorNombre: text("autorizador_nombre"),
  contraparteNombre: text("contraparte_nombre").notNull(),
  documentoFolio: text("documento_folio").notNull(),
  ubicacionId: integer("ubicacion_id"),
  ubicacionNombre: text("ubicacion_nombre"),
  movimientoId: integer("movimiento_id"),
  estado: estadoSolicitudPagoDirigidoEnum("estado").notNull().default("PENDIENTE"),
  resueltaAt: timestamp("resuelta_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("solicitudes_pago_dirigido_estado_idx").on(table.estado, table.createdAt),
  index("solicitudes_pago_dirigido_entidad_idx").on(table.tipo, table.entidadId),
]);

export const insertSolicitudPagoDirigidoSchema = createInsertSchema(solicitudesPagoDirigidoTable).omit({
  id: true, createdAt: true, resueltaAt: true,
});
export type InsertSolicitudPagoDirigido = z.infer<typeof insertSolicitudPagoDirigidoSchema>;
export type SolicitudPagoDirigido = typeof solicitudesPagoDirigidoTable.$inferSelect;