import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  GetCurrentUserResponse,
  ListarTicketsCajaResponse,
  ObtenerSesionCajaActualResponse,
} from "@workspace/api-zod";
import { withBrowserFixture } from "../observable-test/browser";

const grupo1CurrentUser = GetCurrentUserResponse.parse({
  id: 41,
  nombre: "Caja Mariana",
  usuario: "caja.mariana",
  rol: "CAJA",
  ubicacion: {
    id: 1,
    nombre: "Mariana",
    iniciales: "MA",
    tipo: "TIENDA",
    activa: true,
    esSistema: false,
  },
  alcanceConsulta: "PROPIA",
  permisos: [{ modulo: "cortes", puedeVer: false, puedeCrear: false, puedeEditar: false, puedeAutorizar: false }],
});
const grupo1Session = ObtenerSesionCajaActualResponse.parse({
  sesion: {
    id: 71,
    ubicacionId: 1,
    nombreUbicacion: "Mariana",
    usuarioId: 41,
    nombreUsuario: "Caja Mariana",
    abiertaAt: "2026-10-02T14:00:00.000Z",
    cerradaAt: null,
    fondoInicial: "100.00",
    efectivoContado: null,
    estado: "ABIERTA",
  },
  resumen: { ticketsCobrados: 0, documentosPendientes: 3, totalCobrado: "0.00", efectivoEsperado: "100.00" },
});
const grupo1Tickets = ListarTicketsCajaResponse.parse([
  { id: 701, folio: 901, subtotal: "100.00", iva: "16.00", tasaIva: "16", total: "116.00", facturado: true, createdAt: "2026-10-02T15:00:00.000Z", cobrado: false, cobradoAt: null, documentoTipo: "TICKET", autorizacionEstado: "NO_APLICA", autorizadoAt: null, formasPago: [] },
  { id: 702, folio: 902, subtotal: "100.00", iva: "16.00", tasaIva: "16", total: "116.00", facturado: false, createdAt: "2026-10-02T15:01:00.000Z", cobrado: false, cobradoAt: null, documentoTipo: "NOTA", autorizacionEstado: "PENDIENTE", autorizadoAt: null, formasPago: [] },
  { id: 703, folio: 903, subtotal: "100.00", iva: "16.00", tasaIva: "16", total: "116.00", facturado: false, createdAt: "2026-10-02T15:02:00.000Z", cobrado: false, cobradoAt: null, documentoTipo: "TICKET", autorizacionEstado: "NO_APLICA", autorizadoAt: null, formasPago: [] },
]);

test("primary collection offers only equal-width cash and transfer controls", () => {
  const source = readFileSync(new URL("./cobros.tsx", import.meta.url), "utf8");
  const primary = source.slice(
    source.indexOf("Forma de Pago Principal"),
    source.indexOf("Dividir pago en múltiples formas"),
  );

  assert.doesNotMatch(source, /disabled=\{hasMetreadoLine \|\| !ticket\.esCredito\}/);
  assert.doesNotMatch(source, /FormaPagoTicket\.CREDITO/);
  assert.match(primary, /grid-cols-1 sm:grid-cols-2/);
  assert.match(primary, /FormaPagoTicket\.EFECTIVO/);
  assert.match(primary, /disabled=\{hasMetreadoLine\}[\s\S]*FormaPagoTicket\.TRANSFERENCIA/);
  assert.doesNotMatch(primary, /FormaPagoTicket\.FACTURADO|>Facturado</);
});

test("split payments offer only cash and transfer while metreado remains cash-only", () => {
  const source = readFileSync(new URL("./cobros.tsx", import.meta.url), "utf8");
  const split = source.slice(source.indexOf("Desglose de Pago"), source.indexOf("Agregar otra forma"));
  assert.match(split, /FormaPagoTicket\.EFECTIVO/);
  assert.match(split, /!hasMetreadoLine[\s\S]*FormaPagoTicket\.TRANSFERENCIA/);
  assert.doesNotMatch(split, /FormaPagoTicket\.FACTURADO|>Facturado</);
  assert.doesNotMatch(split, /ticket\.esCredito/);
});

test("invoice status comes only from the ticket and never changes the payment amount", () => {
  const source = readFileSync(new URL("./cobros.tsx", import.meta.url), "utf8");
  assert.match(source, /const facturadoSeleccionado = ticket\?\.facturado === true;/);
  assert.match(source, /const totalTicket = ticket \? Number\(ticket\.total \|\| 0\) : 0;/);
  assert.match(source, /importe: ticket \? Number\(ticket\.total\)\.toFixed\(2\) : "0"/);
  assert.doesNotMatch(source, /pago\.formaPago === FormaPagoTicket\.FACTURADO/);
  assert.doesNotMatch(source, /formaPago === FormaPagoTicket\.FACTURADO/);
});

test("invoiced sales are emphasized without changing the normal document label", async () => {
  const cobrosPath = new URL("./cobros.tsx", import.meta.url).pathname;
  await withBrowserFixture({
    entrySource: `
      import React from "react";
      import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
      import { LocationScopeProvider } from ${JSON.stringify(new URL("../lib/location-scope.tsx", import.meta.url).pathname)};
      import CobrosPage from ${JSON.stringify(cobrosPath)};
      import {
        getGetCurrentUserQueryKey,
        getObtenerSesionCajaActualQueryKey,
        getListarTicketsCajaQueryKey,
      } from "@workspace/api-client-react";
      const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
      client.setQueryData(getGetCurrentUserQueryKey(), ${JSON.stringify(grupo1CurrentUser)});
      client.setQueryData(getObtenerSesionCajaActualQueryKey({ ubicacionId: 1 }), ${JSON.stringify(grupo1Session)});
      client.setQueryData(getListarTicketsCajaQueryKey({ ubicacionId: 1 }), ${JSON.stringify(grupo1Tickets)});
      export default function Fixture() {
        return <QueryClientProvider client={client}><LocationScopeProvider><CobrosPage /></LocationScopeProvider></QueryClientProvider>;
      }
    `,
  }, async (page) => {
    await page.waitFor(`Array.from(document.querySelectorAll("span")).some((node) => node.textContent?.trim() === "VENTA FACTURADA folio 901")`);
    const presentation = await page.evaluate<{
      labels: string[];
      invoiceColor: string;
    }>(`(() => {
      const labels = Array.from(document.querySelectorAll("span"))
        .map((node) => node.textContent?.trim() ?? "")
        .filter((text) => ["VENTA FACTURADA folio 901", "Nota folio 902", "Ticket folio 903"].includes(text));
      const invoice = Array.from(document.querySelectorAll("span"))
        .find((node) => node.textContent?.trim() === "VENTA FACTURADA folio 901");
      return { labels, invoiceColor: invoice ? getComputedStyle(invoice).color : "" };
    })()`);

    assert.deepEqual(
      presentation.labels,
      ["VENTA FACTURADA folio 901", "Nota folio 902", "Ticket folio 903"],
      "the displayed label follows the persisted document type only for non-invoiced sales",
    );
    assert.equal(presentation.invoiceColor, "oklch(0.577 0.245 27.325)", "the invoiced sale is visibly red");
    assert.doesNotMatch(presentation.labels[0], /\b(?:Ticket|Nota)\b/, "an invoiced label does not masquerade as a normal document");
  });
});