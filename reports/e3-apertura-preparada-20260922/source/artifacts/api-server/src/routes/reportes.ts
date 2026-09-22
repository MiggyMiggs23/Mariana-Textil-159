import { Router, type IRouter } from "express";
import {
  GetReporteSeccionParams, GetReporteSeccionQueryParams, GetReporteSeccionResponse,
  GetReportesCatalogosResponse, GetReporteQueComprarEvidenciaQueryParams,
  GetReporteQueComprarEvidenciaResponse,
  ExportReporteVistaXlsxQueryParams, ExportReporteVistaXlsxParams,
  ExportReporteVistaPdfQueryParams, ExportReporteVistaPdfParams,
} from "@workspace/api-zod";
import { requireRole, requireSession, type AuthContext } from "../middlewares/auth";
import { requierePermiso } from "../lib/permisos";
import { createReadableReportPdf } from "../lib/pdf";
import { buildReport, getCatalogs, parseReportBooleanQuery, reportRange, REPORT_SECTIONS, ReportInputError, type Report } from "../lib/reportes";
import { createReportWorkbook, normalizeExportTables } from "../lib/report-export";
import { resolveReadScope } from "./inventario";
import { getQueComprarEvidence } from "../lib/reportes-que-comprar";
import {
  buildComposedReport,
  COMPOSED_REPORT_VIEWS,
  type ComposedReportView,
} from "../lib/reportes-composed-export";

const router: IRouter = Router();
router.use("/reportes", requireSession, requierePermiso("reportes", "ver"));

/**
 * Control operativo composes sources whose former endpoints are ADMIN-only
 * (admin analytics, admin alerts, and administrative label controls).  Keep
 * that boundary on the server for the whole branch, including both exports;
 * the reportes module permission and frontend tab visibility are not
 * substitutes for this role gate.
 */
export const controlOperativoRoleGate = requireRole("ADMIN");
router.use(
  ["/reportes/control-operativo", "/reportes/vistas/control-operativo"],
  controlOperativoRoleGate,
);

