// Synthetic test fixtures, never production data. Bound to MAIN-generated types.
import type {
  CarteraAlcance, E7Atribucion, E7ClienteExportacion, E7Movimiento,
  E7Retenido, GetE7Disponibilidad200, GetE7AtribucionParams,
  ExportE7AtribucionXlsxParams, ExportE7AtribucionPdfParams,
  GetE7ClienteExportacionParams,
} from "../../lib/api-client-react/src/generated/api.schemas";

export const hooks = [
  "useGetE7Disponibilidad", "useGetE7Atribucion", "useExportE7AtribucionXlsx",
  "useExportE7AtribucionPdf", "useGetE7ClienteExportacion",
] as const;
export const legends = [
  "El resumen global de crédito considera todos los sitios.",
  "El detalle corresponde solo a los sitios autorizados y no representa la deuda total del cliente.",
  "Las aplicaciones a notas no son nuevos ingresos.",
  "El dinero retenido pendiente de aplicación no es saldo a favor ni reduce la deuda.",
];
export const available = {
  enabled: true, clienteFinanzas: true, atribucion: true,
} satisfies GetE7Disponibilidad200;
export const unavailable = {
  enabled: false, clienteFinanzas: false, atribucion: false,
} satisfies GetE7Disponibilidad200;
export const range = { desde: "2026-09-22", hasta: "2026-09-24" } satisfies GetE7AtribucionParams;
export const xlsxQuery = { ...range, ubicacionId: "2" } satisfies ExportE7AtribucionXlsxParams;
export const pdfQuery = { ...range, ubicacionIds: "1,2" } satisfies ExportE7AtribucionPdfParams;
export const previewQuery = { ubicacionId: "2" } satisfies GetE7ClienteExportacionParams;
export const generatedAt = "2026-09-24T18:00:00.000Z";
export const globalScope: CarteraAlcance = {
  tipo: "GLOBAL", ubicaciones: [{ id: 1, nombre: "Sitio receptor sintético" }, { id: 2, nombre: "Sitio aplicación sintético" }],
  generadoEn: generatedAt, saldoAFavorDisponible: true,
};
export const siteScope: CarteraAlcance = {
  tipo: "SITIOS", ubicaciones: [{ id: 2, nombre: "Sitio aplicación sintético" }],
  generadoEn: generatedAt, saldoAFavorDisponible: true,
};
export const held: E7Retenido = {
  cobroId: "77777777-7777-4777-8777-777777777777", fechaRecepcion: "2026-09-22T18:00:00.000Z",
  ubicacionId: 1, importePendiente: "80.00", antiguedadDias: 2,
};
const cash: E7Movimiento = {
  id: "contado-sintetico", fecha: "2026-09-22T17:00:00.000Z", tipo: "VENTA_CONTADO",
  importe: "40.00", ubicacionId: 1, cuentaDestino: "EFECTIVO",
};
const received: E7Movimiento = {
  id: held.cobroId, fecha: held.fechaRecepcion, tipo: "RECEPCION",
  importe: "80.00", ubicacionId: null, cuentaDestino: "BANCO-SINTETICO",
};
const applied: E7Movimiento = {
  id: "88888888-8888-4888-8888-888888888888", fecha: "2026-09-23T18:00:00.000Z",
  tipo: "APLICACION", importe: "50.00", ubicacionId: 2, cuentaDestino: "BANCO-SINTETICO",
};
const bridge = (rows: E7Movimiento[]) => rows.map(({ tipo, cuentaDestino, ubicacionId, importe }) =>
  ({ tipo, cuentaDestino, ubicacionId, total: importe }));
