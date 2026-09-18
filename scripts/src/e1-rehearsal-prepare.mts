/**
 * Preparation library; no connection, DDL or DML on import.
 * ONLY the already retained clone is accepted. No operational DB permission.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

export const TARGET = Object.freeze({
  host: "/tmp/prompt-h-block2-20260917165108-3655-3655",
  port: 5432,
  database: "restore_disposable_20260917165108-3655",
  user: "postgres",
  directory: "/home/runner/workspace/.local/backups/prompt-h-block2-20260917165108-3655/restore-cluster",
  oid: "16384",
  start: "2026-09-17 22:55:26.435568+00",
});
export const APPROVED_SQL = "reports/e1-ensayo-2026-09-17/operativo-propuesto/01.sql";
export const APPROVED_SHA = "680f8f4d339d20775dabeb540c43d4945391652f1eabd6e0162f3a1ca48ce57f";
export const BACKUP = ".local/backups/prompt-h-block2-20260917165108-3655/prompt-h-block2-20260917165108-3655.dump";
export const BACKUP_SHA = "583ac96297ca40573aa96249e2b25de68812f98bd7b675214473932fe81f2925";
export const sha256 = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
export const IDENTITY_SQL = `SELECT current_database() AS database, current_user AS role,
  (SELECT oid::text FROM pg_database WHERE datname=current_database()) AS oid,
  current_setting('data_directory') AS directory,
  current_setting('unix_socket_directories') AS socket,
  current_setting('listen_addresses') AS listen,
  current_setting('port') AS port,
  current_setting('server_version') AS version,
  pg_postmaster_start_time()::text AS start,
  inet_server_addr()::text AS address, inet_server_port() AS server_port,
  current_setting('session_replication_role') AS replication_role`;

export async function assertClone(client: { query: (...args: any[]) => Promise<any> }) {
  const { rows: [r] } = await client.query(IDENTITY_SQL);
  assert.equal(r.database, TARGET.database, "REFUSED: unexpected database");
  assert.notEqual(r.database, "heliumdb", "REFUSED: operational database");
  assert.equal(r.role, TARGET.user);
  assert.equal(r.oid, TARGET.oid);
  assert.equal(r.directory, TARGET.directory);
  assert.equal(r.socket, TARGET.host);
  assert.equal(r.port, String(TARGET.port));
  assert.equal(r.listen, "");
  assert.equal(r.address, null);
  assert.equal(r.server_port, null);
  assert.equal(r.version, "16.10");
  assert.equal(r.start, TARGET.start, "Clone restarted: review/rebind identity before retrying");
  assert.equal(r.replication_role, "origin");
  return r;
}

const ORIGINAL_IDENTITY = `  IF (SELECT oid::bigint FROM pg_database WHERE datname = current_database()) <> 16384
    OR pg_postmaster_start_time() <> TIMESTAMPTZ '2026-09-17 21:43:07.917935+00'
    OR current_user::text <> 'postgres'
    OR current_setting('server_version') <> '16.10'
    OR inet_server_addr() IS NOT NULL OR inet_server_port() IS NOT NULL THEN
    RAISE EXCEPTION 'E1: instancia/rol distintos de la identidad confirmada; detener y reconfirmar';
  END IF;
  IF current_database() <> 'heliumdb' THEN
    RAISE EXCEPTION 'Destino incorrecto: se requiere heliumdb; recibido %', current_database();
  END IF;`;

export const CLONE_IDENTITY = `  IF current_database() <> '${TARGET.database}'
    OR (SELECT oid::bigint FROM pg_database WHERE datname = current_database()) <> ${TARGET.oid}
    OR pg_postmaster_start_time() <> TIMESTAMPTZ '${TARGET.start}'
    OR current_user::text <> '${TARGET.user}'
    OR current_setting('server_version') <> '16.10'
    OR current_setting('data_directory') <> '${TARGET.directory}'
    OR current_setting('unix_socket_directories') <> '${TARGET.host}'
    OR current_setting('listen_addresses') <> ''
    OR current_setting('port') <> '${TARGET.port}'
    OR inet_server_addr() IS NOT NULL OR inet_server_port() IS NOT NULL THEN
    RAISE EXCEPTION 'E1 rehearsal: expected retained disposable clone only; refused';
  END IF;`;

export async function loadCloneSql(root: string) {
  const original = await readFile(resolve(root, APPROVED_SQL), "utf8");
  assert.equal(sha256(original), APPROVED_SHA, "Approved E1 SQL changed");
  assert.equal(original.split(ORIGINAL_IDENTITY).length, 2, "Identity replacement must be unique");
  const adapted = original.replace(ORIGINAL_IDENTITY, CLONE_IDENTITY);
  assert.equal(adapted.slice(adapted.indexOf("-- S08:")), original.slice(original.indexOf("-- S08:")),
    "S08 through COMMIT must be byte-identical");
  return { original, adapted, originalSha: APPROVED_SHA, adaptedSha: sha256(adapted) };
}

/** Count every suffix object, not just the main table: partial E1 is a refusal. */
export async function inspectE1(client: { query: (...args: any[]) => Promise<any> }) {
  const { rows: [r] } = await client.query(`SELECT
    to_regclass('public.operaciones_credito_e1')::text AS operations,
    (SELECT count(*)::int FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND right(c.relname,3)='_e1') AS relations,
    (SELECT count(*)::int FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname='public' AND right(p.proname,3)='_e1') AS functions,
    (SELECT count(*)::int FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace
      WHERE n.nspname='public' AND right(t.typname,3)='_e1') AS types,
    (SELECT count(*)::int FROM pg_attribute
      WHERE attrelid='public.movimientos_credito'::regclass AND NOT attisdropped
      AND attname=ANY(ARRAY['sitio_origen_id','sesion_caja_id','naturaleza','operacion_productor',
        'operacion_clave','nota_origen_id','origen_justificacion'])) AS columns`);
  return r;
}

export async function prepareE1(client: any, root: string) {
  await assertClone(client);
  const inspection = await inspectE1(client);
  // Read-only preparation observed E1 absent. Never silently accept a later or
  // partially prepared clone; doing so would detach execution from the review.
  assert.deepEqual(inspection, { operations: null, relations: 0, functions: 0, types: 0, columns: 0 },
    "E1 already present/partial: refusing duplicate DDL; new review required");
  const sql = await loadCloneSql(root);
  // Single pg query includes approved BEGIN/COMMIT; any error aborts the run.
  let watchdogFired = false;
  const watchdog = setTimeout(() => {
    watchdogFired = true;
    // Disconnect, rather than query-cancel followed by an accidental COMMIT.
    // A response lost after COMMIT remains ambiguous and requires inspection.
    void client.end().catch(() => undefined);
  }, 30_000);
  try {
    await client.query(sql.adapted);
    assert.equal(watchdogFired, false, "DDL watchdog fired; inspect commit outcome before retry");
  } catch (error) {
    if (!watchdogFired) await client.query("ROLLBACK");
    throw error;
  } finally { clearTimeout(watchdog); }
  await assertClone(client);
  const after = await inspectE1(client);
  assert.equal(after.operations, "operaciones_credito_e1");
  assert.equal(after.columns, 7);
  return { status: "PASS", before: inspection, after, adaptedSha: sql.adaptedSha };
}