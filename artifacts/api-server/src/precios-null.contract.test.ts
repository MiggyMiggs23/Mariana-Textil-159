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
  assert.match(route, /previousPrice = input\.modoPrecio === "ROLLO"\s*\?\s*before\.precioSugerido/);
  assert.match(route, /tx\.update\(productosTable\)[\s\S]*tx\.insert\(precioHistorialTable\)/);
  assert.match(route, /row\.preciosPorModo\[modoPrecio\]\.precioLista == null/);
});

test("individual and bulk price changes reuse one mutation helper", () => {
  assert.equal((route.match(/async function mutateLockedPrecio\(/g) ?? []).length, 1);
  assert.equal((route.match(/mutateLockedPrecio\(tx,/g) ?? []).length, 2);
  assert.equal((route.match(/tx\.insert\(precioHistorialTable\)/g) ?? []).length, 1);
  assert.equal((route.match(/accion: "CAMBIAR_PRECIO"/g) ?? []).length, 1);
});

test("bulk route is permissioned, bounded, ordered, and prevalidates before writes", () => {
  assert.match(route, /router\.post\("\/precios\/cambiar-masivo", requierePermiso\("precios", "editar"\)/);
  assert.match(route, /productoIds: z\.array[\s\S]*\.max\(200\)/);
  assert.match(route, /new Set\(body\.data\.productoIds\)\.size !== body\.data\.productoIds\.length/);
  assert.match(route, /productoIds\]\.sort\(\(a, b\) => a - b\)/);
  const bulk = route.slice(route.indexOf('router.post("/precios/cambiar-masivo"'));
  assert.ok(bulk.indexOf("transactionAdvisoryLock(") < bulk.indexOf('.for("update")'));
  assert.ok(bulk.indexOf('.for("update")') < bulk.indexOf('kind: "mixed-units"'));
  assert.ok(bulk.indexOf('kind: "metered-disabled"') < bulk.indexOf("mutateLockedPrecio(tx, product"));
  assert.match(bulk, /product\.unidad === "KILO"/);
  assert.match(bulk, /code: "VENTA_POR_METRO_DESHABILITADA"[\s\S]*skus: result\.skus/);
});

test("OpenAPI exposes the bulk request and useful UI result schemas", () => {
  const spec = readFileSync(new URL("../../../lib/api-spec/openapi.yaml", import.meta.url), "utf8");
  assert.match(spec, /\/precios\/cambiar-masivo:[\s\S]*operationId: changePreciosMasivo/);
  assert.match(spec, /PrecioCambioMasivoInput:[\s\S]*maxItems: 200[\s\S]*uniqueItems: true/);
  assert.match(spec, /PrecioCambioMasivoResultado:[\s\S]*required: \[actualizados\]/);
  assert.match(spec, /PrecioCambioMasivoError:[\s\S]*VENTA_POR_METRO_DESHABILITADA[\s\S]*skus:/);
});