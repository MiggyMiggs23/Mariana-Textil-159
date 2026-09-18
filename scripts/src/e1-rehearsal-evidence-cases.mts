/**
 * PREPARATION ONLY. Inert on import; no CLI/bootstrap/operational connection.
 * The reviewed master must pin the existing disposable clone and install its
 * socket/connection guards BEFORE calling runEvidenceCases.
 *
 * Every case, including all valid raw-SQL gate probes, ends in ROLLBACK.
 * Accepted SQL gate probes are FAIL unless their guard is explicitly removed
 * for that reviewed independent-removal phase.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import type { Pool, PoolClient } from "pg";
import { assertClone } from "./e1-rehearsal-prepare.mts";
import { assertPinnedPool, createRehearsalLoader } from "./e1-rehearsal-loader.mts";

export const EVIDENCE_IDS = Object.freeze({
  customer: 1873000001,
  movement: 1873000010,
  otherSite: 1873000020,
  admin: 1873000101,
  cashier: 1873000102,
  site: 1873000201,
  session: 1873000301,
});
const UUID = "e117e100-0000-4000-8000-000000000001";
const ATTRIBUTION_UUID = "e117e100-0000-4000-8000-000000000002";
const apiRequire = createRequire(new URL("../../artifacts/api-server/package.json", import.meta.url));

export type EvidenceCaseResult = {
  name: string;
  status: "PASS" | "FAIL";
  boundary: "APPLICATION_HELPER" | "DATABASE_TRIGGER" | "DATABASE_CLOSED_GATE" | "PRESERVATION";
  classification: string;
  details?: Record<string, unknown>;
};
export type EvidenceRehearsalContext = {
  pool: Pool;
  record: (result: EvidenceCaseResult) => void | Promise<void>;
  loadModule?: (path: string) => unknown;
  guardTrial?: {
    kind: "probes" | "compatibility";
    phase: string;
    expectedOpenGate?: EvidenceSqlGuardKey | null;
  };
};
type Outcome = Pick<EvidenceCaseResult, "status" | "classification" | "details">;
type ExpectedSqlError = { code: string | string[]; message: RegExp; constraint?: string };

const rejectContract: ExpectedSqlError = {
  code: "P0001", message: /todo INSERT requiere sitio, naturaleza y clave\/productor explícitos/,
};
export const EVIDENCE_SQL_GUARDS = Object.freeze({
  cash: {
    table: "movimientos_credito", trigger: "zz_e1_cash_capture_closed",
    function: "e1_guard_cash_capture_closed", code: "E1C01",
    message: "E1: la captura física de efectivo de crédito está deshabilitada.",
    permanent: "movimientos_validos_e1", permanentTriggerType: 5, triggerType: 5,
  },
  pending: {
    table: "cobros_credito_pendientes_e1", trigger: "zz_e1_pending_receipts_closed",
    function: "e1_guard_pending_receipts_closed", code: "E1P01",
    message: "E1: el cobro retenido de crédito está deshabilitado.",
    permanent: "cobros_validos_e1", permanentTriggerType: 5, triggerType: 4,
  },
  attribution: {
    table: "atribuciones_credito_e1", trigger: "zz_e1_historical_attribution_closed",
    function: "e1_guard_historical_attribution_closed", code: "E1A01",
    message: "E1: la atribución histórica de crédito está deshabilitada.",
    permanent: "atribuciones_validas_e1", permanentTriggerType: 7, triggerType: 4,
  },
});
export type EvidenceSqlGuardKey = keyof typeof EVIDENCE_SQL_GUARDS;
const exactError = (key: EvidenceSqlGuardKey): ExpectedSqlError => ({
  code: EVIDENCE_SQL_GUARDS[key].code,
  message: new RegExp(`^${EVIDENCE_SQL_GUARDS[key].message.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`),
});

function safeError(error: unknown) {
  const e = error as { name?: unknown; code?: unknown; constraint?: unknown };
  // Do not emit SQL parameter dumps, row data, credentials, or pg.detail.
  return {
    name: typeof e?.name === "string" ? e.name : "Error",
    code: typeof e?.code === "string" ? e.code : null,
    constraint: typeof e?.constraint === "string" ? e.constraint : null,
  };
}

async function expectSqlRejection(
  client: PoolClient,
  sql: string,
  values: unknown[],
  expected: ExpectedSqlError,
  closedGate = false,
): Promise<Outcome> {
  await client.query("SAVEPOINT evidence_rejection");
  try {
    const admitted = await client.query(sql, values);
    return {
      status: "FAIL",
      classification: closedGate ? "DATABASE_GATE_GAP" : "EXPECTED_SQL_REJECTION_MISSING",
      details: {
        admittedByUnchangedGuards: true,
        affectedRows: admitted.rowCount,
        expected: "Ordinary SQL statement must be rejected",
        rollbackRequired: true,
        noSchemaAlterationOrTriggerBypass: true,
      },
    };
  } catch (error) {
    const e = error as { code?: string; message?: string; constraint?: string };
    const codes = Array.isArray(expected.code) ? expected.code : [expected.code];
    const exact = codes.includes(e.code ?? "") && expected.message.test(e.message ?? "") &&
      (expected.constraint === undefined || e.constraint === expected.constraint);
    return {
      status: exact ? "PASS" : "FAIL",
      classification: exact ? "EXPECTED_SQL_REJECTION" : "UNEXPECTED_SQL_ERROR",
      details: {
        error: safeError(error),
        expectedSqlState: expected.code,
        semanticErrorMatched: expected.message.test(e.message ?? ""),
        expectedConstraint: expected.constraint ?? null,
      },
    };
  } finally {
    await client.query("ROLLBACK TO SAVEPOINT evidence_rejection");
    await client.query("RELEASE SAVEPOINT evidence_rejection");
  }
}

async function expectHelperRejection(
  action: () => unknown | Promise<unknown>,
  semantic: RegExp,
): Promise<Outcome> {
  try {
    await action();
    return { status: "FAIL", classification: "APPLICATION_GATE_GAP" };
  } catch (error) {
    const e = error as { status?: number; statusCode?: number; message?: string };
    const matches = (e.status ?? e.statusCode) === 403 && semantic.test(e.message ?? "");
    return {
      status: matches ? "PASS" : "FAIL",
      classification: matches ? "EXPECTED_APPLICATION_REJECTION" : "UNEXPECTED_HELPER_ERROR",
      details: { error: safeError(error), expectedStatus: 403, semanticErrorMatched: matches },
    };
  }
}

async function insertOperation(client: PoolClient, productor: string, naturaleza: string, key: string = UUID) {
  await client.query(`INSERT INTO public.operaciones_credito_e1
    (productor,clave,naturaleza,usuario_id,solicitud_canonica)
    VALUES ($1,$2::uuid,$3::naturaleza_credito_e1,$4,$5::jsonb)`, [
    productor, key, naturaleza, EVIDENCE_IDS.admin,
    JSON.stringify({ ensayo: "E1 guard boundaries", clienteId: EVIDENCE_IDS.customer }),
  ]);
}

const MOVEMENT_INSERT = `INSERT INTO public.movimientos_credito
  (id,cliente_id,tipo,importe,usuario_id,forma_pago,cuenta_destino,
   sitio_origen_id,sesion_caja_id,naturaleza,operacion_productor,operacion_clave,origen_justificacion,
   movimiento_origen_id,es_incobrable,motivo_incobrable)
  VALUES ($1,$2,$3::tipo_movimiento_credito,$4,$5,$6::forma_pago_cuenta,$7,
    $8,$9,$10::naturaleza_credito_e1,$11,$12::uuid,$13,$14,$15,$16) RETURNING id`;

function movementValues(overrides: Record<string, unknown> = {}) {
  const row = {
    id: EVIDENCE_IDS.movement, clienteId: EVIDENCE_IDS.customer, tipo: "ABONO",
    importe: "-1.00", usuarioId: EVIDENCE_IDS.admin, formaPago: "TRANSFERENCIA",
    cuentaDestino: "CUENTA_FISCAL", sitioOrigenId: EVIDENCE_IDS.site,
    sesionCajaId: null, naturaleza: "CORRECCION_CONTABLE",
    productor: "ABONO_ORDINARIO", clave: UUID,
    justificacion: "Ensayo aislado sin recepción real ni efecto persistente",
    movimientoOrigenId: null, esIncobrable: false, motivoIncobrable: null,
    ...overrides,
  };
  return [
    row.id, row.clienteId, row.tipo, row.importe, row.usuarioId, row.formaPago,
    row.cuentaDestino, row.sitioOrigenId, row.sesionCajaId, row.naturaleza,
    row.productor, row.clave, row.justificacion,
    row.movimientoOrigenId, row.esIncobrable, row.motivoIncobrable,
  ];
}

const PENDING_INSERT = `INSERT INTO public.cobros_credito_pendientes_e1
  (operacion_productor,operacion_clave,naturaleza,cliente_id,importe,fecha_real,
   sitio_origen_id,medio,cuenta_destino,sesion_caja_id,motivo,usuario_id)
  VALUES ('COBRO_PENDIENTE',$1::uuid,'INGRESO_FISICO',$2,1.00,
    TIMESTAMPTZ '2026-09-17 12:00:00.123456+00',$3,$4::forma_pago_cuenta,$5,$6,
    'Prueba sintética rollback-only; no recepción real',$7)
  RETURNING operacion_clave::text`;

const ATTRIBUTION_INSERT = `INSERT INTO public.atribuciones_credito_e1
  (id,movimiento_id,movimiento_created_at,identidad_snapshot,sitio_origen_id,
   evidencia,motivo,usuario_id,anterior_id)
  VALUES ($1::uuid,$2,$3::timestamptz,$4::jsonb,$5,$6,$7,$8,$9::uuid)
  RETURNING id::text`;

async function historicalIdentity(client: PoolClient) {
  const result = await client.query(`SELECT m.id,m.created_at::text AS created_at,
    jsonb_build_object('cliente_id',m.cliente_id,'tipo',m.tipo::text,
      'importe',m.importe,'ticket_id',m.ticket_id,
      'movimiento_origen_id',m.movimiento_origen_id) AS snapshot,
    (SELECT a.id::text FROM public.atribuciones_credito_e1 a
      WHERE a.movimiento_id=m.id AND a.movimiento_created_at=m.created_at
        AND a.identidad_snapshot=jsonb_build_object('cliente_id',m.cliente_id,
          'tipo',m.tipo::text,'importe',m.importe,'ticket_id',m.ticket_id,
          'movimiento_origen_id',m.movimiento_origen_id)
        AND NOT EXISTS(SELECT 1 FROM public.atribuciones_credito_e1 s WHERE s.anterior_id=a.id)
      ORDER BY a.created_at DESC,a.id DESC LIMIT 1) AS anterior_id
    FROM public.movimientos_credito m
    WHERE m.sitio_origen_id IS NULL AND m.id<1873000000 ORDER BY m.id LIMIT 1`);
  assert.equal(result.rows.length, 1, "Historical SQL probe requires one intact original unknown-site movement.");
  return result.rows[0] as {
    id: number; created_at: string; snapshot: Record<string, unknown>; anterior_id: string | null;
  };
}

async function attributionValues(client: PoolClient, actor: number = EVIDENCE_IDS.admin) {
  const historical = await historicalIdentity(client);
  return [
    ATTRIBUTION_UUID, historical.id, historical.created_at, JSON.stringify(historical.snapshot),
    EVIDENCE_IDS.site,
    "Evidencia sintética de prueba SQL; no afirma el sitio real; se revierte",
    "Sonda de guardia cerrada en clon desechable, ROLLBACK obligatorio",
    actor, historical.anterior_id,
  ];
}

async function fingerprint(pool: Pool) {
  const ledger = await pool.query(`SELECT id,md5(to_jsonb(m)::text) AS digest
    FROM public.movimientos_credito m ORDER BY id`);
  const financial = await pool.query(`SELECT jsonb_build_object(
    'operaciones',(SELECT count(*) FROM public.operaciones_credito_e1),
    'movimientos',(SELECT count(*) FROM public.movimientos_credito),
    'pendientes',(SELECT count(*) FROM public.cobros_credito_pendientes_e1),
    'atribuciones',(SELECT count(*) FROM public.atribuciones_credito_e1),
    'clientes',(SELECT count(*) FROM public.clientes),
    'usuarios',(SELECT count(*) FROM public.usuarios),
    'ubicaciones',(SELECT count(*) FROM public.ubicaciones),
    'sesionesCaja',(SELECT count(*) FROM public.sesiones_caja)) AS counts`);
  const guards = await pool.query(`SELECT t.tgname,t.tgenabled,pg_get_triggerdef(t.oid) AS trigger,
    pg_get_functiondef(t.tgfoid) AS function
    FROM pg_trigger t WHERE NOT t.tgisinternal AND t.tgrelid=ANY(ARRAY[
      'public.movimientos_credito'::regclass,'public.operaciones_credito_e1'::regclass,
      'public.cobros_credito_pendientes_e1'::regclass,'public.atribuciones_credito_e1'::regclass])
    ORDER BY t.tgrelid::text,t.tgname`);
  const contextFunctions = await pool.query(`SELECT p.proname,pg_get_functiondef(p.oid) AS definition
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname='validar_contexto_credito_e1'
    ORDER BY p.oid`);
  const sha = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
  return {
    ledgerRows: ledger.rows.length,
    ledgerHash: sha(ledger.rows),
    counts: financial.rows[0].counts,
    guardDefinitionsHash: sha({ triggers: guards.rows, contextFunctions: contextFunctions.rows }),
    disabledTriggers: guards.rows.filter((row) => !["O", "A"].includes(row.tgenabled)).length,
  };
}

export async function runEvidenceCases({ pool, record, guardTrial }: EvidenceRehearsalContext) {
  assertPinnedPool(pool);
  await assertClone(pool);
  assert.equal(typeof record, "function", "Master must supply the result collector.");
  const loader = createRehearsalLoader({ pool });
  const core = loader.loadModule("artifacts/api-server/src/lib/credit-evidence.ts") as
    typeof import("../../artifacts/api-server/src/lib/credit-evidence");
  const historical = loader.loadModule("artifacts/api-server/src/lib/credit-evidence-read.ts") as
    typeof import("../../artifacts/api-server/src/lib/credit-evidence-read");
  const { drizzle } = apiRequire("drizzle-orm/node-postgres");
  const before = await fingerprint(pool);
  assert.equal(before.disabledTriggers, 0, "Financial guards must already be enabled.");
  const cases: EvidenceCaseResult[] = [];
  type LiveActors = {
    admin: import("../../artifacts/api-server/src/lib/credit-evidence-read").EvidenceActor;
    cashier: import("../../artifacts/api-server/src/lib/credit-evidence-read").EvidenceActor;
  };

  async function run(
    name: string,
    boundary: EvidenceCaseResult["boundary"],
    action: (client: PoolClient, actors: LiveActors) => Promise<Outcome>,
  ) {
    const client = await pool.connect();
    let outcome: Outcome;
    try {
      await client.query("BEGIN");
      await client.query("SET LOCAL statement_timeout='10s'");
      await client.query("SET LOCAL lock_timeout='2s'");
      await assertClone(client);
      await client.query(`INSERT INTO public.ubicaciones(id,nombre,iniciales,tipo,activa)
        VALUES ($1,'E1 evidence rollback-only store','EVE','TIENDA',true)`, [EVIDENCE_IDS.site]);
      const insertedActors = await client.query(`INSERT INTO public.usuarios
        (id,nombre,usuario,password_hash,rol,ubicacion_id,activo,alcance_consulta)
        VALUES
          ($1,'E1 evidence admin','e1_evidence_rollback_admin','!E1_DISABLED_NO_LOGIN!','ADMIN',$3,true,'TODAS'),
          ($2,'E1 evidence cashier','e1_evidence_rollback_cashier','!E1_DISABLED_NO_LOGIN!','CAJA',$3,true,'PROPIA')
        RETURNING id,rol,activo,ubicacion_id AS "ubicacionId"`,
      [EVIDENCE_IDS.admin, EVIDENCE_IDS.cashier, EVIDENCE_IDS.site]);
      const admin = insertedActors.rows.find((row) => row.id === EVIDENCE_IDS.admin);
      const cashier = insertedActors.rows.find((row) => row.id === EVIDENCE_IDS.cashier);
      assert.ok(admin?.activo && admin.rol === "ADMIN", "Real ADMIN fixture missing.");
      assert.ok(cashier?.activo && cashier.rol === "CAJA", "Real CAJA fixture missing.");
      await client.query(`INSERT INTO public.sesiones_caja
        (id,ubicacion_id,usuario_id,abierta_at,fecha_operativa,fondo_inicial,estado)
        VALUES ($1,$2,$3,transaction_timestamp(),
          (transaction_timestamp() AT TIME ZONE 'America/Mexico_City')::date,0,'ABIERTA')`,
      [EVIDENCE_IDS.session, EVIDENCE_IDS.site, EVIDENCE_IDS.cashier]);
      await client.query(`INSERT INTO public.clientes(id,nombre,activo,es_sistema)
        VALUES ($1,'E1 ensayo evidencia rollback-only',true,false)`, [EVIDENCE_IDS.customer]);
      outcome = await action(client, { admin, cashier });
    } catch (error) {
      outcome = { status: "FAIL", classification: "UNEXPECTED_ERROR", details: { error: safeError(error) } };
    } finally {
      // Failure here aborts the module: never continue with a possibly open tx.
      try { await client.query("ROLLBACK"); } finally { client.release(); }
    }
    const result: EvidenceCaseResult = {
      name: guardTrial ? `${guardTrial.phase}:${name}` : name, boundary, ...outcome,
    };
    cases.push(result);
    await record(result);
  }

  if (!guardTrial) {
  const physicalEvidence = {
    sitioOrigenId: EVIDENCE_IDS.site, naturaleza: "INGRESO_FISICO" as const,
    operacionClave: UUID, sesionCajaId: EVIDENCE_IDS.session,
  };
  await run("physical_cash_closed_real_production_insert_helper", "APPLICATION_HELPER", async (client) => {
    await insertOperation(client, "ABONO_ORDINARIO", "INGRESO_FISICO");
    // Real Drizzle driver/schema over this same transaction, not a query mock.
    const tx = drizzle(client, { schema: loader.schema });
    return expectHelperRejection(() => core.insertCreditMovementE1(tx, {
      id: EVIDENCE_IDS.movement, clienteId: EVIDENCE_IDS.customer, tipo: "ABONO",
      importe: "-1.00", usuarioId: EVIDENCE_IDS.admin,
      formaPago: "EFECTIVO", cuentaDestino: "CAJA_FISICA",
    }, physicalEvidence, "ABONO_ORDINARIO"), /captura nueva de efectivo.*deshabilitada/);
  });
  await run("pending_receipt_closed_real_production_insert_helper", "APPLICATION_HELPER", async (client) => {
    await insertOperation(client, "COBRO_PENDIENTE", "INGRESO_FISICO");
    const tx = drizzle(client, { schema: loader.schema });
    return expectHelperRejection(() => core.insertPendingCreditReceiptE1(tx, {
      operacionProductor: "COBRO_PENDIENTE", operacionClave: UUID, naturaleza: "INGRESO_FISICO",
      clienteId: EVIDENCE_IDS.customer, importe: "1.00", fechaReal: new Date("2026-09-17T12:00:00Z"),
      sitioOrigenId: EVIDENCE_IDS.site, medio: "TRANSFERENCIA", cuentaDestino: "CUENTA_FISCAL",
      sesionCajaId: null, motivo: "Ensayo real helper sin recepción", usuarioId: EVIDENCE_IDS.admin,
    }), /cobro retenido.*deshabilitado/);
  });
  await run("historical_attribution_closed_production_gate_live_admin", "APPLICATION_HELPER", async (_client, { admin }) =>
    expectHelperRejection(() => historical.assertHistoricalAttributionGate(admin),
      /atribución histórica.*deshabilitada/));
  await run("historical_attribution_role_checked_before_closed_gate", "APPLICATION_HELPER", async (_client, { cashier }) =>
    expectHelperRejection(() => historical.assertHistoricalAttributionGate(cashier),
      /Sólo ADMIN o SUPERVISOR/));

  await run("legacy_sql_insert_without_e1_fields_is_rejected", "DATABASE_TRIGGER", (client) =>
    expectSqlRejection(client, `INSERT INTO public.movimientos_credito
      (id,cliente_id,tipo,importe,usuario_id,forma_pago,cuenta_destino)
      VALUES ($1,$2,'ABONO',-1,$3,'TRANSFERENCIA','CUENTA_FISCAL')`,
    [EVIDENCE_IDS.movement, EVIDENCE_IDS.customer, EVIDENCE_IDS.admin], rejectContract));
  for (const missing of ["sitioOrigenId", "naturaleza", "productor", "clave"]) {
    await run(`sql_missing_${missing}_is_rejected`, "DATABASE_TRIGGER", async (client) => {
      await insertOperation(client, "ABONO_ORDINARIO", "CORRECCION_CONTABLE");
      // MATCH FULL FK may reject a partial producer/key pair before the AFTER
      // contract trigger. Either exact installed guard is a legitimate denial.
      const expected = ["productor", "clave"].includes(missing) ? {
        code: ["P0001", "23503"],
        message: /todo INSERT requiere sitio, naturaleza y clave\/productor explícitos|movimientos_operacion_fk_e1/,
      } : rejectContract;
      return expectSqlRejection(client, MOVEMENT_INSERT, movementValues({ [missing]: null }), expected);
    });
  }
  await run("sql_operation_producer_incompatible_nature_is_rejected", "DATABASE_TRIGGER", (client) =>
    expectSqlRejection(client, `INSERT INTO public.operaciones_credito_e1
      (productor,clave,naturaleza,usuario_id,solicitud_canonica)
      VALUES ('AJUSTE_MANUAL',$1::uuid,'INGRESO_FISICO',$2,'{"ensayo":"incompatible"}'::jsonb)`,
    [UUID, EVIDENCE_IDS.admin], {
      code: "23514", message: /operaciones_productor_naturaleza_ck_e1/,
      constraint: "operaciones_productor_naturaleza_ck_e1",
    }));
  await run("sql_movement_nature_must_match_operation", "DATABASE_TRIGGER", async (client) => {
    await insertOperation(client, "ABONO_ORDINARIO", "CORRECCION_CONTABLE");
    return expectSqlRejection(client, MOVEMENT_INSERT,
      movementValues({ naturaleza: "INGRESO_FISICO" }),
      { code: "P0001", message: /actor\/naturaleza no coinciden con la operación/ });
  });
  await run("sql_movement_type_must_match_producer", "DATABASE_TRIGGER", async (client) => {
    await insertOperation(client, "ABONO_ORDINARIO", "CORRECCION_CONTABLE");
    return expectSqlRejection(client, MOVEMENT_INSERT, movementValues({ tipo: "AJUSTE" }),
      { code: "P0001", message: /productor incompatible con tipo\/signo\/incobrable/ });
  });
  await run("sql_cash_requires_explicit_session", "DATABASE_TRIGGER", async (client) => {
    await insertOperation(client, "ABONO_ORDINARIO", "INGRESO_FISICO");
    return expectSqlRejection(client, MOVEMENT_INSERT, movementValues({
      naturaleza: "INGRESO_FISICO", formaPago: "EFECTIVO", cuentaDestino: "CAJA_FISICA",
    }), { code: "P0001", message: /efectivo requiere CAJA_FISICA y sesión explícita/ });
  });
  await run("sql_cash_rejects_session_from_another_site", "DATABASE_TRIGGER", async (client) => {
    await client.query(`INSERT INTO public.ubicaciones(id,nombre,iniciales,tipo,activa)
      VALUES ($1,'E1 evidence other site rollback-only','EVB','TIENDA',true)`, [EVIDENCE_IDS.otherSite]);
    await insertOperation(client, "ABONO_ORDINARIO", "INGRESO_FISICO");
    return expectSqlRejection(client, MOVEMENT_INSERT, movementValues({
      naturaleza: "INGRESO_FISICO", formaPago: "EFECTIVO", cuentaDestino: "CAJA_FISICA",
      sitioOrigenId: EVIDENCE_IDS.otherSite, sesionCajaId: EVIDENCE_IDS.session,
    }), { code: "P0001", message: /sesión debe estar abierta y pertenecer al mismo sitio/ });
  });
  await run("sql_pending_receipt_rejects_malformed_cash_context", "DATABASE_TRIGGER", async (client) => {
    await insertOperation(client, "COBRO_PENDIENTE", "INGRESO_FISICO");
    return expectSqlRejection(client, PENDING_INSERT,
      [UUID, EVIDENCE_IDS.customer, EVIDENCE_IDS.site, "EFECTIVO", "CAJA_FISICA", null, EVIDENCE_IDS.admin],
      { code: "23514", message: /cobros_medio_cuenta_ck_e1/, constraint: "cobros_medio_cuenta_ck_e1" });
  });
  await run("sql_attribution_rejects_nonprivileged_actor", "DATABASE_TRIGGER", async (client) =>
    expectSqlRejection(client, ATTRIBUTION_INSERT, await attributionValues(client, EVIDENCE_IDS.cashier),
      { code: "P0001", message: /atribución sólo por ADMIN\/SUPERVISOR activo/ }));
  await run("sql_attribution_rejects_microsecond_identity_mismatch", "DATABASE_TRIGGER", async (client) => {
    const values = await attributionValues(client);
    const changed = await client.query("SELECT ($1::timestamptz+interval '1 microsecond')::text AS value", [values[2]]);
    values[2] = changed.rows[0].value;
    return expectSqlRejection(client, ATTRIBUTION_INSERT, values,
      { code: "P0001", message: /created_at no coincide exactamente/ });
  });
  await run("sql_attribution_rejects_complete_snapshot_mismatch", "DATABASE_TRIGGER", async (client) => {
    const values = await attributionValues(client);
    const snapshot = JSON.parse(String(values[3]));
    snapshot.importe = Number(snapshot.importe) + 0.01;
    values[3] = JSON.stringify(snapshot);
    return expectSqlRejection(client, ATTRIBUTION_INSERT, values,
      { code: "P0001", message: /snapshot canónico no coincide/ });
  });
  for (const verb of ["UPDATE", "DELETE"] as const) {
    await run(`sql_synthetic_ledger_${verb.toLowerCase()}_is_immutable`, "DATABASE_TRIGGER", async (client) => {
      await insertOperation(client, "ABONO_ORDINARIO", "CORRECCION_CONTABLE");
      await client.query(MOVEMENT_INSERT, movementValues());
      const sql = verb === "UPDATE"
        ? "UPDATE public.movimientos_credito SET notas='synthetic immutability probe' WHERE id=$1"
        : "DELETE FROM public.movimientos_credito WHERE id=$1";
      return expectSqlRejection(client, sql, [EVIDENCE_IDS.movement],
        { code: "P0001", message: /pagos y movimientos financieros son inmutables/ });
    });
  }
  }

  async function gateProbe(
    client: PoolClient,
    key: EvidenceSqlGuardKey,
    sql: string,
    values: unknown[],
    verifyExactRow: () => Promise<void>,
  ): Promise<Outcome> {
    if (guardTrial?.expectedOpenGate !== key) {
      return expectSqlRejection(client, sql, values, exactError(key), true);
    }
    const inserted = await client.query(sql, values);
    assert.equal(inserted.rowCount, 1, "Removed guard must admit exactly one intended row, not silently suppress INSERT.");
    await verifyExactRow();
    return {
      status: "PASS", classification: "EXPECTED_SQL_ACCEPTANCE_AFTER_INDEPENDENT_REMOVAL",
      details: { removedGuard: key, exactIdentityVerified: true, noSilentConversion: true, rollbackRequired: true },
    };
  }

  // These are intentionally strict requirement probes. Valid context is supplied
  // so a FK/format error cannot masquerade as an unactivated-feature gate.
  if (guardTrial?.kind !== "compatibility") {
  await run("REQUIRE_SQL_GATE_physical_cash_complete_insert", "DATABASE_CLOSED_GATE", async (client) => {
    await insertOperation(client, "ABONO_ORDINARIO", "INGRESO_FISICO");
    return gateProbe(client, "cash", MOVEMENT_INSERT, movementValues({
      naturaleza: "INGRESO_FISICO", formaPago: "EFECTIVO", cuentaDestino: "CAJA_FISICA",
      sesionCajaId: EVIDENCE_IDS.session,
    }), async () => {
      const saved = await client.query(`SELECT id,cliente_id,tipo,importe::text AS importe,usuario_id,
        naturaleza::text AS naturaleza,forma_pago::text AS forma_pago,cuenta_destino,
        sitio_origen_id,sesion_caja_id,operacion_productor,operacion_clave::text AS operacion_clave
        FROM public.movimientos_credito WHERE id=$1`, [EVIDENCE_IDS.movement]);
      assert.deepEqual(saved.rows, [{
        id: EVIDENCE_IDS.movement, cliente_id: EVIDENCE_IDS.customer, tipo: "ABONO", importe: "-1.00",
        usuario_id: EVIDENCE_IDS.admin, naturaleza: "INGRESO_FISICO", forma_pago: "EFECTIVO",
        cuenta_destino: "CAJA_FISICA", sitio_origen_id: EVIDENCE_IDS.site,
        sesion_caja_id: EVIDENCE_IDS.session, operacion_productor: "ABONO_ORDINARIO", operacion_clave: UUID,
      }]);
    });
  });
  // Add the outgoing direction to every independent-removal/reinstall phase,
  // while keeping the existing full evidence suite's 24-outcome contract.
  if (guardTrial?.kind === "probes") {
    await run("REQUIRE_SQL_GATE_physical_cash_refund_complete_insert", "DATABASE_CLOSED_GATE", async (client) => {
      const originalId = EVIDENCE_IDS.movement + 1;
      const originalKey = "e117e100-0000-4000-8000-000000000003";
      await insertOperation(client, "ABONO_ORDINARIO", "INGRESO_FISICO", originalKey);
      const originalInserted = await client.query(MOVEMENT_INSERT, movementValues({
        id: originalId, clave: originalKey, naturaleza: "INGRESO_FISICO",
        formaPago: "TRANSFERENCIA", cuentaDestino: "CUENTA_FISCAL",
      }));
      assert.equal(originalInserted.rowCount, 1, "Refund requires a real synthetic ABONO, not an omitted original.");
      const originalBefore = await client.query(`SELECT id,cliente_id,tipo::text AS tipo,
        importe::text AS importe,usuario_id,naturaleza::text AS naturaleza,
        forma_pago::text AS forma_pago,cuenta_destino,sitio_origen_id,sesion_caja_id,
        operacion_productor,operacion_clave::text AS operacion_clave
        FROM public.movimientos_credito WHERE id=$1`, [originalId]);
      assert.deepEqual(originalBefore.rows, [{
        id: originalId, cliente_id: EVIDENCE_IDS.customer, tipo: "ABONO", importe: "-1.00",
        usuario_id: EVIDENCE_IDS.admin, naturaleza: "INGRESO_FISICO", forma_pago: "TRANSFERENCIA",
        cuenta_destino: "CUENTA_FISCAL", sitio_origen_id: EVIDENCE_IDS.site, sesion_caja_id: null,
        operacion_productor: "ABONO_ORDINARIO", operacion_clave: originalKey,
      }]);
      const originalDigest = await client.query(
        "SELECT md5(to_jsonb(m)::text) AS digest FROM public.movimientos_credito m WHERE id=$1", [originalId]);
      await insertOperation(client, "REVERSO_ABONO", "DEVOLUCION_FISICA");
      return gateProbe(client, "cash", MOVEMENT_INSERT, movementValues({
        tipo: "REVERSO", importe: "1.00", productor: "REVERSO_ABONO",
        naturaleza: "DEVOLUCION_FISICA", formaPago: "EFECTIVO", cuentaDestino: "CAJA_FISICA",
        sesionCajaId: EVIDENCE_IDS.session, movimientoOrigenId: originalId,
      }), async () => {
        const saved = await client.query(`SELECT id,cliente_id,tipo::text AS tipo,
          importe::text AS importe,usuario_id,naturaleza::text AS naturaleza,
          forma_pago::text AS forma_pago,cuenta_destino,sitio_origen_id,sesion_caja_id,
          operacion_productor,operacion_clave::text AS operacion_clave,movimiento_origen_id
          FROM public.movimientos_credito WHERE id=$1`, [EVIDENCE_IDS.movement]);
        assert.deepEqual(saved.rows, [{
          id: EVIDENCE_IDS.movement, cliente_id: EVIDENCE_IDS.customer, tipo: "REVERSO", importe: "1.00",
          usuario_id: EVIDENCE_IDS.admin, naturaleza: "DEVOLUCION_FISICA", forma_pago: "EFECTIVO",
          cuenta_destino: "CAJA_FISICA", sitio_origen_id: EVIDENCE_IDS.site,
          sesion_caja_id: EVIDENCE_IDS.session, operacion_productor: "REVERSO_ABONO",
          operacion_clave: UUID, movimiento_origen_id: originalId,
        }]);
        const originalAfter = await client.query(
          "SELECT md5(to_jsonb(m)::text) AS digest FROM public.movimientos_credito m WHERE id=$1", [originalId]);
        assert.deepEqual(originalAfter.rows, originalDigest.rows, "Refund must append the exact inverse, never rewrite its original ABONO.");
      });
    });
  }
  await run("REQUIRE_SQL_GATE_pending_receipt_complete_insert", "DATABASE_CLOSED_GATE", async (client) => {
    await insertOperation(client, "COBRO_PENDIENTE", "INGRESO_FISICO");
    return gateProbe(client, "pending", PENDING_INSERT,
      [UUID, EVIDENCE_IDS.customer, EVIDENCE_IDS.site, "TRANSFERENCIA", "CUENTA_FISCAL", null, EVIDENCE_IDS.admin],
      async () => {
        const saved = await client.query(`SELECT operacion_productor,operacion_clave::text AS clave,
          naturaleza::text AS naturaleza,cliente_id,importe::text AS importe,
          fecha_real::text AS fecha_real,sitio_origen_id,medio::text AS medio,cuenta_destino,
          sesion_caja_id,usuario_id FROM public.cobros_credito_pendientes_e1
          WHERE operacion_productor='COBRO_PENDIENTE' AND operacion_clave=$1`, [UUID]);
        assert.deepEqual(saved.rows, [{
          operacion_productor: "COBRO_PENDIENTE", clave: UUID, naturaleza: "INGRESO_FISICO",
          cliente_id: EVIDENCE_IDS.customer, importe: "1.00", fecha_real: "2026-09-17 12:00:00.123456+00",
          sitio_origen_id: EVIDENCE_IDS.site, medio: "TRANSFERENCIA", cuenta_destino: "CUENTA_FISCAL",
          sesion_caja_id: null, usuario_id: EVIDENCE_IDS.admin,
        }]);
        const ledger = await client.query("SELECT count(*)::int AS count FROM public.movimientos_credito WHERE cliente_id=$1", [EVIDENCE_IDS.customer]);
        assert.equal(ledger.rows[0].count, 0, "Pending receipt must remain outside the monetary ledger.");
      });
  });
  await run("REQUIRE_SQL_GATE_historical_attribution_complete_insert", "DATABASE_CLOSED_GATE", async (client) => {
    const values = await attributionValues(client);
    const originalBefore = await client.query("SELECT md5(to_jsonb(m)::text) AS digest FROM public.movimientos_credito m WHERE id=$1", [values[1]]);
    return gateProbe(client, "attribution", ATTRIBUTION_INSERT, values, async () => {
      const saved = await client.query(`SELECT id::text AS id,movimiento_id,
        movimiento_created_at::text AS movimiento_created_at,identidad_snapshot,
        sitio_origen_id,evidencia,motivo,usuario_id,anterior_id::text AS anterior_id
        FROM public.atribuciones_credito_e1 WHERE id=$1`, [ATTRIBUTION_UUID]);
      assert.deepEqual(saved.rows, [{
        id: values[0], movimiento_id: values[1], movimiento_created_at: values[2],
        identidad_snapshot: JSON.parse(String(values[3])), sitio_origen_id: values[4],
        evidencia: values[5], motivo: values[6], usuario_id: values[7], anterior_id: values[8],
      }]);
      const originalAfter = await client.query("SELECT md5(to_jsonb(m)::text) AS digest FROM public.movimientos_credito m WHERE id=$1", [values[1]]);
      assert.deepEqual(originalAfter.rows, originalBefore.rows, "Separate attribution must never change the original historical movement.");
    });
  });
  }

  if (guardTrial?.kind === "compatibility") {
    const variants: Array<{
      producer: string; nature: string; type: string; amount: string;
      medium: string; account: string | null; original?: "VENTA_CREDITO" | "ABONO";
      badDebt?: boolean;
    }> = [
      { producer: "VENTA_CREDITO", nature: "OPERACION_CREDITO_SIN_DINERO", type: "VENTA_CREDITO", amount: "1.00", medium: "CREDITO", account: null },
      { producer: "CANCELACION_VENTA_CREDITO", nature: "OPERACION_CREDITO_SIN_DINERO", type: "REVERSO", amount: "-1.00", medium: "CREDITO", account: null, original: "VENTA_CREDITO" },
      { producer: "ABONO_ORDINARIO", nature: "INGRESO_FISICO", type: "ABONO", amount: "-1.00", medium: "TRANSFERENCIA", account: "CUENTA_FISCAL" },
      { producer: "ABONO_DIRIGIDO", nature: "INGRESO_FISICO", type: "ABONO", amount: "-1.00", medium: "TRANSFERENCIA", account: "CUENTA_NO_FISCAL" },
      { producer: "REVERSO_ABONO", nature: "CORRECCION_CONTABLE", type: "REVERSO", amount: "1.00", medium: "TRANSFERENCIA", account: "CUENTA_FISCAL", original: "ABONO" },
      // EFECTIVO as a legacy medium does not make an accounting correction
      // physical cash; this positive must remain allowed, with no caja session.
      { producer: "AJUSTE_MANUAL", nature: "CORRECCION_CONTABLE", type: "AJUSTE", amount: "1.00", medium: "EFECTIVO", account: "CAJA_FISICA" },
      { producer: "BAJA_INCOBRABLE", nature: "CORRECCION_CONTABLE", type: "AJUSTE", amount: "-1.00", medium: "TRANSFERENCIA", account: "CUENTA_FISCAL", badDebt: true },
    ];
    for (const variant of variants) {
      await run(`permitted_sql_producer_${variant.producer}`, "DATABASE_TRIGGER", async (client) => {
        let originalId: number | null = null;
        if (variant.original) {
          originalId = EVIDENCE_IDS.movement + 1;
          const originalKey = "e117e100-0000-4000-8000-000000000003";
          const sale = variant.original === "VENTA_CREDITO";
          const originalProducer = sale ? "VENTA_CREDITO" : "ABONO_ORDINARIO";
          const originalNature = sale ? "OPERACION_CREDITO_SIN_DINERO" : "CORRECCION_CONTABLE";
          await insertOperation(client, originalProducer, originalNature, originalKey);
          await client.query(MOVEMENT_INSERT, movementValues({
            id: originalId, clave: originalKey, productor: originalProducer,
            naturaleza: originalNature, tipo: variant.original, importe: sale ? "1.00" : "-1.00",
            formaPago: sale ? "CREDITO" : "TRANSFERENCIA", cuentaDestino: sale ? null : "CUENTA_FISCAL",
          }));
        }
        await insertOperation(client, variant.producer, variant.nature);
        const inserted = await client.query(MOVEMENT_INSERT, movementValues({
          productor: variant.producer, naturaleza: variant.nature, tipo: variant.type,
          importe: variant.amount, formaPago: variant.medium, cuentaDestino: variant.account,
          movimientoOrigenId: originalId, esIncobrable: variant.badDebt === true,
          motivoIncobrable: variant.badDebt ? "Ensayo sintético sin baja persistente" : null,
        }));
        assert.equal(inserted.rowCount, 1, "A permitted operation must insert exactly its intended ledger row.");
        const saved = await client.query(`SELECT operacion_productor,naturaleza::text AS naturaleza,
          tipo::text AS tipo,importe::text AS importe,sitio_origen_id,sesion_caja_id,
          movimiento_origen_id,es_incobrable,forma_pago::text AS forma_pago,cuenta_destino
          FROM public.movimientos_credito WHERE id=$1`, [EVIDENCE_IDS.movement]);
        assert.deepEqual(saved.rows, [{
          operacion_productor: variant.producer, naturaleza: variant.nature,
          tipo: variant.type, importe: variant.amount, sitio_origen_id: EVIDENCE_IDS.site,
          sesion_caja_id: null, movimiento_origen_id: originalId,
          es_incobrable: variant.badDebt === true, forma_pago: variant.medium,
          cuenta_destino: variant.account,
        }]);
        return {
          status: "PASS", classification: "PERMITTED_SQL_PRODUCER_UNCHANGED",
          details: { producer: variant.producer, nature: variant.nature, realPgInsert: true, rollbackRequired: true },
        };
      });
    }
  }

  const after = await fingerprint(pool);
  const unchanged = JSON.stringify(before) === JSON.stringify(after);
  const preservation: EvidenceCaseResult = {
    name: `${guardTrial ? `${guardTrial.phase}:` : ""}all_case_rollbacks_preserve_original_ledger_counts_and_guard_definitions`,
    boundary: "PRESERVATION",
    status: unchanged ? "PASS" : "FAIL",
    classification: unchanged ? "FULL_FINGERPRINT_UNCHANGED" : "PRESERVATION_FAILURE",
    details: { before, after },
  };
  cases.push(preservation);
  await record(preservation);
  const failed = cases.some((result) => result.status !== "PASS");
  return {
    status: failed ? "FAIL" : "PASS",
    requiresNonzeroExit: failed,
    cases,
    preservation,
    loadedSources: loader.loadedSources,
    databaseBoundaryNote: "Application gates and normal-SQL protection are independent; accepted valid raw INSERTs are reported as database gaps. No guard definition was changed.",
  };
}

async function recordGuardInventory(
  pool: Pool,
  record: EvidenceRehearsalContext["record"],
  phase: string,
  expectedOpenGate: EvidenceSqlGuardKey | null,
): Promise<EvidenceCaseResult> {
  assertPinnedPool(pool);
  await assertClone(pool);
  const definitions = Object.entries(EVIDENCE_SQL_GUARDS);
  const rows = await pool.query(`SELECT c.relname AS table_name,t.tgname,t.tgenabled,
    t.tgtype,p.proname,pg_get_triggerdef(t.oid) AS trigger_definition,
    pg_get_functiondef(p.oid) AS function_definition
    FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
    JOIN pg_namespace n ON n.oid=c.relnamespace JOIN pg_proc p ON p.oid=t.tgfoid
    WHERE n.nspname='public' AND NOT t.tgisinternal
      AND t.tgname=ANY($1::text[]) ORDER BY t.tgname`,
  [definitions.flatMap(([, guard]) => [guard.trigger, guard.permanent])]);
  const checks = definitions.map(([key, guard]) => {
    const installed = rows.rows.filter((row) => row.tgname === guard.trigger);
    const permanent = rows.rows.filter((row) => row.tgname === guard.permanent);
    const permanentUnchangedOrder = permanent.length === 1 &&
      ["O", "A"].includes(permanent[0].tgenabled) &&
      Number(permanent[0].tgtype) === guard.permanentTriggerType &&
      permanent[0].table_name === guard.table && guard.permanent < guard.trigger;
    const expectedInstalled = key !== expectedOpenGate;
    const expectedIdentity = expectedInstalled
      ? installed.length === 1 && installed[0].table_name === guard.table &&
        installed[0].proname === guard.function && Number(installed[0].tgtype) === guard.triggerType &&
        ["O", "A"].includes(installed[0].tgenabled)
      : installed.length === 0;
    return { key, expectedInstalled, actualInstalled: installed.length, permanentUnchangedOrder, expectedIdentity };
  });
  const pass = checks.every((check) => check.permanentUnchangedOrder && check.expectedIdentity);
  const result: EvidenceCaseResult = {
    name: `${phase}:independent_guard_inventory_and_permanent_validation_order`,
    status: pass ? "PASS" : "FAIL",
    boundary: "DATABASE_TRIGGER",
    classification: pass ? "EXPECTED_GUARD_INVENTORY" : "GUARD_INVENTORY_OR_ORDER_MISMATCH",
    details: {
      checks,
      definitionHash: createHash("sha256").update(JSON.stringify(rows.rows)).digest("hex"),
      expectedOpenGate,
    },
  };
  await record(result);
  return result;
}

export async function runEvidenceGuardProbes(context: {
  pool: Pool;
  record: EvidenceRehearsalContext["record"];
  phase: string;
  expectedOpenGate: EvidenceSqlGuardKey | null;
}) {
  const inventory = await recordGuardInventory(context.pool, context.record, context.phase, context.expectedOpenGate);
  const result = await runEvidenceCases({
    pool: context.pool, record: context.record,
    guardTrial: { kind: "probes", phase: context.phase, expectedOpenGate: context.expectedOpenGate },
  });
  const failed = inventory.status !== "PASS" || result.requiresNonzeroExit;
  return {
    ...result, cases: [inventory, ...result.cases],
    status: failed ? "FAIL" : "PASS", requiresNonzeroExit: failed,
  };
}

export async function runEvidenceGuardCompatibility(context: {
  pool: Pool;
  record: EvidenceRehearsalContext["record"];
  phase?: string;
}) {
  const phase = context.phase ?? "all-guards-seven-compatible-producers";
  const inventory = await recordGuardInventory(context.pool, context.record, phase, null);
  const result = await runEvidenceCases({
    pool: context.pool, record: context.record,
    guardTrial: { kind: "compatibility", phase },
  });
  const failed = inventory.status !== "PASS" || result.requiresNonzeroExit;
  return {
    ...result, cases: [inventory, ...result.cases],
    status: failed ? "FAIL" : "PASS", requiresNonzeroExit: failed,
  };
}

/** Compatibility adapter for the master's earlier shared runCases interface. */
export async function runCases(context: { pool: Pool; record?: EvidenceRehearsalContext["record"] }) {
  const recorded: EvidenceCaseResult[] = [];
  return runEvidenceCases({
    pool: context.pool,
    record: context.record ?? ((result) => { recorded.push(result); }),
  });
}