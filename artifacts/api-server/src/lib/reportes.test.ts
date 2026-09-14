import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { omitEconomicReportFilters, parseReportBooleanQuery, redactEconomic, reportRange, REPORT_SECTIONS } from "./reportes";
import { buildHeatmapMatrix } from "./report-heatmap";
import { summarizeCancellationRows } from "./reportes-sales";
import reportesRouter, { controlOperativoRoleGate } from "../routes/reportes";
import type { RolUsuario } from "@workspace/db";

test("report ranges use Mexico City inclusive day bounds and equal prior period", () => {
  const range = reportRange({ periodo: "personalizado", desde: "2024-02-01", hasta: "2024-02-29" });
  assert.equal(range.desde.toISOString(), "2024-02-01T06:00:00.000Z");
  assert.equal(range.hasta.toISOString(), "2024-03-01T05:59:59.999Z");
  assert.equal(range.previousHasta.getTime() - range.previousDesde.getTime(), range.hasta.getTime() - range.desde.getTime());
});

test("report ranges reject dates outside the supported decision window", () => {
  assert.throws(
    () => reportRange({ periodo: "personalizado", desde: "0002-01-01", hasta: "2026-08-25" }),
    /no exceder 100 años/,
  );
});

test("report boolean query preserves literal false", () => {
  assert.equal(parseReportBooleanQuery("true"), true);
  assert.equal(parseReportBooleanQuery("false"), false);
  assert.equal(parseReportBooleanQuery(undefined), undefined);
  assert.throws(() => parseReportBooleanQuery("1"), /true o false/);
});

test("economic redaction physically removes sensitive keys and columns", () => {
  const result = redactEconomic({
    hasEconomicAccess: false,
    kpis: [
      { id: "margen", value: 2 },
      { id: "stale-lines", economic: true, value: 4, provenanceStatus: "STALE_LAST_KNOWN" },
    ],
    tables: [{
      columns: [
        { key: "cantidad" },
        { key: "costo", economic: true },
        { key: "provenanceStatus", label: "Fuente", economic: true },
      ],
      rows: [{ cantidad: 1, costo: 3, utilidad: 1, provenanceStatus: "STALE_LAST_KNOWN" }],
      totals: { costo: 3 },
    }],
  });
  assert.equal(JSON.stringify(result).includes("costo"), false);
  assert.equal(JSON.stringify(result).includes("utilidad"), false);
  assert.equal(JSON.stringify(result).includes("STALE_LAST_KNOWN"), false);
  assert.equal(JSON.stringify(result).includes("provenanceStatus"), false);
});

test("economic annotations and modality filters cannot leak or be mistaken for one another", () => {
  const result = redactEconomic({
    hasEconomicAccess: false,
    activeFilters: ["modalidad=METRAJE"],
    nested: { economic: true, arbitraryFutureMoneyField: 42 },
    tables: [{
      columns: [{ key: "cantidad" }, { key: "futureMetric", economic: true }],
      rows: [{ cantidad: 3, futureMetric: 99 }],
      totals: { futureMetric: 99 },
    }],
  });
  assert.deepEqual(result.activeFilters, ["modalidad=METRAJE"]);
  assert.equal(JSON.stringify(result).includes("futureMetric"), false);
  assert.equal(JSON.stringify(result).includes("\"economic\""), false);
  assert.deepEqual(
    omitEconomicReportFilters({ modalidad: "METRAJE", formasPago: "EFECTIVO" }),
    { modalidad: "METRAJE" },
  );
});

test("heatmap matrix pivots labels and preserves distinct, zero, and absent values", () => {
  const matrix = buildHeatmapMatrix({
    rows: [
      { month: "2026-06", sku: "SKU-A", quantity: 2 },
      { month: "2026-06", sku: "SKU-A", quantity: 3 },
      { month: "2026-07", sku: "SKU-A", quantity: 0 },
      { month: "2026-06", sku: "SKU-B", quantity: 9 },
      { month: "2026-07", sku: "SKU-B", quantity: "not-a-number" },
    ],
    rowKey: "sku",
    columnKey: "month",
    valueKey: "quantity",
    columns: ["2026-06", "2026-07", "2026-08"],
  });

  assert.deepEqual(
    matrix.series.map(({ key, label }) => ({ key, label })),
    [
      { key: "value_0", label: "2026-06" },
      { key: "value_1", label: "2026-07" },
      { key: "value_2", label: "2026-08" },
    ],
  );
  assert.deepEqual(matrix.rows, [
    { label: "SKU-A", value_0: 5, value_1: 0, value_2: null },
    { label: "SKU-B", value_0: 9, value_1: null, value_2: null },
  ]);
});

