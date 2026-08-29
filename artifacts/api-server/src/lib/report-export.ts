import ExcelJS from "exceljs";
import { EXCEL_NUMBER_FORMAT, formatUnit, toExcelNumber } from "@workspace/number-format";

/**
 * Export-only normalization. Report builders retain their UI-oriented shapes,
 * while every worksheet gets an explicit, auditable modalidad value.
 */
export type ExportColumn = {
  key: string;
  label: string;
  kind: string;
  economic?: boolean;
};
export type ExportTable = {
  id: string;
  title: string;
  columns: ExportColumn[];
  rows: Record<string, unknown>[];
  totals: Record<string, unknown>;
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
  if (kind === "percentage") return "0.00%";
  if (kind === "quantity" || kind === "days") return EXCEL_NUMBER_FORMAT.quantity;
  if (kind === "count") return EXCEL_NUMBER_FORMAT.count;
  return EXCEL_NUMBER_FORMAT.identifier;
};

/** Creates the XLSX document from the already authorized server report. */
export function createReportWorkbook(report: {
  section: unknown;
  generatedAt: unknown;
  range: unknown;
  activeFilters: unknown;
  kpis?: Array<{ label: string; value: string | number | null; kind: string }>;
  tables: ExportTable[];
}): ExcelJS.Workbook {
  const workbook = new ExcelJS.Workbook();
  const modality = activeReportModality(report.activeFilters);
  const meta = workbook.addWorksheet("Periodo");
  meta.addRows([
    ["Reporte", report.section],
    ["Generado", report.generatedAt],
    ["Periodo", JSON.stringify(report.range)],
    ["Filtros", JSON.stringify(report.activeFilters)],
    ["Modalidad", modality],
  ]);
  const kpis = workbook.addWorksheet("Indicadores");
  kpis.columns = [{ header: "Indicador", key: "label", width: 38 }, { header: "Valor", key: "value", width: 18 }];
  for (const item of report.kpis ?? []) {
    kpis.addRow({ label: item.label, value: numeric(item.kind) && item.value != null ? toExcelNumber(item.value) : item.value });
    if (numeric(item.kind)) kpis.getCell(`B${kpis.rowCount}`).numFmt = formatFor(item.kind);
  }
  for (const item of report.tables) {
    const sheet = workbook.addWorksheet(item.title.slice(0, 31));
    sheet.columns = item.columns.map((column) => ({ header: column.label, key: column.key, width: Math.max(14, column.label.length + 3) }));
    for (const column of item.columns) if (numeric(column.kind)) sheet.getColumn(column.key).numFmt = formatFor(column.kind);
    sheet.addRows(item.rows.map((row) => Object.fromEntries(item.columns.map((column) => [
      column.key,
      numeric(column.kind) && row[column.key] != null && row[column.key] !== "Pendiente"
        ? toExcelNumber(row[column.key] as string | number)
        : row[column.key] ?? null,
    ]))));
    sheet.addRow(Object.fromEntries(item.columns.map((column) => [column.key, item.totals[column.key] ?? null])));
    sheet.autoFilter = { from: "A1", to: `${excelColumnName(item.columns.length)}1` };
  }
  return workbook;
}