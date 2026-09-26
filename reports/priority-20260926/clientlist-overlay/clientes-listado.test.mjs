import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import test from "node:test";
import ts from "typescript";

// Offline only: evaluate frozen business modules with a query double. Never
// import the workspace DB module, connect, or replace the canonical projector.
const map = JSON.parse(fs.readFileSync(new URL("../../../artifacts/api-server/dist-auditoria-colaborativa-final-20260925/index.mjs.map", import.meta.url)));
const source = name => {
  const index = map.sources.findIndex(path => path.endsWith(`/src/lib/${name}.ts`));
  assert.ok(index >= 0, `Frozen source missing: ${name}`);
  return map.sourcesContent[index];
};
const modules = new Map();
function compile(text, name) {
  const compiled = ts.transpileModule(text, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    reportDiagnostics: true, fileName: `${name}.ts`,
  });
  assert.deepEqual(compiled.diagnostics, [], `Syntax diagnostics: ${name}`);
  const module = { exports: {} };
  const require = path => {
    if (path === "@workspace/db") return { pool: { query() { throw Error("Unexpected DB access"); } } };
    if (path === "drizzle-orm") return { sql() { throw Error("Unexpected transaction access"); } };
    assert.ok(path.startsWith("./"), `Unexpected import ${path}`);
    const key = path.slice(2);
    if (!modules.has(key)) modules.set(key, compile(source(key), key));
    return modules.get(key);
  };
  vm.runInThisContext(`(function(require,module,exports){${compiled.outputText}\n})`, { filename: name })(require, module, module.exports);
  return module.exports;
}
const baseline = compile(source("clientes-listado"), "baseline");
const candidate = compile(fs.readFileSync(new URL("./clientes-listado.ts", import.meta.url), "utf8"), "candidate");
test("actual API source is exactly the frozen-backend replacement", () => {
  assert.equal(
    fs.readFileSync(new URL("../../../artifacts/api-server/src/lib/clientes-listado.ts", import.meta.url), "utf8").trimEnd(),
    fs.readFileSync(new URL("./clientes-listado.ts", import.meta.url), "utf8").trimEnd(),
  );
});
const customers = Array.from({ length: 123 }, (_, n) => ({
  id: n + 1, nombre: n < 3 ? "Árbol 2" : `Cliente ${123 - n}`,
  rfc: n % 7 ? `RFC${n % 19}` : null, telefono: n % 5 ? `55 1234 ${n}` : null,
  limiteCredito: `${(n % 9) * 100}.00`, activo: n % 4 !== 0, esSistema: n === 0,
}));
function database() {
  const calls = [];
  return {
    calls,
    async query(text, values) {
      calls.push({ text, values });
      if (text.includes("FROM clientes WHERE")) {
        const rows = customers.filter(c => values[0] === null || c.activo === values[0])
          .map(c => {
            const row = { ...c };
            if (!text.includes('AS "limiteCredito"')) delete row.limiteCredito;
            return row;
          });
        return { rows };
      }
      if (text.startsWith("WITH events")) return {
        rows: values[0].filter(id => id % 6).map(id => ({
          cliente_id: id, count: (id * 17) % 31,
          last: id % 7 ? new Date(Date.UTC(2025, id % 12, id % 28 + 1)) : null,
        })),
      };
      assert.match(text, /WHERE m.cliente_id=ANY/);
      // Full historical charge/payment/reversal evidence, never page-limited
      // inside a customer ledger. The actual frozen projector computes money.
      const rows = values[0].flatMap(id => {
        const movement = (offset, tipo, importe, day, extra = {}) => ({
          cliente_id: id, id: id * 10 + offset, ticket_id: tipo === "VENTA_CREDITO" ? id : null,
          tipo, importe, created_at: new Date(`2025-01-0${day}T12:00:00Z`),
          fecha_vencimiento: "2025-02-01", dias_plazo: 30, notas: null,
          folio: id, directed_movimiento_id: null, movimiento_origen_id: null,
          metadata: null, prevent_implicit_favor: false, immutable_applied_cents: 0,
          explicit_favor_applications: [], ...extra,
        });
        return [
          movement(1, "ABONO", "25.00", 1),
          movement(2, "VENTA_CREDITO", `${id % 10 * 10}.00`, 2),
          movement(3, "ABONO", "5.00", 3),
          ...(id % 2 ? [movement(4, "REVERSO", "5.00", 4, { movimiento_origen_id: id * 10 + 3 })] : []),
        ];
      });
      return { rows };
    },
  };
}

test("candidate is output-identical for every sort, direction, permission and page", async () => {
  for (const financial of [true, false]) {
    for (const sort of ["nombre", "rfc", "telefono", "limiteCredito", "saldoActual", "movementCount", "lastActivity", undefined, "unknown"]) {
      for (const direction of ["asc", "desc"]) {
        for (const page of [1, 2, 3, 4]) {
          const input = { sort, direction, page, pageSize: 50 };
          assert.deepEqual(
            await candidate.readClientesListado(database(), input, financial, [7]),
            await baseline.readClientesListado(database(), input, financial, [7]),
            JSON.stringify({ financial, ...input }),
          );
        }
      }
    }
  }
});

