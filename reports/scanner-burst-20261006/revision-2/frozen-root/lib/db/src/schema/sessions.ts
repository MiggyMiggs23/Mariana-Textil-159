import {
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usuariosTable } from "./users";

export const sesionesTable = pgTable("sesiones", {
  id: uuid("id").primaryKey(),
  usuarioId: integer("usuario_id")
    .notNull()
    .references(() => usuariosTable.id),
  expiraAt: timestamp("expira_at", { withTimezone: true }).notNull(),
  ip: text("ip").notNull(),
  userAgent: text("user_agent").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertSesionSchema = createInsertSchema(sesionesTable).omit({
  createdAt: true,
});

export type InsertSesion = z.infer<typeof insertSesionSchema>;
export type Sesion = typeof sesionesTable.$inferSelect;