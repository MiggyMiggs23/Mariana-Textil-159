import { test } from "node:test";
import assert from "node:assert/strict";
import { calculateCommercialReturn, COMMERCIAL_RETURNS_ENABLED, type CommercialReturnMoneyInput } from "./commercial-return-contract";
import { projectCreditLedger, type CreditLedgerMovement } from "./credit-allocation";

const money: CommercialReturnMoneyInput = {
  subtotal: "1000.00", iva: "0.00", total: "1000.00",
  lineAmounts: ["400.00", "600.00"], returnedLineAmount: "400.00",
  remainingTotal: "1000.00", pendingDebt: "200.00", paidMoney: "800.00",
  correctionFunded: false,
};
test("commercial capture remains CLOSED", () => assert.equal(COMMERCIAL_RETURNS_ENABLED, false));
test("owner's single-roll example and exact multiroll ratio", () => {
  assert.deepEqual(calculateCommercialReturn(money), {
    importeRollo: "400.00", deudaCancelada: "80.00", efectivoDevuelto: "320.00",
  });
  assert.deepEqual(calculateCommercialReturn({ ...money, lineAmounts: ["1000.00"], returnedLineAmount: "1000.00" }), {
    importeRollo: "1000.00", deudaCancelada: "200.00", efectivoDevuelto: "800.00",
  });
});
test("single-roll tax and paid/unpaid endpoints are exact", () => {
  for (const paid of ["0.00", "1160.00"]) {
    const pending = paid === "0.00" ? "1160.00" : "0.00";
    assert.deepEqual(calculateCommercialReturn({ ...money, iva: "160.00", total: "1160.00",
      lineAmounts: ["1000.00"], returnedLineAmount: "1000.00",
      remainingTotal: "1160.00", pendingDebt: pending, paidMoney: paid }), {
      importeRollo: "1160.00", deudaCancelada: pending, efectivoDevuelto: paid,
    });
  }
});
test("fractional paid ratio and fractional line tax STOP rather than rounding", () => {
  assert.throws(() => calculateCommercialReturn({ ...money,
    subtotal: "3.00", total: "3.00", lineAmounts: ["1.00", "1.00", "1.00"],
    returnedLineAmount: "1.00", remainingTotal: "3.00", pendingDebt: "2.99", paidMoney: "0.01",
  }), /fracciones de centavo/);
  assert.throws(() => calculateCommercialReturn({ ...money, iva: "0.01", total: "1000.01",
    remainingTotal: "1000.01", pendingDebt: "200.01" }), /fracciones de centavo/);
});
test("correction-funded and unreconciled histories are explicit blockers", () => {
  assert.throws(() => calculateCommercialReturn({ ...money, correctionFunded: true }), /corrección contable/);
  assert.throws(() => calculateCommercialReturn({ ...money, total: "999.99" }), /no concilian/);
  assert.throws(() => calculateCommercialReturn({ ...money, paidMoney: "799.99" }), /no concilian/);
  assert.throws(() => calculateCommercialReturn({ ...money, subtotal: "NaN" }), /decimal exacto/);
});
test("successive returns use remaining merchandise without double-refunding earlier money", () => {
  assert.deepEqual(calculateCommercialReturn({ ...money, returnedLineAmount: "600.00",
    remainingTotal: "600.00", pendingDebt: "120.00", paidMoney: "480.00" }), {
    importeRollo: "600.00", deudaCancelada: "120.00", efectivoDevuelto: "480.00",
  });
});
function movement(id: number, tipo: CreditLedgerMovement["tipo"], importe: string, ticketId: number | null,
  movimientoOrigenId?: number): CreditLedgerMovement {
  return { id, tipo, importe, ticketId, movimientoOrigenId, createdAt: new Date(Date.UTC(2026, 8, id)) };
}
const history = [
  movement(1, "VENTA_CREDITO", "1000.00", 10),
  movement(2, "ABONO", "-800.00", null),
  movement(3, "DEVOLUCION_COMERCIAL", "-200.00", 10, 1),
];
test("new targeted event consumes debt without releasing paid money or becoming a receipt", () => {
  const result = projectCreditLedger(history, { includeMovementProjections: true, includeAllocationTraces: true });
  assert.equal(result.balanceCents, 0);
  assert.equal(result.overpaymentCents, 0);
  assert.deepEqual(result.allocations.map(a => [a.sourceId, a.targetId, a.appliedCents]), [[2, 1, 80000]]);
  assert.deepEqual(result.overpaymentSources.map(s => s.movementId), [2]);
  assert.deepEqual(result.movementProjections.map(p => p.saldoDeudorProyectadoCents), [100000, 20000, 0]);
});
test("later receipts settle other debt; returns do not silently move old payments", () => {
  const p = projectCreditLedger([...history, movement(4, "VENTA_CREDITO", "400.00", 20), movement(5, "ABONO", "-100.00", null)]);
  assert.equal(p.balanceCents, 30000);
  assert.equal(p.overpaymentCents, 0);
  assert.deepEqual(p.allocations.map(a => [a.sourceId, a.targetId, a.appliedCents]), [[2, 1, 80000], [5, 4, 10000]]);
});
test("over-cancellation and wrong note linkage never degrade to global favor", () => {
  assert.throws(() => projectCreditLedger([...history.slice(0, 2), movement(3, "DEVOLUCION_COMERCIAL", "-200.01", 10, 1)]), /LEDGER_INVALIDO/);
  assert.throws(() => projectCreditLedger([...history.slice(0, 2), movement(3, "DEVOLUCION_COMERCIAL", "-200.00", 11, 1)]), /LEDGER_INVALIDO/);
});
test("future directed payment is not refunded and prior sources retain their consumption", () => {
  const p = projectCreditLedger([
    ...history.slice(0, 2), movement(3, "DEVOLUCION_COMERCIAL", "-80.00", 10, 1),
    { ...movement(4, "ABONO", "-120.00", 10), directedMovimientoId: 1 },
  ]);
  assert.equal(p.balanceCents, 0);
  assert.equal(p.overpaymentCents, 0);
});
test("fully paid return is a zero-debt statement event, never favor or an ABONO", () => {
  const p = projectCreditLedger([
    history[0]!, movement(2, "ABONO", "-1000.00", null),
    movement(3, "DEVOLUCION_COMERCIAL", "0.00", 10, 1),
  ], { includeMovementProjections: true });
  assert.equal(p.balanceCents, 0);
  assert.equal(p.overpaymentCents, 0);
  assert.equal(p.movementProjections.length, 3);
  assert.equal(p.overpaymentSources.length, 1);
  assert.equal(p.allocations[0]!.appliedCents, 100000);
});