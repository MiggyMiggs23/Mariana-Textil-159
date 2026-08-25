import assert from "node:assert/strict";
import { test } from "node:test";
import {
  ACTIVE_CLIENT_NAME_UNIQUE_INDEX,
  isActiveNonSystemNameConflict,
  normalizedClientName,
  parseClientCreditTerms,
} from "./clientes-create";

test("a client without supplied terms is created without authorized credit", () => {
  assert.deepEqual(parseClientCreditTerms(undefined, undefined), {
    ok: true,
    limiteCredito: "0.00",
    diasCredito: 0,
  });
});

test("credit days are required when a limit is supplied", () => {
  const result = parseClientCreditTerms("1000", undefined);
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.error, /días de crédito son obligatorios/i);
});

test("valid supplied credit terms are normalized", () => {
  assert.deepEqual(parseClientCreditTerms("1000.5", 30), {
    ok: true,
    limiteCredito: "1000.50",
    diasCredito: 30,
  });
});

test("active non-system names use a trimmed, case-insensitive key", () => {
  assert.equal(normalizedClientName("  Textiles Águila  "), "textiles águila");
  assert.equal(
    normalizedClientName("TEXTILES ÁGUILA"),
    normalizedClientName(" textiles águila "),
  );
});

test("a unique-index result from concurrent creates is recognized as a name conflict", () => {
  assert.equal(
    isActiveNonSystemNameConflict({
      code: "23505",
      constraint: ACTIVE_CLIENT_NAME_UNIQUE_INDEX,
    }),
    true,
  );
  assert.equal(
    isActiveNonSystemNameConflict({ code: "23505", constraint: "other_index" }),
    false,
  );
});