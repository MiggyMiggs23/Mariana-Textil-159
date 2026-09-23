/** OFFLINE: production analytics source in VM; all dependencies allowlisted/stubbed. */
import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import * as ledger from "./caja-cash-ledger";
const source = readFileSync(new URL("./admin-analytics.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;

test("E2 admin resolves canonical differences and totals before pagination, preserving legacy admin", async () => {
  const rows = [1, 2, 3].map(id => ({
    id, estado: id === 3 ? "CERRADA" : "ABIERTA", fondoInicial: "100.00", efectivoEsperado: "100.00",
    efectivoContado: "100.00", diferencia: "0.00", vendido: "15.00", totalCobrado: "12.00",
    ticketsCobrados: 1, ticketsCancelados: 0, abiertaAt: "2026-09-18T10:00:00.000Z", cerradaAt: null,
  }));
  rows[2]!.diferencia = "10.00";
  rows[2]!.efectivoEsperado = "90.00"; // Deliberate legacy surface value.
  let sql = "";
  const resolved: number[] = [];
  const exports: Record<string, any> = {};
  const dependencies: Record<string, unknown> = {
    "@workspace/db": { db: {}, pool: { async query(query: string) { sql = query; return { rows }; } } },
    "./caja-corte-reader": { async readSessionCash(_db: unknown, row: typeof rows[number], legacy: unknown) {
      resolved.push(row.id);
      if (row.estado === "CERRADA") return legacy;
      return { efectivoEsperado: row.id === 1 ? "100.00" : "80.00", diferencia: row.id === 1 ? "0.00" : "20.00" };
    } },
    "./caja-cash-ledger": ledger,
    "./accounted-document": {}, "@workspace/number-format": {}, "./mexico-date": {}, "./date-only": {},
    "./store-order": {}, "./realtime-cancellations": {},
  };
  vm.runInNewContext(compiled, { exports, require(name: string) {
    if (!(name in dependencies)) throw new Error(`Forbidden dependency: ${name}`);
    return dependencies[name];
  } });
  const result = await exports.listCuts({}, 2, 1, { soloConDiferencia: true });
  assert.deepEqual(resolved, [1, 2, 3]);
  assert.equal(result.total, 2);
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].id, 3);
  assert.equal(result.items[0].efectivoEsperado, "90.00");
  assert.equal(result.totales.efectivoEsperado, "170.00");
  assert.equal(result.totales.diferencia, "30.00");
  assert.equal(result.totales.vendido, "30.00");
  assert.equal(result.totales.cobrado, "24.00");
  assert.equal(result.totales.tickets, 2);
  assert.doesNotMatch(sql, /LIMIT|OFFSET|NOT \$6/);
});