import { Router, type IRouter } from "express";
import ExcelJS from "exceljs";
import {
  ExportAdminCortesPdfQueryParams,
  ExportAdminCortePdfParams,
  ExportAdminCorteXlsxParams,
  ExportAdminCortesXlsxQueryParams,
  ExportAdminCuentasDestinoPdfQueryParams,
  ExportAdminCuentasDestinoXlsxQueryParams,
  ExportAdminCuentaDestinoMovimientosXlsxParams,
  ExportAdminCuentaDestinoMovimientosXlsxQueryParams,
  GetAdminComparacionTiendasQueryParams,
  GetAdminComparacionTiendasResponse,
  GetAdminCorteParams,
  GetAdminCorteResponse,
  GetAdminCuentasDestinoQueryParams,
  GetAdminCuentasDestinoResponse,
  ListAdminCuentaDestinoMovimientosParams,
  ListAdminCuentaDestinoMovimientosQueryParams,
  ListAdminCuentaDestinoMovimientosResponse,
  GetAdminDiferenciasQueryParams,
  GetAdminDiferenciasResponse,
  GetAdminRealtimeDashboardQueryParams,
  GetAdminRealtimeDashboardResponse,
  GetAdminRealtimePendingQueryParams,
  GetAdminRealtimePendingResponse,
  ListAdminCortesQueryParams,
  ListAdminCortesResponse,
} from "@workspace/api-zod";
import { EXCEL_NUMBER_FORMAT, formatAccountDestination, formatNumber, toExcelNumber } from "@workspace/number-format";
import { requireRole, requireSession } from "../middlewares/auth";
import { buildCorteCaja } from "../lib/pos";
import { db } from "@workspace/db";
import { createTextPdf } from "../lib/pdf";
import {
  AnalyticsInputError,
  compareStores,
  comparisonRange,
  getDestinationAccounts,
  isAccountDestination,
  listDestinationAccountMovements,
  getDifferences,
  getPending,
  getQuantities,
  getRealtimeStores,
  getRealtimeTickets,
  getSalesSummary,
  getSessionMargin,
  measureKpi,
  listCuts,
  parseAnalyticsFilters,
} from "../lib/admin-analytics";

const router: IRouter = Router();
router.use("/admin", requireSession, requireRole("ADMIN"));

function badInput(error: unknown, res: Parameters<Parameters<IRouter["get"]>[1]>[1]): boolean {
  if (!(error instanceof AnalyticsInputError)) return false;
  res.status(400).json({ error: error.message, code: "VALIDATION_ERROR" });
  return true;
}

router.get("/admin/dashboard/realtime", async (req, res, next): Promise<void> => {
  try {
    const query = GetAdminRealtimeDashboardQueryParams.parse(req.query);
    const filters = parseAnalyticsFilters(query);
    const timed = await measureKpi("admin-realtime", async () => Promise.all([
      getSalesSummary(filters), getQuantities(filters), getPending(filters),
      getRealtimeStores(filters), getRealtimeTickets(filters),
    ]));
    const [totales, cantidades, pendientes, tiendas, ultimosTickets] = timed.value;
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("Server-Timing", `${timed.name};dur=${timed.durationMs.toFixed(1)}`);
    res.json(GetAdminRealtimeDashboardResponse.parse({
      generatedAt: new Date().toISOString(),
      fullRefreshSeconds: 300,
      pendingRefreshSeconds: 30,
      totales, cantidades,
      pendientes: {
        ...pendientes,
        tiendas: tiendas.map((store) => ({
          ubicacionId: store.ubicacionId,
          pendiente: store.pendiente,
          pendientes30Min: store.pendientes30Min,
          alertas: store.alertas,
        })),
      },
      tiendas,
      comparativo: tiendas,
      ultimosTickets,
    }));
  } catch (error) {
    if (!badInput(error, res)) next(error);
  }
});

