// Finite synthetic transport only; all pages/hooks/permission policies stay real.
import type * as api from "@workspace/api-client-react";
import * as base from "./e11-node-test-transport";
import * as f from "../../../../reports/e7/frontend-fixtures";
export * from "./e11-node-test-transport";
export { f };
export let E7_ENABLED = true;
export let E7_UI_ENABLED = true;
export const E5_ENABLED = false;
export const e7On = () => E7_ENABLED && E7_UI_ENABLED;
export const e7ClientFinancialOn = () => E7_ENABLED && E7_UI_ENABLED;
export function e7Gates(on: boolean) { E7_ENABLED = E7_UI_ENABLED = on; }
const cell = { importe: "0.00", cuentaDestino: null, formasPago: [] };
export const legacyAccounts: api.AdminCuentasDestino = {
  resumen: [], tendencia: [], porTienda: [],
  encabezado: {
    vendido: { contado: "850.00", credito: "150.00", total: "1000.00", totalAnterior: null, variacionPorcentaje: null },
    porCobrar: { periodo: "150.00", periodoAnterior: null, variacionPorcentaje: null },
    cobrado: { contado: "850.00", abonos: "25.00", saldosFavor: "0.00", total: "875.00", totalAnterior: null, variacionPorcentaje: null },
    previousDesde: null, previousHasta: null,
  },
  cobrosAnteriores: [],
  matriz: { filas: [true, false, null].map(facturado => ({ facturado, efectivo: cell, transferencia: cell, porCobrar: cell, otras: cell, total: "0.00" })), cierra: true },
  ivaFacturado: { base: "0.00", iva: "0.00" }, incongruencias: { conteo: 0, importe: "0.00" },
  facturacion: { facturadoTotal: "0.00", noFacturadoTotal: "0.00", facturadoEfectivo: "0.00", facturadoTransferencia: "0.00", noFacturadoEfectivo: "0.00", noFacturadoTransferencia: "0.00" },
  ivaCobrado: "0.00", totalCobrado: "875.00",
};
export const pending: api.AdminPendingSummary = { tickets: 2, ticketsSinCobrar: 1, notasSinAutorizar: 1, importe: "150.00", tiendas: [] };
export const dashboard: api.AdminRealtimeDashboard = {
  generatedAt: f.generatedAt, fullRefreshSeconds: 300, pendingRefreshSeconds: 30,
  totales: { ventas: "1000.00", cobrado: "850.00", pendiente: "150.00", subtotal: "862.07", iva: "137.93", costo: "500.00",
    margen: "350.00", margenPorcentaje: "35.00", tickets: 10, ticketsCobrados: 8, documentosPendientes: 2, cancelaciones: 2, lineasExcluidasMargen: 0 },
  cantidades: [], ventasCredito: { importe: "150.00", operaciones: 2 },
  cancelaciones: { tickets: 2, importe: "50.00", tasaCancelacion: "20.00", excedeUmbral: true },
  salidasEnTransito: { conteo: 2, importe: "75.00" }, salidasCanceladas: { conteo: 1, importe: "30.00" },
  pendientes: pending, tiendas: [], comparativo: [], ultimosTickets: [],
};
export const legacyClient: api.Cliente = {
  id: 21, nombre: "Cliente sintético E7", activo: true, esSistema: false, recibeNotaSinPrecios: false,
  diasCredito: 0, createdAt: f.generatedAt, updatedAt: f.generatedAt,
};
export const legacyStatement: api.ClienteEstadoCuenta = {
  clienteId: 21, saldoActual: "777.00", saldoAFavor: "0.00",
  movimientos: [{ movimientoId: 901, tipo: "VENTA_CREDITO", importe: "777.00", saldoCorrido: "777.00",
    saldoDeudorProyectado: "777.00", fecha: f.generatedAt, notas: "INTERACTIVO-LEGACY-GRUPO4" }],
};
export const legacyCreditEvidence: api.CreditEvidence = { clienteId: 21, atribucionHabilitada: false, movimientos: [] };
export const legacyDirectedHistory: api.SolicitudesPagoDirigidoResult = { solicitudes: [] };
export const legacyDocuments: api.ClienteDocumento[] = [];
function unknownAdjacentQuery(path: string) {
  const message = `E7_UNCONFIGURED_TRANSPORT GET ${path}`;
  console.error(message);
  throw Error(message);
}
export const operational: api.AdminCuentaDestinoMovimientos = {
  cuentaDestino: "CAJA_FISICA", items: [], total: 0, page: 1, pageSize: 100,
  montoTotal: "0.00", montoTotalAnterior: "0.00", variacionPorcentaje: null,
  previousDesde: "2026-09-21", previousHasta: "2026-09-21",
};
export const fail = (path: string, message: string) =>
  base.routes.set(`GET ${path}`, () => { throw Object.assign(new Error(message), { status: 503 }); });
