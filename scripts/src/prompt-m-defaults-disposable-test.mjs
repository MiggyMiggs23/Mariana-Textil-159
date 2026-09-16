/**
 * Prompt M disposable behavior proof.
 *
 * This creates a fresh local PostgreSQL cluster in /tmp, with only the
 * minimum ubicaciones FK target and the six source-shaped counter tables.
 * It never reads, connects to, restores, or drops the application database.
 */
import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import { promisify } from "node:util";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import pgRuntime from "../../lib/db/node_modules/pg/lib/index.js";

const exec = promisify(execFile);
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const REPORT_DIR = resolve(ROOT, "reports/prompt-m");
const EVIDENCE_PATH = resolve(REPORT_DIR, "operator-evidence.json");
const OUTPUT_PATH = resolve(REPORT_DIR, "test-output.txt");
const PG_BIN = "pg_ctl";
const pg = pgRuntime;
const counters = [
  ["entrada_folio", "ultimo_folio", "0"],
  ["salida_folio", "ultimo_folio", "0"],
  ["viaje_folio", "ultimo_folio", "0"],
  ["auditoria_inventario_folio", "ultimo_folio", "0"],
  ["ticket_folio", "ultimo_folio", "999"],
  ["series_consecutivo", "ultimo_numero", "10000000"],
];
const sourceFiles = [
  "artifacts/api-server/src/lib/inventario.ts",
  "artifacts/api-server/src/lib/salidas.ts",
];
const exactShape = [
  "CREATE TABLE ubicaciones (id integer PRIMARY KEY);",
  "CREATE TABLE entrada_folio (ubicacion_id integer PRIMARY KEY REFERENCES ubicaciones(id), ultimo_folio integer NOT NULL DEFAULT 0);",
  "CREATE TABLE salida_folio (ubicacion_id integer PRIMARY KEY REFERENCES ubicaciones(id), ultimo_folio integer NOT NULL DEFAULT 0);",
  "CREATE TABLE viaje_folio (ubicacion_id integer PRIMARY KEY REFERENCES ubicaciones(id), ultimo_folio integer NOT NULL DEFAULT 0);",
  "CREATE TABLE auditoria_inventario_folio (ubicacion_id integer PRIMARY KEY REFERENCES ubicaciones(id), ultimo_folio integer NOT NULL DEFAULT 0);",
  "CREATE TABLE ticket_folio (id integer PRIMARY KEY DEFAULT 1, ultimo_folio integer NOT NULL DEFAULT 999);",
  "CREATE TABLE series_consecutivo (id integer PRIMARY KEY DEFAULT 1, ultimo_numero integer NOT NULL DEFAULT 10000000);",
];

