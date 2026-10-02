/*
 * Read-only API fixtures for the laser safe-area PDF harness.
 *
 * These fixtures are consumed by a browser Fetch/CDP interceptor.  They are
 * deliberately not test-database seeds: the real Entrada, Nota and Hoja de
 * Viaje routes are mounted and only their HTTP responses are replaced.
 */

const freeze = (value) => Object.freeze(value);

const auth = freeze({
  id: 1,
  nombre: "Usuario PDF fixture",
  usuario: "usuario.pdf.fixture",
  rol: "CONTADOR",
  ubicacion: freeze({
    id: 1,
    nombre: "Sitio PDF fixture",
    iniciales: "QA",
    tipo: "TIENDA",
    activa: true,
    esSistema: false,
  }),
  alcanceConsulta: "PROPIA",
  permisos: [
    freeze({
      modulo: "entradas",
      puedeVer: true,
      puedeCrear: false,
      puedeEditar: false,
      puedeAutorizar: false,
    }),
    freeze({
      modulo: "viajes",
      puedeVer: true,
      puedeCrear: false,
      puedeEditar: false,
      puedeAutorizar: false,
    }),
    freeze({
      modulo: "cobros_pagos",
      puedeVer: true,
      puedeCrear: false,
      puedeEditar: false,
      puedeAutorizar: false,
    }),
  ],
});

const notifications = freeze({
  events: [],
  generatedAt: "2026-01-01T12:00:00.000Z",
  sessionKey: "laser-document-fixture-no-session",
});

const notificationsList = freeze({
  notificaciones: [],
  sistema: [],
  porVencer: [],
  vencidas: [],
  clientesConMultiplesVencidas: [],
});

const endpointContracts = freeze({
  authMe: "GET /api/auth/me",
  notificationsFeed: "GET /api/notificaciones/feed",
  notificationsList: "GET /api/notificaciones",
  entrada: (id) => `GET /api/inventario/entradas/${id}`,
  ticket: (id) => `GET /api/tickets/${id}`,
  ticketPrint: (id, copia) =>
    `GET /api/tickets/${id}/documento-impresion?copia=${copia}`,
  viaje: (id) => `GET /api/viajes/${id}`,
});

const routeContracts = freeze({
  entrada: (id) => `/entradas/${id}/documento`,
  nota: (id) => `/tickets/${id}`,
  viaje: (id) => `/viajes/${id}/documento`,
});

const sourceSelectorContracts = freeze({
  entrada: freeze({
    page: ".entrada-page-print",
    frame: ".entrada-page-print .document-page-frame",
    grid: ".entrada-page-print .document-product-grid",
    row: ".entrada-page-print .document-product-grid tbody tr",
    seriesGrid: ".entrada-page-print .embedded-series, .entrada-page-print .series-table",
    footer: ".entrada-page-print .document-footer",
  }),
  nota: freeze({
    printRoot: ".print-credito-only",
    page: ".print-credito-only .credito-page-print",
    frame: ".print-credito-only .nota-page-frame",
    grid: ".print-credito-only .document-product-grid",
    row: ".print-credito-only .document-product-grid tbody tr",
    legal: '[data-testid="note-legal-block"]',
    signature: '[data-testid="note-signature-block"]',
    totals: '[data-testid="note-totals-block"]',
  }),
  viaje: freeze({
    page: ".viaje-page-print",
    table: ".viaje-page-print table",
    row: ".viaje-page-print table tbody tr",
    footer: ".viaje-page-print footer",
  }),
});

const expectedTextContracts = freeze({
  entrada: freeze([
    "ENTRADA",
    "Listado de series",
    "SERIE-ENTRADA-0001",
    "Sitio PDF fixture",
    "Recibido por",
    "Revisado por",
    "Autorizado por",
  ]),
  nota: freeze([
    "NOTA",
    "COPIA INTERNA",
    "COPIA CLIENTE",
    "RECIBO DE MERCANCÍA Y PAGARÉ",
    "Recibo a mi entera satisfacción la mercancía aquí detallada.",
    "Firma de Conformidad",
    "TOTAL",
    "DOCUMENTO",
  ]),
  viaje: freeze([
    "HOJA DE VIAJE",
    "Documentos",
    "SERIE-VIAJE-0001",
    "Totales:",
    "Sitio PDF fixture",
  ]),
});

const entradaLongestCatalogLabel = freeze({
  sku: "MEZDIA10-IND",
  tela: "Mezclilla Diamantina 10 Oz",
  color: "Indigo Lisa",
});

