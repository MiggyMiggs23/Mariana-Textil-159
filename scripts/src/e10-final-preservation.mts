/**
 * Final E10 post-browser verification. This operator is strictly read-only and
 * accepts only the retained Unix-socket copy pinned by the E10 harness.
 */
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  E10_TARGET,
  assertE10DestinationBeforeConnect,
  connectExactE10,
} from "./e10-isolation-harness.mts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const ACK = "E10_FINAL_READ_ONLY_POST_BROWSER";
const MANIFEST = resolve(ROOT, "reports/e10-aislado-2026-09-18/aislamiento.json");
const BASELINE = resolve(ROOT, ".local/backups/e10-20260918-isolated/restored-snapshot.json");
const REPORT = resolve(ROOT, "reports/e10-aislado-2026-09-18/post-browser-preservacion.json");
const requireFromApi = createRequire(resolve(ROOT, "artifacts/api-server/package.json"));
type Row = Record<string, any>;

function quoteIdent(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}

async function buildFinancialReaders() {
  const output = resolve(ROOT, ".local/e10-final-financial-readers.mjs");
  const esbuild = requireFromApi("esbuild") as { build(options: Row): Promise<void> };
  const admin = resolve(ROOT, "artifacts/api-server/src/lib/admin-analytics.ts");
  const cartera = resolve(ROOT, "artifacts/api-server/src/lib/clientes-cartera-read-model.ts");
  await esbuild.build({
    stdin: {
      contents: `export { getSalesSummary, getDestinationCollectedAmount } from ${JSON.stringify(admin)};
        export { readClientesCartera } from ${JSON.stringify(cartera)};`,
      resolveDir: ROOT,
      sourcefile: "e10-final-financial-entry.ts",
      loader: "ts",
    },
    bundle: true,
    platform: "node",
    format: "esm",
    outfile: output,
    plugins: [{
      name: "e10-read-only-workspace-db",
      setup(build: any) {
        build.onResolve({ filter: /^@workspace\/db$/ }, () => ({ path: "workspace-db", namespace: "e10" }));
        build.onLoad({ filter: /.*/, namespace: "e10" }, () => ({
          contents: "export const pool = globalThis.__e10FinalReadOnlyPool;",
          loader: "js",
        }));
      },
    }],
  });
  return output;
}

