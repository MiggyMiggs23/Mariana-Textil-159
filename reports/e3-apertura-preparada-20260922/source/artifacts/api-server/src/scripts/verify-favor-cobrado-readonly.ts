/**
 * Read-only PostgreSQL regression for excess customer favor in Cobrado.
 *
 * The scenario is intentionally expressed as VALUES CTEs.  It does not
 * insert users, tickets, credit movements, applications, or schema objects.
 * The real admin-analytics getDestinationAccounts read model is invoked with
 * the application pool routed through one REPEATABLE READ READ ONLY client.
 *
 * Run explicitly with the current application DATABASE_URL:
 *
 *   pnpm --filter @workspace/api-server exec tsx \
 *     src/scripts/verify-favor-cobrado-readonly.ts
 *
 * This proves read-model behavior only.  It does not authorize a document,
 * receive a payment, or exercise the write endpoints/triggers.
 */
import assert from "node:assert/strict";

const WRITE_SQL =
  /\b(?:INSERT|UPDATE|DELETE|MERGE|TRUNCATE|ALTER|CREATE|DROP|GRANT|REVOKE|COMMENT|VACUUM|REFRESH|CALL|DO)\b/i;
const UNEXPECTED_RELATION =
  /\b(?:usuarios|sesiones_caja|clientes|ticket_lineas|productos|movimientos_inventario)\b/i;
const SHADOW_RELATIONS = [
  "tickets",
  "ticket_pagos",
  "movimientos_credito",
  "aplicaciones_credito",
  "ubicaciones",
] as const;

type FixtureStage = "favor-received" | "new-note-applied";
type QueryResult = { rows: Array<Record<string, unknown>> };
type Query = (text: string, values?: unknown[]) => Promise<QueryResult>;

type StageReport = {
  stage: FixtureStage;
  global: {
    vendido: string;
    cobrado: string;
    abonos: string;
    saldosFavor: string;
    reconciliation: string;
  };
  receiptPeriod: {
    cobrado: string;
    abonos: string;
    saldosFavor: string;
    reconciliation: string;
  };
  newNotePeriod: {
    vendido: string;
    porCobrar: string;
    cobrado: string;
  };
  applicationDatePeriod: {
    vendido: string;
    cobrado: string;
  };
};

let observed:
  | {
      database: string;
      queryCount: number;
      stages: StageReport[];
    }
  | undefined;

function fixtureCtes(stage: FixtureStage): string {
  const appliedNewNote = stage === "new-note-applied"
    ? `,
       (302::bigint, 202::bigint, 203::bigint, 50.00::numeric,
        '2026-09-21T12:00:00Z'::timestamptz)`
    : "";

  return `
    tickets (
      id, folio, ubicacion_id, estado, documento_tipo, cobrado, facturado,
      autorizacion_estado, cobrado_at, autorizado_at, cliente_id, subtotal, iva
    ) AS (
      VALUES
        (101::bigint, 9101::int, 7::int, 'VENDIDO'::text, 'NOTA'::text,
         false, false, 'AUTORIZADA'::text, NULL::timestamptz,
         '2026-09-01T12:00:00Z'::timestamptz, 9001::bigint,
         100.00::numeric, 0.00::numeric),
        (102::bigint, 9102::int, 7::int, 'VENDIDO'::text, 'NOTA'::text,
         false, false, 'AUTORIZADA'::text, NULL::timestamptz,
         '2026-09-20T12:00:00Z'::timestamptz, 9001::bigint,
         50.00::numeric, 0.00::numeric)
    ),
    ticket_pagos (
      id, ticket_id, forma_pago, importe, referencia, created_at, usuario_id
    ) AS (
      VALUES
        (401::bigint, 101::bigint, 'CREDITO'::text, 100.00::numeric,
         NULL::text, '2026-09-01T12:00:00Z'::timestamptz, 7001::bigint)
    ),
    movimientos_credito (
      id, cliente_id, ticket_id, movimiento_origen_id, tipo, importe,
      usuario_id, forma_pago, cuenta_destino, created_at
    ) AS (
      VALUES
        (201::bigint, 9001::bigint, 101::bigint, NULL::bigint,
         'VENTA_CREDITO'::text, 100.00::numeric, 7001::bigint,
         'CREDITO'::text, NULL::text,
         '2026-09-01T12:00:00Z'::timestamptz),
        (202::bigint, 9001::bigint, NULL::bigint, NULL::bigint,
         'ABONO'::text, -150.00::numeric, 7001::bigint,
         'TRANSFERENCIA'::text, 'CUENTA_FISCAL'::text,
         '2026-09-10T12:00:00Z'::timestamptz),
        (203::bigint, 9001::bigint, 102::bigint, NULL::bigint,
         'VENTA_CREDITO'::text, 50.00::numeric, 7001::bigint,
         'CREDITO'::text, NULL::text,
         '2026-09-20T12:00:00Z'::timestamptz)
    ),
    aplicaciones_credito (
      id, abono_movimiento_id, venta_movimiento_id, importe, created_at
    ) AS (
      VALUES
        (301::bigint, 202::bigint, 201::bigint, 100.00::numeric,
         '2026-09-10T12:00:00Z'::timestamptz)${appliedNewNote}
    ),
    ubicaciones (id, nombre) AS (
      VALUES (7::int, 'Sitio fixture'::text)
    )
  `;
}

