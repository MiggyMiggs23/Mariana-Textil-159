import assert from "node:assert/strict";
import test from "node:test";
import { direccionEntregaEfectiva, ordenarEspanol } from "./spanish-order";

test("ordena en español, conserva Ñ y pone sistema primero", () => {
  const rows = [
    { nombre: "Ñora" },
    { nombre: "José López" },
    { nombre: "Nora" },
    { nombre: "Jesús López" },
    { nombre: "Álvaro" },
    { nombre: "Venta a Público", esSistema: true },
    { nombre: "Alberto" },
  ];
  assert.deepEqual(
    ordenarEspanol(rows).map((row) => row.nombre),
    [
      "Venta a Público",
      "Alberto",
      "Álvaro",
      "Jesús López",
      "José López",
      "Nora",
      "Ñora",
    ],
  );
});

test("dirección de entrega usa particular como respaldo", () => {
  assert.equal(
    direccionEntregaEfectiva({
      direccionEntrega: "  Bodega 2 ",
      direccionParticular: "Casa 1",
    }),
    "Bodega 2",
  );
  assert.equal(
    direccionEntregaEfectiva({
      direccionEntrega: " ",
      direccionParticular: " Casa 1 ",
    }),
    "Casa 1",
  );
});