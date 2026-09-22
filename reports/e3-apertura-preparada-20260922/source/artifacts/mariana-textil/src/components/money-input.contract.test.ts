import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  formatMoneyInput,
  moneyCaretPosition,
  normalizeMoneyInput,
} from "./money-input";

test("money input formats Mexican thousands separators while preserving decimals", () => {
  assert.equal(formatMoneyInput(normalizeMoneyInput("125000")), "125,000");
  assert.equal(formatMoneyInput(normalizeMoneyInput("1250.5")), "1,250.5");
  assert.equal(formatMoneyInput(normalizeMoneyInput("1250.50")), "1,250.50");
  assert.equal(formatMoneyInput(normalizeMoneyInput("1250.")), "1,250.");
});

test("money input accepts pasted grouped and ungrouped values equivalently", () => {
  assert.equal(normalizeMoneyInput("125,000.00"), "125000.00");
  assert.equal(normalizeMoneyInput("125000.00"), "125000.00");
});

test("money input rejects negatives, invalid characters, and a third decimal", () => {
  assert.equal(normalizeMoneyInput("-1", "25"), "25");
  assert.equal(normalizeMoneyInput("12a", "12"), "12");
  assert.equal(normalizeMoneyInput("1.234", "1.23"), "1.23");
});

test("money input keeps the caret beside a digit inserted in the middle", () => {
  const browserValue = "1295,000";
  const canonicalValue = normalizeMoneyInput(browserValue, "125000");
  const formattedValue = formatMoneyInput(canonicalValue);

  assert.equal(formattedValue, "1,295,000");
  assert.equal(moneyCaretPosition(browserValue, 3, formattedValue), 4);
  assert.equal(formattedValue.slice(0, 4), "1,29");
});

test("money input keeps the caret after a leading decimal and never returns a negative position", () => {
  assert.equal(moneyCaretPosition(".", 1, "0."), 2);
  assert.equal(moneyCaretPosition("", 0, "0.5"), 0);
});

test("all three payment dialogs reuse the formatted input and keep numeric payloads", async () => {
  const sharedInput = await readFile(new URL("money-input.tsx", import.meta.url), "utf8");
  const files = [
    "proveedor-pago-dialog.tsx",
    "cliente-pago-dialog.tsx",
    "solicitud-pago-dirigido-dialog.tsx",
  ];

  assert.match(sharedInput, /type="text"/);
  assert.match(sharedInput, /inputMode="decimal"/);
  assert.match(sharedInput, /requestAnimationFrame/);
  assert.match(sharedInput, /setSelectionRange\(nextCaret, nextCaret\)/);

  for (const file of files) {
    const source = await readFile(new URL(file, import.meta.url), "utf8");
    assert.match(source, /<MoneyInput/);
    assert.match(source, /importe:\s*Number\(amount\)/);
    assert.doesNotMatch(
      source,
      /<Input[\s\S]{0,180}type="number"[\s\S]{0,180}(Importe|amount)/,
    );
  }
});