export const beforeReceipt: E7Atribucion = {
  alcance: { ...globalScope, generadoEn: "2026-09-22T17:30:00.000Z" },
  generadoEn: "2026-09-22T17:30:00.000Z", leyendas: legends,
  cobranzaTotal: "40.00", recepcionesFisicas: "40.00", aplicacionesNotas: "0.00",
  movimientos: [cash], puente: bridge([cash]), retenidos: [], totalRetenido: "0.00",
};
export const afterReceipt: E7Atribucion = {
  ...beforeReceipt, cobranzaTotal: "120.00", recepcionesFisicas: "120.00",
  alcance: { ...globalScope, generadoEn: held.fechaRecepcion }, generadoEn: held.fechaRecepcion,
  movimientos: [cash, received], puente: bridge([cash, received]),
  retenidos: [{ ...held, antiguedadDias: 0 }], totalRetenido: "80.00",
};
export const afterApplication: E7Atribucion = {
  ...afterReceipt, alcance: globalScope, generadoEn: generatedAt,
  aplicacionesNotas: "50.00", movimientos: [cash, received, applied],
  puente: bridge([cash, received, applied]), retenidos: [{ ...held, importePendiente: "30.00" }], totalRetenido: "30.00",
};
export const applicationSite: E7Atribucion = {
  ...afterApplication, alcance: siteScope, cobranzaTotal: null, recepcionesFisicas: null,
  movimientos: [applied], puente: bridge([applied]), retenidos: [], totalRetenido: "0.00",
};
export const receiptSite: E7Atribucion = {
  ...applicationSite, alcance: { ...siteScope, ubicaciones: [globalScope.ubicaciones[0]] },
  aplicacionesNotas: "0.00", movimientos: [cash], puente: bridge([cash]),
  retenidos: [{ ...held, importePendiente: "30.00" }], totalRetenido: "30.00",
};
const historical: E7Movimiento = {
  id: "historico-sintetico-indeterminado", fecha: "2026-09-22T16:00:00.000Z",
  tipo: "REGISTRO_HISTORICO", importe: "25.00", ubicacionId: null, cuentaDestino: null,
};
const correction: E7Movimiento = { ...historical, id: "correccion-sintetica", tipo: "CORRECCION", importe: "-5.00" };
const returned: E7Movimiento = { ...received, id: "devolucion-sintetica", tipo: "DEVOLUCION", importe: "-10.00" };
const reversed: E7Movimiento = { ...applied, id: "reverso-aplicacion-sintetico", tipo: "REVERSO_APLICACION", importe: "-20.00" };
export const mixedProvenance: E7Atribucion = {
  ...afterApplication, cobranzaTotal: "130.00", aplicacionesNotas: "30.00",
  movimientos: [...afterApplication.movimientos, historical, correction, returned, reversed],
  puente: bridge([...afterApplication.movimientos, historical, correction, returned, reversed]),
  retenidos: [{ ...held, importePendiente: "40.00" }], totalRetenido: "40.00",
};
export const previewBefore: E7ClienteExportacion = {
  clienteId: 21, alcance: { ...siteScope, generadoEn: beforeReceipt.generadoEn },
  generadoEn: beforeReceipt.generadoEn, leyendas: legends,
  resumenGlobal: { deudaActual: "200.00", saldoAFavor: "0.00", limiteCredito: "500.00", creditoDisponible: "300.00" },
  movimientos: [{ id: "nota-autorizada-sintetica", fecha: "2026-09-21T18:00:00.000Z", tipo: "VENTA_CREDITO",
    importe: "100.00", ubicacionId: 2, cuentaDestino: null, folio: "NOTA-AUTORIZADA", saldoPendiente: "100.00" }],
  retenidos: [], totalRetenido: "0.00",
};
export const previewReceived: E7ClienteExportacion = {
  ...previewBefore, alcance: afterReceipt.alcance, generadoEn: afterReceipt.generadoEn,
  movimientos: [...previewBefore.movimientos,
    { ...previewBefore.movimientos[0], id: "nota-otro-sitio-sintetica", ubicacionId: 1, folio: "NOTA-OTRO-SITIO" },
    { ...received, tipo: "RECEPCION_RETENIDA", folio: null, saldoPendiente: null }],
  retenidos: [{ ...held, antiguedadDias: 0 }], totalRetenido: "80.00",
};
export const previewApplied: E7ClienteExportacion = {
  ...previewBefore, alcance: siteScope, generadoEn: generatedAt,
  resumenGlobal: { ...previewBefore.resumenGlobal, deudaActual: "150.00", creditoDisponible: "350.00" },
  movimientos: [{ ...previewBefore.movimientos[0], saldoPendiente: "50.00" },
    { ...applied, tipo: "APLICACION_SIN_DINERO", folio: null, saldoPendiente: null }],
};
export const agedStock: E7Atribucion = {
  ...afterApplication,
  retenidos: [{ ...held, fechaRecepcion: "2026-08-22T18:00:00.000Z", importePendiente: "30.00", antiguedadDias: 33 }],
};
export const foreignPreview: E7ClienteExportacion = { ...previewApplied, clienteId: 22 };
export const attributionFixtures = { beforeReceipt, afterReceipt, afterApplication, applicationSite, receiptSite, mixedProvenance, agedStock };
export const previewFixtures = { previewBefore, previewReceived, previewApplied, foreignPreview };