export function actorAtSite(site: number): api.CurrentUser {
  return { ...base.user("ADMIN"), alcanceConsulta: "PROPIA",
    ubicacion: { id: site, nombre: `Sitio sintético ${site}`, tipo: "TIENDA", iniciales: site === 1 ? "SA" : "SB", activa: true, esSistema: false } };
}
export function resetE7() {
  base.reset(null); base.gates(false); base.appSiblings(); e7Gates(true);
  base.respond("/api/e7/disponibilidad", f.available);
  base.routes.set("GET /api/e7/atribucion", ({ params }) =>
    structuredClone(params.get("ubicacionId") === "2" ? f.applicationSite : f.afterApplication));
  base.respond("/api/e7/clientes/21/exportacion", f.previewApplied);
  base.respond("/api/e7/clientes/22/exportacion", f.foreignPreview);
  // Deliberate export service errors exercise real generated dispatch/context.
  // No fake PDF/XLSX success blob; backend helper owns real binary evidence.
  fail("/api/e7/atribucion.pdf", "E7_EXPORT_SERVICE_UNAVAILABLE");
  fail("/api/e7/atribucion.xlsx", "E7_EXPORT_SERVICE_UNAVAILABLE");
  base.respond("/api/admin/cuentas-destino", legacyAccounts);
  base.respond("/api/admin/dashboard/realtime", dashboard);
  base.respond("/api/admin/dashboard/realtime/pendientes", pending);
  base.respond("/api/admin/cuentas-destino/CAJA_FISICA/movimientos", operational);
  base.respond("/api/clientes/21", legacyClient);
  base.respond("/api/clientes/21/estado-cuenta", legacyStatement);
  base.routes.set("GET /api/clientes/21/documentos", ({ params }) => {
    if (params.size !== 0) return unknownAdjacentQuery("/api/clientes/21/documentos");
    return structuredClone(legacyDocuments);
  });
  base.routes.set("GET /api/clientes/21/evidencia-credito", ({ params }) => {
    if (![...params.keys()].every(k => k === "prepararAtribucion")
      || !["true", "false"].includes(params.get("prepararAtribucion") ?? ""))
      return unknownAdjacentQuery("/api/clientes/21/evidencia-credito");
    return structuredClone(legacyCreditEvidence);
  });
  base.routes.set("GET /api/pagos-dirigidos", ({ params }) => {
    if (params.get("tipo") !== "CLIENTE" || params.get("entidadId") !== "21"
      || ![...params.keys()].every(k => k === "tipo" || k === "entidadId"))
      return unknownAdjacentQuery("/api/pagos-dirigidos");
    return structuredClone(legacyDirectedHistory);
  });
  // Explicit finite legacy failures remain visibly distinct from E7 success.
  for (const path of ["credito", "comportamiento-pago", "compras", "estadisticas", "analitica", "pagos", "precios"])
    fail(`/api/clientes/21/${path}`, `LEGACY_${path}_UNAVAILABLE`);
  fail("/api/clientes/cartera", "LEGACY_CARTERA_UNAVAILABLE");
}
export function installFiniteFetch() {
  const original = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    try { return new Response(JSON.stringify(await base.customFetch(url, init)), { headers: { "content-type": "application/json" } }); }
    catch (error) {
      if (!(error instanceof Error) || !("status" in error)) throw error;
      return new Response(JSON.stringify({ error: error.message }), { status: Number(error.status) });
    }
  };
  return () => { globalThis.fetch = original; };
}