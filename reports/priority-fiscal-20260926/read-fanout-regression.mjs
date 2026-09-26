import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const esbuild = require("../../artifacts/api-server/node_modules/esbuild");
const root = path.resolve("artifacts/api-server/src");
const v6 = JSON.parse(fs.readFileSync("artifacts/api-server/dist-priority-stability-combined-v6-20260926/index.mjs.map"));
const frozen = new Map(v6.sources.map((p, i) => [path.resolve("artifacts/api-server/dist-priority-stability-combined-v6-20260926", p), v6.sourcesContent[i]]));
const clients = Array.from({ length: 103 }, (_, i) => ({ id: i + 1, nombre: `Customer ${i}`, limiteCredito: "1000.00" }));
function fixture(candidate) {
  let active = 0, peak = 0;
  const calls = [], selections = [];
  const cache = new Map();
  const ledger = id => [
    { id: id * 10, tipo: "VENTA_CREDITO", ticketId: id, importe: "100.00", createdAt: new Date("2025-01-01T12:00:00Z"), fechaVencimiento: "2025-01-10" },
    { id: id * 10 + 1, tipo: "ABONO", ticketId: null, importe: "-40.00", createdAt: new Date("2025-01-05T12:00:00Z") },
  ];
  const db = { select() {
    let filter;
    const query = { from() { return query; }, orderBy() { return query; },
      where(value) { filter = value; return query; }, limit() { return query; },
      then(resolve, reject) {
        selections.push(filter?.value ?? "ALL");
        return Promise.resolve(filter ? clients.filter(c => c.id === filter.value) : clients).then(resolve, reject);
      } };
    return query;
  } };
  function load(file) {
    if (cache.has(file)) return cache.get(file).exports;
    const module = { exports: {} }; cache.set(file, module);
    const source = candidate ? fs.readFileSync(file, "utf8") : frozen.get(file);
    if (!source) throw Error(`Missing exact source ${file}`);
    const code = esbuild.transformSync(source, { loader: "ts", format: "cjs" }).code;
    const localRequire = spec => {
      if (spec === "@workspace/db") return { db, clientesTable: { id: "id", nombre: "nombre", limiteCredito: "limiteCredito" } };
      if (spec === "drizzle-orm") return { asc: x => x, eq: (column, value) => ({ column, value }) };
      if (spec === "./credit-aging-read-model") return { loadCustomerCreditLedger: async id => {
        calls.push(id); active++; peak = Math.max(peak, active);
        await new Promise(resolve => setTimeout(resolve, 1)); active--; return ledger(id);
      } };
      if (spec.startsWith(".")) return load(path.resolve(path.dirname(file), `${spec}.ts`));
      throw Error(`Unexpected dependency ${spec}`);
    };
    vm.runInThisContext(`(function(require,module,exports){${code}\n})`, { filename: file })(localRequire, module, module.exports);
    return module.exports;
  }
  return { api: load(`${root}/lib/payment-behavior.ts`), calls, selections, peak: () => peak };
}
const baseline = fixture(false), candidate = fixture(true);
const oldList = await baseline.api.loadPaymentBehaviorList();
const newList = await candidate.api.loadPaymentBehaviorList();
assert.deepEqual(newList, oldList);
assert.equal(baseline.peak(), clients.length);
assert.equal(candidate.peak(), 3);
const detail = fixture(true);
assert.deepEqual(await detail.api.loadPaymentBehaviorClient(51), newList[50]);
assert.deepEqual(detail.calls, [51]);
assert.deepEqual(detail.selections, [51]);
assert.equal(await detail.api.loadPaymentBehaviorClient(9999), undefined);
assert.deepEqual(detail.calls, [51]);
const result = { status: "PASS", baselinePeak: baseline.peak(), candidatePeak: candidate.peak(),
  listCustomers: clients.length, nonemptyCanonicalProjectionParity: true, detailLedgerCalls: 1,
  unrelatedCustomerLedgers: 0, absentCustomerLedgerCalls: 0 };
