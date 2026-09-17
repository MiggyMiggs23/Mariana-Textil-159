import ExcelJS from "exceljs";
import { EXCEL_NUMBER_FORMAT, formatNumber, toExcelNumber } from "@workspace/number-format";
import { createTextPdf } from "./pdf";
import type { CarteraReadModel } from "./clientes-cartera-read-model";

function requireGlobalFavor(row: { saldoAFavor: string | null }): string {
  if (row.saldoAFavor == null) {
    throw new Error("CREDIT_FAVOR_MISSING_GLOBAL");
  }
  return row.saldoAFavor;
}

export async function renderClientesCarteraXlsx(
  result: CarteraReadModel,
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const summary = workbook.addWorksheet("Resumen");
  summary.addRows([
    ["Alcance", result.alcance.tipo],
    ["Ubicaciones", result.alcance.ubicaciones.map((location) => `${location.id} - ${location.nombre}`).join(", ") || "Global"],
    ["Generado en", result.alcance.generadoEn],
    ["Total clientes", result.resumen.totalClientes],
    ["Clientes con saldo", result.resumen.clientesConSaldo],
    ["Total cartera", toExcelNumber(result.resumen.totalCartera)],
    ["Total vencido", toExcelNumber(result.resumen.totalVencido)],
    ...(result.alcance.saldoAFavorDisponible
      ? []
      : [["Saldo a favor", "No atribuible por sitio"]]),
  ]);
  summary.getColumn(1).width = 24;
  summary.getColumn(2).width = 50;
  summary.getCell("B6").numFmt = EXCEL_NUMBER_FORMAT.money;
  summary.getCell("B7").numFmt = EXCEL_NUMBER_FORMAT.money;

  const sheet = workbook.addWorksheet("Cartera");
  sheet.columns = [
    { header: "Cliente", key: "nombre", width: 30 },
    { header: "Saldo", key: "saldo", width: 15 },
    { header: "Saldo a favor", key: "saldoAFavor", width: 15 },
    { header: "Vencido", key: "vencido", width: 15 },
    { header: "Primer vencimiento", key: "primerVencimiento", width: 22 },
    { header: "Sin plazo definido", key: "sinPlazo", width: 18 },
  ];
  sheet.getColumn("saldo").numFmt = EXCEL_NUMBER_FORMAT.money;
  sheet.getColumn("vencido").numFmt = EXCEL_NUMBER_FORMAT.money;
  sheet.getColumn("sinPlazo").numFmt = EXCEL_NUMBER_FORMAT.money;
  sheet.addRows(result.clientes.map((row) => ({
    ...row,
    saldo: toExcelNumber(row.saldo),
    saldoAFavor: result.alcance.saldoAFavorDisponible
      ? toExcelNumber(requireGlobalFavor(row))
      : "No atribuible por sitio",
    vencido: toExcelNumber(row.vencido),
    sinPlazo: toExcelNumber(row.sinPlazo),
  })));
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

export function renderClientesCarteraPdf(result: CarteraReadModel): Buffer {
  const favorLabel = result.alcance.saldoAFavorDisponible
    ? (row: { saldoAFavor: string | null }) =>
        formatNumber(requireGlobalFavor(row), { kind: "money" })
    : () => "No atribuible por sitio";
  return createTextPdf(
    "Cartera de clientes",
    [
      `Alcance: ${result.alcance.tipo} | ubicaciones: ${result.alcance.ubicaciones.map((location) => location.nombre).join(", ") || "Global"} | generado: ${result.alcance.generadoEn}`,
      `Resumen: ${result.resumen.totalClientes} clientes | ${result.resumen.clientesConSaldo} con saldo | cartera ${formatNumber(result.resumen.totalCartera, { kind: "money" })} | vencido ${formatNumber(result.resumen.totalVencido, { kind: "money" })}`,
      ...(result.alcance.saldoAFavorDisponible ? [] : ["Saldo a favor: No atribuible por sitio"]),
      ...result.clientes.map(
        (row) =>
          `${row.nombre} | saldo ${formatNumber(row.saldo, { kind: "money" })} | saldo a favor ${favorLabel(row)} | vencido ${formatNumber(row.vencido, { kind: "money" })} | sin plazo definido ${formatNumber(row.sinPlazo, { kind: "money" })}`,
      ),
    ],
  );
}