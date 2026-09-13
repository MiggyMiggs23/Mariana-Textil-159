import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolveDocument } from "./lib/kardex-document";

const source = readFileSync(new URL("./lib/kardex.ts", import.meta.url), "utf8");
const documentSource = readFileSync(new URL("./lib/kardex-document.ts", import.meta.url), "utf8");
const salidas = readFileSync(new URL("./lib/salidas.ts", import.meta.url), "utf8");
const page = readFileSync(new URL("../../mariana-textil/src/pages/movimientos.tsx", import.meta.url), "utf8");

test("existing movement document resolver links both sale document types", () => {
  for (const tipo of [
    "TICKET",
    "NOTA",
    "TICKET_BOLSA_NORMAL",
    "TICKET_PIEZA_NORMAL",
    "TICKET_BOLSA_METREADO",
  ]) {
    assert.deepEqual(resolveDocument({ tipo, id: "42" }, new Map(), new Map([[42, 123]]), new Map()), {
      label: `${tipo === "NOTA" ? "Nota" : "Ticket"} 123`,
      route: "/tickets/42",
    });
  }
  assert.deepEqual(resolveDocument({ tipo: "NOTA", id: "99" }, new Map(), new Map(), new Map()), { label: null, route: null });
});

test("note IDs are loaded and searchable, and the sale writer supplies traceability fields", () => {
  for (const tipo of [
    "TICKET",
    "NOTA",
    "TICKET_BOLSA_NORMAL",
    "TICKET_PIEZA_NORMAL",
    "TICKET_BOLSA_METREADO",
  ]) {
    assert.match(documentSource, new RegExp(`"${tipo}"`));
  }
  assert.match(documentSource, /TICKET_DOCUMENT_TYPES = \[[\s\S]*TICKET_BOLSA_METREADO/);
  assert.match(source, /ticketDocumentTypesSql = sql\.join/);
  assert.match(source, /\.filter\(\(reference\) => isTicketDocumentType\(reference\.tipo\) && reference\.id\)/);
  assert.match(source, /const referencedTicketId =\s*isTicketDocumentType\(reference\.tipo\)/);
  assert.match(salidas, /if \(!ticket\)[\s\S]*TICKET_NOT_FOUND/);
  assert.match(salidas, /documentoTipo: ticket\.documentoTipo, documentoId: String\(ticketId\), salidaId: r\.salidaId/);
  assert.equal((page.match(/row\.documentoRuta \?/g) ?? []).length, 2, "desktop and mobile use the enriched document route");
});