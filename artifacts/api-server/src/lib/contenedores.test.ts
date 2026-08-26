import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  calendarDayNumber,
  canEditContenedor,
  daysBetween,
  periodBounds,
  redactEconomicData,
  weightedUnitCost,
} from "./contenedores-helpers";
import { createTextPdf } from "./pdf";

test("calendar dates are timezone-free and leap years are validated", () => {
  assert.equal(daysBetween("2024-02-28", "2024-03-01"), 2);
  assert.equal(daysBetween("2025-01-05", "2025-01-01"), -4);
  assert.throws(() => calendarDayNumber("2025-02-29"));
});

test("only unlinked EN_TRANSITO containers are editable", () => {
  assert.equal(canEditContenedor("EN_TRANSITO", null), true);
  assert.equal(canEditContenedor("EN_TRANSITO", 10), false);
  assert.equal(canEditContenedor("RECIBIDO", null), false);
  assert.equal(canEditContenedor("CANCELADO", null), false);
});

test("period bounds support year, quarter and semester", () => {
  assert.deepEqual(periodBounds(2025), {
    from: "2025-01-01",
    to: "2025-12-31",
  });
  assert.deepEqual(periodBounds(2024, 1), {
    from: "2024-01-01",
    to: "2024-03-31",
  });
  assert.deepEqual(periodBounds(2025, undefined, 2), {
    from: "2025-07-01",
    to: "2025-12-31",
  });
  assert.throws(() => periodBounds(2025, 1, 1));
});

test("weighted costs use quantity rather than roll count", () => {
  assert.equal(weightedUnitCost(12.5, 100), "8.0000");
  assert.equal(weightedUnitCost(0, 100), null);
});

test("economic redaction physically removes nested keys", () => {
  const result = redactEconomicData({
    costoTotal: "99.00",
    safe: 1,
    rows: [{ costoUnitarioReal: "3.00", cantidad: "2.000" }],
  });
  assert.deepEqual(result, { safe: 1, rows: [{ cantidad: "2.000" }] });
  assert.equal(JSON.stringify(result).includes("costo"), false);
});

test("entry transaction locks and receives the selected container", () => {
  const source = readFileSync(
    new URL("./inventario.ts", import.meta.url),
    "utf8",
  );
  const start = source.indexOf("export async function crearEntrada");
  const end = source.indexOf("export async function buildEntradaResult", start);
  const operation = source.slice(start, end);
  assert.match(operation, /from\(contenedoresTable\)[\s\S]*\.for\("update"\)/);
  assert.match(operation, /CONTENEDOR_SITE_MISMATCH/);
  assert.match(operation, /CONTENEDOR_PROVIDER_MISMATCH/);
  assert.match(operation, /estado: "RECIBIDO"/);
  assert.match(operation, /entradaId: entrada!\.id/);
});

test("schema enforces one entry and one product line per container", () => {
  const containers = readFileSync(
    new URL("../../../../lib/db/src/schema/contenedores.ts", import.meta.url),
    "utf8",
  );
  const lines = readFileSync(
    new URL(
      "../../../../lib/db/src/schema/contenedor-lineas.ts",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(containers, /contenedores_entrada_unique/);
  assert.match(containers, /contenedores_estado_check/);
  assert.match(lines, /contenedor_lineas_contenedor_producto_unique/);
});

test("complete exports paginate instead of silently dropping rows", () => {
  const lines = Array.from({ length: 180 }, (_, index) => `Resumen fila ${index + 1}`);
  const pdf = createTextPdf("Contenedores", lines).toString("ascii");
  assert.ok((pdf.match(/\/Type \/Page\b/g) ?? []).length >= 4);
  assert.match(pdf, /\(Resumen fila 180\) Tj/);
});

test("calendar-date OpenAPI contract remains a string regex, not a Date coercion", () => {
  const generated = readFileSync(
    new URL("../../../../lib/api-zod/src/generated/api.ts", import.meta.url),
    "utf8",
  );
  const line = generated
    .split("\n")
    .find((value) => value.includes('"fechaEstimadaLlegada": zod.string().regex'));
  assert.ok(line);
  assert.doesNotMatch(line!, /coerce\.date/);
});

test("summary keeps container transit averages separate from roll aggregates", () => {
  const source = readFileSync(new URL("./contenedores.ts", import.meta.url), "utf8");
  assert.match(source, /WITH received AS \(/);
  assert.match(source, /SELECT AVG\(fecha_real_llegada-fecha_pedido\).*FROM received/s);
  assert.match(source, /FROM received avg_rc WHERE avg_rc\.proveedor_id=pv\.id/);
});

test("summary propagates pending costs and splits fabric/color by unit", () => {
  const source = readFileSync(new URL("./contenedores.ts", import.meta.url), "utf8");
  assert.match(source, /total_costo IS NULL/);
  assert.match(source, /costo_total IS NULL/);
  assert.match(source, /WITH current_months AS \(/);
  assert.match(source, /FULL OUTER JOIN prior_months pm ON pm\.mes=cm\.mes/);
  assert.match(source, /GROUP BY pr\.tela,pr\.unidad/);
  assert.match(source, /GROUP BY pr\.color,pr\.unidad/);
});

test("detail compares the complete union of expected and received products", () => {
  const source = readFileSync(new URL("./contenedores.ts", import.meta.url), "utf8");
  assert.match(source, /FROM expected e FULL OUTER JOIN received r/);
  assert.match(source, /COALESCE\(e\.cantidad_esperada,0\)/);
  assert.match(source, /COALESCE\(r\.cantidad_recibida,0::numeric\)::text/);
  assert.match(source, /WHERE r\.recepcion_id=\$\{h\.entrada_id\}/);
});

test("list and upcoming KPI contracts expose line count and calendar date", () => {
  const source = readFileSync(new URL("./contenedores.ts", import.meta.url), "utf8");
  const contract = readFileSync(
    new URL("../../../../lib/api-spec/openapi.yaml", import.meta.url),
    "utf8",
  );
  assert.match(source, /lineas: Number\(row\.lineas\)/);
  assert.match(source, /p\.nombre proveedor,c\.fecha_estimada_llegada/);
  assert.match(source, /fechaEstimadaLlegada: String\(nextRow\.fecha_estimada_llegada\)/);
  assert.match(contract, /ContenedorResumenKpisProximo:/);
  assert.match(contract, /fechaEstimadaLlegada: \{ \$ref: "#\/components\/schemas\/CalendarDate" \}/);
});

test("container destination catalogs and validation allow only active stores or warehouses", () => {
  const domain = readFileSync(new URL("./contenedores.ts", import.meta.url), "utf8");
  const route = readFileSync(
    new URL("../routes/contenedores.ts", import.meta.url),
    "utf8",
  );
  assert.match(domain, /site\.tipo !== "TIENDA" && site\.tipo !== "BODEGA"/);
  assert.match(route, /inArray\(ubicacionesTable\.tipo, \["TIENDA", "BODEGA"\]\)/);
  assert.match(route, /eq\(ubicacionesTable\.activa, true\)/);
});