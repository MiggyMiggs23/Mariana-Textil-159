// Synthetic inputs ONLY for isolated E5 native tests, never production data.
// Schema-only validation is separate from the eventual MAIN-run mounted suite.
import {
  GetCurrentUserResponse, GetE5DisponibilidadResponse, GetE5ContextoResponse,
  ListE5CobrosResponse, PreviewE5CobroResponse, CreateE5CobroResponse,
  GetE5CobroResponse, CreateE5PropuestaResponse, AuthorizeE5AplicacionResponse,
  RejectE5PropuestaResponse, GetE5DevolucionOpcionesResponse, ReturnE5CobroResponse,
  ListE5AvisosResponse, GetE5DocumentoResponse, RecordE5ImpresionResponse,
  PreviewE5CobroBody, CreateE5PropuestaBody, AuthorizeE5AplicacionBody,
} from "@workspace/api-zod";
import type { CurrentUser, E5Capacidades } from "@workspace/api-client-react";

export const wire = (value: unknown): any => JSON.parse(JSON.stringify(value));
export const SITE = 2, CLIENT = 7, ORIGINAL_SESSION = 123, CURRENT_SESSION = 456;
export const NOTE = 101, SECOND_NOTE = 102;
export const SALE_MOVEMENT = 901, SECOND_SALE_MOVEMENT = 902, SAME_NOTE_SECOND_MOVEMENT = 903;
export const OPERATION = "88888888-8888-4888-8888-888888888888";
export const RECEIPT = "11111111-1111-4111-8111-111111111111";
export const RECEIPT_DOCUMENT = "22222222-2222-4222-8222-222222222222";
export const PROPOSAL = "33333333-3333-4333-8333-333333333333";
export const APPLICATION = "44444444-4444-4444-8444-444444444444";
export const APPLICATION_DOCUMENT = "55555555-5555-4555-8555-555555555555";
export const REFUND = "66666666-6666-4666-8666-666666666666";
export const FUND_MOVEMENT = "77777777-7777-4777-8777-777777777777";
export const CONTEXT_VERSION = "server-context-e5-opaque-v7";
export const RECEIVED_AT = "2026-09-22T12:00:00.000Z";
export const PROPOSED_AT = "2026-09-24T12:00:00.000Z";
export const APPLIED_AT = "2026-09-26T12:00:00.000Z";
export const TOTAL = "150.30", PARTIAL = "40.10", REMAINING = "110.20";
export const actor = { id: 10, nombre: "Operador E5 fixture" };
export const evidence = { descripcion: "Petición y recepción documentadas fixture", referencias: ["ACTA-E5-101"] };
type Role = CurrentUser["rol"];
type Stage = "pending" | "proposed" | "rejected" | "partial" | "applied" | "returned";

export function currentUser(role: Role = "ADMIN", id = 10, permitted = true) {
  return wire(GetCurrentUserResponse.parse({
    id, nombre: actor.nombre, usuario: `fixture-e5-${id}`, rol: role,
    alcanceConsulta: role === "ADMIN" ? "TODAS" : "PROPIA",
    ubicacion: { id: role === "ADMIN" ? 1 : SITE, nombre: "Tienda E5 fixture",
      iniciales: "EF", tipo: "TIENDA", activa: true, esSistema: false },
    permisos: ["cobros_pagos", "clientes", "clientes_credito", "clientes_finanzas", "caja_abonos"]
      .map(modulo => ({ modulo, puedeVer: permitted, puedeCrear: permitted,
        puedeEditar: false, puedeAutorizar: role === "ADMIN" && permitted })),
  }));
}
// Transport capability scenarios, not replacement productive permission logic.
// Future A must be supplied explicitly; legacy CONTADOR defaults to no capability.
export function capabilities(role: Role = "ADMIN", overrides: Partial<E5Capacidades> = {}) {
  return {
    puedeRecibir: role === "ADMIN" || role === "CAJA",
    puedePreparar: role === "ADMIN", puedeAutorizar: role === "ADMIN",
    puedeRechazar: role === "ADMIN", puedeDevolver: role === "ADMIN",
    puedeVerAvisos: role === "ADMIN", puedeImprimir: role === "ADMIN",
    preparacionADisponible: false, ...overrides,
  };
}
export const availability = (role: Role = "ADMIN", enabled = true) =>
  wire(GetE5DisponibilidadResponse.parse({ enabled, capacidades: enabled ? capabilities(role) : {
    puedeRecibir: false, puedePreparar: false, puedeAutorizar: false, puedeRechazar: false,
    puedeDevolver: false, puedeVerAvisos: false, puedeImprimir: false, preparacionADisponible: false,
  } }));
