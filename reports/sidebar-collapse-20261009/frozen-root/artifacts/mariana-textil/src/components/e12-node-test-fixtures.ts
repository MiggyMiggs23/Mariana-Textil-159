// Synthetic inputs exclusively for isolated mounted E12 tests.
// Validate with the generated endpoint schemas, then serialize as actual HTTP
// responses do (not Date objects or hand-written production DTOs).
import {
  GetCurrentUserResponse, GetOpcionesPagoEfectivoProveedorResponse,
  PreviewPagoProveedorResponse, RegistrarPagoProveedorResponse,
  GetProveedorCompraDetalleResponse, GetProveedorPagoDetalleResponse,
  ListSolicitudesPagoDirigidoResponse, GetProveedorResponse,
  ListComprasProveedorResponse, EstadoCuentaProveedorResponse, EstadisticasProveedorResponse,
  ObtenerCorteCajaResponse, ListarSalidasDineroCajaResponse, ListarProveedoresActivosCajaResponse,
  CreateSolicitudPagoDirigidoResponse, AprobarSolicitudPagoDirigidoResponse,
} from "@workspace/api-zod";

export const wire = (value: unknown): any => JSON.parse(JSON.stringify(value));
export const WHEN = "2026-09-22T12:00:00.000Z";
export const ORIGINAL_KEY = "11111111-1111-4111-8111-111111111111";
export const FUND_MOVEMENT = "22222222-2222-4222-8222-222222222222";
export const RETURN_KEY = "33333333-3333-4333-8333-333333333333";
export const FUND_RETURN = "44444444-4444-4444-8444-444444444444";
export const PROVIDER_ID = 7;
export const PAYMENT_ID = 91;
export const PURCHASE_ID = 35;
export const ENTRY_ID = 45;
export const ORIGINAL_SESSION = 123;
export const CURRENT_SESSION = 456;

export function currentUser(role = "ADMIN", location = 1, create = true, authorize = true) {
  return wire(GetCurrentUserResponse.parse({
    id: 10, nombre: "E12 operador fixture", usuario: "fixture-e12", rol: role,
    alcanceConsulta: "PROPIA",
    ubicacion: { id: location, nombre: "Ubicación fixture", iniciales: "MA",
      tipo: "TIENDA", activa: true, esSistema: false },
    permisos: [
      { modulo: "proveedores_finanzas", puedeVer: true, puedeCrear: create, puedeEditar: false, puedeAutorizar: authorize },
      { modulo: "proveedores", puedeVer: true, puedeCrear: false, puedeEditar: false, puedeAutorizar: false },
      { modulo: "cobros_pagos", puedeVer: true, puedeCrear: create, puedeEditar: false, puedeAutorizar: authorize },
      { modulo: "cortes", puedeVer: true, puedeCrear: false, puedeEditar: false, puedeAutorizar: false },
    ],
  }));
}

export function cashOptions({ session = ORIGINAL_SESSION as number | null, location = 1,
  caja = "1000.00" as string | null, fondo = "1000.00" as string | false, unlock = true } = {}) {
  return wire(GetOpcionesPagoEfectivoProveedorResponse.parse({
    enabled: true, ubicacionId: location, sesionCajaId: session,
    saldoCaja: session === null ? null : caja, puedeDesbloquearCaja: unlock,
    ...(fondo === false ? {} : { fondo: { saldo: fondo, versionSaldo: ORIGINAL_KEY } }),
  }));
}

export const assignment = () => ({
  pagoProveedorId: PAYMENT_ID, compraProveedorId: PURCHASE_ID, entradaId: ENTRY_ID,
  folio: 1045, importe: "150.50", saldoAntes: "150.50", saldoDespues: "0.00",
  resultado: "SALDADA", fecha: WHEN, revertido: false,
});

export const preview = () => wire(PreviewPagoProveedorResponse.parse({
  asignaciones: [assignment()], saldoAFavor: "0.00",
}));

