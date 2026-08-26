import assert from "node:assert/strict";
import test from "node:test";
import { priceMetrics, validPositiveMoney, weightedCurrentUnitCost } from "./precios";

test("weighted current cost weights quantities and ignores unavailable or invalid rolls", () => {
  assert.equal(
    weightedCurrentUnitCost([
      { estado: "DISPONIBLE", cantidadActual: "2.000", costoUnitario: "10.00" },
      { estado: "DISPONIBLE", cantidadActual: "8.000", costoUnitario: "20.00" },
      { estado: "DISPONIBLE", cantidadActual: "4.000", costoUnitario: null },
      { estado: "VENDIDO", cantidadActual: "99.000", costoUnitario: "1.00" },
    ]),
    "18.00",
  );
});

test("no valid current cost is null and price semaphores use subtotal margin", () => {
  assert.equal(weightedCurrentUnitCost([{ estado: "DISPONIBLE", cantidadActual: "0", costoUnitario: "10.00" }]), null);
  assert.equal(priceMetrics("100.00", "70.00").semaforo, "VERDE");
  assert.equal(priceMetrics("100.00", "85.00").semaforo, "AMBAR");
  assert.equal(priceMetrics("100.00", "86.00").semaforo, "ROJO");
  assert.equal(priceMetrics("100.00", null).semaforo, "SIN_COSTO");
  assert.equal(validPositiveMoney("1.234"), false);
  assert.equal(validPositiveMoney("0.00"), false);
});