export const notes = (afterPartial = false) => [
  { notaId: NOTE, movimientoVentaId: SALE_MOVEMENT, folio: "N-101", ubicacionId: SITE,
    fecha: "2026-09-20T12:00:00.000Z", saldoPendiente: afterPartial ? "60.00" : "100.10", facturada: false },
  { notaId: SECOND_NOTE, movimientoVentaId: SECOND_SALE_MOVEMENT, folio: "N-102", ubicacionId: SITE,
    fecha: "2026-09-21T12:00:00.000Z", saldoPendiente: "50.20", facturada: true },
];
export const multiChargeNotes = () => [...notes(), {
  notaId: NOTE, movimientoVentaId: SAME_NOTE_SECOND_MOVEMENT, folio: "N-101", ubicacionId: SITE,
  fecha: "2026-09-20T13:00:00.000Z", saldoPendiente: "25.00", facturada: false,
}];
export function context(role: Role = "ADMIN", afterPartial = false, multiCharge = false) {
  return wire(GetE5ContextoResponse.parse({
    clienteId: CLIENT, clienteNombre: "Cliente E5 fixture", ubicacionId: SITE,
    versionContexto: CONTEXT_VERSION, consultadoAt: APPLIED_AT, notas: multiCharge ? multiChargeNotes() : notes(afterPartial),
    sesiones: [{ id: CURRENT_SESSION, ubicacionId: SITE, ubicacionNombre: "Tienda E5 fixture",
      fechaOperativa: "2026-09-26" }], capacidades: capabilities(role),
  }));
}
export const allocations = () => [
  { notaId: NOTE, movimientoVentaId: SALE_MOVEMENT, importe: "100.10" },
  { notaId: SECOND_NOTE, movimientoVentaId: SECOND_SALE_MOVEMENT, importe: "50.20" },
];
export const partialAllocations = () => [{ notaId: NOTE, movimientoVentaId: SALE_MOVEMENT, importe: PARTIAL }];
export const multiChargeAllocations = () => [...allocations(),
  { notaId: NOTE, movimientoVentaId: SAME_NOTE_SECOND_MOVEMENT, importe: "25.00" }];
export const proposal = () => ({
  id: PROPOSAL, version: 1, asignaciones: allocations(), notas: notes(),
  evidencia: evidence, actor, createdAt: PROPOSED_AT,
});
export function receipt({ stage = "pending" as Stage, role = "ADMIN" as Role, age = 4 } = {}) {
  const applied = stage === "partial" || stage === "applied";
  const proposed = ["proposed", "rejected", "partial", "applied"].includes(stage);
  const returned = stage === "returned";
  return wire(GetE5CobroResponse.parse({
    id: RECEIPT, revision: stage === "pending" ? 1 : stage === "proposed" || returned ? 2 : 3,
    clienteId: CLIENT, clienteNombre: "Cliente E5 fixture", ubicacionId: SITE, ubicacionNombre: "Tienda E5 fixture",
    importeRecibido: TOTAL, importeAplicado: applied ? stage === "partial" ? PARTIAL : TOTAL : "0.00",
    importePendiente: returned || stage === "applied" ? "0.00" : stage === "partial" ? REMAINING : TOTAL,
    importeDevuelto: returned ? TOTAL : "0.00", fechaRecepcion: RECEIVED_AT,
    formaPago: "EFECTIVO", cuentaDestino: "CAJA_FISICA",
    sesionCajaId: ORIGINAL_SESSION, sesionOperativaId: ORIGINAL_SESSION,
    estado: returned ? "DEVUELTO" : stage === "partial" ? "PARCIAL" : stage === "applied" ? "APLICADO" : "PENDIENTE",
    algunaVezAplicado: applied, receptor: actor, evidenciaRecepcion: evidence, notasIndicadas: notes(),
    propuestas: proposed ? [proposal()] : [],
    ...(stage === "proposed" ? { propuestaVigenteId: PROPOSAL } : {}),
    aplicaciones: applied ? [{
      id: APPLICATION, propuestaId: PROPOSAL, importe: stage === "partial" ? PARTIAL : TOTAL,
      asignaciones: stage === "partial" ? partialAllocations() : allocations(),
      fechaAplicacion: APPLIED_AT, actor, evidencia: evidence, constanciaId: APPLICATION_DOCUMENT,
    }] : [],
    rechazos: stage === "rejected" ? [{ propuestaId: PROPOSAL, motivo: "Reparto rechazado; dinero retenido",
      actor, createdAt: APPLIED_AT }] : [],
    ...(returned ? { devolucion: {
      id: REFUND, importe: TOTAL, fecha: APPLIED_AT, actor, peticionCliente: "Cliente solicita restitución íntegra",
      evidencia: evidence, ...(role === "ADMIN" ? {
        fuente: { tipo: "CAJA", ubicacionId: SITE, sesionCajaId: CURRENT_SESSION, cuentaOrigen: "CAJA_FISICA" },
        salidaId: 77,
      } : {}),
    } } : {}),
    reciboId: RECEIPT_DOCUMENT, antiguedadDias: age,
    avisoAdmin: role === "ADMIN" && age >= 3 && !returned && stage !== "applied",
    capacidades: capabilities(role, {
      puedePreparar: role === "ADMIN" && !returned && stage !== "applied",
      puedeAutorizar: role === "ADMIN" && stage === "proposed",
      puedeRechazar: role === "ADMIN" && stage === "proposed",
      puedeDevolver: role === "ADMIN" && !applied && !returned,
    }),
  }));
}
export const page = (items = [receipt()]) => wire(ListE5CobrosResponse.parse({ items }));
export const preview = (apply = false, role: Role = "ADMIN") =>
  wire(PreviewE5CobroResponse.parse({
    versionContexto: CONTEXT_VERSION, importeRecibido: TOTAL, importeAplicar: apply ? PARTIAL : "0.00",
    pendienteResultante: apply ? REMAINING : TOTAL, notas: notes(),
    mensaje: "Recibido, pendiente de aplicación", capacidades: capabilities(role),
  }));
