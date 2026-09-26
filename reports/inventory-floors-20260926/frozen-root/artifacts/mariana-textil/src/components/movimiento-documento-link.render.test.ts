import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Router } from "wouter";
import { loadRenderTestModule } from "../render-test-bundle";

const {
  MovimientoDocumento,
  MovimientoDocumentoFallback,
  MovimientoDocumentoLink,
} = await loadRenderTestModule(`
  export {
    MovimientoDocumento,
    MovimientoDocumentoFallback,
    MovimientoDocumentoLink,
  } from ${JSON.stringify(
    new URL("./movimiento-documento-link.tsx", import.meta.url).pathname,
  )};
`);

function renderInRouter(element: React.ReactElement) {
  return renderToStaticMarkup(
    React.createElement(Router, { ssrPath: "/" }, element),
  );
}

test("document links use the resolved primary-key route, not the displayed folio", () => {
  const html = renderInRouter(
    React.createElement(MovimientoDocumentoLink, {
      movimiento: {
        documentoRuta: "/tickets/7001",
        documentoEtiqueta: "Ticket 42",
        documentoTipo: "TICKET",
        documentoId: "42",
      },
    }),
  );

  assert.match(html, /href="\/tickets\/7001"/);
  assert.match(html, />Ticket 42</);
  assert.doesNotMatch(html, /href="\/tickets\/42"/);
});

test("a null route is explicit and never rebuilt from a document id", () => {
  const html = renderInRouter(
    React.createElement(MovimientoDocumento, {
      movimiento: {
        documentoRuta: null,
        documentoEtiqueta: null,
        documentoTipo: "NOTA",
        documentoId: "99",
      },
    }),
  );

  assert.match(html, /Referencia no resuelta/);
  assert.doesNotMatch(html, /href=/);
  // Preserve the original reference as text, never as a navigable identity.
  assert.match(html, /NOTA 99/);
});

test("a movement without any document reference remains an unlinked label", () => {
  const html = renderInRouter(
    React.createElement(MovimientoDocumentoFallback, {
      movimiento: {
        documentoRuta: null,
        documentoEtiqueta: null,
        documentoTipo: null,
        documentoId: null,
      },
      compact: true,
    }),
  );

  assert.match(html, />Sin doc</);
  assert.doesNotMatch(html, /href=/);
});