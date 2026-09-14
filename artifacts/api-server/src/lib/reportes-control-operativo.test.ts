import assert from "node:assert/strict";
import test from "node:test";
import {
  buildControlOperativoReport,
} from "./reportes-control-operativo";
import type { listDestinationAccountMovements } from "./admin-analytics";
import type { DomainReportContext } from "./reportes-sales";

type DestinationResult = Awaited<ReturnType<typeof listDestinationAccountMovements>>;

const range = {
  desde: new Date("2026-01-01T06:00:00.000Z"),
  hasta: new Date("2026-01-31T05:59:59.999Z"),
  previousDesde: new Date("2025-12-02T06:00:00.000Z"),
  previousHasta: new Date("2026-01-01T05:59:59.999Z"),
  yearAgoDesde: new Date("2025-01-01T06:00:00.000Z"),
  yearAgoHasta: new Date("2025-02-01T05:59:59.999Z"),
};

function context(): DomainReportContext {
  return {
    input: {
      ubicacionIds: "11,22",
      unidades: "METRO",
      modalidad: "TODO",
    },
    locations: [11, 22],
    range,
  };
}

function destinationResult(
  site: number,
  page: number,
  items: DestinationResult["items"],
): DestinationResult {
  return {
    cuentaDestino: "TODAS",
    items,
    total: 2,
    page,
    pageSize: 1_000,
    montoTotal: site === 11 ? "10.25" : "20.75",
    montoTotalAnterior: site === 11 ? "5.25" : "10.75",
    variacionPorcentaje: "100.00",
    previousDesde: range.previousDesde.toISOString(),
    previousHasta: range.previousHasta.toISOString(),
  };
}

function movement(
  site: number,
  id: number,
  date: string,
  amount: string,
  documentoId = id,
): DestinationResult["items"][number] {
  return {
    id,
    fecha: date,
    tipo: "Transferencia fiscal",
    documentoTipo: "MOVIMIENTO_CREDITO",
    documentoId,
    documento: `Abono #${id}`,
    clienteId: 100 + site,
    cliente: `Cliente ${site}`,
    ubicacionId: site,
    sitio: `Sitio ${site}`,
    cuentaDestino: "CUENTA_NO_FISCAL",
    monto: amount,
    formaPago: "TRANSFERENCIA",
    facturado: true,
    fuente: "ABONO",
    incongruente: true,
    registroId: site,
    registro: `Usuario ${site}`,
  };
}