function entryLine(index, { catalogLongestLabels = false } = {}) {
  const ordinal = String(index + 1).padStart(4, "0");
  const label = catalogLongestLabels
    ? entradaLongestCatalogLabel
    : {
        sku: `SKU-ENTRADA-${ordinal}`,
        tela: `Tela fixture ${ordinal}`,
        color: index % 2 === 0 ? "Azul fixture" : "Rojo fixture",
      };
  return {
    productoId: index + 1,
    skuProducto: label.sku,
    telaProducto: label.tela,
    colorProducto: label.color,
    unidadProducto: "METRO",
    costoUnitario: null,
    rollosCount: 1,
    cantidadTotal: "1.000",
    costoTotal: null,
  };
}

function entryRollo(index) {
  const ordinal = String(index + 1).padStart(4, "0");
  return {
    id: 71000 + index,
    serie: `SERIE-ENTRADA-${ordinal}`,
    productoId: index + 1,
    cantidadInicial: "1.000",
    pisoId: null,
    nombrePiso: null,
    costoUnitario: null,
    costoTotal: null,
  };
}

function buildEntrada(id, count, options = {}) {
  const lineas = Array.from({ length: count }, (_, index) => entryLine(index, options));
  return freeze({
    id,
    folio: id,
    inicialesSitio: "QA",
    folioFormateado: `QA-ENT-${id}`,
    ubicacionId: 1,
    nombreUbicacion: "Sitio PDF fixture",
    proveedorId: null,
    nombreProveedor: null,
    usuarioId: 1,
    nombreUsuario: "Usuario PDF fixture",
    fecha: "2026-01-01",
    observaciones: "Fixture de safe area laser",
    totalRollos: count,
    totalCosto: null,
    uuidCliente: `laser-entrada-${id}`,
    createdAt: "2026-01-01T12:00:00.000Z",
    lineas,
    rollos: Array.from({ length: count }, (_, index) => entryRollo(index)),
  });
}

function buildEntradaSeries(id, seriesRows) {
  const entrada = buildEntrada(id, 1);
  const rollos = Array.from({ length: seriesRows * 4 }, (_, index) => ({
    ...entryRollo(index),
    productoId: entrada.lineas[0].productoId,
  }));
  return freeze({
    ...entrada,
    totalRollos: rollos.length,
    rollos,
  });
}

function ticketLine(index, { priced }) {
  const ordinal = String(index + 1).padStart(4, "0");
  const line = {
    productoId: 81000 + index,
    tipo: "NORMAL",
    skuProducto: `SKU-NOTA-${ordinal}`,
    telaProducto: `Tela nota ${ordinal}`,
    colorProducto: index % 2 === 0 ? "Azul nota" : "Rojo nota",
    unidadProducto: "METRO",
    cantidad: "1.000",
  };
  if (priced) {
    return {
      ...line,
      precioUnitario: "10.00",
      precioSugerido: "10.00",
      importe: "10.00",
    };
  }
  return line;
}

function buildTicket(id, count) {
  const lineas = Array.from({ length: count }, (_, index) => ({
    id: 82000 + index,
    ticketId: id,
    rolloId: null,
    ...ticketLine(index, { priced: true }),
    serieRollo: null,
    nombreUbicacion: "Sitio PDF fixture",
    costoUnitarioCongelado: null,
    costoTotalCongelado: null,
    costoFuente: null,
    margen: null,
  }));
  return freeze({
    id,
    folio: id,
    ubicacionId: 1,
    nombreUbicacion: "Sitio PDF fixture",
    usuarioTerminalId: 1,
    nombreUsuarioTerminal: "Usuario PDF fixture",
    clienteId: 42,
    nombreCliente: "Cliente PDF fixture",
    documentoTipo: "NOTA",
    notaSinPrecios: false,
    direccionEntregaEfectiva: "Dirección PDF fixture",
    subtotal: `${count * 10}.00`,
    iva: "0.00",
    tasaIva: "0.16",
    total: `${count * 10}.00`,
    estado: "VENDIDO",
    lineasCount: count,
    cobrado: false,
    cobradoAt: null,
    usuarioCajaId: null,
    nombreUsuarioCaja: null,
    facturado: false,
    sesionCajaId: null,
    uuidCliente: `laser-nota-${id}`,
    createdAt: "2026-01-01T12:00:00.000Z",
    canceladoAt: null,
    canceladoPor: null,
    nombreUsuarioCancelacion: null,
    motivoCancelacion: null,
    autorizadoPor: null,
    nombreUsuarioAutorizacion: null,
    esCredito: false,
    importeCredito: "0.00",
    diasPlazo: null,
    fechaVencimiento: null,
    saldoPendiente: "0.00",
    telefonoCliente: "555-0100",
    correoCliente: "cliente.fixture@example.test",
    direccionCliente: "Dirección PDF fixture",
    nombreDestinatario: "Destinatario PDF fixture",
    direccionEntregaSnapshot: "Dirección PDF fixture",
    convertidoANotaPorCobro: false,
    diasCreditoCliente: null,
    viaje: null,
    salidas: [],
    lineas,
    pagos: [],
  });
}

