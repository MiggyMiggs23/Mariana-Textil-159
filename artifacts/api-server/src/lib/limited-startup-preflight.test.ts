import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  LIMITED_CONSTRAINT_EXPECTATIONS,
  LIMITED_INDEX_EXPECTATIONS,
  LIMITED_SCHEMA_MANIFEST,
  ABONO_EVIDENCE_COLUMNS,
  ABONO_EVIDENCE_CONSTRAINTS,
  ABONO_EVIDENCE_NULLABLE_COLUMNS,
  runLimitedStartupPreflight,
  type ReadonlyPreflightClient,
} from "./limited-startup-preflight";
import {
  LIMITED_STARTUP_REVISION,
  LIMITED_STARTUP_SQL_PLAN_FINGERPRINTS,
  startupMode,
  type LimitedStartupApproval,
} from "./startup-mode";

const approval: LimitedStartupApproval = {
  mode: "EXPLICIT_LIMITED",
  approved: true,
  route: "/api",
  revision: LIMITED_STARTUP_REVISION,
  database: { name: "expected_db", oid: "16384" },
  identitySha256: createHash("sha256")
    .update("expected_db|16384|app_role|<local>|<local>|160010")
    .digest("hex"),
  guardState: "CLOSED",
  sqlPlanFingerprints: LIMITED_STARTUP_SQL_PLAN_FINGERPRINTS,
  verifications: ["identity", "schema", "E1P01", "E1A01", "E1C01"],
};

