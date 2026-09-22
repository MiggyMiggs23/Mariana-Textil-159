import assert from "node:assert/strict";
import type { Pool } from "pg";
import { ensureProductColorSchema } from "./product-color-schema";

const queries: string[] = [];
let releases = 0;
const client = {
  async query(statement: string) {
    queries.push(statement);
    return { rows: [], rowCount: 0 };
  },
  release() {
    releases += 1;
  },
};
const fakePool = {
  async connect() {
    return client;
  },
} as unknown as Pick<Pool, "connect">;

await ensureProductColorSchema(fakePool);
await ensureProductColorSchema(fakePool);

assert.equal(queries.filter((query) => query === "BEGIN").length, 2);
assert.equal(queries.filter((query) => query === "COMMIT").length, 2);
assert.equal(releases, 2);
for (const migration of queries.filter((query) => query.includes("ALTER TABLE productos"))) {
  assert.match(migration, /ADD COLUMN IF NOT EXISTS color_hex text/);
  assert.match(migration, /SET color_hex = upper\(color_hex\)/);
  assert.match(migration, /productos_color_hex_check/);
  assert.match(migration, /\^#\[0-9A-F\]\{6\}\$/);
}