function scopedLocations(req: Parameters<IRouter["get"]>[1] extends (...args: infer A) => unknown ? A[0] : never): number[] | undefined {
  const { ubicacionId, scopeError } = resolveReadScope(req.auth!);
  if (scopeError) throw new ReportInputError(scopeError);
  return ubicacionId == null ? undefined : [ubicacionId];
}
function reportRows(report: Report) {
  const tables = report.tables as Array<{ id: string; title: string; columns: Array<{ key: string; label: string; kind: string }>; rows: Record<string, unknown>[]; totals: Record<string, unknown> }>;
  return tables;
}
function reportKpis(report: Report) {
  return report.kpis as Array<{ label: string; value: string | number; kind: string }>;
}
async function report(req: any) {
  const params = req.params.seccion === "que-comprar"
    ? { seccion: "que-comprar" as const }
    : GetReporteSeccionParams.parse(req.params);
  const { facturado: rawFacturado, ...rawQuery } = req.query;
  const facturado = parseReportBooleanQuery(rawFacturado);
  const query = {
    ...GetReporteSeccionQueryParams.parse(rawQuery),
    ...(facturado === undefined ? {} : { facturado }),
  };
  return buildReport(params.seccion, query, scopedLocations(req), req.auth!.user.rol === "ADMIN");
}
function error(error: unknown, res: any) {
  if (error instanceof ComposedScopeError) {
    res.status(error.statusCode).json({ error: error.message });
    return true;
  }
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
/**
 * Drill-down for the Qué comprar report.  This route intentionally has a
 * stable read-only evidence response: the report rows carry this URL and the
 * payload exposes the exact filters, ledger rows, episodes, and reconciliation.
 */
router.get("/reportes/que-comprar/evidencia", async (req, res, next): Promise<void> => {
  try {
    const evidenceQuery = GetReporteQueComprarEvidenciaQueryParams.parse(req.query);
    const productoId = evidenceQuery.productoId;
    const requestedUbicacionId = evidenceQuery.ubicacionId;
    const scope = resolveReadScope(req.auth!, requestedUbicacionId);
    if (scope.scopeError) {
      res.status(403).json({ error: scope.scopeError });
      return;
    }
    if (scope.ubicacionId == null) {
      res.status(403).json({ error: "No tienes una ubicación asignada." });
      return;
    }
    const range = reportRange(evidenceQuery);
    const evidence = await getQueComprarEvidence({
      productoId,
      ubicacionId: scope.ubicacionId,
      desde: range.desde,
      hasta: range.hasta,
    });
    if (!evidence) {
      res.status(404).json({ error: "No existe evidencia habilitada para ese producto y sitio." });
      return;
    }
    res.setHeader("Cache-Control", "private, no-store");
    res.json(GetReporteQueComprarEvidenciaResponse.parse(evidence));
  } catch (e) {
    if (!error(e, res)) next(e);
  }
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
    const catalogs = await getCatalogs(
      scopedLocations(req),
      req.auth!.user.rol === "ADMIN",
    );
    const workbook = createReportWorkbook({
      section: data.section,
      generatedAt: data.generatedAt,
      range: data.range,
      activeFilters: data.activeFilters,
      kpis: reportKpis(data),
      tables,
      charts: data.charts as any,
      warnings: data.warnings as string[],
      alerts: data.alerts as any,
      catalogs,
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
    const tables = normalizeExportTables(String(data.section), data.activeFilters, reportRows(data));
    const catalogs = await getCatalogs(
      scopedLocations(req),
      req.auth!.user.rol === "ADMIN",
    );
    res.setHeader("Server-Timing", `reportes;dur=${(performance.now() - started).toFixed(1)}`);
    res.type("application/pdf"); res.attachment(`${data.section}.pdf`);
    res.send(await createReadableReportPdf({
      section: data.section,
      generatedAt: data.generatedAt,
      range: data.range,
      activeFilters: data.activeFilters,
      kpis: reportKpis(data),
      tables,
      charts: data.charts as any,
      warnings: data.warnings as string[],
      alerts: data.alerts as any,
      catalogs,
    }));
  } catch (e) { if (!error(e, res)) next(e); }
});

function composedRequestQuery(req: any, parser: { parse: (input: unknown) => any }) {
  const { facturado: rawFacturado, ...rawQuery } = req.query;
  const facturado = parseReportBooleanQuery(rawFacturado);
  return parser.parse({
    ...rawQuery,
    ...(facturado === undefined ? {} : { facturado }),
  });
}

export class ComposedScopeError extends Error {
  readonly statusCode = 403;
}

type ComposedScopeQuery = {
  modo?: "normal" | "comparar";
  ubicacionId?: number;
  ubicacionIds?: unknown;
};

function parseComposedLocationIds(value: unknown): number[] {
  if (value === undefined || value === null || value === "") return [];
  const values = Array.isArray(value) ? value : [value];
  const parsed: number[] = [];
  for (const item of values) {
    for (const token of String(item).split(",")) {
      const trimmed = token.trim();
      if (!trimmed) continue;
      const id = Number(trimmed);
      if (!Number.isInteger(id) || id < 1) {
        throw new ReportInputError("El filtro de ubicaciones contiene un sitio inválido.");
      }
      if (!parsed.includes(id)) parsed.push(id);
    }
  }
  return parsed;
}

/**
 * Composed exports have one location scope shared by every source, including
 * cash. A multi-site list is meaningful only for explicit comparison frames;
 * normal mode must never silently turn it into an unrestricted/global query.
 */
export function resolveComposedLocations(
  auth: AuthContext,
  query: ComposedScopeQuery,
): number[] | undefined {
  const requestedIds = parseComposedLocationIds(query.ubicacionIds);
  const singular = query.ubicacionId == null ? undefined : Number(query.ubicacionId);
  if (singular !== undefined && (!Number.isInteger(singular) || singular < 1)) {
    throw new ReportInputError("El sitio seleccionado no es válido.");
  }
  if (
    singular !== undefined &&
    requestedIds.length > 0 &&
    (requestedIds.length !== 1 || requestedIds[0] !== singular)
  ) {
    throw new ReportInputError(
      "ubicacionId y ubicacionIds deben identificar el mismo sitio.",
    );
  }
  if (query.modo !== "comparar" && requestedIds.length > 1) {
    throw new ReportInputError(
      "Una exportación normal solo admite un sitio; usa Comparar para varios sitios.",
    );
  }

  const forcedLocation = auth.user.rol === "CAJA" || auth.user.alcanceConsulta === "PROPIA";
  if (forcedLocation) {
    const assigned = auth.user.ubicacionId;
    if (assigned == null) {
      throw new ComposedScopeError("No tienes una ubicación asignada.");
    }
    const explicitlyRequested = singular === undefined
      ? requestedIds
      : [singular];
    if (explicitlyRequested.some((id) => id !== assigned)) {
      throw new ComposedScopeError("No tienes permiso para esa ubicación.");
    }
    return [assigned];
  }

  if (requestedIds.length > 0) return requestedIds;
  return singular === undefined ? undefined : [singular];
}

function composedLocations(req: { auth?: AuthContext }, query: ComposedScopeQuery) {
  if (!req.auth) throw new ComposedScopeError("Debes iniciar sesión.");
  return resolveComposedLocations(req.auth, query);
}

export function assertGlobalX04Scope(
  view: ComposedReportView,
  query: ComposedScopeQuery,
  locations: number[] | undefined,
  auth: AuthContext,
): void {
  if (view !== "ventas" || query.modo !== "comparar") return;
  const hasRequestedLocationIds = Array.isArray(query.ubicacionIds)
    ? query.ubicacionIds.some((value) => String(value).trim() !== "")
    : query.ubicacionIds !== undefined &&
      query.ubicacionIds !== null &&
      String(query.ubicacionIds).trim() !== "";
  if (
    auth.user.rol !== "ADMIN" ||
    auth.user.alcanceConsulta !== "TODAS" ||
    locations !== undefined ||
    query.ubicacionId !== undefined ||
    hasRequestedLocationIds
  ) {
    throw new ComposedScopeError(
      "El comparativo X04 solo está disponible para ADMIN con alcance TODAS y vista global.",
    );
  }
}

function composedView(rawView: unknown): ComposedReportView {
  const value = String(rawView);
  if (!COMPOSED_REPORT_VIEWS.includes(value as ComposedReportView)) {
    throw new ReportInputError("Vista compuesta inválida.");
  }
  return value as ComposedReportView;
}

router.get("/reportes/vistas/:vista/export.xlsx", async (req, res, next): Promise<void> => {
  const started = performance.now();
  try {
    const path = ExportReporteVistaXlsxParams.parse(req.params);
    const query = composedRequestQuery(req, ExportReporteVistaXlsxQueryParams);
    const view = composedView(path.vista);
    if (view === "ventas" && query.modo === "comparar" && req.auth!.user.rol !== "ADMIN") {
      res.status(403).json({ error: "El modo Comparar requiere acceso ADMIN." });
      return;
    }
    const locations = composedLocations(req, query);
    assertGlobalX04Scope(view, query, locations, req.auth!);
    const data = await buildComposedReport(
      view,
      query,
      locations,
      req.auth!.user.rol === "ADMIN",
      {
        rol: req.auth!.user.rol,
        alcanceConsulta: req.auth!.user.alcanceConsulta,
      },
    );
    const tables = normalizeExportTables(String(data.section), data.activeFilters, reportRows(data));
    const catalogs = await getCatalogs(
      locations,
      req.auth!.user.rol === "ADMIN",
    );
    const workbook = createReportWorkbook({
      section: data.section,
      generatedAt: data.generatedAt,
      range: data.range,
      activeFilters: data.activeFilters,
      kpis: reportKpis(data),
      tables,
      catalogs,
      charts: data.charts as any,
      warnings: data.warnings as string[],
      alerts: data.alerts as any,
    });
    res.setHeader("Server-Timing", `reportes-compuestos;dur=${(performance.now() - started).toFixed(1)}`);
    res.type("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.attachment(`${data.section}.xlsx`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (e) { if (!error(e, res)) next(e); }
});

router.get("/reportes/vistas/:vista/export.pdf", async (req, res, next): Promise<void> => {
  const started = performance.now();
  try {
    const path = ExportReporteVistaPdfParams.parse(req.params);
    const query = composedRequestQuery(req, ExportReporteVistaPdfQueryParams);
    const view = composedView(path.vista);
    if (view === "ventas" && query.modo === "comparar" && req.auth!.user.rol !== "ADMIN") {
      res.status(403).json({ error: "El modo Comparar requiere acceso ADMIN." });
      return;
    }
    const locations = composedLocations(req, query);
    assertGlobalX04Scope(view, query, locations, req.auth!);
    const data = await buildComposedReport(
      view,
      query,
      locations,
      req.auth!.user.rol === "ADMIN",
      {
        rol: req.auth!.user.rol,
        alcanceConsulta: req.auth!.user.alcanceConsulta,
      },
    );
    const tables = normalizeExportTables(String(data.section), data.activeFilters, reportRows(data));
    const catalogs = await getCatalogs(
      locations,
      req.auth!.user.rol === "ADMIN",
    );
    res.setHeader("Server-Timing", `reportes-compuestos;dur=${(performance.now() - started).toFixed(1)}`);
    res.type("application/pdf");
    res.attachment(`${data.section}.pdf`);
    res.send(await createReadableReportPdf({
      section: data.section,
      generatedAt: data.generatedAt,
      range: data.range,
      activeFilters: data.activeFilters,
      kpis: reportKpis(data),
      tables,
      charts: data.charts as any,
      warnings: data.warnings as string[],
      alerts: data.alerts as any,
      catalogs,
    }));
  } catch (e) { if (!error(e, res)) next(e); }
});

export default router;