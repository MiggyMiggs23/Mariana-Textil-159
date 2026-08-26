import assert from "node:assert/strict";
import test from "node:test";
import { abcClass, exactFrozenMargin, parseFilterValues, priceRange, safePercent, subtotalBeforeTax, trendDirection } from "./reportes-sales";

test("ABC assigns cumulative boundary values deterministically", () => {
  assert.equal(abcClass(0), "A");
  assert.equal(abcClass(80), "A");
  assert.equal(abcClass(80.0001), "B");
  assert.equal(abcClass(95), "B");
  assert.equal(abcClass(95.0001), "C");
});

test("safePercent avoids invented changes when denominator is zero", () => {
  assert.equal(safePercent(100, 0), 0);
  assert.equal(safePercent(50, 100), -50);
  assert.equal(safePercent(150, 100), 50);
  assert.equal(safePercent(50, -100), 150);
  assert.equal(safePercent(Number.NaN, 10), 0);
});

test("exact margin excludes invalid frozen-cost rows and uses only valid subtotal", () => {
  assert.deepEqual(exactFrozenMargin([
    { importe: 120, rolloId: 1, costoUnitarioCongelado: 50, costoTotalCongelado: 50 },
    { importe: 80, rolloId: null, costoUnitarioCongelado: 40, costoTotalCongelado: 40 },
    { importe: 60, rolloId: 2, costoUnitarioCongelado: 0, costoTotalCongelado: 0 },
  ]), { costo: 50, utilidad: 70, denominador: 120 });
});

test("subtotal convention, dispersion range, and trend classification are explicit", () => {
  assert.equal(subtotalBeforeTax(116, 16), 100);
  assert.equal(priceRange(42, 58), 16);
  assert.equal(priceRange(58, 42), 0);
  assert.equal(trendDirection(11, 10), "rising");
  assert.equal(trendDirection(9, 10), "falling");
  assert.equal(trendDirection(10, 10), "flat");
});

test("combined filter parsing accepts comma strings and arrays while discarding blanks", () => {
  assert.deepEqual(parseFilterValues(" rojo, azul ,, verde "), ["rojo", "azul", "verde"]);
  assert.deepEqual(parseFilterValues(["EFECTIVO", " ", 7]), ["EFECTIVO", "7"]);
  assert.deepEqual(parseFilterValues(undefined), []);
});