export function createResponse(apply = false) {
  const row = receipt({ stage: apply ? "partial" : "pending", age: 0 });
  row.sesionCajaId = CURRENT_SESSION;
  row.sesionOperativaId = CURRENT_SESSION;
  // Same-transaction application has the reception instant, unlike later approval.
  if (apply) {
    row.propuestas[0].createdAt = RECEIVED_AT;
    row.aplicaciones[0].fechaAplicacion = RECEIVED_AT;
  }
  return wire(CreateE5CobroResponse.parse(row));
}
export const proposalResponse = () => wire(CreateE5PropuestaResponse.parse(receipt({ stage: "proposed" })));
export const authorizeResponse = (full = false) => wire(AuthorizeE5AplicacionResponse.parse(receipt({ stage: full ? "applied" : "partial" })));
export const rejectResponse = () => wire(RejectE5PropuestaResponse.parse(receipt({ stage: "rejected" })));
export const refundResponse = (role: Role = "ADMIN") => wire(ReturnE5CobroResponse.parse(receipt({ stage: "returned", role })));
export const refundOptions = (eligible = true) => wire(GetE5DevolucionOpcionesResponse.parse({
  elegible: eligible, importe: TOTAL,
  ...(eligible ? {} : { motivo: "Ya existe aplicación; el residual nunca es devolvible" }),
  fuentes: eligible ? [
    { tipo: "CAJA", ubicacionId: SITE, sesionCajaId: CURRENT_SESSION, cuentaOrigen: "CAJA_FISICA" },
    { tipo: "CUENTA", ubicacionId: SITE, sesionOperativaId: CURRENT_SESSION, cuentaOrigen: "CUENTA_NO_FISCAL" },
    { tipo: "FONDO", ubicacionId: 1 },
  ] : [],
}));
export const alerts = () => wire(ListE5AvisosResponse.parse({ items: [receipt({ age: 3 })] }));
export function document(application = false) {
  return wire(GetE5DocumentoResponse.parse({
    id: application ? APPLICATION_DOCUMENT : RECEIPT_DOCUMENT, tipo: application ? "CONSTANCIA" : "RECIBO",
    folio: application ? "CA-E5-001" : "RC-E5-001", cobroId: RECEIPT,
    reciboId: RECEIPT_DOCUMENT, reciboFolio: "RC-E5-001", clienteNombre: "Cliente E5 fixture",
    ubicacionNombre: "Tienda E5 fixture", receptor: actor, formaPago: "EFECTIVO", cuentaDestino: "CAJA_FISICA",
    fechaRecepcion: RECEIVED_AT, fechaEmision: application ? APPLIED_AT : RECEIVED_AT,
    ...(application ? { fechaAplicacion: APPLIED_AT, autorizador: actor } : {}),
    importeRecibido: TOTAL, importeDocumento: application ? PARTIAL : TOTAL,
    pendienteEnEmision: application ? REMAINING : TOTAL,
    mensaje: application ? "Constancia de aplicación parcial" : "Recibido, pendiente de aplicación",
    asignaciones: application ? partialAllocations() : [], notas: notes(application), evidencia: evidence, copias: 2,
  }));
}
export const printResponse = () => wire(RecordE5ImpresionResponse.parse({ registrado: true }));