function injectFixtures(sql: string, stage: FixtureStage): string {
  const trimmed = sql.trimStart();
  const ctes = fixtureCtes(stage);
  if (/^WITH\b/i.test(trimmed)) {
    return trimmed.replace(/^WITH\b/i, `WITH ${ctes},`);
  }
  return `WITH ${ctes} ${trimmed}`;
}

function assertReadOnlyApplicationQuery(sql: string): void {
  assert.match(
    sql,
    /^\s*(?:WITH|SELECT)\b/i,
    "admin analytics emitted a non-read query",
  );
  assert.doesNotMatch(
    sql,
    WRITE_SQL,
    "the read-only verifier rejected a write statement",
  );
  assert.doesNotMatch(
    sql,
    UNEXPECTED_RELATION,
    "the fixture scenario unexpectedly touched a user/session or unrelated relation",
  );
}

function money(value: unknown): string {
  const amount = Number(value);
  assert.ok(Number.isFinite(amount), "analytics returned a non-numeric amount");
  return amount.toFixed(2);
}

function addMoney(left: string, right: string): string {
  return (Number(left) + Number(right)).toFixed(2);
}

function sanitizeError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message
    .replace(/postgres(?:ql)?:\/\/\S+/gi, "[redacted-database-url]")
    .replace(/password\s*=\s*\S+/gi, "password=[redacted]")
    .slice(0, 500);
}

