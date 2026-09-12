import {
  bigserial,
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usuariosTable } from "./users";
import { ubicacionesTable } from "./locations";

export const auditoriaTable = pgTable(
  "auditoria",
  {
    id: bigserial("id", { mode: "bigint" }).primaryKey(),
    usuarioId: integer("usuario_id").references(() => usuariosTable.id),
    usuarioSnapshot: text("usuario_snapshot"),
    rolSnapshot: text("rol_snapshot"),
    sitioId: integer("sitio_id").references(() => ubicacionesTable.id),
    sitioSnapshot: text("sitio_snapshot"),
    modulo: text("modulo"),
    accion: text("accion").notNull(),
    entidad: text("entidad").notNull(),
    entidadId: text("entidad_id"),
    datosAntes: jsonb("datos_antes").$type<Record<string, unknown> | null>(),
    datosDespues: jsonb("datos_despues").$type<Record<string, unknown> | null>(),
    ip: text("ip").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("auditoria_entidad_idx").on(table.entidad, table.entidadId),
    index("auditoria_usuario_created_idx").on(
      table.usuarioId,
      table.createdAt,
    ),
  ],
);

/** Generic persistent notifications; null recipient keeps legacy ADMIN-global semantics. */
export const notificacionesSistemaTable = pgTable(
  "notificaciones_sistema",
  {
    id: serial("id").primaryKey(),
    tipo: text("tipo").notNull(),
    titulo: text("titulo").notNull(),
    mensaje: text("mensaje").notNull(),
    entidad: text("entidad").notNull(),
    entidadId: text("entidad_id").notNull(),
    destinatarioUsuarioId: integer("destinatario_usuario_id").references(
      () => usuariosTable.id,
    ),
    leidaAt: timestamp("leida_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("notificaciones_sistema_leida_created_idx").on(
      table.leidaAt,
      table.createdAt,
    ),
    index("notificaciones_sistema_destinatario_leida_idx").on(
      table.destinatarioUsuarioId,
      table.leidaAt,
      table.createdAt,
    ),
    uniqueIndex("notificaciones_sistema_pago_dirigido_resuelto_uidx")
      .on(table.entidad, table.entidadId, table.destinatarioUsuarioId)
      .where(sql`${table.tipo} = 'PAGO_DIRIGIDO_RESUELTO'`),
    uniqueIndex("notificaciones_sistema_stock_minimo_episode_recipient_uidx")
      .on(table.entidad, table.entidadId, table.destinatarioUsuarioId)
      .where(sql`${table.tipo} = 'STOCK_MINIMO'`),
  ],
);

export const insertAuditoriaSchema = createInsertSchema(auditoriaTable).omit({
  id: true,
  createdAt: true,
});

export type InsertAuditoria = z.infer<typeof insertAuditoriaSchema>;
export type Auditoria = typeof auditoriaTable.$inferSelect;