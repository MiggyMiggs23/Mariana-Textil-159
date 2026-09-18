/**
 * E2 historical evidence operator. NOT executed during preparation.
 * capture requires explicit review acknowledgement; compare is filesystem-only.
 * Only the graph-checked cash reader is imported; no db entrypoint/startup.
 */
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFile, writeFile, mkdir, realpath } from "node:fs/promises";
import { dirname, resolve, relative, isAbsolute } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRequire } from "node:module";
import { Client } from "pg";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const REPORTS = resolve(ROOT, "reports");
const ACK = "E2_READ_ONLY_REVIEWED";
const FORMAT = "e2-historical-readonly-v2";
const sha = (value: string) => createHash("sha256").update(value).digest("hex");
const READER_PATH = "artifacts/api-server/src/lib/caja-corte-reader.ts";
type CashReader = typeof import("../../artifacts/api-server/src/lib/caja-corte-reader").readSessionCash;
type CashDatabase = Parameters<CashReader>[0];

/**
 * Build-to-memory is a graph preflight, NOT app startup or a generated adapter.
 * The actual source export is invoked later with Drizzle over our same Client.
 * esbuild erases import type; runtime imports of the DB root fail before connect.
 */
async function loadRealReader() {
  const requireApi = createRequire(resolve(ROOT, "artifacts/api-server/package.json"));
  const builder = requireApi("esbuild") as {
    build(options: Record<string, unknown>): Promise<{ metafile: { inputs: Record<string, unknown> } }>;
  };
  const graph = await builder.build({
    absWorkingDir: ROOT, entryPoints: [resolve(ROOT, READER_PATH)],
    bundle: true, platform: "node", format: "esm", write: false, metafile: true,
    logLevel: "silent",
    plugins: [{
      name: "e2-forbid-runtime-db-and-network",
      setup(build: { onResolve(options: { filter: RegExp }, callback: (args: { path: string }) => unknown): void }) {
        build.onResolve({
          filter: /^(@workspace\/db$|pg(?:\/|$)|postgres(?:\/|$)|(?:node:)?(?:net|tls|http|https|http2|dns|child_process)$)/,
        }, () => ({ errors: [{ text: "E2: runtime DB/startup/network import forbidden" }] }));
      },
    }],
  });
  const sourceHashes: Record<string, string> = {};
  for (const path of Object.keys(graph.metafile.inputs).sort()) {
    const absolute = resolve(ROOT, path);
    if (absolute === resolve(ROOT, "lib/db/src/index.ts") ||
      absolute === resolve(ROOT, "artifacts/api-server/src/index.ts")) {
      fail("Import runtime de entrypoint prohibido.");
    }
    sourceHashes[relative(ROOT, absolute)] = sha(await readFile(absolute, "utf8"));
  }
  const { readSessionCash } = await import(pathToFileURL(resolve(ROOT, READER_PATH)).href) as { readSessionCash: CashReader };
  const { drizzle } = requireApi("drizzle-orm/node-postgres") as { drizzle(client: Client): CashDatabase };
  return { readSessionCash, drizzle, sourceHashes };
}

// Deliberately preserves three legacy surfaces, not a replacement E2 reader.
// Detail excludes CANCELADO; historial/admin require VENDIDO. Admin ignores
// outflows, including its difference filter and aggregate expected amount.
const LEGACY_SQL = `
WITH amounts AS (
  SELECT s.id, s.abierta_at, s.cerrada_at, s.fondo_inicial, s.efectivo_contado,
    COALESCE((SELECT SUM(p.importe) FROM public.ticket_pagos p
      JOIN public.tickets t ON t.id=p.ticket_id
      WHERE t.sesion_caja_id=s.id AND t.estado <> 'CANCELADO'
        AND p.forma_pago='EFECTIVO'),0) AS detail_cash,
    COALESCE((SELECT SUM(p.importe) FROM public.ticket_pagos p
      JOIN public.tickets t ON t.id=p.ticket_id
      WHERE t.sesion_caja_id=s.id AND t.estado='VENDIDO'
        AND p.forma_pago='EFECTIVO'),0) AS sold_cash,
    COALESCE((SELECT SUM(o.monto) FROM public.salidas_dinero_caja o
      WHERE o.sesion_caja_id=s.id AND o.cuenta_origen='CAJA_FISICA'),0) AS outflows,
    EXISTS(SELECT 1 FROM public.ubicaciones u WHERE u.id=s.ubicacion_id)
      AND EXISTS(SELECT 1 FROM public.usuarios u WHERE u.id=s.usuario_id) AS listed
  FROM public.sesiones_caja s WHERE s.estado='CERRADA'
), values_by_surface AS (
  SELECT id, abierta_at, cerrada_at, fondo_inicial, efectivo_contado,
    'detalle'::text AS surface, fondo_inicial+detail_cash-outflows AS expected
  FROM amounts
  UNION ALL
  SELECT id, abierta_at, cerrada_at, fondo_inicial, efectivo_contado,
    'historial', fondo_inicial+sold_cash-outflows FROM amounts WHERE listed
  UNION ALL
  SELECT id, abierta_at, cerrada_at, fondo_inicial, efectivo_contado,
    'admin', fondo_inicial+sold_cash FROM amounts WHERE listed
)
SELECT jsonb_build_object(
  'sessionId',id, 'surface',surface,
  'fund',fondo_inicial::numeric(24,2)::text,
  'openedAt',abierta_at::text, 'closedAt',cerrada_at::text,
  'expected',expected::numeric(24,2)::text,
  'counted',efectivo_contado::numeric(24,2)::text,
  'difference',(efectivo_contado-expected)::numeric(24,2)::text,
  'hasDifference',efectivo_contado IS NOT NULL AND efectivo_contado-expected <> 0
)::text AS canonical FROM values_by_surface ORDER BY id,surface`;

