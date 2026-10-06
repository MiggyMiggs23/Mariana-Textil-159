/**
 * Catalog import utility for Mariana Textil.
 * Parses XLSX (via ExcelJS) and CSV files, returns preview rows.
 */

import ExcelJS from "exceljs";
import {
  generateBaseSku,
} from "@workspace/db/sku";

export type ImportRow = {
  rowIndex: number;
  tela: string;
  color: string;
  unidad: string;
  precioSugerido: string | null;
  notas: string | null;
  sku?: string;
};

export type PreviewRow = {
  rowIndex: number;
  tela: string;
  color: string;
  unidad: string;
  precioSugerido: string | null;
  notas: string | null;
  sku: string;
  estado: "NUEVO" | "DUPLICADO" | "ERROR";
  error?: string;
};

const REQUIRED_HEADERS = ["tela", "color", "unidad"];

function normalizeHeader(h: string): string {
  return h
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
}

/**
 * Parse a CSV string with basic support for quoted fields.
 */
export function parseCsv(content: string): string[][] {
  const rows: string[][] = [];
  const lines = content.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  for (const line of lines) {
    if (!line.trim()) continue;
    const fields: string[] = [];
    let field = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"') {
          if (line[i + 1] === '"') {
            field += '"';
            i++;
          } else {
            inQuotes = false;
          }
        } else {
          field += ch;
        }
      } else {
        if (ch === '"') {
          inQuotes = true;
        } else if (ch === ",") {
          fields.push(field);
          field = "";
        } else {
          field += ch;
        }
      }
    }
    fields.push(field);
    rows.push(fields);
  }
  return rows;
}

export type ParsedSheet = {
  headers: string[];
  rows: string[][];
  error?: string;
};

/**
 * Extract rows from a base64-encoded XLSX or CSV file.
 * For XLSX: ignores the "Notas" sheet, uses first sheet named "Productos" or the first sheet.
 * Returns normalized headers and raw string rows.
 */
export async function parseFileBase64(
  fileName: string,
  base64Content: string,
): Promise<ParsedSheet> {
  const ext = fileName.toLowerCase().split(".").pop();
  const buffer = Buffer.from(base64Content, "base64");

  if (ext === "csv") {
    const text = buffer.toString("utf-8");
    const rows = parseCsv(text);
    if (rows.length === 0) {
      return { headers: [], rows: [], error: "El archivo CSV está vacío." };
    }
    const headers = (rows[0] ?? []).map(normalizeHeader);
    return { headers, rows: rows.slice(1) };
  }

  if (ext === "xlsx" || ext === "xls") {
    const workbook = new ExcelJS.Workbook();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await workbook.xlsx.load(buffer as any);

    // Find "Productos" sheet; skip "Notas"
    let sheet =
      workbook.getWorksheet("Productos") ??
      workbook.worksheets.find(
        (ws) => ws.name.toLowerCase() !== "notas",
      );

    if (!sheet) {
      return { headers: [], rows: [], error: "No se encontró la hoja Productos." };
    }

    const allRows: string[][] = [];
    sheet.eachRow((row) => {
      const cells = row.values as (string | number | null | undefined)[];
      // ExcelJS row.values is 1-indexed (index 0 is undefined)
      const fields = cells.slice(1).map((c) =>
        c == null ? "" : String(c).trim(),
      );
      allRows.push(fields);
    });

    if (allRows.length === 0) {
      return { headers: [], rows: [], error: "La hoja está vacía." };
    }

    const headers = (allRows[0] ?? []).map(normalizeHeader);
    return { headers, rows: allRows.slice(1) };
  }

  return {
    headers: [],
    rows: [],
    error: "Formato no soportado. Use .xlsx o .csv",
  };
}

export type PreviewInput = {
  headers: string[];
  rows: string[][];
  existingVariants: Set<string>; // "tela|color" normalized
  existingSkus: Set<string>;
};

/**
 * Build preview rows from parsed sheet data.
 */
