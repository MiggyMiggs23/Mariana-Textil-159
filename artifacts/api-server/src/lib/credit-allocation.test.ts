import assert from "node:assert/strict";
import test from "node:test";
import { allocateCreditFifo, isValidPaymentDestination } from "./credit-allocation";

const at = (day: number) => new Date(`2026-01-0${day}T00:00:00.000Z`);

test("allocates 4200+3500+2300 strictly by credit-sale FIFO", () => {
  const result = allocateCreditFifo(
    [{ id: 10, availableCents: 10_000 }],
    [
      { id: 1, balanceCents: 4200, createdAt: at(1) },
      { id: 2, balanceCents: 3500, createdAt: at(2) },
      { id: 3, balanceCents: 2300, createdAt: at(3) },
    ],
  );
  assert.deepEqual(result.allocations.map((item) => [item.targetId, item.appliedCents]), [[1, 4200], [2, 3500], [3, 2300]]);
  assert.equal(result.remainingCents, 0);
});

test("preserves excess payment as available credit", () => {
  const result = allocateCreditFifo(
    [{ id: 10, availableCents: 5000 }],
    [{ id: 1, balanceCents: 4200, createdAt: at(1) }],
  );
  assert.equal(result.allocations[0]?.appliedCents, 4200);
  assert.equal(result.remainingCents, 800);
});

test("a later sale consumes historic remaining abono, not a directed ticket", () => {
  const result = allocateCreditFifo(
    [{ id: 10, availableCents: 800 }],
    [{ id: 99, balanceCents: 800, createdAt: at(3) }],
  );
  assert.deepEqual(result.allocations.map((item) => [item.sourceId, item.targetId, item.appliedCents]), [[10, 99, 800]]);
  assert.equal(result.remainingCents, 0);
});

test("linked reduction cancels its target before FIFO allocation", () => {
  const result = allocateCreditFifo(
    [{ id: 10, availableCents: 2500 }],
    [
      { id: 1, balanceCents: 10_000, createdAt: at(1) },
      {
        id: 2,
        balanceCents: 8_000,
        linkedReductionCents: 8_000,
        createdAt: at(2),
      },
    ],
  );
  assert.deepEqual(result.balances, [
    { targetId: 1, balanceBeforeCents: 10_000, balanceAfterCents: 7_500 },
    { targetId: 2, balanceBeforeCents: 0, balanceAfterCents: 0 },
  ]);
});

test("validates payment destination against its payment method", () => {
  assert.equal(isValidPaymentDestination("EFECTIVO", "CAJA_FISICA"), true);
  assert.equal(isValidPaymentDestination("TRANSFERENCIA", "CUENTA_FISCAL"), true);
  assert.equal(isValidPaymentDestination("TRANSFERENCIA", "CUENTA_NO_FISCAL"), true);
  assert.equal(isValidPaymentDestination("EFECTIVO", "CUENTA_FISCAL"), false);
  assert.equal(isValidPaymentDestination("TRANSFERENCIA", "CAJA_FISICA"), false);
});