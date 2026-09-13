/**
 * Disposable Phase 2/UI rehearsal companion.
 *
 * `prepare` uses only the fixed restored database from restore-metadata.json.
 * It verifies the committed Phase 2 evidence and the List C hashes before
 * adding exactly one synthetic ADMIN and one session.  The password, session
 * id, and cookie are written only to a mode-0600 private manifest.
 *
 * `ticketprobe` requires a separate, operator-supplied PASS browser evidence
 * file for the empty UI state, then commits one real metered ticket through
 * the actual POS helper at folio 1000 and writes a hashable private proof.
 *
 * `serve` dynamically imports app.ts (not api-server/src/index.ts), verifies
 * current_database() through the exact pool the imported API uses, and then
 * listens on a private internal port.  No schema initializer, seed, poller,
 * backfill, or workflow process is started here.
 */

import { createHash, randomBytes, randomUUID } from "node:crypto";
import { createServer, type Server } from "node:http";
import {
  chmod,
  mkdir,
  readFile,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

type Row = Record<string, unknown>;
type QueryResult = { rows: Row[] };
type Client = {
  query(text: string, values?: unknown[]): Promise<QueryResult>;
  release(): void;
};
type Pool = {
  connect(): Promise<Client>;
  query(text: string, values?: unknown[]): Promise<QueryResult>;
  end(): Promise<void>;
};

const scriptPath = fileURLToPath(import.meta.url);
const repositoryRoot = resolve(dirname(scriptPath), "../..");
const backupDirectory = resolve(
  repositoryRoot,
  "scripts/.local/backups/respaldo-antes-de-purga-2026-09-13-101833",
);
const metadataPath = resolve(backupDirectory, "restore-metadata.json");
const phase2StatePath = resolve(repositoryRoot, ".local/phase2-purge-state.json");
const privateDirectory = resolve(repositoryRoot, ".local/phase2-ui-rehearsal");
const fixtureManifestPath = resolve(privateDirectory, "fixture-manifest.json");
const apiStatePath = resolve(privateDirectory, "api-state.json");
const apiPidPath = resolve(privateDirectory, "api.pid");
const postPurgeProofPath = resolve(
  privateDirectory,
  "phase2-disposable-postpurge-proof.json",
);
const fixedPostgresPort = 44337;
const defaultApiPort = 43110;

const listC = [
  "productos",
  "precio_historial",
  "clientes",
  "cliente_documentos",
  "proveedores",
  "usuarios",
  "ubicaciones",
  "pisos",
  "permisos_rol",
  "permisos_usuario",
  "permisos_ubicacion",
  "camionetas",
  "choferes",
  "equipos",
  "equipos_checklist",
  "stock_minimo_sitios",
  "stock_minimos",
  "auditoria",
] as const;

type Metadata = {
  cluster_directory: string;
  socket_directory: string;
  port: number;
  database: string;
  admin_database: string;
  admin_url: string;
  restored_database_url: string;
  postgres_binary_directory: string;
};

type Snapshot = {
  count: number;
  hash: string;
};

type CSnapshot = Record<string, Snapshot>;
type DatabaseModule = {
  db: {
    transaction<T>(callback: (tx: unknown) => Promise<T>): Promise<T>;
  };
  pool: Pool;
};
type DrizzleRuntime = {
  sql: {
    raw(text: string): unknown;
  };
};

function fail(message: string): never {
  throw new Error(message);
}

function jsonText(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

async function writePrivateJson(path: string, value: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  await chmod(dirname(path), 0o700);
  const temporaryPath = `${path}.tmp-${process.pid}`;
  await writeFile(temporaryPath, jsonText(value), {
    encoding: "utf8",
    mode: 0o600,
  });
  await chmod(temporaryPath, 0o600);
  await rename(temporaryPath, path);
  await chmod(path, 0o600);
}

async function readJson(path: string): Promise<any> {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch {
    fail(`private rehearsal file is unavailable: ${relative(repositoryRoot, path)}`);
  }
}

async function sha256File(path: string): Promise<string> {
  return createHash("sha256").update(await readFile(path)).digest("hex");
}

function privateEvidencePath(rawPath: string, label: string): string {
  const path = resolve(repositoryRoot, rawPath);
  const privateRoot = `${resolve(repositoryRoot, ".local")}/`;
  if (!path.startsWith(privateRoot)) {
    fail(`${label} must be inside .local`);
  }
  return path;
}

function stableValue(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "bigint") return value.toString();
  if (Buffer.isBuffer(value)) return value.toString("hex");
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Row)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, stableValue(item)]),
    );
  }
  return value;
}

