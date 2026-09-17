import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import test from "node:test";
import { projectCreditLedger } from "./lib/credit-allocation";
import {
  buildEstadoCuentaExportReadQuery,
  resolveClienteFinancialReadScope,
  ticketScopeClause,
} from "./lib/clientes-financial-read-scope";
import { resolveReadScope } from "./routes/inventario";
import {
  buildAnaliticaClientesWorkbook,
  buildEstadoCuentaWorkbook,
  renderEstadoCuentaPdf,
  renderEstadoCuentaPrintHtml,
  type EstadoCuentaExportProjection,
} from "./routes/clientes";

const north = { id: 1, nombre: "Norte" };
const south = { id: 2, nombre: "Sur secreto" };
const auth = (overrides: Record<string, unknown> = {}) => ({
  sessionId: "financial-export-scope",
  location: null,
  user: {
    id: 1,
    rol: "ADMIN",
    alcanceConsulta: "TODAS",
    ubicacionId: null,
    ...overrides,
  },
}) as any;
const database = {
  async query<T>(text: string, values: readonly unknown[] = []) {
    assert.match(text, /FROM ubicaciones/);
    const ids = values[0] as number[];
    return { rows: [north, south].filter((row) => ids.includes(row.id)) as T[] };
  },
};
const scopeFixture = async (query: Record<string, unknown>) =>
  resolveClienteFinancialReadScope(
    auth(),
    query,
    database,
    resolveReadScope,
    new Date("2026-02-03T04:05:06.000Z"),
  );

const projection: EstadoCuentaExportProjection = projectCreditLedger([
  {
    id: 101,
    ticketId: 1001,
    tipo: "VENTA_CREDITO",
    importe: "100.00",
    createdAt: new Date("2026-01-01T12:00:00.000Z"),
    fechaVencimiento: "2026-01-10",
    folio: 7001,
  },
  {
    id: 102,
    ticketId: 1002,
    tipo: "VENTA_CREDITO",
    importe: "200.00",
    createdAt: new Date("2026-01-02T12:00:00.000Z"),
    fechaVencimiento: "2026-01-12",
    folio: 7002,
  },
  {
    id: 103,
    ticketId: null,
    tipo: "ABONO",
    importe: "-50.00",
    createdAt: new Date("2026-01-03T12:00:00.000Z"),
  },
], { includeMovementProjections: true });

const summary = {
  deudaActual: "250.00",
  saldoAFavor: "0.00",
  limiteCredito: "500.00",
  creditoDisponible: "250.00",
};
const northStatementRows = [{
  id: 101,
  fecha: new Date("2026-01-01T12:00:00.000Z"),
  tipo: "VENTA_CREDITO",
  importe: "100.00",
  fechaVencimiento: "2026-01-10",
  formaPago: "EFECTIVO",
  referencia: null,
  folio: 7001,
  usuario: "Cajera Norte",
  notas: "Solo Norte",
  saldoCorridoHistorico: "100.00",
}];

test("financial export scope reuses Cartera authorization for global, one, and multiple sites", async () => {
  const global = await scopeFixture({});
  assert.equal(global.tipo, "GLOBAL");
  assert.deepEqual(ticketScopeClause(global, "t", 3), { text: "", values: [] });

  const one = await scopeFixture({ ubicacionId: "1" });
  assert.equal(one.tipo, "SITIOS");
  assert.deepEqual(one.ubicaciones, [north]);
  assert.deepEqual(ticketScopeClause(one, "t", 3), {
    text: " AND t.ubicacion_id=ANY($3::int[])",
    values: [[1]],
  });

  const many = await scopeFixture({ ubicacionIds: "1,2" });
  assert.deepEqual(many.ubicaciones, [north, south]);

  const scopedStatementQuery = buildEstadoCuentaExportReadQuery(44, one);
  assert.match(scopedStatementQuery.text, /SUM\(m\.importe\) OVER \(ORDER BY m\.created_at,m\.id\)/);
  assert.match(scopedStatementQuery.text, /FROM ledger WHERE true  AND ledger\.ubicacion_id=ANY\(\$2::int\[\]\)/);
  assert.deepEqual(scopedStatementQuery.values, [44, [1]]);
  const globalStatementQuery = buildEstadoCuentaExportReadQuery(44, global);
  assert.doesNotMatch(globalStatementQuery.text, /ubicacion_id=ANY/);
  assert.deepEqual(globalStatementQuery.values, [44]);
  const multiStatementQuery = buildEstadoCuentaExportReadQuery(44, many);
  assert.deepEqual(multiStatementQuery.values, [44, [1, 2]]);
});

