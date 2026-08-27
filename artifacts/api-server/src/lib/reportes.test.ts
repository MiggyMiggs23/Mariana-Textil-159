import assert from "node:assert/strict";
import test from "node:test";
import { omitEconomicReportFilters, parseReportBooleanQuery, redactEconomic, reportRange } from "./reportes";

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