import assert from "node:assert/strict";
import test from "node:test";
import {
  buildComposedReport,
  comparisonTable,
  composeReportContent,
} from "./reportes-composed-export";
import { ReportInputError } from "./reportes";
import {
  createReportWorkbook,
  normalizeExportTables,
} from "./report-export";

test("composición de exportaciones conserva fuentes sin recalcular", () => {
  const table = {
    id: "fuente-a",
    title: "Fuente A",
    columns: [{ key: "documentoHref", label: "Documento", kind: "link", hrefKey: "documentoHref" }],
    rows: [{ documentoHref: "/inventario/rollos/7", importe: "12.00" }],
    totals: { importe: "12.00" },
  };
  const content = composeReportContent("control-operativo", [
    {
      section: "fuente-a",
      content: {
        kpis: [{ id: "kpi-a", label: "A", value: 1, kind: "count" }],
        charts: [{ id: "chart-a", title: "A", rows: [{ fecha: "2024-01-01", importe: 12 }] }],
        tables: [table],
        warnings: ["Aviso de A"],
      },
    },
    {
      section: "fuente-b",
      content: {
        kpis: [{ id: "kpi-b", label: "B", value: 2, kind: "count" }],
        charts: [],
        tables: [],
        warnings: [],
      },
    },
  ]);

  assert.deepEqual(content.kpis.map((item) => item.id), ["kpi-a", "kpi-b"]);
  assert.equal(content.tables[0], table);
  assert.deepEqual(content.tables[0].totals, { importe: "12.00" });
  assert.deepEqual(content.warnings, ["Aviso de A"]);
});

test("exportación conserva matrices numéricas, hrefKey y alertas", () => {
  const tables = normalizeExportTables("control-operativo", ["modalidad=TODO"], [{
    id: "links",
    title: "Links",
    columns: [{ key: "documentoHref", label: "Documento", kind: "link", hrefKey: "documentoHref" }],
    rows: [{ documentoHref: "/inventario/rollos/7" }],
    totals: {},
  }]);
  assert.equal(tables[0]!.columns[0]!.hrefKey, "documentoHref");

  const workbook = createReportWorkbook({
    section: "control-operativo",
    generatedAt: "2024-01-01T00:00:00.000Z",
    range: {},
    activeFilters: [],
    tables,
    charts: [{
      id: "trend",
      title: "Tendencia",
      categoryKey: "fecha",
      series: [{ key: "importe", label: "Importe", kind: "money" }],
      rows: [{ fecha: "2024-01-01", importe: "12.50" }],
    }],
    warnings: ["Aviso"],
    alerts: [{ sesionId: 1, tipo: "FALTANTE", mensaje: "Diferencia", importe: "12.50" }],
  });
  assert.equal(workbook.getWorksheet("Grafico Tendencia")?.getCell("B2").value, 12.5);
  assert.equal(workbook.getWorksheet("Avisos")?.getCell("A2").value, "Aviso");
  assert.equal(workbook.getWorksheet("Alertas")?.getCell("B2").value, "FALTANTE");
});

test("X04 never runs as a global source for selected or ADMIN-PROPIA scopes", async () => {
  const input = { modo: "comparar" as const };
  const rejectsX04 = (error: unknown) =>
    error instanceof ReportInputError &&
    error.message.includes("X04") &&
    error.message.includes("vista global");

  await assert.rejects(
    () =>
      buildComposedReport(
        "ventas",
        input,
        [7],
        true,
        { rol: "ADMIN", alcanceConsulta: "TODAS" },
      ),
    rejectsX04,
  );
  await assert.rejects(
    () =>
      buildComposedReport(
        "ventas",
        input,
        [7],
        true,
        { rol: "ADMIN", alcanceConsulta: "PROPIA" },
      ),
    rejectsX04,
  );
  await assert.rejects(
    () =>
      buildComposedReport(
        "ventas",
        input,
        undefined,
        true,
        { rol: "ADMIN", alcanceConsulta: "PROPIA" },
      ),
    rejectsX04,
  );
});

test("X04 export keeps the exact twelve grouped columns and source totals", () => {
  const table = comparisonTable({
    tiendas: [{
      nombreUbicacion: "Tienda Norte",
      ubicacionId: 7,
      participacion: "100.00",
      ventas: "100.00",
      tendenciaPorcentaje: "4.00",
      margen: "20.00",
      tickets: 2,
      cancelaciones: 1,
      ticketPromedio: "50.00",
      diferenciaTicketPromedio: "0.00",
      rollosMetros: "5.00",
      rollosKilos: "0.00",
      rollosBolsas: "0.00",
      metrajeMetros: "0.00",
      metrajeBolsas: "0.00",
      efectivo: "100.00",
      transferencia: "0.00",
      credito: "0.00",
      mejorDia: { fecha: "2026-01-02", ventas: "100.00" },
      peorDia: { fecha: "2026-01-02", ventas: "100.00" },
      porcentajeFacturado: "100.00",
      diferenciaCaja: "0.00",
    }],
    promedioGeneralTicket: "50.00",
    ventasPorFecha: [{ fecha: "2026-01-02", ubicacionId: 7, nombreUbicacion: "Tienda Norte", ventas: "999.00" }],
    totales: {
      ventas: "100.00",
      subtotal: "100.00",
      costo: "80.00",
      margen: "20.00",
      tickets: 2,
      ticketPromedio: "50.00",
      cancelaciones: 1,
      lineasExcluidasMargen: 0,
      metros: "5.00",
      kilos: "0.00",
      bolsas: "0.00",
      rollosMetros: "5.00",
      rollosKilos: "0.00",
      rollosBolsas: "0.00",
      metrajeMetros: "0.00",
      metrajeBolsas: "0.00",
      efectivo: "100.00",
      transferencia: "0.00",
      credito: "0.00",
      porcentajeFacturado: "100.00",
      diferenciaCaja: "0.00",
      participacion: "100.00",
    },
  } as any);

  assert.equal(table.columns.length, 12);
  assert.deepEqual(
    table.columns.map((column) => column.label),
    [
      "Tienda",
      "Part. %",
      "Ventas",
      "Tendencia",
      "Utilidad",
      "Tickets",
      "Promedio",
      "Rollos / Metraje",
      "Medios de Pago",
      "Mejor / Peor Día",
      "Facturado %",
      "Dif. Caja",
    ],
  );
  assert.equal(table.totals.ventas, "100.00");
  assert.equal(table.totals.mejorPeorDia, null);
  assert.equal(table.totals.tendenciaPorcentaje, null);
  assert.equal(
    (table.totals as Record<string, unknown>).diferenciaTicketPromedio,
    undefined,
  );
});