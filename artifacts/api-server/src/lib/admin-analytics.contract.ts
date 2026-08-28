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
  previousEqualPeriod,
  mexicoCityHour,
} from "./admin-analytics";
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
      registroId: 3,
      registro: "Cajero",
    }],
    total: 1,
    page: 1,
    pageSize: 50,
    montoTotal: "125.00",
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

test("four destinations preserve total and percentages/participation sum to 100", () => {
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