import { Router, type IRouter } from "express";
import {
  GetReporteSeccionParams, GetReporteSeccionQueryParams, GetReporteSeccionResponse,
  GetReportesCatalogosResponse,
} from "@workspace/api-zod";
import { requireSession } from "../middlewares/auth";
import { requierePermiso } from "../lib/permisos";
import { createTextPdf } from "../lib/pdf";
import { buildReport, getCatalogs, parseReportBooleanQuery, REPORT_SECTIONS, ReportInputError, type Report } from "../lib/reportes";
import { createReportWorkbook, normalizeExportTables } from "../lib/report-export";

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
  const tables = report.tables as Array<{ id: string; title: string; columns: Array<{ key: string; label: string; kind: string }>; rows: Record<string, unknown>[]; totals: Record<string, unknown> }>;
  return tables;
}
function reportKpis(report: Report) {
  return report.kpis as Array<{ label: string; value: string | number; kind: string }>;
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
    const data = await report(req);
    const tables = normalizeExportTables(
      String(data.section),
      data.activeFilters,
      reportRows(data),
    );
    const workbook = createReportWorkbook({
      section: data.section,
      generatedAt: data.generatedAt,
      range: data.range,
      activeFilters: data.activeFilters,
      kpis: reportKpis(data),
      tables,
    });
    res.setHeader("Server-Timing", `reportes;dur=${(performance.now() - started).toFixed(1)}`);
    res.type("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"); res.attachment(`${data.section}.xlsx`);
    await workbook.xlsx.write(res); res.end();
  } catch (e) { if (!error(e, res)) next(e); }
});
router.get("/reportes/:seccion/export.pdf", async (req, res, next): Promise<void> => {
  const started = performance.now();
  try {
    const data = await report(req);
    const lines = [`Periodo: ${JSON.stringify(data.range)}`, `Filtros: ${JSON.stringify(data.activeFilters)}`, "Indicadores:", ...reportKpis(data).map((item) => `${item.label}: ${item.value}`)];
    const tables = normalizeExportTables(String(data.section), data.activeFilters, reportRows(data));
    for (const item of tables) {
      lines.push(item.title, ...item.rows.map((row) => item.columns.map((c) => `${c.label}: ${row[c.key] ?? ""}`).join(" | ")), `Totales: ${JSON.stringify(item.totals)}`);
    }
    res.setHeader("Server-Timing", `reportes;dur=${(performance.now() - started).toFixed(1)}`);
    res.type("application/pdf"); res.attachment(`${data.section}.pdf`); res.send(createTextPdf(`Reporte ${data.section}`, lines));
  } catch (e) { if (!error(e, res)) next(e); }
});

export default router;