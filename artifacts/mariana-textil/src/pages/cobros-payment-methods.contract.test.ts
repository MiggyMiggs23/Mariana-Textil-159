import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("./cobros.tsx", import.meta.url), "utf8");

test("normal tickets offer all three collection methods without esCredito inversion", () => {
  assert.doesNotMatch(source, /disabled=\{hasMetreadoLine \|\| !ticket\.esCredito\}/);
  assert.doesNotMatch(source, /FormaPagoTicket\.CREDITO/);
  assert.match(source, /FormaPagoTicket\.EFECTIVO/);
  assert.match(source, /disabled=\{hasMetreadoLine\}[\s\S]*FormaPagoTicket\.TRANSFERENCIA/);
  assert.match(source, /FormaPagoTicket\.FACTURADO/);
  assert.match(source, />Facturado</);
});

test("split payments offer the same methods and metreado remains cash-only", () => {
  const split = source.slice(source.indexOf("Desglose de Pago"), source.indexOf("Agregar otra forma"));
  assert.match(split, /FormaPagoTicket\.EFECTIVO/);
  assert.match(split, /!hasMetreadoLine[\s\S]*FormaPagoTicket\.TRANSFERENCIA[\s\S]*FormaPagoTicket\.FACTURADO/);
  assert.doesNotMatch(split, /ticket\.esCredito/);
});