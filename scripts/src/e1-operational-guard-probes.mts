/**
 * PREPARATION ONLY: inert import, no connection creation, CLI, application
 * bootstrap, clone helpers, DDL, grant changes or persistent fixture writes.
 * The separately authorized operator supplies the already identity-pinned pool.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import type { Pool, PoolClient } from "pg";

export type OperationalGuardResult = {
  name: string;
  status: "PASS" | "FAIL" | "ERROR";
  boundary: "DATABASE_CLOSED_GATE" | "DATABASE_TRIGGER" | "PRESERVATION";
  classification: string;
  details?: Record<string, unknown>;
};
export type OperationalGuardContext = {
  pool: Pool;
  record: (result: OperationalGuardResult) => void | Promise<void>;
  /** Must throw unless this SAME client matches the parent's pinned operational identity. */
  assertIdentity: (client: PoolClient) => unknown | Promise<unknown>;
};

export const OPERATIONAL_GUARD_CHECK_COUNT = 15;
export const OPERATIONAL_GUARD_IDS = Object.freeze({
  customer: 1874100001,
  movement: 1874100010,
  original: 1874100011,
  session: 1874100301,
  operation: "e118e100-0000-4000-8000-000000000001",
  originalOperation: "e118e100-0000-4000-8000-000000000002",
  attribution: "e118e100-0000-4000-8000-000000000003",
});
const ID = OPERATIONAL_GUARD_IDS;
const REASON = "E1 post-install rollback-only SQL verification; no real receipt or correction";
const GATES = {
  cash: {
    table: "movimientos_credito", trigger: "zz_e1_cash_capture_closed",
    fn: "e1_guard_cash_capture_closed", type: 5, code: "E1C01",
    message: "E1: la captura física de efectivo de crédito está deshabilitada.",
  },
  pending: {
    table: "cobros_credito_pendientes_e1", trigger: "zz_e1_pending_receipts_closed",
    fn: "e1_guard_pending_receipts_closed", type: 4, code: "E1P01",
    message: "E1: el cobro retenido de crédito está deshabilitado.",
  },
  attribution: {
    table: "atribuciones_credito_e1", trigger: "zz_e1_historical_attribution_closed",
    fn: "e1_guard_historical_attribution_closed", type: 4, code: "E1A01",
    message: "E1: la atribución histórica de crédito está deshabilitada.",
  },
} as const;
const PERMANENT = [
  ["movimientos_credito", "movimientos_validos_e1", 5],
  ["cobros_credito_pendientes_e1", "cobros_validos_e1", 5],
  ["atribuciones_credito_e1", "atribuciones_validas_e1", 7],
  ["operaciones_credito_e1", "operaciones_inmutables_e1", 58],
  ["cobros_credito_pendientes_e1", "cobros_inmutables_e1", 58],
  ["atribuciones_credito_e1", "atribuciones_inmutables_e1", 58],
  ["movimientos_credito", "movimientos_credito_inmutables", 27],
  ["movimientos_credito", "movimientos_credito_reversos_validos", 7],
  ["ticket_pagos", "ticket_pagos_inmutables", 27],
  ["aplicaciones_credito", "aplicaciones_credito_inmutables", 27],
  ["aplicaciones_credito", "aplicaciones_credito_validas", 7],
] as const;
const FINANCIAL_TABLES = [
  "movimientos_credito", "operaciones_credito_e1", "cobros_credito_pendientes_e1",
  "atribuciones_credito_e1", "aplicaciones_credito", "ticket_pagos", "tickets",
  "ticket_lineas", "clientes", "sesiones_caja", "sesiones_caja_dias", "salidas_dinero_caja",
] as const;
const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
class ClosedGateMismatch extends Error {
  constructor(readonly evidence: {
    expectedSqlState: string; observedSqlState: string | null;
    exactMessageMatched: boolean; unexpectedlyAccepted: boolean;
  }) {
    super("Closed gate did not produce the exact required SQLSTATE and message");
    this.name = "ClosedGateMismatch";
  }
}
function safeError(error: unknown) {
  const e = error as { name?: unknown; code?: unknown; constraint?: unknown };
  return {
    name: typeof e?.name === "string" ? e.name : "Error",
    code: typeof e?.code === "string" ? e.code : null,
    constraint: typeof e?.constraint === "string" ? e.constraint : null,
    ...(error instanceof ClosedGateMismatch ? { gateEvidence: error.evidence } : {}),
  };
}
type Historical = { id: number; created_at: string; snapshot: string; digest: string; anterior_id: string | null };
async function historicalRows(client: PoolClient): Promise<Historical[]> {
  // Keep timestamp AND JSON numeric identity as SQL text, never JS Date/number.
  const result = await client.query<Historical>(`SELECT m.id,m.created_at::text AS created_at,
    jsonb_build_object('cliente_id',m.cliente_id,'tipo',m.tipo::text,
      'importe',m.importe,'ticket_id',m.ticket_id,
      'movimiento_origen_id',m.movimiento_origen_id)::text AS snapshot,
    md5(to_jsonb(m)::text) AS digest,
    (SELECT a.id::text FROM public.atribuciones_credito_e1 a
      WHERE a.movimiento_id=m.id AND a.movimiento_created_at=m.created_at
        AND a.identidad_snapshot=jsonb_build_object('cliente_id',m.cliente_id,
          'tipo',m.tipo::text,'importe',m.importe,'ticket_id',m.ticket_id,
          'movimiento_origen_id',m.movimiento_origen_id)
        AND NOT EXISTS (SELECT 1 FROM public.atribuciones_credito_e1 s WHERE s.anterior_id=a.id)
      ORDER BY a.created_at DESC,a.id DESC LIMIT 1) AS anterior_id
    FROM public.movimientos_credito m WHERE m.sitio_origen_id IS NULL ORDER BY m.id`);
  assert.equal(result.rows.length, 3, "Expected exactly the three actual unattributed historical movements");
  return result.rows;
}
async function snapshot(client: PoolClient) {
  const financial: Record<string, unknown> = {};
  for (const table of FINANCIAL_TABLES) {
    // Identifiers are a closed source-code whitelist, never caller input.
    const rows = await client.query(`SELECT count(*)::text AS count,
      md5(COALESCE(string_agg(digest,',' ORDER BY digest),'')) AS digest
      FROM (SELECT md5(to_jsonb(t)::text) AS digest FROM public."${table}" t) s`);
    financial[table] = rows.rows[0];
  }
  const totals = await client.query(`SELECT cliente_id,count(*)::text AS count,
    sum(importe)::text AS saldo FROM public.movimientos_credito GROUP BY cliente_id ORDER BY cliente_id`);
  const definitions = await client.query(`SELECT c.relname AS table_name,t.tgname,t.tgenabled,
    t.tgtype,p.proname,pg_get_triggerdef(t.oid) AS trigger_definition,
    pg_get_functiondef(t.tgfoid) AS function_definition
    FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
    JOIN pg_namespace n ON n.oid=c.relnamespace JOIN pg_proc p ON p.oid=t.tgfoid
    WHERE n.nspname='public' AND NOT t.tgisinternal ORDER BY c.relname,t.tgname`);
  for (const [table, name, type] of PERMANENT) {
    const matches = definitions.rows.filter((r) => r.table_name === table && r.tgname === name);
    assert.equal(matches.length, 1, `Missing or duplicate permanent trigger: ${name}`);
    assert.ok(["O", "A"].includes(matches[0].tgenabled), `Disabled permanent trigger: ${name}`);
    assert.equal(Number(matches[0].tgtype), type, `Incorrect permanent trigger type: ${name}`);
  }
  for (const gate of Object.values(GATES)) {
    const matches = definitions.rows.filter((r) => r.table_name === gate.table && r.tgname === gate.trigger);
    assert.equal(matches.length, 1, `Missing or duplicate installed gate: ${gate.trigger}`);
    assert.ok(["O", "A"].includes(matches[0].tgenabled), `Disabled gate: ${gate.trigger}`);
    assert.equal(Number(matches[0].tgtype), gate.type);
    assert.equal(matches[0].proname, gate.fn);
  }
  const context = await client.query(`SELECT pg_get_functiondef(p.oid) AS definition
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname='validar_contexto_credito_e1' ORDER BY p.oid`);
  assert.equal(context.rows.length, 1, "Exactly one permanent E1 context validator required");
  const historical = await historicalRows(client);
  return { financial, totals: totals.rows, definitions: definitions.rows, context: context.rows, historical };
}
type Snapshot = Awaited<ReturnType<typeof snapshot>>;
type Fixture = { actor: number; site: number; session: number | null };
async function fixtures(client: PoolClient, cash: boolean): Promise<Fixture> {
  const collision = await client.query(`SELECT
    EXISTS(SELECT 1 FROM public.clientes WHERE id=$1) OR
    EXISTS(SELECT 1 FROM public.movimientos_credito WHERE id=ANY($2::int[])) OR
    EXISTS(SELECT 1 FROM public.sesiones_caja WHERE id=$3) OR
    EXISTS(SELECT 1 FROM public.operaciones_credito_e1 WHERE clave=ANY($4::uuid[])) OR
    EXISTS(SELECT 1 FROM public.cobros_credito_pendientes_e1 WHERE operacion_clave=ANY($4::uuid[])) OR
    EXISTS(SELECT 1 FROM public.atribuciones_credito_e1 WHERE id=$5::uuid) AS collision`,
  [ID.customer, [ID.movement, ID.original], ID.session, [ID.operation, ID.originalOperation], ID.attribution]);
  assert.equal(collision.rows[0].collision, false, "Reserved explicit fixture identifier collision");
  const selected = await client.query(`SELECT u.id AS actor,l.id AS site,
    (SELECT s.id FROM public.sesiones_caja s WHERE s.ubicacion_id=l.id
      AND s.estado='ABIERTA' AND s.cerrada_at IS NULL ORDER BY s.id LIMIT 1) AS session
    FROM public.usuarios u JOIN public.ubicaciones l
      ON l.activa AND l.tipo='TIENDA' AND (u.rol='ADMIN' OR u.ubicacion_id=l.id)
    WHERE u.activo AND u.rol IN ('ADMIN','SUPERVISOR')
      AND (NOT $1::boolean OR
        EXISTS(SELECT 1 FROM public.sesiones_caja s WHERE s.ubicacion_id=l.id
          AND s.estado='ABIERTA' AND s.cerrada_at IS NULL) OR
        (NOT EXISTS(SELECT 1 FROM public.sesiones_caja s WHERE s.ubicacion_id=l.id AND s.estado='ABIERTA')
         AND NOT EXISTS(SELECT 1 FROM public.sesiones_caja_dias d WHERE d.ubicacion_id=l.id
           AND d.fecha_operativa=(transaction_timestamp() AT TIME ZONE 'America/Mexico_City')::date)))
    ORDER BY (u.rol='ADMIN') DESC,u.id,l.id LIMIT 1 FOR SHARE OF u,l`, [cash]);
  assert.equal(selected.rows.length, 1, "No existing active privileged actor and compatible active store/session context");
  const fixture = selected.rows[0] as Fixture;
  if (cash && fixture.session === null) {
    const inserted = await client.query(`INSERT INTO public.sesiones_caja
      (id,ubicacion_id,usuario_id,abierta_at,fecha_operativa,fondo_inicial,estado)
      VALUES ($1,$2,$3,transaction_timestamp(),
        (transaction_timestamp() AT TIME ZONE 'America/Mexico_City')::date,0,'ABIERTA')`,
    [ID.session, fixture.site, fixture.actor]);
    assert.equal(inserted.rowCount, 1);
    fixture.session = ID.session;
  }
  const customer = await client.query(`INSERT INTO public.clientes(id,nombre,activo,es_sistema)
    VALUES ($1,$2,true,false)`, [ID.customer, REASON]);
  assert.equal(customer.rowCount, 1);
  return fixture;
}
type Variant = {
  producer: string; nature: string; type: string; amount: string;
  medium: string; account: string | null; original?: "VENTA_CREDITO" | "ABONO"; badDebt?: boolean;
};
const VARIANTS: readonly Variant[] = [
  { producer: "VENTA_CREDITO", nature: "OPERACION_CREDITO_SIN_DINERO", type: "VENTA_CREDITO", amount: "1.00", medium: "CREDITO", account: null },
  { producer: "CANCELACION_VENTA_CREDITO", nature: "OPERACION_CREDITO_SIN_DINERO", type: "REVERSO", amount: "-1.00", medium: "CREDITO", account: null, original: "VENTA_CREDITO" },
  { producer: "ABONO_ORDINARIO", nature: "INGRESO_FISICO", type: "ABONO", amount: "-1.00", medium: "TRANSFERENCIA", account: "CUENTA_FISCAL" },
  { producer: "ABONO_DIRIGIDO", nature: "INGRESO_FISICO", type: "ABONO", amount: "-1.00", medium: "TRANSFERENCIA", account: "CUENTA_NO_FISCAL" },
  { producer: "REVERSO_ABONO", nature: "CORRECCION_CONTABLE", type: "REVERSO", amount: "1.00", medium: "TRANSFERENCIA", account: "CUENTA_FISCAL", original: "ABONO" },
  { producer: "AJUSTE_MANUAL", nature: "CORRECCION_CONTABLE", type: "AJUSTE", amount: "1.00", medium: "EFECTIVO", account: "CAJA_FISICA" },
  { producer: "BAJA_INCOBRABLE", nature: "CORRECCION_CONTABLE", type: "AJUSTE", amount: "-1.00", medium: "TRANSFERENCIA", account: "CUENTA_FISCAL", badDebt: true },
];
async function operation(client: PoolClient, f: Fixture, v: Pick<Variant, "producer" | "nature">, key: string) {
  const inserted = await client.query(`INSERT INTO public.operaciones_credito_e1
    (productor,clave,naturaleza,usuario_id,solicitud_canonica)
    VALUES ($1,$2::uuid,$3::public.naturaleza_credito_e1,$4,$5::jsonb)`,
  [v.producer, key, v.nature, f.actor, JSON.stringify({ purpose: REASON, clienteId: ID.customer })]);
  assert.equal(inserted.rowCount, 1);
}
const MOVEMENT_SQL = `INSERT INTO public.movimientos_credito
  (id,cliente_id,tipo,importe,usuario_id,forma_pago,cuenta_destino,
   sitio_origen_id,sesion_caja_id,naturaleza,operacion_productor,operacion_clave,
   origen_justificacion,movimiento_origen_id,es_incobrable,motivo_incobrable)
  VALUES ($1,$2,$3::public.tipo_movimiento_credito,$4,$5,$6::public.forma_pago_cuenta,$7,
    $8,$9,$10::public.naturaleza_credito_e1,$11,$12::uuid,$13,$14,$15,$16) RETURNING id`;
