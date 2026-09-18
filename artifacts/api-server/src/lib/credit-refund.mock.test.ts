/**
 * SAFE: production service is transpiled into an isolated VM with an explicit
 * dependency allowlist. NO @workspace/db import, DB driver, app or initializer.
 * Enabled simulations replace BOTH gates only inside that disposable VM.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import * as contract from "./credit-refund-contract";
import * as evidence from "./credit-evidence-contract";
import * as allocation from "./credit-allocation";
const source = readFileSync(new URL("./credit-refund.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: {
  module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
} }).outputText;
const key = "20000000-0000-4000-8000-000000000001";
const input = contract.readCreditRefundInput(1, { operacionClave: key, origen: "ABONO",
  abonoId: 3, importe: "25.00", motivo: "Devolver recepción completa", sitioOrigenId: 2, sesionCajaId: 4 });
const req = { auth: { user: { id: 9 } } };
type Row = Record<string, any>;
function harness(options: { e2?: boolean; e1?: boolean; role?: string; missingProof?: boolean;
  applied?: boolean; available?: number; failAudit?: boolean; closed?: boolean; historical?: boolean; mutate?: string;
  sessionSite?: number; replace?: { token: string; replacement: string } } = {}) {
  const tables: Record<string, Row> = {};
  for (const name of ["clientesTable", "usuariosTable", "movimientosCreditoTable", "auditoriaTable", "salidasDineroCajaTable"]) tables[name] = { name };
  let state: Row = { refund: null, disposed: false, writes: [], outflows: [], reversals: [] };
  let calls = 0;
  const events: string[] = [];
  const original = { id: 3, clienteId: 1, tipo: "ABONO", importe: "-25.00", createdAt: new Date("2026-09-18T12:00:00Z"),
    naturaleza: "INGRESO_FISICO", formaPago: "EFECTIVO", cuentaDestino: "CAJA_FISICA", sesionCajaId: 1, sitioOrigenId: 2, ticketId: null };
  const sql = (strings: TemplateStringsArray, ...params: unknown[]) => ({ text: strings.join("?"), params });
  const db = { async transaction(fn: (tx: any) => Promise<unknown>) {
    calls++;
    const draft = structuredClone(state);
    const tx = {
      select() { let table: Row; let lock: string | undefined; const chain: any = {
        from(t: Row) { table = t; return chain; }, where() { return chain; }, for(mode: string) { lock = mode; return chain; },
        async limit() {
          if (table.name === "clientesTable") {
            events.push(`customer:${lock}`);
            return [{ id: 1 }];
          }
          if (table.name === "movimientosCreditoTable") events.push("source");
          return table.name === "usuariosTable"
            ? [{ id: 9, activo: true, rol: options.role ?? "ADMIN" }] : [original];
        },
      }; return chain; },
      insert(table: Row) { return { values(row: Row) {
        if (options.failAudit && table.name === "auditoriaTable") throw new Error("audit failure");
        draft.writes.push(table.name);
        if (table.name === "salidasDineroCajaTable") draft.outflows.push(row);
        if (table.name === "movimientosCreditoTable") draft.reversals.push(row);
        return { async returning() { return [{ ...row, id: 81 }]; } };
      } }; },
      async execute(query: { text: string; params: any[] }) {
        const q = query.text;
        if (q.includes("pg_advisory_xact_lock")) return { rows: [] };
        if (q.includes("SELECT id FROM sesiones_caja")) return { rows: [{ id: 4 }] };
        if (q.includes("SELECT contenido")) return { rows: draft.refund ? [draft.refund] : [] };
        if (q.includes("FROM evidencia_no_aplicada_e2")) {
          events.push("proof");
          return { rows: options.missingProof ? [] : [{ fuente: "proof" }] };
        }
        if (q.includes("SELECT * FROM cobros")) {
          events.push("source");
          return { rows: [{
          cliente_id: 1, sitio_origen_id: 2, naturaleza: "INGRESO_FISICO", medio: "EFECTIVO",
          cuenta_destino: "CAJA_FISICA", sesion_caja_id: 1, importe: "25.00",
        }] }; }
        if (q.includes("SELECT id FROM aplicaciones")) return { rows: options.applied ? [{ id: 5 }] : [] };
        if (q.includes("SELECT id FROM movimientos_credito")) return { rows: [] };
        if (q.includes("INSERT INTO disposiciones")) {
          if (draft.disposed) return { rows: [] };
          draft.disposed = true; draft.writes.push("disposition"); return { rows: [{ fuente: "source" }] };
        }
        if (q.includes("INSERT INTO devoluciones")) {
          draft.refund = { actor_id: query.params[2], contenido: JSON.parse(query.params[3]), respuesta: JSON.parse(query.params[4]) };
          draft.writes.push("refund"); return { rows: [] };
        }
        throw new Error(`Unrecognized mock SQL: ${q}`);
      },
    };
    const result = await fn(tx);
    state = draft;
    return result;
  } };
  const dependencies: Record<string, unknown> = {
    "drizzle-orm": { sql, and() {}, eq() {} },
    "@workspace/db": { db, ...tables },
    "@workspace/db/advisory-locks": { ADVISORY_LOCK_NAMESPACES: { CUSTOMER_CREDIT: 1 }, async transactionAdvisoryLock() { events.push("advisory"); } },
    "./credit-evidence": {
      ...evidence,
      async assertCreditEvidenceAccess() {},
      async assertCreditEvidenceScope(_req: unknown, context: { sitioOrigenId: number }) {
        events.push("session:share");
        if (options.closed) throw new Error("session closed");
        if (context.sitioOrigenId !== (options.sessionSite ?? 2)) throw new Error("session/site mismatch");
      },
      assertCreditCaptureEnabled: options.e1 ? () => {} : evidence.assertCreditCaptureEnabled,
      async claimCreditOperation() { return { replay: false }; },
      async insertCreditMovementE1(tx: any, row: Row, context: Row) {
        // Mock persistence remains inside the production transaction's draft.
        return (await tx.insert(tables.movimientosCreditoTable).values({ ...row, ...context }).returning())[0];
      },
    },
    "./credit-aging-read-model": {
      async loadCustomerCreditProjectionInTransaction() {
        events.push("projection");
        return { overpaymentSources: [{ movementId: 3, availableCents: options.available ?? 2500 }] };
      },
      async loadCustomerCreditLedgerInTransaction() {
        events.push("ledger");
        return options.historical ? [original,
          { id: 4, tipo: "VENTA_CREDITO", importe: "25.00", ticketId: 1, createdAt: new Date("2026-09-18T13:00:00Z") },
          { id: 5, tipo: "REVERSO", importe: "-25.00", movimientoOrigenId: 4, ticketId: 1, createdAt: new Date("2026-09-18T14:00:00Z") },
        ] : [original];
      },
    },
    "./credit-allocation": allocation,
    "./request": { getRequestIp() { return "mock-only"; } },
    "./credit-refund-contract": { ...contract, assertCreditRefundEnabled: options.e2 ? () => {} : contract.assertCreditRefundEnabled },
  };
  const exports: any = {};
  let isolated = compiled;
  if (options.mutate) isolated = isolated.split(options.mutate).join("");
  if (options.replace) isolated = isolated.replace(options.replace.token, options.replace.replacement);
  vm.runInNewContext(isolated, { exports, require(name: string) {
    if (!(name in dependencies)) throw new Error(`Forbidden test import: ${name}`);
    return dependencies[name];
  } });
  return { run: (data = input) => exports.refundCreditReceipt(req, data), state: () => state, calls: () => calls, events, original };
}
test("cross-store ADMIN refund uses current cash B without changing receipt A, both origins", async () => {
  for (const data of [input, { ...input, origen: "COBRO_RETENIDO" as const, abonoId: null, cobroClave: key }]) {
    const h = harness({ e2: true, e1: true, sessionSite: 7 });
    const before = JSON.stringify(h.original);
    await h.run({ ...data, sitioOrigenId: 7, sesionCajaId: 44 });
    assert.equal(h.state().outflows[0].sesionCajaId, 44);
    if (data.origen === "ABONO") {
      assert.equal(h.state().reversals[0].sitioOrigenId, 7);
      assert.equal(h.state().reversals[0].sesionCajaId, 44);
    }
    assert.equal(JSON.stringify(h.original), before);
    assert.equal(h.original.sitioOrigenId, 2);
  }
});
test("wrong return session/site rejected; isolated removal of scope fails negative proof", async () => {
  const wrong = { ...input, sitioOrigenId: 7 };
  const good = harness({ e2: true, e1: true, sessionSite: 2 });
  await assert.rejects(good.run(wrong), /session\/site mismatch/);
  assert.deepEqual(good.state().writes, []);
  const token = "await (0, credit_evidence_1.assertCreditEvidenceScope)(req, evidence, tx);";
  assert.ok(compiled.includes(token));
  const mutant = harness({ e2: true, e1: true, sessionSite: 2, mutate: token });
  await assert.rejects(assert.rejects(mutant.run(wrong), /session\/site mismatch/), /Missing expected rejection/);
});
test("isolated restoration of original-site restriction fails required cross-store acceptance", async () => {
  for (const token of ["!original.sitioOrigenId", "!row.sitio_origen_id"]) {
    assert.ok(compiled.includes(token));
    const h = harness({ e2: true, e1: true, sessionSite: 7,
      replace: { token, replacement: token === "!original.sitioOrigenId"
        ? "original.sitioOrigenId !== input.sitioOrigenId" : "row.sitio_origen_id !== input.sitioOrigenId" } });
    const data = token === "!original.sitioOrigenId" ? input : { ...input, origen: "COBRO_RETENIDO" as const, abonoId: null, cobroClave: key };
    await assert.rejects(h.run({ ...data, sitioOrigenId: 7 }), /incompatible/);
  }
});
function assertCustomerLockOrder(events: string[], abono: boolean): void {
  const customer = events.indexOf("customer:update");
  assert.ok(customer >= 0, "customer FOR UPDATE must actually execute");
  assert.ok(events.indexOf("session:share") < events.indexOf("advisory"), "session before advisory");
  assert.ok(events.indexOf("advisory") < customer, "advisory before customer row");
  for (const read of ["proof", "source", ...(abono ? ["projection", "ledger"] : [])]) {
    assert.ok(events.indexOf(read) > customer, `${read} must follow customer FOR UPDATE`);
  }
}
test("actual service locks customer row before proof/source/projection in ABONO order", async () => {
  for (const data of [input, { ...input, origen: "COBRO_RETENIDO" as const, abonoId: null, cobroClave: key }]) {
    const h = harness({ e2: true, e1: true });
    await h.run(data);
    assertCustomerLockOrder(h.events, data.origen === "ABONO");
  }
});
test("negative proof: isolated service copy without customer FOR UPDATE fails orchestration assertion", async () => {
  // Keep the customer existence read, removing only its lock in this VM copy.
  const token = compiled.match(/const \[customer\] = await tx\.select\(\)\.from\(db_1\.clientesTable\)[\s\S]*?\.limit\(1\);/)?.[0];
  assert.ok(token, "find actual compiled customer read");
  const withoutLock = token.replace('.for("update")', "");
  assert.notEqual(token, withoutLock);
  // Replace the full read with a copied unlocked read using an isolated source.
  const mutantSource = compiled.replace(token, withoutLock);
  // Harness mutation substitutes only this exact statement (no production edits).
  const h = harness({ e2: true, e1: true, replace: { token, replacement: withoutLock } });
  assert.notEqual(mutantSource, compiled);
  await h.run();
  assert.throws(() => assertCustomerLockOrder(h.events, true), /customer FOR UPDATE/);
});
test("production gate prevents even entering transaction", async () => {
  const h = harness();
  await assert.rejects(h.run(), /pendiente/);
  assert.equal(h.calls(), 0);
});
test("isolated E2-open simulation still hits ORIGINAL E1 rejection, zero committed effects", async () => {
  for (const data of [input, { ...input, origen: "COBRO_RETENIDO" as const, abonoId: null, cobroClave: key }]) {
    const h = harness({ e2: true });
    await assert.rejects(h.run(data), /deshabilitada/);
    assert.deepEqual(h.state().writes, []);
  }
});
test("isolated future simulation: both origins, exact replay, single outflow, reversal only ABONO", async () => {
  for (const data of [input, { ...input, origen: "COBRO_RETENIDO" as const, abonoId: null, cobroClave: key }]) {
    const h = harness({ e2: true, e1: true });
    const result = await h.run(data);
    const replay = await h.run(data);
    assert.equal(JSON.stringify(result), JSON.stringify(replay));
    assert.equal(h.state().writes.filter((v: string) => v === "salidasDineroCajaTable").length, 1);
    assert.equal(h.state().writes.includes("movimientosCreditoTable"), data.origen === "ABONO");
    await assert.rejects(h.run({ ...data, motivo: "otro motivo" }), /UUID/);
  }
});
test("isolated future simulation: current authorization, positive proof, history, projection, session, rollback", async () => {
  for (const options of [{ role: "CAJA" }, { missingProof: true }, { applied: true }, { available: 2000 },
    { closed: true }, { failAudit: true }, { historical: true }]) {
    const h = harness({ e2: true, e1: true, ...options });
    await assert.rejects(h.run());
    assert.deepEqual(h.state().writes, []);
    assert.equal(h.state().disposed, false);
  }
});
test("exact replay survives session closure but not loss of current ADMIN role", async () => {
  const options = { e2: true, e1: true, closed: false, role: "ADMIN" };
  const h = harness(options);
  const initial = await h.run();
  options.closed = true;
  assert.equal(JSON.stringify(await h.run()), JSON.stringify(initial));
  options.role = "CAJA";
  await assert.rejects(h.run(), /ADMIN/);
});
test("isolated future simulation rejects partial receipts and a second UUID for one source", async () => {
  for (const data of [input, { ...input, origen: "COBRO_RETENIDO" as const, abonoId: null, cobroClave: key }]) {
    const partial = harness({ e2: true, e1: true });
    await assert.rejects(partial.run({ ...data, importe: "20.00" }), /incompatible/);
    assert.deepEqual(partial.state().writes, []);
    const duplicate = harness({ e2: true, e1: true });
    await duplicate.run(data);
    const before = JSON.stringify(duplicate.state());
    await assert.rejects(duplicate.run({ ...data, operacionClave: "20000000-0000-4000-8000-000000000002" }), /utilizado/);
    assert.equal(JSON.stringify(duplicate.state()), before);
  }
});
test("negative proof: retained service cannot omit its E1 gate", async () => {
  const token = '(0, credit_evidence_1.assertCreditCaptureEnabled)(evidence, "EFECTIVO", "REVERSO_ABONO", "REVERSO");';
  assert.ok(compiled.includes(token));
  const h = harness({ e2: true, mutate: token });
  const promise = h.run({ ...input, origen: "COBRO_RETENIDO", abonoId: null, cobroClave: key });
  // The isolated mutant incorrectly succeeds: our required-rejection test fails.
  await assert.rejects(assert.rejects(promise, /deshabilitada/), /Missing expected rejection/);
});
test("negative proof: removing gate in isolated compiled copy defeats zero-transaction assertion", async () => {
  const token = "(0, credit_refund_contract_1.assertCreditRefundEnabled)();";
  assert.ok(compiled.includes(token));
  // First occurrence belongs to the producer helper. Remove all occurrences in
  // an isolated string, never touch production file or its gate.
  const broken = compiled.split(token).join("");
  assert.notEqual(broken, compiled);
  const h = harness({ mutate: token });
  await assert.rejects(h.run(), /deshabilitada/);
  assert.throws(() => assert.equal(h.calls(), 0));
});