function stableJson(value: unknown): string {
  return JSON.stringify(stableValue(value));
}

function rowHash(rows: Row[]): string {
  const canonical = rows
    .map((row) => stableJson(row))
    .sort((left, right) => left.localeCompare(right))
    .join("\n");
  return createHash("sha256").update(canonical).digest("hex");
}

function quoteIdentifier(identifier: string): string {
  return `"${identifier.replaceAll('"', '""')}"`;
}

function quoteLiteral(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

function requireExplicitEnvironment(): {
  testUrl: string;
  applicationUrl: string;
} {
  if (process.env.DATABASE_URL) {
    fail("disposable UI helper refuses a DATABASE_URL target");
  }
  if (process.env.NODE_ENV !== "test") {
    fail("disposable UI helper requires NODE_ENV=test");
  }
  if (process.env.REQUIRE_ISOLATED_TEST_DATABASE !== "1") {
    fail("disposable UI helper requires REQUIRE_ISOLATED_TEST_DATABASE=1");
  }
  const testUrl = process.env.TEST_DATABASE_URL;
  const applicationUrl = process.env.APPLICATION_DATABASE_URL;
  if (!testUrl || !applicationUrl) {
    fail("disposable UI helper requires explicit TEST_DATABASE_URL and APPLICATION_DATABASE_URL");
  }
  if (testUrl === applicationUrl) {
    fail("disposable UI helper refuses equal test/application URLs");
  }
  return { testUrl, applicationUrl };
}

function parseLocalUrl(
  value: string,
  expectedDatabase: string,
  label: string,
): URL {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    fail(`${label} is not a PostgreSQL URL`);
  }
  if (!["postgres:", "postgresql:"].includes(parsed.protocol)) {
    fail(`${label} is not a PostgreSQL URL`);
  }
  if (parsed.hostname !== "127.0.0.1" || parsed.port !== String(fixedPostgresPort)) {
    fail(`${label} must target the reviewed local PostgreSQL socket/port`);
  }
  if (parsed.username !== "runner") {
    fail(`${label} must use the reviewed local PostgreSQL runner role`);
  }
  if (decodeURIComponent(parsed.pathname.replace(/^\/+/, "")) !== expectedDatabase) {
    fail(`${label} database name does not match restore metadata`);
  }
  return parsed;
}

async function loadMetadata(): Promise<Metadata> {
  const metadata = (await readJson(metadataPath)) as Partial<Metadata>;
  if (
    typeof metadata.cluster_directory !== "string" ||
    typeof metadata.socket_directory !== "string" ||
    typeof metadata.database !== "string" ||
    typeof metadata.admin_database !== "string" ||
    typeof metadata.admin_url !== "string" ||
    typeof metadata.restored_database_url !== "string" ||
    typeof metadata.postgres_binary_directory !== "string" ||
    Number(metadata.port) !== fixedPostgresPort
  ) {
    fail("restore metadata is incomplete or does not describe port 44337");
  }
  if (metadata.database === metadata.admin_database) {
    fail("restore metadata admin and restored database names must differ");
  }
  const expectedCluster = resolve(
    backupDirectory,
    "restore-cluster-verified",
  );
  if (resolve(metadata.cluster_directory) !== expectedCluster) {
    fail("restore metadata cluster directory is not the reviewed disposable cluster");
  }
  if (
    !metadata.socket_directory.startsWith(
      "/tmp/respaldo-purge-2026-09-13-101833-",
    )
  ) {
    fail("restore metadata socket directory is not the reviewed private socket");
  }
  if (
    metadata.postgres_binary_directory !==
    "/nix/store/bgwr5i8jf8jpg75rr53rz3fqv5k8yrwp-postgresql-16.10"
  ) {
    fail("restore metadata PostgreSQL binary directory is not reviewed PostgreSQL 16.10");
  }
  parseLocalUrl(metadata.restored_database_url, metadata.database, "restored_database_url");
  parseLocalUrl(metadata.admin_url, metadata.admin_database, "admin_url");
  return metadata as Metadata;
}

