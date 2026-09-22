import ExcelJS from "exceljs";
import { EXCEL_NUMBER_FORMAT, formatUnit, toExcelNumber } from "@workspace/number-format";
import {
  formatReportDate,
  formatReportFilters,
  formatReportRange,
  hasMeaningfulTotals,
  labelForReportKey,
  reportTotalLabel,
  type ReportPresentationCatalogs,
} from "./report-presentation";

/**
 * Export-only normalization. Report builders retain their UI-oriented shapes,
 * while every worksheet gets an explicit, auditable modalidad value.
 */
export type ExportColumn = {
  key: string;
  label: string;
  kind: string;
  hrefKey?: string;
  economic?: boolean;
};
export type ExportTable = {
  id: string;
  title: string;
  columns: ExportColumn[];
  rows: Record<string, unknown>[];
  totals: Record<string, unknown>;
};

export type ExportChart = {
  id: string;
  title: string;
  categoryKey: string;
  series: Array<{ key: string; label: string; kind?: string }>;
  rows: Record<string, unknown>[];
};
export type ExportAlert = {
  sesionId: number;
  tipo: string;
  mensaje: string;
  importe: string;
  href?: string;
};

export const INVENTORY_MODALITY = "NO APLICA — INVENTARIO FÍSICO";
export const PURCHASE_MODALITY = "NO APLICA — COMPRAS POR ROLLO";
export const UNATTRIBUTED_MODALITY = "NO APLICA — SIN DESGLOSE POR MODALIDAD";

const pendingFinancialField = (column: ExportColumn) =>
  /costo|utilidad|margen/i.test(`${column.key} ${column.label}`);

function modalityFor(
  section: string,
  table: Pick<ExportTable, "id">,
  activeModality: string,
): string {
  if (section === "inventario" || (section === "color" && table.id === "sin-movimiento-90")) {
    return INVENTORY_MODALITY;
  }
  if (section === "compras") return PURCHASE_MODALITY;
  if (section === "clientes" && table.id === "clientes") return "ROLLOS Y METRAJE (COLUMNAS SEPARADAS)";
  if (section === "clientes" && ["cuentas-por-cobrar-fifo", "castigos-y-reversos"].includes(table.id)) {
    return UNATTRIBUTED_MODALITY;
  }
  if (activeModality === "ROLLOS" || activeModality === "METRAJE") return activeModality;
  return UNATTRIBUTED_MODALITY;
}

export function activeReportModality(activeFilters: unknown): string {
  if (!Array.isArray(activeFilters)) return "TODO";
  const filter = activeFilters.find((item) => typeof item === "string" && item.startsWith("modalidad="));
  const value = typeof filter === "string" ? filter.slice("modalidad=".length) : "TODO";
  return value === "ROLLOS" || value === "METRAJE" ? value : "TODO";
}

/**
 * Adds Modalidad without changing the report response. Null cost, utility and
 * margin values are rendered as the literal Pendiente together, but no other
 * null (including ordinary missing data) is reinterpreted.
 */
export function normalizeExportTables(
  section: string,
  activeFilters: unknown,
  source: ExportTable[],
): ExportTable[] {
  const activeModality = activeReportModality(activeFilters);
  return source.map((table) => {
    const hasModality = table.columns.some((column) => column.key === "modalidad");
    const columns = hasModality
      ? table.columns.map((column) => ({ ...column }))
      : [...table.columns.map((column) => ({ ...column })), { key: "modalidad", label: "Modalidad", kind: "text" }];
    const financialColumns = columns.filter(pendingFinancialField);
    const fallbackModality = modalityFor(section, table, activeModality);
    const rows = table.rows.map((sourceRow) => {
      const row = { ...sourceRow };
      if (row.unidad != null) row.unidad = formatUnit(String(row.unidad));
      if (row.modalidad == null || row.modalidad === "") row.modalidad = fallbackModality;
      // A group is pending as a whole. Do not replace a legitimate zero and do
      // not mark non-financial cells merely because they are null.
      const pending = financialColumns.some((column) => row[column.key] == null);
      if (pending) {
        for (const column of financialColumns) row[column.key] = "Pendiente";
      }
      return row;
    });
    const totals = { ...table.totals };
    if (financialColumns.some((column) => rows.some((row) => row[column.key] === "Pendiente"))) {
      for (const column of financialColumns) {
        // Totals emitted by older table builders may have reduced null to zero.
        // A pending component makes the whole financial group pending instead.
        totals[column.key] = "Pendiente";
      }
    }
    return { ...table, columns, rows, totals };
  });
}

