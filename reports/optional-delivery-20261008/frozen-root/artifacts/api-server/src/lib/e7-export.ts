import ExcelJS from "exceljs";
import { createLatin1TextPdf } from "./pdf";
import type { e7Reader } from "./e7-read-model";

export type E7Statement = Awaited<ReturnType<typeof e7Reader.statement>>;
const escape = (value: unknown) => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
function headings(data: E7Statement) {
  return [
    ...data.leyendas,
    `Alcance aplicado: ${data.alcance.tipo}; sitios autorizados: ${data.alcance.ubicaciones.map(s => `${s.id} - ${s.nombre}`).join(", ") || "Global"}`,
    `Generado en: ${data.generadoEn}`,
    `Deuda actual global: ${data.resumenGlobal.deudaActual}`,
    `Saldo a favor global: ${data.resumenGlobal.saldoAFavor}`,
    `Límite de crédito global: ${data.resumenGlobal.limiteCredito}`,
    `Crédito disponible global: ${data.resumenGlobal.creditoDisponible}`,
    `Retenido pendiente del alcance: ${data.totalRetenido} (separado de deuda y favor)`,
  ];
}
function lines(data: E7Statement) {
  return [
    ...headings(data),
    ...data.movimientos.map(m => `${m.fecha} | ${m.tipo} | importe ${m.importe} | sitio ${m.ubicacionId ?? "Sin sitio determinado"} | folio ${m.folio ?? "-"} | saldo pendiente de nota ${m.saldoPendiente ?? "-"}`),
    "Retenidos pendientes de aplicación del alcance",
    ...data.retenidos.map(r => `${r.fechaRecepcion} | sitio ${r.ubicacionId} | ${r.cobroId} | pendiente ${r.importePendiente} | antigüedad ${r.antiguedadDias} días`),
  ];
}
export function e7StatementWorkbook(data: E7Statement) {
  const workbook = new ExcelJS.Workbook();
  const summary = workbook.addWorksheet("Alcance y resumen");
  summary.getColumn(1).width = 120;
  for (const heading of headings(data)) summary.addRow([heading]);
  const detail = workbook.addWorksheet("Detalle autorizado");
  detail.columns = [
    { header: "Fecha", key: "fecha", width: 28 }, { header: "Tipo", key: "tipo", width: 28 },
    { header: "Importe", key: "importe", width: 20 }, { header: "Sitio", key: "ubicacionId", width: 26 },
    { header: "Folio", key: "folio", width: 18 }, { header: "Saldo pendiente de nota", key: "saldoPendiente", width: 26 },
  ];
  for (const m of data.movimientos) detail.addRow({ ...m, ubicacionId: m.ubicacionId ?? "Sin sitio determinado" });
  const pending = workbook.addWorksheet("Retenido separado");
  pending.columns = [
    { header: "Recepción", key: "fechaRecepcion", width: 28 }, { header: "Cobro", key: "cobroId", width: 40 },
    { header: "Sitio", key: "ubicacionId", width: 16 }, { header: "Pendiente", key: "importePendiente", width: 20 },
    { header: "Antigüedad días", key: "antiguedadDias", width: 20 },
  ];
  pending.addRows(data.retenidos);
  // Monetary decimals remain exact text, never rounded by Excel's binary number limit.
  return workbook;
}
export const e7StatementPdf = (data: E7Statement) =>
  createLatin1TextPdf(`Estado de cuenta - cliente ${data.clienteId}`, lines(data));
export function e7StatementHtml(data: E7Statement) {
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Estado de cuenta</title>
    <style>body{font:14px Arial;margin:24px}p{overflow-wrap:anywhere}@media print{body{font-size:10px}}</style></head>
    <body><h1>Estado de cuenta - cliente ${data.clienteId}</h1>${lines(data).map(line => `<p>${escape(line)}</p>`).join("")}</body></html>`;
}
export type E7Attribution = Awaited<ReturnType<typeof e7Reader.attribution>>;
function attributionHeadings(data: E7Attribution) {
  return [
    ...data.leyendas,
    `Alcance: ${data.alcance.tipo}; sitios: ${data.alcance.ubicaciones.map(s => `${s.id} - ${s.nombre}`).join(", ") || "Global"}`,
    `Generado en: ${data.generadoEn}`,
    `Cobranza total con puente histórico: ${data.cobranzaTotal ?? "No es recepción atribuible por sitio"}`,
    `Recepción física atestada: ${data.recepcionesFisicas ?? "No se infiere por aplicación a notas"}`,
    `Aplicaciones netas a notas: ${data.aplicacionesNotas} (no segundo ingreso)`,
    `Retenido pendiente del alcance al generar: ${data.totalRetenido} (no favor ni deuda pagada)`,
  ];
}
export function e7AttributionWorkbook(data: E7Attribution) {
  const workbook = new ExcelJS.Workbook();
  const scope = workbook.addWorksheet("Alcance y puente");
  scope.getColumn(1).width = 120;
  for (const line of attributionHeadings(data)) scope.addRow([line]);
  const bridge = workbook.addWorksheet("Puente por fuente");
  bridge.addRow(["Fuente", "Cuenta", "Sitio", "Total"]);
  for (const row of data.puente) bridge.addRow([row.tipo, row.cuentaDestino ?? "Sin cuenta monetaria", row.ubicacionId ?? "Sin sitio determinado", row.total]);
  const detail = workbook.addWorksheet("Detalle autorizado");
  detail.addRow(["Identidad", "Fecha", "Fuente", "Cuenta", "Sitio", "Importe"]);
  for (const row of data.movimientos) detail.addRow([row.id, row.fecha, row.tipo, row.cuentaDestino ?? "Sin cuenta monetaria", row.ubicacionId ?? "Sin sitio determinado", row.importe]);
  const pending = workbook.addWorksheet("Retenido separado");
  pending.addRow(["Cobro", "Fecha recepción", "Sitio", "Pendiente", "Antigüedad días"]);
  for (const row of data.retenidos) pending.addRow([row.cobroId, row.fechaRecepcion, row.ubicacionId, row.importePendiente, row.antiguedadDias]);
  return workbook;
}
export function e7AttributionPdf(data: E7Attribution) {
  return createLatin1TextPdf("Atribución - Cuentas Destino / Tiempo real", [
    ...attributionHeadings(data),
    ...data.puente.map(r => `${r.tipo} | ${r.cuentaDestino ?? "Sin cuenta monetaria"} | sitio ${r.ubicacionId ?? "Sin sitio determinado"} | ${r.total}`),
    ...data.movimientos.map(r => `${r.fecha} | ${r.id} | ${r.tipo} | ${r.cuentaDestino ?? "Sin cuenta monetaria"} | sitio ${r.ubicacionId ?? "Sin sitio determinado"} | ${r.importe}`),
    "Retenido pendiente del alcance",
    ...data.retenidos.map(r => `${r.cobroId} | ${r.fechaRecepcion} | sitio ${r.ubicacionId} | ${r.importePendiente} | ${r.antiguedadDias} días`),
  ]);
}