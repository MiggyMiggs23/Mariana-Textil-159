import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import PDFDocument from "pdfkit";
import {
  formatReportDate,
  formatReportFilters,
  formatReportRange,
  formatReportValue,
  hasMeaningfulTotals,
  labelForReportKey,
  reportTotalLabel,
  type ReportPresentationCatalogs,
} from "./report-presentation";

function pdfText(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7e]/g, "?")
    .replaceAll("\\", "\\\\")
    .replaceAll("(", "\\(")
    .replaceAll(")", "\\)");
}

/** Wrap composed-report lines so every visible value stays inside the page. */
export function wrapPdfLines(lines: string[], maxChars = 58): string[] {
  const wrapped: string[] = [];
  for (const source of lines) {
    let line = String(source);
    if (line.length === 0) {
      wrapped.push(line);
      continue;
    }
    while (line.length > maxChars) {
      let cut = line.lastIndexOf(" ", maxChars);
      if (cut < Math.floor(maxChars * 0.6)) cut = maxChars;
      wrapped.push(line.slice(0, cut));
      line = `  ${line.slice(cut).trimStart()}`;
    }
    wrapped.push(line);
  }
  return wrapped;
}

/** Small dependency-free, valid multi-page PDF for tabular financial exports. */
export function createTextPdf(title: string, lines: string[]): Buffer {
  const pageSize = 55;
  const chunks =
    lines.length === 0
      ? [[]]
      : Array.from(
          { length: Math.ceil(lines.length / pageSize) },
          (_, index) => lines.slice(index * pageSize, (index + 1) * pageSize),
        );
  const pageIds = chunks.map((_, index) => 4 + index * 2);
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${chunks.length} >>`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  chunks.forEach((chunk, index) => {
    const pageId = pageIds[index]!;
    const contentId = pageId + 1;
    const visible = [
      title,
      `Pagina ${index + 1} de ${chunks.length}`,
      ...chunk,
    ];
    const content = [
      "BT",
      "/F1 9 Tf",
      "36 806 Td",
      "11 TL",
      ...visible.flatMap((line) => [`(${pdfText(line)}) Tj`, "T*"]),
      "ET",
    ].join("\n");
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentId} 0 R >>`,
      `<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`,
    );
  });
  let body = "%PDF-1.4\n";
  const offsets = [0];
  for (let index = 0; index < objects.length; index += 1) {
    offsets.push(Buffer.byteLength(body));
    body += `${index + 1} 0 obj\n${objects[index]}\nendobj\n`;
  }
  const xref = Buffer.byteLength(body);
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  body += offsets
    .slice(1)
    .map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`)
    .join("");
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(body, "ascii");
}

/**
 * The legacy text export intentionally normalizes to ASCII.  Financial
 * disclosures are contractual Spanish text, so this narrow companion keeps
 * WinAnsi characters such as "crédito" visible in the generated document.
 */
export function createLatin1TextPdf(title: string, lines: string[]): Buffer {
  const text = (value: unknown) => String(value ?? "")
    .replace(/[^\x20-\xff]/g, "?")
    .replaceAll("\\", "\\\\")
    .replaceAll("(", "\\(")
    .replaceAll(")", "\\)");
  const pageSize = 55;
  const chunks = lines.length === 0
    ? [[]]
    : Array.from(
        { length: Math.ceil(lines.length / pageSize) },
        (_, index) => lines.slice(index * pageSize, (index + 1) * pageSize),
      );
  const pageIds = chunks.map((_, index) => 4 + index * 2);
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${chunks.length} >>`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
  ];
  chunks.forEach((chunk, index) => {
    const pageId = pageIds[index]!;
    const contentId = pageId + 1;
    const visible = [title, `Pagina ${index + 1} de ${chunks.length}`, ...chunk];
    const content = [
      "BT",
      "/F1 9 Tf",
      "36 806 Td",
      "11 TL",
      ...visible.flatMap((line) => [`(${text(line)}) Tj`, "T*"]),
      "ET",
    ].join("\n");
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentId} 0 R >>`,
      `<< /Length ${Buffer.byteLength(content, "latin1")} >>\nstream\n${content}\nendstream`,
    );
  });
  let body = "%PDF-1.4\n";
  const offsets = [0];
  for (let index = 0; index < objects.length; index += 1) {
    offsets.push(Buffer.byteLength(body, "latin1"));
    body += `${index + 1} 0 obj\n${objects[index]}\nendobj\n`;
  }
  const xref = Buffer.byteLength(body, "latin1");
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  body += offsets.slice(1)
    .map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`)
    .join("");
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(body, "latin1");
}