function goodRows(sql: string): Array<Record<string, unknown>> {
  if (sql.includes("current_database()")) {
    return [{
      database_name: "expected_db",
      database_oid: "16384",
      schema_name: "public",
      database_role: "app_role",
      server_address: "<local>",
      server_port: "<local>",
      server_version_num: "160010",
      transaction_read_only: "on",
    }];
  }
  if (sql.includes("information_schema.columns")) {
    return [...LIMITED_SCHEMA_MANIFEST.columns,
      ["auditoria", "id", "integer"],
      ["salidas_dinero_caja", "id", "integer"],
      ["ubicaciones", "id", "integer"],
      ["proveedores", "id", "integer"],
      ["sesiones_caja", "ubicacion_id", "integer"],
    ].map(([table_name, column_name, data_type]) => ({
      table_name, column_name, data_type,
    }));
  }
  if (sql.includes("pg_constraint")) {
    return LIMITED_SCHEMA_MANIFEST.constraints.map((name) => {
      const expected = LIMITED_CONSTRAINT_EXPECTATIONS[name];
      return { name, type: expected.type, definition: expected.fragments.join(" ") };
    });
  }
  if (sql.includes("pg_indexes")) {
    return LIMITED_SCHEMA_MANIFEST.indexes.map((name) => ({
      name,
      definition: LIMITED_INDEX_EXPECTATIONS[name].join(" "),
    }));
  }
  if (sql.includes("pg_trigger")) {
    const temporary = [
      {
        table_name: "movimientos_credito",
        trigger_name: "zz_e1_cash_capture_closed",
        tgenabled: "O",
        tgtype: 5,
        function_name: "e1_guard_cash_capture_closed",
        function_source: "\nBEGIN\n  IF NEW.forma_pago::text = 'EFECTIVO'\n     AND NEW.naturaleza::text IN ('INGRESO_FISICO', 'DEVOLUCION_FISICA') THEN\n    RAISE EXCEPTION USING\n      ERRCODE = 'E1C01',\n      MESSAGE = 'E1: la captura física de efectivo de crédito está deshabilitada.';\n  END IF;\n  RETURN NEW;\nEND;\n",
      },
      {
        table_name: "cobros_credito_pendientes_e1",
        trigger_name: "zz_e1_pending_receipts_closed",
        tgenabled: "O",
        tgtype: 4,
        function_name: "e1_guard_pending_receipts_closed",
        function_source: "\nBEGIN\n  RAISE EXCEPTION USING\n    ERRCODE = 'E1P01',\n    MESSAGE = 'E1: el cobro retenido de crédito está deshabilitado.';\n  RETURN NULL;\nEND;\n",
      },
      {
        table_name: "atribuciones_credito_e1",
        trigger_name: "zz_e1_historical_attribution_closed",
        tgenabled: "O",
        tgtype: 4,
        function_name: "e1_guard_historical_attribution_closed",
        function_source: "\nBEGIN\n  RAISE EXCEPTION USING\n    ERRCODE = 'E1A01',\n    MESSAGE = 'E1: la atribución histórica de crédito está deshabilitada.';\n  RETURN NULL;\nEND;\n",
      },
    ].map((row) => ({
      ...row,
      prokind: "f", provolatile: "v", proparallel: "u", prosecdef: false,
      proleakproof: false, proisstrict: false, proretset: false, proacl: null,
      proconfig: ["search_path=pg_catalog, public"], result_type: "trigger",
      language_name: "plpgsql", owner_name: "postgres", public_execute: true,
    }));
    const permanent = [
      ["movimientos_credito", "movimientos_credito_inmutables", 27, "prevent_financial_record_mutation"],
      ["movimientos_credito", "movimientos_credito_reversos_validos", 7, "validate_credit_reversal"],
      ["movimientos_credito", "movimientos_validos_e1", 5, "validar_movimiento_credito_e1"],
      ["cobros_credito_pendientes_e1", "cobros_inmutables_e1", 58, "impedir_mutacion_credito_e1"],
      ["cobros_credito_pendientes_e1", "cobros_validos_e1", 5, "validar_cobro_pendiente_e1"],
      ["atribuciones_credito_e1", "atribuciones_inmutables_e1", 58, "impedir_mutacion_credito_e1"],
      ["atribuciones_credito_e1", "atribuciones_validas_e1", 7, "validar_atribucion_credito_e1"],
      ["auditoria", "auditoria_append_only", 27, "proteger_auditoria_append_only"],
    ].map(([table_name, trigger_name, tgtype, function_name]) => ({
      table_name, trigger_name, tgtype, function_name, tgenabled: "O",
      function_source: trigger_name === "auditoria_append_only"
        ? "\n       BEGIN\n         RAISE EXCEPTION 'auditoria es append-only';\n       END;\n       "
        : "",
      prokind: "f", provolatile: "v", result_type: "trigger",
      language_name: "plpgsql", owner_name: "postgres", public_execute: true,
    }));
    return [...temporary, ...permanent].map((row) => ({
      ...row,
      function_schema: "public", args_length: 0, trigger_attr: "",
      has_constraint: false, has_parent: false, has_qual: false,
    }));
  }
  return [];
}

function fakePool(
  alter: (sql: string, rows: Array<Record<string, unknown>>, values?: readonly unknown[]) => Array<Record<string, unknown>> = (_sql, rows) => rows,
  throwOn?: string,
) {
  const calls: string[] = [];
  let releases = 0;
  const client: ReadonlyPreflightClient = {
    async query(sql, values) {
      calls.push(sql.trim());
      if (throwOn && sql.includes(throwOn)) throw new Error("synthetic catalog failure");
      return { rows: alter(sql, goodRows(sql), values) };
    },
    release() {
      releases += 1;
    },
  };
  return {
    pool: { async connect() { return client; } },
    calls,
    get releases() { return releases; },
  };
}