const TABLES = [
  "sesiones_caja", "ticket_pagos", "tickets", "salidas_dinero_caja",
  "movimientos_credito", "aplicaciones_credito", "operaciones_credito_e1",
  "cobros_credito_pendientes_e1", "atribuciones_credito_e1", "auditoria",
] as const;

type Fingerprint = { count: string; sha256: string };
type LegacyRow = {
  sessionId: number; surface: "detalle" | "historial" | "admin";
  fund: string; expected: string; counted: string | null;
  difference: string | null; hasDifference: boolean;
};
type ReaderEvidence = {
  status: "MATCH" | "MISMATCH" | "NO_CLOSED_ROWS";
  module: typeof READER_PATH;
  sourceHashes: Record<string, string>;
  sameTransaction: true;
  checkedRows: number;
  canonicalRows: string[];
  sha256: string;
  mismatches: Array<{ sessionId: number; surface: string; field: string }>;
};
type Snapshot = {
  format: typeof FORMAT;
  provenance: { revision: string; dirty: boolean; scriptSha256: string; legacySqlSha256: string };
  identity: string;
  transaction: string;
  legacy: { canonicalRows: string[]; sha256: string; count: number };
  tables: Record<string, Fingerprint>;
  applicationReader: ReaderEvidence;
};

function fail(message: string): never { throw new Error(message); }

async function reportPath(value: string, writing = false): Promise<string> {
  const path = resolve(ROOT, value);
  const rel = relative(REPORTS, path);
  if (!rel || rel.startsWith("..") || isAbsolute(rel) || !path.endsWith(".json")) {
    fail("El archivo debe ser JSON dentro de reports/.");
  }
  if (writing) await mkdir(dirname(path), { recursive: true });
  const actualParent = await realpath(dirname(path));
  const actualReports = await realpath(REPORTS);
  const parentRel = relative(actualReports, actualParent);
  if (parentRel.startsWith("..") || isAbsolute(parentRel)) fail("Ruta fuera de reports.");
  if (!writing) {
    const fileRel = relative(actualReports, await realpath(path));
    if (fileRel.startsWith("..") || isAbsolute(fileRel)) fail("Archivo fuera de reports.");
  }
  return path;
}

function revision() {
  // Git metadata only; never reads environment/credential files.
  return {
    revision: execFileSync("git", ["rev-parse", "HEAD"], { cwd: ROOT, encoding: "utf8" }).trim(),
    dirty: execFileSync("git", ["status", "--porcelain"], { cwd: ROOT, encoding: "utf8" }).trim().length > 0,
  };
}

