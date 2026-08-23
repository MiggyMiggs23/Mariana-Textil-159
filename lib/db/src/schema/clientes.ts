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
  direccion: text("direccion"),
  rfc: text("rfc"),
  notas: text("notas"),
  activo: boolean("activo").notNull().default(true),
  // Credit fields — only surfaced via clientes_credito module
  limiteCredito: decimal("limite_credito", { precision: 14, scale: 2 })
    .notNull()
    .default("0.00"),
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
  createdAt: true,
  updatedAt: true,
});

export type InsertCliente = z.infer<typeof insertClienteSchema>;
export type Cliente = typeof clientesTable.$inferSelect;