export function buildPreview(input: PreviewInput): PreviewRow[] {
  const { headers, rows, existingVariants, existingSkus } = input;

  const telaIdx = headers.indexOf("tela");
  const colorIdx = headers.indexOf("color");
  const unidadIdx = headers.indexOf("unidad");
  const precioIdx = headers.indexOf("precio_sugerido");
  const notasIdx = headers.indexOf("notas");

  if (telaIdx === -1 || colorIdx === -1 || unidadIdx === -1) {
    const missing = REQUIRED_HEADERS.filter((h) => !headers.includes(h));
    throw new Error(
      `Columnas requeridas faltantes: ${missing.join(", ")}. Encontradas: ${headers.join(", ")}`,
    );
  }

  // Track skus generated within this import batch for intra-batch collisions
  const batchSkus = new Set(existingSkus);
  // Track variants seen in this batch
  const batchVariants = new Set(existingVariants);

  const preview: PreviewRow[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    const rowIndex = i + 2; // 1-based + header row

    const telaRaw = (row[telaIdx] ?? "").trim();
    const colorRaw = (row[colorIdx] ?? "").trim();
    const unidadRaw = (row[unidadIdx] ?? "").trim().toUpperCase();
    const precioRaw = precioIdx >= 0 ? (row[precioIdx] ?? "").trim() : "";
    const notasRaw = notasIdx >= 0 ? (row[notasIdx] ?? "").trim() || null : null;

    // Skip blank rows
    if (!telaRaw && !colorRaw && !unidadRaw && !precioRaw) {
      continue;
    }

    // Validate
    const errors: string[] = [];
    if (!telaRaw) errors.push("tela vacía");
    if (!colorRaw) errors.push("color vacío");
    if (!unidadRaw) errors.push("unidad vacía");
    if (
      unidadRaw &&
      unidadRaw !== "METRO" &&
      unidadRaw !== "KILO" &&
      unidadRaw !== "BOLSA" &&
      unidadRaw !== "PIEZA"
    ) {
      errors.push(
        `unidad inválida: "${unidadRaw}" (use METRO, KILO, BOLSA o PIEZA)`,
      );
    }
    const precioNormalizado = precioRaw.replace(",", ".");
    const precioValido =
      !precioRaw || /^\d+(?:\.\d{1,2})?$/.test(precioNormalizado);
    const precio = precioRaw ? Number(precioNormalizado) : null;
    if (
      precioRaw &&
      (!precioValido || precio === null || !Number.isFinite(precio) || precio < 0)
    ) {
      errors.push(
        `precio inválido: "${precioRaw}" (use un número mayor o igual a 0 con máximo dos decimales)`,
      );
    }

    if (errors.length > 0) {
      preview.push({
        rowIndex,
        tela: telaRaw,
        color: colorRaw,
        unidad: unidadRaw,
        precioSugerido: precioRaw || null,
        notas: notasRaw,
        sku: "",
        estado: "ERROR",
        error: errors.join("; "),
      });
      continue;
    }

    // Preserve human-entered catalog text. These raw values were trimmed at
    // ingestion; casing is normalized only in the comparison key below.
    const telaNorm = telaRaw;
    const colorNorm = colorRaw;
    const variantKey = `${telaNorm.toUpperCase()}|${colorNorm.toUpperCase()}`;

    if (batchVariants.has(variantKey)) {
      preview.push({
        rowIndex,
        tela: telaNorm,
        color: colorNorm,
        unidad: unidadRaw,
        precioSugerido: precio === null ? null : precio.toFixed(2),
        notas: notasRaw,
        sku: "",
        estado: "DUPLICADO",
        error: `Variante ${telaNorm}/${colorNorm} ya existe`,
      });
      continue;
    }

    // Generate collision-safe SKU
    const baseSku = generateBaseSku(telaNorm, colorNorm);
    let sku = baseSku;
    if (batchSkus.has(sku)) {
      let counter = 2;
      while (batchSkus.has(`${baseSku}${counter}`)) counter++;
      sku = `${baseSku}${counter}`;
    }

    const isDuplicate = existingVariants.has(variantKey);

    batchVariants.add(variantKey);
    batchSkus.add(sku);

    preview.push({
      rowIndex,
      tela: telaNorm,
      color: colorNorm,
      unidad: unidadRaw,
      precioSugerido: precio === null ? null : precio.toFixed(2),
      notas: notasRaw,
      sku,
      estado: isDuplicate ? "DUPLICADO" : "NUEVO",
      ...(isDuplicate
        ? { error: `Variante ${telaNorm}/${colorNorm} ya existe en el catálogo` }
        : {}),
    });
  }

  return preview;
}