export function excelColumnName(index: number): string {
  let result = "";
  for (let value = index; value > 0; value = Math.floor((value - 1) / 26)) {
    result = String.fromCharCode(65 + ((value - 1) % 26)) + result;
  }
  return result;
}

const numeric = (kind: string) =>
  kind === "money" || kind === "quantity" || kind === "count" || kind === "percentage" || kind === "days";
const formatFor = (kind: string) => {
  if (kind === "money") return EXCEL_NUMBER_FORMAT.money;
  // Report percentages are already percentage points (12.5 means 12.5%).
  // Excel's percent operator multiplies a stored number by 100, so use a
  // literal percent sign while preserving the native numeric cell.
  if (kind === "percentage") return '0.00"%"';
  if (kind === "quantity" || kind === "days") return EXCEL_NUMBER_FORMAT.quantity;
  if (kind === "count") return EXCEL_NUMBER_FORMAT.count;
  return EXCEL_NUMBER_FORMAT.identifier;
};

function worksheetName(workbook: ExcelJS.Workbook, title: string): string {
  const base = title.slice(0, 31) || "Hoja";
  let candidate = base;
  let suffix = 2;
  while (workbook.getWorksheet(candidate)) {
    const marker = ` ${suffix}`;
    candidate = `${base.slice(0, 31 - marker.length)}${marker}`;
    suffix += 1;
  }
  return candidate;
}