async function capture(): Promise<Snapshot> {
  // Preflight/import is before reading connection configuration or opening a socket.
  const reader = await loadRealReader();
  // Only this function reads the chosen connection variable or opens a socket.
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) fail("DATABASE_URL requerida; no se muestra su contenido.");
  const client = new Client({
    connectionString,
    application_name: "e2-historical-readonly",
    options: "-c default_transaction_read_only=on -c statement_timeout=60000 -c lock_timeout=5000",
    connectionTimeoutMillis: 15000,
  });
  try {
    await client.connect();
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    await client.query("SET LOCAL TIME ZONE 'UTC'");
    await client.query("SET LOCAL DateStyle = 'ISO, YMD'");
    await client.query("SET LOCAL extra_float_digits = 3");
    const safety = await client.query<{ value: string }>("SHOW transaction_read_only");
    if (Object.values(safety.rows[0] ?? {})[0] !== "on") fail("Transacción no es sololectura.");
    const defaultSafety = await client.query<{ value: string }>("SHOW default_transaction_read_only");
    if (Object.values(defaultSafety.rows[0] ?? {})[0] !== "on") fail("Conexión no tiene default read-only.");
    const identity = await client.query<{ canonical: string }>(`
      SELECT jsonb_build_object('database',current_database(),
        'databaseOid',(SELECT oid::text FROM pg_database WHERE datname=current_database()),
        'server',inet_server_addr()::text,'port',inet_server_port(),
        'version',current_setting('server_version_num'))::text canonical`);
    const transaction = await client.query<{ canonical: string }>(`
      SELECT jsonb_build_object('capturedAt',transaction_timestamp()::text,
        'snapshot',pg_current_snapshot()::text,
        'readOnly',current_setting('transaction_read_only'),
        'defaultReadOnly',current_setting('default_transaction_read_only'),
        'isolation',current_setting('transaction_isolation'),
        'timezone',current_setting('TimeZone'))::text canonical`);
    const legacy = await client.query<{ canonical: string }>(LEGACY_SQL);
    const canonicalRows = legacy.rows.map(row => row.canonical);
    const database = reader.drizzle(client);
    const readerRows: string[] = [];
    const mismatches: ReaderEvidence["mismatches"] = [];
    for (const canonical of canonicalRows) {
      const row = JSON.parse(canonical) as LegacyRow;
      const actual = await reader.readSessionCash(database, {
        id: row.sessionId, estado: "CERRADA", fondoInicial: row.fund,
        efectivoContado: row.counted,
      }, { efectivoEsperado: row.expected, diferencia: row.difference });
      // Compare money as SQL canonical strings too, not pg vs Drizzle Date objects.
      // Baseline values remain per surface; never run legacy through E2 arithmetic.
      const projected = await client.query<{ canonical: string }>(`
        SELECT jsonb_build_object('sessionId',$1::int,'surface',$2::text,
          'expected',$3::numeric(24,2)::text,'difference',$4::numeric(24,2)::text,
          'hasDifference',$4::numeric IS NOT NULL AND $4::numeric <> 0)::text canonical`,
      [row.sessionId, row.surface, actual.efectivoEsperado, actual.diferencia]);
      const actualCanonical = projected.rows[0]!.canonical;
      readerRows.push(actualCanonical);
      const values = JSON.parse(actualCanonical) as Pick<LegacyRow, "expected" | "difference" | "hasDifference">;
      for (const field of ["expected", "difference", "hasDifference"] as const) {
        if (values[field] !== row[field]) mismatches.push({ sessionId: row.sessionId, surface: row.surface, field });
      }
    }
    const applicationReader: ReaderEvidence = {
      status: mismatches.length ? "MISMATCH" : canonicalRows.length ? "MATCH" : "NO_CLOSED_ROWS",
      module: READER_PATH, sourceHashes: reader.sourceHashes, sameTransaction: true,
      checkedRows: canonicalRows.length, canonicalRows: readerRows,
      sha256: sha(JSON.stringify(readerRows)), mismatches,
    };
    const tables: Record<string, Fingerprint> = {};
    for (const table of TABLES) {
      // Table identifiers are a closed source-code whitelist. Canonical SQL text
      // never passes through Date/numeric client parsers. Only digests leave here.
      const hash = createHash("sha256");
      let count = 0n;
      await client.query(`DECLARE e2_rows NO SCROLL CURSOR FOR
        SELECT to_jsonb(t)::text AS canonical FROM public."${table}" t
        ORDER BY to_jsonb(t)::text COLLATE "C"`);
      for (;;) {
        const batch = await client.query<{ canonical: string }>("FETCH FORWARD 500 FROM e2_rows");
        if (!batch.rows.length) break;
        for (const row of batch.rows) {
          hash.update(JSON.stringify(row.canonical) + "\n");
          count++;
        }
      }
      await client.query("CLOSE e2_rows");
      tables[table] = { count: count.toString(), sha256: hash.digest("hex") };
    }
    await client.query("ROLLBACK");
    return {
      format: FORMAT,
      provenance: { ...revision(), scriptSha256: sha(await readFile(fileURLToPath(import.meta.url), "utf8")), legacySqlSha256: sha(LEGACY_SQL) },
      identity: sha(identity.rows[0]!.canonical),
      transaction: transaction.rows[0]!.canonical,
      legacy: { canonicalRows, sha256: sha(JSON.stringify(canonicalRows)), count: canonicalRows.length },
      tables,
      applicationReader,
    };
  } finally {
    // On failure, disconnect aborts the read-only transaction as well.
    await client.end().catch(() => undefined);
  }
}