function buildPrintDocument(ticketId, count, copia) {
  const internal = copia === "INTERNA";
  const lineas = Array.from({ length: count }, (_, index) =>
    ticketLine(index, { priced: internal }),
  );
  const document = {
    ticketId,
    folio: ticketId,
    copia,
    documentoTipo: "NOTA",
    notaSinPrecios: !internal,
    ubicacionId: 1,
    nombreUbicacion: "Sitio PDF fixture",
    createdAt: "2026-01-01T12:00:00.000Z",
    estado: "VENDIDO",
    clienteId: 42,
    nombreCliente: "Cliente PDF fixture",
    nombreDestinatario: "Destinatario PDF fixture",
    direccionEntregaSnapshot: "Dirección PDF fixture",
    direccionEntregaEfectiva: "Dirección PDF fixture",
    telefonoCliente: "555-0100",
    correoCliente: "cliente.fixture@example.test",
    direccionFiscalEfectiva: "Dirección fiscal PDF fixture",
    facturado: false,
    esCredito: false,
    diasPlazo: null,
    fechaVencimiento: null,
    lineas,
  };
  if (internal) {
    return freeze({
      ...document,
      subtotal: `${count * 10}.00`,
      iva: "0.00",
      tasaIva: "0.16",
      total: `${count * 10}.00`,
      diasCreditoCliente: null,
      saldoPendiente: "0.00",
    });
  }
  return freeze(document);
}

function viajeRollo(index) {
  const ordinal = String(index + 1).padStart(4, "0");
  return {
    serie: `SERIE-VIAJE-${ordinal}`,
    documento: "NOTA",
    documentoId: 82001,
    tela: `Tela viaje ${ordinal}`,
    color: "Azul viaje",
    cantidad: "1.000",
    unidad: "METRO",
  };
}

function buildViaje(id, count) {
  return freeze({
    id,
    folio: id,
    folioFormateado: `QA-VIAJE-${id}`,
    origenId: 1,
    nombreOrigen: "Sitio PDF fixture",
    salidaAt: "2026-01-01T12:00:00.000Z",
    camioneta: "Camioneta PDF fixture",
    chofer: "Chofer PDF fixture",
    documentos: 2,
    totalRollos: count,
    totalMetros: `${count}.000`,
    totalKilos: "0.000",
    totalBolsas: "0.000",
    totalPiezas: "0.000",
    destinos: ["Destino PDF fixture"],
    observaciones: "Fixture de safe area laser",
    tickets: [
      {
        id: 82001,
        folio: 82001,
        destinatario: "Destinatario PDF fixture",
        cliente: "Cliente PDF fixture",
      },
    ],
    salidas: [
      {
        id: 83001,
        folio: 83001,
        destino: "Destino PDF fixture",
      },
    ],
    rollos: Array.from({ length: count }, (_, index) => viajeRollo(index)),
  });
}

function responseMap({ entrada, ticket, ticketPrintInterna, ticketPrintCliente, viaje }) {
  return freeze({
    [endpointContracts.authMe]: auth,
    [endpointContracts.notificationsFeed]: notifications,
    [endpointContracts.notificationsList]: notificationsList,
    ...(entrada ? { [endpointContracts.entrada(entrada.id)]: entrada } : {}),
    ...(ticket
      ? {
          [endpointContracts.ticket(ticket.id)]: ticket,
          [endpointContracts.ticketPrint(ticket.id, "INTERNA")]: ticketPrintInterna,
          [endpointContracts.ticketPrint(ticket.id, "CLIENTE")]: ticketPrintCliente,
        }
      : {}),
    ...(viaje ? { [endpointContracts.viaje(viaje.id)]: viaje } : {}),
  });
}

