// Explicitly selected offline tests. Every production import is intercepted.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { resolve, dirname } from "node:path";
import test from "node:test";
const require = createRequire(import.meta.url);
const ts = require("typescript");
const root = process.argv.find((arg) => arg.startsWith("--fixture-root="))?.slice(15);
assert.ok(root?.startsWith("/tmp/"), "An explicit isolated /tmp fixture root is mandatory");
const base = resolve(root, "artifacts/api-server/src");
const read = (file) => readFileSync(resolve(base, file), "utf8");
const compile = (source) => ts.transpileModule(source, { compilerOptions: {
  module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true,
} }).outputText;
const pure = new Set(["lib/credit-evidence-contract.ts", "lib/credit-refund-contract.ts",
  "lib/credit-allocation.ts", "lib/date-only.ts", "lib/startup-mode.ts"]);
function evaluate(file, source, overrides = {}) {
  const module = { exports: {} };
  const imports = (name) => {
    if (Object.hasOwn(overrides, name)) return overrides[name];
    if (["node:assert/strict", "node:crypto", "node:fs", "node:fs/promises", "node:os",
      "node:path", "node:vm", "node:test", "typescript"].includes(name)) return require(name);
    const target = resolve(dirname(resolve(base, file)), `${name}.ts`).slice(base.length + 1);
    if (pure.has(target)) return evaluate(target, read(target));
    throw new Error(`Unallowlisted import: ${file}: ${name}`);
  };
  new Function("require", "module", "exports", compile(source.replaceAll("import.meta.url",
    JSON.stringify(pathToFileURL(resolve(base, file)).href))))(imports, module, module.exports);
  return module.exports;
}
const evidence = evaluate("lib/credit-abono-evidence.ts", read("lib/credit-abono-evidence.ts"), {
  "drizzle-orm": { sql() { throw new Error("SQL execution prohibited"); } },
});
// Reuse the existing route mount harness without registering its unrelated suites.
const routeFile = "routes/e1-customer-mutations.offline.test.ts";
const routes = evaluate(routeFile, read(routeFile).split('test("ordinary replay')[0]
  .replace('process.env.E1_CUSTOMER_MUTANT ?? ""', '""')
  + "\nexport { loadRoute, invoke, queryResult };", {
  esbuild: { transformSync: (source) => ({ code: compile(source) }) },
});
const physical = {
  sitioOrigenId: 7, naturaleza: "INGRESO_FISICO",
  operacionClave: "11111111-1111-4111-8111-111111111111",
  sesionCajaId: 8, notaOrigenId: null, origenJustificacion: null,
};
async function ordinary(applied) {
  const events = [];
  const writes = [];
  const tables = [];
  const allocations = applied ? [{ sourceId: 91, targetId: 22, appliedCents: applied,
    balanceBeforeCents: 10000, balanceAfterCents: 10000 - applied }] : [];
  const tx = {
    select: () => routes.queryResult([{ id: 3, activo: true }]),
    insert: (table) => ({ values: async (value) => { tables.push(value); events.push("persist"); } }),
  };
  const mounted = routes.loadRoute("clientes.ts", { tx, helpers: {
    assertCreditCaptureEnabled() {},
    claimCreditOperation: async () => ({ replay: false }),
    insertCreditMovementE1: async () => ({ id: 91, importe: "-100.00", cuentaDestino: "CAJA_FISICA",
      createdAt: new Date("2026-01-01T00:00:00Z") }),
    creditMovementAuditSnapshot: (row) => row,
  }, extra: {
    loadCustomerCreditProjectionInTransaction: async () => {
      events.push("FIFO");
      return { allocations, allCharges: [{ movimientoId: 22, folio: "OFFLINE-22", ticketId: 1,
        dueAt: new Date("2026-01-01T00:00:00Z") }], overpaymentCents: 10000 - applied };
    },
    evaluateAbonoEvidence: evidence.evaluateAbonoEvidence,
    finalizePhysicalAbonoEvidence: async (_tx, input) => {
      events.push("finalize");
      await evidence.finalizePhysicalAbonoEvidenceCore({ finalize: async (value) => writes.push(value) }, input, true);
    },
    getRequestIp: () => "offline",
  } });
  const reply = await routes.invoke(mounted.routes["post /clientes/:id/pagos"], {
    ...physical, importe: 100, formaPago: "EFECTIVO", cuentaDestino: "CAJA_FISICA",
  }, { id: 3 });
  assert.equal(reply.status, 201, "ordinary mounted route completes");
  assert.equal(writes.length, 1, "ordinary producer must finalize exactly once");
  assert.equal(writes[0].result, applied === 0 ? "UNUSED" : applied === 10000 ? "FULL" : "PARTIAL",
    "classification must match canonical allocations");
  assert.equal(writes[0].evaluation.projector, "projectCreditLedger",
    "ordinary provenance must identify canonical FIFO");
  assert.ok(events.indexOf("FIFO") < events.indexOf("finalize"), "finalization must follow FIFO");
  if (applied) assert.ok(events.indexOf("persist") < events.indexOf("finalize"),
    "finalization must follow persisted FIFO applications");
}
test("mounted ordinary producer: UNUSED/PARTIAL/FULL and FIFO persistence ordering", async () => {
  for (const applied of [0, 2500, 10000]) await ordinary(applied);
});