router.get("/admin/dashboard/realtime/pendientes", async (req, res, next): Promise<void> => {
  try {
    const query = GetAdminRealtimePendingQueryParams.parse(req.query);
    res.setHeader("Cache-Control", "private, no-store");
    const filters = parseAnalyticsFilters(query);
    const [pending, stores] = await Promise.all([getPending(filters), getRealtimeStores(filters)]);
    res.json(GetAdminRealtimePendingResponse.parse({
      ...pending,
      tiendas: stores.map((store) => ({
        ubicacionId: store.ubicacionId,
        pendiente: store.pendiente,
        pendientes30Min: store.pendientes30Min,
        alertas: store.alertas,
      })),
    }));
  } catch (error) {
    if (!badInput(error, res)) next(error);
  }
});

router.get("/admin/cortes", async (req, res, next): Promise<void> => {
  try {
    const query = ListAdminCortesQueryParams.parse(req.query);
    res.json(ListAdminCortesResponse.parse(
      await listCuts(parseAnalyticsFilters(query), query.page, query.pageSize, {
        cajeroId: query.cajeroId,
        numeroCorte: query.numeroCorte,
        soloConDiferencia: query.soloConDiferencia,
      }),
    ));
  } catch (error) {
    if (!badInput(error, res)) next(error);
  }
});

router.get("/admin/diferencias", async (req, res, next): Promise<void> => {
  try {
    const query = GetAdminDiferenciasQueryParams.parse(req.query);
    res.json(GetAdminDiferenciasResponse.parse(await getDifferences(
      parseAnalyticsFilters(query),
      {
        umbralCorte: query.umbralCorte,
        umbralTienda: query.umbralTienda,
        agrupacion: query.agrupacion,
      },
    )));
  } catch (error) {
    if (!badInput(error, res)) next(error);
  }
});

router.get("/admin/cuentas-destino", async (req, res, next): Promise<void> => {
  try {
    const query = GetAdminCuentasDestinoQueryParams.parse(req.query);
    res.json(GetAdminCuentasDestinoResponse.parse(
      await getDestinationAccounts(parseAnalyticsFilters(query)),
    ));
  } catch (error) {
    if (!badInput(error, res)) next(error);
  }
});

router.get("/admin/cuentas-destino/:cuentaDestino/movimientos", async (req, res, next): Promise<void> => {
  try {
    const { cuentaDestino } = ListAdminCuentaDestinoMovimientosParams.parse(req.params);
    const query = ListAdminCuentaDestinoMovimientosQueryParams.parse(req.query);
    if (!isAccountDestination(cuentaDestino)) {
      res.status(400).json({ error: "Cuenta destino inválida.", code: "VALIDATION_ERROR" });
      return;
    }
    res.json(ListAdminCuentaDestinoMovimientosResponse.parse(
      await listDestinationAccountMovements(
        parseAnalyticsFilters(query),
        cuentaDestino,
        query.page,
        query.pageSize,
      ),
    ));
  } catch (error) {
    if (!badInput(error, res)) next(error);
  }
});

router.get("/admin/comparacion-tiendas", async (req, res, next): Promise<void> => {
  try {
    const query = GetAdminComparacionTiendasQueryParams.parse(req.query);
    const range = comparisonRange(query.periodo, query.desde, query.hasta);
    const filters = parseAnalyticsFilters(range);
    const comparison = await compareStores(filters);
    res.json(GetAdminComparacionTiendasResponse.parse({
      periodo: query.periodo,
      ...range,
      ...comparison,
    }));
  } catch (error) {
    if (!badInput(error, res)) next(error);
  }
});

