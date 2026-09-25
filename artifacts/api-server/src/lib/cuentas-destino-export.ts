import ExcelJS from "exceljs";
import {
  EXCEL_NUMBER_FORMAT,
  formatAccountDestination,
  formatNumber,
  toExcelNumber,
} from "@workspace/number-format";
import { createLatin1TextPdf } from "./pdf";

export type DestinationAccountsExportData = {
  encabezado: {
    vendido: {
      contado: string;
      credito: string;
      total: string;
    };
    cobrado: {
      contado: string;
      abonos: string;
      saldosFavor: string;
      devolucionesComerciales?: string;
      total: string;
    };
  };
  resumen: Array<{
    cuentaDestino: string;
    formaPago: string;
    importe: string;
    operaciones: number;
  }>;
};

const visibleFigures = (data: DestinationAccountsExportData) => [
  { grupo: "Ventas", concepto: "Ventas totales", importe: data.encabezado.vendido.total },
  { grupo: "Ventas", concepto: "Contado cobrado", importe: data.encabezado.vendido.contado },
  { grupo: "Ventas", concepto: "Ventas a crédito", importe: data.encabezado.vendido.credito },
  { grupo: "Cobranza", concepto: "Cobranza del periodo", importe: data.encabezado.cobrado.total },
  { grupo: "Cobranza", concepto: "Contado cobrado", importe: data.encabezado.cobrado.contado },
  { grupo: "Cobranza", concepto: "Abonos a notas (neto de reversos)", importe: data.encabezado.cobrado.abonos },
  { grupo: "Cobranza", concepto: "Saldo a favor (neto de reversos)", importe: data.encabezado.cobrado.saldosFavor },
  ...(data.encabezado.cobrado.devolucionesComerciales === undefined ? [] : [
    { grupo: "Cobranza", concepto: "Efectivo devuelto por devoluciones comerciales (a restar)", importe: data.encabezado.cobrado.devolucionesComerciales },
  ]),
];

export function createDestinationAccountsWorkbook(
  data: DestinationAccountsExportData,
): ExcelJS.Workbook {
  const workbook = new ExcelJS.Workbook();
  const figures = workbook.addWorksheet("Ventas y cobranza");
  figures.columns = [
    { header: "Grupo", key: "grupo", width: 18 },
    { header: "Concepto", key: "concepto", width: 38 },
    { header: "Importe", key: "importe", width: 16 },
  ];
  figures.getColumn("importe").numFmt = EXCEL_NUMBER_FORMAT.money;
  figures.addRows(visibleFigures(data).map((row) => ({
    ...row,
    importe: toExcelNumber(row.importe),
  })));

  const destinations = workbook.addWorksheet("Cuentas destino");
  destinations.columns = [
    { header: "Cuenta destino", key: "cuentaDestino", width: 28 },
    { header: "Forma de pago", key: "formaPago", width: 20 },
    { header: "Importe", key: "importe", width: 16 },
    { header: "Operaciones", key: "operaciones", width: 14 },
  ];
  destinations.getColumn("importe").numFmt = EXCEL_NUMBER_FORMAT.money;
  destinations.getColumn("operaciones").numFmt = EXCEL_NUMBER_FORMAT.count;
  destinations.addRows(data.resumen.map((row) => ({
    ...row,
    cuentaDestino: formatAccountDestination(row.cuentaDestino),
    importe: toExcelNumber(row.importe),
    operaciones: toExcelNumber(row.operaciones),
  })));
  return workbook;
}

export function createDestinationAccountsPdf(data: DestinationAccountsExportData): Buffer {
  const money = (value: string) => formatNumber(value, { kind: "money" });
  return createLatin1TextPdf("Cuentas destino", [
    ...visibleFigures(data).map((row) => `${row.grupo} | ${row.concepto} | ${money(row.importe)}`),
    "",
    ...data.resumen.map((row) =>
      `${formatAccountDestination(row.cuentaDestino)} | ${row.formaPago} | ${money(row.importe)} | ${formatNumber(row.operaciones, { kind: "count" })} operaciones`
    ),
  ]);
}