test("mounted directed approval finalizes FULL only after its application", async () => {
  const events = [];
  const writes = [];
  const payment = { tipo: "CLIENTE", entidadId: 3, documentoMovimientoId: 22, importe: 100,
    formaPago: "EFECTIVO", cuentaDestino: "CAJA_FISICA", motivo: "Pago dirigido documentado",
    fechaEfectiva: null, referencia: null, notas: null };
  let saved;
  let reads = 0;
  const request = { id: 12, tipo: "CLIENTE", estado: "PENDIENTE", entidad_id: 3,
    documento_movimiento_id: 22, importe: 100, forma_pago: "EFECTIVO",
    cuenta_destino: "CAJA_FISICA", motivo: payment.motivo,
    fecha_efectiva: null, referencia: null, notas: null, solicitante_id: 5 };
  const tx = {
    async execute() {
      reads++;
      if (reads === 1) return { rows: [request] };
      if (reads === 2) return { rows: [{ e1: saved }] };
      if (reads === 3) return { rows: [{ id: 22, ticket_id: 1, importe: "100.00" }] };
      if (reads === 4) return { rows: [{ nombre: "Offline" }] };
      throw new Error("Unexpected directed mock query");
    },
    insert: () => ({ values: (value) => {
      if (value.abonoMovimientoId) events.push("directed-persist");
      return { onConflictDoNothing: async () => {} };
    } }),
    update: () => ({ set: () => ({ where: async () => {} }) }),
  };
  const mounted = routes.loadRoute("pagos-dirigidos.ts", { tx, helpers: {
    assertCreditCaptureEnabled() {},
    claimCreditOperation: async () => ({ replay: false }),
    insertCreditMovementE1: async () => ({ id: 91 }),
  }, extra: {
    loadCustomerCreditProjectionInTransaction: async () => ({
      allCharges: [{ movimientoId: 22, pendienteCents: 10000 }],
    }),
    evaluateAbonoEvidence: evidence.evaluateAbonoEvidence,
    finalizePhysicalAbonoEvidence: async (_tx, input) => {
      events.push("directed-finalize");
      await evidence.finalizePhysicalAbonoEvidenceCore({ finalize: async (value) => writes.push(value) }, input, true);
    },
    getRequestIp: () => "offline",
  } });
  saved = { evidence: physical, intent: mounted.exports.directedCreditIntent(payment, physical) };
  let reply;
  await assert.doesNotReject(async () => {
    reply = await routes.invoke(mounted.routes["post /pagos-dirigidos/:id/aprobar"], physical, { id: 12 });
  }, "directed valid canonical FULL must not hit classification guard");
  assert.equal(reply.status, 201, "directed mounted route completes");
  assert.equal(writes.length, 1, "directed producer must finalize exactly once");
  assert.equal(writes[0].result, "FULL", "directed classification must be FULL");
  assert.equal(writes[0].evaluation.projector, "directedApplication",
    "directed provenance must not claim canonical FIFO");
  assert.deepEqual(events, ["directed-persist", "directed-finalize"],
    "directed finalization must follow persisted application");
});

