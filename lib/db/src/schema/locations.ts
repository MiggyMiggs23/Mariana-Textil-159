import {
  boolean,
  check,
  pgTable,
  serial,
  text,
  timestamp,
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

export const insertUbicacionSchema = createInsertSchema(ubicacionesTable).omit({
  id: true,
  createdAt: true,
});

export type InsertUbicacion = z.infer<typeof insertUbicacionSchema>;
export type Ubicacion = typeof ubicacionesTable.$inferSelect;