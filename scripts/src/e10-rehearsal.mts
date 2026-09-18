/**
 * Guarded E10 operator entrypoint. It refuses before connection unless the
 * retained-copy manifest is PASS and exactly matches the compiled allowlist.
 * It never reads an ambient DATABASE_URL.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import net from "node:net";
import { syncBuiltinESMExports } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  E10_TARGET,
  assertE10DestinationBeforeConnect,
  connectExactE10,
  e10DestinationRejectionProof,
} from "./e10-isolation-harness.mts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const MANIFEST = resolve(ROOT, "reports/e10-aislado-2026-09-18/aislamiento.json");
const SQL = resolve(ROOT, "reports/e10-aislado-2026-09-18/sql/operativo.sql");
const TRUNCATE_SUPPLEMENT = resolve(ROOT, "reports/e10-aislado-2026-09-18/sql/suplemento-truncate.sql");
const JSON_REPORT = resolve(ROOT, "reports/e10-aislado-2026-09-18/rehearsal-resultados.json");
const MD_REPORT = resolve(ROOT, "reports/e10-aislado-2026-09-18/rehearsal-resultados.md");
const ACK = "E10_PINNED_RETAINED_COPY_ONLY";
const ADDED_TABLES = new Set(["fondo_mariana", "fondo_movimientos", "fondo_arqueos"]);
type Row = Record<string, any>;

function elapsed(start: bigint): number {
  return Number(process.hrtime.bigint() - start) / 1e6;
}
function sha256(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}
function check(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}
function safeError(error: unknown) {
  const clean = (value: unknown) => String(value ?? "unknown failure")
    .replace(/postgres(?:ql)?:\/\/[^\s'"]+/gi, "[REDACTED_CONNECTION]")
    .replace(/\b(password|passfile|token|secret)\s*[=:]\s*[^\s,;]+/gi, "$1=[REDACTED]")
    .replace(/\$\d+\s*=\s*[^\s,;]+/g, "[REDACTED_PARAMETER]")
    .replace(/\nparams:[^\n]*/gi, "\nparams: [REDACTED]")
    .slice(0, 1200);
  const raw = clean((error as any)?.message);
  const cause = (error as any)?.cause ? clean((error as any).cause.message) : undefined;
  return {
    name: typeof (error as any)?.name === "string" ? (error as any).name : "Error",
    code: typeof (error as any)?.code === "string" ? (error as any).code : undefined,
    message: raw,
    cause,
  };
}
function quoteIdent(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}

async function verifiedManifest() {
  const raw = await fs.readFile(MANIFEST, "utf8").catch(() => {
    throw new Error("REFUSED BEFORE CONNECT: E10 isolation manifest is absent.");
  });
  const manifest = JSON.parse(raw) as Row;
  check(manifest.status === "READY" && manifest.verification?.status === "PASS",
    "REFUSED BEFORE CONNECT: manifest is not READY/PASS.");
  check(manifest.retained === true && manifest.guards?.unixSocketOnly === true
    && manifest.guards?.actualIdentityVerified === true,
  "REFUSED BEFORE CONNECT: manifest isolation guards are incomplete.");
  const target = manifest.target;
  check(target?.socketDirectory === E10_TARGET.host && target.port === E10_TARGET.port
    && target.database === E10_TARGET.database && target.role === E10_TARGET.user
    && target.dataDirectory === E10_TARGET.dataDirectory
    && target.systemIdentifier === E10_TARGET.systemIdentifier
    && target.listenAddresses === "" && target.backendNetworkAddress === null,
  "REFUSED BEFORE CONNECT: manifest does not exactly match compiled target.");
  check(manifest.omission?.table === "public.sesiones" && manifest.omission?.rowsRestored === 0,
    "REFUSED BEFORE CONNECT: session omission evidence is invalid.");
  const expected = { host: target.socketDirectory, port: target.port, database: target.database, user: target.role };
  assertE10DestinationBeforeConnect(expected);
  return { manifest, expected, manifestSha256: sha256(raw) };
}

/** Refuse all remote TCP. Loopback is needed only by the ephemeral HTTP test
 * listener; PostgreSQL itself is independently fixed to the Unix socket. */
function installNetworkGuard() {
  const original = net.Socket.prototype.connect;
  (net.Socket.prototype as any).connect = function (...args: any[]) {
    const first = Array.isArray(args[0]) ? args[0][0] : args[0];
    const path = typeof first === "string" ? first : first?.path;
    const host = typeof first === "object" ? first?.host : undefined;
    if (typeof path === "string") {
      assert.equal(path, `${E10_TARGET.host}/.s.PGSQL.${E10_TARGET.port}`,
        "REFUSED: non-allowlisted Unix socket");
    } else {
      assert.ok(host === "127.0.0.1" || host === "::1",
        "REFUSED: remote/source TCP connection");
    }
    return original.apply(this, args as any);
  };
  syncBuiltinESMExports();
}