function scenario({ kind, name, id, count, expectedPageCount, expectedText, entrada, ticket, viaje }) {
  const ticketPrintInterna = ticket ? buildPrintDocument(ticket.id, count, "INTERNA") : null;
  const ticketPrintCliente = ticket ? buildPrintDocument(ticket.id, count, "CLIENTE") : null;
  const apiResponses = responseMap({
    entrada,
    ticket,
    ticketPrintInterna,
    ticketPrintCliente,
    viaje,
  });
  return freeze({
    name,
    kind,
    route:
      kind === "entrada"
        ? routeContracts.entrada(id)
        : kind === "nota"
          ? routeContracts.nota(id)
          : routeContracts.viaje(id),
    count,
    expectedPageCount,
    expectedText: freeze([...expectedText]),
    sourceSelectors: sourceSelectorContracts[kind],
    apiResponses,
    expectedApiRequests: freeze(Object.keys(apiResponses)),
  });
}

/*
 * Entrada's 10-row full-output fixture case and Nota's eight-row copy
 * capacity are measured by the laser PDF regression. The 11/12 rows, 23/24
 * rows, and 8/9 rows remain explicit overflow probes, while Hoja de Viaje is
 * verified with one and ten rows. Series probes use one product with four
 * rollos per rendered row.
 */
const configuredProbeCounts = freeze({
  entrada: freeze({ count1: 1, max: 23, overflow: 24 }),
  nota: freeze({ count1: 1, max: 8, overflow: 9 }),
  viaje: freeze({ count1: 1, max: 10 }),
});

const entradaCount1 = buildEntrada(71001, configuredProbeCounts.entrada.count1, { catalogLongestLabels: true });
const entradaCount10 = buildEntrada(71010, 10, { catalogLongestLabels: true });
const entradaMeasured11 = buildEntrada(71011, 11, { catalogLongestLabels: true });
const entradaMeasured12 = buildEntrada(71012, 12);
const entradaMax = buildEntrada(71023, configuredProbeCounts.entrada.max);
const entradaOverflow = buildEntrada(71024, configuredProbeCounts.entrada.overflow);
const entradaSeries40 = buildEntradaSeries(71040, 40);
const entradaSeries41 = buildEntradaSeries(71041, 41);
const notaCount1 = buildTicket(72001, configuredProbeCounts.nota.count1);
const notaMax = buildTicket(72008, configuredProbeCounts.nota.max);
const notaOverflow = buildTicket(72009, configuredProbeCounts.nota.overflow);
const viajeCount1 = buildViaje(73001, configuredProbeCounts.viaje.count1);
const viajeMax = buildViaje(73010, configuredProbeCounts.viaje.max);

