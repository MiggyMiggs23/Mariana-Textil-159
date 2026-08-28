import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  calendarDayNumber,
  canEditContenedor,
  daysBetween,
  periodBounds,
  projectContenedorListItem,
  redactEconomicData,
  summarizeExpectedLines,
  weightedUnitCost,
} from "./contenedores-helpers";
import type { ContenedorListLinea } from "./contenedores-helpers";
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
  assert.match(source, /jsonb_agg\(jsonb_build_object\(/);
  assert.match(contract, /lineasCount:/);
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

const listRow: Record<string, unknown> & { lineas: ContenedorListLinea[] } = {
  id: 8,
  folio: 104,
  proveedor_id: 2,
  proveedor: "Textiles Norte",
  referencia: "CN-104",
  fecha_estimada_llegada: "2026-05-20",
  sitio_destino_id: 3,
  sitio_destino: "Bodega Centro",
  estado: "EN_TRANSITO",
  costo_total: "987.65",
  lineas: [
    {
      productoId: 11,
      sku: "ALG-AZ",
      tela: "Algodón",
      color: "Azul",
      unidad: "METRO",
      cantidadEsperada: "120.250",
      rollosEsperados: 4,
      nota: "Lote principal",
    },
    {
      productoId: 12,
      sku: "LINO-NAT",
      tela: "Lino",
      color: "Natural",
      unidad: "METRO",
      cantidadEsperada: "30.500",
      rollosEsperados: null,
      nota: null,
    },
    {
      productoId: 13,
      sku: "HILO-NEG",
      tela: "Hilo",
      color: "Negro",
      unidad: "KILO",
      cantidadEsperada: "42.750",
      rollosEsperados: 2,
      nota: "No mezclar",
    },
  ],
};

test("list projection includes every complete expected multiproduct line", () => {
  const item = projectContenedorListItem(listRow, "2026-05-10", false);
  assert.equal(item.lineasCount, 3);
  assert.deepEqual(item.lineas, listRow.lineas);
  for (const line of item.lineas as Array<Record<string, unknown>>) {
    assert.deepEqual(Object.keys(line), [
      "productoId",
      "sku",
      "tela",
      "color",
      "unidad",
      "cantidadEsperada",
      "rollosEsperados",
      "nota",
    ]);
  }
});

test("list totals keep rolls, metres and kilos separate", () => {
  assert.deepEqual(summarizeExpectedLines(listRow.lineas), {
    lineas: 3,
    rollos: 6,
    metros: "150.750",
    kilos: "42.750",
  });
});

test("non-admin list projection contains no economic fields", () => {
  const item = projectContenedorListItem(listRow, "2026-05-10", false);
  assert.equal(JSON.stringify(item).includes("costo"), false);
  assert.equal(
    (item.lineas as Array<Record<string, unknown>>).some((line) =>
      Object.keys(line).some((key) => key.toLowerCase().includes("costo")),
    ),
    false,
  );
});

test("list query batches lines and orders arrival date then folio", () => {
  const source = readFileSync(new URL("./contenedores.ts", import.meta.url), "utf8");
  const start = source.indexOf("export async function listContenedores");
  const end = source.indexOf("export async function getContenedoresSummary", start);
  const operation = source.slice(start, end);
  assert.match(operation, /line_aggregates AS \(/);
  assert.match(operation, /WHERE cl\.contenedor_id IN \(SELECT id FROM paged\)/);
  assert.match(
    operation,
    /ORDER BY pg\.fecha_estimada_llegada ASC,pg\.folio ASC/,
  );
  assert.equal((operation.match(/db\.execute/g) ?? []).length, 1);
});

test("container page renders all supplied lines, four distinct KPIs, and ETA order", () => {
  const page = readFileSync(
    new URL("../../../mariana-textil/src/pages/contenedores/index.tsx", import.meta.url),
    "utf8",
  );
  assert.match(page, /const sortedItems = useMemo/);
  assert.match(page, /new Date\(a\.fechaEstimadaLlegada\).*new Date\(b\.fechaEstimadaLlegada\)/s);
  assert.match(page, /\{sortedItems\.map\(item =>/);
  assert.match(page, /\{item\.lineas\.map\(\(linea, idx\) =>/);
  for (const label of ["En Tránsito", "Rollos por Llegar", "Metros por Llegar", "Kilos por Llegar"]) {
    assert.match(page, new RegExp(`>${label}<`));
  }
  assert.match(page, /bg-report-header text-report-header-foreground/);
  assert.match(page, /bg-report-accent-warm-bg/);
});