export function payment({ metadata = true, caja = "50.25", fondo = "100.25", returned = false } = {}) {
  return wire(RegistrarPagoProveedorResponse.parse({
    id: PAYMENT_ID, proveedorId: PROVIDER_ID, entradaId: null, importe: "-150.50",
    tipo: "PAGO", formaPago: "EFECTIVO", referencia: null, fecha: WHEN,
    usuarioId: 10, notas: null, createdAt: WHEN, aplicaciones: [assignment()],
    saldoDisponible: "0.00", revertido: returned, reversoMovimientoId: returned ? 92 : null,
    ...(metadata ? { efectivoE12: {
      claveOperacion: ORIGINAL_KEY, pagoProveedorId: PAYMENT_ID, total: "150.50", caja, fondo,
      sesionCajaId: caja === "0.00" ? null : ORIGINAL_SESSION,
      salidaCajaId: caja === "0.00" ? null : 61,
      movimientoFondoId: fondo === "0.00" ? null : FUND_MOVEMENT,
      createdAt: WHEN, desbloqueoCaja: null,
      retorno: returned ? {
        claveOperacion: RETURN_KEY, naturaleza: "RECUPERACION_EFECTIVO",
        motivo: "Efectivo recuperado fixture", reversoProveedorId: 92, caja, fondo,
        sesionCajaId: caja === "0.00" ? null : CURRENT_SESSION,
        ingresoCajaId: caja === "0.00" ? null : 62,
        movimientoFondoId: fondo === "0.00" ? null : FUND_RETURN, createdAt: WHEN,
      } : null,
    } } : {}),
  }));
}

export const paymentDetail = (options: Parameters<typeof payment>[0] = {}) =>
  wire(GetProveedorPagoDetalleResponse.parse({ pago: payment(options), aplicaciones: [assignment()], saldoDisponible: "0.00" }));

export const purchaseDetail = () => wire(GetProveedorCompraDetalleResponse.parse({
  compra: { id: PURCHASE_ID, proveedorId: PROVIDER_ID, entradaId: ENTRY_ID, importe: "150.50",
    tipo: "COMPRA", formaPago: null, fecha: WHEN, usuarioId: 10, createdAt: WHEN },
  aplicaciones: [assignment()],
}));

export function directedRequests(metadata = true) {
  return wire(ListSolicitudesPagoDirigidoResponse.parse({ solicitudes: [{
    id: 81, tipo: "PROVEEDOR", entidadId: PROVIDER_ID, documentoMovimientoId: PURCHASE_ID,
    importe: "150.50", formaPago: "EFECTIVO", motivo: "Compra dirigida fixture",
    solicitanteId: 10, solicitanteNombre: "E12 operador fixture",
    contraparteNombre: "E12 proveedor fixture", documentoFolio: "1045",
    ubicacionId: 1, ubicacionNombre: "Mariana fixture", estado: "PENDIENTE", createdAt: WHEN,
    ...(metadata ? { efectivoE12: {
      claveOperacion: ORIGINAL_KEY, caja: "50.25", fondo: "100.25", sesionCajaId: ORIGINAL_SESSION,
    } } : {}),
  }] }));
}

export const directedResponse = (estado: "PENDIENTE" | "APROBADA" = "PENDIENTE") =>
  wire(CreateSolicitudPagoDirigidoResponse.parse({ ...directedRequests().solicitudes[0], estado,
    movimientoId: estado === "APROBADA" ? PAYMENT_ID : null }));
export const approvalResponse = () => wire(AprobarSolicitudPagoDirigidoResponse.parse({
  solicitudId: 81, movimientoId: PAYMENT_ID, estado: "APROBADA", efectivoE12: payment().efectivoE12,
}));

export const provider = () => wire(GetProveedorResponse.parse({
  id: PROVIDER_ID, nombre: "E12 proveedor fixture", tipo: "NACIONAL", monedaDefault: "MXN",
  contactoNombre: null, telefono: null, correo: null, pais: null, notas: null,
  activo: true, createdAt: WHEN,
}));

export const purchases = () => wire(ListComprasProveedorResponse.parse({
  items: [{
    movimientoId: PURCHASE_ID, entradaId: ENTRY_ID, folio: 1045, fecha: WHEN,
    totalCosto: "150.50", abonado: "0.00", saldoPendiente: "150.50", estado: "PENDIENTE",
    nombreUbicacion: "Mariana fixture", totalRollos: 1, cantidadTotal: "1.00",
    cantidadMetros: "1.00", cantidadKilos: "0.00", costoMetros: "150.50", costoKilos: "0.00",
    costoPorMetro: "150.50", costoPorKilo: null,
  }], total: 1, totalCostoPeriodo: "150.50", page: 1, pageSize: 1000,
}));

