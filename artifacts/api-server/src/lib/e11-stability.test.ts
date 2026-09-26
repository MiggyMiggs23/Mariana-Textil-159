import assert from "node:assert/strict";
import test from "node:test";
import { PgDialect } from "drizzle-orm/pg-core";
import { createE11Runtime } from "./e11-runtime";
import { e11Execute, e11FinanceClients, e11Identity, type E11Sql } from "./e11-repository";
import { e11Hash, e11Paginate } from "./e11";
import { projectCreditLedger } from "./credit-allocation";

const dialect = new PgDialect();
const flags = { enabled: true, profiles: true, reconciliation: true, preparation: true,
  e5Enabled: true, e5ContadorA: true };
function identityTx(queries: string[], version = 1): E11Sql {
  return { execute: async (query: any) => {
    const text = dialect.sqlToQuery(query).sql; queries.push(text);
    if (text.includes("FROM usuarios")) return { rows: [{ id: 7, rol: "CONTADOR", activo: true }] };
    if (text.includes("FROM sesiones")) return { rows: [{ id: "session" }] };
    if (text.includes("FROM e11_perfiles")) return { rows: [{ perfil: "A", version }] };
    return { rows: [] };
  } };
}

test("large financial directory uses one canonical bulk projection and preserves full revision", async () => {
  const rows = Array.from({ length: 2575 }, (_, i) => ({
    id: i + 2, nombre: `Cliente ${i + 2}`, telefono: null, correo: null, limite_credito: "100.00",
  }));
  let selects = 0, ledgerCalls = 0, bulkCalls = 0;
  const tx: E11Sql = { execute: async (q: any) => {
    selects++;
    const query = dialect.sqlToQuery(q);
    return { rows: query.sql.includes("WHERE id=") ? [rows.find(r => r.id === query.params[0])!] : rows };
  } };
  const runtime = createE11Runtime({ flags,
    ledger: async () => { ledgerCalls++; return []; },
    projections: async (received, ids) => {
      assert.equal(received, tx); assert.deepEqual(ids, rows.map(row => row.id)); bulkCalls++;
      return new Map(ids.map(id => [id, projectCreditLedger([])]));
    },
  });
  const result = await runtime.run(() => e11FinanceClients(tx));
  const expected = rows.map(row => ({ clienteId: row.id, nombre: row.nombre, contacto: null,
    limiteCredito: row.limite_credito, saldo: "0.00" }));
  assert.deepEqual(result, expected);
  assert.equal(e11Hash(result), e11Hash(expected));
  assert.equal(selects, 1, "no per-customer SELECTs");
  assert.equal(ledgerCalls, 0, "no per-customer ledger trips");
  assert.equal(bulkCalls, 1);
  const actor = await runtime.run(() => e11Identity(identityTx([]), 7));
  const page = e11Paginate(result, { limit: 50 }, actor, { route: "clientesA" }, e11Hash(result));
  assert.equal(page.items.length, 50);
  assert.deepEqual(e11Paginate(result, { limit: 50, cursor: page.nextCursor! },
    actor, { route: "clientesA" }, e11Hash(result)).items, expected.slice(50, 100));
  const changed = expected.map(row => ({ ...row }));
  changed[2000].saldo = "1.00";
  assert.throws(() => e11Paginate(changed, { limit: 50, cursor: page.nextCursor! },
    actor, { route: "clientesA" }, e11Hash(changed)), /cursor perdió vigencia/);
});

test("session lock permits non-key expiry renewal but still protects deletion", async () => {
  const queries: string[] = [];
  await createE11Runtime({ flags }).run(() => e11Identity(identityTx(queries), 7, "session"));
  assert.match(queries.find(q => q.includes("FROM sesiones"))!, /FOR KEY SHARE/);
  assert.match(queries.find(q => q.includes("FROM usuarios"))!, /FOR SHARE/);
});

test("explicit read retries one rolled-back 40001 with fresh identity; delivers once", async () => {
  let attempts = 0, work = 0, delivered = 0;
  const queries: string[] = [];
  await createE11Runtime({ flags, transaction: async callback => {
    attempts++;
    const value = await callback(identityTx(queries));
    if (attempts === 1) throw Object.assign(new Error("rolled back serialization"), { code: "40001" });
    return value;
  } }).run(() => e11Execute({
    userId: 7, sessionId: "session", capability: "FINANZAS_LIMITADAS_LEER", readOnly: true,
    work: async () => { work++; return "ok"; }, parse: String,
    deliver: () => { delivered++; },
  }));
  assert.equal(attempts, 3); assert.equal(work, 2); assert.equal(delivered, 1);
  assert.equal(queries.filter(q => q.includes("FROM sesiones")).length, 3);
});

test("serialization retry is bounded, never retries timeout, unique conflict, deadlock or writes", async () => {
  for (const code of ["40001", "23505", "40P01", "57014", "ETIMEDOUT"]) {
    for (const write of [false, true]) {
      let attempts = 0, delivered = 0;
      await assert.rejects(() => createE11Runtime({ flags, transaction: async () => {
        attempts++; throw Object.assign(new Error(code), { code });
      } }).run(() => e11Execute({
        userId: 7, sessionId: "session", capability: null, readOnly: !write,
        ...(write ? { mutationUuid: "original-intent" } : {}),
        work: async () => "ok", parse: String, deliver: () => { delivered++; },
      })));
      assert.equal(attempts, code === "40001" && !write ? 2 : 1);
      assert.equal(delivered, 0);
    }
  }
});

test("delivery failure and true profile revocation never retry or disclose protected result", async () => {
  for (const revoke of [false, true]) {
    let transactions = 0, delivered = 0;
    await assert.rejects(() => createE11Runtime({ flags, transaction: async callback => {
      transactions++;
      if (!revoke && transactions === 2) throw Object.assign(new Error("delivery failure"), { code: "40001" });
      return callback(identityTx([], revoke && transactions === 2 ? 2 : 1));
    } }).run(() => e11Execute({
      userId: 7, sessionId: "session", capability: null, readOnly: true,
      work: async () => "protected", parse: String, deliver: () => { delivered++; },
    })));
    assert.equal(transactions, 2); assert.equal(delivered, 0);
  }
});