async function cutsXlsx(req: Parameters<IRouter["get"]>[1] extends (...args: infer P) => unknown ? P[0] : never, res: any) {
  const query = ExportAdminCortesXlsxQueryParams.parse(req.query);
  const data = await listCuts(parseAnalyticsFilters(query), 1, 10_000, {
    cajeroId: query.cajeroId, numeroCorte: query.numeroCorte,
    soloConDiferencia: query.soloConDiferencia,
  });
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Cortes");
  sheet.columns = [
    { header: "Corte", key: "id", width: 10 }, { header: "Tienda", key: "nombreUbicacion", width: 25 },
    { header: "Cajero", key: "nombreUsuario", width: 25 }, { header: "Apertura", key: "abiertaAt", width: 22 },
    { header: "Total cobrado", key: "totalCobrado", width: 16 }, { header: "Esperado", key: "efectivoEsperado", width: 16 },
    { header: "Contado", key: "efectivoContado", width: 16 }, { header: "Diferencia", key: "diferencia", width: 16 },
    { header: "Cancelaciones", key: "ticketsCancelados", width: 16 },
  ];
  for (const key of ["totalCobrado", "efectivoEsperado", "efectivoContado", "diferencia"]) sheet.getColumn(key).numFmt = EXCEL_NUMBER_FORMAT.money;
  sheet.getColumn("ticketsCancelados").numFmt = EXCEL_NUMBER_FORMAT.count;
  sheet.addRows(data.items.map((row) => ({
    ...row,
    id: toExcelNumber(row.id), abiertaAt: new Date(row.abiertaAt),
    totalCobrado: toExcelNumber(row.totalCobrado), efectivoEsperado: toExcelNumber(row.efectivoEsperado),
    efectivoContado: row.efectivoContado == null ? null : toExcelNumber(row.efectivoContado),
    diferencia: row.diferencia == null ? null : toExcelNumber(row.diferencia),
    ticketsCancelados: toExcelNumber(row.ticketsCancelados),
  })));
  res.type("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.attachment("cortes.xlsx");
  await workbook.xlsx.write(res);
  res.end();
}

router.get("/admin/cortes/export.xlsx", async (req, res, next): Promise<void> => {
  try { await cutsXlsx(req, res); } catch (error) { if (!badInput(error, res)) next(error); }
});

router.get("/admin/cortes/export.pdf", async (req, res, next): Promise<void> => {
  try {
    const query = ExportAdminCortesPdfQueryParams.parse(req.query);
    const data = await listCuts(parseAnalyticsFilters(query), 1, 10_000, {
      cajeroId: query.cajeroId, numeroCorte: query.numeroCorte,
      soloConDiferencia: query.soloConDiferencia,
    });
    const pdf = createTextPdf("Cortes de caja", data.items.map((row) =>
      `#${row.id} | ${row.nombreUbicacion} | ${row.nombreUsuario} | ${formatNumber(row.totalCobrado, { kind: "money" })} | Dif. ${formatNumber(row.diferencia, { kind: "money" })}`,
    ));
    res.type("application/pdf"); res.attachment("cortes.pdf"); res.send(pdf);
  } catch (error) { if (!badInput(error, res)) next(error); }
});

async function destinationsXlsx(req: any, res: any) {
  const query = ExportAdminCuentasDestinoXlsxQueryParams.parse(req.query);
  const data = await getDestinationAccounts(parseAnalyticsFilters(query));
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Cuentas destino");
  sheet.columns = [
    { header: "Cuenta destino", key: "cuentaDestino", width: 28 },
    { header: "Forma de pago", key: "formaPago", width: 20 },
    { header: "Importe", key: "importe", width: 16 },
    { header: "Operaciones", key: "operaciones", width: 14 },
  ];
  sheet.getColumn("importe").numFmt = EXCEL_NUMBER_FORMAT.money;
  sheet.getColumn("operaciones").numFmt = EXCEL_NUMBER_FORMAT.count;
  sheet.addRows(data.resumen.map((row) => ({
    ...row, cuentaDestino: formatAccountDestination(row.cuentaDestino), importe: toExcelNumber(row.importe), operaciones: toExcelNumber(row.operaciones),
  })));
  res.type("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.attachment("cuentas-destino.xlsx");
  await workbook.xlsx.write(res); res.end();
}

router.get("/admin/cuentas-destino/export.xlsx", async (req, res, next): Promise<void> => {
  try { await destinationsXlsx(req, res); } catch (error) { if (!badInput(error, res)) next(error); }
});

router.get("/admin/cuentas-destino/:cuentaDestino/movimientos/export.xlsx", async (req, res, next): Promise<void> => {
  try {
    const { cuentaDestino } = ExportAdminCuentaDestinoMovimientosXlsxParams.parse(req.params);
    const query = ExportAdminCuentaDestinoMovimientosXlsxQueryParams.parse(req.query);
    if (!isAccountDestination(cuentaDestino)) {
      res.status(400).json({ error: "Cuenta destino inválida.", code: "VALIDATION_ERROR" });
      return;
    }
    const data = await listDestinationAccountMovements(
      parseAnalyticsFilters(query),
      cuentaDestino,
      1,
      1_000_000,
    );
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Movimientos");
    sheet.columns = [
      { header: "Fecha", key: "fecha", width: 22 },
      { header: "Tipo", key: "tipo", width: 24 },
      { header: "Documento", key: "documento", width: 20 },
      { header: "Cliente", key: "cliente", width: 28 },
      { header: "Sitio", key: "sitio", width: 24 },
      { header: "Monto", key: "monto", width: 16 },
      { header: "Registró", key: "registro", width: 24 },
    ];
    sheet.getColumn("monto").numFmt = EXCEL_NUMBER_FORMAT.money;
    sheet.addRows(data.items.map((row) => ({
      ...row,
      fecha: new Date(row.fecha),
      cliente: row.cliente ?? "Público general",
      monto: toExcelNumber(row.monto),
    })));
    sheet.addRow({ sitio: "Total", monto: toExcelNumber(data.montoTotal) });
    res.type("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.attachment(`movimientos-${cuentaDestino.toLowerCase()}.xlsx`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    if (!badInput(error, res)) next(error);
  }
});

router.get("/admin/cuentas-destino/export.pdf", async (req, res, next): Promise<void> => {
  try {
    const query = ExportAdminCuentasDestinoPdfQueryParams.parse(req.query);
    const data = await getDestinationAccounts(parseAnalyticsFilters(query));
    const pdf = createTextPdf("Cuentas destino", data.resumen.map((row) =>
      `${formatAccountDestination(row.cuentaDestino)} | ${row.formaPago} | ${formatNumber(row.importe, { kind: "money" })} | ${formatNumber(row.operaciones, { kind: "count" })} operaciones`,
    ));
    res.type("application/pdf"); res.attachment("cuentas-destino.pdf"); res.send(pdf);
  } catch (error) { if (!badInput(error, res)) next(error); }
});

router.get("/admin/cortes/:id", async (req, res, next): Promise<void> => {
  try {
    const { id } = GetAdminCorteParams.parse(req.params);
    const result = await buildCorteCaja(db, id);
    if (!result) {
      res.status(404).json({ error: "Corte no encontrado." });
      return;
    }
    res.json(GetAdminCorteResponse.parse({
      ...result,
      ...(await getSessionMargin(id)),
    }));
  } catch (error) {
    next(error);
  }
});

router.get("/admin/cortes/:id/export.xlsx", async (req, res, next): Promise<void> => {
  try {
    const { id } = ExportAdminCorteXlsxParams.parse(req.params);
    const corte = await buildCorteCaja(db, id);
    if (!corte) { res.status(404).json({ error: "Corte no encontrado." }); return; }
    const margin = await getSessionMargin(id);
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Corte");
    sheet.columns = [{ header: "Concepto", key: "concepto", width: 32 }, { header: "Importe", key: "importe", width: 18 }];
    sheet.getColumn("importe").numFmt = EXCEL_NUMBER_FORMAT.money;
    sheet.addRows([
      { concepto: "Total cobrado", importe: toExcelNumber(corte.totalCobrado) },
      { concepto: "Efectivo esperado", importe: toExcelNumber(corte.efectivoEsperado) },
      { concepto: "Diferencia", importe: corte.diferencia == null ? null : toExcelNumber(corte.diferencia) },
      { concepto: "Margen", importe: margin.margen == null ? "Pendiente" : toExcelNumber(margin.margen) },
      ...corte.formasPago.map((row) => ({ concepto: `Pago ${row.formaPago}`, importe: toExcelNumber(row.importe) })),
      ...corte.cuentasDestino.map((row) => ({ concepto: formatAccountDestination(row.cuentaDestino), importe: toExcelNumber(row.importe) })),
      ...corte.facturacion.flatMap((row) => [
        { concepto: `${row.facturado ? "Facturado" : "No facturado"} total`, importe: toExcelNumber(row.importe) },
        { concepto: `${row.facturado ? "Facturado" : "No facturado"} efectivo`, importe: toExcelNumber(row.efectivo) },
        { concepto: `${row.facturado ? "Facturado" : "No facturado"} transferencia`, importe: toExcelNumber(row.transferencia) },
        { concepto: `${row.facturado ? "Facturado" : "No facturado"} crédito`, importe: toExcelNumber(row.credito) },
      ]),
      ...corte.ticketsCobradosDetalle.map((row) => ({ concepto: `Ticket cobrado #${row.folio} ${row.cobradoAt}`, importe: toExcelNumber(row.importe) })),
      ...corte.cancelaciones.map((row) => ({ concepto: `Cancelado #${row.folio} — ${row.motivo} — ${row.autor} — ${row.canceladoAt}`, importe: toExcelNumber(row.importe) })),
      ...corte.metreado.map((row) => ({ concepto: `${row.tipo === "METREADO" ? "METRAJE" : "ROLLOS"} (${row.cantidad} ${row.unidad})`, importe: toExcelNumber(row.importe) })),
      ...corte.productos.map((row) => ({ concepto: `${row.tipo === "METREADO" ? "METRAJE" : "ROLLO"} ${row.sku} ${row.tela} ${row.color} (${row.cantidad} ${row.unidad})`, importe: toExcelNumber(row.importe) })),
      ...corte.pendientes.map((row) => ({ concepto: `Pendiente #${row.folio}`, importe: toExcelNumber(row.total) })),
    ]);
    res.type("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.attachment(`corte-${id}.xlsx`); await workbook.xlsx.write(res); res.end();
  } catch (error) { next(error); }
});

router.get("/admin/cortes/:id/export.pdf", async (req, res, next): Promise<void> => {
  try {
    const { id } = ExportAdminCortePdfParams.parse(req.params);
    const corte = await buildCorteCaja(db, id);
    if (!corte) { res.status(404).json({ error: "Corte no encontrado." }); return; }
    const margin = await getSessionMargin(id);
    res.type("application/pdf"); res.attachment(`corte-${id}.pdf`);
    res.send(createTextPdf(`Corte ${id}`, [
      `Tienda: ${corte.sesion.nombreUbicacion}`,
      `Cobrado: ${formatNumber(corte.totalCobrado, { kind: "money" })}`,
      `Diferencia: ${formatNumber(corte.diferencia, { kind: "money" })}`,
      `Margen: ${margin.margen == null ? "Pendiente" : formatNumber(margin.margen, { kind: "money" })}`,
      ...corte.formasPago.map((row) => `Pago ${row.formaPago}: ${formatNumber(row.importe, { kind: "money" })}`),
      ...corte.cuentasDestino.map((row) => `${formatAccountDestination(row.cuentaDestino)}: ${formatNumber(row.importe, { kind: "money" })}`),
      ...corte.facturacion.map((row) => `${row.facturado ? "Facturado" : "No facturado"}: ${formatNumber(row.importe, { kind: "money" })}; E ${row.efectivo}; T ${row.transferencia}; C ${row.credito}`),
      ...corte.ticketsCobradosDetalle.map((row) => `Cobrado #${row.folio}: ${formatNumber(row.importe, { kind: "money" })} ${row.cobradoAt}`),
      ...corte.cancelaciones.map((row) => `Cancelado #${row.folio}: ${formatNumber(row.importe, { kind: "money" })}; ${row.motivo}; ${row.autor}; ${row.canceladoAt}`),
      ...corte.metreado.map((row) => `${row.tipo === "METREADO" ? "METRAJE" : "ROLLOS"}: ${row.cantidad} ${row.unidad}; ${row.importe}`),
      ...corte.productos.map((row) => `${row.tipo === "METREADO" ? "METRAJE" : "ROLLO"} ${row.sku} ${row.tela} ${row.color}: ${row.cantidad} ${row.unidad}; ${row.importe}`),
      ...corte.pendientes.map((row) => `Pendiente #${row.folio}: ${row.total}`),
    ]));
  } catch (error) { next(error); }
});

export default router;