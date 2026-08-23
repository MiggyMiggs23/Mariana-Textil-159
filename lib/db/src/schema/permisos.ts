import {
  boolean,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";
import { rolUsuarioEnum } from "./enums";
import { usuariosTable } from "./users";

/**
 * Permission matrix per role.
 * One row per (rol, modulo) pair.
 * "total" = all four flags true; "—" = all false.
 */
export const permisosRolTable = pgTable(
  "permisos_rol",
  {
    id: serial("id").primaryKey(),
    rol: rolUsuarioEnum("rol").notNull(),
    modulo: text("modulo").notNull(),
    puedeVer: boolean("puede_ver").notNull().default(false),
    puedeCrear: boolean("puede_crear").notNull().default(false),
    puedeEditar: boolean("puede_editar").notNull().default(false),
    puedeAutorizar: boolean("puede_autorizar").notNull().default(false),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    updatedPor: integer("updated_por").references(() => usuariosTable.id),
  },
  (t) => [unique("permisos_rol_rol_modulo_unique").on(t.rol, t.modulo)],
);

/**
 * Per-user permission overrides.
 * Nullable columns: null means "inherit from role".
 */
export const permisosUsuarioTable = pgTable(
  "permisos_usuario",
  {
    id: serial("id").primaryKey(),
    usuarioId: integer("usuario_id")
      .notNull()
      .references(() => usuariosTable.id),
    modulo: text("modulo").notNull(),
    puedeVer: boolean("puede_ver"),
    puedeCrear: boolean("puede_crear"),
    puedeEditar: boolean("puede_editar"),
    puedeAutorizar: boolean("puede_autorizar"),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    updatedPor: integer("updated_por").references(() => usuariosTable.id),
  },
  (t) => [
    unique("permisos_usuario_usuario_modulo_unique").on(t.usuarioId, t.modulo),
  ],
);

export type PermisosRol = typeof permisosRolTable.$inferSelect;
export type PermisosUsuario = typeof permisosUsuarioTable.$inferSelect;
