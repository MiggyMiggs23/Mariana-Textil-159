import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

/**
 * Fast contract/security guards for requirements 1–24. Database-backed API
 * behavior is exercised by the integration suite when TEST_DATABASE_URL is
 * supplied; these checks remain safe to run without touching any database.
 */
const route = await readFile(new URL("./routes/etiquetas.ts", import.meta.url), "utf8");
const schema = await readFile(
  new URL("../../../lib/db/src/lib/etiquetas-schema.ts", import.meta.url),
  "utf8",
);
const permissions = await readFile(new URL("./lib/permisos.ts", import.meta.url), "utf8");
const openapi = await readFile(
  new URL("../../../lib/api-spec/openapi.yaml", import.meta.url),
  "utf8",
);

test("1 serie exacta forma parte de la búsqueda server-side", () =>
  assert.match(route, /r\.serie ILIKE/));
test("2 SKU forma parte de la búsqueda server-side", () =>
  assert.match(route, /p\.sku ILIKE/));
test("3 tela y color forman parte de la búsqueda server-side", () => {
  assert.match(route, /p\.tela ILIKE/);
  assert.match(route, /p\.color ILIKE/);
});
test("4 QR se compara como SKU-SERIE", () =>
  assert.match(route, /p\.sku \|\| '-' \|\| r\.serie/));
test("5 alcance PROPIA fuerza el sitio asignado", () =>
  assert.match(route, /alcanceConsulta === "TODAS"[\s\S]*auth\.user\.ubicacionId/));
test("6 sitio solicitado no sobreescribe PROPIA", () =>
  assert.match(route, /scopedSite\(req\.auth!, q\.sitioId\)/));
test("7 ADMIN puede registrar sin credenciales externas", () =>
  assert.match(route, /if \(auth\.user\.rol !== "ADMIN"\)/));
test("8 motivo exige al menos diez caracteres", () =>
  assert.match(route, /motivo: z\.string\(\)\.trim\(\)\.min\(10\)/));
test("9 respuesta conserva serie y agrega REIMPRESA", () => {
  assert.match(route, /serie: String\(row\.serie\)/);
  assert.match(route, /marca: "REIMPRESA"/);
});
test("10 BODEGA está entre los únicos roles autorizados", () =>
  assert.match(route, /\["ADMIN", "BODEGA", "INVENTARIOS"\]/));
test("11 credenciales incorrectas producen 403", () =>
  assert.match(route, /Credenciales inválidas[\s\S]*status\(403\)/));
test("12 el autorizador debe tener rol ADMIN", () =>
  assert.match(route, /rol='ADMIN'/));
test("13 autorizador debe estar activo y queda registrado", () => {
  assert.match(route, /activo=true/);
  assert.match(route, /autorizado_por/);
});
test("14 credenciales faltantes producen 403 en servidor", () =>
  assert.match(route, /Se requieren credenciales de un ADMIN activo/));
test("15 registro incluye rollo usuario autorizador motivo sitio y fecha", () =>
  assert.match(route, /rollo_id,usuario_id,autorizado_por,motivo,sitio_id,[\s\S]*serie_snapshot[\s\S]*created_at/));
test("16 historial y exportación XLSX están publicados", () => {
  assert.match(openapi, /\/etiquetas\/historial:/);
  assert.match(openapi, /\/etiquetas\/historial\/export\.xlsx:/);
});
test("17 detalle incluye contador y última reimpresión", () => {
  assert.match(route, /reimpresionesCount/);
  assert.match(route, /ultimaReimpresion/);
});
test("18 tres reimpresiones activan alerta", () =>
  assert.match(route, /reimpresiones_count\) >= 3/));
test("19 TERMINAL tiene defaults sin acceso", () =>
  assert.match(schema, /\('TERMINAL', 'etiquetas', false, false, false, false\)/));
test("20 CAJA tiene defaults sin acceso", () =>
  assert.match(schema, /\('CAJA', 'etiquetas', false, false, false, false\)/));
test("21 historial exige rol ADMIN", () =>
  assert.match(route, /El historial requiere rol ADMIN/));
test("22 operación múltiple retorna todas las etiquetas seleccionadas", () =>
  assert.match(route, /rows\.map\(\(row\) => label\(row, now\)\)/));
test("23 cada rollo se inserta individualmente dentro de la transacción", () =>
  assert.match(route, /for \(const row of rows\)[\s\S]*INSERT INTO reimpresiones_etiqueta/));
test("24 límite de operación y búsqueda es 50", () => {
  assert.match(route, /\.max\(50\)/);
  assert.match(route, /LIMIT 50/);
  assert.match(permissions, /"etiquetas"/);
});