type ReadablePdfColumn = { key: string; label: string; kind: string };
type ReadablePdfTable = {
  id: string;
  title: string;
  columns: ReadablePdfColumn[];
  rows: Record<string, unknown>[];
  totals: Record<string, unknown>;
};
type ReadablePdfChart = {
  title: string;
  categoryKey: string;
  series: Array<{ key: string; label: string; kind?: string }>;
  rows: Record<string, unknown>[];
};

export type ReadableReportPdf = {
  section: unknown;
  generatedAt: unknown;
  range: unknown;
  activeFilters: unknown;
  kpis?: Array<{ label: string; value: string | number | null; kind: string }>;
  tables: ReadablePdfTable[];
  charts?: ReadablePdfChart[];
  warnings?: string[];
  alerts?: Array<{
    sesionId: number;
    tipo: string;
    mensaje: string;
    importe: string;
    href?: string;
  }>;
  catalogs?: ReportPresentationCatalogs;
};

const REPORT_FONT = "DejaVuSans";
const REPORT_MODULE_DIR = dirname(fileURLToPath(import.meta.url));
const REPORT_FONT_CANDIDATES = [
  resolve(REPORT_MODULE_DIR, "../../assets/fonts/DejaVuSans.ttf"),
  resolve(REPORT_MODULE_DIR, "../assets/fonts/DejaVuSans.ttf"),
  resolve(REPORT_MODULE_DIR, "assets/fonts/DejaVuSans.ttf"),
  resolve(process.cwd(), "assets/fonts/DejaVuSans.ttf"),
  resolve(process.cwd(), "artifacts/api-server/assets/fonts/DejaVuSans.ttf"),
];

function valueKind(kind: string): "money" | "quantity" | "percentage" | "count" | "days" | "text" {
  return ["money", "quantity", "percentage", "count", "days"].includes(kind)
    ? kind as "money" | "quantity" | "percentage" | "count" | "days"
    : "text";
}

function reportFontPath(): string {
  const path = REPORT_FONT_CANDIDATES.find((candidate) => existsSync(candidate));
  if (!path) {
    throw new Error("No se encontró la fuente Unicode embebible de Reportes (DejaVuSans.ttf).");
  }
  return path;
}

function chartAsTable(chart: ReadablePdfChart): ReadablePdfTable {
  return {
    id: `chart-${chart.title}`,
    title: chart.title,
    columns: [
      { key: chart.categoryKey, label: labelForReportKey(chart.categoryKey), kind: "text" },
      ...chart.series.map((series) => ({
        key: series.key,
        label: series.label,
        kind: series.kind ?? "text",
      })),
    ],
    rows: chart.rows,
    totals: {},
  };
}

function pdfColumnLabel(label: string): string {
  return label === "Part. %" ? "Participación" : label;
}

/**
 * Creates the report-only PDF. The legacy createTextPdf above intentionally
 * remains unchanged for tickets, labels, and other unrelated documents.
 */
