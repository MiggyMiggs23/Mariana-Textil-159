import assert from "node:assert/strict";
import test from "node:test";
import ExcelJS from "exceljs";
import { createTextPdf } from "./pdf";
import {
  createDestinationAccountsPdf,
  createDestinationAccountsWorkbook,
  type DestinationAccountsExportData,
} from "./cuentas-destino-export";

const fixture: DestinationAccountsExportData = {
  encabezado: {
    vendido: { contado: "100.11", credito: "25.17", total: "125.28" },
    cobrado: { contado: "100.11", abonos: "40.23", saldosFavor: "-5.05", total: "135.29" },
  },
  resumen: [
    { cuentaDestino: "CAJA_FISICA", formaPago: "EFECTIVO", importe: "80.08", operaciones: 3 },
    { cuentaDestino: "CUENTA_FISCAL", formaPago: "TRANSFERENCIA", importe: "55.21", operaciones: 2 },
  ],
};

function legacyBaselineWorkbook(data: DestinationAccountsExportData): ExcelJS.Workbook {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Cuentas destino");
  sheet.columns = [
    { header: "Cuenta destino", key: "cuentaDestino" },
    { header: "Forma de pago", key: "formaPago" },
    { header: "Importe", key: "importe" },
    { header: "Operaciones", key: "operaciones" },
  ];
  sheet.addRows(data.resumen);
  return workbook;
}

function legacyBaselinePdf(data: DestinationAccountsExportData): Buffer {
  return createTextPdf("Cuentas destino", data.resumen.map((row) =>
    `${row.cuentaDestino} | ${row.formaPago} | ${row.importe} | ${row.operaciones} operaciones`
  ));
}

async function assertExportContract(
  workbook: ExcelJS.Workbook,
  pdf: Buffer,
  original: DestinationAccountsExportData,
): Promise<void> {
  const bytes = await workbook.xlsx.writeBuffer();
  const reopened = new ExcelJS.Workbook();
  await reopened.xlsx.load(bytes);
  const figures = reopened.getWorksheet("Ventas y cobranza");
  assert.ok(figures, "el XLSX debe incluir la hoja visible Ventas y cobranza");
  assert.deepEqual(
    figures.getColumn(2).values.slice(2),
    [
      "Ventas totales",
      "Contado cobrado",
      "Ventas a crédito",
      "Cobranza del periodo",
      "Contado cobrado",
      "Abonos a notas (neto de reversos)",
      "Saldo a favor (neto de reversos)",
    ],
  );
  assert.deepEqual(
    figures.getColumn(3).values.slice(2),
    [125.28, 100.11, 25.17, 135.29, 100.11, 40.23, -5.05],
  );
  assert.equal(Number(figures.getCell("C2").value), Number(figures.getCell("C3").value) + Number(figures.getCell("C4").value));

  const destinations = reopened.getWorksheet("Cuentas destino");
  assert.ok(destinations, "se debe conservar la hoja existente Cuentas destino");
  const destinationHeaders = destinations.getRow(1).values;
  assert.ok(Array.isArray(destinationHeaders));
  assert.deepEqual(destinationHeaders.slice(1), [
    "Cuenta destino", "Forma de pago", "Importe", "Operaciones",
  ]);
  assert.deepEqual(destinations.getColumn(3).values.slice(2), [80.08, 55.21]);
  assert.deepEqual(destinations.getColumn(4).values.slice(2), [3, 2]);

  const pdfText = pdf.toString("latin1");
  assert.ok(pdfText.startsWith("%PDF-1.4"));
  assert.ok(pdfText.endsWith("%%EOF"));
  assert.match(pdfText, /Ventas \| Ventas totales \| \$125\.28/);
  assert.match(pdfText, /Ventas \| Contado cobrado \| \$100\.11/);
  assert.match(pdfText, /Ventas \| Ventas a crédito \| \$25\.17/);
  assert.match(pdfText, /Cobranza \| Cobranza del periodo \| \$135\.29/);
  assert.match(pdfText, /Cobranza \| Contado cobrado \| \$100\.11/);
  assert.match(pdfText, /Cobranza \| Abonos a notas \\\(neto de reversos\\\) \| \$40\.23/);
  assert.match(pdfText, /Cobranza \| Saldo a favor \\\(neto de reversos\\\) \| -\$5\.05/);
  assert.match(pdfText, /Efectivo \| EFECTIVO \| \$80\.08 \| 3 operaciones/);
  assert.deepEqual(original, fixture, "los exportadores no deben mutar cifras ni claves fuente");
}

test("XLSX y PDF reales distinguen ventas, contado cobrado y cobranza sin recalcular", async () => {
  const input = structuredClone(fixture);
  const baseline = process.env.E6_EXPORT_BASELINE === "1";
  await assertExportContract(
    baseline ? legacyBaselineWorkbook(input) : createDestinationAccountsWorkbook(input),
    baseline ? legacyBaselinePdf(input) : createDestinationAccountsPdf(input),
    input,
  );
});