test("scoped XLSX, PDF, and print HTML include only authorized detail and declare the global exception", async () => {
  const scope = await scopeFixture({ ubicacionId: "1" });
  const xlsx = buildEstadoCuentaWorkbook(northStatementRows, projection, scope, summary);
  const analytic = buildAnaliticaClientesWorkbook([{
    cliente: "Cliente Norte",
    folio: 7001,
    fecha: new Date("2026-01-01T12:00:00.000Z"),
    subtotal: "100.00",
    tipo: "METREADO",
    unidad: "METRO",
    cantidad: "1.00",
    margen: "25.00",
  }], scope);
  const bytes = await xlsx.xlsx.writeBuffer();
  const parsed = new ExcelJS.Workbook();
  await parsed.xlsx.load(bytes as ArrayBuffer);
  const allCells = parsed.worksheets.flatMap((sheet) => sheet.getSheetValues().flat())
    .map((value) => String(value ?? "")).join("|");
  assert.match(allCells, /El resumen global de crédito considera todos los sitios\./);
  assert.match(allCells, /El detalle corresponde solo a los sitios autorizados y no representa la deuda total del cliente\./);
  assert.match(allCells, /250/);
  assert.match(allCells, /7001/);
  assert.doesNotMatch(allCells, /Sur secreto|7002/);
  const statement = parsed.getWorksheet("Estado de cuenta");
  assert.ok(statement);
  for (const column of [5, 6, 7, 8, 9, 10]) {
    assert.equal(statement.getCell(column, 2).value, null);
  }

  const analyticBytes = await analytic.xlsx.writeBuffer();
  const parsedAnalytic = new ExcelJS.Workbook();
  await parsedAnalytic.xlsx.load(analyticBytes as ArrayBuffer);
  const analyticCells = parsedAnalytic.worksheets.flatMap((sheet) => sheet.getSheetValues().flat())
    .map((value) => String(value ?? "")).join("|");
  assert.match(analyticCells, /El resumen global de crédito considera todos los sitios\./);
  assert.match(analyticCells, /El detalle corresponde solo a los sitios autorizados y no representa la deuda total del cliente\./);
  assert.doesNotMatch(analyticCells, /Sur secreto|7002/);

  const html = renderEstadoCuentaPrintHtml("Cliente Norte", northStatementRows, projection, scope, summary);
  assert.match(html, /El resumen global de crédito considera todos los sitios\./);
  assert.match(html, /El detalle corresponde solo a los sitios autorizados y no representa la deuda total del cliente\./);
  assert.match(html, /Solo Norte/);
  assert.doesNotMatch(html, /7002|Sur secreto/);

  const pdfBytes = renderEstadoCuentaPdf(1, northStatementRows, projection, scope, summary);
  assert.equal(pdfBytes.subarray(0, 8).toString("ascii"), "%PDF-1.4");
  const pdf = pdfBytes.toString("latin1");
  assert.match(pdf, /El resumen global de crédito considera todos los sitios\./);
  assert.match(pdf, /El detalle corresponde solo a los sitios autorizados y no representa la deuda total del cliente\./);
  assert.match(pdf, /7001/);
  assert.doesNotMatch(pdf, /7002|Sur secreto/);
});

test("global-state workbook retains the existing numeric cells while adding only scope metadata", async () => {
  const global = await scopeFixture({});
  const workbook = buildEstadoCuentaWorkbook(northStatementRows, projection, global, summary);
  const bytes = await workbook.xlsx.writeBuffer();
  const parsed = new ExcelJS.Workbook();
  await parsed.xlsx.load(bytes as ArrayBuffer);
  const statement = parsed.getWorksheet("Estado de cuenta");
  assert.ok(statement);
  assert.equal(statement.getCell("D2").value, 100);
  assert.equal(statement.getCell("E2").value, 100);
  assert.equal(statement.getCell("H2").value, 100);
  assert.equal(statement.getCell("I2").value, 0);
  assert.equal(statement.getCell("J2").value, 50);
  const total = statement.getRows(2, statement.rowCount - 1)
    ?.find((row) => row.getCell(2).value === "SALDO ACTUAL PROYECTADO");
  assert.ok(total);
  assert.equal(total.getCell(6).value, 250);
  assert.equal(total.getCell(7).value, 0);
  assert.equal(total.getCell(10).value, 250);

  const analytics = buildAnaliticaClientesWorkbook([{
    cliente: "Cliente Norte",
    folio: 7001,
    fecha: new Date("2026-01-01T12:00:00.000Z"),
    subtotal: "100.00",
    tipo: "METREADO",
    unidad: "METRO",
    cantidad: "1.25",
    margen: "25.00",
  }], global);
  const parsedAnalytics = new ExcelJS.Workbook();
  await parsedAnalytics.xlsx.load(await analytics.xlsx.writeBuffer() as ArrayBuffer);
  const analyticsSheet = parsedAnalytics.getWorksheet("Analítica");
  assert.ok(analyticsSheet);
  assert.equal(analyticsSheet.getCell("D2").value, 100);
  assert.equal(analyticsSheet.getCell("G2").value, 1.25);
  assert.equal(analyticsSheet.getCell("H2").value, 25);
});