export function multiChargeReceipt() {
  const row = receipt({ stage: "proposed" });
  row.importeRecibido = "175.30"; row.importePendiente = "175.30";
  row.notasIndicadas = multiChargeNotes();
  row.propuestas[0].asignaciones = multiChargeAllocations();
  row.propuestas[0].notas = multiChargeNotes();
  return wire(GetE5CobroResponse.parse(row));
}
export function receptionInput(multiCharge = false, applyNow = false) {
  return wire(PreviewE5CobroBody.parse({
    claveOperacion: OPERATION, clienteId: CLIENT, ubicacionId: SITE, versionContexto: CONTEXT_VERSION,
    entrada: "CAJA", importe: multiCharge ? "175.30" : TOTAL, formaPago: "EFECTIVO", cuentaDestino: "CAJA_FISICA",
    sesionOperativaId: CURRENT_SESSION, sesionCajaId: CURRENT_SESSION,
    // Documents occur once even when their balances contain multiple movements.
    notasIndicadas: [NOTE, SECOND_NOTE], evidencia: evidence,
    ...(applyNow ? { aplicarAhora: multiCharge ? multiChargeAllocations() : partialAllocations() } : {}),
  }));
}
export function proposalInput(favor = false, onlyFavor = false) {
  if (onlyFavor && !favor) throw Error("E5_FIXTURE_EMPTY_ASSIGNMENTS_REQUIRE_EXPLICIT_FAVOR");
  return wire(CreateE5PropuestaBody.parse({
    claveOperacion: OPERATION, revisionEsperada: 1, versionContexto: CONTEXT_VERSION,
    asignaciones: onlyFavor ? [] : allocations(), evidencia: evidence,
    ...(favor ? { importeFavorPropuesto: "40.00" } : {}),
  }));
}
export function authorizationInput(favor = false, onlyFavor = false) {
  if (onlyFavor && !favor) throw Error("E5_FIXTURE_EMPTY_ASSIGNMENTS_REQUIRE_EXPLICIT_FAVOR");
  return wire(AuthorizeE5AplicacionBody.parse({
    claveOperacion: OPERATION, revisionEsperada: 2, versionContexto: CONTEXT_VERSION, propuestaId: PROPOSAL,
    asignaciones: onlyFavor ? [] : allocations(), evidencia: evidence,
    ...(favor ? { importeFavorAutorizado: "20.00" } : {}),
  }));
}
// Favor scenarios represent explicit ADMIN server decisions after global debt
// revalidation. No invented deudaGlobal field and no local eligibility inference.
export function favorReceipt(approved = false, onlyFavor = false) {
  const row = receipt({ stage: approved ? "partial" : "proposed" });
  row.importeRecibido = "200.30";
  row.importeAplicado = approved ? onlyFavor ? "20.00" : "170.30" : "0.00";
  row.importePendiente = approved ? onlyFavor ? "180.30" : "30.00" : "200.30";
  row.propuestas[0].importeFavorPropuesto = "40.00";
  row.propuestas[0].asignaciones = onlyFavor ? [] : allocations();
  if (onlyFavor) row.propuestas[0].notas = [];
  if (approved) {
    row.aplicaciones[0].importe = row.importeAplicado;
    row.aplicaciones[0].asignaciones = onlyFavor ? [] : allocations();
    row.aplicaciones[0].importeFavorGenerado = "20.00";
  }
  return wire(GetE5CobroResponse.parse(row));
}
export const favorProposalResponse = (onlyFavor = false) =>
  wire(CreateE5PropuestaResponse.parse(favorReceipt(false, onlyFavor)));
export const favorAuthorizeResponse = (onlyFavor = false) =>
  wire(AuthorizeE5AplicacionResponse.parse(favorReceipt(true, onlyFavor)));
export function favorDocument(onlyFavor = false) {
  return wire(GetE5DocumentoResponse.parse({
    ...document(true), importeRecibido: "200.30", importeDocumento: onlyFavor ? "20.00" : "170.30",
    importeFavorGenerado: "20.00", pendienteEnEmision: onlyFavor ? "180.30" : "30.00",
    asignaciones: onlyFavor ? [] : allocations(),
    notas: onlyFavor ? [] : notes().map(note => ({ ...note, saldoPendiente: "0.00" })),
    mensaje: "Constancia de aplicación con favor expresamente autorizado",
  }));
}