async function loadPgPool(connectionString: string): Promise<Pool> {
  // @ts-expect-error pg runtime is intentionally loaded from the workspace package.
  const module = await import("../../lib/db/node_modules/pg/lib/index.js");
  const runtime = (module.default ?? module) as {
    Pool: new (options: Record<string, unknown>) => Pool;
  };
  return new runtime.Pool({
    connectionString,
    max: 2,
    application_name: "phase2_ui_disposable_harness",
    statement_timeout: 120_000,
    query_timeout: 120_000,
  });
}

async function verifyIdentity(
  pool: Pool,
  metadata: Metadata,
  label: string,
): Promise<Row> {
  const result = await pool.query(`
    SELECT current_database() AS database_name,
           current_user AS current_user,
           inet_server_port() AS server_port,
           split_part(current_setting('server_version'), '.', 1) AS server_major
  `);
  const identity = result.rows[0] ?? {};
  if (
    String(identity.database_name) !== metadata.database ||
    Number(identity.server_port) !== fixedPostgresPort ||
    String(identity.server_major) !== "16"
  ) {
    fail(`${label} current_database/server identity check failed`);
  }
  return identity;
}

async function captureC(poolOrClient: Pool | Client): Promise<CSnapshot> {
  const snapshot: CSnapshot = {};
  for (const table of listC) {
    const result = await poolOrClient.query(
      `SELECT row_to_json(t)::text AS snapshot_row FROM public.${quoteIdentifier(table)} t`,
    );
    snapshot[table] = {
      count: result.rows.length,
      hash: rowHash(result.rows),
    };
  }
  return snapshot;
}

async function countTable(
  poolOrClient: Pool | Client,
  table: string,
): Promise<number> {
  const result = await poolOrClient.query(
    `SELECT count(*)::int AS count FROM public.${quoteIdentifier(table)}`,
  );
  return Number(result.rows[0]?.count ?? -1);
}

async function captureBeforeFixtureDiagnosis(pool: Pool): Promise<Row> {
  const result = await pool.query(`
    SELECT
      (SELECT count(*)::int FROM public.usuarios WHERE activo = true) AS "activeUsers",
      (SELECT count(*)::int FROM public.ubicaciones WHERE activa = true AND tipo = 'TIENDA') AS "tiendas",
      (SELECT count(*)::int FROM public.clientes WHERE activo = true) AS "clientes",
      (SELECT count(*)::int FROM public.productos WHERE activo = true) AS "activeProducts",
      (SELECT count(*)::int FROM public.productos
        WHERE activo = true AND se_vende_por_metro = true) AS "meteredFlagTrue",
      (SELECT count(*)::int FROM public.productos
        WHERE activo = true
          AND se_vende_por_metro = true
          AND unidad = 'METRO'
          AND precio_sugerido IS NOT NULL
          AND precio_menudeo IS NOT NULL) AS "eligibleMeteredProducts"
  `);
  const diagnosis = result.rows[0] ?? {};
  return {
    activeUsers: Number(diagnosis.activeUsers),
    tiendas: Number(diagnosis.tiendas),
    clientes: Number(diagnosis.clientes),
    activeProducts: Number(diagnosis.activeProducts),
    meteredFlagTrue: Number(diagnosis.meteredFlagTrue),
    eligibleMeteredProducts: Number(diagnosis.eligibleMeteredProducts),
  };
}