test("limited mode requires the exact approved JSON state; normal remains unchanged", () => {
  assert.deepEqual(startupMode({}), { kind: "normal" });
  assert.deepEqual(startupMode({ API_STARTUP_MODE: "NORMAL" }), { kind: "normal" });
  const selected = startupMode({
    API_STARTUP_MODE: "EXPLICIT_LIMITED",
    API_LIMITED_STARTUP_APPROVAL: JSON.stringify(approval),
  });
  assert.equal(selected.kind, "limited");
  assert.throws(() => startupMode({
    API_STARTUP_MODE: "EXPLICIT_LIMITED",
    API_LIMITED_STARTUP_APPROVAL: JSON.stringify({ ...approval, extra: true }),
  }), /unexpected JSON shape/);
  assert.throws(() => startupMode({ API_STARTUP_MODE: "TYPO" }), /refusing normal startup fallthrough/);
  assert.throws(() => startupMode({}, {
    incomeCapture: true, abonoEvidence: true, returnCapture: false, pendingReceipts: false,
    historicalAttribution: false,
  }), /requires EXPLICIT_LIMITED/);
  assert.throws(() => startupMode({}, {
    incomeCapture: true, abonoEvidence: false, returnCapture: false, pendingReceipts: false,
    historicalAttribution: false,
  }), /mandatory A\+C evidence/);
  assert.throws(() => startupMode({
    API_STARTUP_MODE: "EXPLICIT_LIMITED",
    API_LIMITED_STARTUP_APPROVAL: JSON.stringify(approval),
  }, {
    incomeCapture: true, abonoEvidence: true, returnCapture: false, pendingReceipts: false,
    historicalAttribution: false,
  }), /guardState mismatch/);
});

test("enabled A+C evidence requires its schema before limited startup can listen", async () => {
  const fake = fakePool();
  await assert.rejects(
    runLimitedStartupPreflight(fake.pool, approval, LIMITED_SCHEMA_MANIFEST, {
      requireAbonoEvidence: true,
    }),
    /A\+C evidence column mismatch/,
  );
  assert.equal(fake.calls.at(-1), "ROLLBACK");
  assert.equal(fake.releases, 1);
});

