import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [routes, spec, detail] = await Promise.all([
  readFile(new URL("./routes/clientes.ts", import.meta.url), "utf8"),
  readFile(new URL("../../../lib/api-spec/openapi.yaml", import.meta.url), "utf8"),
  readFile(
    new URL("../../mariana-textil/src/pages/cliente-detail.tsx", import.meta.url),
    "utf8",
  ),
]);

test("las tres consultas de ventas de clientes separan BOLSA completa y suelta", () => {
  assert.equal(
    routes.match(/AS "rollosBolsas"/g)?.length,
    3,
    "historial, estadísticas y analítica global deben agregar cajas BOLSA",
  );
  assert.equal(
    routes.match(/AS "metrajeBolsas"/g)?.length,
    3,
    "historial, estadísticas y analítica global deben agregar bolsas sueltas",
  );
  assert.equal(
    routes.match(/AS bolsas/g)?.length,
    3,
    "cada consulta debe exponer el total BOLSA separado",
  );
});

test("OpenAPI y cliente muestran los totales BOLSA sin mezclarlos", () => {
  assert.match(spec, /ClienteCompraItem:[\s\S]*rollosBolsas:[\s\S]*metrajeBolsas:/);
  assert.match(spec, /ClienteEstadisticas:[\s\S]*rollosBolsas:[\s\S]*metrajeBolsas:/);
  assert.match(spec, /ClientesAnalitica:[\s\S]*rollosBolsas:[\s\S]*metrajeBolsas:/);
  assert.match(detail, /item\.rollosBolsas/);
  assert.match(detail, /item\.metrajeBolsas/);
  assert.match(detail, /stats\.data\?\.bolsas/);
});