async function loadSnapshot(path: string): Promise<Snapshot> {
  const snapshot = JSON.parse(await readFile(await reportPath(path), "utf8")) as Snapshot;
  if (snapshot.format !== FORMAT || !snapshot.legacy || !snapshot.tables ||
    snapshot.legacy.sha256 !== sha(JSON.stringify(snapshot.legacy.canonicalRows)) ||
    snapshot.legacy.count !== snapshot.legacy.canonicalRows.length ||
    !snapshot.applicationReader ||
    snapshot.applicationReader.sha256 !== sha(JSON.stringify(snapshot.applicationReader.canonicalRows)) ||
    snapshot.applicationReader.checkedRows !== snapshot.legacy.count ||
    TABLES.some(table => !snapshot.tables[table])) fail("Snapshot incompleto o inconsistente.");
  return snapshot;
}

async function main() {
  const [mode, ...args] = process.argv.slice(2);
  if (mode === "capture" && args.length === 2 && args[0] === ACK) {
    const output = await reportPath(args[1]!, true);
    // Exclusive write; never overwrite baseline. Capture is the only DB mode.
    const result = await capture();
    await writeFile(output, JSON.stringify(result, null, 2) + "\n", { flag: "wx", mode: 0o600 });
    console.log(`Snapshot capturado; lector real en misma transacción: ${result.applicationReader.status}.`);
    process.exitCode = result.applicationReader.status === "MATCH" ? 0 : result.applicationReader.status === "MISMATCH" ? 1 : 2;
    return;
  }
  if (mode === "compare" && args.length === 3) {
    const [before, after] = await Promise.all([loadSnapshot(args[0]!), loadSnapshot(args[1]!)]);
    if (before.identity !== after.identity) fail("Identidad DB distinta; comparación detenida.");
    if (before.provenance.legacySqlSha256 !== after.provenance.legacySqlSha256 ||
      before.provenance.scriptSha256 !== after.provenance.scriptSha256) fail("Verificador distinto; comparación detenida.");
    const changedTables = TABLES.filter(table =>
      before.tables[table].count !== after.tables[table].count ||
      before.tables[table].sha256 !== after.tables[table].sha256);
    const sameLegacy = before.legacy.sha256 === after.legacy.sha256;
    const sameReader = before.applicationReader.sha256 === after.applicationReader.sha256;
    const readersMatchLegacy = before.applicationReader.status === "MATCH" &&
      after.applicationReader.status === "MATCH";
    const verified = sameLegacy && sameReader && !changedTables.length && readersMatchLegacy;
    const report = {
      format: "e2-historical-comparison-v1",
      beforeRevision: before.provenance, afterRevision: after.provenance,
      sameDatabaseIdentity: true, sameLegacy, changedTables,
      storagePreserved: sameLegacy && !changedTables.length,
      sameReader, readersMatchLegacy,
      acceptance: verified ? "HISTORICAL_ROWS_PRESERVED" : "NOT_VERIFIED",
      scope: "Closed-session expected/difference/predicate via actual readSessionCash; not UI, route filtering, pagination, admin totals, or full E2 acceptance.",
      beforeReader: before.applicationReader, afterReader: after.applicationReader,
    };
    await writeFile(await reportPath(args[2]!, true), JSON.stringify(report, null, 2) + "\n", { flag: "wx", mode: 0o600 });
    console.log(`Comparación offline guardada: ${report.acceptance}. No es aceptación integral E2.`);
    process.exitCode = verified ? 0 : 1;
    return;
  }
  console.log("Sin conexión. Uso tras revisión explícita:\n" +
    `capture ${ACK} reports/<snapshot>.json\n` +
    "compare reports/<antes>.json reports/<despues>.json reports/<comparacion>.json\n" +
    "compare es offline; capture código 2 significa que no hay filas cerradas.");
}

// Suppress raw pg/OS errors, which can contain connection addresses or secrets.
main().catch(() => {
  console.error("E2: operación detenida; no se imprime el error de conexión ni datos sensibles. Revisar protocolo y precondiciones.");
  process.exitCode = 1;
});