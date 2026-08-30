import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../../../", import.meta.url);
const [inventory, spec] = await Promise.all([
  readFile(new URL("artifacts/api-server/src/lib/inventario.ts", root), "utf8"),
  readFile(new URL("lib/api-spec/openapi.yaml", root), "utf8"),
]);

test("el detalle de Entrada conserva globales y series en el mismo contrato", () => {
  const resultType = inventory.slice(
    inventory.indexOf("export type EntradaRolloResult"),
    inventory.indexOf("/**", inventory.indexOf("export type EntradaRolloResult")),
  );
  assert.match(resultType, /serie: string/);
  assert.match(resultType, /productoId: number/);
  assert.match(resultType, /cantidadInicial: string/);
  assert.match(resultType, /lineas: EntradaLineaResult\[\]/);
  assert.match(resultType, /rollos: EntradaRolloResult\[\]/);

  const builder = inventory.slice(
    inventory.indexOf("export async function buildEntradaResult"),
    inventory.indexOf("export async function", inventory.indexOf("export async function buildEntradaResult") + 1),
  );
  assert.match(builder, /serie: rollosTable\.serie/);
  assert.match(builder, /productoId: rollosTable\.productoId/);
  assert.match(builder, /cantidadInicial: rollosTable\.cantidadInicial/);
  assert.match(builder, /lineas,[\s\S]*rollos,/);
});

test("OpenAPI exige las series sin reemplazar las líneas agregadas", () => {
  const entradaSchemas = spec.slice(
    spec.indexOf("    EntradaRollo:"),
    spec.indexOf("    CatalogoEntradaProducto:"),
  );
  assert.match(entradaSchemas, /EntradaRollo:[\s\S]*required: \[id, serie, productoId, cantidadInicial\]/);
  assert.match(entradaSchemas, /EntradaDetail:[\s\S]*lineas,[\s\S]*rollos,/);
  assert.match(entradaSchemas, /lineas:[\s\S]*#\/components\/schemas\/EntradaLinea/);
  assert.match(entradaSchemas, /rollos:[\s\S]*#\/components\/schemas\/EntradaRollo/);
});