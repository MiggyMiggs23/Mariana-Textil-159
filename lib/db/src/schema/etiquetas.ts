import { index, integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { rollosTable } from "./rollos";
import { usuariosTable } from "./users";
import { ubicacionesTable } from "./locations";

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