test("search, active status, period, empty page and SQL semantics stay unchanged", async () => {
  for (const q of ["", "árbol", "Cliente 2", "RFC3", "(55) 1234", "no match"]) {
    for (const active of [undefined, "true", "false"]) {
      for (const period of ["all", "1m", "3m", "1y"]) {
        const input = { q, active, period, sort: "nombre", direction: "asc", page: 1, pageSize: 7 };
        assert.deepEqual(
          await candidate.readClientesListado(database(), input, true, null),
          await baseline.readClientesListado(database(), input, true, null),
        );
        assert.deepEqual(candidate.activityReadQuery([2, 8], [7], period), baseline.activityReadQuery([2, 8], [7], period));
      }
    }
  }
});

test("master sorts hydrate only displayed IDs; derived sorts still hydrate all matches", async () => {
  for (const sort of ["nombre", "rfc", "telefono", "limiteCredito", "saldoActual", "movementCount", "lastActivity"]) {
    const db = database();
    const result = await candidate.readClientesListado(db, { sort, page: 2, pageSize: 50 }, true, [7]);
    const master = ["nombre", "rfc", "telefono", "limiteCredito"].includes(sort);
    assert.equal(db.calls.length, 3);
    const [activity, ledger] = db.calls.slice(1);
    assert.equal(ledger.values[0].length, master ? 50 : 123);
    assert.deepEqual(activity.values[0], ledger.values[0]);
    assert.deepEqual(activity.values[1], [7]);
    assert.equal(ledger.values.length, 1, "ledger has only IDs, no period/site cut");
    if (master) assert.deepEqual(ledger.values[0], result.items.map(row => row.id));
    assert.equal(result.total, 123);
    const original = database();
    await baseline.readClientesListado(original, { sort, page: 2, pageSize: 50 }, true, [7]);
    assert.equal(ledger.text, original.calls[2].text, "canonical ledger SQL identical");
  }
  const empty = database();
  await candidate.readClientesListado(empty, { sort: "nombre", page: 4 }, true, null);
  assert.equal(empty.calls.length, 1);
  const operational = database();
  await candidate.readClientesListado(operational, { sort: "saldoActual" }, false, [7]);
  assert.equal(operational.calls.length, 1);
});

test("pagination partitions global derived ordering without missing/duplicate clients or page-local totals", async () => {
  for (const sort of ["nombre", "saldoActual", "movementCount", "lastActivity"]) {
    for (const direction of ["asc", "desc"]) {
      const expected = await baseline.readClientesListado(database(), { sort, direction, page: 1, pageSize: 123 }, true, [7]);
      const ids = [];
      for (let page = 1; page <= 7; page++) {
        const input = { sort, direction, page, pageSize: 23 };
        const actual = await candidate.readClientesListado(database(), input, true, [7]);
        assert.equal(actual.total, 123);
        assert.equal(actual.page, page);
        assert.equal(actual.pageSize, 23);
        assert.deepEqual(actual, await baseline.readClientesListado(database(), input, true, [7]));
        assert.equal(actual.items.length, page <= 5 ? 23 : page === 6 ? 8 : 0);
        ids.push(...actual.items.map(row => row.id));
      }
      assert.equal(new Set(ids).size, 123);
      assert.deepEqual(ids, expected.items.map(row => row.id));
    }
  }
});

test("derived and default sorts never apply a customer page limit before hydration, even on empty pages", async () => {
  for (const sort of [undefined, "saldoActual", "movementCount", "lastActivity", "unknown"]) {
    const db = database();
    const result = await candidate.readClientesListado(db, { sort, page: 999, pageSize: 1 }, true, null);
    assert.equal(result.items.length, 0);
    assert.equal(result.total, 123);
    assert.equal(db.calls.length, 3);
    assert.equal(db.calls[2].values[0].length, 123);
  }
});

test("query failures remain explicit, not empty results or zero financial fallbacks", async () => {
  for (const failAt of [1, 2, 3]) {
    const db = database();
    const query = db.query.bind(db);
    let count = 0;
    db.query = async (...args) => {
      if (++count === failAt) throw new Error(`read-failure-${failAt}`);
      return query(...args);
    };
    await assert.rejects(
      candidate.readClientesListado(db, { sort: "nombre" }, true, [7]),
      new RegExp(`read-failure-${failAt}`),
    );
  }
});

test("reproducible offline projection benchmark (not browser/API latency)", { skip: process.env.CLIENTLIST_OFFLINE_BENCHMARK !== "1" }, async () => {
  const repetitions = 100;
  const measure = async (implementation, sort) => {
    // Same deterministic fixture, complete canonical projector, no DB I/O.
    for (let i = 0; i < 10; i++) await implementation.readClientesListado(database(), { sort, page: 1, pageSize: 50 }, true, [7]);
    const start = performance.now();
    for (let i = 0; i < repetitions; i++) await implementation.readClientesListado(database(), { sort, page: 1, pageSize: 50 }, true, [7]);
    return (performance.now() - start) / repetitions;
  };
  for (const sort of ["nombre", "saldoActual", "movementCount", "lastActivity"]) {
    console.log(JSON.stringify({
      kind: "offline-fixture-projection-only", customers: 123, pageSize: 50, sort, repetitions,
      baselineMeanMs: await measure(baseline, sort),
      candidateMeanMs: await measure(candidate, sort),
      provesTwoSecondTarget: false,
    }));
  }
});