/** Creates the XLSX document from the already authorized server report. */
export function createReportWorkbook(report: {
  section: unknown;
  generatedAt: unknown;
  range: unknown;
  activeFilters: unknown;
  kpis?: Array<{ label: string; value: string | number | null; kind: string }>;
  tables: ExportTable[];
  charts?: ExportChart[];
  warnings?: string[];
  alerts?: ExportAlert[];
  catalogs?: ReportPresentationCatalogs;
}): ExcelJS.Workbook {
  const workbook = new ExcelJS.Workbook();
  const modality = activeReportModality(report.activeFilters);
  const meta = workbook.addWorksheet("Periodo");
  const filters = formatReportFilters(report.activeFilters, report.catalogs);
  meta.addRows([
    ["Reporte", report.section],
    ["Generado", formatReportDate(report.generatedAt, true)],
    ["Periodo", formatReportRange(report.range)],
    ["Filtros", filters.length ? filters.join("\n") : "Sin filtros adicionales"],
    ["Modalidad", modality === "TODO" ? "Todas las modalidades" : modality],
  ]);
  meta.getColumn(1).width = 20;
  meta.getColumn(2).width = 100;
  meta.getColumn(2).alignment = { wrapText: true, vertical: "top" };
  meta.getColumn(1).font = { bold: true };
  meta.views = [{ state: "frozen", ySplit: 1 }];
  const kpis = workbook.addWorksheet("Indicadores");
  kpis.columns = [{ header: "Indicador", key: "label", width: 38 }, { header: "Valor", key: "value", width: 18 }];
  kpis.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  kpis.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F4E78" } };
  kpis.views = [{ state: "frozen", ySplit: 1 }];
  for (const item of report.kpis ?? []) {
    kpis.addRow({ label: item.label, value: numeric(item.kind) && item.value != null ? toExcelNumber(item.value) : item.value });
    if (numeric(item.kind)) kpis.getCell(`B${kpis.rowCount}`).numFmt = formatFor(item.kind);
  }
  for (const item of report.tables) {
    const sheet = workbook.addWorksheet(worksheetName(workbook, item.title));
    sheet.columns = item.columns.map((column) => ({
      header: column.label,
      key: column.key,
      width: Math.min(42, Math.max(14, column.label.length + 3)),
    }));
    for (const column of item.columns) if (numeric(column.kind)) sheet.getColumn(column.key).numFmt = formatFor(column.kind);
    sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F4E78" } };
    sheet.getRow(1).alignment = { wrapText: true, vertical: "middle" };
    sheet.getRow(1).height = 30;
    sheet.addRows(item.rows.map((row) => Object.fromEntries(item.columns.map((column) => [
      column.key,
      numeric(column.kind) && row[column.key] != null && row[column.key] !== "Pendiente"
        ? toExcelNumber(row[column.key] as string | number)
        : row[column.key] ?? null,
    ]))));
    if (hasMeaningfulTotals(item.totals)) {
      const totalRow = Object.fromEntries(item.columns.map((column) => [
        column.key,
        numeric(column.kind) && item.totals[column.key] != null && item.totals[column.key] !== "Pendiente"
          ? toExcelNumber(item.totals[column.key] as string | number)
          : item.totals[column.key] ?? null,
      ]));
      const label = reportTotalLabel(item.columns, item.totals);
      if (label && totalRow[label.key] == null) totalRow[label.key] = label.value;
      const row = sheet.addRow(totalRow);
      row.font = { bold: true };
      row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE2F0D9" } };
      item.columns.forEach((column, index) => {
        const cell = row.getCell(index + 1);
        if (numeric(column.kind) && cell.value !== "Pendiente") {
          cell.numFmt = formatFor(column.kind);
        }
      });
    }
    sheet.autoFilter = { from: "A1", to: `${excelColumnName(item.columns.length)}1` };
    sheet.views = [{ state: "frozen", ySplit: 1 }];
    sheet.pageSetup = { orientation: item.columns.length > 8 ? "landscape" : "portrait", fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
    sheet.pageSetup.printTitlesRow = "1:1";
  }
  for (const chart of report.charts ?? []) {
    const sheet = workbook.addWorksheet(worksheetName(workbook, `Grafico ${chart.title}`));
    const chartColumns = [
      { key: chart.categoryKey, label: labelForReportKey(chart.categoryKey), kind: "text" },
      ...chart.series.map((series) => ({ key: series.key, label: series.label, kind: series.kind ?? "text" })),
    ];
    sheet.columns = chartColumns.map((column) => ({
      header: column.label,
      key: column.key,
      width: Math.max(14, column.label.length + 3),
    }));
    sheet.addRows(chart.rows.map((row) => Object.fromEntries(
      chartColumns.map((column) => [
        column.key,
        numeric(column.kind) && row[column.key] != null
          ? toExcelNumber(row[column.key] as string | number)
          : row[column.key] ?? null,
      ]),
    )));
    for (const column of chartColumns) {
      if (numeric(column.kind)) sheet.getColumn(column.key).numFmt = formatFor(column.kind);
    }
    sheet.autoFilter = { from: "A1", to: `${excelColumnName(chartColumns.length)}1` };
    sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F4E78" } };
    sheet.getRow(1).alignment = { wrapText: true };
    sheet.views = [{ state: "frozen", ySplit: 1 }];
    sheet.pageSetup = { orientation: chartColumns.length > 6 ? "landscape" : "portrait", fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
    sheet.pageSetup.printTitlesRow = "1:1";
  }
  if (report.warnings?.length) {
    const warnings = workbook.addWorksheet(worksheetName(workbook, "Avisos"));
    warnings.columns = [{ header: "Aviso", key: "warning", width: 100 }];
    warnings.addRows(report.warnings.map((warning) => ({ warning })));
    warnings.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    warnings.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F4E78" } };
    warnings.views = [{ state: "frozen", ySplit: 1 }];
  }
  if (report.alerts?.length) {
    const alerts = workbook.addWorksheet(worksheetName(workbook, "Alertas"));
    alerts.columns = [
      { header: "Sesión", key: "sesionId", width: 14 },
      { header: "Tipo", key: "tipo", width: 14 },
      { header: "Mensaje", key: "mensaje", width: 70 },
      { header: "Importe", key: "importe", width: 18 },
      { header: "Origen", key: "href", width: 70 },
    ];
    alerts.addRows(report.alerts);
    alerts.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    alerts.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F4E78" } };
    alerts.views = [{ state: "frozen", ySplit: 1 }];
  }
  return workbook;
}