async function priceFixture(candidate) {
  let active = 0, peak = 0;
  const cache = new Map(), handlers = new Map();
  const tables = Object.fromEntries(["productos", "rollos", "entradas", "precioHistorial", "auditoria"].map(name =>
    [`${name}Table`, new Proxy({ name }, { get: (target, key) => key === "name" ? name : `${name}.${String(key)}` })]));
  const products = clients.map(c => ({ id: c.id, sku: `SKU${c.id}`, tela: "Cotton", color: "Azul",
    unidad: c.id % 2 ? "METRO" : "KILO", seVendePorMetro: true, activo: c.id % 3 !== 0,
    precioSugerido: c.id % 7 ? "15.25" : null, precioMayoreo: "14.00", precioMenudeo: "16.00" }));
  const db = { select(projection) {
    let table, joined = false;
    const query = { from(t) { table = t.name; return query; }, innerJoin() { joined = true; return query; },
      where() { return query; }, orderBy() { return query; }, limit() { return query; },
      async then(resolve, reject) {
        active++; peak = Math.max(peak, active);
        try {
          await new Promise(r => setTimeout(r, 1));
          const rows = table === "productos" ? products : table === "precioHistorial"
            ? [{ createdAt: new Date("2025-01-10T12:00:00Z") }]
            : joined ? [
              { rollId: 1, costPerUnit: "10.25", receptionDate: new Date("2025-01-01T12:00:00Z") },
              { rollId: 2, costPerUnit: "12.75", receptionDate: new Date("2025-02-01T12:00:00Z") },
            ] : [
              { cantidadActual: "20.50", costoUnitario: "10.25", estado: "DISPONIBLE" },
              { cantidadActual: "10.25", costoUnitario: "12.75", estado: "DISPONIBLE" },
            ];
          active--; return resolve(rows);
        } catch (e) { active--; return reject(e); }
      } };
    return query;
  } };
  const router = { use() {}, get(route, ...args) { handlers.set(route, args.at(-1)); }, post() {}, patch() {}, put() {} };
  const chain = new Proxy(() => chain, { get: (_t, key) => key === "parse" ? value => value
    : key === "safeParse" ? data => ({ success: true, data }) : chain });
  function load(file) {
    if (cache.has(file)) return cache.get(file).exports;
    const module = { exports: {} }; cache.set(file, module);
    const source = candidate ? fs.readFileSync(file, "utf8") : frozen.get(file);
    if (!source) throw Error(`Missing price source ${file}`);
    const localRequire = spec => {
      if (spec === "@workspace/db" || spec === "@workspace/db/schema") return { ...tables, db };
      if (spec === "express") return { Router: () => router };
      if (spec === "zod") return { z: chain };
      if (spec === "@workspace/api-zod") return chain;
      if (spec === "drizzle-orm") return Object.fromEntries(["and", "desc", "eq", "ilike", "or", "sql", "lte"].map(n => [n, (...args) => args]));
      if (spec === "@workspace/db/advisory-locks") return {};
      if (spec.endsWith("/middlewares/auth")) return { requireSession() {} };
      if (spec.endsWith("/lib/permisos")) return { requierePermiso: () => () => {} };
      if (spec.endsWith("/lib/request")) return {};
      if (spec.endsWith("/lib/tarea4-gates")) return { PRICE_FLOOR_RELEASED: false };
      if (spec.endsWith("/lib/tarea4-price-floor")) return {};
      if (spec.startsWith(".")) return load(path.resolve(path.dirname(file), `${spec}.ts`));
      throw Error(`Unexpected price dependency ${spec}`);
    };
    const code = esbuild.transformSync(source, { loader: "ts", format: "cjs" }).code;
    vm.runInThisContext(`(function(require,module,exports){${code}\n})`, { filename: file })(localRequire, module, module.exports);
    return module.exports;
  }
  load(`${root}/routes/precios.ts`);
  const outputs = [];
  for (const query of [{}, { modoPrecio: "MAYOREO", sinPrecio: true }, { modoPrecio: "MENUDEO", semaforo: "VERDE" }]) {
    await handlers.get("/precios")({ query }, { json: value => outputs.push(value) });
  }
  return { outputs, peak };
}
const oldPrices = await priceFixture(false), newPrices = await priceFixture(true);
assert.deepEqual(newPrices.outputs, oldPrices.outputs);
assert.equal(oldPrices.peak, clients.length * 2);
assert.ok(newPrices.peak <= 6);
Object.assign(result, { priceProducts: clients.length, priceBaselinePeak: oldPrices.peak,
  priceCandidatePeak: newPrices.peak, completePriceDtoFilterOrderParity: true });
fs.writeFileSync("reports/priority-fiscal-20260926/read-fanout-regression.json", JSON.stringify(result, null, 2));
console.log(JSON.stringify(result));