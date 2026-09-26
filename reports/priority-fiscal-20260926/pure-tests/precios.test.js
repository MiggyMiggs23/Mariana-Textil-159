"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// artifacts/api-server/src/lib/precios.test.ts
var import_strict = __toESM(require("node:assert/strict"), 1);
var import_node_test = __toESM(require("node:test"), 1);

// artifacts/api-server/src/lib/precios.ts
var validMoney = (value) => {
  if (value == null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};
function weightedCurrentUnitCost(rows) {
  let totalQuantity = 0;
  let totalCost = 0;
  for (const row of rows) {
    const quantity = Number(row.cantidadActual);
    const cost = validMoney(row.costoUnitario);
    if (row.estado !== "DISPONIBLE" || !Number.isFinite(quantity) || quantity <= 0 || cost == null) continue;
    totalQuantity += quantity;
    totalCost += cost * quantity;
  }
  return totalQuantity > 0 ? (totalCost / totalQuantity).toFixed(2) : null;
}
function priceMetrics(price, cost) {
  if (cost == null) {
    return {
      costoUnitarioPonderado: null,
      margenPesosUnidad: null,
      margenPorcentajeSubtotal: null,
      semaforo: "SIN_COSTO"
    };
  }
  const parsedPrice = Number(price);
  if (price == null || !Number.isFinite(parsedPrice) || parsedPrice <= 0) {
    return {
      costoUnitarioPonderado: Number(cost).toFixed(2),
      margenPesosUnidad: null,
      margenPorcentajeSubtotal: null,
      semaforo: "ROJO"
    };
  }
  const margin = parsedPrice - Number(cost);
  const percent = margin / parsedPrice * 100;
  return {
    costoUnitarioPonderado: Number(cost).toFixed(2),
    margenPesosUnidad: margin.toFixed(2),
    margenPorcentajeSubtotal: percent.toFixed(4),
    semaforo: percent >= 30 ? "VERDE" : percent >= 15 ? "AMBAR" : "ROJO"
  };
}
function validPositiveMoney(value) {
  return /^\d+(?:\.\d{1,2})?$/.test(value) && Number(value) > 0;
}

// artifacts/api-server/src/lib/precios.test.ts
(0, import_node_test.default)("weighted current cost weights quantities and ignores unavailable or invalid rolls", () => {
  import_strict.default.equal(
    weightedCurrentUnitCost([
      { estado: "DISPONIBLE", cantidadActual: "2.000", costoUnitario: "10.00" },
      { estado: "DISPONIBLE", cantidadActual: "8.000", costoUnitario: "20.00" },
      { estado: "DISPONIBLE", cantidadActual: "4.000", costoUnitario: null },
      { estado: "VENDIDO", cantidadActual: "99.000", costoUnitario: "1.00" }
    ]),
    "18.00"
  );
});
(0, import_node_test.default)("no valid current cost is null and price semaphores use subtotal margin", () => {
  import_strict.default.equal(weightedCurrentUnitCost([{ estado: "DISPONIBLE", cantidadActual: "0", costoUnitario: "10.00" }]), null);
  import_strict.default.equal(priceMetrics("100.00", "70.00").semaforo, "VERDE");
  import_strict.default.equal(priceMetrics("100.00", "85.00").semaforo, "AMBAR");
  import_strict.default.equal(priceMetrics("100.00", "86.00").semaforo, "ROJO");
  import_strict.default.equal(priceMetrics("100.00", null).semaforo, "SIN_COSTO");
  import_strict.default.equal(priceMetrics("0", "10.00").margenPorcentajeSubtotal, null);
  import_strict.default.equal(priceMetrics(null, "10.00").margenPorcentajeSubtotal, null);
  import_strict.default.equal(validPositiveMoney("1.234"), false);
  import_strict.default.equal(validPositiveMoney("0.00"), false);
});