function movementValues(f: Fixture, v: Variant, options: { id?: number; key?: string; original?: number | null; cash?: boolean } = {}) {
  return [options.id ?? ID.movement, ID.customer, v.type, v.amount, f.actor, v.medium, v.account,
    f.site, options.cash ? f.session : null, v.nature, v.producer, options.key ?? ID.operation,
    REASON, options.original ?? null, v.badDebt === true, v.badDebt ? REASON : null];
}
async function verifyMovement(client: PoolClient, values: unknown[]) {
  const saved = await client.query(`SELECT id,cliente_id,tipo::text,importe::text,usuario_id,
    forma_pago::text,cuenta_destino,sitio_origen_id,sesion_caja_id,naturaleza::text,
    operacion_productor,operacion_clave::text,origen_justificacion,movimiento_origen_id,
    es_incobrable,motivo_incobrable FROM public.movimientos_credito WHERE id=$1`, [values[0]]);
  assert.equal(saved.rows.length, 1, "Expected exactly one intended ledger row");
  assert.deepEqual(Object.values(saved.rows[0]), values, "Accepted row must preserve the exact submitted context");
}
async function insertMovement(client: PoolClient, values: unknown[]) {
  const inserted = await client.query(MOVEMENT_SQL, values);
  assert.equal(inserted.rowCount, 1, "Accepted INSERT must not silently suppress the row");
  await verifyMovement(client, values);
}
async function reject(client: PoolClient, key: keyof typeof GATES, sql: string, values: unknown[]) {
  const expected = GATES[key];
  await client.query("SAVEPOINT e1_operational_rejection");
  let matched = false;
  let exactMessageMatched = false;
  let observed: ReturnType<typeof safeError> | null = null;
  try {
    await client.query(sql, values);
  } catch (error) {
    const e = error as { code?: string; message?: string };
    observed = safeError(error);
    exactMessageMatched = e.message === expected.message;
    matched = e.code === expected.code && exactMessageMatched;
  } finally {
    await client.query("ROLLBACK TO SAVEPOINT e1_operational_rejection");
    await client.query("RELEASE SAVEPOINT e1_operational_rejection");
  }
  if (!matched) throw new ClosedGateMismatch({
    expectedSqlState: expected.code, observedSqlState: observed?.code ?? null,
    exactMessageMatched, unexpectedlyAccepted: observed === null,
  });
  return { expectedSqlState: expected.code, exactMessageMatched: true };
}