export async function createReadableReportPdf(report: ReadableReportPdf): Promise<Buffer> {
  const fontPath = reportFontPath();
  const document = new PDFDocument({
    size: "A4",
    layout: "landscape",
    margin: 0,
    font: fontPath,
    info: {
      Title: `Reporte ${String(report.section)}`,
      Author: "Mariana Textil",
      Subject: "Exportación de Reportes",
    },
  });
  document.registerFont(REPORT_FONT, fontPath);
  document.font(REPORT_FONT);

  const chunks: Buffer[] = [];
  const result = new Promise<Buffer>((resolveResult, rejectResult) => {
    document.on("data", (chunk: Buffer) => chunks.push(chunk));
    document.on("end", () => resolveResult(Buffer.concat(chunks)));
    document.on("error", rejectResult);
  });

  const pageLeft = 34;
  const pageRight = 34;
  const pageTop = 32;
  const pageBottom = 34;
  const contentWidth = document.page.width - pageLeft - pageRight;
  const contentBottom = document.page.height - pageBottom;
  let cursorY = pageTop;
  let pageNumber = 0;

  const pageHeader = () => {
    pageNumber += 1;
    cursorY = pageTop;
    document.font(REPORT_FONT).fontSize(8).fillColor("#53606d");
    document.text(
      `Reporte ${String(report.section)} · Página ${pageNumber} →`,
      pageLeft,
      cursorY,
      { width: contentWidth, align: "right", lineBreak: false },
    );
    cursorY += 12;
    document.moveTo(pageLeft, cursorY).lineTo(document.page.width - pageRight, cursorY)
      .strokeColor("#d8dee4").lineWidth(0.6).stroke();
    cursorY += 12;
  };
  const addPage = () => {
    document.addPage();
    pageHeader();
  };
  const ensureSpace = (height: number) => {
    if (cursorY + height > contentBottom) addPage();
  };
  const sectionHeading = (text: string, followingHeight = 28) => {
    // Keep a section heading with the first visible content that follows it.
    ensureSpace(18 + followingHeight);
    document.font(REPORT_FONT).fontSize(12).fillColor("#17365d").text(text, pageLeft, cursorY, {
      width: contentWidth,
      lineBreak: false,
    });
    cursorY += 18;
  };
  const metadata = (label: string, value: string) => {
    const valueWidth = contentWidth - 100;
    const height = Math.max(
      17,
      document.font(REPORT_FONT).fontSize(9).heightOfString(value, { width: valueWidth }),
    );
    ensureSpace(height + 2);
    document.font(REPORT_FONT).fontSize(9).fillColor("#27313a");
    document.text(label, pageLeft, cursorY, { width: 96, lineBreak: false });
    document.font(REPORT_FONT).text(value, pageLeft + 100, cursorY, { width: valueWidth });
    cursorY += height + 2;
  };

  pageHeader();
  document.font(REPORT_FONT).fontSize(18).fillColor("#17365d").text(
    `Reporte ${String(report.section)}`,
    pageLeft,
    cursorY,
    { width: contentWidth, lineBreak: false },
  );
  cursorY += 25;
  metadata("Periodo", formatReportRange(report.range));
  metadata("Generado", formatReportDate(report.generatedAt, true));
  const filters = formatReportFilters(report.activeFilters, report.catalogs);
  if (filters.length) {
    metadata("Filtros", filters.join(" · "));
  } else {
    metadata("Filtros", "Sin filtros adicionales");
  }
  metadata("Modalidad", filters.find((filter) => filter.startsWith("Modalidad:"))?.replace("Modalidad: ", "") ?? "Todas las modalidades");

  const kpis = report.kpis ?? [];
  if (kpis.length) {
    sectionHeading("Indicadores", 28 + 21);
    const kpiColumns: ReadablePdfColumn[] = [
      { key: "label", label: "Indicador", kind: "text" },
      { key: "value", label: "Valor", kind: "text" },
    ];
    const kpiTable: ReadablePdfTable = {
      id: "kpis",
      title: "",
      columns: kpiColumns,
      rows: kpis.map((item) => ({
        label: item.label,
        value: formatReportValue(item.value, valueKind(item.kind)),
      })),
      totals: {},
    };
    renderPdfTable(document, kpiTable, {
      getCursor: () => cursorY,
      setCursor: (value) => { cursorY = value; },
      addPage,
      ensureSpace,
      contentWidth,
      pageLeft,
      contentBottom,
    });
  }

  if (report.warnings?.length) {
    sectionHeading("Avisos", 21);
    for (const warning of report.warnings) metadata("Aviso", warning);
  }
  if (report.alerts?.length) {
    sectionHeading("Alertas", 28 + 21);
    const alertTable: ReadablePdfTable = {
      id: "alerts",
      title: "",
      columns: [
        { key: "sesionId", label: "Sesión", kind: "count" },
        { key: "tipo", label: "Tipo", kind: "text" },
        { key: "mensaje", label: "Mensaje", kind: "text" },
        { key: "importe", label: "Importe", kind: "money" },
      ],
      rows: report.alerts.map((alert) => ({ ...alert })),
      totals: {},
    };
    renderPdfTable(document, alertTable, {
      getCursor: () => cursorY,
      setCursor: (value) => { cursorY = value; },
      addPage,
      ensureSpace,
      contentWidth,
      pageLeft,
      contentBottom,
    });
  }

  const tables = [
    ...report.tables,
    ...(report.charts ?? []).map(chartAsTable),
  ];
  for (const table of tables) {
    renderPdfTable(document, table, {
      getCursor: () => cursorY,
      setCursor: (value) => { cursorY = value; },
      addPage,
      ensureSpace,
      contentWidth,
      pageLeft,
      contentBottom,
    });
  }
  document.end();
  return result;
}

