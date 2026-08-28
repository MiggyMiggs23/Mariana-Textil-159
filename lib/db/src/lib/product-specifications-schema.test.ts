import assert from "node:assert/strict";
import type { Pool } from "pg";
import { ensureProductSpecificationsSchema } from "./product-specifications-schema";

const queries: string[] = [];
const client = {
  async query(statement: string) {
    queries.push(statement);
    return { rows: [], rowCount: 0 };
  },
  release() {},
};
const pool = {
  async connect() {
    return client;
  },
} as unknown as Pick<Pool, "connect">;

await ensureProductSpecificationsSchema(pool);
await ensureProductSpecificationsSchema(pool);

assert.equal(queries.filter((query) => query === "BEGIN").length, 2);
assert.equal(queries.filter((query) => query === "COMMIT").length, 2);
for (const migration of queries.filter((query) => query.includes("ALTER TABLE productos"))) {
  assert.match(migration, /ADD COLUMN IF NOT EXISTS ancho_cm numeric\(10, 2\)/);
  assert.match(migration, /ADD COLUMN IF NOT EXISTS composicion text/);
  assert.match(migration, /ADD COLUMN IF NOT EXISTS gramaje_gm2 numeric\(10, 2\)/);
  assert.doesNotMatch(migration, /UPDATE productos/i);
}