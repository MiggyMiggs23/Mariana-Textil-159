import { integer, pgTable } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * Global roll-series counter.
 *
 * A single-row control table (id = 1). `ultimoNumero` holds the last series
 * number handed out. The next series is `ultimoNumero + 1`. The sequence starts
 * so that the first allocated series is 1000001 (row seeded with 1000000).
 *
 * Series are allocated atomically under a row lock so they are globally
 * consecutive under concurrency and never reused. `rollos.serie` stores only
 * the numeric string (the SKU-SERIE QR payload is built in the frontend).
 */
export const seriesConsecutivoTable = pgTable("series_consecutivo", {
  id: integer("id").primaryKey().default(1),
  ultimoNumero: integer("ultimo_numero").notNull().default(1000000),
});

export const insertSeriesConsecutivoSchema = createInsertSchema(
  seriesConsecutivoTable,
);

export type InsertSeriesConsecutivo = z.infer<
  typeof insertSeriesConsecutivoSchema
>;
export type SeriesConsecutivo = typeof seriesConsecutivoTable.$inferSelect;