// A+C catalog fixture shared only by the four xid8 regression cases.
// Function bodies come from the SQL under test, never from expected hashes.
async function evidenceRows() {
  const sqlSource = await readFile(new URL("../../../../reports/e2-apertura-limitada/evidencia-a-c/01-install-evidence-prepared.sql", import.meta.url), "utf8");
  const bodies = new Map([...sqlSource.matchAll(/CREATE FUNCTION public\.(\w+)\([\s\S]*?AS \$function\$([\s\S]*?)\$function\$;/g)]
    .map((match) => [match[1], match[2]]));
  const metadata = {
    prokind: "f", provolatile: "v", proparallel: "u", prosecdef: false,
    proleakproof: false, proisstrict: false, proretset: false, proacl: null,
    proconfig: ["search_path=pg_catalog, public"], language_name: "plpgsql",
    owner_name: "postgres", function_schema: "public", result_type: "trigger", identity_arguments: "",
    args_length: 0, trigger_attr: "", has_parent: false, has_qual: false,
    tgenabled: "O",
  };
  const triggers = [
    ["movimientos_credito", "e2_source_insert_transaction", 23, "e2_stamp_insert_transaction"],
    ["cobros_credito_pendientes_e1", "e2_retained_insert_transaction", 23, "e2_stamp_insert_transaction"],
    ["finalizaciones_abono_e2", "e2_finalization_immutable", 58, "e2_reject_evidence_mutation"],
    ["finalizaciones_abono_e2", "e2_validate_abono_finalization", 7, "e2_validate_abono_finalization"],
    ["evidencia_no_aplicada_e2", "e2_proof_immutable", 58, "e2_reject_evidence_mutation"],
    ["evidencia_no_aplicada_e2", "e2_validate_unused_proof", 7, "e2_validate_unused_proof"],
    ["movimientos_credito", "e2_abono_finalization_complete", 5, "e2_require_abono_finalization"],
    ["aplicaciones_credito", "e2_capture_application_order", 7, "e2_guard_finalized_capture_application"],
  ].map(([table_name, trigger_name, tgtype, function_name]) => ({
    ...metadata, table_name, trigger_name, tgtype, function_name,
    prosrc: bodies.get(String(function_name)),
    has_constraint: trigger_name === "e2_abono_finalization_complete",
    tgdeferrable: trigger_name === "e2_abono_finalization_complete",
    tginitdeferred: trigger_name === "e2_abono_finalization_complete",
  }));
  const rowsFor = (sql: string, rows: Array<Record<string, unknown>>, values?: readonly unknown[]): Array<Record<string, unknown>> => {
    if (sql.includes("information_schema.columns") && sql.includes("'finalizaciones_abono_e2'")) {
      return ABONO_EVIDENCE_COLUMNS.map(([table_name, column_name, data_type]) => ({
        table_name, column_name, data_type,
        is_nullable: column_name === "e2_insert_xid" || (table_name === "evidencia_no_aplicada_e2"
          && (ABONO_EVIDENCE_NULLABLE_COLUMNS as readonly string[]).includes(column_name)) ? "YES" : "NO",
        numeric_precision: data_type === "numeric" ? 12 : null,
        numeric_scale: data_type === "numeric" ? 2 : null,
        column_default: column_name === "created_at" ? "transaction_timestamp()"
          : column_name === "forma_pago" ? "'EFECTIVO'::text"
          : column_name === "naturaleza" ? "'INGRESO_FISICO'::text" : null,
      }));
    }
    if (sql.includes("pg_constraint") && sql.includes("index_valid")) {
      return ABONO_EVIDENCE_CONSTRAINTS.map(([table_name, name, definition]) => ({
        table_name, name, definition, convalidated: true, condeferrable: false,
        condeferred: false, index_valid: true,
      }));
    }
    if (sql.includes("pg_trigger") && sql.includes("t.tgdeferrable")) return triggers.map((row) => ({ ...row }));
    if (sql.includes("p.proname=$1")) return [{
      ...metadata, prosrc: bodies.get(String(values?.[0])), result_type: "void",
      identity_arguments: values?.[0] === "e2_attest_new_retained" ? "p_clave uuid"
        : "p_abono_id integer, p_productor text, p_resultado text, p_aplicado_cents bigint, p_evaluacion jsonb, p_contrato_revision text",
    }];
    if (sql.includes("pg_trigger")) return [
      ...rows,
      triggers.find(row => row.trigger_name === "e2_abono_finalization_complete")!,
    ];
    return rows;
  };
  return rowsFor;
}

test("A+C combined inventory supports closed-preserved and rejects each schema drift", async () => {
  const rowsFor = await evidenceRows();
  for (const requireAbonoEvidence of [false, true]) {
    const fake = fakePool(rowsFor);
    await runLimitedStartupPreflight(fake.pool, approval, LIMITED_SCHEMA_MANIFEST, { requireAbonoEvidence });
    assert.equal(fake.calls.at(-1), "COMMIT");
  }
  const limited = fakePool((sql, rows, values) => rowsFor(sql, rows, values).map((row) =>
    row.trigger_name === "zz_e1_cash_capture_closed" ? {
      ...row,
      function_source: String(row.function_source).replace(
        "AND NEW.naturaleza::text IN ('INGRESO_FISICO', 'DEVOLUCION_FISICA') THEN",
        "AND NEW.naturaleza::text IN ('INGRESO_FISICO', 'DEVOLUCION_FISICA')\n     AND (\n       NEW.naturaleza::text = 'DEVOLUCION_FISICA'\n       OR NEW.tipo::text IS DISTINCT FROM 'ABONO'\n     ) THEN",
      ),
    } : row));
  await runLimitedStartupPreflight(limited.pool, { ...approval, guardState: "LIMITED" });
  assert.equal(limited.calls.at(-1), "COMMIT");
  const mutations: Array<(sql: string, rows: Array<Record<string, unknown>>) => void> = [
    ...ABONO_EVIDENCE_CONSTRAINTS.map(([, name]) => (sql: string, rows: Array<Record<string, unknown>>) => {
      if (sql.includes("index_valid")) rows.find((row) => row.name === name)!.definition = "CHECK (true)";
    }),
    ...ABONO_EVIDENCE_COLUMNS.map(([table, column]) => (sql: string, rows: Array<Record<string, unknown>>) => {
      if (sql.includes("is_nullable")) {
        const row = rows.find((r) => r.table_name === table && r.column_name === column)!;
        row.is_nullable = row.is_nullable === "YES" ? "NO" : "YES";
      }
    }),
    ...["tgdeferrable", "tginitdeferred"].map((property) => (sql: string, rows: Array<Record<string, unknown>>) => {
      if (sql.includes("t.tgdeferrable")) rows.find((row) => row.trigger_name === "e2_abono_finalization_complete")![property] = false;
    }),
    (sql, rows) => { if (sql.includes("t.tgdeferrable")) rows.push({ ...rows[0], trigger_name: "unexpected_trigger" }); },
    (sql, rows) => { if (sql.includes("pg_trigger") && !sql.includes("t.tgdeferrable")) rows.push({ ...rows[0], trigger_name: "unexpected_e1_trigger" }); },
  ];
  for (const mutate of mutations) {
    const fake = fakePool((sql, rows, values) => {
      const result = rowsFor(sql, rows, values);
      mutate(sql, result);
      return result;
    });
    await assert.rejects(runLimitedStartupPreflight(fake.pool, approval), /mismatch/);
    assert.equal(fake.calls.at(-1), "ROLLBACK");
    assert.equal(fake.releases, 1);
  }
});

test("read-only preflight commits only after schema and all three old guards match", async () => {
  const fake = fakePool(await evidenceRows());
  const result = await runLimitedStartupPreflight(fake.pool, approval);
  assert.equal(result.checked.guards, 11);
  assert.match(fake.calls[0], /^BEGIN TRANSACTION READ ONLY$/);
  assert.equal(fake.calls.at(-1), "COMMIT");
  assert.equal(fake.releases, 1);
  assert.equal(fake.calls.some((sql) => /\b(INSERT|UPDATE|DELETE|ALTER|CREATE|DROP)\b/i.test(sql)), false);
});

test("missing schema fails closed, rolls back, and releases", async () => {
  const fake = fakePool((sql, rows) =>
    sql.includes("information_schema.columns") ? rows.slice(1) : rows);
  await assert.rejects(runLimitedStartupPreflight(fake.pool, approval), /schema column mismatch/);
  assert.equal(fake.calls.at(-1), "ROLLBACK");
  assert.equal(fake.releases, 1);
});

test("full traffic manifest rejects missing audit, cash-exit, location, provider and session context", async () => {
  const fullManifest = {
    ...LIMITED_SCHEMA_MANIFEST,
    columns: [
      ...LIMITED_SCHEMA_MANIFEST.columns,
      ["auditoria", "id", "integer"],
      ["salidas_dinero_caja", "id", "integer"],
      ["ubicaciones", "id", "integer"],
      ["proveedores", "id", "integer"],
      ["sesiones_caja", "ubicacion_id", "integer"],
    ] as Array<readonly [string, string, string]>,
  };
  for (const missingTable of [
    "auditoria", "salidas_dinero_caja", "ubicaciones", "proveedores", "sesiones_caja",
  ]) {
    const fake = fakePool((sql, rows) => sql.includes("information_schema.columns")
      ? rows.filter((row) => row.table_name !== missingTable)
      : rows);
    await assert.rejects(
      runLimitedStartupPreflight(fake.pool, approval, fullManifest),
      /schema column mismatch/,
    );
    assert.equal(fake.calls.includes("COMMIT"), false);
  }
});

test("dropping the permanent session/site/nature E1 context trigger fails closed", async () => {
  const rowsFor = await evidenceRows();
  const fake = fakePool((sql, rows, values) => {
    const catalog = rowsFor(sql, rows, values);
    return sql.includes("pg_trigger")
      ? catalog.filter((row) => row.trigger_name !== "movimientos_validos_e1")
      : catalog;
  });
  await assert.rejects(
    runLimitedStartupPreflight(fake.pool, approval),
    /permanent E1 trigger inventory mismatch/,
  );
  assert.equal(fake.calls.includes("COMMIT"), false);
});

test("a wrong E1 guard fails closed", async () => {
  const rowsFor = await evidenceRows();
  const fake = fakePool((sql, rows, values) => {
    const catalog = rowsFor(sql, rows, values);
    return sql.includes("pg_trigger")
      ? catalog.map((row) => row.trigger_name === "zz_e1_pending_receipts_closed"
        ? { ...row, function_source: "RETURN NEW" } : row)
      : catalog;
  });
  await assert.rejects(runLimitedStartupPreflight(fake.pool, approval), /guard E1P01/);
  assert.equal(fake.calls.includes("COMMIT"), false);
});

test("catalog exceptions attempt rollback and always release", async () => {
  const fake = fakePool(undefined, "pg_constraint");
  await assert.rejects(runLimitedStartupPreflight(fake.pool, approval), /synthetic catalog failure/);
  assert.equal(fake.calls.at(-1), "ROLLBACK");
  assert.equal(fake.releases, 1);
});

test("actual index source keeps limited preflight before listen and suppresses every startup writer", async () => {
  const sourceUrl = new URL("../index.ts", import.meta.url);
  const source = (await readFile(sourceUrl)).toString("utf8");
  const assertions = (candidate: string) => {
    const limitedStart = candidate.indexOf('mode.kind === "limited"');
    const preflight = candidate.indexOf("await runLimitedStartupPreflight", limitedStart);
    const listen = candidate.indexOf("app.listen");
    const appImport = candidate.indexOf('await import("./app")');
    assert.ok(limitedStart >= 0 && preflight > limitedStart && listen > preflight);
    assert.ok(appImport > preflight && listen > appImport);
    assert.match(candidate, /const nonWritingBoot = mode\.kind !== "normal"/);
    assert.match(candidate, /if \(nonWritingBoot\)[\s\S]*?return;[\s\S]*?backfillCompras/);
    assert.match(candidate, /if \(nonWritingBoot\)[\s\S]*?return;[\s\S]*?runStockMinimumPoller/);
    assert.match(candidate, /else if \(mode\.kind === "limited"\)[\s\S]*?else \{\s*await ensureStartupSchemas\(\)/);
  };
  assertions(source);

  const directory = await mkdtemp(join(tmpdir(), "limited-startup-mutants-"));
  try {
    const mutations: Array<[string, string]> = [
      ["listen-before-preflight", source.replace(
        "const preflight = await runLimitedStartupPreflight(",
        "app.listen(requireServerPort());\n    const preflight = await runLimitedStartupPreflight(",
      )],
      ["writers-enabled", source.replace("if (nonWritingBoot) {", "if (false) {")],
      ["initializer-fallthrough", source.replace(
        "} else if (mode.kind === \"limited\") {",
        "}\n  if (mode.kind === \"limited\") {",
      )],
    ];
    for (const [name, mutant] of mutations) {
      const path = join(directory, `${name}.ts`);
      await writeFile(path, mutant);
      const fixture = await readFile(path, "utf8");
      assert.throws(() => assertions(fixture), { name: "AssertionError" }, `${name} must be killed`);
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("actual application import graph has no automatic session-store maintenance hooks", async () => {
  const files = [
    new URL("../app.ts", import.meta.url),
    new URL("../routes/index.ts", import.meta.url),
    new URL("../../package.json", import.meta.url),
  ];
  const source = (await Promise.all(files.map((file) => readFile(file, "utf8")))).join("\n");
  assert.doesNotMatch(source, /connect-pg-simple|pruneSessionInterval|createTableIfMissing/);
  assert.doesNotMatch(source, /^\s*(?:await|void)\s+ensure[A-Z]/m);
});