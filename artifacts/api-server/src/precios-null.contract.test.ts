import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { ListPreciosResponse } from "@workspace/api-zod";

const route = readFileSync(new URL("./routes/precios.ts", import.meta.url), "utf8");

const product = {
  id: 1,
  sku: "SKU-1",
  tela: "Tela",
  color: "Color",
  unidad: "METRO",
  seVendePorMetro: false,
  activo: true,
  costoUnitarioPonderado: null,
  costoReferenciaMetreado: {
    costoUnitario: null,
    estado: "NO_COST",
    esMayorA12Meses: false,
    rollosIncluidos: 0,
    fechaUltimaRecepcion: null,
  },
  precioLista: null,
  precioMayoreo: null,
  precioMenudeo: null,
  preciosPorModo: Object.fromEntries(["ROLLO", "MAYOREO", "MENUDEO"].map((modo) => [
    modo,
    { modo, precioLista: null, costoUnitarioBase: null, margenPesosUnidad: null, margenPorcentajeSubtotal: null, semaforo: "SIN_COSTO" },
  ])),
  margenPesosUnidad: null,
  margenPorcentajeSubtotal: null,
  semaforo: "SIN_COSTO",
  ultimoCambioPrecio: null,
};

test("null-heavy 566-product payload satisfies the source-generated contract", () => {
  const payload = Array.from({ length: 566 }, (_, index) => ({
    ...product,
    id: index + 1,
    sku: `SKU-${index + 1}`,
  }));
  assert.equal(ListPreciosResponse.parse(payload).length, 566);
});

test("first price uses the existing transactional update and history mechanism", () => {
  assert.match(route, /previousPrice = modoPrecio === "ROLLO"\s*\?\s*before\.precioSugerido/);
  assert.match(route, /tx\.update\(productosTable\)[\s\S]*tx\.insert\(precioHistorialTable\)/);
  assert.match(route, /row\.preciosPorModo\[modoPrecio\]\.precioLista == null/);
});