test("actual core rejects directed result/amount mismatches before persistence", async () => {
  const base = { movementId: 91, productor: "ABONO_DIRIGIDO", formaPago: "EFECTIVO",
    cuentaDestino: "CAJA_FISICA", evidence: physical };
  const invalid = [
    { result: "UNUSED", appliedCents: 0 },
    { result: "PARTIAL", appliedCents: 2500 },
    { result: "FULL", appliedCents: 2500 },
    { result: "PARTIAL", appliedCents: 10000 },
  ];
  for (const evaluation of invalid) {
    const writes = [];
    await assert.rejects(evidence.finalizePhysicalAbonoEvidenceCore({
      finalize: async (value) => writes.push(value),
    }, { ...base, evaluation: { ...evaluation, receiptCents: 10000, allocations: [] } }, true),
    /dirigida.*FULL/, `directed ${evaluation.result}/${evaluation.appliedCents}: mismatch must reject before persistence`);
    assert.equal(writes.length, 0);
  }
});

test("positive proof is mandatory in the real refund service", async () => {
  const file = "lib/credit-refund.mock.test.ts";
  const harness = evaluate(file, read(file).split('test("cross-store')[0] + "\nexport { harness };");
  const h = harness.harness({ e2: true, e1: true, missingProof: true });
  await assert.rejects(h.run(), /falta prueba positiva/, "missing proof must reject refund");
  assert.deepEqual(h.state().writes, [], "missing proof must leave no writes");
});

test("real refund service accepts both origins and rejects absent/used ABONO finalization", async () => {
  const file = "lib/credit-refund.mock.test.ts";
  const { harness, input } = evaluate(file, read(file).split('test("cross-store')[0]
    + "\nexport { harness, input };");
  for (const data of [input, { ...input, origen: "COBRO_RETENIDO", abonoId: null,
    cobroClave: "20000000-0000-4000-8000-000000000001" }]) {
    const h = harness({ e2: true, e1: true });
    await assert.doesNotReject(h.run(data), `${data.origen}: valid own proof must be accepted`);
    assert.equal(h.state().outflows.length, 1, "each valid origin yields one outflow");
    assert.equal(h.state().reversals.length, data.origen === "ABONO" ? 1 : 0);
  }
  for (const finalization of ["MISSING", "PARTIAL", "FULL"]) {
    const h = harness({ e2: true, e1: true, finalization });
    await assert.rejects(h.run(), /falta prueba positiva/,
      `${finalization}: ABONO must require UNUSED finalization`);
    assert.deepEqual(h.state().writes, []);
  }
  const retained = harness({ e2: true, e1: true, retainedProof: false });
  await assert.rejects(retained.run({ ...input, origen: "COBRO_RETENIDO", abonoId: null,
    cobroClave: "20000000-0000-4000-8000-000000000001" }), /falta prueba positiva/);
  assert.deepEqual(retained.state().writes, []);
});

