/** Actual service, transpiled in an offline dependency sandbox. No DB import. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import * as contract from "./commercial-return-contract";
import * as allocation from "./credit-allocation";
const source = readFileSync(new URL("./commercial-return.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: {
  module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
} }).outputText;
const request: contract.CommercialReturnRequest = {
  uuidCliente: "e8e03c58-7338-488b-bd9e-6b9ebec5ff73", ticketId: 10, lineaId: 11,
  ubicacionRecepcionId: 2, sesionCajaId: 5, cantidad: "10.000", motivo: "Rollo completo devuelto",
  revision: { importeRollo: "1000.00", deudaCancelada: "200.00", efectivoDevuelto: "800.00" },
};
function harness(options: { gate?: boolean; nature?: string; cash?: string; role?: string; day?: string; multi?: boolean } = {}) {
  const events: string[] = [];
  const ledger: allocation.CreditLedgerMovement[] = [
    { id: 1, tipo: "VENTA_CREDITO", importe: "1000.00", ticketId: 10, createdAt: new Date("2026-09-01T00:00:00Z") },
    { id: 2, tipo: "ABONO", importe: "-800.00", ticketId: null, createdAt: new Date("2026-09-02T00:00:00Z") },
  ];
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Mexico_City" }).format(new Date());
  const rows: Record<string, unknown[]> = {
    usuariosTable: [{ id: 1, rol: options.role ?? "ADMIN", activo: true, alcanceConsulta: "TODAS" }],
    ticketsTable: [{ id: 10, clienteId: 9, ubicacionId: 1, estado: "VENDIDO", documentoTipo: "NOTA",
      autorizacionEstado: "AUTORIZADA", subtotal: "1000.00", iva: "0.00", total: "1000.00" }],
    ubicacionesTable: [{ id: 2, activa: true, tipo: "TIENDA" }],
    sesionesCajaTable: [{ id: 5, ubicacionId: 2, estado: "ABIERTA", cerradaAt: null, fechaOperativa: day }],
    ticketLineasTable: [{ id: 11, ticketId: 10, rolloId: 20, tipo: "NORMAL", cantidad: "10.000", importe: "1000.00" }],
    movimientosCreditoTable: [{ id: 2, tipo: "ABONO", naturaleza: options.nature ?? "INGRESO_FISICO" }],
    rollosTable: [{ id: 20, serie: "10000020" }],
    auditoriaTable: [], salidasDineroCajaTable: [],
  };
  const tables = Object.fromEntries(Object.keys(rows).map(name => [name, { name }]));
  if (options.multi) {
    rows.ticketLineasTable = [
      { id: 11, ticketId: 10, rolloId: 20, tipo: "NORMAL", cantidad: "10.000", importe: "400.00" },
      { id: 12, ticketId: 10, rolloId: 21, tipo: "NORMAL", cantidad: "10.000", importe: "600.00" },
    ];
    rows.rollosTable = [{ id: 20, serie: "10000020" }, { id: 21, serie: "10000021" }];
  }
  const stored: Array<{ actor_id: number; request: contract.CommercialReturnRequest; response: contract.CommercialReturnResult }> = [];
  let nextCreditId = 3;
  let nextReturnId = 1;
  const sql = (parts: TemplateStringsArray, ...values: unknown[]) => ({ text: parts.join("?"), values });
  const tx = {
    async execute(query: { text: string; values: unknown[] }) {
      events.push(query.text.trim().split(/\s+/).slice(0, 3).join(" "));
      if (query.text.includes("SELECT enabled")) return { rows: [{ enabled: options.gate ?? true }] };
      if (query.text.includes("clock_timestamp")) return { rows: [{ day: options.day ?? day }] };
      if (query.text.includes("SELECT actor_id,request,response")) return { rows: stored.filter(row => row.request.uuidCliente === query.values[0]) };
      if (query.text.includes("SELECT linea_id,importe_rollo")) return { rows: stored.map(row => ({
        linea_id: row.response.lineaId, importe_rollo: row.response.importeRollo, efectivo_devuelto: row.response.efectivoDevuelto,
      })) };
      if (query.text.includes("INSERT INTO public.devoluciones_comerciales")) {
        const documents = query.values.filter((value): value is string => typeof value === "string" && value.startsWith("{")).map(value => JSON.parse(value));
        stored.push({ actor_id: 1, request: documents.find(doc => doc.uuidCliente), response: documents.find(doc => doc.createdAt) });
      }
      return { rows: [] };
    },
    select() {
      let name = "";
      let id: number | undefined;
      const chain = {
        from(table: { name: string }) { name = table.name; return chain; },
        where(predicate: { value?: number } | null) { id = predicate?.value; return chain; }, for() { return chain; },
        then(resolve: (value: unknown[]) => unknown) {
          return Promise.resolve(name === "rollosTable" ? rows[name]!.filter(row => (row as { id: number }).id === id) : rows[name]).then(resolve);
        },
      };
      return chain;
    },
    insert(table: { name: string }) {
      return {
        values(value: Record<string, unknown>) {
          events.push(`insert:${table.name}`);
          const id = table.name === "movimientosCreditoTable" ? nextCreditId++ : 40;
          if (table.name === "movimientosCreditoTable") ledger.push({
            id, tipo: "DEVOLUCION_COMERCIAL", importe: String(value.importe), ticketId: 10,
            movimientoOrigenId: 1, createdAt: value.createdAt as Date,
          });
          return { returning: async () => [{ id, ...value }], then: (resolve: (v: unknown) => unknown) => Promise.resolve().then(resolve) };
        },
      };
    },
  };
  const exports: Record<string, any> = {};
  vm.runInNewContext(compiled, { exports, Date, Set, JSON, Intl, Error, require(name: string) {
    if (name === "node:crypto") return { randomUUID: () => `04d6016c-7171-46d1-b03d-${String(nextReturnId++).padStart(12, "0")}` };
    if (name === "drizzle-orm") return { sql, eq: (_field: unknown, value: number) => ({ value }), and: () => null };
    if (name === "@workspace/db") return { ...tables, db: { transaction() { throw new Error("CLOSED must not reach DB"); } } };
    if (name === "@workspace/db/advisory-locks") return { ADVISORY_LOCK_NAMESPACES: {},
      transactionAdvisoryLock: async () => events.push("lock") };
    if (name === "./credit-aging-read-model") return { loadCustomerCreditLedgerInTransaction: async () => ledger };
    if (name === "./credit-allocation") return allocation;
    if (name === "./commercial-return-contract") return contract;
    if (name === "./caja-corte-reader") return { readSessionCash: async () => ({ efectivoEsperado: options.cash ?? "1000.00" }) };
    if (name === "./inventario") return { recibirDevolucionComercial: async (_tx: unknown, input: { validarSolo?: boolean }) => {
      events.push(input.validarSolo ? "inventory-check" : "inventory"); return { id: 50 };
    } };
    throw new Error(`Forbidden dependency: ${name}`);
  } });
  return { events, post: () => exports.postCommercialReturn(1, request, "127.0.0.1"),
    execute: (input = request, preview = false) => exports.commercialReturnInTransaction(tx, 1, input, "127.0.0.1", preview) };
}
test("actual public service gate rejects before any DB access", async () => {
  const h = harness();
  await assert.rejects(h.post(), /no habilitada/);
  assert.deepEqual(h.events, []);
});
test("actual transaction rejects SQL CLOSED, nonADMIN, old day, correction-funded and insufficient cash before inventory", async () => {
  for (const options of [{ gate: false }, { role: "CAJERO" }, { day: "2000-01-01" },
    { nature: "CORRECCION_CONTABLE" }, { cash: "799.99" }]) {
    const h = harness(options);
    await assert.rejects(h.execute());
    assert.equal(h.events.includes("inventory"), false);
    assert.equal(h.events.some(event => event.startsWith("insert:")), false);
  }
});
test("actual service appends inventory, directed debt and cash outflow without editing sale or prior receipts", async () => {
  const h = harness();
  const result = await h.execute();
  assert.equal(result.deudaCancelada, "200.00");
  assert.equal(result.efectivoDevuelto, "800.00");
  assert.equal(result.serie, "10000020");
  assert.equal(result.ubicacionRecepcionId, 2);
  assert.deepEqual(h.events.filter(event => event.startsWith("insert:")), [
    "insert:salidasDineroCajaTable", "insert:movimientosCreditoTable", "insert:auditoriaTable",
  ]);
});
test("actual preview checks full inventory and exact money without financial or evidence INSERT", async () => {
  const h = harness();
  const preview = await h.execute(request, true);
  assert.equal(preview.deudaCancelada, "200.00");
  assert.equal(preview.id, undefined);
  assert.equal(h.events.includes("inventory-check"), true);
  assert.equal(h.events.some(event => event.startsWith("INSERT") || event.startsWith("insert:")), false);
});
test("actual service rejects stale reviewed money before inventory mutation", async () => {
  const h = harness();
  await assert.rejects(h.execute({ ...request, revision: { ...request.revision!, efectivoDevuelto: "799.99" } }), /no coinciden/);
  assert.equal(h.events.includes("inventory"), false);
});
test("actual service supports repeated distinct full-roll returns on the same note, exact replay, and duplicate-line rejection", async () => {
  const h = harness({ multi: true });
  const firstInput = { ...request, revision: { importeRollo: "400.00", deudaCancelada: "80.00", efectivoDevuelto: "320.00" } };
  const first = await h.execute(firstInput);
  const writes = h.events.filter(event => event.startsWith("insert:")).length;
  const replay = await h.execute(JSON.parse(JSON.stringify(firstInput)));
  assert.equal(JSON.stringify(replay), JSON.stringify(first));
  assert.equal(h.events.filter(event => event.startsWith("insert:")).length, writes);
  await assert.rejects(h.execute({ ...firstInput, uuidCliente: "80cd18e6-75f5-4b10-852b-69ad2fdb3a41" }), /ya fue devuelta/);
  const second = await h.execute({ ...request, uuidCliente: "9378aa93-a354-4699-b913-9b2bc3657b54", lineaId: 12,
    revision: { importeRollo: "600.00", deudaCancelada: "120.00", efectivoDevuelto: "480.00" } });
  assert.equal(second.deudaCancelada, "120.00");
  assert.equal(second.efectivoDevuelto, "480.00");
  assert.equal(second.serie, "10000021");
});