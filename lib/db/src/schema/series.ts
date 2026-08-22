import { integer, pgTable, text } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const seriesConsecutivoTable = pgTable("series_consecutivo", {
  sku: text("sku").primaryKey(),
  ultimoNumero: integer("ultimo_numero").notNull().default(0),
});

export const insertSeriesConsecutivoSchema = createInsertSchema(
  seriesConsecutivoTable,
);

export type InsertSeriesConsecutivo = z.infer<
  typeof insertSeriesConsecutivoSchema
>;
export type SeriesConsecutivo = typeof seriesConsecutivoTable.$inferSelect;
