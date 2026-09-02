import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("historial vive solo en la pestaña global de Proveedores", async () => {
  const proveedores = await readFile(new URL("./pages/proveedores.tsx", import.meta.url), "utf8");
  const clientes = await readFile(new URL("./pages/clientes.tsx", import.meta.url), "utf8");
  const app = await readFile(new URL("./App.tsx", import.meta.url), "utf8");

  assert.match(proveedores, /TabsTrigger value="historial">Historial de compras/);
  assert.match(proveedores, /<HistorialCompras \/>/);
  assert.doesNotMatch(clientes, /Historial de compras|HistorialCompras/);
  assert.doesNotMatch(app, /historial-compras|Historial de compras/);
});

test("tabla conserva seis columnas, enlace único, unidad, sticky y altura limitada", async () => {
  const source = await readFile(
    new URL("./components/proveedores/historial-compras.tsx", import.meta.url),
    "utf8",
  );
  assert.match(source, /max-h-\[600px\]/);
  assert.match(source, /sticky top-0/);
  assert.equal((source.match(/<Link/g) ?? []).length, 1);
  assert.match(source, /formatNumber\(row\.cantidad, \{ kind: "quantity" \}\).*formatUnit\(row\.unidad\)/s);
  assert.doesNotMatch(source, /Totales?|Ver detalle/i);
});