function stageReport(stage: FixtureStage, result: any): StageReport {
  const globalCobrado = result.global.encabezado.cobrado;
  const receiptCobrado = result.receipt.encabezado.cobrado;
  const newNote = result.newNote.encabezado;
  const applicationDate = result.applicationDate.encabezado;
  return {
    stage,
    global: {
      vendido: result.global.encabezado.vendido.total,
      cobrado: globalCobrado.total,
      abonos: globalCobrado.abonos,
      saldosFavor: globalCobrado.saldosFavor,
      reconciliation: addMoney(globalCobrado.abonos, globalCobrado.saldosFavor),
    },
    receiptPeriod: {
      cobrado: receiptCobrado.total,
      abonos: receiptCobrado.abonos,
      saldosFavor: receiptCobrado.saldosFavor,
      reconciliation: addMoney(receiptCobrado.abonos, receiptCobrado.saldosFavor),
    },
    newNotePeriod: {
      vendido: newNote.vendido.total,
      porCobrar: newNote.porCobrar.periodo,
      cobrado: newNote.cobrado.total,
    },
    applicationDatePeriod: {
      vendido: applicationDate.vendido.total,
      cobrado: applicationDate.cobrado.total,
    },
  };
}

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required for the read-only verification.");
  }

  // Dynamic imports keep this script outside test-process database guards.
  const [{ pool }, analytics] = await Promise.all([
    import("@workspace/db"),
    import("../lib/admin-analytics"),
  ]);

  const identityClient = await pool.connect();
  const identityResult = await identityClient.query(
    "SELECT current_database()::text AS database",
  );
  const database = String(identityResult.rows[0]?.database ?? "");
  assert.ok(database.length > 0, "the current database identity was empty");
  identityClient.release();

  const client = await pool.connect();
  const originalQuery = pool.query;
  const originalConnect = pool.connect;
  let stage: FixtureStage = "favor-received";
  let queryCount = 0;
  let pendingQueries: Promise<unknown> = Promise.resolve();
  let transactionStarted = false;

  const query: Query = async (text, values = []) => {
    assertReadOnlyApplicationQuery(text);
    const rewritten = injectFixtures(text, stage);
    for (const relation of SHADOW_RELATIONS) {
      assert.match(
        rewritten,
        new RegExp(`\\b${relation}\\s*\\(`),
        `missing VALUES shadow for ${relation}`,
      );
    }
    queryCount += 1;
    const result = pendingQueries.then(() => client.query(rewritten, values));
    pendingQueries = result.then(() => undefined, () => undefined);
    return result;
  };

  const runStage = async (currentStage: FixtureStage): Promise<StageReport> => {
    stage = currentStage;
    const ranges = {
      global: {
        desde: new Date("2026-09-01T00:00:00.000Z"),
        hasta: new Date("2026-09-30T23:59:59.999Z"),
      },
      receipt: {
        desde: new Date("2026-09-10T00:00:00.000Z"),
        hasta: new Date("2026-09-10T23:59:59.999Z"),
      },
      newNote: {
        desde: new Date("2026-09-20T00:00:00.000Z"),
        hasta: new Date("2026-09-20T23:59:59.999Z"),
      },
      applicationDate: {
        desde: new Date("2026-09-21T00:00:00.000Z"),
        hasta: new Date("2026-09-21T23:59:59.999Z"),
      },
    };
    const [global, receipt, newNote, applicationDate] = await Promise.all([
      analytics.getDestinationAccounts(ranges.global, false),
      analytics.getDestinationAccounts(ranges.receipt, false),
      analytics.getDestinationAccounts(ranges.newNote, false),
      analytics.getDestinationAccounts(ranges.applicationDate, false),
    ]);
    return stageReport(currentStage, { global, receipt, newNote, applicationDate });
  };

  pool.query = query as typeof pool.query;
  pool.connect = (async () => ({
    query,
    release: () => undefined,
  })) as typeof pool.connect;

  try {
    await client.query(
      "BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY",
    );
    transactionStarted = true;
    const transactionState = await client.query(
      "SELECT current_setting('transaction_read_only') AS read_only, " +
      "current_setting('transaction_isolation') AS isolation",
    );
    assert.equal(transactionState.rows[0]?.read_only, "on");
    assert.equal(transactionState.rows[0]?.isolation, "repeatable read");

    const before = await runStage("favor-received");
    const after = await runStage("new-note-applied");
    observed = { database, queryCount, stages: [before, after] };

    for (const report of [before, after]) {
      assert.equal(
        report.global.vendido,
        "150.00",
        `${report.stage}: old and new authorized notes must be the only sales`,
      );
      assert.equal(
        report.newNotePeriod.vendido,
        "50.00",
        `${report.stage}: the explicit new note must remain a sale in its note period`,
      );
      assert.equal(
        report.newNotePeriod.porCobrar,
        "50.00",
        `${report.stage}: the new note must remain por cobrar until a collection`,
      );
      assert.equal(
        report.newNotePeriod.cobrado,
        "0.00",
        `${report.stage}: applying old favor must not create collection income in the new-note period`,
      );
      assert.equal(
        report.applicationDatePeriod.vendido,
        "0.00",
        `${report.stage}: an application date must not create a new sale`,
      );
      assert.equal(
        report.applicationDatePeriod.cobrado,
        "0.00",
        `${report.stage}: an application date must not create new collection income`,
      );
      assert.equal(
        report.receiptPeriod.reconciliation,
        report.receiptPeriod.cobrado,
        `${report.stage}: receipt period ABONO + FAVOR must reconcile to Cobrado`,
      );
    }

    assert.equal(before.global.cobrado, "150.00");
    assert.equal(after.global.cobrado, "150.00");
    assert.equal(
      after.global.cobrado,
      before.global.cobrado,
      "applying favor to the new note changed global-period Cobrado",
    );
    assert.equal(before.global.reconciliation, "150.00");
    assert.equal(after.global.reconciliation, "150.00");
    assert.equal(before.receiptPeriod.cobrado, "150.00");
    assert.equal(after.receiptPeriod.cobrado, "150.00");

    await pendingQueries;
    await client.query("ROLLBACK");
    transactionStarted = false;
    console.log(JSON.stringify({
      verification: "favor-cobrado-readonly",
      status: "PASS",
      database,
      queryCount,
      stages: [before, after],
      writes: 0,
      syntheticOnly: true,
      readModelOnly: true,
    }));
  } finally {
    await pendingQueries.catch(() => undefined);
    if (transactionStarted) {
      await client.query("ROLLBACK").catch(() => undefined);
    }
    pool.query = originalQuery;
    pool.connect = originalConnect;
    client.release();
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error(JSON.stringify({
    verification: "favor-cobrado-readonly",
    status: "FAIL",
    error: sanitizeError(error),
    observed: observed ?? null,
    writes: 0,
    syntheticOnly: true,
    readModelOnly: true,
  }));
  process.exitCode = 1;
});