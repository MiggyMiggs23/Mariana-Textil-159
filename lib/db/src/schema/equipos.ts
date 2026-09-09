import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import {
  CHECKLIST_KEYS_EQUIPO,
  TIPOS_EQUIPO,
  type TipoEquipo,
} from "../lib/equipos-catalog";
import { ubicacionesTable } from "./locations";
import { usuariosTable } from "./users";

export const equiposTable = pgTable(
  "equipos",
  {
    id: serial("id").primaryKey(),
    ubicacionId: integer("ubicacion_id")
      .notNull()
      .references(() => ubicacionesTable.id),
    tipo: text("tipo").$type<TipoEquipo>().notNull(),
    identificador: text("identificador").notNull(),
    marca: text("marca").notNull(),
    modelo: text("modelo").notNull(),
    numeroSerie: text("numero_serie"),
    notas: text("notas"),
    creadoPor: integer("creado_por")
      .notNull()
      .references(() => usuariosTable.id),
    actualizadoPor: integer("actualizado_por")
      .notNull()
      .references(() => usuariosTable.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    check(
      "equipos_tipo_check",
      sql`${table.tipo} IN (${sql.join(
        TIPOS_EQUIPO.map((tipo) => sql`${tipo}`),
        sql`, `,
      )})`,
    ),
    uniqueIndex("equipos_ubicacion_identificador_ci_unique").on(
      table.ubicacionId,
      sql`lower(${table.identificador})`,
    ),
    index("equipos_ubicacion_tipo_idx").on(table.ubicacionId, table.tipo),
  ],
);

export const equiposChecklistTable = pgTable(
  "equipos_checklist",
  {
    equipoId: integer("equipo_id")
      .notNull()
      .references(() => equiposTable.id, { onDelete: "cascade" }),
    itemKey: text("item_key").notNull(),
    checkedPor: integer("checked_por")
      .notNull()
      .references(() => usuariosTable.id),
    checkedAt: timestamp("checked_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check(
      "equipos_checklist_item_key_check",
      sql`${table.itemKey} IN (${sql.join(
        CHECKLIST_KEYS_EQUIPO.map((key) => sql`${key}`),
        sql`, `,
      )})`,
    ),
    uniqueIndex("equipos_checklist_equipo_item_unique").on(
      table.equipoId,
      table.itemKey,
    ),
    index("equipos_checklist_equipo_idx").on(table.equipoId),
  ],
);

export type Equipo = typeof equiposTable.$inferSelect;
export type EquipoChecklist = typeof equiposChecklistTable.$inferSelect;