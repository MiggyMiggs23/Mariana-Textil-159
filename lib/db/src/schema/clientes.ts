import {
  boolean,
  decimal,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * Operational client catalog.
 * Financial data (balances, credit) is handled externally / by separate modules.
 */
export const clientesTable = pgTable("clientes", {
  id: serial("id").primaryKey(),
  nombre: text("nombre").notNull(),
  telefono: text("telefono"),
  correo: text("correo"),
  direccionParticular: text("direccion_particular"),
  direccionEntrega: text("direccion_entrega"),
  rfc: text("rfc"),
  notas: text("notas"),
  activo: boolean("activo").notNull().default(true),
  esSistema: boolean("es_sistema").notNull().default(false),
  contactoNombre: text("contacto_nombre"),
  diasCredito: integer("dias_credito").notNull().default(0),
  limiteCredito: decimal("limite_credito", { precision: 14, scale: 2 })
    .notNull()
    .default("0.00"),
  // Legacy cache retained for upgrade compatibility. Never use as the source
  // of truth: balances are the sum of movimientos_credito.
  saldoCredito: decimal("saldo_credito", { precision: 14, scale: 2 })
    .notNull()
    .default("0.00"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertClienteSchema = createInsertSchema(clientesTable).omit({
  id: true,
  esSistema: true,
  saldoCredito: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertCliente = z.infer<typeof insertClienteSchema>;
export type Cliente = typeof clientesTable.$inferSelect;
