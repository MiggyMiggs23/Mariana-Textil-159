import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Router } from "wouter";
import { loadRenderTestModule } from "../render-test-bundle";

const {
  CorteTicketFolioLink,
  RolloSerieLink,
  CarteraMovementLink,
  CarteraTicketFolioLink,
  AlertaCreditoTicketLink,
  NotaAplicacionFolioLink,
  isNormalNotaAplicacionClick,
  handleNotaAplicacionClick,
} = await loadRenderTestModule(`
  export { CorteTicketFolioLink } from ${JSON.stringify(
    new URL("./corte-detail-shared.tsx", import.meta.url).pathname,
  )};
  export { RolloSerieLink } from ${JSON.stringify(
    new URL("./ticket-detail.tsx", import.meta.url).pathname,
  )};
  export { CarteraMovementLink, CarteraTicketFolioLink } from ${JSON.stringify(
    new URL("./cobros.tsx", import.meta.url).pathname,
  )};
  export { AlertaCreditoTicketLink } from ${JSON.stringify(
    new URL("./alertas.tsx", import.meta.url).pathname,
  )};
  export {
    NotaAplicacionFolioLink,
    isNormalNotaAplicacionClick,
    handleNotaAplicacionClick,
  } from ${JSON.stringify(
    new URL("../components/cliente-nota-credito.tsx", import.meta.url).pathname,
  )};
`);

function renderInRouter(element: React.ReactElement) {
  return renderToStaticMarkup(
    React.createElement(Router, { ssrPath: "/" }, element),
  );
}

test("detail links use real IDs when displayed folios differ", () => {
  const html = renderInRouter(
    React.createElement(
      React.Fragment,
      null,
      React.createElement(CorteTicketFolioLink, { ticketId: 9427, folio: 12002 }),
      React.createElement(RolloSerieLink, { rolloId: 77, serie: "SERIE-77" }),
      React.createElement(NotaAplicacionFolioLink, { ticketId: 8080, folio: 42 }),
      React.createElement(CarteraTicketFolioLink, { ticketId: 6500, ticketFolio: 99 }),
      React.createElement(CarteraMovementLink, { clienteId: 21, movimientoId: 313 }),
      React.createElement(AlertaCreditoTicketLink, { ticketId: 7300, label: "Folio 18" }),
    ),
  );

  assert.match(html, /href="\/tickets\/9427"[^>]*>F-12002<\/a>/);
  assert.match(html, /href="\/inventario\/rollos\/77"[^>]*>SERIE-77<\/a>/);
  assert.match(html, /href="\/tickets\/8080"[^>]*>#42<\/a>/);
  assert.match(html, /href="\/tickets\/6500"[^>]*>#99<\/a>/);
  assert.match(html, /href="\/clientes\/21\?tab=estado&amp;movimientoId=313"/);
  assert.match(html, /href="\/tickets\/7300"[^>]*>Folio 18<\/a>/);
  assert.doesNotMatch(html, /href="\/tickets\/12002"/);
  assert.doesNotMatch(html, /href="\/tickets\/42"/);
  assert.doesNotMatch(html, /href="\/tickets\/99"/);
  assert.doesNotMatch(html, /href="\/tickets\/18"/);
});

test("nullable identity fields remain visible but unlinked", () => {
  const html = renderInRouter(
    React.createElement(
      React.Fragment,
      null,
      React.createElement(RolloSerieLink, { rolloId: null, serie: "SERIE-SIN-ID" }),
      React.createElement(NotaAplicacionFolioLink, { ticketId: null, folio: 42 }),
      React.createElement(CarteraTicketFolioLink, { ticketId: 6500, ticketFolio: null }),
      React.createElement(AlertaCreditoTicketLink, { ticketId: null, label: "Movimiento sin folio" }),
    ),
  );

  assert.match(html, /SERIE-SIN-ID/);
  assert.match(html, /#42/);
  assert.match(html, />—<\/a>/);
  assert.match(html, /Movimiento sin folio/);
  assert.doesNotMatch(html, /inventario\/rollos/);
  assert.doesNotMatch(html, /href="\/tickets\/42"/);
  assert.doesNotMatch(html, /href="\/tickets\/null"/);
});

test("the note link closes only for an unmodified primary click", () => {
  const baseEvent = {
    button: 0,
    defaultPrevented: false,
    metaKey: false,
    ctrlKey: false,
    shiftKey: false,
    altKey: false,
    currentTarget: { target: "" },
  };

  assert.equal(isNormalNotaAplicacionClick(baseEvent), true);
  assert.equal(isNormalNotaAplicacionClick({ ...baseEvent, ctrlKey: true }), false);
  assert.equal(isNormalNotaAplicacionClick({ ...baseEvent, metaKey: true }), false);
  assert.equal(isNormalNotaAplicacionClick({ ...baseEvent, shiftKey: true }), false);
  assert.equal(isNormalNotaAplicacionClick({ ...baseEvent, button: 1 }), false);
  assert.equal(
    isNormalNotaAplicacionClick({ ...baseEvent, currentTarget: { target: "_blank" } }),
    false,
  );

  let callbackCount = 0;
  const onNavigate = () => {
    callbackCount += 1;
  };
  handleNotaAplicacionClick(baseEvent, onNavigate);
  handleNotaAplicacionClick({ ...baseEvent, ctrlKey: true }, onNavigate);
  handleNotaAplicacionClick({ ...baseEvent, metaKey: true }, onNavigate);
  assert.equal(callbackCount, 1);
});