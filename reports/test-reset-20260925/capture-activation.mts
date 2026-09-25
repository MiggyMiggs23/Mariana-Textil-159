/**
 * Read-only evidence for activating the temporary test-reset button.
 *
 * Run from the repository root with the application's existing DATABASE_URL:
 *   node reports/test-reset-20260925/capture-activation.mts before
 *   node reports/test-reset-20260925/capture-activation.mts after
 *
 * Never prints a connection string or database rows. Both captures are made
 * inside an explicitly READ ONLY, REPEATABLE READ transaction. No migration,
 * authentication, login, reset request or startup initializer is performed.
 */
import { createHash } from "node:crypto";
import { access, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import pg from "../../artifacts/api-server/node_modules/pg/lib/index.js";
import {
  CLEARED_TABLES,
  COUNTER_TABLES,
  MIXED_TABLES,
  PRESERVED_TABLES,
  REQUIRED_TABLES,
} from "../../artifacts/api-server/src/lib/test-reset/manifest.ts";

const mode = process.argv[2];
if (mode !== "before" && mode !== "after") {
  throw new Error("Uso: node reports/test-reset-20260925/capture-activation.mts before|after");
}
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL no está configurada; no se consultó ninguna base.");

const destination = fileURLToPath(new URL(`./activation-${mode}.json`, import.meta.url));
try {
  await access(destination);
  throw new Error(`El censo ${mode} ya existe. No se sobrescribe evidencia.`);
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
}

const connection = new pg.Client({ connectionString: process.env.DATABASE_URL });
const classified = new Map<string, string>([
  ...PRESERVED_TABLES.map(name => [name, "protected"] as const),
  ...CLEARED_TABLES.map(name => [name, "operational"] as const),
  ...COUNTER_TABLES.map(name => [name, "counter"] as const),
  ...MIXED_TABLES.map(name => [name, "mixed"] as const),
]);
const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");
const quote = (name: string) => `"${name.replaceAll('"', '""')}"`;

try {
  await connection.connect();
  await connection.query("BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");
  await connection.query("SET LOCAL statement_timeout = '60s'");
  const identity = await connection.query<{
    db: string; oid: string; address: string | null; port: string | null; version: string;
  }>(`SELECT current_database() AS db,
      (SELECT oid::text FROM pg_database WHERE datname=current_database()) AS oid,
      inet_server_addr()::text AS address, inet_server_port()::text AS port,
      current_setting('server_version_num') AS version`);
  const row = identity.rows[0];
  if (!row) throw new Error("No se identificó la base de datos.");
  // The fingerprint is stable across both captures but hides DB names,
  // account names, server addresses, connection strings and credentials.
  const databaseFingerprint = sha256(JSON.stringify([
    new URL(process.env.DATABASE_URL).hostname, row.db, row.oid,
    row.address, row.port, row.version,
  ]));
  const relations = await connection.query<{ name: string; kind: string }>(`
    SELECT c.relname AS name, c.relkind AS kind FROM pg_class c
    JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relkind IN ('r','p','f')
    ORDER BY c.relname`);
  const unknown = relations.rows.filter(
    relation => !classified.has(relation.name) || relation.kind !== "r",
  );
  const missing = REQUIRED_TABLES.filter(
    name => !relations.rows.some(relation => relation.name === name),
  );
  // Exactly the read-only schema criteria in inspectResetSchema; no install,
  // lock, write or reset request is needed to establish availability.
  if (unknown.length || missing.length) throw new Error("El esquema difiere del manifiesto de reset.");
  const digest = await connection.query<{ available: boolean }>(
    "SELECT to_regprocedure('digest(text,text)') IS NOT NULL AS available",
  );
  if (!digest.rows[0]?.available) throw new Error("No está disponible pgcrypto para calcular huellas SHA-256 en el servidor.");

  const tables: Record<string, { category: string; count: string; sha256?: string }> = {};
  for (const relation of relations.rows) {
    if (relation.kind !== "r") throw new Error("Se detectó una relación no ordinaria; censo incompleto.");
    const category = classified.get(relation.name) ?? "unclassified";
    const name = `public.${quote(relation.name)}`;
    const result = category === "protected" || category === "mixed" || category === "counter"
      ? await connection.query<{ count: string; hash: string }>(`
          SELECT count(*)::text AS count,
            encode(digest(COALESCE(string_agg(to_jsonb(t)::text, E'\\n'
              ORDER BY to_jsonb(t)::text), ''), 'sha256'), 'hex') AS hash
          FROM ${name} AS t`)
      : await connection.query<{ count: string; hash?: string }>(`SELECT count(*)::text AS count FROM ${name}`);
    tables[relation.name] = {
      category,
      count: result.rows[0]!.count,
      ...(result.rows[0]!.hash ? { sha256: result.rows[0]!.hash } : {}),
    };
  }
  await connection.query("COMMIT");

  const snapshot = {
    capturedAt: new Date().toISOString(),
    databaseFingerprint,
    schemaFingerprint: sha256(JSON.stringify(relations.rows)),
    historyExists: Object.hasOwn(tables, "test_reset_history"),
    historyCount: tables.test_reset_history?.count ?? null,
    tables,
  };
  if (mode === "before") {
    await writeFile(destination, `${JSON.stringify(snapshot, null, 2)}\n`, { flag: "wx", mode: 0o600 });
    console.log(`BEFORE registrado: ${Object.keys(tables).length} tablas; historial presente: ${snapshot.historyExists}. Solo lectura.`);
  } else {
    const before = JSON.parse(await readFile(new URL("./activation-before.json", import.meta.url), "utf8")) as typeof snapshot;
    const names = new Set([...Object.keys(before.tables), ...Object.keys(tables)]);
    const changedCounts = [...names].filter(name => before.tables[name]?.count !== tables[name]?.count);
    const changedHashes = [...names].filter(name => before.tables[name]?.sha256 !== tables[name]?.sha256);
    const compared = {
      ...snapshot,
      comparison: {
        sameDatabase: before.databaseFingerprint === databaseFingerprint,
        schemaChangedOnlyAsExpected:
          before.schemaFingerprint === snapshot.schemaFingerprint
          || (!before.historyExists && snapshot.historyExists
            && [...names].filter(name => !before.tables[name] || !tables[name]).join(",") === "test_reset_history"),
        changedCounts,
        changedHashes,
      },
    };
    await writeFile(destination, `${JSON.stringify(compared, null, 2)}\n`, { flag: "wx", mode: 0o600 });
    const good = compared.comparison.sameDatabase && compared.comparison.schemaChangedOnlyAsExpected
      && (!before.historyExists
        ? snapshot.historyCount === null || snapshot.historyCount === "0"
        : before.historyCount === snapshot.historyCount)
      && changedCounts.every(name => name === "test_reset_history")
      && changedHashes.every(name => name === "test_reset_history");
    console.log(`${good ? "PASS" : "FAIL"}: diferencias de conteos: ${changedCounts.join(", ") || "ninguna"}; huellas: ${changedHashes.join(", ") || "ninguna"}.`);
    if (!good) process.exitCode = 1;
  }
} catch (error) {
  try { await connection.query("ROLLBACK"); } catch { /* Connection may have ended. */ }
  // Never emit provider errors: some drivers include connection details.
  if (error instanceof Error && error.message.startsWith("El censo ")) throw error;
  console.error("No se pudo completar el censo de solo lectura. No se escribió evidencia parcial.");
  process.exitCode = 1;
} finally {
  await connection.end().catch(() => {});
}