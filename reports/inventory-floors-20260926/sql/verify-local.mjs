// Run from repository root: node reports/inventory-floors-20260926/sql/verify-local.mjs
// No app imports, environment URLs, network listener, migrations, or real data.
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createHash } from "node:crypto";
import vm from "node:vm";

const require = createRequire(resolve("artifacts/api-server/package.json"));
const { sql } = require("drizzle-orm");
const { PgDialect } = require("drizzle-orm/pg-core");
const { Client } = require("pg");
const out = new URL("./", import.meta.url);
const route = "artifacts/api-server/src/routes/inventario.ts";
const baselineCommit = "28d27eadcb68accdee7f25a13f1d47fc898a1033";
const current = readFileSync(route, "utf8");
const baseline = execFileSync("git", ["show", `${baselineCommit}:${route}`], { encoding: "utf8" });
function extract(source) {
  const start = source.indexOf('"/existencias/agrupadas"');
  assert.ok(start >= 0);
  const fragment = source.slice(start);
  const match = fragment.match(/const result = await db\.execute\((sql`[\s\S]*?`)\);/);
  assert.ok(match, "Actual route SQL template must be present");
  return match[1];
}
const templates = { current: extract(current), baseline: extract(baseline) };
assert.match(templates.current, /current_roll/);
assert.doesNotMatch(templates.baseline, /current_roll/);
for (const [name, template] of Object.entries(templates)) {
  writeFileSync(new URL(`${name}-template.txt`, out), template);
}
const compile = (template, options) => new PgDialect().sqlToQuery(
  vm.runInNewContext(template, { sql, ubicacionId: options.ubicacionId, search: options.search, q: options }),
);
const root = mkdtempSync(join(tmpdir(), "inventory-floors-sql-"));
const data = join(root, "data");
const report = {
  scope: "Disposable local PostgreSQL only; synthetic minimal relational fixtures, no application database",
  baselineCommit,
  routeSha256: createHash("sha256").update(current).digest("hex"),
  templateSha256: createHash("sha256").update(templates.current).digest("hex"),
  cases: [],
};
let started = false;
let client;
try {
  execFileSync("initdb", ["-D", data, "-A", "trust", "-U", "inventory_sql_tester"], { stdio: "pipe" });
  execFileSync("pg_ctl", ["-D", data, "-l", join(root, "postgres.log"), "-o", `-k ${root} -h '' -p 25469`, "-w", "start"], { stdio: "pipe" });
  started = true;
  client = new Client({ host: root, port: 25469, user: "inventory_sql_tester", database: "postgres", password: "", ssl: false });
  await client.connect();
  report.postgres = (await client.query("SELECT version() AS version")).rows[0].version;
  await client.query(`
    CREATE TABLE productos(id integer PRIMARY KEY, sku text, tela text, color text, unidad text, activo boolean);
    CREATE TABLE ubicaciones(id integer PRIMARY KEY, nombre text);
    CREATE TABLE pisos(id integer PRIMARY KEY, ubicacion_id integer REFERENCES ubicaciones, nombre text);
    CREATE TABLE rollos(id integer PRIMARY KEY, producto_id integer REFERENCES productos, ubicacion_id integer REFERENCES ubicaciones,
      piso_id integer REFERENCES pisos, cantidad_actual numeric(12,3), estado text);
    INSERT INTO ubicaciones VALUES(1,'Centro'),(2,'Norte');
    INSERT INTO pisos VALUES(11,1,'Primer piso'),(12,1,'Segundo piso'),(21,2,'Primer piso');
    INSERT INTO productos VALUES
      (1,'METRO','Tela','Azul','METRO',true),(2,'KILO','Tela','Rojo','KILO',true),
      (3,'PIEZA','Tela','Verde','PIEZA',true),(4,'BOLSA','Tela','Blanco','BOLSA',true),
      (5,'EMPTY','Vacía','Gris','METRO',true),(6,'INACTIVE','Oculta','Negro','METRO',false);
    INSERT INTO rollos
      SELECT p.id*100 + v.n, p.id, v.site, v.floor, v.qty * p.id, v.state
      FROM productos p CROSS JOIN (VALUES
        (1,1,11,1.125,'DISPONIBLE'),(2,1,11,2.375,'DISPONIBLE'),
        (3,1,12,4.000,'DISPONIBLE'),(4,1,NULL,0.500,'DISPONIBLE'),
        (5,2,21,5.000,'DISPONIBLE'),(6,2,NULL,6.000,'DISPONIBLE'),
        (7,1,11,900.000,'VENDIDO'),(8,2,21,800.000,'RESERVADO')
      ) v(n,site,floor,qty,state) WHERE p.id IN (1,2);
    INSERT INTO rollos
      SELECT p.id*100 + v.n, p.id, v.site, v.floor, v.qty * p.id, v.state
      FROM productos p CROSS JOIN (VALUES
        (1,1,11,1,'DISPONIBLE'),(2,1,11,2,'DISPONIBLE'),
        (3,1,12,4,'DISPONIBLE'),(4,1,NULL,1,'DISPONIBLE'),
        (5,2,21,5,'DISPONIBLE'),(6,2,NULL,6,'DISPONIBLE'),
        (7,1,11,900,'VENDIDO'),(8,2,21,800,'RESERVADO')
      ) v(n,site,floor,qty,state) WHERE p.id IN (3,4);
    INSERT INTO rollos VALUES(601,6,1,11,999,'DISPONIBLE');
    BEGIN READ ONLY;
  `);
  const units = ["METRO", "KILO", "PIEZA", "BOLSA"];
  for (const ubicacionId of [null, 1, 2, 999]) {
    for (const includeSinExistencia of [false, true]) {
      for (const search of [null, "%Tela%", "%EMPTY%", "%missing%"]) {
        const options = { ubicacionId, includeSinExistencia, search };
        const queries = Object.fromEntries(Object.entries(templates).map(([name, template]) => [name, compile(template, options)]));
        if (report.cases.length === 0) {
          for (const [name, query] of Object.entries(queries)) writeFileSync(new URL(`${name}-compiled.json`, out), JSON.stringify(query, null, 2));
        }
        const oldRows = (await client.query(queries.baseline.sql, queries.baseline.params)).rows;
        const newRows = (await client.query(queries.current.sql, queries.current.params)).rows;
        assert.deepEqual(newRows.map(({ ubicaciones, ...totals }) => totals), oldRows, "Old totals / product rows must remain identical");
        const expectedIds = search === "%missing%" ? [] : search === "%EMPTY%" ? (includeSinExistencia ? [5] : []) :
          [...((ubicacionId !== 999 || includeSinExistencia) ? [1,2,3,4] : []), ...(includeSinExistencia && search === null ? [5] : [])];
        assert.deepEqual(newRows.map(r => r.producto_id).sort(), expectedIds);
        for (const row of newRows) {
          const id = row.producto_id;
          const expected = id === 5 || ubicacionId === 999 ? [] : [
            { ubicacionId: 1, nombreUbicacion: "Centro", pisoId: 11, nombrePiso: "Primer piso", rollosCount: 2, cantidadTotal: ((id <= 2 ? 3.5 : 3) * id).toFixed(3), unidad: units[id-1] },
            { ubicacionId: 1, nombreUbicacion: "Centro", pisoId: 12, nombrePiso: "Segundo piso", rollosCount: 1, cantidadTotal: (4 * id).toFixed(3), unidad: units[id-1] },
            { ubicacionId: 1, nombreUbicacion: "Centro", pisoId: null, nombrePiso: null, rollosCount: 1, cantidadTotal: ((id <= 2 ? 0.5 : 1) * id).toFixed(3), unidad: units[id-1] },
            { ubicacionId: 2, nombreUbicacion: "Norte", pisoId: 21, nombrePiso: "Primer piso", rollosCount: 1, cantidadTotal: (5 * id).toFixed(3), unidad: units[id-1] },
            { ubicacionId: 2, nombreUbicacion: "Norte", pisoId: null, nombrePiso: null, rollosCount: 1, cantidadTotal: (6 * id).toFixed(3), unidad: units[id-1] },
          ].filter(r => ubicacionId === null || r.ubicacionId === ubicacionId);
          assert.deepEqual(row.ubicaciones, expected, "Exact floor identity, null/Sin piso, count, quantity, unit, and order");
          assert.equal(row.rollos_count, expected.reduce((n, r) => n + r.rollosCount, 0));
          assert.equal(Number(row.cantidad_total), expected.reduce((n, r) => n + Number(r.cantidadTotal), 0));
        }
        report.cases.push({ ...options, rows: newRows.length, status: "PASS" });
      }
    }
  }
  await client.query("ROLLBACK");
  report.status = "PASS";
  report.coverage = ["Actual route SQL compiled by Drizzle and executed by PostgreSQL (including grouped correlation)",
    "32 old/new result comparisons", "METRO KILO PIEZA BOLSA exact floor counts and quantities",
    "Same-named floors in distinct sites remain distinct", "Null floor id/name preserved as Sin piso contract, not literal SQL label",
    "Zero stock []", "Global, both local sites, nonexistent site", "includeSinExistencia both values; search; inactive and unavailable exclusion"];
} catch (error) {
  report.status = "FAIL";
  report.error = { message: error.message, code: error.code, stack: error.stack };
  process.exitCode = 1;
} finally {
  if (client) await client.end();
  if (started) {
    execFileSync("pg_ctl", ["-D", data, "-m", "fast", "-w", "stop"], { stdio: "pipe" });
    report.localServerStopped = true;
  }
  rmSync(root, { recursive: true, force: true });
  report.disposableDirectoryRemoved = true;
  writeFileSync(new URL("result.json", out), JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify(report, null, 2));
}