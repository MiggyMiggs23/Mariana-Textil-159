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
  posAbsolute: ['if (ticket.documentoTipo !== "TICKET") {', 'if (false) {'],
  posLedger: [
    "if (afterProjection.balanceCents > limite) {",
    "if (afterProjection.balanceCents - money(input.aplicarSaldoAFavor ?? 0) > limite) {",
  ],
};

// No native production import is allowed: every runtime dependency must be
// explicitly supplied. In particular @workspace/db is never resolved.
export function sourceModule(path, dependencies = {}) {
  let source = readFileSync(new URL(path, root), "utf8");
  const mutant = globalThis[Symbol.for("tarea3.mutation")];
  const target = {
    state: "routes/clientes.ts",
    payment: "routes/clientes.ts",
    evidence: "generated/api.ts",
    cash: "lib/credit-evidence-contract.ts",
    posAbsolute: "lib/pos.ts",
    posLedger: "lib/pos.ts",
  }[mutant];
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

export function posOperations() {
  const prefix = "artifacts/api-server/src/";
  const date = sourceModule(`${prefix}lib/date-only.ts`);
  const allocation = sourceModule(`${prefix}lib/credit-allocation.ts`, { "./date-only": date });
  const remateSale = sourceModule(`${prefix}lib/tarea4-remate-sale.ts`);
  const tables = Object.fromEntries([
    "auditoriaTable", "autorizacionesNotaTable", "aplicacionesCreditoTable",
    "clientesTable", "movimientosCreditoTable", "notificacionesCreditoTable",
    "movimientosTable", "productosTable", "rollosTable", "sesionesCajaTable",
    "sesionesCajaDiasTable", "salidasTable", "salidasDineroCajaTable",
    "proveedoresTable", "ticketFolioTable", "ticketLineasTable",
    "ticketPagosTable", "ticketsTable", "ubicacionesTable", "usuariosTable",
    "viajeTicketsTable", "viajesTable",
  ].map((name) => [name, new Proxy({ __name: name }, {
    get(target, property) {
      return property in target ? target[property] : `${name}.${String(property)}`;
    },
  })]));
  const noop = () => {};
  const deps = {
    "drizzle-orm": {
      and: (...values) => values,
      asc: noop,
      count: noop,
      desc: noop,
      eq: (...values) => values,
      inArray: (...values) => values,
      isNull: noop,
      or: (...values) => values,
      sql: Object.assign(noop, { join: noop }),
    },
    "./caja-corte-reader": { readSessionCash: noop },
    "./caja-cash-ledger": { cashCents: noop, cashMoney: noop },
    "./credit-allocation": allocation,
    "./inventario": {
      consumirBolsasFifo: noop,
      consumirRollosMetreadoSeleccionados: noop,
      DOCUMENTO_TICKET_BOLSA_METREADO: "fixture",
      DOCUMENTO_TICKET_BOLSA_NORMAL: "fixture",
      DOCUMENTO_TICKET_PIEZA_NORMAL: "fixture",
      InventarioError: Error,
      lockInventoryPairs: noop,
      revertirMovimiento: noop,
      venderRollo: noop,
    },
    "./unit-cost": { isValidUnitCost: noop, rollWithoutValidUnitCostMessage: noop },
    "./clientes-aging": {
      deriveTicketCreditData: noop,
      deriveEstadoNota: noop,
      creditDueDate: noop,
      isCreditTerm: (days) => Number.isInteger(days) && days > 0,
    },
    "@workspace/scanned-code": { interpretarCodigoEscaneado: noop },
    "@workspace/metered-pricing": { meteredPriceTier: noop, suggestedMeteredPrice: noop },
    "@workspace/number-format": { ACCOUNT_DESTINATION_ORDER: [] },
    "@workspace/db/advisory-locks": {
      ADVISORY_LOCK_NAMESPACES: { CUSTOMER_CREDIT: 1 },
      transactionAdvisoryLock: async () => {},
    },
    "./metered-reference-cost": { meteredReferenceCost: noop },
    "./iva": { IVA_RATE_BASIS_POINTS: 1600 },
    "./salida-venta-reservation": { assertNoActiveVentaClienteReservation: noop },
    "./supplier-trace": { recordTicketLineConsumption: noop, reverseTicketLineConsumptions: noop },
    "./tarea4-gates": { REMATE_RELEASED: false },
    "./tarea4-remate-sale": remateSale,
  };

  function load(ticket, options = {}) {
    const calls = [];
    let ledgerReads = 0;
    const creditEvidence = {
      readCreditEvidenceInput: (value) => value,
      assertCreditEvidenceAccess: async () => calls.push("evidence-access"),
      assertCreditEvidenceScope: async () => calls.push("evidence-scope"),
      claimCreditOperation: async () => ({ replay: false }),
      insertCreditMovementE1: async (_tx, values) => {
        calls.push({ movement: values });
        return { id: 500 };
      },
      CreditEvidenceError: class CreditEvidenceError extends Error {},
    };
    const originalLedger = [
      {
        id: 10, ticketId: 10, tipo: "VENTA_CREDITO", importe: options.existingCharge ?? "90.00",
        createdAt: new Date("2026-01-01T12:00:00Z"), fechaVencimiento: "2026-02-01",
      },
      {
        id: 11, ticketId: null, tipo: "ABONO", importe: "-20.00",
        createdAt: new Date("2026-01-02T12:00:00Z"),
      },
    ];
    const authorizedLedger = [...originalLedger, {
      id: 500, ticketId: ticket.id, tipo: "VENTA_CREDITO", importe: ticket.total,
      createdAt: new Date("2026-01-03T12:00:00Z"),
      fechaVencimiento: ticket.fechaVencimiento, diasPlazo: ticket.diasPlazo,
    }];
    const rows = options.flow === "charge"
      ? [
          [ticket],
          [{ id: 31, estado: "ABIERTA", cerradaAt: null, ubicacionId: ticket.ubicacionId }],
          [],
          [],
        ]
      : [
          [ticket],
          [{ id: 31, estado: "ABIERTA", cerradaAt: null, ubicacionId: ticket.ubicacionId }],
          [{
            id: ticket.clienteId,
            activo: true,
            esSistema: false,
            limiteCredito: options.creditLimit ?? "100.00",
            nombre: "Cliente fixture",
          }],
          [{ nombre: "Cajero fixture" }],
          [{ nombre: "Tienda fixture" }],
          [],
        ];
    let selected = 0;
    const tx = {
      select() {
        const chain = {
          from: () => chain,
          innerJoin: () => chain,
          leftJoin: () => chain,
          where: () => chain,
          for: () => chain,
          limit: async () => rows[selected++] ?? [],
          orderBy: async () => rows[selected++] ?? [],
        };
        return chain;
      },
      insert(table) {
        return {
          values: async (values) => {
            calls.push({ insert: table.__name, values });
            return [];
          },
        };
      },
      update() {
        const chain = {
          set: (values) => {
            calls.push({ update: values });
            return chain;
          },
          where: async () => [],
        };
        return chain;
      },
    };
    const runtimeDeps = {
      ...deps,
      "@workspace/db": { ...tables, db: {} },
      "./credit-evidence": creditEvidence,
      "./credit-aging-read-model": {
        loadCustomerCreditLedgerInTransaction: async (clienteId, receivedTx) => {
          assert.equal(clienteId, ticket.clienteId);
          assert.equal(receivedTx, tx);
          calls.push("ledger");
          return ledgerReads++ === 0 ? originalLedger : authorizedLedger;
        },
      },
      "./salidas": {
        consumirRollosSalidaVenta: async () => calls.push("inventory-consumed"),
      },
    };
    const pos = sourceModule(`${prefix}lib/pos.ts`, runtimeDeps);
    return { pos, tx, calls, options };
  }

  const request = (userId) => ({ auth: { user: { id: userId } } });
  const authorizeInput = (ticketId, aplicarSaldoAFavor) => ({
    ticketId,
    sesionCajaId: 31,
    usuarioId: 7,
    ip: "127.0.0.1",
    aplicarSaldoAFavor,
    creditEvidence: {
      sitioOrigenId: 1,
      naturaleza: "CREDITO_OTORGADO",
      operacionClave: "11111111-1111-4111-8111-111111111111",
    },
    creditRequest: request(7),
  });
  return {
    ticket(overrides = {}) {
      return {
        id: 52, folio: 1052, estado: "VENDIDO", cobrado: false,
        documentoTipo: "TICKET", credito: false, ubicacionId: 1, clienteId: 41,
        subtotal: "40.00", iva: "0.00", total: "40.00",
        diasPlazo: null, fechaVencimiento: null, autorizacionEstado: null,
        ...overrides,
      };
    },
    load,
    authorizeInput,
  };
}

export function cajaActionsFor(ticket) {
  const path = "artifacts/mariana-textil/src/pages/cobros.tsx";
  const source = readFileSync(new URL(path, root), "utf8");
  const file = ts.createSourceFile(path, source, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TSX);
  const branches = [];
  const text = (node) => node.getText(file);
  const evaluate = (node) => {
    if (ts.isParenthesizedExpression(node)) return evaluate(node.expression);
    if (ts.isPrefixUnaryExpression(node) && node.operator === ts.SyntaxKind.ExclamationToken) {
      return !evaluate(node.operand);
    }
    if (ts.isPropertyAccessExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === "t") {
      return ticket[node.name.text];
    }
    if (ts.isStringLiteral(node)) return node.text;
    if (node.kind === ts.SyntaxKind.TrueKeyword) return true;
    if (node.kind === ts.SyntaxKind.FalseKeyword) return false;
    if (ts.isBinaryExpression(node)) {
      if (node.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken) {
        return Boolean(evaluate(node.left) && evaluate(node.right));
      }
      if (node.operatorToken.kind === ts.SyntaxKind.EqualsEqualsEqualsToken) {
        return evaluate(node.left) === evaluate(node.right);
      }
    }
    throw new Error(`Unsupported Caja action condition: ${text(node)}`);
  };
  const visit = (node) => {
    if (ts.isJsxElement(node) && text(node.openingElement.tagName) === "Button") {
      const label = node.children
        .filter(ts.isJsxText)
        .map((child) => child.text.trim())
        .filter(Boolean)
        .join(" ");
      if (label === "Cobrar" || label === "Autorizar") {
        let parent = node.parent;
        while (parent && !ts.isJsxExpression(parent)) parent = parent.parent;
        if (!parent?.expression || !ts.isBinaryExpression(parent.expression)) {
          ts.forEachChild(node, visit);
          return;
        }
        const condition = parent.expression.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken
          ? parent.expression.left
          : parent.expression;
        branches.push({ label, condition });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  assert.equal(branches.length, 2, "the Caja feed exposes exactly the two document actions");
  return branches
    .filter(({ condition }) => evaluate(condition))
    .map(({ label }) => label);
}