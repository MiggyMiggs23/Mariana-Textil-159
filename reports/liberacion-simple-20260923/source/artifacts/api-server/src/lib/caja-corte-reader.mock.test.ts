/** OFFLINE: transpile source into an allowlisted VM; never import @workspace/db. */
import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import * as ledger from "./caja-cash-ledger";

const source = readFileSync(new URL("./caja-corte-reader.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
function harness(rows: Record<string, unknown[]>) {
  const calls: string[] = [];
  const conditions: unknown[] = [];
  const tables = Object.fromEntries(["auditoriaTable", "cobrosCreditoPendientesE1Table", "movimientosCreditoTable",
    "ticketPagosTable", "ticketsTable", "salidasDineroCajaTable", "usuariosTable", "proveedoresTable"].map(name => [name, new Proxy({ name }, {
      get: (table, column) => column === "name" ? table.name : `${name}.${String(column)}`,
    })]));
  const database = { select() {
    let table: { name: string };
    const chain = {
      from(value: { name: string }) { table = value; calls.push(table.name); return chain; },
      innerJoin() { return chain; },
      where(condition: unknown) { conditions.push(condition); return Promise.resolve(rows[table.name] ?? []); },
    };
    return chain;
  } };
  const exports: Record<string, any> = {};
  vm.runInNewContext(compiled, {
    exports,
    require(name: string) {
      if (name === "@workspace/db/schema") return tables;
      if (name === "./caja-cash-ledger") return ledger;
      if (name === "drizzle-orm") return { eq: (...args: unknown[]) => ["eq", ...args], and: (...args: unknown[]) => ["and", ...args], inArray: (...args: unknown[]) => ["inArray", ...args] };
      throw new Error(`Forbidden dependency: ${name}`);
    },
  });
  return { read: (session: any, legacy: any) => exports.readSessionCash(database, session, legacy), calls, conditions };
}
const legacy = { efectivoEsperado: "99.00", diferencia: "1.00" };
const session = { id: 7, estado: "CERRADA", fondoInicial: "10.00", efectivoContado: "100.00" };
test("E2 production reader closed legacy consults only close audit, retaining surface data", async () => {
  const h = harness({ auditoriaTable: [{ datos: { efectivoContado: "100.00" } }] });
  assert.deepEqual(await h.read(session, legacy), legacy);
  assert.deepEqual(h.calls, ["auditoriaTable"]);
  assert.match(JSON.stringify(h.conditions), /CERRAR_CAJA/);
  assert.match(JSON.stringify(h.conditions), /sesiones_caja/);
  assert.match(JSON.stringify(h.conditions), /"7"/);
});
test("E2 production reader selects immutable snapshot and rejects malformed snapshots without live queries", async () => {
  const efectivoDesglose = ledger.calculateCash([{ origen: "FONDO_INICIAL", id: "7", folio: null, importe: "10.00", href: null }]);
  const cashSnapshot = { version: "E2", sesionId: 7, efectivoDesglose, efectivoContado: "12.00", diferencia: "2.00" };
  const h = harness({ auditoriaTable: [{ datos: { cashSnapshot } }] });
  assert.equal((await h.read(session, legacy)).efectivoEsperado, "10.00");
  assert.deepEqual(h.calls, ["auditoriaTable"]);
  const broken = harness({ auditoriaTable: [{ datos: { cashSnapshot: null } }] });
  await assert.rejects(broken.read(session, legacy), /snapshot/);
  assert.deepEqual(broken.calls, ["auditoriaTable"]);
});
test("E2 production reader scopes live queries to session and emits only existing document routes", async () => {
  const h = harness({
    ticketPagosTable: [{ id: 1, ticketId: 8, folio: 99, importe: "20.00" }],
    movimientosCreditoTable: [{ id: 2, clienteId: 3, sesionCajaId: 7, naturaleza: "INGRESO_FISICO",
      formaPago: "EFECTIVO", cuentaDestino: "CAJA_FISICA", tipo: "ABONO", importe: "-4.00",
      operacionProductor: "ABONO_ORDINARIO", operacionClave: "operation" }],
    cobrosCreditoPendientesE1Table: [{ sesionCajaId: 7, naturaleza: "INGRESO_FISICO", medio: "EFECTIVO",
      cuentaDestino: "CAJA_FISICA", operacionProductor: "COBRO_PENDIENTE", operacionClave: "pending", importe: "2.00" }],
    salidasDineroCajaTable: [{ id: 9, monto: "1.00", motivo: "Compra de material", createdAt: new Date("2026-09-18T12:00:00Z"), creadoPorId: 4, proveedorId: 5 }],
    usuariosTable: [{ id: 4, nombre: "Persona registrada" }],
    proveedoresTable: [{ id: 5, nombre: "Proveedor registrado" }],
  });
  const result = await h.read({ ...session, estado: "ABIERTA", efectivoContado: null }, legacy);
  assert.equal(result.efectivoEsperado, "35.00");
  assert.equal(result.diferencia, null);
  assert.deepEqual(Array.from(result.efectivoDesglose.documentos, (d: ledger.CashDocument) => d.href),
    [null, "/tickets/8", "/clientes/3/movimientos/2", null, null]);
  assert.equal(h.calls.includes("auditoriaTable"), false);
  assert.equal(h.conditions.length, 6);
  for (const condition of h.conditions.slice(0, 4)) assert.match(JSON.stringify(condition), /sesionCajaId",7/);
  assert.match(JSON.stringify(h.conditions[0]), /VENDIDO/);
  assert.match(JSON.stringify(h.conditions[0]), /EFECTIVO/);
  assert.match(JSON.stringify(h.conditions[3]), /CAJA_FISICA/);
  const salida = result.efectivoDesglose.documentos.find((d: ledger.CashDocument) => d.origen === "SALIDA");
  assert.equal(salida.folio, null);
  assert.equal(salida.evidencia.motivo, "Compra de material");
  assert.equal(salida.evidencia.fecha, "2026-09-18T12:00:00.000Z");
  assert.equal(salida.evidencia.usuarioId, 4);
  assert.equal(salida.evidencia.proveedorId, 5);
  assert.equal(salida.evidencia.usuarioNombre, "Persona registrada");
  assert.equal(salida.evidencia.proveedorNombre, "Proveedor registrado");
  assert.match(JSON.stringify(h.conditions[4]), /usuariosTable.id",\[4\]/);
  assert.match(JSON.stringify(h.conditions[5]), /proveedoresTable.id",\[5\]/);
});