import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "../../..");
const spec = readFileSync(resolve(root, "lib/api-spec/openapi.yaml"), "utf8");
const kardex = readFileSync(resolve(import.meta.dirname, "lib/kardex.ts"), "utf8");
const route = readFileSync(resolve(import.meta.dirname, "routes/inventario.ts"), "utf8");

test("TODO_LO_QUE_SALIO is a read-only GET contract with its exact forced types", () => {
  const kardexPath = spec.slice(
    spec.indexOf("  /inventario/kardex:"),
    spec.indexOf("  /inventario/kardex/filtros:"),
  );
  assert.match(kardexPath, /get:\n[\s\S]*name: modo[\s\S]*TODO_LO_QUE_SALIO/);
  assert.doesNotMatch(kardexPath, /\n    (post|put|patch|delete):/);
  assert.match(
    kardex,
    /TODO_LO_QUE_SALIO_TIPOS = \[\s*"VENTA",\s*"TRANSFERENCIA_SALIDA",\s*"SALIDA_MOSTRADOR"/,
  );
  assert.match(kardex, /filters\.modo === "TODO_LO_QUE_SALIO"/);
  assert.doesNotMatch(kardex, /\b(?:crear|vender|ajustar|revertir|insert|update|delete)\w*\(/i);
});

test("outgoing preset retains read scope and supplies destination, documents, units and absolute totals", () => {
  assert.match(route, /resolveReadScope\(\s*auth,\s*q\.ubicacionId,/);
  assert.match(route, /modo: query\.modo/);
  assert.match(kardex, /clientesTable/);
  assert.match(kardex, /clienteNombre/);
  assert.match(kardex, /destinoNombre/);
  assert.match(kardex, /"Mostrador"/);
  assert.match(kardex, /route: `\/tickets\/\$\{ticketId\}`/);
  assert.match(kardex, /route: `\/salidas\/\$\{salidaId\}`/);
  assert.match(kardex, /unidadProducto/);
  assert.match(kardex, /sum\(abs\(\$\{movimientosTable\.cantidad\}\)\)/);
  assert.match(kardex, /totalMetros/);
  assert.match(kardex, /totalKilos/);
});