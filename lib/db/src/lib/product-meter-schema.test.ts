import assert from "node:assert/strict";
import type { Pool } from "pg";
import { ensureProductMeterSchema } from "./product-meter-schema";

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

await ensureProductMeterSchema(fakePool);
await ensureProductMeterSchema(fakePool);

assert.equal(queries.filter((query) => query === "BEGIN").length, 2);
assert.equal(queries.filter((query) => query === "COMMIT").length, 2);
assert.equal(releases, 2);
for (const migration of queries.filter((query) => query.includes("ALTER TABLE productos"))) {
  assert.match(migration, /ADD COLUMN IF NOT EXISTS se_vende_por_metro boolean/);
  assert.match(migration, /SET DEFAULT false/);
  assert.match(migration, /SET NOT NULL/);
  assert.match(migration, /unidad = 'KILO'/);
  assert.match(migration, /productos_kilo_no_venta_metro_check/);
}