import { Router, type IRouter } from "express";
import ExcelJS from "exceljs";
import {
  GetReporteSeccionParams, GetReporteSeccionQueryParams, GetReporteSeccionResponse,
  GetReportesCatalogosResponse,
} from "@workspace/api-zod";
import { EXCEL_NUMBER_FORMAT, toExcelNumber } from "@workspace/number-format";
import { requireSession } from "../middlewares/auth";
import { requierePermiso } from "../lib/permisos";
import { createTextPdf } from "../lib/pdf";
import { buildReport, getCatalogs, parseReportBooleanQuery, REPORT_SECTIONS, ReportInputError, type Report } from "../lib/reportes";

const router: IRouter = Router();
router.use("/reportes", requireSession, requierePermiso("reportes", "ver"));

function scopedLocations(req: Parameters<IRouter["get"]>[1] extends (...args: infer A) => unknown ? A[0] : never): number[] | undefined {
  const user = req.auth!.user;
  if (
    user.rol === "ADMIN" ||
    user.rol === "SUPERVISOR" ||
    user.alcanceConsulta === "TODAS"
  ) return undefined;
  if (user.ubicacionId == null) throw new ReportInputError("El usuario no tiene una ubicación asignada.");
  return [user.ubicacionId];
}
function reportRows(report: Report) {
  const tables = report.tables as Array<{ title: string; columns: Array<{ key: string; label: string; kind: string }>; rows: Record<string, unknown>[]; totals: Record<string, unknown> }>;
  return tables;
}
function numeric(kind: string) { return kind === "money" || kind === "quantity" || kind === "count" || kind === "percentage" || kind === "days"; }
function formatFor(kind: string) {
  if (kind === "money") return EXCEL_NUMBER_FORMAT.money;
  if (kind === "percentage") return "0.00%";
  return "0.000";
}
async function report(req: any) {
  const params = GetReporteSeccionParams.parse(req.params);
  const { facturado: rawFacturado, ...rawQuery } = req.query;
  const facturado = parseReportBooleanQuery(rawFacturado);
  const query = {
    ...GetReporteSeccionQueryParams.parse(rawQuery),
    ...(facturado === undefined ? {} : { facturado }),
  };
  return buildReport(params.seccion, query, scopedLocations(req), req.auth!.user.rol === "ADMIN");
}
function error(error: unknown, res: any) {
  if (error instanceof ReportInputError || (error as { name?: string }).name === "ZodError") {
    res.status(400).json({ error: error instanceof Error ? error.message : "Solicitud inválida." }); return true;
  }
  return false;
}

router.get("/reportes/catalogos", async (req, res, next): Promise<void> => {
  const started = performance.now();
  try {
    const catalogs = await getCatalogs(
      scopedLocations(req),
      req.auth!.user.rol === "ADMIN",
    );
    res.setHeader("Server-Timing", `reportes;dur=${(performance.now() - started).toFixed(1)}`);
    res.json(GetReportesCatalogosResponse.parse(catalogs));
  }
  catch (e) { if (!error(e, res)) next(e); }
});
router.get("/reportes/:seccion", async (req, res, next): Promise<void> => {
  const started = performance.now();
  try {
    const data = await report(req);
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("Server-Timing", `reportes;dur=${(performance.now() - started).toFixed(1)}`);
    res.json(GetReporteSeccionResponse.parse(data));
  } catch (e) { if (!error(e, res)) next(e); }
});
router.get("/reportes/:seccion/export.xlsx", async (req, res, next): Promise<void> => {
  const started = performance.now();
  try {
    const data = await report(req); const workbook = new ExcelJS.Workbook();
    const meta = workbook.addWorksheet("Periodo");
    meta.addRows([["Reporte", data.section], ["Generado", data.generatedAt], ["Periodo", JSON.stringify(data.range)], ["Filtros", JSON.stringify(data.activeFilters)]]);
    for (const item of reportRows(data)) {
      const sheet = workbook.addWorksheet(item.title.slice(0, 31));
      sheet.columns = item.columns.map((column) => ({ header: column.label, key: column.key, width: Math.max(14, column.label.length + 3) }));
      for (const column of item.columns) if (numeric(column.kind)) sheet.getColumn(column.key).numFmt = formatFor(column.kind);
      sheet.addRows(item.rows.map((row) => Object.fromEntries(item.columns.map((column) => [column.key, numeric(column.kind) && row[column.key] != null ? toExcelNumber(row[column.key] as string | number) : row[column.key] ?? null]))));
      sheet.addRow(Object.fromEntries(item.columns.map((column) => [column.key, item.totals[column.key] ?? null])));
      sheet.autoFilter = { from: "A1", to: `${String.fromCharCode(64 + Math.min(item.columns.length, 26))}1` };
    }
    res.setHeader("Server-Timing", `reportes;dur=${(performance.now() - started).toFixed(1)}`);
    res.type("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"); res.attachment(`${data.section}.xlsx`);
    await workbook.xlsx.write(res); res.end();
  } catch (e) { if (!error(e, res)) next(e); }
});
router.get("/reportes/:seccion/export.pdf", async (req, res, next): Promise<void> => {
  const started = performance.now();
  try {
    const data = await report(req);
    const lines = [`Periodo: ${JSON.stringify(data.range)}`, `Filtros: ${JSON.stringify(data.activeFilters)}`];
    for (const item of reportRows(data)) {
      lines.push(item.title, ...item.rows.map((row) => item.columns.map((c) => `${c.label}: ${row[c.key] ?? ""}`).join(" | ")), `Totales: ${JSON.stringify(item.totals)}`);
    }
    res.setHeader("Server-Timing", `reportes;dur=${(performance.now() - started).toFixed(1)}`);
    res.type("application/pdf"); res.attachment(`${data.section}.pdf`); res.send(createTextPdf(`Reporte ${data.section}`, lines));
  } catch (e) { if (!error(e, res)) next(e); }
});

export default router;