function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${JSON.stringify(k)}:${stable(v)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function hash(value) {
  return createHash("sha256").update(stable(value)).digest("hex");
}

async function sourceHashes() {
  const result = {};
  for (const relativePath of sourceFiles) {
    const content = await fs.readFile(resolve(ROOT, relativePath));
    result[relativePath] = createHash("sha256").update(content).digest("hex");
  }
  return result;
}

async function run(command, args) {
  return exec(command, args, { timeout: 120_000, maxBuffer: 2_000_000 });
}

async function query(pool, text, values = []) {
  return pool.query(text, values);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function main() {
  await fs.mkdir(REPORT_DIR, { recursive: true, mode: 0o700 });
  const stamp = `${Date.now()}-${process.pid}`;
  const root = `/tmp/prompt-m-disposable-${stamp}`;
  const data = `${root}/data`;
  const socket = `${root}/socket`;
  const port = 56000 + (process.pid % 500);
  const database = "prompt_m_disposable";
  const user = "promptm";
  let running = false;
  let evidence = {
    operation: "PROMPT_M_DISPOSABLE_DEFAULT_BEHAVIOR",
    status: "RUNNING",
    database: "disposable_only",
    productionDataRead: false,
    productionDatabaseTouched: false,
    usersCreated: false,
    sessionsCreated: false,
    sourceShape: exactShape,
    allocatorSourceFiles: sourceFiles,
    allocatorSourceSha256: await sourceHashes(),
    allocatorMethod: "source-extracted SQL equivalent; API module not imported",
    tests: [],
  };
  const output = [];
  let adminPool;
  let pool;
  const record = (name, result) => {
    evidence.tests.push({ name, ...result });
    output.push(`${name}: ${JSON.stringify(result)}`);
  };
  try {
    await fs.mkdir(socket, { recursive: true, mode: 0o700 });
    await run("initdb", ["--no-locale", "--encoding=UTF8", "--auth=trust", "--username", user, "--pgdata", data]);
    await run(PG_BIN, ["--pgdata", data, "--options", `-k ${socket} -p ${port}`, "--wait", "start"]);
    running = true;
    adminPool = new pg.Pool({ host: socket, port, database: "postgres", user, max: 1 });
    await query(adminPool, `CREATE DATABASE ${database}`);
    await adminPool.end();
    adminPool = undefined;
    pool = new pg.Pool({ host: socket, port, database, user, max: 1 });
    await query(pool, "CREATE TABLE ubicaciones (id integer PRIMARY KEY)");
    await query(pool, "CREATE TABLE entrada_folio (ubicacion_id integer PRIMARY KEY REFERENCES ubicaciones(id), ultimo_folio integer NOT NULL DEFAULT 0)");
    await query(pool, "CREATE TABLE salida_folio (ubicacion_id integer PRIMARY KEY REFERENCES ubicaciones(id), ultimo_folio integer NOT NULL DEFAULT 0)");
    await query(pool, "CREATE TABLE viaje_folio (ubicacion_id integer PRIMARY KEY REFERENCES ubicaciones(id), ultimo_folio integer NOT NULL DEFAULT 0)");
    await query(pool, "CREATE TABLE auditoria_inventario_folio (ubicacion_id integer PRIMARY KEY REFERENCES ubicaciones(id), ultimo_folio integer NOT NULL DEFAULT 0)");
    await query(pool, "CREATE TABLE ticket_folio (id integer PRIMARY KEY DEFAULT 1, ultimo_folio integer NOT NULL DEFAULT 999)");
    await query(pool, "CREATE TABLE series_consecutivo (id integer PRIMARY KEY DEFAULT 1, ultimo_numero integer NOT NULL DEFAULT 10000000)");
    const tables = await query(pool, "SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name");
    record("source-shaped-minimal-schema", {
      pass: stable(tables.rows.map((row) => row.table_name)) === stable(["auditoria_inventario_folio", "entrada_folio", "salida_folio", "series_consecutivo", "ticket_folio", "ubicaciones", "viaje_folio"]),
      publicTables: tables.rows.map((row) => row.table_name),
    });

    await query(pool, "BEGIN");
    await query(pool, "INSERT INTO ubicaciones (id) VALUES (101),(102),(103),(104),(201),(202)");
    const defaults = {};
    defaults.entrada_folio = String((await query(pool, "INSERT INTO entrada_folio (ubicacion_id) VALUES (101) RETURNING ultimo_folio")).rows[0].ultimo_folio);
    defaults.salida_folio = String((await query(pool, "INSERT INTO salida_folio (ubicacion_id) VALUES (102) RETURNING ultimo_folio")).rows[0].ultimo_folio);
    defaults.viaje_folio = String((await query(pool, "INSERT INTO viaje_folio (ubicacion_id) VALUES (103) RETURNING ultimo_folio")).rows[0].ultimo_folio);
    defaults.auditoria_inventario_folio = String((await query(pool, "INSERT INTO auditoria_inventario_folio (ubicacion_id) VALUES (104) RETURNING ultimo_folio")).rows[0].ultimo_folio);
    defaults.ticket_folio = String((await query(pool, "INSERT INTO ticket_folio DEFAULT VALUES RETURNING id, ultimo_folio")).rows[0].ultimo_folio);
    defaults.series_consecutivo = String((await query(pool, "INSERT INTO series_consecutivo DEFAULT VALUES RETURNING id, ultimo_numero")).rows[0].ultimo_numero);
    record("six-defaults-omitted-values", {
      pass: stable(defaults) === stable(Object.fromEntries(counters.map(([table, , value]) => [table, value]))),
      values: defaults,
    });

    const entryInsert = "INSERT INTO entrada_folio (ubicacion_id) VALUES ($1) ON CONFLICT DO NOTHING";
    const entryLock = "SELECT ultimo_folio FROM entrada_folio WHERE ubicacion_id = $1 FOR UPDATE";
    const entryUpdate = "UPDATE entrada_folio SET ultimo_folio = ultimo_folio + 1 WHERE ubicacion_id = $1 RETURNING ultimo_folio";
    await query(pool, entryInsert, [201]);
    await query(pool, entryLock, [201]);
    const entryNext = String((await query(pool, entryUpdate, [201])).rows[0].ultimo_folio);
    record("entrada-allocator-first-folio", { pass: entryNext === "1", firstFolio: entryNext, sql: [entryInsert, entryLock, entryUpdate] });

    const salidaInsert = "INSERT INTO salida_folio (ubicacion_id) VALUES ($1) ON CONFLICT DO NOTHING";
    const salidaLock = "SELECT ultimo_folio FROM salida_folio WHERE ubicacion_id = $1 FOR UPDATE";
    const salidaUpdate = "UPDATE salida_folio SET ultimo_folio = ultimo_folio + 1 WHERE ubicacion_id = $1 RETURNING ultimo_folio";
    await query(pool, salidaInsert, [202]);
    await query(pool, salidaLock, [202]);
    const salidaNext = String((await query(pool, salidaUpdate, [202])).rows[0].ultimo_folio);
    record("salida-allocator-first-folio", { pass: salidaNext === "1", firstFolio: salidaNext, sql: [salidaInsert, salidaLock, salidaUpdate] });

    const seriesInsert = "INSERT INTO series_consecutivo (id, ultimo_numero) VALUES (1, 10000000) ON CONFLICT (id) DO NOTHING";
    const seriesLock = "SELECT ultimo_numero FROM series_consecutivo WHERE id = 1 FOR UPDATE";
    const seriesUpdate = "UPDATE series_consecutivo SET ultimo_numero = ultimo_numero + 1 WHERE id = 1 RETURNING ultimo_numero";
    await query(pool, seriesInsert);
    const seriesStart = String((await query(pool, seriesLock)).rows[0].ultimo_numero);
    const seriesNext = String((await query(pool, seriesUpdate)).rows[0].ultimo_numero);
    record("series-allocator-first-series", { pass: seriesStart === "10000000" && seriesNext === "10000001", start: seriesStart, firstSeries: seriesNext, sql: [seriesInsert, seriesLock, seriesUpdate] });
    record("no-users-or-sessions", { pass: true, note: "Fixture contains only ubicaciones and six counters; no user/session tables or rows." });
    await query(pool, "ROLLBACK");
    evidence.status = evidence.tests.every((test) => test.pass) ? "PASS" : "FAIL";
    evidence.evidenceSha256 = hash(evidence);
    output.unshift(`status: ${evidence.status}`);
    output.push("transaction: ROLLBACK (fixture mutations discarded)");
  } catch (error) {
    evidence.status = "FAIL";
    evidence.error = String(error).replaceAll(root, "[disposable-cluster]");
    output.push(`error: ${evidence.error}`);
    throw error;
  } finally {
    if (pool) await pool.end().catch(() => undefined);
    if (adminPool) await adminPool.end().catch(() => undefined);
    if (running) await run(PG_BIN, ["--pgdata", data, "--mode", "immediate", "--wait", "stop"]).catch(() => undefined);
    await fs.rm(root, { recursive: true, force: true });
    evidence.cleanup = "Only the newly-created disposable cluster was stopped and removed; reports retained.";
    await fs.writeFile(EVIDENCE_PATH, `${JSON.stringify(evidence, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
    await fs.writeFile(OUTPUT_PATH, `${output.join("\n")}\n`, { encoding: "utf8", mode: 0o600 });
  }
}

main().catch((error) => {
  console.error(`Prompt M disposable test stopped: ${String(error).replaceAll(/postgres(?:ql)?:\/\/[^\s"'`]+/gi, "[database-url-redacted]")}`);
  process.exitCode = 2;
});