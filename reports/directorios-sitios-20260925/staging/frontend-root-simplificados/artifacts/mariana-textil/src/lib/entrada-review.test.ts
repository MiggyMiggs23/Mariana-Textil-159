import assert from "node:assert/strict";
import test from "node:test";
import {
  buildEntradaReviewTotals,
  isValidReviewQuantity,
  shouldPreserveProvider,
} from "./entrada-review";

test("separa los totales por unidad y conserva todos los productos", () => {
  const totals = buildEntradaReviewTotals([
    {
      productoName: "Tela completa - Rojo",
      productoUnidad: "METRO",
      cantidades: ["10", "12.5"],
    },
    {
      productoName: "Lana completa - Azul",
      productoUnidad: "KILO",
      cantidades: ["3"],
    },
    {
      productoName: "Caja completa - Verde",
      productoUnidad: "BOLSA",
      cantidades: ["4", "5"],
    },
    {
      productoName: "Botón completo - Negro",
      productoUnidad: "PIEZA",
      cantidades: ["8"],
    },
  ]);

  assert.equal(totals.lineCount, 4);
  assert.equal(totals.rollCount, 6);
  assert.deepEqual(totals.quantitiesByUnit, {
    METRO: 22.5,
    KILO: 3,
    BOLSA: 9,
    PIEZA: 8,
  });
  assert.deepEqual(totals.products, [
    "Tela completa - Rojo",
    "Lana completa - Azul",
    "Caja completa - Verde",
    "Botón completo - Negro",
  ]);
  assert.deepEqual(totals.invalidQuantities, []);
});

test("marca cantidades malformadas sin convertirlas en cero ni sumar infinito", () => {
  const totals = buildEntradaReviewTotals([
    {
      productoName: "Tela - Rojo",
      productoUnidad: "METRO",
      cantidades: ["10", "", "no-numero", "Infinity"],
    },
  ]);

  assert.deepEqual(totals.quantitiesByUnit, { METRO: 10 });
  assert.deepEqual(totals.invalidQuantities, [
    { lineIndex: 0, quantityIndex: 1, value: "" },
    { lineIndex: 0, quantityIndex: 2, value: "no-numero" },
    { lineIndex: 0, quantityIndex: 3, value: "Infinity" },
  ]);
});

test("los guardas puros bloquean cantidades inválidas y conservan proveedor con líneas", () => {
  assert.equal(isValidReviewQuantity("12.5"), true);
  assert.equal(isValidReviewQuantity(""), false);
  assert.equal(isValidReviewQuantity("Infinity"), false);
  assert.equal(isValidReviewQuantity("0"), false);
  assert.equal(shouldPreserveProvider(0), false);
  assert.equal(shouldPreserveProvider(1), true);
});