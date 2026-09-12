/**
 * Guarded, read-evidence wrapper for the real inventory-cache rebuild.
 *
 * This file is intentionally not run automatically. It never creates users,
 * runs seed, starts a server, creates a database, or drops a database. The
 * disposable database and its fixtures must already exist before an operator
 * explicitly invokes it.
 *
 * Required invocation guards:
 *   RUN_DISPOSABLE_RECONSTRUCTION=1
 *   NODE_ENV=test
 *   TEST_DATABASE_URL=<local-disposable-url>
 *   APPLICATION_DATABASE_URL=<local-disposable-admin-url>
 *
 * The script rejects non-local URLs and database names without a disposable
 * marker. URL values are never printed.
 */
import assert from "node:assert/strict";

const testUrl = process.env.TEST_DATABASE_URL;
const applicationUrl = process.env.APPLICATION_DATABASE_URL;
const originalDatabaseUrl = process.env.DATABASE_URL;

if (process.env.RUN_DISPOSABLE_RECONSTRUCTION !== "1") {
  throw new Error(
    "Refusing to run: set RUN_DISPOSABLE_RECONSTRUCTION=1 for an explicit disposable verification.",
  );
}
if (process.env.NODE_ENV !== "test") {
  throw new Error("Refusing to run: NODE_ENV=test is required.");
}
if (!testUrl || !applicationUrl) {
  throw new Error(
    "Refusing to run: TEST_DATABASE_URL and APPLICATION_DATABASE_URL are required.",
  );
}
if (
  testUrl === applicationUrl ||
  testUrl === originalDatabaseUrl ||
  applicationUrl === originalDatabaseUrl
) {
  throw new Error(
    "Refusing to run: the disposable URL must differ from application URLs.",
  );
}

function parseAndGuardUrl(name: string, value: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`Refusing to run: ${name} is not a valid PostgreSQL URL.`);
  }
  if (!["localhost", "127.0.0.1", "::1"].includes(parsed.hostname)) {
    throw new Error(`Refusing to run: ${name} must target a local disposable server.`);
  }
  return parsed;
}

const target = parseAndGuardUrl("TEST_DATABASE_URL", testUrl);
parseAndGuardUrl("APPLICATION_DATABASE_URL", applicationUrl);
if (!/(disposable|rebuild|test|ci)/i.test(target.pathname)) {
  throw new Error(
    "Refusing to run: TEST_DATABASE_URL must name a disposable/test database.",
  );
}

const { pool } = await import("../../lib/db/src/index.ts");
const { reconstruirCacheExistencias } = await import(
  "../../artifacts/api-server/src/lib/inventario.ts"
);

type Row = Record<string, unknown>;
const query = async (text: string): Promise<Row[]> =>
  (await pool.query(text)).rows;
const identity = async (): Promise<Row> =>
  (await query(
    "SELECT current_database(), current_user, current_setting('data_directory') AS data_directory, inet_server_addr()::text AS server_addr, inet_server_port() AS server_port",
  ))[0];
const cache = async (): Promise<Row[]> =>
  await query(
    "SELECT producto_id, ubicacion_id, cantidad_total::text AS cantidad_total, rollos_count FROM existencias ORDER BY producto_id, ubicacion_id",
  );
const counts = async (): Promise<Row> =>
  (await query(
    "SELECT (SELECT count(*)::int FROM existencias) AS existencias, (SELECT count(*)::int FROM movimientos) AS movimientos, (SELECT count(*)::int FROM rollos) AS rollos",
  ))[0];

try {
  const beforeIdentity = await identity();
  assert.match(String(beforeIdentity.current_database), /(disposable|rebuild|test|ci)/i);
  const before = {
    identity: beforeIdentity,
    counts: await counts(),
    cache: await cache(),
  };

  await reconstruirCacheExistencias();

  const after = {
    identity: await identity(),
    counts: await counts(),
    cache: await cache(),
  };
  assert.equal(after.identity.current_database, before.identity.current_database);
  assert.deepEqual(after.identity.data_directory, before.identity.data_directory);
  assert.notDeepEqual(after.cache, before.cache);

  process.stdout.write(
    `${JSON.stringify(
      {
        status: "PASS",
        operation: "reconstruirCacheExistencias",
        mocked_db: false,
        before,
        after,
        executed_with: "explicit local disposable URL; URL values omitted",
      },
      null,
      2,
    )}\n`,
  );
} finally {
  await pool.end();
}