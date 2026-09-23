import assert from "node:assert/strict";
import type { Pool } from "pg";
import { ensureExtraordinaryExitsSchema } from "./extraordinary-exits-schema";

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
const pool = {
  async connect() {
    return client;
  },
} as unknown as Pool;

await ensureExtraordinaryExitsSchema(pool);
await ensureExtraordinaryExitsSchema(pool);

assert.equal(queries.filter((query) => query === "BEGIN").length, 2);
assert.equal(queries.filter((query) => query === "COMMIT").length, 2);
assert.equal(releases, 2);
for (const migration of queries.filter((query) =>
  query.includes("motivo_salida_extraordinaria"),
)) {
  assert.match(
    migration,
    /CREATE TYPE motivo_salida_extraordinaria AS ENUM \(\s*'MERMA', 'ROBO', 'MUESTRA'\s*\)/,
  );
  assert.match(
    migration,
    /ADD COLUMN IF NOT EXISTS motivo_salida_extraordinaria\s+motivo_salida_extraordinaria/,
  );
  assert.match(migration, /CREATE INDEX IF NOT EXISTS/);
}