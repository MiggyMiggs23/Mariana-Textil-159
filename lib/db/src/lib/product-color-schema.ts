import type { Pool } from "pg";

/** Repeatable startup migration for the optional, manually captured product color. */
export async function ensureProductColorSchema(pool: Pick<Pool, "connect">): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`
      ALTER TABLE productos
        ADD COLUMN IF NOT EXISTS color_hex text;

      UPDATE productos
      SET color_hex = upper(color_hex)
      WHERE color_hex ~ '^#[0-9A-Fa-f]{6}$'
        AND color_hex <> upper(color_hex);

      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conrelid = 'productos'::regclass
            AND conname = 'productos_color_hex_check'
        ) THEN
          ALTER TABLE productos
            ADD CONSTRAINT productos_color_hex_check
            CHECK (color_hex IS NULL OR color_hex ~ '^#[0-9A-F]{6}$');
        END IF;
      END $$;
    `);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}