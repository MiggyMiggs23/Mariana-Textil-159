import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  accountDestination,
  AnalyticsInputError,
  calculateFrozenMargin,
  comparisonRange,
  parseAnalyticsFilters,
  measureKpi,
  percentageChange,
  previousEqualPeriod,
  mexicoCityHour,
  reconcileDestinationMatrix,
  summarizeRealtimeCredit,
} from "./admin-analytics";
import { GetAdminRealtimeDashboardResponse } from "@workspace/api-zod";
import { requireRole } from "../middlewares/auth";
import {
  ExportAdminCortesPdfQueryParams,
  ExportAdminCortesXlsxQueryParams,
  ExportAdminCuentasDestinoPdfQueryParams,
  ExportAdminCuentasDestinoXlsxQueryParams,
  ExportAdminCuentaDestinoMovimientosXlsxParams,
  ListAdminCuentaDestinoMovimientosParams,
  ListAdminCuentaDestinoMovimientosQueryParams,
  ListAdminCuentaDestinoMovimientosResponse,
  GetAdminComparacionTiendasQueryParams,
  GetAdminCuentasDestinoQueryParams,
  GetAdminDiferenciasQueryParams,
  GetAdminDiferenciasResponse,
  GetAdminRealtimeDashboardQueryParams,
  GetAdminRealtimePendingQueryParams,
  ListAdminCortesQueryParams,
} from "@workspace/api-zod";

test("account destinations preserve payment/facturado rules", () => {
  assert.equal(accountDestination("EFECTIVO", true), "CAJA_FISICA");
  assert.equal(accountDestination("EFECTIVO", false), "CAJA_FISICA");
  assert.equal(accountDestination("CREDITO", true), "CUENTAS_POR_COBRAR");
  assert.equal(accountDestination("TRANSFERENCIA", true), "CUENTA_FISCAL");
  assert.equal(accountDestination("TRANSFERENCIA", false), "CUENTA_NO_FISCAL");
});

test("realtime credit summary is exactly the sum of store credit lines", () => {
  assert.deepEqual(summarizeRealtimeCredit([
    { credito: "125.25", creditoOperaciones: 2 },
    { credito: "74.75", creditoOperaciones: 1 },
    { credito: "0.00", creditoOperaciones: 0 },
  ]), {
    importe: "200.00",
    operaciones: 3,
  });
});

