import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import ts from "typescript";

const root = new URL("../../../", import.meta.url);
const zod = createRequire(new URL("lib/api-zod/package.json", root))("zod");
const mutations = {
  state: ['return "PAGADA";', 'return "PENDIENTE";'],
  payment: ["          clienteId,\n          pagoId,", "          pagoId,\n          clienteId,"],
  evidence: ['"sitioOrigenId": zod.number().min(1).multipleOf(createClientePagoBodySitioOrigenIdMultipleOf),', '"sitioOrigenId": zod.number().min(1).multipleOf(createClientePagoBodySitioOrigenIdMultipleOf).optional(),'],
  cash: ["export const CREDIT_CASH_INCOME_CAPTURE_ENABLED = false", "export const CREDIT_CASH_INCOME_CAPTURE_ENABLED = true"],
};

// No native production import is allowed: every runtime dependency must be
// explicitly supplied. In particular @workspace/db is never resolved.
export function sourceModule(path, dependencies = {}) {
  let source = readFileSync(new URL(path, root), "utf8");
  const mutant = globalThis[Symbol.for("tarea3.mutation")];
  const target = { state: "routes/clientes.ts", payment: "routes/clientes.ts", evidence: "generated/api.ts", cash: "lib/credit-evidence-contract.ts" }[mutant];
  if (target && path.endsWith(target)) {
    const [before, after] = mutations[mutant];
    assert.equal(source.split(before).length - 1, 1, `unique semantic mutation ${mutant}`);
    source = source.replace(before, after);
  }
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    reportDiagnostics: true,
  });
  assert.equal(output.diagnostics?.length ?? 0, 0);
  const exports = {};
  const require = (id) => {
    if (!Object.hasOwn(dependencies, id)) throw new Error(`Forbidden runtime dependency: ${id}`);
    return dependencies[id];
  };
  vm.runInThisContext(`(function(exports, require) {${output.outputText}\n})`, { filename: path })(exports, require);
  return exports;
}

export function paymentContracts() {
  return sourceModule("lib/api-zod/src/generated/api.ts", { zod });
}
export function captureGuard() {
  return sourceModule("artifacts/api-server/src/lib/credit-evidence-contract.ts");
}

export function clientRoutes(balance = 10000) {
  const prefix = "artifacts/api-server/src/";
  const date = sourceModule(`${prefix}lib/date-only.ts`);
  const allocation = sourceModule(`${prefix}lib/credit-allocation.ts`, { "./date-only": date });
  const aging = sourceModule(`${prefix}lib/clientes-aging.ts`, { "./date-only": date, "./credit-allocation": allocation });
  const handlers = new Map();
  const noop = () => {};
  const router = { use: noop };
  for (const method of ["get", "post", "patch", "delete", "put"]) {
    router[method] = (path, ...chain) => handlers.set(`${method} ${path}`, chain.at(-1));
  }
  const calls = [];
  const abono = { movimientoPagoId: "81", fecha: "2026-01-02T12:00:00Z", montoAplicado: "25.00", montoTotalAbono: "40.00", formaPago: "TRANSFERENCIA", cuentaDestino: "CUENTA_FISCAL", referencia: "fixture", usuarioRegistrador: "Fixture", revertido: false };
  let queryCount = 0;
  const snapshot = { query: async () => ({ rows: [] }), release: () => calls.push("release") };
  const pool = {
    query: async (_text, params) => {
      calls.push(params);
      // Scripted adapter responses, never SQL parsing or execution.
      return { rows: queryCount++ === 0
        ? [{ movimientoVentaId: 72, importeOriginal: "100.00", fechaVencimiento: "2099-01-01" }]
        : [abono] };
    },
    connect: async () => snapshot,
  };
  const detail = { id: 81, clienteId: 41, asignaciones: [{ ticketId: 52, movimientoVentaId: 72, importeAplicado: "25.00" }] };
  const deps = {
    express: { Router: () => router },
    exceljs: {},
    "drizzle-orm": {},
    "@workspace/api-zod": {
      GetClienteNotaCreditoResponse: { parse: (value) => value },
      GetClientePagoDetalleResponse: { parse: (value) => value },
    },
    "@workspace/db": { pool, db: {} },
    "@workspace/db/advisory-locks": {},
    "../lib/credit-allocation": allocation,
    "../middlewares/auth": { requireSession: noop },
    "../lib/permisos": { requierePermiso: () => noop },
    "../lib/clientes-aging": aging,
    "../lib/date-only": date,
    "../lib/credit-aging-read-model": { loadCustomerCreditProjection: async (id) => {
      assert.equal(id, 41);
      return { allCharges: [{ movimientoId: 72, pendienteCents: balance }] };
    } },
    "../lib/pos": { buildTicketDetail: async (_db, id) => {
      assert.equal(id, 52);
      return { id, clienteId: 41 };
    } },
    "../lib/credit-movement-detail": { buildCreditMovementDetail: async (db, clienteId, pagoId) => {
      assert.equal(db, snapshot);
      calls.push({ clienteId, pagoId });
      return detail;
    } },
  };
  for (const id of [
    "../lib/request", "../lib/pdf", "../lib/clientes-create",
    "@workspace/number-format", "../lib/spanish-order", "../lib/iva",
    "../lib/accounted-document", "../lib/payment-behavior", "../lib/fecha-efectiva",
    "../lib/clientes-cartera-read-model", "../lib/clientes-financial-read-scope",
    "../lib/clientes-cartera-export", "./inventario", "../lib/credit-evidence",
    "../lib/credit-abono-evidence",
  ]) deps[id] = {};
  sourceModule(`${prefix}routes/clientes.ts`, deps);
  return {
    calls, detail,
    async get(path, params) {
      let body;
      const res = { json: (value) => { body = value; }, status: () => res };
      const handler = handlers.get(`get ${path}`);
      assert.ok(handler, `mounted GET ${path}`);
      await handler({ params }, res, (error) => { throw error; });
      return body;
    },
  };
}