test("control operativo performs explicit per-site reads and preserves scalar metrics", async () => {
  const calls: Array<{
    ubicacionId: number | undefined;
    desde: Date | undefined;
    hasta: Date | undefined;
    page: number;
    options: Record<string, unknown>;
  }> = [];
  const cancellationContexts: DomainReportContext[] = [];
  const read = async (
    filters: Parameters<typeof import("./admin-analytics").listDestinationAccountMovements>[0],
    _destination: "TODAS",
    page: number,
    _pageSize: number,
    options: Record<string, unknown>,
  ): Promise<DestinationResult> => {
    calls.push({
      ubicacionId: filters.ubicacionId,
      desde: filters.desde,
      hasta: filters.hasta,
      page,
      options,
    });
    const site = filters.ubicacionId!;
    const item = site === 11
      ? movement(site, page === 1 ? 111 : 112, page === 1 ? "2026-01-20T00:00:00.000Z" : "2026-01-10T00:00:00.000Z", page === 1 ? "4.25" : "6.00", page === 1 ? 9111 : undefined)
      : movement(site, page === 1 ? 221 : 222, page === 1 ? "2026-01-19T00:00:00.000Z" : "2026-01-09T00:00:00.000Z", page === 1 ? "8.75" : "12.00");
    return destinationResult(site, page, [item]);
  };
  const report = await buildControlOperativoReport(context(), {
    listDestinationAccountMovements: read,
    loadCancellationRows: async (ctx) => {
      cancellationContexts.push(ctx);
      return {
        summary: [],
        rows: [
          {
            ticketId: 700,
            folio: "T-700",
            motivo: null,
            sitio: "Sitio 11",
            modalidad: "ROLLOS",
            lineas: 1,
            importe: 12.5,
            canceladoAt: null,
            documentoHref: "/tickets/700",
          },
          {
            ticketId: 700,
            folio: "T-700",
            motivo: null,
            sitio: "Sitio 11",
            modalidad: "METRAJE",
            lineas: 1,
            importe: 3.25,
            canceladoAt: null,
            documentoHref: "/tickets/700",
          },
        ],
        products: [],
      };
    },
    loadCancelledExits: async () => [],
    loadOverdueSalidaRows: async () => [],
    loadInventoryAdjustments: async () => [],
    loadLabelReprints: async () => [{
      rolloId: 42,
      serie: "R-42",
      sku: "SKU-42",
      producto: "Tela de prueba",
      tela: "Tela",
      color: "Azul",
      sitio: "Sitio 11",
      reimpresiones: 3,
      ultimaReimpresionAt: "2026-01-20T00:00:00.000Z",
      rolloHref: "/inventario/rollos/42",
      documentoHref: "/inventario/rollos/42",
    }],
  });

  assert.deepEqual(
    calls
      .map(({ ubicacionId, page }) => ({ ubicacionId, page }))
      .sort((left, right) => left.ubicacionId! - right.ubicacionId! || left.page - right.page),
    [
      { ubicacionId: 11, page: 1 },
      { ubicacionId: 11, page: 2 },
      { ubicacionId: 22, page: 1 },
      { ubicacionId: 22, page: 2 },
    ],
  );
  for (const site of [11, 22]) {
    const sitePages = calls
      .filter((call) => call.ubicacionId === site)
      .map((call) => call.page);
    assert.deepEqual(sitePages, [1, 2], `site ${site} pages must advance in order`);
  }
  assert.ok(calls.every((call) =>
    call.ubicacionId !== undefined &&
    call.desde === range.desde &&
    call.hasta === range.hasta &&
    call.options.incongruente === true
  ));
  assert.deepEqual(cancellationContexts, [context()]);

  const tables = report.tables as Array<{
    id: string;
    columns: Array<{ key: string; hrefKey?: string }>;
    rows: unknown[];
    totals: Record<string, unknown>;
  }>;
  const kpis = report.kpis as Array<{ id: string; value: unknown }>;
  const incongruent = tables.find((table) => table.id === "abonos-incongruentes")!;
  assert.equal(incongruent.rows.length, 4);
  assert.equal(incongruent.totals.importe, 31);
  assert.match(
    String((incongruent.rows[0] as { documentoHref: string }).documentoHref),
    /^\/caja\/cuentas-destino\/CUENTA_NO_FISCAL\?desde=2026-01-01&hasta=2026-01-30&ubicacionId=11&incongruente=true&movimientoId=111$/,
  );
  assert.equal((incongruent.rows[0] as { movimientoId: string }).movimientoId, "111");
  assert.equal(kpis.find((kpi) => kpi.id === "abonos-incongruentes")?.value, 4);
  assert.equal(kpis.find((kpi) => kpi.id === "tickets-cancelados")?.value, 1);
  assert.equal(kpis.find((kpi) => kpi.id === "importe-tickets-cancelados")?.value, 15.75);
  assert.equal(report.charts.length, 0);
  const reprints = tables.find((item) => item.id === "reimpresiones-etiqueta")!;
  assert.equal(reprints.rows.length, 1);
  assert.equal(reprints.columns.find((column) => column.key === "documentoHref")?.hrefKey, "documentoHref");
  assert.ok(reprints.columns.every((column) => !column.key.startsWith("historial")));
  const reprint = reprints.rows[0] as Record<string, unknown>;
  assert.equal(reprint.documentoHref, "/inventario/rollos/42");
  assert.equal(reprint.rolloHref, "/inventario/rollos/42");
  assert.equal(reprint.reimpresiones, 3);
  assert.equal(reprint.ultimaReimpresionAt, "2026-01-20T00:00:00.000Z");
  assert.deepEqual(
    tables.map((table) => table.id),
    [
      "ajustes-inventario",
      "salidas-canceladas",
      "salidas-vencidas",
      "abonos-incongruentes",
      "cancelaciones-control",
      "reimpresiones-etiqueta",
    ],
  );
});

test("control forwards the shared Sales filter context without rebuilding date or unit filters", async () => {
  const seen: DomainReportContext[] = [];
  const ctx = context();
  await buildControlOperativoReport(ctx, {
    listDestinationAccountMovements: async (filters) => ({
      cuentaDestino: "TODAS",
      items: [],
      total: 0,
      page: 1,
      pageSize: 1_000,
      montoTotal: "0.00",
      montoTotalAnterior: "0.00",
      variacionPorcentaje: "0.00",
      previousDesde: filters.desde!.toISOString(),
      previousHasta: filters.hasta!.toISOString(),
    }),
    loadCancellationRows: async (incoming) => {
      seen.push(incoming);
      return { summary: [], rows: [], products: [] };
    },
    loadCancelledExits: async () => [],
    loadOverdueSalidaRows: async () => [],
    loadInventoryAdjustments: async () => [],
    loadLabelReprints: async () => [],
  });

  // Sales and Control both consume loadCancellationRows(ctx); preserving the
  // object contract here prevents a second, divergent date/unit predicate.
  assert.deepEqual(seen, [ctx]);
  assert.deepEqual(seen[0]!.input, {
    ubicacionIds: "11,22",
    unidades: "METRO",
    modalidad: "TODO",
  });
  assert.deepEqual(seen[0]!.locations, [11, 22]);
  assert.equal(seen[0]!.range.desde, range.desde);
  assert.equal(seen[0]!.range.hasta, range.hasta);
});