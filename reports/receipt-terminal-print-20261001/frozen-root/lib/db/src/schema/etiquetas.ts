import {
  index,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { rollosTable } from "./rollos";
import { usuariosTable } from "./users";
import { ubicacionesTable } from "./locations";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/** Immutable audit trail. Reprint records must never be deleted. */
export const reimpresionesEtiquetaTable = pgTable(
  "reimpresiones_etiqueta",
  {
    id: serial("id").primaryKey(),
    rolloId: integer("rollo_id").notNull().references(() => rollosTable.id),
    usuarioId: integer("usuario_id").notNull().references(() => usuariosTable.id),
    autorizadoPor: integer("autorizado_por").references(() => usuariosTable.id),
    motivo: text("motivo").notNull(),
    sitioId: integer("sitio_id").notNull().references(() => ubicacionesTable.id),
    serieSnapshot: text("serie_snapshot").notNull(),
    skuSnapshot: text("sku_snapshot").notNull(),
    productoSnapshot: text("producto_snapshot").notNull(),
    telaSnapshot: text("tela_snapshot").notNull(),
    colorSnapshot: text("color_snapshot").notNull(),
    solicitanteNombreSnapshot: text("solicitante_nombre_snapshot").notNull(),
    solicitanteUsuarioSnapshot: text("solicitante_usuario_snapshot").notNull(),
    autorizadorNombreSnapshot: text("autorizador_nombre_snapshot"),
    autorizadorUsuarioSnapshot: text("autorizador_usuario_snapshot"),
    sitioNombreSnapshot: text("sitio_nombre_snapshot").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("reimpresiones_etiqueta_rollo_idx").on(table.rolloId),
    index("reimpresiones_etiqueta_created_at_idx").on(table.createdAt),
    index("reimpresiones_etiqueta_usuario_idx").on(table.usuarioId),
  ],
);

export type ReimpresionEtiqueta = typeof reimpresionesEtiquetaTable.$inferSelect;

/**
 * Append-only control history for the ADMIN review of a repeated reprint.
 *
 * A review points at the exact last reprint it covered.  The unique pair is
 * also the database-level idempotency key: retrying the same watermark cannot
 * create a second review event, while a later reprint necessarily has a new
 * watermark and becomes pending again.
 */
export const revisionesEtiquetaTable = pgTable(
  "revisiones_etiqueta",
  {
    id: serial("id").primaryKey(),
    rolloId: integer("rollo_id").notNull().references(() => rollosTable.id),
    reimpresionId: integer("reimpresion_id")
      .notNull()
      .references(() => reimpresionesEtiquetaTable.id),
    usuarioId: integer("usuario_id").notNull().references(() => usuariosTable.id),
    revisorNombreSnapshot: text("revisor_nombre_snapshot").notNull(),
    revisorUsuarioSnapshot: text("revisor_usuario_snapshot").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("revisiones_etiqueta_rollo_reimpresion_uidx").on(
      table.rolloId,
      table.reimpresionId,
    ),
    index("revisiones_etiqueta_rollo_idx").on(table.rolloId),
    index("revisiones_etiqueta_created_at_idx").on(table.createdAt),
    index("revisiones_etiqueta_usuario_idx").on(table.usuarioId),
  ],
);

export const insertRevisionEtiquetaSchema = createInsertSchema(
  revisionesEtiquetaTable,
).omit({ id: true, createdAt: true });

export type InsertRevisionEtiqueta = z.infer<
  typeof insertRevisionEtiquetaSchema
>;
export type RevisionEtiqueta = typeof revisionesEtiquetaTable.$inferSelect;