export async function runOperationalGuardChecks({ pool, record, assertIdentity }: OperationalGuardContext) {
  assert.equal(typeof assertIdentity, "function", "Parent operational identity assertion is mandatory");
  assert.equal(typeof record, "function", "Result collector is mandatory");
  const cases: OperationalGuardResult[] = [];
  let before: Snapshot | undefined;
  async function run(
    name: string, boundary: OperationalGuardResult["boundary"],
    action: (client: PoolClient) => Promise<Record<string, unknown>>,
    readOnly = false,
  ) {
    let client: PoolClient | undefined;
    let result: OperationalGuardResult;
    let rollbackError: unknown;
    try {
      client = await pool.connect();
      await client.query(readOnly ? "BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY" : "BEGIN");
      await client.query("SET LOCAL statement_timeout='15s'");
      await client.query("SET LOCAL lock_timeout='2s'");
      await client.query("SET LOCAL TIME ZONE 'UTC'");
      await assertIdentity(client);
      const identity = await client.query(`SELECT current_database() AS database_name,
        current_setting('session_replication_role') AS replication_role`);
      assert.equal(identity.rows[0].database_name, "heliumdb", "Operational target must be heliumdb");
      assert.equal(identity.rows[0].replication_role, "origin", "Trigger bypass mode prohibited");
      const details = await action(client);
      // Even deferred constraints must succeed before an acceptance is reported.
      if (!readOnly) await client.query("SET CONSTRAINTS ALL IMMEDIATE");
      result = { name, boundary, status: "PASS", classification: "VERIFIED_ROLLBACK_ONLY_SQL", details };
    } catch (error) {
      result = { name, boundary, status: "FAIL", classification: "ASSERTION_OR_UNEXPECTED_ERROR",
        details: { error: safeError(error) } };
    } finally {
      if (client) {
        try { await client.query("ROLLBACK"); }
        catch (error) { rollbackError = error; }
        finally { client.release(rollbackError instanceof Error ? rollbackError : rollbackError ? true : undefined); }
      }
    }
    if (rollbackError) {
      result = { name, boundary, status: "ERROR", classification: "ROLLBACK_FAILED_ABORT_REQUIRED",
        details: { error: safeError(rollbackError), priorResult: result! } };
    }
    cases.push(result!);
    await record(result!);
    if (rollbackError) throw new Error("Operational postcheck rollback failed; client destroyed; no further checks permitted");
  }
  await run("installed_guards_permanent_validators_and_baseline", "PRESERVATION", async (client) => {
    before = await snapshot(client);
    return { snapshotHash: hash(before), historicalIds: before.historical.map((r) => r.id),
      historicalRows: 3, installedGates: 3, namedPermanentTriggers: PERMANENT.length,
      financialSnapshot: before.financial, ledgerTotalsHash: hash(before.totals),
      triggerDefinitionsHash: hash(before.definitions), historicalIdentityHash: hash(before.historical) };
  }, true);
  async function withFixture(client: PoolClient, cash = false) {
    assert.ok(before, "Baseline failed; fixture writes prohibited");
    return fixtures(client, cash);
  }
  await run("physical_cash_incoming_complete_context_rejected", "DATABASE_CLOSED_GATE", async (client) => {
    const f = await withFixture(client, true);
    const v = { ...VARIANTS[2]!, medium: "EFECTIVO", account: "CAJA_FISICA" };
    await operation(client, f, v, ID.operation);
    return reject(client, "cash", MOVEMENT_SQL, movementValues(f, v, { cash: true }));
  });
  await run("physical_cash_refund_complete_context_rejected", "DATABASE_CLOSED_GATE", async (client) => {
    const f = await withFixture(client, true);
    const original = VARIANTS[2]!;
    await operation(client, f, original, ID.originalOperation);
    const originalValues = movementValues(f, original, { id: ID.original, key: ID.originalOperation });
    await insertMovement(client, originalValues);
    const v = { ...VARIANTS[4]!, nature: "DEVOLUCION_FISICA", medium: "EFECTIVO", account: "CAJA_FISICA" };
    await operation(client, f, v, ID.operation);
    const result = await reject(client, "cash", MOVEMENT_SQL, movementValues(f, v, { original: ID.original, cash: true }));
    await verifyMovement(client, originalValues);
    return result;
  });
  await run("pending_receipt_complete_context_rejected", "DATABASE_CLOSED_GATE", async (client) => {
    const f = await withFixture(client);
    await operation(client, f, { producer: "COBRO_PENDIENTE", nature: "INGRESO_FISICO" }, ID.operation);
    return reject(client, "pending", `INSERT INTO public.cobros_credito_pendientes_e1
      (operacion_productor,operacion_clave,naturaleza,cliente_id,importe,fecha_real,
       sitio_origen_id,medio,cuenta_destino,sesion_caja_id,motivo,usuario_id)
      VALUES ('COBRO_PENDIENTE',$1::uuid,'INGRESO_FISICO',$2,1.00,transaction_timestamp(),
        $3,'TRANSFERENCIA','CUENTA_FISCAL',NULL,$4,$5)`,
    [ID.operation, ID.customer, f.site, REASON, f.actor]);
  });
  for (let index = 0; index < 3; index++) {
    await run(`historical_attribution_actual_row_${index + 1}_rejected`, "DATABASE_CLOSED_GATE", async (client) => {
      const f = await withFixture(client);
      const current = await historicalRows(client);
      assert.deepEqual(current, before!.historical, "Actual historical identities changed since baseline");
      const row = current[index]!;
      const result = await reject(client, "attribution", `INSERT INTO public.atribuciones_credito_e1
        (id,movimiento_id,movimiento_created_at,identidad_snapshot,sitio_origen_id,
         evidencia,motivo,usuario_id,anterior_id)
        VALUES ($1::uuid,$2,$3::timestamptz,$4::jsonb,$5,$6,$6,$7,$8::uuid)`,
      [ID.attribution, row.id, row.created_at, row.snapshot, f.site, REASON, f.actor, row.anterior_id]);
      assert.deepEqual(await historicalRows(client), current);
      return { ...result, historicalId: row.id, exactTimestampAndSnapshotUsed: true };
    });
  }
  for (const v of VARIANTS) {
    await run(`permitted_sql_producer_${v.producer}`, "DATABASE_TRIGGER", async (client) => {
      const f = await withFixture(client);
      let originalValues: unknown[] | undefined;
      if (v.original) {
        const original = v.original === "VENTA_CREDITO" ? VARIANTS[0]! : VARIANTS[2]!;
        await operation(client, f, original, ID.originalOperation);
        originalValues = movementValues(f, original, { id: ID.original, key: ID.originalOperation });
        await insertMovement(client, originalValues);
      }
      await operation(client, f, v, ID.operation);
      await insertMovement(client, movementValues(f, v, { original: v.original ? ID.original : null }));
      if (originalValues) await verifyMovement(client, originalValues);
      return { producer: v.producer, nature: v.nature, exactRowVerified: true, noCashSession: true };
    });
  }
  await run("all_rollbacks_preserve_financial_historical_and_trigger_snapshots", "PRESERVATION", async (client) => {
    const after = await snapshot(client);
    assert.ok(before, "No valid baseline available");
    assert.deepEqual(after, before, "Financial rows/totals, historical identities or trigger definitions changed");
    return { beforeHash: hash(before), afterHash: hash(after), historicalRows: 3,
      financialTables: FINANCIAL_TABLES.length, namedPermanentTriggers: PERMANENT.length,
      beforeFinancialSnapshot: before.financial, afterFinancialSnapshot: after.financial,
      beforeTriggerDefinitionsHash: hash(before.definitions), afterTriggerDefinitionsHash: hash(after.definitions),
      beforeHistoricalIdentityHash: hash(before.historical), afterHistoricalIdentityHash: hash(after.historical) };
  }, true);
  assert.equal(cases.length, OPERATIONAL_GUARD_CHECK_COUNT);
  const failed = cases.some((r) => r.status !== "PASS");
  return { status: failed ? "FAIL" as const : "PASS" as const, requiresNonzeroExit: failed,
    expectedCaseCount: OPERATIONAL_GUARD_CHECK_COUNT, cases, preservation: cases[cases.length - 1]! };
}