function assertSnapshotEqual(
  expected: CSnapshot,
  actual: CSnapshot,
  label: string,
): void {
  for (const table of listC) {
    const expectedRow = expected[table];
    const actualRow = actual[table];
    if (
      !expectedRow ||
      !actualRow ||
      expectedRow.count !== actualRow.count ||
      expectedRow.hash !== actualRow.hash
    ) {
      fail(`${label} Lista C snapshot differs at ${table}`);
    }
  }
}

function phase2EvidencePath(state: Row): string {
  if (state.status !== "PASS" || typeof state.evidencePath !== "string") {
    fail("Phase 2 state is not PASS or has no private evidence path");
  }
  const path = resolve(repositoryRoot, state.evidencePath);
  const localPrefix = `${resolve(repositoryRoot, ".local")}/`;
  if (!path.startsWith(localPrefix)) {
    fail("Phase 2 evidence path is outside the private workspace evidence directory");
  }
  return path;
}

async function loadCommittedPhase2Proof(): Promise<{
  evidencePath: string;
  evidence: Row;
  baseline: CSnapshot;
}> {
  const state = await readJson(phase2StatePath);
  const evidencePath = phase2EvidencePath(state);
  const evidence = await readJson(evidencePath);
  if (evidence.status !== "PASS" || evidence.mode !== "rehearse") {
    fail("Phase 2 private evidence is not a PASS rehearsal");
  }
  const transaction = String(evidence.execution?.transaction ?? "");
  if (!transaction.includes("committed")) {
    fail(
      "Phase 2 rehearsal evidence is not a committed purge; prepare is blocked until the reviewed --rehearse change lands",
    );
  }
  const afterA = evidence.execution?.afterA;
  if (
    !afterA ||
    Object.values(afterA as Record<string, unknown>).some(
      (count) => Number(count) !== 0,
    )
  ) {
    fail("Phase 2 evidence does not prove an empty operational List A");
  }
  const before = evidence.preflight?.listCBefore as CSnapshot | undefined;
  const after = evidence.execution?.afterC as CSnapshot | undefined;
  if (!before || !after) {
    fail("Phase 2 evidence has no List C baseline proof");
  }
  assertSnapshotEqual(before, after, "Phase 2 preflight/execution");
  return { evidencePath, evidence, baseline: after };
}

function parseFixturePort(): number {
  const raw = process.env.PHASE2_API_PORT;
  if (raw === undefined || raw === "") return defaultApiPort;
  if (!/^\d+$/.test(raw)) fail("PHASE2_API_PORT must be an integer");
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < 1024 || value > 65535) {
    fail("PHASE2_API_PORT is outside the user-port range");
  }
  if (value === fixedPostgresPort) fail("API port must differ from PostgreSQL port");
  return value;
}

