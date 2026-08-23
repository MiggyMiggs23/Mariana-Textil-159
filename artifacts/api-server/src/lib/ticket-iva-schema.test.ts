import assert from "node:assert/strict";
import test from "node:test";
import { ensureTicketIvaSchema, pool } from "@workspace/db";

if (process.env.NODE_ENV !== "test" || !process.env.TEST_DATABASE_URL) {
  throw new Error(
    "Esta prueba modifica el esquema y solo puede ejecutarse con TEST_DATABASE_URL.",
  );
}

await test("La actualización de IVA agrega columnas a una base anterior", async () => {
  await pool.query(`
    ALTER TABLE tickets DROP COLUMN IF EXISTS iva;
    ALTER TABLE tickets DROP COLUMN IF EXISTS tasa_iva;
  `);

  await ensureTicketIvaSchema(pool);
  await ensureTicketIvaSchema(pool);

  const result = await pool.query<{
    column_name: string;
    column_default: string | null;
    is_nullable: string;
    numeric_precision: number;
    numeric_scale: number;
  }>(`
    SELECT
      column_name,
      column_default,
      is_nullable,
      numeric_precision,
      numeric_scale
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'tickets'
      AND column_name IN ('iva', 'tasa_iva')
    ORDER BY column_name;
  `);

  assert.deepEqual(result.rows, [
    {
      column_name: "iva",
      column_default: "0",
      is_nullable: "NO",
      numeric_precision: 12,
      numeric_scale: 2,
    },
    {
      column_name: "tasa_iva",
      column_default: "0.1600",
      is_nullable: "NO",
      numeric_precision: 5,
      numeric_scale: 4,
    },
  ]);
});
