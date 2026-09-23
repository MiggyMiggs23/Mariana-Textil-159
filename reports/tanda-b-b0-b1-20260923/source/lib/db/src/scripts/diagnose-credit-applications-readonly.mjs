/**
 * Tanda C / tarea 4 — diagnóstico LIVE de aplicaciones de crédito.
 *
 * Preparado para MAIN; este archivo no se ejecuta automáticamente.
 *
 *   node lib/db/src/scripts/diagnose-credit-applications-readonly.mjs \
 *     --pid 191 --bundle artifacts/api-server/dist/index.mjs
 *
 * La URL se toma únicamente de /proc/<pid>/environ, no se imprime ni persiste.
 * No importa el singleton de @workspace/db ni código de la aplicación.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, realpath, stat } from "node:fs/promises";
import { isAbsolute, resolve } from "node:path";
import pg from "pg";

const { Client } = pg;
const TARGET_IDS = [51, 52, 53];
const REQUIRED_COLUMNS = {
  movimientos_credito: [
    "id", "cliente_id", "ticket_id", "movimiento_origen_id", "tipo",
    "importe", "usuario_id", "metadata", "sitio_origen_id", "sesion_caja_id", "naturaleza",
    "operacion_productor", "operacion_clave", "origen_justificacion",
  ],
  aplicaciones_credito: [
    "id", "abono_movimiento_id", "venta_movimiento_id", "importe", "created_at",
  ],
};

let stage = "arguments";
let client;
let transactionStarted = false;
let processBefore;
let asOfUtcStart;

function option(name, fallback) {
  const index = process.argv.indexOf(name);
  return index === -1 ? fallback : process.argv[index + 1];
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

async function fileSha(path) {
  return sha256(await readFile(path));
}

async function databaseUrlFromProcess(pid) {
  const bytes = await readFile(`/proc/${pid}/environ`);
  const entry = bytes.toString("utf8").split("\0")
    .find((item) => item.startsWith("DATABASE_URL="));
  assert.ok(entry, "DATABASE_URL is absent from the selected process");
  const value = entry.slice("DATABASE_URL=".length);
  assert.ok(value, "DATABASE_URL is empty in the selected process");
  return value;
}

async function resolveBundle(pid, explicitPath) {
  const cwd = await realpath(`/proc/${pid}/cwd`);
  if (explicitPath) {
    const candidate = isAbsolute(explicitPath)
      ? explicitPath
      : resolve(process.cwd(), explicitPath);
    const info = await stat(candidate);
    assert.ok(info.isFile(), "the explicit bundle is not a regular file");
    return realpath(candidate);
  }
  const args = (await readFile(`/proc/${pid}/cmdline`, "utf8"))
    .split("\0")
    .filter(Boolean);
  for (const arg of args.slice(1).reverse()) {
    if (arg.startsWith("-")) continue;
    const candidate = isAbsolute(arg) ? arg : resolve(cwd, arg);
    try {
      if ((await stat(candidate)).isFile()) return realpath(candidate);
    } catch {
      // Continue: command-line values that are not files are expected.
    }
  }
  throw new Error("no route/bundle file could be resolved; pass --bundle");
}

async function processPin(pid, explicitBundle) {
  const [startStat, executable, cwd, cmdline, bundle] = await Promise.all([
    readFile(`/proc/${pid}/stat`, "utf8"),
    realpath(`/proc/${pid}/exe`),
    realpath(`/proc/${pid}/cwd`),
    readFile(`/proc/${pid}/cmdline`),
    resolveBundle(pid, explicitBundle),
  ]);
  if (explicitBundle) {
    const args = cmdline.toString("utf8").split("\0").filter(Boolean);
    const commandFiles = [];
    for (const arg of args.slice(1)) {
      if (arg.startsWith("-")) continue;
      const candidate = isAbsolute(arg) ? arg : resolve(cwd, arg);
      try {
        if ((await stat(candidate)).isFile()) {
          commandFiles.push(await realpath(candidate));
        }
      } catch {
        // Non-file command arguments are irrelevant to the route pin.
      }
    }
    assert.ok(commandFiles.includes(bundle),
      "the explicit bundle is not a file argument of the selected process");
  }
  // Field 22 is safe after removing the "(comm)" prefix, which may contain spaces.
  const close = startStat.lastIndexOf(")");
  const fieldsAfterComm = startStat.slice(close + 2).trim().split(/\s+/);
  const startTicks = fieldsAfterComm[19];
  return {
    pid,
    startTicks,
    executable,
    executableSha256: await fileSha(executable),
    cwd,
    cmdlineSha256: sha256(cmdline),
    bundle,
    bundleSha256: await fileSha(bundle),
  };
}

function assertSamePin(before, after) {
  assert.deepEqual(after, before, "PID, executable, command line, cwd, or bundle changed");
}

function rows(result) {
  return result.rows;
}

function onlyAggregateRow(result) {
  assert.equal(result.rows.length, 1);
  return result.rows[0];
}

function sanitizedFailure(error) {
  const code = typeof error?.code === "string" && /^[A-Z0-9]{5}$/.test(error.code)
    ? error.code
    : null;
  return {
    diagnostic: "credit-applications-readonly",
    status: "FAIL",
    stage,
    asOfUtc: {
      start: asOfUtcStart ?? null,
      end: new Date().toISOString(),
    },
    error: {
      class: error instanceof assert.AssertionError
        ? "ASSERTION"
        : code ? "POSTGRES" : "RUNTIME",
      code,
      message: "Diagnóstico detenido; detalle sensible omitido.",
    },
    writes: 0,
  };
}

async function main() {
  asOfUtcStart = new Date().toISOString();
  const pidText = option("--pid", "191");
  assert.match(pidText, /^[1-9][0-9]*$/);
  const pid = Number(pidText);
  const explicitBundle = option("--bundle", null);

  stage = "pin-before";
  processBefore = await processPin(pid, explicitBundle);
  const databaseUrl = await databaseUrlFromProcess(pid);

  stage = "connect";
  client = new Client({
    connectionString: databaseUrl,
    application_name: "tanda-c-credit-readonly",
    options: "-c default_transaction_read_only=on -c search_path=pg_catalog -c statement_timeout=30000 -c lock_timeout=3000",
  });
  await client.connect();

  stage = "identity";
  const identity = onlyAggregateRow(await client.query(`
    SELECT pg_catalog.current_database()::text AS database_name,
           (SELECT oid::text FROM pg_catalog.pg_database
            WHERE datname=pg_catalog.current_database()) AS database_oid,
           pg_catalog.current_setting('default_transaction_read_only') AS default_read_only,
           pg_catalog.current_setting('search_path') AS search_path
  `));
  assert.equal(identity.default_read_only, "on");
  assert.equal(identity.search_path, "pg_catalog");

  stage = "transaction";
  await client.query("BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");
  transactionStarted = true;
  const mode = onlyAggregateRow(await client.query(`
    SELECT pg_catalog.current_setting('transaction_read_only') AS transaction_read_only,
           pg_catalog.current_setting('transaction_isolation') AS transaction_isolation,
           pg_catalog.current_setting('default_transaction_read_only') AS default_read_only,
           pg_catalog.current_setting('search_path') AS search_path
  `));
  assert.deepEqual(mode, {
    transaction_read_only: "on",
    transaction_isolation: "repeatable read",
    default_read_only: "on",
    search_path: "pg_catalog",
  });
  const snapshot = onlyAggregateRow(await client.query(`
    SELECT pg_catalog.transaction_timestamp()::text AS snapshot_timestamp,
           pg_catalog.pg_current_snapshot()::text AS snapshot_id
  `));

  stage = "schema";
  const schemaRows = rows(await client.query(`
    SELECT table_name, column_name
    FROM information_schema.columns
    WHERE table_schema='public'
      AND table_name = ANY($1::text[])
    ORDER BY table_name,column_name
  `, [Object.keys(REQUIRED_COLUMNS)]));
  const columns = new Map();
  for (const row of schemaRows) {
    if (!columns.has(row.table_name)) columns.set(row.table_name, new Set());
    columns.get(row.table_name).add(row.column_name);
  }
  for (const [table, required] of Object.entries(REQUIRED_COLUMNS)) {
    for (const column of required) {
      assert.ok(columns.get(table)?.has(column), `required schema column absent: ${table}.${column}`);
    }
  }

  const evidenceSchema = onlyAggregateRow(await client.query(`
    SELECT
      pg_catalog.to_regclass('public.operaciones_credito_e1') IS NOT NULL AS has_e1_operations,
      pg_catalog.to_regclass('public.finalizaciones_abono_e2') IS NOT NULL AS has_e2_finalizations,
      COALESCE((
        SELECT count(DISTINCT column_name) FILTER (WHERE column_name = ANY(ARRAY[
          'productor','clave','naturaleza','usuario_id'
        ])) = 4
        FROM information_schema.columns
        WHERE table_schema='public' AND table_name='operaciones_credito_e1'
      ), false) AS e1_known_columns,
      COALESCE((
        SELECT count(DISTINCT column_name) FILTER (WHERE column_name = ANY(ARRAY[
          'abono_id','resultado','aplicado_centavos','evaluacion','revision_contrato'
        ])) = 5
        FROM information_schema.columns
        WHERE table_schema='public' AND table_name='finalizaciones_abono_e2'
      ), false) AS e2_known_columns
  `));

  stage = "trigger";
  const triggerRows = rows(await client.query(`
    SELECT t.tgname AS trigger_name, t.tgenabled::text AS enabled,
           p.proname AS function_name,
           pg_catalog.pg_get_functiondef(p.oid) AS function_definition
    FROM pg_catalog.pg_trigger t
    JOIN pg_catalog.pg_class c ON c.oid=t.tgrelid
    JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
    JOIN pg_catalog.pg_proc p ON p.oid=t.tgfoid
    WHERE n.nspname='public' AND c.relname='aplicaciones_credito'
      AND NOT t.tgisinternal
    ORDER BY t.tgname
  `));
  const validationTrigger = triggerRows.find((row) =>
    row.function_name === "validate_credit_application" ||
    row.trigger_name === "aplicaciones_credito_validas");
  assert.ok(validationTrigger, "credit application validation trigger absent");
  const triggerSource = validationTrigger.function_definition;
  const triggerEvidence = {
    triggerName: validationTrigger.trigger_name,
    functionName: validationTrigger.function_name,
    enabled: validationTrigger.enabled,
    functionSha256: sha256(triggerSource),
    sumsAllApplicationsForAbono:
      /SUM\s*\(\s*a\.importe\s*\)[\s\S]*a\.abono_movimiento_id\s*=\s*abono\.id/i.test(triggerSource),
    filtersReversedAbono:
      /movimiento_origen_id\s*=\s*a\.abono_movimiento_id/i.test(triggerSource),
    filtersReversedSale:
      /movimiento_origen_id\s*=\s*a\.venta_movimiento_id/i.test(triggerSource),
  };

  stage = "aggregates";
  const applicationImpact = onlyAggregateRow(await client.query(`
    WITH enriched AS (
      SELECT a.id,a.abono_movimiento_id,a.venta_movimiento_id,a.importe,
             EXISTS (
               SELECT 1 FROM public.movimientos_credito r
               WHERE r.tipo='REVERSO' AND r.movimiento_origen_id=a.venta_movimiento_id
             ) AS sale_reversed,
             EXISTS (
               SELECT 1 FROM public.movimientos_credito r
               WHERE r.tipo='REVERSO' AND r.movimiento_origen_id=a.abono_movimiento_id
             ) AS abono_reversed
       FROM public.aplicaciones_credito a
    ), per_abono AS (
      SELECT a.abono_movimiento_id,
             SUM(a.importe) AS stored_total,
             SUM(a.importe) FILTER (WHERE a.sale_reversed) AS stored_on_reversed_sales,
             bool_or(a.sale_reversed) AS has_reversed_sale
      FROM enriched a GROUP BY a.abono_movimiento_id
    )
    SELECT
      (SELECT count(*)::int FROM enriched) AS application_count,
      (SELECT COALESCE(sum(importe),0)::text FROM enriched) AS application_amount,
      (SELECT count(*)::int FROM enriched WHERE sale_reversed) AS reversed_sale_application_count,
      (SELECT COALESCE(sum(importe),0)::text FROM enriched WHERE sale_reversed)
        AS reversed_sale_application_amount,
      (SELECT count(DISTINCT abono_movimiento_id)::int FROM enriched WHERE sale_reversed)
        AS affected_abono_count,
      (SELECT count(DISTINCT venta_movimiento_id)::int FROM enriched WHERE sale_reversed)
        AS reversed_sale_count,
      (SELECT count(*)::int FROM enriched WHERE abono_reversed)
        AS reversed_abono_application_count,
      (SELECT count(*)::int
       FROM per_abono p JOIN public.movimientos_credito m ON m.id=p.abono_movimiento_id
       WHERE NOT EXISTS (
         SELECT 1 FROM public.movimientos_credito r
         WHERE r.tipo='REVERSO' AND r.movimiento_origen_id=m.id
       ) AND p.stored_total > abs(m.importe)) AS active_abonos_over_storage_limit,
      (SELECT COALESCE(array_agg(abono_movimiento_id ORDER BY abono_movimiento_id), '{}')
       FROM per_abono WHERE has_reversed_sale) AS affected_abono_ids
  `));

  const ledger = onlyAggregateRow(await client.query(`
    SELECT
      count(*)::int AS movement_count,
      count(*) FILTER (WHERE tipo='VENTA_CREDITO')::int AS sale_count,
      count(*) FILTER (WHERE tipo='ABONO')::int AS abono_count,
      count(*) FILTER (WHERE tipo='AJUSTE')::int AS adjustment_count,
      count(*) FILTER (WHERE tipo='AJUSTE' AND importe<0)::int AS negative_adjustment_count,
      COALESCE(sum(-importe) FILTER (WHERE tipo='AJUSTE' AND importe<0),0)::text
        AS negative_adjustment_credit_amount,
      count(DISTINCT cliente_id)::int AS customer_id_count,
      count(DISTINCT cliente_id) FILTER (
        WHERE cliente_id IN (
          SELECT cliente_id FROM public.movimientos_credito GROUP BY cliente_id HAVING sum(importe)<0
        )
      )::int AS customers_with_negative_signed_ledger,
      COALESCE((
        SELECT sum(-signed_total)::text FROM (
          SELECT sum(importe) AS signed_total
          FROM public.movimientos_credito GROUP BY cliente_id HAVING sum(importe)<0
        ) balances
      ),'0') AS negative_signed_ledger_amount
    FROM public.movimientos_credito
  `));

  const hasOperationalE1 = evidenceSchema.has_e1_operations &&
    evidenceSchema.e1_known_columns;
  const operationJoin = hasOperationalE1
    ? `EXISTS (
         SELECT 1 FROM public.operaciones_credito_e1 o
         WHERE o.productor=m.operacion_productor
           AND o.clave=m.operacion_clave
           AND o.naturaleza=m.naturaleza
           AND o.usuario_id=m.usuario_id
       )`
    : "false";
  const negativeAdjustments = onlyAggregateRow(await client.query(`
    WITH classified AS (
      SELECT m.id,(-m.importe) AS credit_amount,
        EXISTS (
          SELECT 1 FROM public.movimientos_credito r
          WHERE r.tipo='REVERSO' AND r.movimiento_origen_id=m.id
        ) AS is_reverted,
        (m.sitio_origen_id IS NOT NULL
          AND m.naturaleza IS NOT NULL
          AND m.operacion_productor IS NOT NULL
          AND m.operacion_clave IS NOT NULL) AS has_required_e1_identity_fields,
        (${operationJoin}) AS has_matching_e1_operation,
        (m.operacion_productor IN ('AJUSTE_MANUAL','BAJA_INCOBRABLE')
          AND m.naturaleza='CORRECCION_CONTABLE') AS has_adjustment_compatible_e1_kind,
        (m.sesion_caja_id IS NULL
          AND NULLIF(pg_catalog.btrim(m.origen_justificacion),'') IS NOT NULL)
          AS has_adjustment_e1_context
      FROM public.movimientos_credito m
      WHERE m.tipo='AJUSTE' AND m.importe<0
    ), formal AS (
      SELECT *,
        (has_required_e1_identity_fields
          AND has_matching_e1_operation
          AND has_adjustment_compatible_e1_kind
          AND has_adjustment_e1_context) AS has_formal_e1_evidence
      FROM classified
    )
    SELECT
      count(*)::int AS total_count,
      COALESCE(sum(credit_amount),0)::text AS total_amount,
      count(*) FILTER (WHERE NOT is_reverted)::int AS active_count,
      COALESCE(sum(credit_amount) FILTER (WHERE NOT is_reverted),0)::text AS active_amount,
      count(*) FILTER (WHERE is_reverted)::int AS reverted_count,
      COALESCE(sum(credit_amount) FILTER (WHERE is_reverted),0)::text AS reverted_amount,
      count(*) FILTER (WHERE has_formal_e1_evidence)::int AS formal_e1_count,
      COALESCE(sum(credit_amount) FILTER (WHERE has_formal_e1_evidence),0)::text
        AS formal_e1_amount,
      count(*) FILTER (WHERE NOT has_formal_e1_evidence)::int AS missing_formal_e1_count,
      COALESCE(sum(credit_amount) FILTER (WHERE NOT has_formal_e1_evidence),0)::text
        AS missing_formal_e1_amount,
      count(*) FILTER (WHERE NOT has_required_e1_identity_fields)::int
        AS missing_required_e1_identity_fields_count,
      count(*) FILTER (WHERE has_required_e1_identity_fields AND NOT has_matching_e1_operation)::int
        AS missing_matching_e1_operation_count,
      count(*) FILTER (WHERE NOT has_adjustment_compatible_e1_kind)::int
        AS incompatible_adjustment_e1_kind_count,
      count(*) FILTER (WHERE NOT has_adjustment_e1_context)::int
        AS invalid_adjustment_e1_context_count,
      COALESCE(array_agg(id ORDER BY id), '{}') AS all_ids,
      COALESCE(array_agg(id ORDER BY id) FILTER (WHERE NOT is_reverted), '{}') AS active_ids,
      COALESCE(array_agg(id ORDER BY id) FILTER (WHERE is_reverted), '{}') AS reverted_ids,
      COALESCE(array_agg(id ORDER BY id)
        FILTER (WHERE NOT has_formal_e1_evidence), '{}') AS missing_formal_e1_ids
    FROM formal
  `));

  const targetMovements = rows(await client.query(`
    SELECT m.id,m.tipo,
           (m.metadata IS NOT NULL) AS has_metadata_text,
           (m.sitio_origen_id IS NOT NULL
             AND m.naturaleza IS NOT NULL
             AND m.operacion_productor IS NOT NULL
             AND m.operacion_clave IS NOT NULL) AS has_e1_fields,
           (${operationJoin}) AS has_matching_e1_operation,
           (m.tipo='AJUSTE'
             AND m.operacion_productor IN ('AJUSTE_MANUAL','BAJA_INCOBRABLE')
             AND m.naturaleza='CORRECCION_CONTABLE') AS has_adjustment_compatible_e1_kind,
           (m.tipo='AJUSTE'
             AND m.sesion_caja_id IS NULL
             AND NULLIF(pg_catalog.btrim(m.origen_justificacion),'') IS NOT NULL)
             AS has_adjustment_e1_context,
           ((m.sitio_origen_id IS NOT NULL
             AND m.naturaleza IS NOT NULL
             AND m.operacion_productor IS NOT NULL
             AND m.operacion_clave IS NOT NULL)
             AND (${operationJoin})
             AND m.tipo='AJUSTE'
             AND m.operacion_productor IN ('AJUSTE_MANUAL','BAJA_INCOBRABLE')
             AND m.naturaleza='CORRECCION_CONTABLE'
             AND m.sesion_caja_id IS NULL
             AND NULLIF(pg_catalog.btrim(m.origen_justificacion),'') IS NOT NULL)
             AS has_formal_adjustment_e1_evidence,
           EXISTS (
              SELECT 1 FROM public.aplicaciones_credito a
             WHERE a.abono_movimiento_id=m.id OR a.venta_movimiento_id=m.id
           ) AS has_application_row,
           EXISTS (
              SELECT 1 FROM public.movimientos_credito r
             WHERE r.tipo='REVERSO' AND r.movimiento_origen_id=m.id
           ) AS has_ledger_reversal
    FROM public.movimientos_credito m
    WHERE m.id = ANY($1::int[])
    ORDER BY m.id
  `, [TARGET_IDS]));

  let e2 = {
    available: evidenceSchema.has_e2_finalizations,
    knownColumns: evidenceSchema.e2_known_columns,
    finalizationCount: null,
    finalizedAbonoIds: [],
  };
  if (evidenceSchema.has_e2_finalizations && evidenceSchema.e2_known_columns) {
    const value = onlyAggregateRow(await client.query(`
      SELECT count(*) FILTER (WHERE abono_id=ANY($1::int[]))::int AS finalization_count,
             COALESCE(array_agg(abono_id ORDER BY abono_id)
               FILTER (WHERE abono_id=ANY($1::int[])), '{}') AS finalized_abono_ids
      FROM public.finalizaciones_abono_e2
    `, [TARGET_IDS]));
    e2 = { ...e2, finalizationCount: value.finalization_count, finalizedAbonoIds: value.finalized_abono_ids };
  }

  stage = "rollback";
  await client.query("ROLLBACK");
  transactionStarted = false;

  stage = "pin-after";
  const processAfter = await processPin(pid, explicitBundle);
  assertSamePin(processBefore, processAfter);
  const asOfUtcEnd = new Date().toISOString();

  console.log(JSON.stringify({
    diagnostic: "credit-applications-readonly",
    status: "PASS",
    asOfUtc: {
      start: asOfUtcStart,
      end: asOfUtcEnd,
      snapshotTimestamp: snapshot.snapshot_timestamp,
      snapshotId: snapshot.snapshot_id,
    },
    processPin: processBefore,
    identity: {
      databaseName: identity.database_name,
      databaseOid: identity.database_oid,
    },
    mode,
    schema: {
      checkedTables: Object.keys(REQUIRED_COLUMNS),
      e1OperationsAvailable: evidenceSchema.has_e1_operations,
      e1OperationColumnsKnown: evidenceSchema.e1_known_columns,
      e2FinalizationsAvailable: evidenceSchema.has_e2_finalizations,
    },
    triggerEvidence,
    aggregates: {
      applicationImpact,
      ledger,
      negativeAdjustments,
      targetMovementCount: targetMovements.length,
    },
    technicalIds: {
      requestedMovementIds: TARGET_IDS,
      targetMovements,
      affectedAbonoIds: applicationImpact.affected_abono_ids,
      e2,
      negativeAdjustmentIds: {
        all: negativeAdjustments.all_ids,
        active: negativeAdjustments.active_ids,
        reverted: negativeAdjustments.reverted_ids,
        missingFormalE1: negativeAdjustments.missing_formal_e1_ids,
      },
    },
    interpretationGuards: {
      metadataParsedAsJson: false,
      ticketEstadoUsedForReversal: false,
      reversalEvidence: "movimientos_credito.REVERSO.movimiento_origen_id",
      signedLedgerIsCanonicalFavor: false,
      metadataIsFormalEvidence: false,
      adjustmentCanBeApplicationOrigin: false,
      formalNegativeAdjustmentEvidence:
        "E1 identity fields + matching operaciones_credito_e1 producer/key/nature/actor + AJUSTE-compatible producer/nature + null cash session + nonblank origin justification",
    },
    writes: 0,
    rolledBack: true,
    pinUnchanged: true,
  }));
}

main().catch(async (error) => {
  if (client && transactionStarted) {
    await client.query("ROLLBACK").catch(() => undefined);
  }
  console.error(JSON.stringify(sanitizedFailure(error)));
  process.exitCode = 1;
}).finally(async () => {
  if (client) await client.end().catch(() => undefined);
});