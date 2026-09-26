import assert from "node:assert/strict";
import { test } from "node:test";
import {
  allowedCreditTerm,
  creditTermOnSelectionChange,
} from "./credit-terms";

test("habitual credit prefill accepts only supported non-zero terms", () => {
  for (const term of [7, 15, 30, 60]) {
    assert.equal(allowedCreditTerm(term), term);
  }
  for (const value of [undefined, null, 0, -1, 1, 14, 90, "30"]) {
    assert.equal(allowedCreditTerm(value), null);
  }
});

test("habitual term is applied once per credit activation and remains overridable", () => {
  assert.equal(creditTermOnSelectionChange(false, true, null, 30), 30);
  assert.equal(creditTermOnSelectionChange(true, true, 15, 30), 15);
  assert.equal(creditTermOnSelectionChange(true, false, 15, 30), null);
  assert.equal(creditTermOnSelectionChange(false, true, null, 30), 30);
});

test("credit activation without a habitual term requires an explicit choice", () => {
  assert.equal(creditTermOnSelectionChange(false, true, null, 0), null);
  assert.equal(creditTermOnSelectionChange(false, true, null, undefined), null);
});