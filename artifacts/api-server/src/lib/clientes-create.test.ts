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

test("a credit limit may be saved without a habitual term", () => {
  const result = parseClientCreditTerms("1000", undefined);
  assert.deepEqual(result, {
    ok: true,
    limiteCredito: "1000.00",
    diasCredito: 0,
  });
});

test("valid supplied credit terms are normalized", () => {
  assert.deepEqual(parseClientCreditTerms("1000.5", 30), {
    ok: true,
    limiteCredito: "1000.50",
    diasCredito: 30,
  });
});

test("only the optional zero value and supported habitual terms are accepted", () => {
  for (const term of [0, 7, 15, 30, 60]) {
    assert.equal(parseClientCreditTerms(undefined, term).ok, true);
  }
  for (const term of [-1, 1, 14, 31, 90, 7.5, "30"]) {
    const result = parseClientCreditTerms(undefined, term);
    assert.equal(result.ok, false);
    if (!result.ok) assert.match(result.error, /0, 7, 15, 30 o 60/);
  }
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