import assert from "node:assert/strict";
import { test } from "node:test";
import {
  hasOutstandingSuccessors, physicalRollState, readPhysicalRollState, samePhysicalRollState,
  type PhysicalRollState,
} from "./inventory-reversal-evidence";

const state: PhysicalRollState = {
  id: 1, productoId: 2, ubicacionId: 3, pisoId: null,
  estado: "DISPONIBLE", cantidadActual: "10.000",
};

test("strict physical evidence validates decimal quantity and every identity dimension", () => {
  assert.deepEqual(readPhysicalRollState(physicalRollState(state)), state);
  assert.equal(samePhysicalRollState(state, { ...state, cantidadActual: "10" }), true);
  for (const change of [
    { id: 9 }, { productoId: 9 }, { ubicacionId: 9 }, { pisoId: 9 },
    { estado: "BAJA" as const }, { cantidadActual: "9.999" },
  ]) assert.equal(samePhysicalRollState(state, { ...state, ...change }), false);
  for (const invalid of [
    null, {}, { ...state, estado: "INVALID" }, { ...state, cantidadActual: "-2" },
    { ...state, cantidadActual: "10.0001" }, { ...state, cantidadActual: "NaN" },
    { ...state, pisoId: undefined }, { ...state, productoId: "2" },
  ]) assert.equal(readPhysicalRollState(invalid), null);
});

test("later movement with identical physical totals remains a dependency", () => {
  assert.equal(hasOutstandingSuccessors([
    { id: 2, tipo: "AJUSTE_POSITIVO", movimientoOrigenId: null },
    { id: 3, tipo: "AJUSTE_NEGATIVO", movimientoOrigenId: null },
  ]), true);
});

test("complete chronological inverses permit an earlier unchanged movement", () => {
  assert.equal(hasOutstandingSuccessors([]), false);
  assert.equal(hasOutstandingSuccessors([
    { id: 2, tipo: "AJUSTE_POSITIVO", movimientoOrigenId: null },
    { id: 3, tipo: "VENTA", movimientoOrigenId: null },
    { id: 4, tipo: "CANCELACION", movimientoOrigenId: 3 },
    { id: 5, tipo: "CANCELACION", movimientoOrigenId: 2 },
  ]), false);
});

test("orphan, duplicate, inverse-of-inverse and forward references fail closed", () => {
  for (const movements of [
    [{ id: 3, tipo: "CANCELACION", movimientoOrigenId: null }],
    [{ id: 3, tipo: "CANCELACION", movimientoOrigenId: 1 }],
    [{ id: 3, tipo: "CANCELACION", movimientoOrigenId: 4 }],
    [
      { id: 2, tipo: "AJUSTE_POSITIVO", movimientoOrigenId: null },
      { id: 3, tipo: "CANCELACION", movimientoOrigenId: 2 },
      { id: 4, tipo: "CANCELACION", movimientoOrigenId: 2 },
    ],
    [
      { id: 2, tipo: "AJUSTE_POSITIVO", movimientoOrigenId: null },
      { id: 3, tipo: "CANCELACION", movimientoOrigenId: 2 },
      { id: 4, tipo: "CANCELACION", movimientoOrigenId: 3 },
    ],
  ]) assert.equal(hasOutstandingSuccessors(movements), true);
});