test("R4 application-order guard exists in prepared SQL (LEXICAL ONLY, not SQL semantics)", () => {
  const sql = readFileSync(resolve(root,
    "reports/e2-apertura-limitada/evidencia-a-c/01-install-evidence-prepared.sql"), "utf8");
  assert.match(sql, /CREATE TRIGGER e2_capture_application_order\s+BEFORE INSERT ON public\.aplicaciones_credito\s+FOR EACH ROW EXECUTE FUNCTION public\.e2_guard_finalized_capture_application\(\)/,
    "R4 lexical: application-order trigger must be installed");
  const body = sql.match(/CREATE FUNCTION public\.e2_guard_finalized_capture_application\(\)[\s\S]*?AS \$function\$([\s\S]*?)\$function\$;/)?.[1];
  assert.ok(body, "R4 lexical: application-order function must exist");
  assert.match(body, /source_xid::bigint = \(txid_current\(\) % 4294967296\)/);
  assert.match(body, /AND EXISTS \(SELECT 1 FROM public\.finalizaciones_abono_e2/);
  assert.match(body, /RAISE EXCEPTION 'E2: capture applications must precede finalization'/,
    "R4 lexical: finalized capture application must raise");
});

test("A+C mock preflight independently rejects each catalog drift", async (t) => {
  const preflight = evaluate("lib/limited-startup-preflight.ts", read("lib/limited-startup-preflight.ts"), {
    "drizzle-orm": {},
  });
  const fixtureFile = "lib/limited-startup-preflight.test.ts";
  const fixture = evaluate(fixtureFile, read(fixtureFile).split('test("limited mode')[0]
    + "\nexport { goodRows, approval };", { "./limited-startup-preflight": preflight });
  const install = readFileSync(resolve(root,
    "reports/e2-apertura-limitada/evidencia-a-c/01-install-evidence-prepared.sql"), "utf8");
  const bodies = Object.fromEntries([...install.matchAll(
    /CREATE(?: OR REPLACE)? FUNCTION public\.(\w+)\([\s\S]*?AS \$function\$([\s\S]*?)\$function\$;/g)]
    .map((match) => [match[1], match[2]]));
  const common = {
    prokind: "f", provolatile: "v", proparallel: "u", prosecdef: false,
    proleakproof: false, proisstrict: false, proretset: false, proacl: null,
    proconfig: ["search_path=pg_catalog, public"], language_name: "plpgsql", owner_name: "postgres",
  };
  const triggerDefs = [
    ["finalizaciones_abono_e2", "e2_finalization_immutable", 58, "e2_reject_evidence_mutation", false],
    ["finalizaciones_abono_e2", "e2_validate_abono_finalization", 7, "e2_validate_abono_finalization", false],
    ["evidencia_no_aplicada_e2", "e2_proof_immutable", 58, "e2_reject_evidence_mutation", false],
    ["evidencia_no_aplicada_e2", "e2_validate_unused_proof", 7, "e2_validate_unused_proof", false],
    ["movimientos_credito", "e2_abono_finalization_complete", 5, "e2_require_abono_finalization", true],
    ["aplicaciones_credito", "e2_capture_application_order", 7, "e2_guard_finalized_capture_application", false],
  ];
  const catalog = triggerDefs.map(([table_name, trigger_name, tgtype, function_name, has_constraint]) => ({
    ...common, table_name, trigger_name, tgtype, function_name, has_constraint, tgenabled: "O",
    args_length: 0, trigger_attr: "", has_parent: false, has_qual: false, function_schema: "public",
    tgdeferrable: has_constraint, tginitdeferred: has_constraint,
    result_type: "trigger", identity_arguments: "", prosrc: bodies[function_name],
  }));
  const finalizer = { ...common, result_type: "void",
    identity_arguments: "p_abono_id integer, p_productor text, p_resultado text, p_aplicado_cents bigint, p_evaluacion jsonb, p_contrato_revision text",
    prosrc: bodies.e2_finalize_new_abono };
  const voidFunctions = {
    e2_finalize_new_abono: finalizer,
    e2_attest_new_retained: { ...common, result_type: "void",
      identity_arguments: "p_clave uuid", prosrc: bodies.e2_attest_new_retained },
  };
  assert.equal(Object.keys(bodies).length, 7, "all maintained A+C function bodies must be present");
  const columns = preflight.ABONO_EVIDENCE_COLUMNS.map(([table_name, column_name, data_type]) => ({
    table_name, column_name, data_type, is_nullable: table_name === "evidencia_no_aplicada_e2"
      && preflight.ABONO_EVIDENCE_NULLABLE_COLUMNS.includes(column_name) ? "YES" : "NO",
    numeric_precision: data_type === "numeric" ? 12 : null,
    numeric_scale: data_type === "numeric" ? 2 : null,
    column_default: column_name === "created_at" ? "transaction_timestamp()"
      : column_name === "forma_pago" ? "'EFECTIVO'::text"
      : column_name === "naturaleza" ? "'INGRESO_FISICO'::text" : null,
  }));
  const constraints = preflight.ABONO_EVIDENCE_CONSTRAINTS.map(([table_name, name, definition]) => ({
    table_name, name, definition, convalidated: true, condeferrable: false,
    condeferred: false, index_valid: true,
  }));
  assert.equal(columns.length, 19);
  assert.equal(constraints.length, 21);
  async function run(target, field, value, remove = false, requireAbonoEvidence = false) {
    const calls = [];
    let releases = 0;
    const change = (rows, id) => rows.flatMap((row) => {
      if (id(row) !== target) return [row];
      return remove ? [] : [{ ...row, [field]: value }];
    });
    const pool = { async connect() { return {
      async query(sql, values) {
        calls.push(sql.trim());
        if (sql.includes("t.tgname = ANY")) return { rows: change(catalog, (row) => row.trigger_name) };
        if (sql.includes("p.proname=$1")) {
          assert.ok(Object.hasOwn(voidFunctions, values?.[0]), "void function query must propagate its identity");
          return { rows: change([voidFunctions[values[0]]], () => values[0]) };
        }
        if (sql.includes("information_schema.columns") && sql.includes("finalizaciones_abono_e2"))
          return { rows: change(columns, (row) => `${row.table_name}.${row.column_name}`) };
        if (sql.includes("pg_constraint") && sql.includes("finalizaciones_abono_e2"))
          return { rows: change(constraints, (row) => row.name) };
        if (sql.includes("pg_trigger")) return { rows: [
          ...fixture.goodRows(sql), catalog.find((row) => row.trigger_name === "e2_abono_finalization_complete"),
        ] };
        return { rows: fixture.goodRows(sql) };
      }, release() { releases++; },
    }; } };
    const promise = preflight.runLimitedStartupPreflight(pool, fixture.approval,
      preflight.LIMITED_SCHEMA_MANIFEST, { requireAbonoEvidence });
    if (target) {
      await assert.rejects(promise, /A\+C evidence (trigger|finalizer|column|constraint).*mismatch/,
        `${target}.${field}: drift must fail closed`);
      assert.equal(calls.includes("COMMIT"), false);
      assert.equal(calls.at(-1), "ROLLBACK");
    } else { await promise; assert.equal(calls.at(-1), "COMMIT"); }
    assert.equal(releases, 1);
  }
  await run();
  await run(undefined, undefined, undefined, false, true);
  for (const row of columns) {
    const name = `${row.table_name}.${row.column_name}`;
    await t.test(`${name}: missing`, () => run(name, "existence", null, true));
    for (const [field, value] of Object.entries({
      data_type: "invalid", is_nullable: row.is_nullable === "NO" ? "YES" : "NO", column_default: "unexpected()",
      ...(row.data_type === "numeric" ? { numeric_precision: 11, numeric_scale: 3 } : {}),
    })) await t.test(`${name}: ${field}`, () => run(name, field, value));
  }
  for (const row of constraints) {
    await t.test(`${row.name}: missing`, () => run(row.name, "existence", null, true));
    for (const [field, value] of Object.entries({
      table_name: "other", definition: "CHECK (true)", convalidated: false,
      condeferrable: true, condeferred: true, index_valid: false,
    })) await t.test(`${row.name}: ${field}`, () => run(row.name, field, value));
  }
  const functionDrifts = {
    prosrc: "\nBEGIN RETURN NULL; END;\n", prokind: "p", provolatile: "s", proparallel: "s",
    prosecdef: true, proleakproof: true, proisstrict: true, proretset: true,
    proacl: ["PUBLIC=X/postgres"], proconfig: null, language_name: "sql", owner_name: "other",
    result_type: "text", identity_arguments: "unexpected integer",
  };
  const triggerDrifts = { tgenabled: "D", tgtype: 1, table_name: "other", function_name: "other",
    function_schema: "other",
    args_length: 1, trigger_attr: "1", has_parent: true, has_qual: true };
  for (const row of [...catalog, ...Object.entries(voidFunctions).map(([trigger_name, value]) => ({
    ...value, trigger_name,
  }))]) {
    const name = row.trigger_name;
    await t.test(`${name}: missing`, () => run(name, "existence", null, true));
    for (const [field, value] of Object.entries(functionDrifts))
      await t.test(`${name}: ${field}`, () => run(name, field, value));
    if (!Object.hasOwn(voidFunctions, name)) {
      for (const [field, value] of Object.entries({ ...triggerDrifts,
        has_constraint: !row.has_constraint, tgdeferrable: !row.tgdeferrable,
        tginitdeferred: !row.tginitdeferred }))
        await t.test(`${name}: ${field}`, () => run(name, field, value));
    }
  }
});