async function main() {
  assert.deepEqual(process.argv.slice(2), ["--verify", "--ack", ACK],
    "Exact read-only mode and acknowledgement required");
  const manifest = JSON.parse(await fs.readFile(MANIFEST, "utf8")) as Row;
  assert.equal(manifest.status, "READY");
  assert.equal(manifest.verification?.status, "PASS");
  assert.deepEqual(manifest.target, {
    socketDirectory: E10_TARGET.host,
    port: E10_TARGET.port,
    database: E10_TARGET.database,
    dataDirectory: E10_TARGET.dataDirectory,
    systemIdentifier: E10_TARGET.systemIdentifier,
    role: E10_TARGET.user,
    listenAddresses: "",
    backendNetworkAddress: null,
  });
  const expected = {
    host: E10_TARGET.host,
    port: E10_TARGET.port,
    database: E10_TARGET.database,
    user: E10_TARGET.user,
  };
  assertE10DestinationBeforeConnect(expected);
  const baseline = JSON.parse(await fs.readFile(BASELINE, "utf8")) as Row;
  assert.equal(baseline.catalog.tableEvidence.length, 66);
  const financialModule = await buildFinancialReaders();

  const client = await connectExactE10(expected);
  const started = process.hrtime.bigint();
  try {
    await client.query("BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");
    const identity = (await client.query(`SELECT current_database() database,
      current_setting('data_directory') data_directory,
      current_setting('unix_socket_directories') socket,
      inet_server_addr()::text address,
      (SELECT system_identifier::text FROM pg_control_system()) system_identifier`)).rows[0];
    assert.equal(identity.database, E10_TARGET.database);
    assert.equal(identity.data_directory, E10_TARGET.dataDirectory);
    assert.equal(identity.address, null);
    assert.equal(identity.system_identifier, E10_TARGET.systemIdentifier);

    const auditQueries = await import(
      pathToFileURL(resolve(ROOT, "artifacts/api-server/src/lib/auditoria-queries.ts")).href
    );
    const { PgDialect } = requireFromApi("drizzle-orm/pg-core") as {
      PgDialect: new () => { sqlToQuery(query: unknown): { sql: string; params: unknown[] } };
    };
    const nonFondo = new PgDialect().sqlToQuery(auditQueries.nonFondoAuditSql());
    assert.equal(nonFondo.params.length, 0);

    const comparisons: Row[] = [];
    for (const expectedTable of baseline.catalog.tableEvidence as Row[]) {
      const table = String(expectedTable.table);
      let row;
      if (table === "sesiones") {
        row = (await client.query("SELECT count(*)::text count FROM public.sesiones")).rows[0];
        assert.equal(row.count, "0");
        comparisons.push({ table, count: row.count, baselineCount: "0", status: "MATCH_OMITTED" });
        continue;
      }
      const alias = table === "auditoria" ? "a" : "t";
      const where = table === "auditoria" ? `WHERE ${nonFondo.sql}` : "";
      row = (await client.query(`WITH r AS (
        SELECT to_jsonb(${alias})::text canonical
        FROM public.${quoteIdent(table)} ${alias} ${where})
        SELECT count(*)::text count,
          md5(COALESCE(string_agg(md5(canonical),'' ORDER BY canonical,md5(canonical)),'')) "canonicalHash"
        FROM r`)).rows[0];
      assert.equal(row.count, expectedTable.count, `${table} legacy count changed`);
      assert.equal(row.canonicalHash, expectedTable.canonicalHash, `${table} legacy rows changed`);
      comparisons.push({
        table,
        count: row.count,
        canonicalHash: row.canonicalHash,
        status: table === "auditoria" ? "MATCH_NON_FONDO_BASELINE" : "MATCH",
      });
    }

    const tables = (await client.query(`SELECT c.relname name
      FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relkind IN ('r','p') ORDER BY c.relname`)).rows;
    assert.equal(tables.length, 69);
    for (const table of ["fondo_mariana", "fondo_movimientos", "fondo_arqueos"]) {
      assert.ok(tables.some((row: Row) => row.name === table));
    }
    const audit = (await client.query(`SELECT count(*)::int total,
      count(*) FILTER (WHERE NOT (${nonFondo.sql}))::int fondo
      FROM auditoria a`)).rows[0];
    const baselineAudit = (baseline.catalog.tableEvidence as Row[])
      .find((row) => row.table === "auditoria");
    assert.ok(baselineAudit);
    assert.equal(audit.total - audit.fondo, Number(baselineAudit.count));

    const readOnlyPool = {
      query: (text: string, values?: readonly unknown[]) => {
        assert.match(text, /^\s*(SELECT|WITH)\b/i, "Financial reader attempted a write");
        return client.query(text, values as any[]);
      },
      connect: () => { throw new Error("Financial reader attempted singleton connect"); },
    };
    (globalThis as any).__e10FinalReadOnlyPool = readOnlyPool;
    const production = await import(`${pathToFileURL(financialModule).href}?final=1`);
    const filters = {
      desde: new Date("2000-01-01T00:00:00.000Z"),
      hasta: new Date("2099-12-31T23:59:59.999Z"),
    };
    const sales = await production.getSalesSummary(filters);
    const cartera = await production.readClientesCartera({
      auth: {
        sessionId: "e10-final-read-only-context",
        user: { id: 1, nombre: "Administrador", rol: "ADMIN", activo: true, ubicacionId: null },
        location: null,
      },
      query: {},
      database: readOnlyPool,
      resolveReadScope: () => ({ ubicacionId: undefined, scopeError: null }),
      now: () => new Date("2026-09-18T12:00:00.000-06:00"),
    });
    const financial = {
      ventas: sales.ventas,
      contadoCobrado: sales.cobrado,
      cobranzaClientes: await production.getDestinationCollectedAmount(filters, "CUENTAS_POR_COBRAR"),
      deudaClientes: cartera.resumen.totalCartera,
    };
    assert.deepEqual(financial, {
      ventas: "16000.00",
      contadoCobrado: "0.00",
      cobranzaClientes: "0.00",
      deudaClientes: "0.00",
    });

    const accounts = (await client.query(`SELECT
      (SELECT count(*)::int FROM usuarios) usuarios,
      (SELECT count(*)::int FROM sesiones) sesiones`)).rows[0];
    assert.deepEqual(accounts, { usuarios: 31, sesiones: 0 });
    const fondo = (await client.query(`SELECT
      count(*)::int movimientos,
      COALESCE(SUM(CASE WHEN naturaleza='INGRESO' THEN importe_centavos ELSE -importe_centavos END),0)::text saldo_centavos,
      (SELECT count(*)::int FROM fondo_arqueos) arqueos,
      max(ordinal)::text ultimo_ordinal
      FROM fondo_movimientos`)).rows[0];
    assert.deepEqual(fondo, {
      movimientos: 18,
      saldo_centavos: "-100000",
      arqueos: 3,
      ultimo_ordinal: "18",
    });
    const browser = (await client.query(`SELECT
      count(*) FILTER (WHERE motivo='E10 navegador capital' AND importe_centavos=200025)::int capital,
      count(*) FILTER (WHERE motivo='E10 navegador inverso' AND importe_centavos=200025 AND naturaleza='RETIRO')::int inverso
      FROM fondo_movimientos`)).rows[0];
    assert.deepEqual(browser, { capital: 1, inverso: 1 });

    await client.query("COMMIT");
    const report = {
      status: "PASS",
      mode: "FINAL_READ_ONLY_POST_BROWSER",
      finishedAtUtc: new Date().toISOString(),
      elapsedMilliseconds: Number(process.hrtime.bigint() - started) / 1e6,
      destination: identity,
      baseline: {
        originalTables: 66,
        currentTables: 69,
        comparisons,
        allOriginalRowsPreserved: true,
        auditAllowance: {
          baselineNonFondo: audit.total - audit.fondo,
          fondoAppends: audit.fondo,
          onlyFondoExcludedFromBaselineComparison: true,
        },
      },
      accounts,
      financial: {
        ...financial,
        window: {
          desde: filters.desde.toISOString(),
          hasta: filters.hasta.toISOString(),
          scope: "GLOBAL ADMIN, active clients",
        },
        unchangedFromMainTrial: true,
      },
      fondo: {
        movimientos: fondo.movimientos,
        saldo: "-1000.00",
        saldoCentavos: fondo.saldo_centavos,
        arqueos: fondo.arqueos,
        ultimoOrdinal: fondo.ultimo_ordinal,
        browserRows: browser,
      },
      noWritesExecuted: true,
    };
    await fs.writeFile(REPORT, `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 });
    console.log(JSON.stringify({ status: "PASS", report: REPORT, fondo: report.fondo, financial }));
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    await client.end();
  }
}

await main();