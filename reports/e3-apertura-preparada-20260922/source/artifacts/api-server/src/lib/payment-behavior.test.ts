import assert from "node:assert/strict";
import test from "node:test";
import {
  PAYMENT_BEHAVIOR_MIN_SETTLED_NOTES,
  projectPaymentBehavior,
} from "./payment-behavior";

const movement = (id: number, tipo: "VENTA_CREDITO" | "ABONO", importe: number, createdAt: string, extra = {}) => ({
  id, ticketId: tipo === "VENTA_CREDITO" ? id : null, tipo, importe,
  createdAt: new Date(`${createdAt}T12:00:00Z`), ...extra,
});

test("payment on due date is on time and every note has equal weight", () => {
  const rows = [
    movement(1, "VENTA_CREDITO", 100, "2026-01-01", { fechaVencimiento: "2026-01-10" }),
    movement(2, "ABONO", -100, "2026-01-10"),
    movement(3, "VENTA_CREDITO", 100000, "2026-01-11", { fechaVencimiento: "2026-01-20" }),
    movement(4, "ABONO", -100000, "2026-01-21"),
  ];
  const result = projectPaymentBehavior(rows, 200000, new Date("2026-02-01T12:00:00Z"));
  assert.equal(result.percentage, 50);
  assert.equal(result.settledNotes, 2);
  assert.equal(result.color, "INSUFFICIENT");
});

test("overdue unpaid counts late while open not-yet-due is excluded", () => {
  const rows = [
    movement(1, "VENTA_CREDITO", 100, "2026-01-01", { fechaVencimiento: "2026-01-10" }),
    movement(2, "VENTA_CREDITO", 100, "2026-01-10", { fechaVencimiento: "2026-03-10" }),
  ];
  const result = projectPaymentBehavior(rows, 1000, new Date("2026-02-01T12:00:00Z"));
  assert.equal(result.evaluatedNotes, 1);
  assert.equal(result.overdueOpenNotes, 1);
  assert.equal(result.openNotDueNotes, 1);
});

test("effective payment date uses the Mexico City day near UTC midnight", () => {
  const rows = [
    movement(1, "VENTA_CREDITO", 100, "2026-01-01", { fechaVencimiento: "2026-01-10" }),
    { ...movement(2, "ABONO", -100, "2026-01-11"), createdAt: new Date("2026-01-11T00:30:00Z") },
  ];
  const result = projectPaymentBehavior(rows, 1000, new Date("2026-02-01T12:00:00Z"));
  // 00:30Z is still Jan 10 in Mexico City and must settle on time.
  assert.equal(result.onTimeNotes, 1);
});

test("credit suggestion requires green, sufficient history, utilization and no overdue", () => {
  const rows = Array.from({ length: PAYMENT_BEHAVIOR_MIN_SETTLED_NOTES }, (_, index) => [
    movement(index * 2 + 1, "VENTA_CREDITO", 100, "2026-01-01", { fechaVencimiento: "2026-01-10" }),
    movement(index * 2 + 2, "ABONO", -100, "2026-01-10"),
  ]).flat();
  const result = projectPaymentBehavior(rows, 1000, new Date("2026-02-01T12:00:00Z"));
  assert.equal(result.color, "GREEN");
  assert.equal(result.suggestCreditIncrease, false);
});