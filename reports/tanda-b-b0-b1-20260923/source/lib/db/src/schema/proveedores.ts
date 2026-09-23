import {
  boolean,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { tipoProveedorEnum, monedaEnum } from "./enums";

export const proveedoresTable = pgTable("proveedores", {
  id: serial("id").primaryKey(),
  nombre: text("nombre").notNull(),
  tipo: tipoProveedorEnum("tipo").notNull(),
  monedaDefault: monedaEnum("moneda_default").notNull().default("MXN"),
  contactoNombre: text("contacto_nombre"),
  telefono: text("telefono"),
  correo: text("correo"),
  pais: text("pais"),
  notas: text("notas"),
  activo: boolean("activo").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertProveedorSchema = createInsertSchema(proveedoresTable).omit({
  id: true,
  createdAt: true,
});

export type InsertProveedor = z.infer<typeof insertProveedorSchema>;
export type Proveedor = typeof proveedoresTable.$inferSelect;