test("cancellation aggregation deduplicates tickets while preserving modality totals", () => {
  assert.deepEqual(
    summarizeCancellationRows([
      {
        ticketId: 11, folio: "T-11", motivo: null, sitio: "Centro",
        modalidad: "ROLLOS", lineas: 1, importe: 100, canceladoAt: null,
        documentoHref: "/tickets/11",
      },
      {
        ticketId: 11, folio: "T-11", motivo: null, sitio: "Centro",
        modalidad: "ROLLOS", lineas: 1, importe: 50, canceladoAt: null,
        documentoHref: "/tickets/11",
      },
      {
        ticketId: 12, folio: "T-12", motivo: "Cliente", sitio: "Norte",
        modalidad: "METRAJE", lineas: 1, importe: 20, canceladoAt: null,
        documentoHref: "/tickets/12",
      },
    ]),
    [
      { modalidad: "ROLLOS", tickets: 1, importe: 150 },
      { modalidad: "METRAJE", tickets: 1, importe: 20 },
    ],
  );
});

test("control operativo is a shared cancellation consumer and does not expose cancellation rate", () => {
  const sales = readFileSync(new URL("./reportes-sales.ts", import.meta.url), "utf8");
  const control = readFileSync(new URL("./reportes-control-operativo.ts", import.meta.url), "utf8");
  assert.match(sales, /export async function loadCancellationRows/);
  assert.match(sales, /const cancellationData = await loadCancellationRows\(ctx\)/);
  assert.match(control, /loadCancellationRows\(ctx\)/);
  assert.doesNotMatch(control, /tasaCancelacion|cancelationRate|cancellationRate/);
  assert.ok(REPORT_SECTIONS.includes("control-operativo"));
});

test("reportes keeps its module authorization and read-scope boundary", () => {
  const route = readFileSync(new URL("../routes/reportes.ts", import.meta.url), "utf8");
  assert.match(route, /router\.use\("\/reportes", requireSession, requierePermiso\("reportes", "ver"\)\)/);
  assert.match(route, /return buildReport\(params\.seccion, query, scopedLocations\(req\)/);
  assert.match(route, /resolveReadScope\(req\.auth!\)/);
});

test("control operativo route gate allows ADMIN and excludes every other role", () => {
  type RouterLayer = { handle: unknown };
  const layers = (reportesRouter as unknown as { stack: RouterLayer[] }).stack;
  assert.equal(
    layers.filter((layer) => layer.handle === controlOperativoRoleGate).length,
    1,
    "the ADMIN gate must be attached to the whole control-operativo branch",
  );

  type GateResult = { status: number | null; body: unknown; next: boolean };
  function invoke(role: RolUsuario): GateResult {
    const result: GateResult = { status: null, body: null, next: false };
    const req = { auth: { user: { rol: role } } };
    const res = {
      status(code: number) {
        result.status = code;
        return res;
      },
      json(body: unknown) {
        result.body = body;
        return res;
      },
    };
    controlOperativoRoleGate(req as never, res as never, () => {
      result.next = true;
    });
    return result;
  }

  assert.deepEqual(invoke("ADMIN"), { status: null, body: null, next: true });
  for (const role of ["TERMINAL", "CAJA", "SUPERVISOR", "BODEGA", "SISTEMAS", "CONTADOR"] as const) {
    assert.deepEqual(invoke(role), {
      status: 403,
      body: { error: "No tienes permisos para esta operación." },
      next: false,
    }, `${role} must be denied before any control report or export handler runs`);
  }
});

test("cancellation and control SQL retain grouped zero-safe aggregations", () => {
  const sales = readFileSync(new URL("./reportes-sales.ts", import.meta.url), "utf8");
  const control = readFileSync(new URL("./reportes-control-operativo.ts", import.meta.url), "utf8");
  assert.match(sales, /COALESCE\(SUM\(l\.importe\),0\)::float/);
  assert.match(sales, /COUNT\(l\.id\)::int/);
  assert.match(control, /COUNT\(\*\)::int reimpresiones/);
  assert.match(control, /HAVING COUNT\(\*\) >= 3/);
  assert.match(control, /m\.tipo IN \('AJUSTE_POSITIVO','AJUSTE_NEGATIVO','CANCELACION'\)/);
});

for (const [periodo, desde, hasta] of [
  ["diario", "2024-01-10", "2024-01-10"], ["semanal", "2024-01-10", "2024-01-10"],
  ["mensual", "2024-02-10", "2024-02-10"], ["trimestral", "2024-04-10", "2024-04-10"],
  ["semestral", "2024-07-10", "2024-07-10"], ["anual", "2024-12-10", "2024-12-10"],
] as const) {
  for (let index = 0; index < 6; index += 1) test(`range ${periodo} safety ${index}`, () => {
    const range = reportRange({ periodo: "personalizado", desde, hasta });
    assert.ok(range.desde <= range.hasta);
    assert.equal(typeof range.desde.getTime(), "number");
  });
}