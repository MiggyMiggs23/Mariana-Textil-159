import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("./cobros.tsx", import.meta.url), "utf8");

test("primary collection offers only equal-width cash and transfer controls", () => {
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
  const split = source.slice(source.indexOf("Desglose de Pago"), source.indexOf("Agregar otra forma"));
  assert.match(split, /FormaPagoTicket\.EFECTIVO/);
  assert.match(split, /!hasMetreadoLine[\s\S]*FormaPagoTicket\.TRANSFERENCIA/);
  assert.doesNotMatch(split, /FormaPagoTicket\.FACTURADO|>Facturado</);
  assert.doesNotMatch(split, /ticket\.esCredito/);
});

test("invoice status comes only from the ticket and never changes the payment amount", () => {
  assert.match(source, /const facturadoSeleccionado = ticket\?\.facturado === true;/);
  assert.match(source, /const totalTicket = ticket \? Number\(ticket\.total \|\| 0\) : 0;/);
  assert.match(source, /importe: ticket \? Number\(ticket\.total\)\.toFixed\(2\) : "0"/);
  assert.doesNotMatch(source, /pago\.formaPago === FormaPagoTicket\.FACTURADO/);
  assert.doesNotMatch(source, /formaPago === FormaPagoTicket\.FACTURADO/);
});

test("invoiced sales are emphasized without changing the normal document label", () => {
  assert.match(source, /t\.facturado \? \(/);
  assert.match(source, /El rojo identifica una venta que lleva factura; no representa un error\./);
  assert.match(source, /className="text-2xl font-bold text-red-600"/);
  assert.match(source, /VENTA FACTURADA folio \{formatNumber\(t\.folio/);
  assert.match(
    source,
    /\{t\.documentoTipo === "NOTA" \? "Nota" : "Ticket"\} folio \{formatNumber\(t\.folio/,
  );
});