/**
 * Read-only HTTP export verifier.
 *
 * This is an isolated local Express harness, not a browser or deployed-app
 * check. It mounts the real report and analytics routers, replaces only their
 * session lookup with an in-memory authorized request context, and keeps the
 * real ADMIN role middleware in place. Every report read, including reads
 * made by the route handlers, is forced through one READ ONLY REPEATABLE READ
 * PostgreSQL client. No session, user, fixture, initializer, or write is
 * created.
 *
 * The harness downloads the actual composed XLSX/PDF route bytes, obtains the
 * individual JSON sources used by the screen, composes those source payloads
 * without printing rows, and compares:
 *
 *   screen sources -> composed builder -> downloaded workbook/PDF
 *
 * Five normal views and five comparison views are exercised when the live
 * header catalog has at least two eligible physical locations. The report
 * contains counts, IDs, hashes, byte lengths, and parser/render metrics only.
 * Private rows never enter a report, log, or committed artifact.
 *
 * Optional fitz inspection uses an already installed python3/PyMuPDF only.
 * The script never installs dependencies. Set REPORT_EXPORT_WRITE_ARTIFACTS=1
 * to retain one representative global Ventas XLSX/PDF pair under
 * reports/exports (mode 0600).
 */

import { createHash } from "node:crypto";
import { createServer } from "node:http";
import { execFileSync } from "node:child_process";
import express, { type Express } from "express";
import ExcelJS from "exceljs";
import { chmod, mkdir, rm, writeFile } from "node:fs/promises";
import { readdirSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { pool } from "@workspace/db";
import { toExcelNumber } from "@workspace/number-format";
import {
  buildComposedReport,
  comparisonCharts,
  comparisonTable,
  type ComposedReport,
  type ComposedReportInput,
} from "../lib/reportes-composed-export";
import { normalizeExportTables, type ExportTable } from "../lib/report-export";
import { createTextPdf, wrapPdfLines } from "../lib/pdf";
import { accountedDocumentAt, accountedDocumentPredicate } from "../lib/accounted-document";
import { controlOperativoRoleGate } from "../routes/reportes";

type AnyRecord = Record<string, any>;
type Content = {
  kpis: any[];
  charts: any[];
  tables: any[];
  warnings: string[];
  alerts?: any[];
};
type AuthMode = "admin" | "nonadmin";
type CaseMode = "normal" | "comparar";
type SourceResponse = AnyRecord;

const VIEWS = ["ventas", "que-comprar", "utilidad", "clientes", "control-operativo"] as const;
type View = (typeof VIEWS)[number];
const REPORT_SOURCES: Record<View, string[]> = {
  ventas: ["ventas"],
  "que-comprar": ["que-comprar", "inventario", "mapas-calor", "color", "compras"],
  utilidad: ["utilidad"],
  clientes: ["clientes", "pagos-dirigidos"],
  "control-operativo": ["control-operativo"],
};
const WRITE_SQL = /\b(INSERT|UPDATE|DELETE|MERGE|ALTER|CREATE|DROP|TRUNCATE|GRANT|REVOKE|COMMENT|VACUUM|REFRESH|CALL|DO)\b/i;
const REPORT_PATH = resolve(fileURLToPath(import.meta.url), "../../../../..", "reports/export-download-verification.md");
const EXPORT_DIR = resolve(fileURLToPath(import.meta.url), "../../../../..", "reports/exports");

function stable(value: unknown): string {
  if (value === undefined) return "undefined";
  if (value === null) return "null";
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (typeof value === "object") {
    const record = value as AnyRecord;
    return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stable(record[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function hash(value: unknown): string {
  return createHash("sha256").update(stable(value)).digest("hex");
}

function bytesHash(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function asContent(value: AnyRecord): Content {
  return {
    kpis: Array.isArray(value.kpis) ? value.kpis : [],
    charts: Array.isArray(value.charts) ? value.charts : [],
    tables: Array.isArray(value.tables) ? value.tables : [],
    warnings: Array.isArray(value.warnings) ? value.warnings : [],
    ...(Array.isArray(value.alerts) ? { alerts: value.alerts } : {}),
  };
}

function appendContent(sources: Content[]): Content {
  const alerts = sources.flatMap((source) => source.alerts ?? []);
  return {
    kpis: sources.flatMap((source) => source.kpis),
    charts: sources.flatMap((source) => source.charts),
    tables: sources.flatMap((source) => source.tables),
    warnings: sources.flatMap((source) => source.warnings),
    ...(alerts.length ? { alerts } : {}),
  };
}

function decorate(content: Content, index: number, site: { id: number; label: string }): Content {
  const prefix = `sitio-${site.id}`;
  const frameLabel = `${site.label} (#${site.id})`;
  const decorateBlock = (block: AnyRecord) => ({
    ...block,
    id: `${prefix}-${String(block.id ?? "bloque")}`,
    title: block.title ? `${frameLabel} · ${block.title}` : block.title,
    siteId: site.id,
    siteLabel: site.label,
  });
  return {
    kpis: content.kpis.map(decorateBlock),
    charts: content.charts.map(decorateBlock),
    tables: content.tables.map(decorateBlock),
    warnings: content.warnings.map((warning) => `[${frameLabel}] ${warning}`),
    ...(content.alerts ? { alerts: content.alerts } : {}),
  };
}

function routeQuery(input: Record<string, unknown>): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(input)) {
    if (value === undefined || value === null || value === "") continue;
    query.set(key, Array.isArray(value) ? value.join(",") : String(value));
  }
  return query.toString();
}

function sourceQuery(base: AnyRecord, siteId?: number): AnyRecord {
  return {
    periodo: base.periodo,
    desde: base.desde,
    hasta: base.hasta,
    ...(base.modalidad ? { modalidad: base.modalidad } : {}),
    ...(siteId === undefined ? {} : { ubicacionIds: String(siteId) }),
  };
}

function exportQuery(base: AnyRecord, mode: CaseMode): AnyRecord {
  return {
    ...base,
    margenUmbral: 15,
    coberturaCritico: 7,
    coberturaBajo: 15,
    coberturaNormal: 60,
    coberturaExceso: 90,
    modo: mode,
    umbralCorte: 0,
    umbralTienda: 0,
    agrupacion: "semana",
  };
}

function cashContent(cash: AnyRecord, base: AnyRecord, siteId?: number): Content {
  const resumen = cash.resumen ?? {};
  const groupColumns = [
    { key: "id", label: "Id", kind: "count" },
    { key: "nombre", label: "Nombre", kind: "text" },
    { key: "cortes", label: "Cortes", kind: "count" },
    { key: "exactos", label: "Exactos", kind: "count" },
    { key: "faltantes", label: "Faltantes", kind: "count" },
    { key: "sobrantes", label: "Sobrantes", kind: "count" },
    { key: "importeFaltantes", label: "Importe faltantes", kind: "money", economic: true },
    { key: "importeSobrantes", label: "Importe sobrantes", kind: "money", economic: true },
    { key: "diferenciaNeta", label: "Diferencia neta", kind: "money", economic: true },
    { key: "diferenciaAbsoluta", label: "Diferencia absoluta", kind: "money", economic: true },
    { key: "promedio", label: "Promedio", kind: "money", economic: true },
    { key: "porcentajeExactos", label: "% exactos", kind: "percentage", economic: true },
  ];
  const scoped = siteId === undefined ? undefined : siteId;
  const dateQuery = new URLSearchParams({
    desde: String(base.desde),
    hasta: String(base.hasta),
  });
  if (scoped !== undefined) dateQuery.set("ubicacionId", String(scoped));
  const alerts = (cash.alertas ?? []).map((alert: AnyRecord) => ({
    ...alert,
    href: `/caja/cortes?sesionId=${alert.sesionId}&${dateQuery.toString()}`,
  }));
  const trendRows = (cash.tendencia ?? []).map((row: AnyRecord) => ({
    fecha: row.fecha,
    importe: Number(row.importe),
    diferenciaAbsoluta: Number(row.diferenciaAbsoluta),
    cortes: Number(row.cortes),
    exactos: Number(row.exactos),
    porcentajeExactos: Number(row.porcentajeExactos),
  }));
  const warning = alerts.map((alert: AnyRecord) =>
    `Alerta de diferencia de caja [${alert.tipo}] sesión ${alert.sesionId}: ${alert.mensaje} · Importe ${alert.importe}`,
  );
  const numberKpi = (id: string, label: string, value: any, kind: string) => ({
    id, label, value, kind,
    ...(kind === "money" || kind === "percentage" ? { economic: true } : {}),
  });
  return {
    kpis: [
      numberKpi("cortes-caja", "Cortes de caja", resumen.cortes, "count"),
      numberKpi("cortes-exactos", "Cortes exactos", resumen.exactos, "count"),
      numberKpi("faltantes-caja", "Impacto faltantes", resumen.importeFaltantes, "money"),
      numberKpi("sobrantes-caja", "Impacto sobrantes", resumen.importeSobrantes, "money"),
      numberKpi("diferencia-neta-caja", "Diferencia neta del periodo", resumen.diferenciaNeta, "money"),
      numberKpi("diferencia-absoluta-caja", "Diferencia absoluta del periodo", resumen.diferenciaAbsoluta, "money"),
      numberKpi("exactitud-caja", "Porcentaje de exactitud", resumen.porcentajeExactos, "percentage"),
    ],
    charts: [
      {
        id: "diferencias-caja-tendencia",
        title: "Tendencia de Diferencia Neta",
        type: "line",
        categoryKey: "fecha",
        series: [
          { key: "importe", label: "Diferencia neta", kind: "money", economic: true },
          { key: "diferenciaAbsoluta", label: "Diferencia absoluta", kind: "money", economic: true },
        ],
        rows: trendRows,
      },
      {
        id: "diferencias-caja-exactitud",
        title: "Porcentaje de Exactitud",
        type: "line",
        categoryKey: "fecha",
        series: [{ key: "porcentajeExactos", label: "% exactos", kind: "percentage", economic: true }],
        rows: trendRows,
      },
    ],
    tables: [
      {
        id: "diferencias-por-cajero",
        title: "Diferencias por Cajero",
        columns: groupColumns,
        rows: cash.porCajero ?? [],
        totals: { nombre: "Total General", ...resumen },
      },
      {
        id: "diferencias-por-tienda",
        title: "Diferencias por Tienda",
        columns: groupColumns,
        rows: cash.porTienda ?? [],
        totals: { nombre: "Total General", ...resumen },
      },
    ],
    warnings: warning,
    alerts,
  };
}

function sourceCoverage(content: Content) {
  return {
    kpis: content.kpis.length,
    charts: content.charts.length,
    tables: content.tables.length,
    rows: content.tables.reduce((sum, table) => sum + (Array.isArray(table.rows) ? table.rows.length : 0), 0),
    totals: content.tables.filter((table) => table.totals && typeof table.totals === "object").length,
    tableIds: content.tables.map((table) => String(table.id)),
    chartIds: content.charts.map((chart) => String(chart.id)),
    contentHash: hash(content),
  };
}

function normalizeComparisonPayload(value: AnyRecord): AnyRecord {
  const day = (item: unknown) => typeof item === "string" ? item.slice(0, 10) : item;
  return {
    ...value,
    tiendas: (value.tiendas ?? []).map((store: AnyRecord) => ({
      ...store,
      mejorDia: store.mejorDia ? { ...store.mejorDia, fecha: day(store.mejorDia.fecha) } : store.mejorDia,
      peorDia: store.peorDia ? { ...store.peorDia, fecha: day(store.peorDia.fecha) } : store.peorDia,
    })),
    ventasPorFecha: (value.ventasPorFecha ?? []).map((point: AnyRecord) => ({
      ...point,
      fecha: day(point.fecha),
    })),
  };
}

function xlsxCell(value: any): any {
  if (value instanceof Date) return value.toISOString();
  if (value && typeof value === "object" && "text" in value) return value.text;
  return value ?? null;
}

function excelValue(column: AnyRecord, value: any): any {
  if (value === undefined || value === null) return null;
  if (["money", "quantity", "count", "percentage", "days"].includes(String(column.kind)) && value !== "Pendiente") {
    return toExcelNumber(value);
  }
  return value;
}

function worksheetName(title: string, used: Set<string>): string {
  const base = title.slice(0, 31) || "Hoja";
  let candidate = base;
  let suffix = 2;
  while (used.has(candidate)) {
    const marker = ` ${suffix}`;
    candidate = `${base.slice(0, 31 - marker.length)}${marker}`;
    suffix += 1;
  }
  used.add(candidate);
  return candidate;
}

function sheetRows(sheet: ExcelJS.Worksheet, width: number, first: number, last: number): any[][] {
  const rows: any[][] = [];
  for (let rowNumber = first; rowNumber <= last; rowNumber += 1) {
    rows.push(Array.from({ length: width }, (_, index) => xlsxCell(sheet.getRow(rowNumber).getCell(index + 1).value)));
  }
  return rows;
}

async function inspectWorkbook(bytes: Uint8Array, data: ComposedReport): Promise<AnyRecord> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(bytes as any);
  const normalized = normalizeExportTables(String(data.section), data.activeFilters, data.tables as ExportTable[]);
  const used = new Set<string>(["Periodo", "Indicadores"]);
  const expectedSheets: string[] = ["Periodo", "Indicadores"];
  const mismatches: string[] = [];
  const meta = workbook.getWorksheet("Periodo");
  if (!meta || xlsxCell(meta.getCell("B1").value) !== String(data.section)) mismatches.push("Periodo.section");
  if (!meta || xlsxCell(meta.getCell("A1").value) !== "Reporte") mismatches.push("Periodo.header");
  const indicator = workbook.getWorksheet("Indicadores");
  const expectedIndicators = (data.kpis as any[]).map((item) => [item.label, excelValue(item, item.value)]);
  if (!indicator) mismatches.push("Indicadores.missing");
  else {
    const actual = sheetRows(indicator, 2, 2, indicator.rowCount);
    if (!equalValues(actual, expectedIndicators)) mismatches.push("Indicadores.values");
  }
  for (const table of normalized) {
    const name = worksheetName(table.title, used);
    expectedSheets.push(name);
    const sheet = workbook.getWorksheet(name);
    if (!sheet) {
      mismatches.push(`table:${table.id}:missing`);
      continue;
    }
    const headers = table.columns.map((column) => column.label);
    const rows = table.rows.map((row) => table.columns.map((column) => excelValue(column, row[column.key])));
    const totals = [table.columns.map((column) => table.totals[column.key] ?? null)];
    if (!equalValues(sheetRows(sheet, table.columns.length, 1, 1), [headers])) mismatches.push(`table:${table.id}:headers`);
    if (!equalValues(sheetRows(sheet, table.columns.length, 2, 1 + rows.length), rows)) mismatches.push(`table:${table.id}:rows`);
    if (!equalValues(sheetRows(sheet, table.columns.length, 2 + rows.length, 2 + rows.length), totals)) mismatches.push(`table:${table.id}:totals`);
  }
  for (const chart of (data.charts as any[])) {
    const name = worksheetName(`Grafico ${chart.title}`, used);
    expectedSheets.push(name);
    const sheet = workbook.getWorksheet(name);
    const columns = [
      { key: chart.categoryKey, label: chart.categoryKey, kind: "text" },
      ...(chart.series ?? []).map((series: AnyRecord) => ({ key: series.key, label: series.label, kind: series.kind ?? "text" })),
    ];
    const expectedRows = (chart.rows ?? []).map((row: AnyRecord) => columns.map((column) => excelValue(column, row[column.key])));
    if (!sheet) {
      mismatches.push(`chart:${chart.id}:missing`);
      continue;
    }
    if (!equalValues(sheetRows(sheet, columns.length, 1, 1), [columns.map((column) => column.label)])) mismatches.push(`chart:${chart.id}:headers`);
    if (!equalValues(sheetRows(sheet, columns.length, 2, 1 + expectedRows.length), expectedRows)) mismatches.push(`chart:${chart.id}:rows`);
  }
  if ((data.warnings as string[]).length) {
    const name = worksheetName("Avisos", used);
    expectedSheets.push(name);
    const sheet = workbook.getWorksheet(name);
    const expected = (data.warnings as string[]).map((warning) => [warning]);
    if (!sheet || !equalValues(sheetRows(sheet, 1, 2, 1 + expected.length), expected)) mismatches.push("Avisos.values");
  }
  if (Array.isArray(data.alerts) && data.alerts.length) {
    const name = worksheetName("Alertas", used);
    expectedSheets.push(name);
    const sheet = workbook.getWorksheet(name);
    const expected = data.alerts.map((alert: AnyRecord) => ["sesionId", "tipo", "mensaje", "importe", "href"].map((key) => alert[key] ?? null));
    if (!sheet || !equalValues(sheetRows(sheet, 5, 2, 1 + expected.length), expected)) mismatches.push("Alertas.values");
  }
  const actualSheets = workbook.worksheets.map((sheet) => sheet.name);
  if (!equalValues(actualSheets, expectedSheets)) mismatches.push("sheet-order-or-count");
  return {
    validZip: Buffer.from(bytes).subarray(0, 2).toString("ascii") === "PK",
    sheetCount: workbook.worksheets.length,
    sheetNamesHash: hash(actualSheets),
    mismatches,
    expectedTableCount: normalized.length,
    expectedChartCount: (data.charts as any[]).length,
    expectedKpiCount: (data.kpis as any[]).length,
    expectedRowCount: normalized.reduce((sum, table) => sum + table.rows.length, 0),
  };
}

function pdfLines(data: ComposedReport): string[] {
  const lines = [
    `Periodo: ${JSON.stringify(data.range)}`,
    `Filtros: ${JSON.stringify(data.activeFilters)}`,
    "Indicadores:",
    ...(data.kpis as any[]).map((item) => `${item.label}: ${item.value}`),
    ...((data.warnings as string[]) ?? []).map((warning) => `Aviso: ${warning}`),
    ...((data.alerts ?? []) as AnyRecord[]).map((alert) =>
      `Alerta [${alert.tipo}] sesión ${alert.sesionId}: ${alert.mensaje} · Importe ${alert.importe}${"href" in alert && alert.href ? ` · Origen ${alert.href}` : ""}`,
    ),
    ...((data.charts as AnyRecord[]).flatMap((chart) => [
      `Matriz: ${chart.title}`,
      ...(chart.rows ?? []).map((row: AnyRecord) => JSON.stringify(row)),
    ])),
  ];
  const tables = normalizeExportTables(String(data.section), data.activeFilters, data.tables as ExportTable[]);
  for (const item of tables) {
    lines.push(
      item.title,
      ...item.rows.map((row) => item.columns.map((column) => `${column.label}: ${row[column.key] ?? ""}`).join(" | ")),
      `Totales: ${JSON.stringify(item.totals)}`,
    );
  }
  return wrapPdfLines(lines);
}

function routeFilterOrder(filters: unknown): unknown {
  if (!Array.isArray(filters)) return filters;
  const preferred = [
    "periodo", "desde", "hasta", "ubicacionIds", "productoIds", "telas", "colores",
    "unidades", "usuarioIds", "clienteIds", "proveedorIds", "formasPago", "facturado",
    "modalidad", "margenUmbral", "coberturaCritico", "coberturaBajo", "coberturaNormal",
    "coberturaExceso", "modo", "ubicacionId", "umbralCorte", "umbralTienda", "agrupacion",
  ];
  const byKey = new Map(filters.map((item) => {
    const text = String(item);
    return [text.slice(0, text.indexOf("=")), item] as const;
  }));
  return [
    ...preferred.flatMap((key) => byKey.has(key) ? [byKey.get(key)] : []),
    ...filters.filter((item) => !preferred.includes(String(item).slice(0, String(item).indexOf("=")))),
  ];
}

function pdfMetrics(bytes: Buffer): AnyRecord {
  const directory = execFileSync("mktemp", ["-d", join(tmpdir(), "report-export-pdf-XXXXXX")], { encoding: "utf8" }).trim();
  const path = join(directory, "download.pdf");
  const pageCount = (bytes.toString("latin1").match(/\/Type \/Page\b/g) ?? []).length;
  try {
    writeFileSync(path, bytes, { mode: 0o600 });
    const script = [
      "import fitz,hashlib,json,sys",
      "doc=fitz.open(sys.argv[1])",
      "text='\\n'.join(page.get_text() for page in doc)",
      "rendered=0",
      "sizes=[]",
      "for page in doc:",
      " pix=page.get_pixmap(matrix=fitz.Matrix(1,1),alpha=False)",
      " rendered+=1",
      " sizes.append([pix.width,pix.height])",
      "print(json.dumps({'fitz':True,'pageCount':len(doc),'textChars':len(text),'textHash':hashlib.sha256(text.encode()).hexdigest(),'renderedPages':rendered,'renderSizes':sizes}))",
    ].join("\n");
    const output = execFileSync("python3", ["-c", script, path], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
    let text = "";
    try {
      text = execFileSync("pdftotext", [path, "-"], {
        encoding: "utf8",
        maxBuffer: 20 * 1024 * 1024,
        stdio: ["ignore", "pipe", "ignore"],
      });
    } catch {
      // fitz still supplies page/text metrics when pdftotext is absent.
    }
    return { ...JSON.parse(output), text };
  } catch {
    let text = "";
    let renderedPages = 0;
    const renderSizes: number[][] = [];
    try {
      text = execFileSync("pdftotext", [path, "-"], {
        encoding: "utf8",
        maxBuffer: 20 * 1024 * 1024,
        stdio: ["ignore", "pipe", "ignore"],
      });
      const prefix = join(directory, "page");
      const pagesToRender = [...new Set([1, pageCount].filter((page) => page > 0))];
      for (const page of pagesToRender) {
        execFileSync("pdftoppm", ["-f", String(page), "-l", String(page), "-png", "-r", "72", path, `${prefix}-${page}`], {
          stdio: ["ignore", "ignore", "ignore"],
        });
      }
      const rendered = readdirSync(directory)
        .filter((name) => name.startsWith("page-") && name.endsWith(".png"))
        .sort();
      renderedPages = rendered.length;
      for (const name of rendered) {
        const png = readFileSync(join(directory, name));
        if (png.toString("ascii", 0, 8) === "\x89PNG\r\n\x1a\n") {
          renderSizes.push([png.readUInt32BE(16), png.readUInt32BE(20)]);
        }
      }
    } catch {
      // Keep the dependency-free page count below if either command is unavailable.
    }
    return {
      fitz: false,
      pageCount,
      textChars: text.length,
      textHash: text ? createHash("sha256").update(text).digest("hex") : null,
      text,
      renderedPages,
      renderSizes,
    };
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

function pdfStreamHash(bytes: Buffer): string {
  return hash(pdfStreams(bytes));
}

function pdfStreams(bytes: Buffer): string[] {
  const ascii = bytes.toString("latin1");
  return [...ascii.matchAll(/stream\n([\s\S]*?)\nendstream/g)].map((match) => match[1]!);
}

function pdfStreamDiff(left: Buffer, right: Buffer): AnyRecord {
  const leftStreams = pdfStreams(left);
  const rightStreams = pdfStreams(right);
  const firstDifferent = leftStreams.findIndex((stream, index) => stream !== rightStreams[index]);
  const textHashes = (stream: string) =>
    [...stream.matchAll(/\((.*?)\) Tj/g)].map((match) => hash(match[1]));
  const textValues = (stream: string) =>
    [...stream.matchAll(/\((.*?)\) Tj/g)].map((match) => match[1]);
  const leftText = firstDifferent < 0 ? [] : textHashes(leftStreams[firstDifferent] ?? "");
  const rightText = firstDifferent < 0 ? [] : textHashes(rightStreams[firstDifferent] ?? "");
  const leftValues = firstDifferent < 0 ? [] : textValues(leftStreams[firstDifferent] ?? "");
  const rightValues = firstDifferent < 0 ? [] : textValues(rightStreams[firstDifferent] ?? "");
  const firstDifferentText = leftText.findIndex((value, index) => value !== rightText[index]);
  return {
    leftCount: leftStreams.length,
    rightCount: rightStreams.length,
    firstDifferent,
    leftLength: firstDifferent < 0 ? undefined : leftStreams[firstDifferent]?.length,
    rightLength: firstDifferent < 0 ? undefined : rightStreams[firstDifferent]?.length,
    textCount: leftText.length,
    firstDifferentText,
    leftTextHash: firstDifferentText < 0 ? undefined : leftText[firstDifferentText],
    rightTextHash: firstDifferentText < 0 ? undefined : rightText[firstDifferentText],
    leftFilter: leftValues[3],
    rightFilter: rightValues[3],
  };
}

function pdfContainsLastColumns(text: string, data: ComposedReport): { ok: boolean; missing: string[] } {
  const comparable = (value: unknown) => String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .replace(/[^\x20-\x7e]/g, "?");
  const normalized = comparable(text);
  const tables = normalizeExportTables(String(data.section), data.activeFilters, data.tables as ExportTable[]);
  const missing: string[] = [];
  for (const table of tables) {
    const title = comparable(table.title);
    if (!normalized.includes(title)) {
      missing.push(String(table.id));
      continue;
    }
    const last = table.columns.at(-1);
    if (table.rows.length > 0 && last && !normalized.includes(comparable(last.label))) {
      missing.push(`${table.id}.last-column:${comparable(last.label)}`);
      continue;
    }
    const lastTotal = last ? table.totals[last.key] : undefined;
    if (lastTotal !== undefined && lastTotal !== null && String(lastTotal) !== "" && !normalized.includes(comparable(lastTotal))) {
      missing.push(`${table.id}.last-total`);
    }
  }
  return { ok: missing.length === 0, missing };
}

function equalValues(left: unknown, right: unknown): boolean {
  return stable(left) === stable(right);
}

type RequestHarness = {
  baseUrl: string;
  setAuth(mode: AuthMode): void;
  get(path: string, expectedContent?: "json" | "xlsx" | "pdf"): Promise<{ status: number; bytes: Buffer; json?: AnyRecord; contentType: string }>;
  close(): Promise<void>;
};

async function makeHarness(): Promise<RequestHarness> {
  const [{ default: reportesRouter }, { default: analyticsRouter }] = await Promise.all([
    import("../routes/reportes"),
    import("../routes/admin-analytics"),
  ]);
  const authFor = (mode: AuthMode): AnyRecord => ({
    sessionId: "read-only-export-verification",
    user: {
      id: mode === "admin" ? 0 : -1,
      nombre: "verification-only",
      usuario: "verification-only",
      rol: mode === "admin" ? "ADMIN" : "CAJA",
      alcanceConsulta: mode === "admin" ? "TODAS" : "PROPIA",
      ubicacionId: mode === "admin" ? null : 1,
      activo: true,
    },
    location: null,
  });
  const patchSessionOnly = (router: any, preserve?: any) => {
    for (const layer of router.stack ?? []) {
      if (layer.route || layer.handle === preserve) continue;
      if (layer.handle?.name === "requireSession") {
        layer.handle = (_req: any, _res: any, next: any) => next();
      }
    }
  };
  // Keep every requireRole layer. Only session lookup is bypassed. Reportes'
  // permission layer is intentionally replaced because this harness has no
  // persisted user/permission/session state; the ADMIN Control role gate is
  // the actual imported function and remains untouched.
  patchSessionOnly(reportesRouter, controlOperativoRoleGate);
  patchSessionOnly(analyticsRouter);
  for (const layer of (reportesRouter as any).stack ?? []) {
    if (!layer.route && layer.handle !== controlOperativoRoleGate && layer.handle?.name !== "requireSession") {
      layer.handle = (_req: any, _res: any, next: any) => next();
    }
  }
  const app: Express = express();
  let activeAuth = authFor("admin");
  app.use((req, _res, next) => {
    req.auth = activeAuth as any;
    next();
  });
  app.use(express.json());
  app.use("/api", reportesRouter);
  app.use("/api", analyticsRouter);
  app.use((error: unknown, _req: any, res: any, _next: any) => {
    res.status(500).json({ error: "Harness route failure", kind: error instanceof Error ? error.name : "unknown" });
  });
  const server = createServer(app);
  await new Promise<void>((resolveListen, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolveListen());
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("No se pudo abrir el arnés HTTP local.");
  const baseUrl = `http://127.0.0.1:${address.port}`;
  return {
    baseUrl,
    setAuth(mode) { activeAuth = authFor(mode); },
    async get(path, expectedContent) {
      const response = await fetch(`${baseUrl}${path}`);
      const bytes = Buffer.from(await response.arrayBuffer());
      const contentType = response.headers.get("content-type") ?? "";
      if (expectedContent && response.status === 200 && !contentType.includes(expectedContent === "xlsx"
        ? "spreadsheet"
        : expectedContent)) {
        throw new Error(`Tipo inesperado en ${path}: ${contentType}`);
      }
      let json: AnyRecord | undefined;
      if (contentType.includes("json") && bytes.length) json = JSON.parse(bytes.toString("utf8"));
      return { status: response.status, bytes, json, contentType };
    },
    async close() {
      await new Promise<void>((resolveClose, reject) => server.close((error) => error ? reject(error) : resolveClose()));
    },
  };
}

async function withReadOnlySnapshot<T>(callback: (query: (text: string, values?: unknown[]) => Promise<any>) => Promise<T>): Promise<T> {
  const client = await (pool as any).connect();
  let pending: Promise<unknown> = Promise.resolve();
  const originalQuery = (pool as any).query;
  const originalConnect = (pool as any).connect;
  const originalClientQuery = client.query.bind(client);
  const query = (text: string | AnyRecord, values: unknown[] = []) => {
    const sql = typeof text === "string" ? text : text.text;
    const params = typeof text === "string" ? values : text.values ?? values;
    if (WRITE_SQL.test(sql)) throw new Error("La verificación rechazó una sentencia que no es de lectura.");
    const operation = pending.then(async () => {
      if (typeof text === "string") return originalClientQuery(sql, params);
      return originalClientQuery({ ...text, values: params });
    });
    pending = operation.then(() => undefined, () => undefined);
    return operation;
  };
  await client.query("BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");
  try {
    (pool as any).query = query;
    (pool as any).connect = async () => {
      const readonlyClient = Object.create(client);
      readonlyClient.query = query;
      readonlyClient.release = () => undefined;
      return readonlyClient;
    };
    return await callback((text, values) => query(text, values));
  } finally {
    await pending;
    await client.query("ROLLBACK").catch(() => undefined);
    (pool as any).query = originalQuery;
    (pool as any).connect = originalConnect;
    client.release();
    await (pool as any).end();
  }
}

async function discoverYear(query: (text: string, values?: unknown[]) => Promise<any>): Promise<{ year: number; sites: number[] }> {
  const eventAt = accountedDocumentAt("t");
  const predicate = accountedDocumentPredicate("t");
  const years = await query(
    `SELECT EXTRACT(YEAR FROM (${eventAt} AT TIME ZONE 'America/Mexico_City'))::int AS year,
            COUNT(DISTINCT t.id)::int AS tickets
       FROM tickets t WHERE ${predicate} AND ${eventAt} IS NOT NULL
       GROUP BY 1 ORDER BY tickets DESC,year DESC`,
  );
  const candidates = [2026, ...years.rows.map((row: AnyRecord) => Number(row.year))].filter((year, index, all) =>
    Number.isInteger(year) && all.indexOf(year) === index,
  );
  for (const year of candidates) {
    const result = await query(
      `SELECT t.ubicacion_id::int AS site_id,COUNT(DISTINCT t.id)::int AS tickets,
              COALESCE(SUM(l.importe),0)::numeric AS sales
         FROM tickets t JOIN ticket_lineas l ON l.ticket_id=t.id
        WHERE ${predicate} AND ${eventAt} >= $1::timestamptz AND ${eventAt} < $2::timestamptz
        GROUP BY t.ubicacion_id HAVING COUNT(DISTINCT t.id)>0
        ORDER BY sales DESC,tickets DESC,site_id`,
      [`${year}-01-01T00:00:00.000Z`, `${year + 1}-01-01T00:00:00.000Z`],
    );
    const sites = result.rows
      .map((row: AnyRecord) => ({ id: Number(row.site_id), sales: Number(row.sales) }))
      .filter((row: AnyRecord) => Number.isInteger(row.id) && row.sales > 0)
      .map((row: AnyRecord) => row.id);
    if (sites.length >= 2) return { year, sites };
  }
  throw new Error("No se encontraron dos sitios reales con ventas cobradas/autorizadas.");
}

async function discoverComparisonSites(
  query: (text: string, values?: unknown[]) => Promise<any>,
): Promise<Array<{ id: number; label: string }>> {
  const result = await query(
    `SELECT id::int AS id,nombre
       FROM ubicaciones
      WHERE activa=true AND tipo IN ('TIENDA','BODEGA')
      ORDER BY nombre,id`,
  );
  return result.rows
    .map((row: AnyRecord) => ({ id: Number(row.id), label: String(row.nombre) }))
    .filter((site: { id: number; label: string }) => Number.isInteger(site.id) && site.label.length > 0);
}

async function requestJson(harness: RequestHarness, path: string): Promise<AnyRecord> {
  const response = await harness.get(path, "json");
  if (response.status !== 200 || !response.json) {
    const error = response.json?.error;
    throw new Error(`JSON ${response.status} en ${path}${error ? `: ${String(error).slice(0, 300)}` : ""}`);
  }
  return response.json;
}

async function screenContent(
  harness: RequestHarness,
  view: View,
  base: AnyRecord,
  mode: CaseMode,
  comparisonSites: Array<{ id: number; label: string }>,
): Promise<{ content: Content; coverage: AnyRecord[] }> {
  const coverage: AnyRecord[] = [];
  const frameIds = mode === "comparar" ? comparisonSites.map((site) => site.id) : [undefined];
  const frameContents: Content[] = [];
  for (let index = 0; index < frameIds.length; index += 1) {
    const siteId = frameIds[index];
    const sourceContents: Content[] = [];
    for (const source of REPORT_SOURCES[view]) {
      const response = await requestJson(harness, `/api/reportes/${source}?${routeQuery(sourceQuery(base, siteId))}`);
      const content = asContent(response);
      sourceContents.push(content);
      coverage.push({ frame: mode === "comparar" ? index + 1 : 0, source, ...sourceCoverage(content) });
    }
    if (view === "control-operativo") {
      const cashPath = `/api/admin/diferencias?${routeQuery({
        desde: base.desde, hasta: base.hasta,
        ...(siteId === undefined ? {} : { ubicacionId: siteId }),
        umbralCorte: 0, umbralTienda: 0, agrupacion: "semana",
      })}`;
      const cash = await requestJson(harness, cashPath);
      const content = cashContent(cash, base, siteId);
      sourceContents.push(content);
      coverage.push({ frame: mode === "comparar" ? index + 1 : 0, source: "diferencias-caja", ...sourceCoverage(content) });
    }
    frameContents.push(mode === "comparar"
      ? decorate(appendContent(sourceContents), index, comparisonSites[index]!)
      : appendContent(sourceContents));
  }
  let content = appendContent(frameContents);
  if (view === "ventas" && (mode === "normal" || mode === "comparar")) {
    const globalPath = `/api/admin/comparacion-tiendas?${routeQuery({
      periodo: "personalizado", desde: base.desde, hasta: base.hasta,
    })}`;
    const x04 = await requestJson(harness, globalPath);
    const normalizedX04 = normalizeComparisonPayload(x04);
    const x04Content: Content = {
      kpis: [],
      charts: comparisonCharts(normalizedX04 as any),
      tables: [comparisonTable(normalizedX04 as any)],
      warnings: [],
    };
    content = appendContent([content, x04Content]);
    coverage.push({ frame: 0, source: "admin/comparacion-tiendas", ...sourceCoverage(x04Content) });
  }
  return { content, coverage };
}

async function verifyCase(
  harness: RequestHarness,
  view: View,
  mode: CaseMode,
  base: AnyRecord,
  comparisonSites: Array<{ id: number; label: string }>,
  writeArtifacts: boolean,
): Promise<AnyRecord> {
  const input: ComposedReportInput = exportQuery(base, mode) as ComposedReportInput;
  const locations = undefined;
  const direct = await buildComposedReport(view, input, locations, true, {
    rol: "ADMIN",
    alcanceConsulta: "TODAS",
  });
  const directRecord = direct as AnyRecord;
  const screen = await screenContent(harness, view, base, mode, comparisonSites);
  const comparableTables = (tables: unknown) =>
    (Array.isArray(tables) ? tables : []).map((table: AnyRecord) => {
      const { economic: _economic, ...withoutEconomicMarker } = table;
      return withoutEconomicMarker;
    });
  const screenComparable = {
    kpis: screen.content.kpis,
    charts: screen.content.charts,
    tables: comparableTables(screen.content.tables),
    warnings: screen.content.warnings,
    alerts: screen.content.alerts ?? [],
  };
  const directComparable = {
    kpis: directRecord.kpis,
    charts: directRecord.charts,
    tables: comparableTables(directRecord.tables),
    warnings: directRecord.warnings,
    alerts: directRecord.alerts ?? [],
  };
  const screenMatchesBuilder = equalValues(screenComparable, directComparable);
  if (!screenMatchesBuilder) {
    const blockSummary = (value: AnyRecord) => ({
      kpiCount: (value.kpis ?? []).length,
      chartCount: (value.charts ?? []).length,
      tableCount: (value.tables ?? []).length,
      chartIdsHash: hash((value.charts ?? []).map((item: AnyRecord) => String(item.id))),
      tableIdsHash: hash((value.tables ?? []).map((item: AnyRecord) => String(item.id))),
      rowCountsHash: hash((value.tables ?? []).map((item: AnyRecord) => Array.isArray(item.rows) ? item.rows.length : 0)),
      kpisByFrame: Object.fromEntries((value.kpis ?? []).reduce((counts: Map<string, number>, item: AnyRecord) => {
        const frame = String(item.id).split("-").slice(0, 2).join("-");
        counts.set(frame, (counts.get(frame) ?? 0) + 1);
        return counts;
      }, new Map<string, number>())),
      warnings: Array.isArray(value.warnings) ? value.warnings.length : 0,
      alerts: Array.isArray(value.alerts) ? value.alerts.length : 0,
    });
    const mismatchedBlocks = (left: AnyRecord, right: AnyRecord, key: "kpis" | "charts" | "tables") => {
      const leftItems = left[key] ?? [];
      const rightItems = right[key] ?? [];
      return leftItems.flatMap((item: AnyRecord, index: number) => {
        const other = rightItems[index];
        return other && hash(item) === hash(other)
          ? []
          : [`${String(item.id)}:${hash(item)}!=${other ? hash(other) : "missing"}`];
      }).slice(0, 12);
    };
    throw new Error(
      `La composición de pantalla no coincide con el builder en ${view}/${mode}. `
      + `screen=${hash(screenComparable)} builder=${hash(directComparable)} `
      + `screenShape=${JSON.stringify(blockSummary(screenComparable))} `
      + `builderShape=${JSON.stringify(blockSummary(directComparable))} `
      + `blockDiff=${JSON.stringify({
        kpis: mismatchedBlocks(screenComparable, directComparable, "kpis"),
        charts: mismatchedBlocks(screenComparable, directComparable, "charts"),
        tables: mismatchedBlocks(screenComparable, directComparable, "tables"),
      })} warningDiff=${JSON.stringify({
        screen: screenComparable.warnings,
        builder: directComparable.warnings,
        screenHash: hash(screenComparable.warnings),
        builderHash: hash(directComparable.warnings),
      })}`,
    );
  }
  const xlsxPath = `/api/reportes/vistas/${view}/export.xlsx?${routeQuery(input)}`;
  const pdfPath = `/api/reportes/vistas/${view}/export.pdf?${routeQuery(input)}`;
  const xlsx = await harness.get(xlsxPath, "xlsx");
  const pdf = await harness.get(pdfPath, "pdf");
  if (xlsx.status !== 200 || pdf.status !== 200) throw new Error(`Descarga HTTP fallida en ${view}/${mode}.`);
  const workbook = await inspectWorkbook(xlsx.bytes, direct);
  const expectedPdf = createTextPdf(`Reporte ${direct.section}`, pdfLines({
    ...direct,
    activeFilters: routeFilterOrder(direct.activeFilters),
  } as ComposedReport));
  const expectedPdfHash = bytesHash(expectedPdf);
  const actualPdfHash = bytesHash(pdf.bytes);
  const pdfInspect = pdfMetrics(pdf.bytes);
  const pdfExpectedInspect = pdfMetrics(expectedPdf);
  const pdfTextCheck = pdfInspect.text
    ? pdfContainsLastColumns(String(pdfInspect.text), direct)
    : { ok: true, missing: [] };
  const parsedOk = workbook.validZip
    && workbook.mismatches.length === 0
    && actualPdfHash === expectedPdfHash
    && (!pdfInspect.textHash || pdfInspect.textHash === pdfExpectedInspect.textHash)
    && pdfTextCheck.ok
    && pdfInspect.pageCount === pdfExpectedInspect.pageCount
    && pdfInspect.textChars === pdfExpectedInspect.textChars
    && (!pdfInspect.fitz || pdfInspect.renderedPages > 0);
  if (!parsedOk) {
    throw new Error(
      `Contenido exportado incompleto en ${view}/${mode}. `
      + `xlsx=${JSON.stringify(workbook)} `
      + `pdf=${JSON.stringify({
        actualHash: actualPdfHash,
        expectedHash: expectedPdfHash,
        actualStreamHash: pdfStreamHash(pdf.bytes),
        expectedStreamHash: pdfStreamHash(expectedPdf),
        streamDiff: pdfStreamDiff(pdf.bytes, expectedPdf),
        textCheck: pdfTextCheck,
        actual: pdfInspect,
        expected: pdfExpectedInspect,
      })}`,
    );
  }
  let artifactPaths: AnyRecord | undefined;
  if (writeArtifacts && view === "ventas" && mode === "normal") {
    await writeFile(join(EXPORT_DIR, "reportes-ventas-normal-global.xlsx"), xlsx.bytes, { mode: 0o600 });
    await writeFile(join(EXPORT_DIR, "reportes-ventas-normal-global.pdf"), pdf.bytes, { mode: 0o600 });
    await chmod(join(EXPORT_DIR, "reportes-ventas-normal-global.xlsx"), 0o600);
    await chmod(join(EXPORT_DIR, "reportes-ventas-normal-global.pdf"), 0o600);
    artifactPaths = {
      xlsx: "reports/exports/reportes-ventas-normal-global.xlsx",
      pdf: "reports/exports/reportes-ventas-normal-global.pdf",
    };
  }
  return {
    view,
    mode,
    sourceCoverage: screen.coverage,
    composed: {
      kpis: directRecord.kpis.length,
      charts: directRecord.charts.length,
      tables: directRecord.tables.length,
      rows: (directRecord.tables as AnyRecord[]).reduce((sum, table) => sum + table.rows.length, 0),
      totals: (directRecord.tables as AnyRecord[]).filter((table) => table.totals).length,
      contentHash: hash(directComparable),
    },
    downloads: {
      xlsx: {
        status: xlsx.status,
        contentType: xlsx.contentType,
        bytes: xlsx.bytes.length,
        sha256: bytesHash(xlsx.bytes),
        ...workbook,
      },
      pdf: {
        status: pdf.status,
        contentType: pdf.contentType,
        bytes: pdf.bytes.length,
        sha256: actualPdfHash,
        expectedSha256: expectedPdfHash,
        ...pdfInspect,
      },
    },
    screenMatchesBuilder,
    artifacts: artifactPaths ?? null,
  };
}

async function assertControlRoleMatrix(harness: RequestHarness, base: AnyRecord): Promise<AnyRecord> {
  const query = routeQuery(exportQuery(base, "normal"));
  const paths = [
    `/api/reportes/control-operativo/export.xlsx?${query}`,
    `/api/reportes/control-operativo/export.pdf?${query}`,
    `/api/reportes/vistas/control-operativo/export.xlsx?${query}`,
    `/api/reportes/vistas/control-operativo/export.pdf?${query}`,
  ];
  harness.setAuth("nonadmin");
  const nonAdmin = [];
  for (const path of paths) nonAdmin.push((await harness.get(path)).status);
  harness.setAuth("admin");
  const admin = [];
  for (const path of paths) admin.push((await harness.get(path)).status);
  if (nonAdmin.some((status) => status !== 403) || admin.some((status) => status !== 200)) {
    throw new Error("La matriz HTTP de role gate para exportaciones Control no coincide.");
  }
  return { paths: paths.map((path) => path.replace(/\?.*$/, "")), nonAdmin, admin };
}

async function writeReport(report: AnyRecord): Promise<void> {
  const lines = [
    "# Verificación de descargas XLSX/PDF de Reportes (solo lectura)",
    "",
    `Estado: **${report.status}**.`,
    "",
    "## Alcance y limitación",
    "",
    "Se montaron los routers reales en un arnés Express local sobre `127.0.0.1`.",
    "No es una descarga contra la aplicación desplegada, no es un navegador y no crea una sesión real:",
    "el arnés inyecta un contexto autorizado en memoria. La comprobación sí invoca los handlers HTTP",
    "reales y recibe sus bytes. El contexto ADMIN se usó para cubrir las cinco pestañas y el comparativo;",
    "la matriz de Control conserva el middleware de rol real y verifica ADMIN/non-ADMIN.",
    "",
    "Todas las lecturas, incluidas las hechas por rutas y comparativos, usaron una única conexión",
    "`READ ONLY REPEATABLE READ`. Se rechazaron sentencias de escritura. No se ejecutaron inicializadores,",
    "usuarios, sesiones, fixtures ni escrituras de negocio. El reporte no contiene filas ni nombres privados.",
    "",
    "## Fuentes de pantalla cubiertas",
    "",
    "La composición se comparó contra las respuestas JSON de cada fuente que consume la pantalla:",
    "`Ventas`, `Qué comprar` (`que-comprar`, `inventario`, `mapas-calor`, `color`, `compras`),",
    "`Utilidad`, `Clientes` (`clientes`, `pagos-dirigidos`) y `Control operativo`",
    "(`control-operativo` más `admin/diferencias`). Ventas global incluye también X04",
    "(`admin/comparacion-tiendas`), tanto en Normal como en Comparar.",
    "",
    "## Resultados",
    "",
    `- Snapshot: \`${report.snapshot}\``,
    `- Periodo real seleccionado: \`${report.period}\``,
    `- Sitios elegibles para marcos de comparación: ${report.comparisonSiteCount}`,
    `- Casos verificados: ${report.cases.length}`,
    `- Errores: ${report.errors.length}`,
    "",
    "| Vista | Modo | Fuentes (KPI/chart/tabla/filas) | XLSX bytes / SHA-256 | PDF bytes / SHA-256 | Pantalla=builder |",
    "|---|---|---|---:|---|---|",
    ...report.cases.map((item: AnyRecord) => {
      const sourceSummary = item.sourceCoverage
        .map((source: AnyRecord) => `${source.source} ${source.kpis}/${source.charts}/${source.tables}/${source.rows}`)
        .join("; ");
      return `| ${item.view} | ${item.mode} | ${sourceSummary} | ${item.downloads.xlsx.bytes} / \`${item.downloads.xlsx.sha256}\` | ${item.downloads.pdf.bytes} / \`${item.downloads.pdf.sha256}\` | ${String(item.screenMatchesBuilder)} |`;
    }),
    "",
    "Los hashes de contenido y bytes son evidencia de integridad, no sustituyen la lectura del documento.",
    "Cada XLSX se abrió con ExcelJS y se verificaron hojas, encabezados, todos los KPI, filas, totales,",
    "gráficas, avisos y alertas. Cada PDF se abrió con fitz si estuvo instalado; en este entorno se usaron",
    "`pdftotext` y `pdftoppm` para extraer texto y renderizar la primera y última página.",
    "Se comprobó que el texto incluyera las últimas columnas/valores y se compararon bytes/texto",
    "contra el PDF esperado del mismo modelo compuesto.",
    "",
    "## Matriz de autorización de Control",
    "",
    "| Ruta | non-ADMIN | ADMIN |",
    "|---|---:|---:|",
    ...report.controlMatrix.paths.map((path: string, index: number) => `| \`${path}\` | ${report.controlMatrix.nonAdmin[index]} | ${report.controlMatrix.admin[index]} |`),
    "",
    "## Artefactos locales",
    "",
    report.artifacts.length
      ? report.artifacts.map((path: string) => `- \`${path}\` (modo 0600; bytes/hash están en la tabla anterior).`).join("\n")
      : "- No se retuvieron bytes; use `REPORT_EXPORT_WRITE_ARTIFACTS=1` para un par local 0600.",
    "",
    "## Limitaciones y fallos históricos",
    "",
    `Fitz/PyMuPDF: ${report.fitzAvailable ? "disponible y utilizado" : "no disponible; no se instaló"}.`,
    "No se afirma descarga desde una aplicación desplegada ni autenticación de navegador.",
    "La numeración/mapa de los nueve fallos originales no es recuperable en este contexto; se deja",
    "deliberadamente para el agente propietario. La evidencia de este pase cubre el punto 8 de exports",
    "y la comprobación de permisos Control sin inventar una correspondencia numérica.",
    "",
  ];
  await writeFile(REPORT_PATH, lines.join("\n"), { encoding: "utf8", mode: 0o600 });
  await chmod(REPORT_PATH, 0o600);
}

async function main(): Promise<void> {
  const writeArtifacts = process.env.REPORT_EXPORT_WRITE_ARTIFACTS === "1";
  if (writeArtifacts) {
    const { mkdir } = await import("node:fs/promises");
    await mkdir(EXPORT_DIR, { recursive: true, mode: 0o700 });
  }
  const started = Date.now();
  await withReadOnlySnapshot(async (query) => {
    const selected = await discoverYear(query);
    const comparisonSites = await discoverComparisonSites(query);
    const harness = await makeHarness();
    try {
      harness.setAuth("admin");
      if (comparisonSites.length < 2) throw new Error("El catálogo real no tiene dos sitios elegibles para comparación.");
      const base = {
        periodo: "personalizado",
        desde: `${selected.year}-01-01`,
        hasta: `${selected.year}-12-31`,
        modalidad: "TODO",
      };
      const cases: AnyRecord[] = [];
      for (const view of VIEWS) cases.push(await verifyCase(harness, view, "normal", base, comparisonSites, writeArtifacts));
      for (const view of VIEWS) cases.push(await verifyCase(harness, view, "comparar", base, comparisonSites, false));
      const controlMatrix = await assertControlRoleMatrix(harness, base);
      const artifacts = cases.flatMap((item) => item.artifacts ? Object.values(item.artifacts) : []);
      const fitzAvailable = cases.every((item) => item.downloads.pdf.fitz === true);
      const report = {
        status: "HTTP_READ_ONLY_EXPORTS_COMPLETED",
        snapshot: "single READ ONLY REPEATABLE READ connection",
        period: `${selected.year}-01-01/${selected.year}-12-31`,
        comparisonSiteCount: comparisonSites.length,
        cases,
        controlMatrix,
        artifacts,
        fitzAvailable,
        durationMs: Date.now() - started,
        errors: [],
      };
      await writeReport(report);
      console.log(`Readonly export verification written: ${REPORT_PATH}`);
    } finally {
      await harness.close();
    }
  });
}

main().catch(async (error) => {
  const report = {
    status: "HTTP_READ_ONLY_EXPORTS_BLOCKED",
    snapshot: "single READ ONLY REPEATABLE READ connection",
    period: "not selected",
    comparisonSiteCount: 0,
    cases: [],
    controlMatrix: { paths: [], nonAdmin: [], admin: [] },
    artifacts: [],
    fitzAvailable: false,
    errors: [error instanceof Error ? error.message.slice(0, 2000) : "unknown"],
  };
  await writeReport(report).catch(() => undefined);
  console.error(`Readonly export verification blocked: ${report.errors[0]}`);
  process.exitCode = 1;
});