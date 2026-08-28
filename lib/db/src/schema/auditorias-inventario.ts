import {
  index,
  integer,
  numeric,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { rollosTable } from "./rollos";
import { ubicacionesTable } from "./locations";
import { usuariosTable } from "./users";

export const auditoriaInventarioFolioTable = pgTable(
  "auditoria_inventario_folio",
  {
    ubicacionId: integer("ubicacion_id")
      .primaryKey()
      .references(() => ubicacionesTable.id),
    ultimoFolio: integer("ultimo_folio").notNull().default(0),
  },
);

export const auditoriasInventarioTable = pgTable(
  "auditorias_inventario",
  {
    id: serial("id").primaryKey(),
    folio: integer("folio").notNull(),
    ubicacionId: integer("ubicacion_id")
      .notNull()
      .references(() => ubicacionesTable.id),
    estado: text("estado").notNull().default("ABIERTA"),
    creadaPorId: integer("creada_por_id")
      .notNull()
      .references(() => usuariosTable.id),
    cerradaPorId: integer("cerrada_por_id").references(() => usuariosTable.id),
    confirmadaPorId: integer("confirmada_por_id").references(() => usuariosTable.id),
    canceladaPorId: integer("cancelada_por_id").references(() => usuariosTable.id),
    motivoCancelacion: text("motivo_cancelacion"),
    abiertaAt: timestamp("abierta_at", { withTimezone: true }).notNull().defaultNow(),
    cerradaAt: timestamp("cerrada_at", { withTimezone: true }),
    confirmadaAt: timestamp("confirmada_at", { withTimezone: true }),
    canceladaAt: timestamp("cancelada_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("auditorias_inventario_ubicacion_folio_unique").on(
      table.ubicacionId,
      table.folio,
    ),
    uniqueIndex("auditorias_inventario_una_abierta_por_sitio")
      .on(table.ubicacionId)
      .where(sql`${table.estado} = 'ABIERTA'`),
    index("auditorias_inventario_ubicacion_idx").on(table.ubicacionId),
  ],
);

export const auditoriaInventarioSnapshotTable = pgTable(
  "auditoria_inventario_snapshot",
  {
    auditoriaId: integer("auditoria_id")
      .notNull()
      .references(() => auditoriasInventarioTable.id),
    rolloId: integer("rollo_id")
      .notNull()
      .references(() => rollosTable.id),
    serie: text("serie").notNull(),
    cantidadSnapshot: numeric("cantidad_snapshot", {
      precision: 10,
      scale: 3,
    }).notNull(),
    skuSnapshot: text("sku_snapshot").notNull(),
    telaSnapshot: text("tela_snapshot").notNull(),
    colorSnapshot: text("color_snapshot").notNull(),
    unidadSnapshot: text("unidad_snapshot").notNull(),
    ubicacionSnapshotId: integer("ubicacion_snapshot_id")
      .notNull()
      .references(() => ubicacionesTable.id),
    ubicacionSnapshot: text("ubicacion_snapshot").notNull(),
    estadoSnapshot: text("estado_snapshot").notNull(),
    resolucion: text("resolucion").notNull().default("PENDIENTE"),
  },
  (table) => [
    primaryKey({ columns: [table.auditoriaId, table.serie] }),
    index("auditoria_inventario_snapshot_rollo_idx").on(table.rolloId),
  ],
);

export const auditoriaInventarioEscaneosTable = pgTable(
  "auditoria_inventario_escaneos",
  {
    auditoriaId: integer("auditoria_id")
      .notNull()
      .references(() => auditoriasInventarioTable.id),
    serie: text("serie").notNull(),
    rolloId: integer("rollo_id").references(() => rollosTable.id),
    usuarioId: integer("usuario_id")
      .notNull()
      .references(() => usuariosTable.id),
    escaneadoAt: timestamp("escaneado_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    cantidadCierre: numeric("cantidad_cierre", { precision: 10, scale: 3 }),
    skuCierre: text("sku_cierre"),
    telaCierre: text("tela_cierre"),
    colorCierre: text("color_cierre"),
    unidadCierre: text("unidad_cierre"),
    estadoCierre: text("estado_cierre"),
    ubicacionCierreId: integer("ubicacion_cierre_id").references(
      () => ubicacionesTable.id,
    ),
    ubicacionCierre: text("ubicacion_cierre"),
    resolucion: text("resolucion").notNull().default("PENDIENTE"),
  },
  (table) => [
    primaryKey({ columns: [table.auditoriaId, table.serie] }),
    index("auditoria_inventario_escaneos_usuario_idx").on(table.usuarioId),
  ],
);

export const auditoriaInventarioParticipantesTable = pgTable(
  "auditoria_inventario_participantes",
  {
    auditoriaId: integer("auditoria_id")
      .notNull()
      .references(() => auditoriasInventarioTable.id),
    usuarioId: integer("usuario_id")
      .notNull()
      .references(() => usuariosTable.id),
    escaneos: integer("escaneos").notNull().default(0),
    primeroAt: timestamp("primero_at", { withTimezone: true }).notNull().defaultNow(),
    ultimoAt: timestamp("ultimo_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.auditoriaId, table.usuarioId] }),
  ],
);

export const insertAuditoriaInventarioSchema = createInsertSchema(
  auditoriasInventarioTable,
).omit({ id: true, abiertaAt: true });
export type InsertAuditoriaInventario = z.infer<
  typeof insertAuditoriaInventarioSchema
>;
export type AuditoriaInventario =
  typeof auditoriasInventarioTable.$inferSelect;