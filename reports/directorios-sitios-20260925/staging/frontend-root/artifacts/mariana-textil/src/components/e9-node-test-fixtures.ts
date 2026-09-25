// Synthetic transport fixtures ONLY for isolated native E9 tests.
// No productive DTOs: validate generated endpoint schemas, then HTTP-serialize.
import {
  GetCurrentUserResponse, GetE9DisponibilidadResponse, ListE9EntregasResponse,
  GetE9EntregaResponse, CreateE9EntregaResponse, CreateE9ConteoResponse,
  AuthorizeE9RecepcionResponse, CloseE9InvestigacionResponse,
  ListarSesionesCajaResponse, ObtenerCorteCajaResponse, ListAdminCortesResponse, ListUsersResponse,
} from "@workspace/api-zod";

export const wire = (value: unknown): any => JSON.parse(JSON.stringify(value));
export const SITE = 2;
export const CUT = 123;
export const DELIVERY = "11111111-1111-4111-8111-111111111111";
export const OLD_COUNT = "22222222-2222-4222-8222-222222222222";
export const COUNT = "33333333-3333-4333-8333-333333333333";
export const INVESTIGATION = "44444444-4444-4444-8444-444444444444";
export const FUND_ENTRY = "55555555-5555-4555-8555-555555555555";
export const FROZEN_VERSION = "server-frozen-cut-123-revision-7";
export const CUT_TIME = "2026-09-22T22:00:00.000Z";
export const SENT_TIME = "2026-09-23T08:00:00.000Z";
export const COUNT_TIME = "2026-09-23T12:00:00.000Z";
export const AUTH_TIME = "2026-09-24T12:00:00.000Z";
export const SENT = "150.50";
export const actor = { id: 10, nombre: "Operador E9 fixture" };
export const evidence = { descripcion: "Comprobante de custodia fixture", referencias: ["ACTA-E9-123"] };

export function currentUser(role: "ADMIN" | "SUPERVISOR" | "CAJA" = "ADMIN", id = 10, canView = true) {
  return wire(GetCurrentUserResponse.parse({
    id, nombre: actor.nombre, usuario: `fixture-e9-${id}`, rol: role,
    alcanceConsulta: role === "ADMIN" ? "TODAS" : "PROPIA",
    ubicacion: { id: role === "ADMIN" ? 1 : SITE, nombre: "Tienda fixture",
      iniciales: "TF", tipo: "TIENDA", activa: true, esSistema: false },
    permisos: [{ modulo: "cortes", puedeVer: canView, puedeCrear: false,
      puedeEditar: false, puedeAutorizar: false }],
  }));
}
export function capabilities(role: "ADMIN" | "SUPERVISOR" | "CAJA" = "ADMIN") {
  return {
    puedeEnviar: role !== "CAJA", puedeContar: role === "ADMIN",
    puedeAutorizar: role === "ADMIN", puedeCerrarInvestigacion: role === "ADMIN",
  };
}
export function availability(role: Parameters<typeof capabilities>[0] = "ADMIN", enabled = true) {
  return wire(GetE9DisponibilidadResponse.parse(enabled
    ? { enabled, ubicacionId: SITE, capacidades: capabilities(role) }
    : { enabled, motivoInactivo: "E9 no habilitado" }));
}
function difference(received: string) {
  const cents = BigInt(received.replace(".", "")) - 15050n;
  const absolute = cents < 0n ? -cents : cents;
  return `${cents < 0n ? "-" : ""}${absolute / 100n}.${String(absolute % 100n).padStart(2, "0")}`;
}
export function delivery({
  role = "ADMIN" as "ADMIN" | "SUPERVISOR" | "CAJA",
  stage = "ENVIADA" as "ENVIADA" | "CONTADA" | "AUTORIZADA",
  received = "140.25", closed = false, history = false,
} = {}) {
  if (stage === "AUTORIZADA" && received === "0.00") throw Error("E9_INVALID_FIXTURE_ZERO_AUTHORIZATION");
  const counted = stage !== "ENVIADA";
  const discrepancy = difference(received);
  const hasInvestigation = counted && (discrepancy !== "0.00" || history);
  return wire(GetE9EntregaResponse.parse({
    id: DELIVERY, ubicacionId: SITE, ubicacionNombre: "Tienda Norte fixture",
    corteId: CUT, versionCorte: FROZEN_VERSION, corteHref: `/caja/cortes?sesionId=${CUT}`,
    fechaCorte: CUT_TIME, importeEnviado: SENT, estado: stage,
    enviadoPor: actor, enviadoAt: SENT_TIME, evidenciaEnvio: evidence,
    conteos: counted ? [
      ...(history ? [{ id: OLD_COUNT, importeRecibido: "149.00", diferencia: "-1.50",
        evidencia: { ...evidence, descripcion: "Conteo anterior conservado" }, actor, createdAt: SENT_TIME }] : []),
      { id: COUNT, importeRecibido: received, diferencia: discrepancy,
        evidencia: evidence, actor, createdAt: COUNT_TIME },
    ] : [],
    ...(counted ? { conteoVigenteId: COUNT } : {}),
    ...(stage === "AUTORIZADA" ? { autorizacion: {
      conteoId: COUNT, importeRecibido: received, motivo: "Acreditar sólo el efectivo recibido",
      actor, createdAt: AUTH_TIME,
    } } : {}),
    ...(hasInvestigation ? { investigacion: {
      id: INVESTIGATION, estado: closed ? "CERRADA_DOCUMENTAL" : "ABIERTA",
      abiertaAt: COUNT_TIME, conteoOrigenId: history ? OLD_COUNT : COUNT,
      ...(closed ? { cierre: {
        conclusion: "Conclusión documental; discrepancia monetaria conservada",
        evidencia: evidence, actor, createdAt: AUTH_TIME,
      } } : {}),
    } } : {}),
    capacidades: {
      ...capabilities(role), puedeEnviar: false,
      puedeContar: role === "ADMIN" && stage !== "AUTORIZADA",
      puedeAutorizar: role === "ADMIN" && stage === "CONTADA" && received !== "0.00",
      puedeCerrarInvestigacion: role === "ADMIN" && hasInvestigation && !closed,
    },
    ...(role === "ADMIN" && stage === "AUTORIZADA"
      ? { fondo: { movimientoId: FUND_ENTRY, href: `/fondo/movimientos/${FUND_ENTRY}` } } : {}),
  }));
}
export const page = (items = [delivery()]) => wire(ListE9EntregasResponse.parse({ items }));
export const sentResponse = () => wire(CreateE9EntregaResponse.parse(delivery()));
export const countResponse = (received = "140.25", history = false) =>
  wire(CreateE9ConteoResponse.parse(delivery({ stage: "CONTADA", received, history })));
