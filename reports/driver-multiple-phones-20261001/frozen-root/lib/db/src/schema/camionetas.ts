import {
  boolean,
  check,
  pgTable,
  serial,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

/** Text-backed intentionally: camioneta type is a small catalog value, not a DB enum. */
export type TipoCamioneta = "PROPIA" | "CONTRATADA";

export const camionetasTable = pgTable(
  "camionetas",
  {
    id: serial("id").primaryKey(),
    nombre: text("nombre").notNull(),
    placas: text("placas").notNull(),
    marca: text("marca"),
    modelo: text("modelo"),
    tipo: text("tipo").$type<TipoCamioneta>().notNull(),
    activa: boolean("activa").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    unique("camionetas_placas_unique").on(table.placas),
    check("camionetas_tipo_check", sql`${table.tipo} IN ('PROPIA', 'CONTRATADA')`),
  ],
);

export type Camioneta = typeof camionetasTable.$inferSelect;