import test from "node:test";
import { GetAdminAlertasResponse, VerificarAutorizacionVentaSalidasResponse } from "@workspace/api-zod";

const link = { id: 4, folioFormateado: "M-000004", origenId: 2, nombreOrigen: "Mariana", href: "/salidas/4" };
const base = { ticketId: 9, folio: 1009, folioFormateado: "TICKET-001009", documentoTipo: "TICKET" as const, autorizadoAt: null, documentoHref: "/tickets/9", salidas: [link] };

test("authorization verification parses authorized and pending contracts", () => {
  VerificarAutorizacionVentaSalidasResponse.parse({ ...base, autorizada: true, estado: "AUTORIZADA" });
  VerificarAutorizacionVentaSalidasResponse.parse({ ...base, autorizada: false, estado: "PENDIENTE_COBRO" });
});

test("admin alerts parse ordinary and customer-sale arrays without null destinations", () => {
  GetAdminAlertasResponse.parse({
    generatedAt: new Date(), total: 2, ticketsPendientes: [], creditos: [],
    salidasEnTransito: [{ id: 1, folio: 1, enviadaAt: new Date().toISOString(), horasEnTransito: 25, origenId: 1, nombreOrigen: "A", destinoId: 2, nombreDestino: "B" }],
    ventasAutorizadasSinEntregar: [{ ticketId: 9, ticketFolio: 1009, salidaId: 4, salidaFolio: 4, horasSinEntregar: 25, ticketHref: "/tickets/9", salidaHref: "/salidas/4" }],
  });
});