function safeError(error: unknown): string {
  return (error instanceof Error ? error.message : String(error))
    .replaceAll(/postgres(?:ql)?:\/\/[^\s"']+/gi, "[database-url-redacted]")
    .replaceAll(/password[^\s,;]*/gi, "password-redacted")
    .replaceAll(repositoryRoot, "[workspace]");
}

async function prepare(): Promise<void> {
  const { testUrl, applicationUrl } = requireExplicitEnvironment();
  const metadata = await loadMetadata();
  if (testUrl !== metadata.restored_database_url) {
    fail("TEST_DATABASE_URL must exactly equal restored_database_url from metadata");
  }
  if (applicationUrl !== metadata.admin_url) {
    fail("APPLICATION_DATABASE_URL must exactly equal admin_url from metadata");
  }
  try {
    await readFile(fixtureManifestPath, "utf8");
    fail("a private fixture already exists; restore the disposable cluster before preparing again");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  const proof = await loadCommittedPhase2Proof();
  const transaction = String(
    (proof.evidence.execution as Row | undefined)?.transaction ?? "",
  );
  const pool = await loadPgPool(testUrl);
  try {
    const identity = await verifyIdentity(pool, metadata, "prepare");
    const databaseBeforeFixtures = await captureC(pool);
    assertSnapshotEqual(proof.baseline, databaseBeforeFixtures, "restored C baseline");
    const beforeFixtureDiagnosis = await captureBeforeFixtureDiagnosis(pool);
    const sessionsBefore = await countTable(pool, "sesiones");

    const actorToken = randomUUID().replaceAll("-", "");
    const username = `phase2_ui_admin_${actorToken}`.toLowerCase();
    const password = randomBytes(24).toString("base64url");
    const sessionId = randomUUID();
    const client = await pool.connect();
    let manifestWritten = false;
    try {
      await client.query("BEGIN");
      const userResult = await client.query(
        `
          INSERT INTO public.usuarios
            (nombre, usuario, password_hash, rol, ubicacion_id, activo, alcance_consulta)
          VALUES
            ($1, $2, crypt($3, gen_salt('bf', 8)), 'ADMIN', NULL, TRUE, 'TODAS')
          RETURNING id
        `,
        ["Phase 2 UI rehearsal ADMIN", username, password],
      );
      const userId = Number(userResult.rows[0]?.id);
      if (!Number.isInteger(userId) || userId <= 0) {
        fail("synthetic ADMIN insert returned no valid id");
      }
      await client.query(
        `
          INSERT INTO public.sesiones
            (id, usuario_id, expira_at, ip, user_agent)
          VALUES
            ($1::uuid, $2, now() + interval '8 hours', '127.0.0.1', $3)
        `,
        [sessionId, userId, "phase2-ui-disposable-harness"],
      );
      const databaseWithFixtures = await captureC(client);
      const sessionsAfter = await countTable(client, "sesiones");
      const changedTables = listC.filter((table) => {
        const before = databaseBeforeFixtures[table];
        const after = databaseWithFixtures[table];
        return before.count !== after.count || before.hash !== after.hash;
      });
      if (changedTables.length !== 1 || !changedTables.includes("usuarios")) {
        fail("synthetic preparation changed a List C table other than usuarios");
      }
      if (
        databaseWithFixtures.usuarios.count !== databaseBeforeFixtures.usuarios.count + 1 ||
        sessionsAfter !== sessionsBefore + 1
      ) {
        fail("synthetic preparation did not add exactly one ADMIN and one session");
      }
      const now = new Date();
      const pendingManifest = {
        status: "PENDING_COMMIT",
        createdAtUtc: now.toISOString(),
        operation: "disposable Phase 2 UI rehearsal",
        database: {
          name: metadata.database,
          port: fixedPostgresPort,
          serverIdentityVerified: identity,
        },
        phase2: {
          evidencePath: relative(repositoryRoot, proof.evidencePath),
          transaction,
          restoredCListBaseline: proof.baseline,
          beforeFixtureDiagnosis,
        },
        fixtureDelta: {
          changedTables: [...changedTables].sort(),
          baseline: databaseBeforeFixtures,
          afterFixture: databaseWithFixtures,
          operational: {
            sesiones: {
              before: sessionsBefore,
              after: sessionsAfter,
            },
          },
        },
        actor: {
          id: userId,
          usuario: username,
          rol: "ADMIN",
          password,
          synthetic: true,
        },
        session: {
          id: sessionId,
          cookie: `mariana_session=${sessionId}`,
          synthetic: true,
        },
      };
      await writePrivateJson(fixtureManifestPath, pendingManifest);
      manifestWritten = true;
      await client.query("COMMIT");
      await writePrivateJson(fixtureManifestPath, {
        ...pendingManifest,
        status: "READY",
        committedAtUtc: new Date().toISOString(),
      });
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      if (manifestWritten) await rm(fixtureManifestPath, { force: true }).catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
    console.log(
      "PASS: private synthetic fixture manifest written at .local/phase2-ui-rehearsal/fixture-manifest.json",
    );
  } finally {
    await pool.end();
  }
}

async function loadEmptyUiEvidence(rawPath: string): Promise<Row> {
  const evidencePath = privateEvidencePath(rawPath, "empty UI evidence");
  const evidence = await readJson(evidencePath);
  const serialized = JSON.stringify(evidence);
  if (/password|cookie|secret|token|postgres(?:ql)?:\/\//i.test(serialized)) {
    fail("empty UI evidence must not contain credentials, cookies, tokens, or database URLs");
  }
  if (
    evidence.status !== "PASS" ||
    evidence.operation !== "phase2-disposable-empty-ui-checks" ||
    typeof evidence.route !== "string" ||
    !evidence.route.startsWith("/login") ||
    !Array.isArray(evidence.checks) ||
    evidence.checks.length === 0 ||
    evidence.checks.some((check: unknown) => typeof check !== "string" || check.trim() === "")
  ) {
    fail(
      "empty UI evidence must be PASS phase2-disposable-empty-ui-checks with a login route and checks",
    );
  }
  return {
    status: "PASS",
    operation: evidence.operation,
    route: evidence.route,
    checks: evidence.checks.map((check: string) => check.trim()),
    evidencePath: relative(repositoryRoot, evidencePath),
    evidenceSha256: await sha256File(evidencePath),
  };
}

async function ticketProbe(): Promise<void> {
  const { testUrl, applicationUrl } = requireExplicitEnvironment();
  const metadata = await loadMetadata();
  if (testUrl !== metadata.restored_database_url || applicationUrl !== metadata.admin_url) {
    fail("ticket probe requires the exact metadata restored/admin URLs");
  }
  const emptyUiPath =
    process.env.PHASE2_EMPTY_UI_EVIDENCE_PATH ?? process.argv[3] ?? "";
  if (!emptyUiPath) {
    fail(
      "ticket probe requires PHASE2_EMPTY_UI_EVIDENCE_PATH or a browser evidence path argument",
    );
  }
  const emptyUi = await loadEmptyUiEvidence(emptyUiPath);
  try {
    await readFile(postPurgeProofPath, "utf8");
    fail("a post-purge proof already exists; restore the disposable cluster before probing again");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  const manifest = await readJson(fixtureManifestPath);
  if (
    manifest.status !== "READY" ||
    manifest.actor?.rol !== "ADMIN" ||
    !Number.isInteger(Number(manifest.actor?.id))
  ) {
    fail("ticket probe requires the READY synthetic ADMIN fixture");
  }

  const pool = await loadPgPool(testUrl);
  let applicationPool: { end(): Promise<void> } | undefined;
  try {
    const identity = await verifyIdentity(pool, metadata, "ticket probe");
    // This is deliberately captured before the disposable product insert.  It
    // records the known empty eligible-product diagnosis without changing the
    // verified C baseline or touching any development database.
    const existingCatalogDiagnosisBeforeTicket =
      await captureBeforeFixtureDiagnosis(pool);
    if (process.env.DATABASE_URL) {
      fail("ticket probe refuses a DATABASE_URL before importing application helpers");
    }

    // The probe uses the real ticket helper, but deliberately does not import
    // api-server/src/index.ts or start any application process.
    const dbModule = (await import("../../lib/db/src/index.ts")) as unknown as DatabaseModule;
    applicationPool = dbModule.pool;
    const sqlRuntime = (await import(
      "../../artifacts/api-server/node_modules/drizzle-orm/index.js"
    )) as unknown as DrizzleRuntime;
    const { crearTicket } = (await import(
      "../../artifacts/api-server/src/lib/pos.ts"
    )) as unknown as {
      crearTicket(
        tx: unknown,
        input: Row,
        includeCosts: boolean,
      ): Promise<Row>;
    };
    const txRows = async (tx: unknown, text: string): Promise<Row[]> => {
      const executor = tx as {
        execute(query: unknown): Promise<{ rows: Row[] }>;
      };
      return (await executor.execute(sqlRuntime.sql.raw(text))).rows;
    };
    const userId = Number(manifest.actor.id);
    const uuid = randomUUID();
    const productToken = randomUUID().replaceAll("-", "").slice(0, 20);
    const productSku = `PHASE2-DISPOSABLE-${productToken}`;
    const productTela = `Phase 2 disposable ${productToken}`;
    const productColor = "UI";
    const probeResult = await dbModule.db.transaction(async (tx) => {
      const ticketsBefore = Number(
        (await txRows(tx, "SELECT count(*)::int AS count FROM public.tickets"))[0]?.count ?? -1,
      );
      if (ticketsBefore !== 0) {
        fail("empty UI ticket probe is blocked because tickets already exist");
      }
      const folioBefore = Number(
        (
          await txRows(
            tx,
            "SELECT ultimo_folio FROM public.ticket_folio WHERE id = 1 FOR UPDATE",
          )
        )[0]?.ultimo_folio ?? -1,
      );
      if (folioBefore !== 999) {
        fail(`empty UI ticket probe requires ticket_folio 999 before creation (got ${folioBefore})`);
      }
      const [user] = await txRows(
        tx,
        `SELECT id FROM public.usuarios WHERE id = ${userId} AND activo = true AND rol = 'ADMIN'`,
      );
      const [site] = await txRows(
        tx,
        "SELECT id FROM public.ubicaciones WHERE activa = true AND tipo = 'TIENDA' ORDER BY id LIMIT 1",
      );
      const [client] = await txRows(
        tx,
        "SELECT id FROM public.clientes WHERE activo = true ORDER BY id LIMIT 1",
      );
      if (!user || !site || !client) {
        fail("ticket probe requires the synthetic ADMIN, active store, and active client");
      }
      // The verified catalog has no eligible metered product.  This row is a
      // disposable C fixture created only in the restored target, after the
      // browser's empty-UI checks and after the diagnosis above.
      const [product] = await txRows(
        tx,
        `
          INSERT INTO public.productos
            (sku, tela, color, unidad, precio_sugerido, precio_mayoreo,
             precio_menudeo, activo, se_vende_por_metro, notas)
          VALUES
            (${quoteLiteral(productSku)}, ${quoteLiteral(productTela)},
             ${quoteLiteral(productColor)}, 'METRO', 10.00, 10.00, 10.00,
             TRUE, TRUE, 'DISPOSABLE PHASE2 UI TICKET PROBE')
          RETURNING id, sku, unidad, precio_sugerido, precio_mayoreo,
                    precio_menudeo, activo, se_vende_por_metro
        `,
      );
      if (!product) {
        fail("synthetic disposable metered product insert returned no row");
      }
      const created = await crearTicket(
        tx,
        {
          ubicacionId: Number(site.id),
          usuarioTerminalId: userId,
          clienteId: Number(client.id),
          documentoTipo: "TICKET",
          tipo: "METREADO",
          facturado: false,
          uuidCliente: uuid,
          ip: "127.0.0.1",
          lineas: [
            {
              productoId: Number(product.id),
              tipo: "METREADO",
              cantidad: "1.000",
              precioUnitario: String(product.precio_menudeo),
            },
          ],
        },
        false,
      );
      const [stored] = await txRows(
        tx,
        `SELECT id, folio FROM public.tickets WHERE uuid_cliente = '${uuid}'::uuid`,
      );
      const folio = Number(created.folio ?? stored?.folio);
      if (folio !== 1000 || Number(stored?.folio) !== 1000) {
        fail(`ticket probe created an unexpected folio ${String(folio)}`);
      }
      return {
        ticket: {
          folio,
          created: true,
          documentoTipo: "TICKET",
          tipo: "METREADO",
        },
        syntheticProduct: product,
      };
    });
    const ticket = probeResult.ticket;
    const proof = {
      status: "PASS",
      operation: "phase2-disposable-postpurge-probe",
      targetDatabase: metadata.database,
      database: {
        port: fixedPostgresPort,
        serverIdentityVerified: identity,
      },
      existingCatalogDiagnosisBeforeTicket,
      beforeFixtureDiagnosis: manifest.phase2?.beforeFixtureDiagnosis ?? null,
      emptyUi,
      ticket,
      syntheticProduct: probeResult.syntheticProduct,
      createdAtUtc: new Date().toISOString(),
    };
    await writePrivateJson(postPurgeProofPath, proof);
    console.log(
      `PASS: post-purge UI/ticket proof at .local/phase2-ui-rehearsal/phase2-disposable-postpurge-proof.json (sha256 ${await sha256File(postPurgeProofPath)})`,
    );
  } finally {
    if (applicationPool) await applicationPool.end().catch(() => undefined);
    await pool.end();
  }
}

async function serve(): Promise<void> {
  const { testUrl, applicationUrl } = requireExplicitEnvironment();
  const metadata = await loadMetadata();
  if (testUrl !== metadata.restored_database_url || applicationUrl !== metadata.admin_url) {
    fail("serve requires the exact metadata restored/admin URLs");
  }
  const manifest = await readJson(fixtureManifestPath);
  if (manifest.status !== "READY" || manifest.actor?.rol !== "ADMIN" || manifest.session?.id === undefined) {
    fail("private synthetic fixture manifest is not READY");
  }
  if (String(manifest.database?.name) !== metadata.database || Number(manifest.database?.port) !== fixedPostgresPort) {
    fail("private fixture database identity does not match restore metadata");
  }

  // Do not import the API until all environment and metadata guards pass.
  if (process.env.DATABASE_URL) {
    fail("serve refuses a DATABASE_URL before importing the actual API");
  }
  // app.ts imports routes and middleware only; index.ts is intentionally not
  // imported because it runs startup schema initializers/background workers.
  const { default: app } = await import(
    "../../artifacts/api-server/src/app.ts"
  );
  const dbModule = (await import("../../lib/db/src/index.ts")) as unknown as {
    pool: Pool;
  };
  const identity = await verifyIdentity(dbModule.pool, metadata, "API runtime");
  const port = parseFixturePort();
  const server = createServer(app);
  await new Promise<void>((resolvePromise, reject) => {
    const onError = (error: Error) => {
      server.off("listening", onListening);
      reject(error);
    };
    const onListening = () => {
      server.off("error", onError);
      resolvePromise();
    };
    server.once("error", onError);
    server.once("listening", onListening);
    server.listen(port, "127.0.0.1");
  });

  const address = server.address();
  if (!address || typeof address === "string" || address.port !== port) {
    server.close();
    await dbModule.pool.end();
    fail("API harness did not bind the requested internal port");
  }
  await writePrivateJson(apiPidPath, { pid: process.pid });
  await writePrivateJson(apiStatePath, {
    status: "READY",
    pid: process.pid,
    apiPort: port,
    apiOrigin: `http://127.0.0.1:${port}`,
    database: metadata.database,
    postgresPort: fixedPostgresPort,
    identity,
    importedEntrypoint: "artifacts/api-server/src/app.ts",
    skippedEntrypoint: "artifacts/api-server/src/index.ts",
    frontendRoutes: {
      login: "/login?returnTo=/",
      home: "/",
      health: "/api/healthz",
    },
  });

  let shuttingDown = false;
  const shutdown = async (exitCode: number): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;
    await new Promise<void>((resolvePromise) => {
      server.close(() => resolvePromise());
    }).catch(() => undefined);
    await dbModule.pool.end().catch(() => undefined);
    await rm(apiPidPath, { force: true }).catch(() => undefined);
    await rm(apiStatePath, { force: true }).catch(() => undefined);
    process.exitCode = exitCode;
  };
  process.once("SIGINT", () => void shutdown(0));
  process.once("SIGTERM", () => void shutdown(0));
  console.log(
    `READY: actual API on internal port ${port}; UI route /login?returnTo=/; credentials remain private`,
  );
  await new Promise<void>((resolvePromise) => {
    server.once("close", resolvePromise);
  });
}

async function main(): Promise<void> {
  const mode = process.argv[2];
  if (mode === "prepare") {
    await prepare();
    return;
  }
  if (mode === "ticketprobe") {
    await ticketProbe();
    return;
  }
  if (mode === "serve") {
    await serve();
    return;
  }
  fail(
    "usage: disposable-phase2-ui-harness.mts prepare|serve|ticketprobe <empty-ui-evidence.json>",
  );
}

try {
  await main();
} catch (error) {
  console.error(`FAIL disposable Phase 2/UI harness: ${safeError(error)}`);
  process.exitCode = 1;
}