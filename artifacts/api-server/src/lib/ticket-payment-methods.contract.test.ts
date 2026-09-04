import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const pos = readFileSync(new URL("./pos.ts", import.meta.url), "utf8");
const spec = readFileSync(new URL("../../../../lib/api-spec/openapi.yaml", import.meta.url), "utf8");

test("ticket collection contract retains historical credit but rejects it for new charges", () => {
  assert.match(spec, /FormaPagoTicket:[\s\S]*enum: \[EFECTIVO, TRANSFERENCIA, FACTURADO, CREDITO\]/);
  assert.match(pos, /pago\.formaPago === "CREDITO"[\s\S]*TICKET_CREDIT_PAYMENT_FORBIDDEN/);
});

test("credit issuance is notes-only while metreado stays cash-only", () => {
  assert.match(pos, /credito && documentoTipo !== "NOTA"[\s\S]*TICKET_CREDIT_FORBIDDEN/);
  assert.match(pos, /metreado && pagos\.some\(\(pago\) => pago\.formaPago !== "EFECTIVO"\)/);
});