async function tableSnapshot(client: any) {
  const tables = (await client.query(`SELECT c.relname name
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relkind IN ('r','p') ORDER BY c.relname`)).rows as Row[];
  const rows: Row = {};
  for (const { name } of tables) {
    let result;
    try {
      result = await client.query(`SELECT md5(to_jsonb(t)::text) digest,count(*)::int count
        FROM public.${quoteIdent(name)} t GROUP BY 1 ORDER BY 1`);
    } catch (error) {
      const wrapped = new Error(`baseline/snapshot SELECT failed for public.${name}: ${String((error as any)?.message ?? "database error")}`);
      (wrapped as any).code = (error as any)?.code;
      throw wrapped;
    }
    rows[name] = Object.fromEntries(result.rows.map((row: Row) => [row.digest, row.count]));
  }
  const schema = await client.query(`SELECT c.relname table_name,a.attnum,a.attname,
      format_type(a.atttypid,a.atttypmod) data_type,a.attnotnull,
      pg_get_expr(d.adbin,d.adrelid) default_expression
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    JOIN pg_attribute a ON a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped
    LEFT JOIN pg_attrdef d ON d.adrelid=c.oid AND d.adnum=a.attnum
    WHERE n.nspname='public' AND c.relkind IN ('r','p') ORDER BY 1,2`);
  return {
    tableCount: tables.length,
    tables: tables.map(({ name }) => name),
    rowMultisets: rows,
    schemaSha256: sha256(JSON.stringify(schema.rows)),
  };
}

function assertOriginalRowsPreserved(before: Row, after: Row) {
  for (const table of before.tables) {
    for (const [digest, count] of Object.entries(before.rowMultisets[table] as Row)) {
      assert.ok((after.rowMultisets[table]?.[digest] ?? 0) >= Number(count),
        `Original row changed/deleted: ${table}`);
    }
  }
}

async function schemaObjects(client: any) {
  const rows = await client.query(`SELECT
    (SELECT count(*)::int FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relkind IN ('r','p')) tables,
    (SELECT count(*)::int FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
      JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND NOT t.tgisinternal) triggers,
    (SELECT count(*)::int FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname='public') functions`);
  return rows.rows[0];
}

function isolatedDatabaseUrl() {
  const query = new URLSearchParams({
    host: E10_TARGET.host,
    port: String(E10_TARGET.port),
    user: E10_TARGET.user,
    sslmode: "disable",
    application_name: "e10-rehearsal-isolated",
  });
  return `postgresql:///${E10_TARGET.database}?${query.toString()}`;
}