export const statement = () => wire(EstadoCuentaProveedorResponse.parse({
  movimientos: [], saldoActual: "150.50",
}));

export const statistics = () => wire(EstadisticasProveedorResponse.parse({
  desde: WHEN, hasta: WHEN, totalCompras: "150.50", comprasCount: 1, totalRollos: 1,
  costoPorMetro: "150.50", costoPorKilo: null, ticketPromedio: "150.50",
  diasDesdeUltimaCompra: 0, ultimaCompra: WHEN,
  frecuencia: { promedioDiasEntreCompras: null, ultimaCompra: WHEN },
  estacionalidad: { mesMayor: null, mesMenor: null },
  concentracion: { productoPrincipalPct: "100.00", tresPrincipalesPct: "100.00" },
  productosExclusivos: [], diasPromedioPago: null,
  antiguedadDeuda: { hasta30: "150.50", de31a60: "0.00", de61a90: "0.00", mas90: "0.00" },
  margenGenerado: { ventas: "0.00", costo: "0.00", margen: "0.00", margenPct: null,
    lineasIncluidas: 0, lineasExcluidasSinRollo: 0, lineasExcluidasSinCosto: 0, nota: "Fixture sin ventas" },
  porMes: [], porProducto: [], porTela: [], porColor: [],
}));

export const cashOuts = () => wire(ListarSalidasDineroCajaResponse.parse({ salidas: [] }));
export const cashProviders = () => wire(ListarProveedoresActivosCajaResponse.parse([
  { id: PROVIDER_ID, nombre: "E12 proveedor fixture" },
]));
export function cut(balance = "1000.00") {
  return wire(ObtenerCorteCajaResponse.parse({
    sesion: { id: ORIGINAL_SESSION, ubicacionId: 1, nombreUbicacion: "Mariana fixture",
      usuarioId: 10, nombreUsuario: "E12 operador fixture", abiertaAt: WHEN, cerradaAt: null,
      fondoInicial: balance, efectivoContado: null, estado: "ABIERTA" },
    formasPago: [], cuentasDestino: [], salidas: [], salidasPorCuenta: {},
    facturacion: [], metreado: [], productos: [], pendientes: [], ticketsCobradosDetalle: [],
    ticketsCobrados: 0, cancelaciones: [], fondoInicial: balance, totalCobrado: "0.00",
    ivaCobrado: "0.00", efectivoEsperado: balance, efectivoContado: null, diferencia: null,
    hojaVentasDia: { sitio: "Mariana fixture", fechaOperativa: "2026-09-22", cerrada: false,
      quienCerro: null, secciones: [], totalRollos: "0", totalMetros: "0", totalKilos: "0",
      totalBolsas: "0", totalPiezas: "0", subtotal: "0.00", ivaFacturado: "0.00", totalGeneral: "0.00" },
  }));
}

export const returnBreakdown = () => wire(ObtenerCorteCajaResponse.shape.efectivoDesglose.parse({
  version: "E2", fondoInicial: "100.00", cobrosTickets: "0.00", abonosFisicos: "0.00",
  cobrosRetenidos: "0.00", salidasFisicas: "0.00", retornosProveedor: "50.25",
  efectivoEsperado: "150.25", documentos: [{
    origen: "RETORNO_PROVEEDOR", id: "62", folio: null, importe: "50.25",
    href: `/proveedores/${PROVIDER_ID}`,
    evidencia: { referencia: null, motivo: "Recuperación fixture", fecha: WHEN,
      usuarioId: 10, proveedorId: PROVIDER_ID, naturalezaRetornoE12: "RECUPERACION_EFECTIVO" },
  }],
}));

export const statementWithPayment = () => wire(EstadoCuentaProveedorResponse.parse({
  saldoActual: "-150.50", movimientos: [{ ...payment(), saldoAcumulado: "-150.50" }],
}));