export const LASER_DOCUMENT_FIXTURES = freeze({
  entrada: freeze({
    measured10: scenario({
      kind: "entrada",
      name: "entrada-measured-10-rows",
      id: entradaCount10.id,
      count: 10,
      expectedPageCount: 2,
      expectedText: expectedTextContracts.entrada,
      entrada: entradaCount10,
    }),
    count1: scenario({
      kind: "entrada",
      name: "entrada-count-1",
      id: entradaCount1.id,
      count: 1,
      expectedPageCount: 1,
      expectedText: expectedTextContracts.entrada,
      entrada: entradaCount1,
    }),
    measured11: scenario({
      kind: "entrada",
      name: "entrada-measured-11-rows",
      id: entradaMeasured11.id,
      count: 11,
      expectedPageCount: 3,
      expectedText: [...expectedTextContracts.entrada, "SERIE-ENTRADA-0011"],
      entrada: entradaMeasured11,
    }),
    measured12: scenario({
      kind: "entrada",
      name: "entrada-measured-12-rows",
      id: entradaMeasured12.id,
      count: 12,
      expectedPageCount: 3,
      expectedText: [...expectedTextContracts.entrada, "SERIE-ENTRADA-0012"],
      entrada: entradaMeasured12,
    }),
    max: scenario({
      kind: "entrada",
      name: "entrada-configured-safe-probe",
      id: entradaMax.id,
      count: configuredProbeCounts.entrada.max,
      expectedPageCount: 4,
      expectedText: [...expectedTextContracts.entrada, "SERIE-ENTRADA-0023"],
      entrada: entradaMax,
    }),
    overflowPages: scenario({
      kind: "entrada",
      name: "entrada-configured-overflow-probe",
      id: entradaOverflow.id,
      count: configuredProbeCounts.entrada.overflow,
      expectedPageCount: 4,
      expectedText: [...expectedTextContracts.entrada, "SERIE-ENTRADA-0024"],
      entrada: entradaOverflow,
    }),
    series40: scenario({
      kind: "entrada",
      name: "entrada-series-40-rows",
      id: entradaSeries40.id,
      count: 1,
      expectedPageCount: 3,
      expectedText: [...expectedTextContracts.entrada, "SERIE-ENTRADA-0160"],
      entrada: entradaSeries40,
    }),
    series41: scenario({
      kind: "entrada",
      name: "entrada-series-41-rows",
      id: entradaSeries41.id,
      count: 1,
      expectedPageCount: 3,
      expectedText: [...expectedTextContracts.entrada, "SERIE-ENTRADA-0164"],
      entrada: entradaSeries41,
    }),
  }),
  nota: freeze({
    count1: scenario({
      kind: "nota",
      name: "nota-count-1",
      id: notaCount1.id,
      count: 1,
      expectedPageCount: 2,
      expectedText: expectedTextContracts.nota,
      ticket: notaCount1,
    }),
    max: scenario({
      kind: "nota",
      name: "nota-configured-safe-probe",
      id: notaMax.id,
      count: configuredProbeCounts.nota.max,
      expectedPageCount: 2,
      expectedText: [...expectedTextContracts.nota, "Tela nota 0008"],
      ticket: notaMax,
    }),
    overflowPages: scenario({
      kind: "nota",
      name: "nota-configured-overflow-probe",
      id: notaOverflow.id,
      count: configuredProbeCounts.nota.overflow,
      expectedPageCount: 4,
      expectedText: [...expectedTextContracts.nota, "Tela nota 0009"],
      ticket: notaOverflow,
    }),
  }),
  viaje: freeze({
    count1: scenario({
      kind: "viaje",
      name: "viaje-count-1",
      id: viajeCount1.id,
      count: 1,
      expectedPageCount: 1,
      expectedText: expectedTextContracts.viaje,
      viaje: viajeCount1,
    }),
    max: scenario({
      kind: "viaje",
      name: "viaje-ten-rows",
      id: viajeMax.id,
      count: configuredProbeCounts.viaje.max,
      expectedPageCount: 1,
      expectedText: [...expectedTextContracts.viaje, "SERIE-VIAJE-0010"],
      viaje: viajeMax,
    }),
  }),
});

export const LASER_DOCUMENT_ENDPOINTS = endpointContracts;
export const LASER_DOCUMENT_ROUTES = routeContracts;
export const LASER_DOCUMENT_SOURCE_SELECTORS = sourceSelectorContracts;
export const LASER_DOCUMENT_EXPECTED_TEXT = expectedTextContracts;
export const LASER_DOCUMENT_COMMON_RESPONSES = freeze({
  [endpointContracts.authMe]: auth,
  [endpointContracts.notificationsFeed]: notifications,
  [endpointContracts.notificationsList]: notificationsList,
});
export const LASER_DOCUMENT_PAGE_COUNTS = freeze({
  entrada: freeze({
    count1: LASER_DOCUMENT_FIXTURES.entrada.count1.expectedPageCount,
    measured11: LASER_DOCUMENT_FIXTURES.entrada.measured11.expectedPageCount,
    measured12: LASER_DOCUMENT_FIXTURES.entrada.measured12.expectedPageCount,
    max: LASER_DOCUMENT_FIXTURES.entrada.max.expectedPageCount,
    overflowPages: LASER_DOCUMENT_FIXTURES.entrada.overflowPages.expectedPageCount,
    series40: LASER_DOCUMENT_FIXTURES.entrada.series40.expectedPageCount,
    series41: LASER_DOCUMENT_FIXTURES.entrada.series41.expectedPageCount,
  }),
  nota: freeze({
    count1: LASER_DOCUMENT_FIXTURES.nota.count1.expectedPageCount,
    max: LASER_DOCUMENT_FIXTURES.nota.max.expectedPageCount,
    overflowPages: LASER_DOCUMENT_FIXTURES.nota.overflowPages.expectedPageCount,
  }),
  viaje: freeze({
    count1: LASER_DOCUMENT_FIXTURES.viaje.count1.expectedPageCount,
    max: LASER_DOCUMENT_FIXTURES.viaje.max.expectedPageCount,
  }),
});
export const LASER_DOCUMENT_CONFIGURED_PROBE_COUNTS = configuredProbeCounts;

export function getLaserDocumentFixture(kind, scenarioName = "count1") {
  const fixture = LASER_DOCUMENT_FIXTURES[kind]?.[scenarioName];
  if (!fixture) {
    throw new Error(`Unknown laser document fixture: ${kind}/${scenarioName}`);
  }
  return fixture;
}
