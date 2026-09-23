import { bigint, integer, jsonb, numeric, pgTable, primaryKey, serial, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { auditoriasInventarioTable } from "./auditorias-inventario";
import { movimientosTable, rollosTable } from "./rollos";
import { pisosTable, ubicacionesTable } from "./locations";
import { usuariosTable } from "./users";
import { salidasTable } from "./salidas";

/** Immutable close-time context; decisions never overwrite the audit snapshot. */
export const auditoriaSobranteContextosTable = pgTable("auditoria_sobrante_contextos", {
  auditoriaId: integer("auditoria_id").notNull().references(() => auditoriasInventarioTable.id),
  serie: text("serie").notNull(),
  contexto: jsonb("contexto").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [primaryKey({ columns: [t.auditoriaId, t.serie] })]);

export const auditoriaSobranteDecisionesTable = pgTable("auditoria_sobrante_decisiones", {
  id: serial("id").primaryKey(),
  auditoriaId: integer("auditoria_id").notNull().references(() => auditoriasInventarioTable.id),
  serie: text("serie").notNull(),
  rolloId: integer("rollo_id").references(() => rollosTable.id),
  decision: text("decision").notNull(),
  motivo: text("motivo").notNull(),
  usuarioId: integer("usuario_id").notNull().references(() => usuariosTable.id),
  salidaId: integer("salida_id").references(() => salidasTable.id),
  uuidCliente: uuid("uuid_cliente").notNull().unique(),
  contexto: jsonb("contexto").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** A provenance link is not a cancellation reference on movimientos. */
export const auditoriaFaltanteReactivacionesTable = pgTable("auditoria_faltante_reactivaciones", {
  id: serial("id").primaryKey(),
  rolloId: integer("rollo_id").notNull().references(() => rollosTable.id),
  auditoriaOrigenId: integer("auditoria_origen_id").notNull().references(() => auditoriasInventarioTable.id),
  movimientoBajaId: bigint("movimiento_baja_id", { mode: "number" }).notNull().unique().references(() => movimientosTable.id),
  movimientoReactivacionId: bigint("movimiento_reactivacion_id", { mode: "number" }).notNull().unique().references(() => movimientosTable.id),
  ubicacionAparicionId: integer("ubicacion_aparicion_id").notNull().references(() => ubicacionesTable.id),
  pisoAparicionId: integer("piso_aparicion_id").references(() => pisosTable.id),
  cantidadRestaurada: numeric("cantidad_restaurada", { precision: 10, scale: 3 }).notNull(),
  usuarioId: integer("usuario_id").notNull().references(() => usuariosTable.id),
  motivo: text("motivo").notNull(),
  origen: text("origen").notNull(),
  uuidCliente: uuid("uuid_cliente").notNull().unique(),
  auditoriasPosteriores: jsonb("auditorias_posteriores").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});