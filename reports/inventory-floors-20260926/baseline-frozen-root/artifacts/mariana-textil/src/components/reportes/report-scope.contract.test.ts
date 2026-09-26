import assert from "node:assert/strict";
import test from "node:test";
import {
  applyReportScope,
  buildComparisonScopeParams,
  buildReportExportParams,
  resolveReportRange,
  resolveReportTab,
  resolveReportViewMode,
} from "./report-scope";

test("header site replaces a malicious or stale URL site", () => {
  const scoped = applyReportScope(
    {
      periodo: "mensual",
      ubicacionIds: [999999],
      ubicacionId: 888888,
      productoIds: [4],
    },
    {
      selectedLocationId: 12,
      dateRange: { desde: "2026-02-01", hasta: "2026-02-28" },
    },
  );

  assert.deepEqual(scoped.ubicacionIds, [12]);
  assert.equal("ubicacionId" in scoped, false);
  assert.equal(scoped.desde, "2026-02-01");
  assert.equal(scoped.hasta, "2026-02-28");
});

test("global header removes a stale URL site instead of widening or narrowing scope", () => {
  const scoped = applyReportScope(
    {
      periodo: "mensual",
      ubicacionIds: [12, 999999],
      desde: "1900-01-01",
      hasta: "2999-12-31",
    },
    { selectedLocationId: null, dateRange: { desde: "2026-02-01", hasta: "2026-02-28" } },
  );

  assert.equal("ubicacionIds" in scoped, false);
  assert.equal(scoped.desde, "2026-02-01");
  assert.equal(scoped.hasta, "2026-02-28");
});

test("preset ranges use Mexico City calendar dates", () => {
  const now = new Date("2026-09-14T01:00:00.000Z");

  assert.deepEqual(resolveReportRange({ periodo: "diario" }, now), {
    desde: "2026-09-13",
    hasta: "2026-09-13",
  });
  assert.deepEqual(resolveReportRange({ periodo: "semanal" }, now), {
    desde: "2026-09-07",
    hasta: "2026-09-13",
  });
  assert.deepEqual(resolveReportRange({ periodo: "mensual" }, now), {
    desde: "2026-09-01",
    hasta: "2026-09-13",
  });
});

test("comparison query creates one site-scoped copy per authorized site", () => {
  const scoped = buildComparisonScopeParams(
    { periodo: "mensual", ubicacionIds: [999999, 24], productoIds: [4] },
    [12, 24],
    { desde: "2026-09-01", hasta: "2026-09-30" },
  );

  assert.deepEqual(scoped.map((params) => params.ubicacionIds), [[12], [24]]);
  assert.deepEqual(scoped.map((params) => [params.desde, params.hasta]), [
    ["2026-09-01", "2026-09-30"],
    ["2026-09-01", "2026-09-30"],
  ]);
});

test("PROPIA cannot turn a global comparison URL into a wider scope", () => {
  assert.equal(resolveReportViewMode("comparar", null, "PROPIA", "ADMIN"), "normal");
  assert.equal(resolveReportViewMode("comparar", 1, "TODAS", "ADMIN"), "normal");
  assert.equal(resolveReportViewMode("comparar", null, "TODAS", "ADMIN"), "comparar");
});

test("non-ADMIN users cannot activate comparison even with a forged TODAS scope", () => {
  assert.equal(resolveReportViewMode("comparar", null, "TODAS", "SUPERVISOR"), "normal");
  assert.equal(resolveReportViewMode("comparar", null, "TODAS", "CAJA"), "normal");
});

test("legacy report destinations map to the composed tabs", () => {
  assert.deepEqual(resolveReportTab("pagos-dirigidos"), {
    tab: "clientes",
    legacy: true,
  });
  assert.deepEqual(resolveReportTab("comparativo"), {
    tab: "ventas",
    legacy: true,
    forcedMode: "comparar",
  });
  assert.deepEqual(resolveReportTab("diferencias"), {
    tab: "control-operativo",
    legacy: true,
  });
  assert.deepEqual(resolveReportTab("inventario"), {
    tab: "que-comprar",
    legacy: true,
  });
});

test("export parameters include current mode, filters, and cash controls", () => {
  assert.deepEqual(
    buildReportExportParams(
      {
        periodo: "mensual",
        ubicacionIds: [2],
        desde: "2026-09-01",
        hasta: "2026-09-30",
      },
      "comparar",
      { agrupacion: "semana", umbralCorte: "10", umbralTienda: "20" },
    ),
    {
      periodo: "mensual",
      ubicacionIds: "2",
      ubicacionId: "2",
      desde: "2026-09-01",
      hasta: "2026-09-30",
      modo: "comparar",
      agrupacion: "semana",
      umbralCorte: "10",
      umbralTienda: "20",
    },
  );
});