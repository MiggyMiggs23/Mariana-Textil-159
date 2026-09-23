import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "../../..");
const inventario = readFileSync(
  resolve(import.meta.dirname, "lib/inventario.ts"),
  "utf8",
);
const dbIndex = readFileSync(resolve(root, "lib/db/src/index.ts"), "utf8");
const conciliacion = inventario.slice(
  inventario.indexOf("export async function conciliarTodo"),
  inventario.indexOf("export async function recalcularExistencias"),
);

test("conciliarTodo performs one set-based statement and no query inside a loop", () => {
  assert.equal(
    (conciliacion.match(/await db\.execute/g) ?? []).length,
    1,
    "reconciliation must have exactly one database round trip",
  );
  assert.doesNotMatch(conciliacion, /db\.transaction|await tx\./);
  assert.doesNotMatch(conciliacion, /for\s*\(|for\s+\([^)]*\sof\s/);
  assert.match(conciliacion, /SUM\(cantidad\) OVER/);
  assert.match(conciliacion, /ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW/);
  assert.match(conciliacion, /COUNT\(\*\) FILTER/);
  assert.match(conciliacion, /estado = 'DISPONIBLE'/);
  assert.match(conciliacion, /GROUP BY producto_id, ubicacion_id/);
});

test("reconciliation remains report-only and retains separate discrepancy categories", () => {
  assert.doesNotMatch(conciliacion, /\b(?:INSERT|UPDATE|DELETE)\b/i);
  assert.match(conciliacion, /discrepanciaCadena/);
  assert.match(conciliacion, /discrepanciaCache/);
  assert.match(conciliacion, /discrepanciaRollos/);
  assert.match(
    conciliacion,
    /discrepanciaCadena \|\| discrepanciaCache \|\| discrepanciaRollos/,
  );
});

test("PostgreSQL pool has validated explicit capacity and timeout controls", () => {
  assert.match(dbIndex, /DB_POOL_MAX/);
  assert.match(dbIndex, /DB_POOL_IDLE_TIMEOUT_MS/);
  assert.match(dbIndex, /DB_POOL_CONNECTION_TIMEOUT_MS/);
  assert.match(dbIndex, /DB_STATEMENT_TIMEOUT_MS/);
  assert.match(dbIndex, /DB_QUERY_TIMEOUT_MS/);
  assert.match(dbIndex, /max: poolMax/);
  assert.match(dbIndex, /idleTimeoutMillis/);
  assert.match(dbIndex, /connectionTimeoutMillis/);
  assert.match(dbIndex, /statement_timeout: statementTimeoutMillis/);
  assert.match(dbIndex, /query_timeout: queryTimeoutMillis/);
});