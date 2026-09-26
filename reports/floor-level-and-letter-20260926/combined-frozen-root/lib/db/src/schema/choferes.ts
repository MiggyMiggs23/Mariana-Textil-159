import { boolean, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

/** Historical transport-driver catalog. Records are never deleted. */
export const choferesTable = pgTable("choferes", {
  id: serial("id").primaryKey(),
  nombreCompleto: text("nombre_completo").notNull(),
  telefono: text("telefono").notNull(),
  activo: boolean("activo").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type Chofer = typeof choferesTable.$inferSelect;