type PdfTableContext = {
  getCursor: () => number;
  setCursor: (value: number) => void;
  addPage: () => void;
  ensureSpace: (height: number) => void;
  contentWidth: number;
  pageLeft: number;
  contentBottom: number;
};

function tablePanels(columns: ReadablePdfColumn[]): ReadablePdfColumn[][] {
  if (columns.length <= 9) return [columns];
  // Wide tables remain readable in landscape by using panels of at most nine
  // columns. The first text column is repeated so every panel can be
  // understood independently. X04's twelve columns therefore remain two
  // panels, while Qué comprar's much wider evidence matrix gets more panels
  // instead of collapsing headers into one-character lines.
  const panels: ReadablePdfColumn[][] = [columns.slice(0, 6)];
  for (let start = 6; start < columns.length; start += 8) {
    panels.push([columns[0]!, ...columns.slice(start, start + 8)]);
  }
  return panels;
}

function columnWidths(columns: ReadablePdfColumn[], width: number): number[] {
  const weights = columns.map((column, index) => {
    if (index === 0) return 1.35;
    return ["money", "quantity", "percentage", "count", "days"].includes(column.kind) ? 0.82 : 1.28;
  });
  const total = weights.reduce((sum, value) => sum + value, 0);
  return weights.map((weight) => width * weight / total);
}

function wrapPdfCellLines(
  document: PDFKit.PDFDocument,
  value: string,
  width: number,
  fontSize: number,
): string[] {
  document.font(REPORT_FONT).fontSize(fontSize);
  const lines: string[] = [];
  for (const paragraph of value.split("\n")) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      lines.push("");
      continue;
    }
    let line = "";
    for (const word of words) {
      let remaining = word;
      while (remaining.length > 0) {
        const candidate = line ? `${line} ${remaining}` : remaining;
        if (document.widthOfString(candidate) <= width) {
          line = candidate;
          remaining = "";
          continue;
        }
        if (line) {
          lines.push(line);
          line = "";
          continue;
        }
        let cut = 1;
        while (cut < remaining.length && document.widthOfString(remaining.slice(0, cut + 1)) <= width) {
          cut += 1;
        }
        lines.push(remaining.slice(0, cut));
        remaining = remaining.slice(cut);
      }
    }
    if (line) lines.push(line);
  }
  return lines.length ? lines : [""];
}

