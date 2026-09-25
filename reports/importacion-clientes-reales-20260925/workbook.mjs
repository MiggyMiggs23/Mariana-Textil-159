import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import ExcelJS from "../../node_modules/.pnpm/exceljs@4.4.0/node_modules/exceljs/excel.js";
export const source = new URL("../../attached_assets/ListaDeClientes_Final_1790371380694.xlsx", import.meta.url);
export const sha256 = data => createHash("sha256").update(data).digest("hex");
export async function readCustomers() {
  const bytes = await readFile(source);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(bytes);
  if (workbook.worksheets.length !== 1) throw new Error("Unexpected worksheet count");
  const sheet = workbook.worksheets[0];
  if (JSON.stringify(sheet.getRow(1).values.slice(1)) !== JSON.stringify(["Nombre", "RFC", "Dirección", "Teléfono"])) throw new Error("Unexpected headers");
  const records = [], corrections = [], names = new Map();
  sheet.eachRow((row, number) => {
    if (number === 1) return;
    const fields = [1, 2, 3, 4].map(column => {
      const cell = row.getCell(column);
      if (cell.value == null) return "";
      if (!["string", "number"].includes(typeof cell.value)) throw new Error(`Unsupported cell type at ${cell.address}`);
      if (typeof cell.value === "number" && !Number.isSafeInteger(cell.value)) throw new Error(`Unsafe numeric cell ${cell.address}`);
      return String(cell.value);
    });
    if (fields.every(value => !value.trim())) return;
    const [nombre, originalRFC, direccion_particular, telefono] = fields;
    if (!nombre.trim()) throw new Error(`Missing name at row ${number}`);
    const rfc = originalRFC.replace(/[\s-]/gu, "");
    if (rfc !== originalRFC) corrections.push({ row: number, original: originalRFC, corrected: rfc });
    const key = nombre.trim().toLowerCase();
    names.set(key, [...(names.get(key) ?? []), number]);
    records.push({ row: number, nombre, rfc: rfc || null, direccion_particular: direccion_particular || null, telefono: telefono || null });
  });
  const lengths = Object.fromEntries(["nombre", "rfc", "direccion_particular", "telefono"].map(field => [field, Math.max(...records.map(record => [...(record[field] ?? "")].length))]));
  return { records, summary: { fileSha256: sha256(bytes), payloadSha256: sha256(JSON.stringify(records)), total: records.length,
    withRFC: records.filter(r => r.rfc).length, withAddress: records.filter(r => r.direccion_particular).length,
    withPhone: records.filter(r => r.telefono).length, genericRFC: records.filter(r => r.rfc === "XAXX010101000").length,
    lengths, corrections, duplicateNameRows: [...names.values()].filter(rows => rows.length > 1) } };
}