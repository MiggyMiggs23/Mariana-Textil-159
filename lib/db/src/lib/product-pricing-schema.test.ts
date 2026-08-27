import assert from "node:assert/strict";
import type { Pool } from "pg";
import { ensureProductPricingSchema } from "./product-pricing-schema";

const queries: string[] = [];
const client = {
  async query(statement: string) {
    queries.push(statement);
    return { rows: [], rowCount: 0 };
  },
  release() {},
};

await ensureProductPricingSchema({
  async connect() { return client; },
} as unknown as Pick<Pool, "connect">);

const migration = queries.find((query) => query.includes("precio_mayoreo"))!;
assert.match(migration, /ADD COLUMN IF NOT EXISTS precio_mayoreo numeric\(12,2\)/);
assert.match(migration, /ADD COLUMN IF NOT EXISTS precio_menudeo numeric\(12,2\)/);
assert.match(migration, /ADD COLUMN IF NOT EXISTS modo_precio precio_modo/);
assert.match(migration, /SET modo_precio = 'ROLLO'/);
assert.match(migration, /precio_lista_anterior DROP NOT NULL/);