async function writeReports(report: Row) {
  await fs.mkdir(dirname(JSON_REPORT), { recursive: true });
  await fs.writeFile(JSON_REPORT, `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 });
  const groups = (report.cases?.timings ?? []).map((item: Row) =>
    `| ${item.name} | ${item.milliseconds.toFixed(3)} | ${item.assertions} |`).join("\n");
  const markdown = `# E10 — ensayo PostgreSQL + HTTP aislado

- Estado: **${report.status}**
- Salida terminal: **${report.terminalExit}**
- Total: **${Number(report.timings?.totalMilliseconds ?? 0).toFixed(3)} ms**
- DDL: **${Number(report.timings?.ddlMilliseconds ?? 0).toFixed(3)} ms**
- Destino: socket Unix fijado; base \`${E10_TARGET.database}\`; TCP PostgreSQL deshabilitado.
- Frontera auth: AuthContext en proceso sólo en el arnés; no login, renovación, usuario ni sesión.
- Retención: copia y fixtures conservados; sin limpieza DELETE.

| Grupo | ms monotónicos | aserciones |
|---|---:|---:|
${groups}

El JSON adjunto contiene hashes, conteos, identidad efectiva, conciliación y evidencia por caso.
`;
  await fs.writeFile(MD_REPORT, markdown, { mode: 0o600 });
}

async function main() {
  const total = process.hrtime.bigint();
  let stage = "argument-validation";
  let operatorClient: any = null;
  const report: Row = {
    status: "RUNNING", terminalExit: null, startedAtUtc: new Date().toISOString(),
    commands: {
      review: "pnpm --filter @workspace/scripts exec tsx src/e10-rehearsal.mts --review",
      execute: `pnpm --filter @workspace/scripts exec tsx src/e10-rehearsal.mts --execute --ack ${ACK}`,
    },
  };
  try {
    const mode = process.argv[2];
    if (mode === "--review") {
      const sql = await fs.readFile(SQL);
      console.log(JSON.stringify({ status: "REVIEW_ONLY", sql: "reports/e10-aislado-2026-09-18/sql/operativo.sql",
        sqlSha256: sha256(sql), manifestPresent: await fs.stat(MANIFEST).then(() => true).catch(() => false) }));
      return;
    }
    check(mode === "--execute" && process.argv[3] === "--ack" && process.argv[4] === ACK,
      "Exact execute mode and acknowledgement required.");
    stage = "manifest-and-before-connect-guards";
    const pinned = await verifiedManifest(); // must happen before every connection
    e10DestinationRejectionProof();
    installNetworkGuard();
    for (const key of ["APPLICATION_DATABASE_URL", "TEST_DATABASE_URL", "DATABASE_TEST_URL",
      "PGPASSWORD", "PGPASSFILE", "PGHOST", "PGPORT", "PGUSER", "PGDATABASE"]) delete process.env[key];
    process.env.NODE_ENV = "test";
    process.env.FONDO_E10_ENABLED = "true";
    process.env.DATABASE_URL = isolatedDatabaseUrl();

    stage = "effective-isolated-identity";
    const identityClient = await connectExactE10(pinned.expected);
    operatorClient = identityClient;
    const identity = (await identityClient.query(`SELECT current_database() database,
      current_setting('data_directory') data_directory,current_setting('unix_socket_directories') socket,
      inet_server_addr()::text address,inet_server_port() server_port,
      (SELECT system_identifier::text FROM pg_control_system()) system_identifier`)).rows[0];
    report.destination = {
      database: identity.database, dataDirectory: identity.data_directory, socket: identity.socket,
      backendAddress: identity.address, backendPort: identity.server_port, nonTcp: identity.address === null,
      systemIdentifier: identity.system_identifier, manifestSha256: pinned.manifestSha256,
    };
    assert.equal(report.destination.nonTcp, true);
    stage = "baseline-row-and-schema-snapshot";
    const before = await tableSnapshot(identityClient);
    const resumed = before.tableCount === 69 && [...ADDED_TABLES].every((table) => before.tables.includes(table));
    let objectsBefore: Row;
    let afterDdl: Row;
    if (!resumed) {
      assert.equal(before.tableCount, 66, "Expected retained baseline of exactly 66 tables");
      for (const table of ADDED_TABLES) assert.ok(!before.tables.includes(table), `${table} unexpectedly exists before DDL`);
      objectsBefore = await schemaObjects(identityClient);
      const sql = await fs.readFile(SQL, "utf8");
      stage = "authorized-e10-ddl-transaction";
      // The isolation helper intentionally starts with pg_catalog first. E10 SQL
      // contains unqualified, reviewed public object names, so pin the DDL
      // creation namespace explicitly rather than attempting CREATE in
      // pg_catalog. This grants/bypasses nothing.
      await identityClient.query("SET search_path TO public, pg_catalog");
      const ddlStart = process.hrtime.bigint();
      await identityClient.query(sql);
      report.timings = { ddlMilliseconds: elapsed(ddlStart) };
      stage = "post-ddl-snapshot";
      afterDdl = await tableSnapshot(identityClient);
      assert.equal(afterDdl.tableCount, 69);
      assertOriginalRowsPreserved(before, afterDdl);
    } else {
      // A prior run applied the atomic DDL and committed append-only fixtures,
      // then failed solely because fetch text decoding strips a UTF-8 BOM.
      // Never reapply DDL or delete those fixtures; retain its measured time.
      const prior = JSON.parse(await fs.readFile(resolve(ROOT,
        "reports/e10-aislado-2026-09-18/rehearsal-intento-fallido-2026-09-18T173642Z-bom.json"), "utf8"));
      check(prior.failedStage === "service-and-http-cases" && Number(prior.timings?.ddlMilliseconds) > 0,
        "Existing E10 objects lack the preserved atomic-DDL attempt evidence.");
      report.timings = { ddlMilliseconds: Number(prior.timings.ddlMilliseconds) };
      report.resume = {
        priorEvidence: "reports/e10-aislado-2026-09-18/rehearsal-intento-fallido-2026-09-18T173642Z-bom.json",
        reason: "harness-only UTF-8 BOM decoding assertion corrected; DDL not repeated; append-only fixtures reused",
      };
      objectsBefore = pinned.manifest.verification.sourceSummary;
      afterDdl = before;
    }
    const truncateGuards = await identityClient.query(`SELECT count(*)::int count
      FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relname IN ('fondo_mariana','fondo_movimientos','fondo_arqueos')
        AND t.tgname LIKE '%immutable_before_truncate' AND NOT t.tgisinternal`);
    if (truncateGuards.rows[0].count === 0) {
      stage = "authorized-e10-truncate-guard-supplement";
      const supplement = await fs.readFile(TRUNCATE_SUPPLEMENT, "utf8");
      const supplementStart = process.hrtime.bigint();
      await identityClient.query(supplement);
      report.timings.truncateSupplementMilliseconds = elapsed(supplementStart);
      report.supplementalSql = {
        path: "reports/e10-aislado-2026-09-18/sql/suplemento-truncate.sql",
        sha256: sha256(supplement),
      };
    } else {
      assert.equal(truncateGuards.rows[0].count, 3, "Partial E10 TRUNCATE guard installation");
      report.timings.truncateSupplementMilliseconds = null;
      report.truncateSupplement = {
        alreadyPresentAndVerified: true,
        timing: "Earlier actual application duration unavailable; no-op verification is not reported as application time.",
      };
    }
    await identityClient.end();
    operatorClient = null;

    // Actual Fondo service gets a Pool-shaped adapter whose every connection is
    // independently checked by connectExactE10 before being returned.
    const guardedPool: any = {
      connect: async () => {
        const client = await connectExactE10(pinned.expected);
        return Object.assign(client, { release: () => { void client.end(); } });
      },
      query: async (text: string, values?: readonly unknown[]) => {
        const client = await connectExactE10(pinned.expected);
        try { return await client.query(text, values as any[]); }
        finally { await client.end(); }
      },
    };
    stage = "existing-admin-actor-read";
    const actorRow = await guardedPool.query(`SELECT id,nombre,rol::text rol FROM usuarios
      WHERE activo IS TRUE AND rol::text='ADMIN' ORDER BY id LIMIT 1`);
    check(actorRow.rows.length === 1, "No existing active ADMIN actor in retained copy.");
    const casesModule = await import(pathToFileURL(resolve(ROOT, "scripts/src/e10-rehearsal-cases.mts")).href);
    stage = "service-and-http-cases";
    report.cases = await casesModule.runE10RehearsalCases({
      pool: guardedPool, actor: actorRow.rows[0], destinationEvidence: report.destination,
    });
    stage = "final-preservation-snapshot";
    const afterClient = await connectExactE10(pinned.expected);
    const after = await tableSnapshot(afterClient);
    const objectsAfter = await schemaObjects(afterClient);
    assertOriginalRowsPreserved(before, after);
    for (const table of before.tables) {
      if (table === "auditoria" || ADDED_TABLES.has(table)) continue;
      assert.deepEqual(after.rowMultisets[table], before.rowMultisets[table],
        `Unexpected non-audit legacy changes in ${table}`);
    }
    const sessions = await afterClient.query("SELECT count(*)::int count FROM sesiones");
    assert.equal(sessions.rows[0].count, 0);
    await afterClient.end();
    report.baseline = {
      originalTableCount: 66, afterTableCount: after.tableCount,
      originalSchemaSha256: resumed ? pinned.manifest.verification.sourceSummary.columns.sha256 : before.schemaSha256,
      afterSchemaSha256: after.schemaSha256,
      objectsBefore, objectsAfter, addedTables: [...ADDED_TABLES],
      originalRowsPreserved: true, onlyLegacyAppendAllowed: "auditoria/FONDO",
    };
    report.status = "PASS";
    report.terminalExit = 0;
    report.timings.totalMilliseconds = elapsed(total);
    report.timings.totalScope = "final verification process; atomic DDL duration is preserved separately from its earlier attempt";
    report.finishedAtUtc = new Date().toISOString();
    await writeReports(report);
    console.log(JSON.stringify({ status: report.status, terminalExit: 0,
      totalMilliseconds: report.timings.totalMilliseconds, ddlMilliseconds: report.timings.ddlMilliseconds,
      json: JSON_REPORT, markdown: MD_REPORT }));
  } catch (error) {
    await operatorClient?.end().catch(() => undefined);
    operatorClient = null;
    report.status = "FAIL";
    report.terminalExit = 1;
    report.error = safeError(error);
    report.failedStage = stage;
    report.timings = { ...(report.timings ?? {}), totalMilliseconds: elapsed(total) };
    await writeReports(report).catch(() => undefined);
    console.error(JSON.stringify({ status: "FAIL", terminalExit: 1, error: report.error,
      json: JSON_REPORT, markdown: MD_REPORT }));
    process.exitCode = 1;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();