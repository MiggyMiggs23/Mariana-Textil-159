import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import test from "node:test";
import ts from "typescript";
import type * as Generated from "../api-zod/src/generated/api";

// Evaluates only generated Zod, with no DB/app imports. Mutants affect in-memory
// source only; generated files and OpenAPI remain untouched during defect proofs.
let source = readFileSync(new URL("../api-zod/src/generated/api.ts", import.meta.url), "utf8");
const mutants: Record<string, [string, string]> = {
  "required-site": ['"sitioOrigenId": zod.number().min(1).multipleOf(createClientePagoBodySitioOrigenIdMultipleOf),', '"sitioOrigenId": zod.number().min(1).multipleOf(createClientePagoBodySitioOrigenIdMultipleOf).optional(),'],
  "integer-site": ['.multipleOf(createClientePagoBodySitioOrigenIdMultipleOf)', ''],
  "required-key": ['"operacionClave": zod.string().regex(createClientePagoBodyOperacionClaveRegExp),', '"operacionClave": zod.string().regex(createClientePagoBodyOperacionClaveRegExp).optional(),'],
  "uuid-format": ['"operacionClave": zod.string().regex(createClientePagoBodyOperacionClaveRegExp),', '"operacionClave": zod.string(),'],
  "fourth-nature": ["'OPERACION_CREDITO_SIN_DINERO'", "'OPERACION_CREDITO_SIN_MOVIMIENTO'"],
  "attribution-date": ['"movimientoCreatedAt": zod.string()', '"movimientoCreatedAt": zod.coerce.date()'],
  "snapshot-origin": ['"movimiento_origen_id": zod.number().multipleOf(atribuirClienteCreditoBodyIdentidadSnapshotMovimientoOrigenIdMultipleOf).nullable()', '"movimiento_origen_id": zod.number().multipleOf(atribuirClienteCreditoBodyIdentidadSnapshotMovimientoOrigenIdMultipleOf).nullish()'],
};
if (process.env.E1_SCHEMA_MUTANT) {
  const mutation = mutants[process.env.E1_SCHEMA_MUTANT];
  assert.ok(mutation && source.includes(mutation[0]), "Unknown or stale schema mutant");
  source = source.replaceAll(mutation[0], mutation[1]);
}
const exportsObject: Record<string, unknown> = {};
const requireZod = createRequire(new URL("../api-zod/package.json", import.meta.url));
runInNewContext(ts.transpileModule(source, { compilerOptions: {
  module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
} }).outputText, { exports: exportsObject, require: (name: string) => {
  assert.equal(name, "zod", "Generated contract must never load runtime/server dependencies");
  return requireZod(name);
} });
const generated = exportsObject as typeof Generated;
const evidence = { sitioOrigenId: 3, naturaleza: "INGRESO_FISICO", operacionClave: "706b124d-92aa-44b2-94ef-586a45ad412c" };

test("E1 generated payment schema rejects omitted origin/key and malformed UUID", () => {
  const body = { ...evidence, importe: 20, formaPago: "TRANSFERENCIA", cuentaDestino: "CUENTA_FISCAL" };
  assert.equal(generated.CreateClientePagoBody.safeParse(body).success, true);
  for (const key of ["sitioOrigenId", "naturaleza", "operacionClave"]) {
    const missing: Record<string, unknown> = { ...body };
    delete missing[key];
    assert.equal(generated.CreateClientePagoBody.safeParse(missing).success, false, key);
  }
  assert.equal(generated.CreateClientePagoBody.safeParse({ ...body, operacionClave: "not-a-uuid" }).success, false);
  assert.equal(generated.CreateClientePagoBody.safeParse({ ...body, sitioOrigenId: 3.5 }).success, false);
  assert.equal(generated.CreateClientePagoBody.safeParse({ ...body, sesionCajaId: 2.5 }).success, false);
  assert.equal(generated.CreateClientePagoBody.safeParse({ ...body, notaOrigenId: 9.5 }).success, false);
});

test("E1 generated POS contract has exactly the four SQL nature values", () => {
  const sql = readFileSync(new URL("../../reports/e1-ensayo-2026-09-17/operativo-propuesto/01.sql", import.meta.url), "utf8");
  const enumStatement = sql.slice(sql.indexOf("CREATE TYPE public.naturaleza_credito_e1"), sql.indexOf("-- S10"));
  const sqlValues = [...enumStatement.matchAll(/'([^']+)'/g)].map(match => match[1]);
  assert.equal(sqlValues.length, 4);
  assert.deepEqual(Array.from(generated.AutorizarNotaBody.shape.naturaleza.options), sqlValues);
  assert.equal(generated.AutorizarNotaBody.safeParse({ ...evidence, naturaleza: sqlValues[3] }).success, true);
  assert.equal(generated.AutorizarNotaBody.safeParse({ ...evidence, naturaleza: "UNKNOWN" }).success, false);
});

test("E1 generated attribution schema retains exact microseconds and full snapshot", () => {
  const body = {
    movimientoId: 9, movimientoCreatedAt: "2026-09-15 12:13:14.123456+00",
    identidadSnapshot: { cliente_id: 2, tipo: "ABONO", importe: -20, ticket_id: null, movimiento_origen_id: null },
    sitioOrigenId: 3, evidencia: "Documento", motivo: "Origen demostrado", anteriorId: null,
  };
  const parsed = generated.AtribuirClienteCreditoBody.parse(body);
  assert.equal(parsed.movimientoCreatedAt, body.movimientoCreatedAt);
  const missing = { ...body, identidadSnapshot: { cliente_id: 2, tipo: "ABONO", importe: -20, ticket_id: null } };
  assert.equal(generated.AtribuirClienteCreditoBody.safeParse(missing).success, false);
});