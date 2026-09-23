import {
  boolean,
  check,
  pgTable,
  serial,
  text,
  timestamp,
  integer,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { tipoUbicacionEnum } from "./enums";

export const ubicacionesTable = pgTable(
  "ubicaciones",
  {
    id: serial("id").primaryKey(),
    nombre: text("nombre").notNull().unique(),
    iniciales: text("iniciales").notNull().unique(),
    tipo: tipoUbicacionEnum("tipo").notNull(),
    activa: boolean("activa").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    check(
      "ubicaciones_iniciales_formato_check",
      sql`${table.iniciales} ~ '^[A-Z]{2,3}$'`,
    ),
  ],
);

/** Physical floor/level within a real location. It deliberately has no ledger relation. */
export const pisosTable = pgTable(
  "pisos",
  {
    id: serial("id").primaryKey(),
    ubicacionId: integer("ubicacion_id")
      .notNull()
      .references(() => ubicacionesTable.id),
    nombre: text("nombre").notNull(),
    activo: boolean("activo").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("pisos_ubicacion_nombre_ci_unique").on(
      table.ubicacionId,
      sql`lower(${table.nombre})`,
    ),
  ],
);

export const insertUbicacionSchema = createInsertSchema(ubicacionesTable).omit({
  id: true,
  createdAt: true,
});

export type InsertUbicacion = z.infer<typeof insertUbicacionSchema>;
export type Ubicacion = typeof ubicacionesTable.$inferSelect;
export type Piso = typeof pisosTable.$inferSelect;