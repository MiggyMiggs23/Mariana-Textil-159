import assert from "node:assert/strict";
import test from "node:test";
import {
  IVA_RATE_BASIS_POINTS,
  breakdownIvaIncluded,
} from "./iva";

test("desglosa IVA incluido en centavos y recompone el importe exacto", () => {
  assert.equal(IVA_RATE_BASIS_POINTS, 1600);
  const breakdown = breakdownIvaIncluded(1_160_000);
  assert.deepEqual(breakdown, { subtotalCents: 1_000_000, ivaCents: 160_000 });
  assert.equal(breakdown.subtotalCents + breakdown.ivaCents, 1_160_000);
});

test("el redondeo del desglose nunca cambia un centavo del importe", () => {
  for (const cents of [1, 2, 99, 100, 101, 11_601]) {
    const breakdown = breakdownIvaIncluded(cents);
    assert.equal(breakdown.subtotalCents + breakdown.ivaCents, cents);
  }
});