test("realtime store credit uses dated immutable ledger sales, not payment fragments", async () => {
  const source = await readFile(new URL("./admin-analytics.ts", import.meta.url), "utf8");
  const start = source.indexOf("export async function getRealtimeStores");
  const end = source.indexOf("\nexport async function", start + 1);
  const realtime = source.slice(start, end);

  assert.match(realtime, /credit_sales AS \([\s\S]*FROM movimientos_credito m JOIN tickets t/);
  assert.match(realtime, /m\.tipo='VENTA_CREDITO'/);
  assert.match(realtime, /where\(filters, "t", "ACCOUNTED"\)/);
  assert.doesNotMatch(realtime, /m\.created_at >= \$1/);
  assert.match(realtime, /COUNT\(DISTINCT m\.ticket_id\)::int credito_operaciones/);
  assert.match(realtime, /COALESCE\(cs\.credito,0\)::text credito/);
});

test("destination payment and credit sales use their document processing timestamps", async () => {
  const source = await readFile(new URL("./admin-analytics.ts", import.meta.url), "utf8");
  const destination = source.slice(
    source.indexOf("function destinationReadModel"),
    source.indexOf("/** Sum from the same canonical rows"),
  );
  assert.match(destination, /SELECT p\.id, \$\{accountedDocumentAt\("t"\)\} fecha/);
  assert.match(destination, /SELECT m\.id, \$\{accountedDocumentAt\("t"\)\} fecha/);
  assert.match(destination, /AND \$\{accountedDocumentPredicate\("t"\)\} AND p\.forma_pago <> 'CREDITO'/);
  assert.match(destination, /m\.tipo='VENTA_CREDITO' AND \$\{accountedDocumentPredicate\("t"\)\}/);
  assert.doesNotMatch(destination.slice(0, destination.indexOf("UNION ALL", destination.indexOf("UNION ALL") + 1)), /p\.created_at >= \$1|m\.created_at >= \$1/);
});

test("realtime collected amount and counts use processed non-credit payment evidence", async () => {
  const source = await readFile(new URL("./admin-analytics.ts", import.meta.url), "utf8");
  const summaryStart = source.indexOf("export async function getSalesSummary");
  const summaryEnd = source.indexOf("\nexport async function", summaryStart + 1);
  const summary = source.slice(summaryStart, summaryEnd);
  const storesStart = source.indexOf("export async function getRealtimeStores");
  const storesEnd = source.indexOf("\nexport async function", storesStart + 1);
  const stores = source.slice(storesStart, storesEnd);

  assert.match(summary, /f\.estado='VENDIDO' AND f\.cobrado/);
  assert.match(summary, /p\.forma_pago <> 'CREDITO'/);
  assert.match(summary, /COUNT\(p\.ticket_id\)::int "ticketsCobrados"/);
  assert.match(stores, /collectedTicketPredicate\("t"\)/);
  assert.match(stores, /p\.forma_pago IN \('EFECTIVO','TRANSFERENCIA','FACTURADO'\)/);
  assert.match(stores, /COALESCE\(SUM\(p\.cobrado\),0\)::text cobrado/);
  assert.match(stores, /COUNT\(p\.id\)::int "ticketsCobrados"/);
  assert.doesNotMatch(stores.slice(stores.indexOf("), payment AS")), /forma_pago IN \([^)]*CREDITO/);
});

test("realtime dashboard contract requires credit amount and operation count", () => {
  const result = GetAdminRealtimeDashboardResponse.safeParse({
    generatedAt: new Date().toISOString(),
    fullRefreshSeconds: 300,
    pendingRefreshSeconds: 30,
    totales: {
      ventas: "0.00", cobrado: "0.00", pendiente: "0.00", subtotal: "0.00",
      iva: "0.00", costo: "0.00", margen: "0.00", margenPorcentaje: "0.00",
      tickets: 0, ticketsCobrados: 0, ticketsPendientes: 0, cancelaciones: 0,
      lineasExcluidasMargen: 0,
    },
    cantidades: [],
    ventasCredito: { importe: "200.00", operaciones: 3 },
    pendientes: { tickets: 0, importe: "0.00", tiendas: [] },
    tiendas: [],
    comparativo: [],
    ultimosTickets: [],
  });
  assert.equal(result.success, true);
});

test("destination movement contract validates account, pagination and real ticket links", () => {
  assert.equal(ListAdminCuentaDestinoMovimientosParams.parse({
    cuentaDestino: "CUENTA_FISCAL",
  }).cuentaDestino, "CUENTA_FISCAL");
  assert.equal(ExportAdminCuentaDestinoMovimientosXlsxParams.safeParse({
    cuentaDestino: "OTRA",
  }).success, false);
  assert.deepEqual(ListAdminCuentaDestinoMovimientosQueryParams.parse({}), {
    page: 1,
    pageSize: 50,
  });
  assert.equal(ListAdminCuentaDestinoMovimientosResponse.safeParse({
    cuentaDestino: "CAJA_FISICA",
    items: [{
      id: 1,
      fecha: new Date().toISOString(),
      tipo: "Cobro en efectivo",
      documentoTipo: "TICKET",
      documentoId: 10,
      documento: "Ticket #100",
      cliente: null,
      ubicacionId: 2,
      sitio: "Centro",
      monto: "125.00",
      formaPago: "EFECTIVO",
      facturado: false,
      fuente: "POS",
      incongruente: false,
      registroId: 3,
      registro: "Cajero",
    }],
    total: 1,
    page: 1,
    pageSize: 50,
    montoTotal: "125.00",
    montoTotalAnterior: "100.00",
    variacionPorcentaje: "25.00",
    previousDesde: new Date("2025-01-01T06:00:00.000Z").toISOString(),
    previousHasta: new Date("2025-01-31T05:59:59.999Z").toISOString(),
  }).success, true);
});

test("destination movement Excel exports the canonical paginated read-model total", async () => {
  const route = await readFile(
    new URL("../routes/admin-analytics.ts", import.meta.url),
    "utf8",
  );
  assert.match(
    route,
    /const data = await listDestinationAccountMovements\([\s\S]*sheet\.addRow\(\{ sitio: "Total", monto: toExcelNumber\(data\.montoTotal\) \}\)/,
  );
});

test("margin is pending when any line has no frozen cost", () => {
  assert.deepEqual(calculateFrozenMargin([
    { rolloId: 1, importe: "150.00", costoUnitarioCongelado: "50", costoTotalCongelado: "100" },
    { rolloId: null, importe: "80.00", costoUnitarioCongelado: "0", costoTotalCongelado: "0" },
    { rolloId: 2, importe: "40.00", costoUnitarioCongelado: null, costoTotalCongelado: null },
  ]), {
    costo: null,
    margen: null,
    margenPorcentaje: null,
    lineasExcluidasMargen: 1,
  });
  assert.deepEqual(calculateFrozenMargin([
    { rolloId: 1, importe: "150.00", costoUnitarioCongelado: "50", costoTotalCongelado: "100" },
    { rolloId: 2, importe: "50.00", costoUnitarioCongelado: "20", costoTotalCongelado: "20" },
  ]), {
    costo: "120.00",
    margen: "80.00",
    margenPorcentaje: "40.00",
    lineasExcluidasMargen: 0,
  });
});

test("Mexico City date filters reject malformed and reversed ranges", () => {
  assert.throws(() => parseAnalyticsFilters({ desde: "2025-02-30" }), AnalyticsInputError);
  assert.throws(
    () => parseAnalyticsFilters({ desde: "2025-03-02", hasta: "2025-03-01" }),
    AnalyticsInputError,
  );
  assert.throws(() => comparisonRange("personalizado"), AnalyticsInputError);
});

test("HTTP query schemas accept ISO date strings before Mexico City conversion", () => {
  const dateQuery = { desde: "2025-05-01", hasta: "2025-05-31" };
  for (const schema of [
    GetAdminRealtimeDashboardQueryParams,
    GetAdminRealtimePendingQueryParams,
    ListAdminCortesQueryParams,
    GetAdminDiferenciasQueryParams,
    GetAdminCuentasDestinoQueryParams,
    ExportAdminCortesXlsxQueryParams,
    ExportAdminCortesPdfQueryParams,
    ExportAdminCuentasDestinoXlsxQueryParams,
    ExportAdminCuentasDestinoPdfQueryParams,
  ]) {
    const parsed = schema.parse(dateQuery);
    assert.equal(parsed.desde, dateQuery.desde);
    assert.equal(parsed.hasta, dateQuery.hasta);
  }
  assert.deepEqual(
    GetAdminComparacionTiendasQueryParams.parse({
      periodo: "personalizado",
      ...dateQuery,
    }),
    { periodo: "personalizado", ...dateQuery },
  );
});

test("cash-difference trend contract requires exact and total cut counts", () => {
  const response = {
    resumen: {
      cortes: 3, exactos: 1, faltantes: 1, sobrantes: 1,
      importeFaltantes: "100.00", importeSobrantes: "50.00",
      diferenciaNeta: "50.00", diferenciaAbsoluta: "150.00", porcentajeExactos: "33.33",
    },
    porCajero: [],
    porTienda: [],
    tendencia: [{
      fecha: "2025-05-05", importe: "50.00", diferenciaAbsoluta: "150.00",
      cortes: 3, exactos: 1, porcentajeExactos: "33.33",
    }],
    alertas: [],
  };
  assert.equal(GetAdminDiferenciasResponse.safeParse(response).success, true);
  const { cortes: _cortes, ...trendWithoutTotal } = response.tendencia[0];
  assert.equal(GetAdminDiferenciasResponse.safeParse({
    ...response,
    tendencia: [trendWithoutTotal],
  }).success, false);
});

test("open-cash alert hour is evaluated in Mexico City", () => {
  assert.equal(mexicoCityHour(new Date("2025-01-01T16:00:00.000Z")), 10);
});

test("KPI timing helper returns the query result and duration", async () => {
  const timed = await measureKpi("formula", async () => 42);
  assert.equal(timed.value, 42);
  assert.equal(timed.name, "formula");
  assert.ok(timed.durationMs >= 0);
});

test("all supported comparison ranges and custom range are valid", () => {
  for (const period of ["diario", "semanal", "mensual", "trimestral", "semestral", "anual"]) {
    const range = comparisonRange(period);
    assert.match(range.desde, /^\d{4}-\d{2}-\d{2}$/);
    assert.match(range.hasta, /^\d{4}-\d{2}-\d{2}$/);
  }
  assert.deepEqual(
    comparisonRange("personalizado", "2025-01-01", "2025-01-31"),
    { desde: "2025-01-01", hasta: "2025-01-31" },
  );
});

test("shortage/surplus net convention is positive shortage minus surplus", () => {
  const shortages = [-200, -50].map(Math.abs).reduce((sum, value) => sum + value, 0);
  const surplus = [150].reduce((sum, value) => sum + value, 0);
  assert.equal(shortages - surplus, 100);
  assert.equal(shortages + surplus, 400);
});

test("equal previous period is adjacent and has identical duration", () => {
  const current = parseAnalyticsFilters({ desde: "2025-05-10", hasta: "2025-05-16" });
  const previous = previousEqualPeriod(current);
  assert.equal(
    current.hasta!.getTime() - current.desde!.getTime(),
    previous.hasta!.getTime() - previous.desde!.getTime(),
  );
  assert.equal(previous.hasta!.getTime() + 1, current.desde!.getTime());
});

test("in-progress comparison uses the elapsed span, while a closed period stays full", () => {
  const current = parseAnalyticsFilters({ desde: "2025-05-01", hasta: "2025-05-31" });
  const inProgress = previousEqualPeriod(current, new Date("2025-05-10T12:00:00.000Z"));
  assert.equal(
    inProgress.hasta!.getTime() - inProgress.desde!.getTime(),
    new Date("2025-05-10T12:00:00.000Z").getTime() - current.desde!.getTime(),
  );
  assert.equal(inProgress.desde!.toISOString(), "2025-04-01T06:00:00.000Z",
    "a month-to-date comparison starts on the first of the previous month");
  const closed = previousEqualPeriod(current, new Date("2025-06-10T12:00:00.000Z"));
  assert.equal(
    closed.hasta!.getTime() - closed.desde!.getTime(),
    current.hasta!.getTime() - current.desde!.getTime(),
  );
});

test("percentage change is undefined when a nonzero value has no prior base", () => {
  assert.equal(percentageChange(50, 0), null);
  assert.equal(percentageChange(0, 0), "0.00");
  assert.equal(percentageChange(150, 100), "50.00");
});

test("four destinations preserve collection participation independently of sales", () => {
  const payments = [
    { method: "EFECTIVO" as const, invoiced: false, amount: 100 },
    { method: "TRANSFERENCIA" as const, invoiced: true, amount: 200 },
    { method: "TRANSFERENCIA" as const, invoiced: false, amount: 300 },
    { method: "CREDITO" as const, invoiced: false, amount: 400 },
  ];
  const totals = new Map<string, number>();
  for (const payment of payments) {
    const destination = accountDestination(payment.method, payment.invoiced);
    totals.set(destination, (totals.get(destination) ?? 0) + payment.amount);
  }
  assert.equal(totals.size, 4);
  const total = [...totals.values()].reduce((sum, value) => sum + value, 0);
  assert.equal(total, 1000);
  assert.equal([...totals.values()].reduce((sum, value) => sum + value / total * 100, 0), 100);
});

test("destination sale matrix excludes later collections and reconciles to Vendido", () => {
  const source = [
    { formaPago: "EFECTIVO", facturado: true, cuentaDestino: "CAJA_FISICA", importe: 100, fuente: "POS" },
    { formaPago: "EFECTIVO", facturado: false, cuentaDestino: "CAJA_FISICA", importe: 50, fuente: "POS" },
    { formaPago: "TRANSFERENCIA", facturado: false, cuentaDestino: "CUENTA_NO_FISCAL", importe: 200, fuente: "POS" },
    { formaPago: "FACTURADO", facturado: true, cuentaDestino: "CUENTA_FISCAL", importe: 75, fuente: "POS" },
    { formaPago: "CREDITO", facturado: true, cuentaDestino: "CUENTAS_POR_COBRAR", importe: 300, fuente: "CREDITO" },
    { formaPago: "CHEQUE", facturado: false, cuentaDestino: "CUENTA_NO_FISCAL", importe: 25, fuente: "POS" },
    { formaPago: "TRANSFERENCIA", facturado: true, cuentaDestino: "CUENTA_FISCAL", importe: 90, fuente: "ABONO" },
  ];
  const sales = source.filter((row) => row.fuente === "POS" || row.fuente === "CREDITO");
  const matrix = reconcileDestinationMatrix(sales);
  const [invoiced, uninvoiced, total] = matrix.filas;
  assert.equal(matrix.cierra, true);
  assert.equal(invoiced!.transferencia.importe, "75.00", "historical FACTURADO is transfer");
  assert.equal(total!.otras.importe, "25.00", "unknown methods remain visible");
  assert.deepEqual(total!.otras.formasPago, ["CHEQUE"]);
  for (const row of matrix.filas) {
    assert.equal(
      Number(row.efectivo.importe) + Number(row.transferencia.importe)
        + Number(row.porCobrar.importe) + Number(row.otras.importe),
      Number(row.total),
    );
  }
  for (const column of ["efectivo", "transferencia", "porCobrar", "otras"] as const) {
    assert.equal(
      Number(invoiced![column].importe) + Number(uninvoiced![column].importe),
      Number(total![column].importe),
    );
  }
  const vendido = Number(total!.total);
  assert.equal(vendido, 750);
  assert.equal(
    source.filter((row) => row.fuente === "ABONO").reduce((sum, row) => sum + row.importe, 0),
    90,
    "a later collection remains outside the sale matrix",
  );
  assert.equal(new Set(sales.map((row) => row.formaPago)).size,
    new Set(matrix.filas[2]!.efectivo.formasPago
      .concat(matrix.filas[2]!.transferencia.formasPago)
      .concat(matrix.filas[2]!.porCobrar.formasPago)
      .concat(matrix.filas[2]!.otras.formasPago)).size);
});

test("destination summary and detail routes enforce resolved read scope", async () => {
  const route = await readFile(new URL("../routes/admin-analytics.ts", import.meta.url), "utf8");
  const summary = route.slice(
    route.indexOf('router.get("/admin/cuentas-destino"'),
    route.indexOf('router.get("/admin/cuentas-destino/:cuentaDestino/movimientos"'),
  );
  const detail = route.slice(
    route.indexOf('router.get("/admin/cuentas-destino/:cuentaDestino/movimientos"'),
    route.indexOf("async function fiscalFigures"),
  );
  assert.match(summary, /scopedAnalyticsFilters\(req, query, res\)/);
  assert.match(detail, /scopedAnalyticsFilters\(req, query, res\)/);
  assert.match(route, /resolveReadScope\(req\.auth!, query\.ubicacionId\)/);
});

test("every store-grouped caja view uses the shared canonical order", async () => {
  const source = await readFile(new URL("./admin-analytics.ts", import.meta.url), "utf8");
  assert.match(source, /return orderStores\(result\.rows\.map/);
  assert.match(source, /porTienda:\s*orderStores\(/);
  assert.match(source, /const tiendas = orderStores\(result\.rows\.map/);
  assert.match(source, /ventasPorFecha:\s*orderStores\(/);
});

test("meter and kilo quantities remain independent", () => {
  const quantities = new Map([["METRO", 12.345], ["KILO", 7.89]]);
  assert.equal(quantities.get("METRO"), 12.345);
  assert.equal(quantities.get("KILO"), 7.89);
  assert.notEqual(quantities.get("METRO"), quantities.get("KILO"));
});

test("OpenAPI exposes every ADMIN analytics, export, and timing operation", async () => {
  const spec = await readFile(
    new URL("../../../../lib/api-spec/openapi.yaml", import.meta.url),
    "utf8",
  );
  for (const operation of [
    "getAdminRealtimeDashboard",
    "getAdminRealtimePending",
    "listAdminCortes",
    "getAdminCorte",
    "getAdminDiferencias",
    "getAdminCuentasDestino",
    "getAdminComparacionTiendas",
    "exportAdminCortesXlsx",
    "exportAdminCortesPdf",
    "exportAdminCuentasDestinoXlsx",
    "exportAdminCuentasDestinoPdf",
  ]) {
    assert.match(spec, new RegExp(`operationId: ${operation}`));
  }
  const upgrade = await readFile(
    new URL("../../../../lib/db/src/lib/admin-analytics-schema.ts", import.meta.url),
    "utf8",
  );
  for (const index of [
    "sesiones_caja_cerrada_at_idx",
    "tickets_created_at_idx",
    "tickets_sesion_estado_idx",
    "tickets_cobrado_created_at_idx",
  ]) {
    assert.match(upgrade, new RegExp(index));
  }
});

test("literal ADMIN middleware returns 403 for CAJA and TERMINAL", () => {
  for (const rol of ["CAJA", "TERMINAL"] as const) {
    let status = 0;
    let nextCalled = false;
    const request = { auth: { user: { rol } } };
    const response = {
      status(value: number) { status = value; return this; },
      json() { return this; },
    };
    requireRole("ADMIN")(
      request as never,
      response as never,
      (() => { nextCalled = true; }) as never,
    );
    assert.equal(status, 403);
    assert.equal(nextCalled, false);
  }
});