function renderPdfTable(document: PDFKit.PDFDocument, table: ReadablePdfTable, context: PdfTableContext): void {
  const panels = tablePanels(table.columns);
  for (let panelIndex = 0; panelIndex < panels.length; panelIndex += 1) {
    const columns = panels[panelIndex]!;
    const panelTitle = table.title
      ? panels.length === 1 ? table.title : `${table.title} · Parte ${panelIndex + 1} de ${panels.length}`
      : "";
    const widths = columnWidths(columns, context.contentWidth);
    const rowLayout = (row: Record<string, unknown>, total = false) => {
      const fontSize = total ? 8 : 7.8;
      const lineHeight = total ? 9.6 : 9.36;
      const values = columns.map((column) => formatReportValue(row[column.key], valueKind(column.kind)));
      const lines = values.map((value, index) => wrapPdfCellLines(
        document,
        value,
        widths[index]! - 8,
        fontSize,
      ));
      const lineCount = Math.max(1, ...lines.map((value) => value.length));
      return { values, lines, lineHeight, lineCount, rowHeight: lineCount * lineHeight + 8 };
    };
    const firstRow = table.rows[0] ? rowLayout(table.rows[0]) : null;
    const headerHeight = Math.max(
      28,
      ...columns.map((column, index) => document.font(REPORT_FONT).fontSize(7.8)
        .heightOfString(pdfColumnLabel(column.label), { width: widths[index]! - 8 }) + 12),
    );
    if (panelTitle) {
      // Reserve the title, header, and at least the first row segment
      // together; this prevents a dangling panel title at a page bottom.
      context.ensureSpace(17 + headerHeight + (firstRow ? Math.min(firstRow.rowHeight, 21) : 0) + 2);
      document.font(REPORT_FONT).fontSize(11).fillColor("#17365d").text(
        panelTitle,
        context.pageLeft,
        context.getCursor(),
        { width: context.contentWidth, lineBreak: false },
      );
      context.setCursor(context.getCursor() + 17);
    }
    const drawHeader = () => {
      context.ensureSpace(headerHeight + 2);
      let x = context.pageLeft;
      document.font(REPORT_FONT).fontSize(7.8).fillColor("#ffffff");
      columns.forEach((column, index) => {
        const width = widths[index]!;
        document.save().rect(x, context.getCursor(), width, headerHeight).fill("#1f4e78").restore();
        document.font(REPORT_FONT).fontSize(7.8).fillColor("#ffffff").text(
          pdfColumnLabel(column.label),
          x + 4,
          context.getCursor() + 6,
          { width: width - 8, height: headerHeight - 8, align: "left" },
        );
        x += width;
      });
      context.setCursor(context.getCursor() + headerHeight);
    };
    const drawRow = (row: Record<string, unknown>, fill: string, total = false) => {
      const layout = rowLayout(row, total);
      const pageCapacity = Math.max(1, Math.floor((context.contentBottom - 44) / layout.lineHeight));
      // A normal row is moved once rather than split into a stranded line at
      // the bottom. Truly oversized rows start on a fresh page and then
      // continue in segments with a repeated header and identifier.
      if (
        context.getCursor() > 44 &&
        layout.lineCount <= pageCapacity &&
        context.getCursor() + layout.rowHeight > context.contentBottom
      ) {
        context.addPage();
        drawHeader();
      }
      if (layout.lineCount > pageCapacity && context.getCursor() > 44) {
        context.addPage();
        drawHeader();
      }
      let lineOffset = 0;
      while (lineOffset < layout.lineCount) {
        const availableLines = Math.floor((context.contentBottom - context.getCursor() - 8) / layout.lineHeight);
        if (availableLines < 1) {
          context.addPage();
          drawHeader();
          continue;
        }
        const segmentLines = Math.min(layout.lineCount - lineOffset, availableLines);
        const rowHeight = segmentLines * layout.lineHeight + 8;
        let x = context.pageLeft;
        layout.values.forEach((value, index) => {
          const width = widths[index]!;
          const cellLines = index === 0 && lineOffset > 0
            ? [layout.lines[index]![0] ?? value]
            : layout.lines[index]!.slice(lineOffset, lineOffset + segmentLines);
          document.save().rect(x, context.getCursor(), width, rowHeight).fillAndStroke(
          fill,
          "#d8dee4",
        ).restore();
          document.font(REPORT_FONT).fontSize(total ? 8 : 7.8).fillColor("#27313a");
          cellLines.forEach((line, lineIndex) => {
            // `wrapPdfCellLines` already split every line against the exact
            // cell width. Passing the joined value back to PDFKit lets it
            // wrap long URL/ISO tokens a second time and clips the tail when
            // the bounded text box is shorter than that reflow. Draw each
            // prepared line independently so the PDF contains every token.
            document.text(
              line,
              x + 4,
              context.getCursor() + 4 + lineIndex * layout.lineHeight,
              {
                width: width - 8,
                height: layout.lineHeight,
                align: columns[index]!.kind === "text" ? "left" : "right",
                lineBreak: false,
              },
            );
          });
          x += width;
        });
        context.setCursor(context.getCursor() + rowHeight);
        lineOffset += segmentLines;
        if (lineOffset < layout.lineCount) {
          context.addPage();
          drawHeader();
        }
      }
    };
    drawHeader();
    for (const row of table.rows) drawRow(row, "#ffffff");
    if (hasMeaningfulTotals(table.totals)) {
      const totalRow: Record<string, unknown> = { ...table.totals };
      const label = reportTotalLabel(table.columns, table.totals);
      if (label && totalRow[label.key] == null) totalRow[label.key] = label.value;
      drawRow(totalRow, "#e2f0d9", true);
    }
    context.setCursor(context.getCursor() + 12);
  }
}