export const authorizedResponse = (received = "140.25") =>
  wire(AuthorizeE9RecepcionResponse.parse(delivery({ stage: "AUTORIZADA", received })));
export const closedResponse = () =>
  wire(CloseE9InvestigacionResponse.parse(delivery({ stage: "AUTORIZADA", closed: true, history: true })));

// Server-issued opaque version is now present in the generated closed-cut API.
export function frozenCut() {
  return wire(ObtenerCorteCajaResponse.parse({
    versionCorte: FROZEN_VERSION,
    sesion: { id: CUT, ubicacionId: SITE, nombreUbicacion: "Tienda Norte fixture",
      usuarioId: actor.id, nombreUsuario: actor.nombre, abiertaAt: "2026-09-22T09:00:00.000Z",
      cerradaAt: CUT_TIME, fondoInicial: "100.00", efectivoContado: SENT, estado: "CERRADA" },
    formasPago: [{ formaPago: "EFECTIVO", importe: "60.00", pagosCount: 1, ticketsCount: 1 }],
    cuentasDestino: [], salidas: [], salidasPorCuenta: {},
    facturacion: [], metreado: [], productos: [], pendientes: [], ticketsCobradosDetalle: [],
    ticketsCobrados: 1, cancelaciones: [], fondoInicial: "100.00", totalCobrado: "60.00",
    ivaCobrado: "0.00", efectivoEsperado: "160.00", efectivoContado: SENT, diferencia: "-9.50",
    efectivoDesglose: { version: "E2", fondoInicial: "100.00", cobrosTickets: "60.00",
      abonosFisicos: "0.00", cobrosRetenidos: "0.00", salidasFisicas: "0.00",
      efectivoEsperado: "160.00", documentos: [] },
    hojaVentasDia: { sitio: "Tienda Norte fixture", fechaOperativa: "2026-09-22", cerrada: true,
      quienCerro: actor.nombre, secciones: [], totalRollos: "0", totalMetros: "0", totalKilos: "0",
      totalBolsas: "0", totalPiezas: "0", subtotal: "0.00", ivaFacturado: "0.00", totalGeneral: "0.00" },
  }));
}
export function cuts() {
  const cut = frozenCut();
  return wire(ListarSesionesCajaResponse.parse([{ ...cut.sesion,
    ticketsCobrados: cut.ticketsCobrados, ticketsCancelados: 0, totalCobrado: cut.totalCobrado,
    efectivoEsperado: cut.efectivoEsperado, diferencia: cut.diferencia,
  }]));
}
export const users = () => wire(ListUsersResponse.parse([]));
export function adminCuts() {
  const cut = frozenCut();
  return wire(ListAdminCortesResponse.parse({
    items: [{ ...cut.sesion, vendido: "0.00", totalCobrado: "60.00",
      efectivoEsperado: "160.00", efectivoContado: SENT, diferencia: "-9.50",
      ticketsCobrados: 1, ticketsCancelados: 0 }],
    total: 1, page: 1, pageSize: 50,
    totales: { vendido: "0.00", cobrado: "60.00", efectivoEsperado: "160.00",
      efectivoContado: SENT, diferencia: "-9.50", tickets: 1 },
  }));
}