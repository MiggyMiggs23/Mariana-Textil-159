import assert from "node:assert/strict";
import test from "node:test";
import {
  canLinkAdjustmentToTicket,
  creditDueDate,
  creditStatus,
  deriveTicketCreditData,
  isCreditTerm,
  mexicoCityDate,
} from "./clientes-aging";
import { allocateCreditFifo } from "./credit-allocation";
import { createTextPdf } from "./pdf";

test("linked REVERSO cancels its own later ticket before ABONO FIFO", () => {
  const result = allocateCreditFifo(
    [{ id: 1, availableCents: 25 }],
    [
      { id: 10, balanceCents: 100, linkedReductionCents: 0, createdAt: new Date(1) },
      { id: 20, balanceCents: 80, linkedReductionCents: 80, createdAt: new Date(2) },
    ],
  );
  assert.deepEqual(
    result.balances.filter((item) => item.balanceAfterCents > 0)
      .map((item) => [item.targetId, item.balanceAfterCents]),
    [[10, 75]],
  );
});

test("unlinked negative amount applies oldest sale first", () => {
  const result = allocateCreditFifo(
    [{ id: 1, availableCents: 120 }],
    [
      { id: 10, balanceCents: 100, createdAt: new Date(1) },
      { id: 20, balanceCents: 80, createdAt: new Date(2) },
    ],
  );
  assert.deepEqual(
    result.balances.filter((item) => item.balanceAfterCents > 0)
      .map((item) => [item.targetId, item.balanceAfterCents]),
    [[20, 60]],
  );
});

test("positive adjustment remains as an aged receivable", () => {
  const result = allocateCreditFifo(
    [{ id: 1, availableCents: 100 }],
    [
      { id: 10, balanceCents: 100, createdAt: new Date(1) },
      { id: 20, balanceCents: 30, createdAt: new Date(2) },
    ],
  );
  assert.deepEqual(
    result.balances.filter((item) => item.balanceAfterCents > 0)
      .map((item) => [item.targetId, item.balanceAfterCents]),
    [[20, 30]],
  );
});

test("aging and payment application report the same balances with a linked reversal", () => {
  const movements = [
    { id: 1, ticketId: 10, amount: 10_000, createdAt: new Date(1), linkedReductionCents: 0 },
    { id: 2, ticketId: 20, amount: 8_000, createdAt: new Date(2), linkedReductionCents: 2_000 },
  ];
  const applied = allocateCreditFifo(
    [{ id: 3, availableCents: 11_000 }],
    movements.map((movement) => ({
      id: movement.id,
      balanceCents: movement.amount,
      linkedReductionCents: movement.linkedReductionCents,
      createdAt: movement.createdAt,
    })),
  );
  const appliedBalances = new Map(
    applied.balances.map((balance) => [
      movements.find((movement) => movement.id === balance.targetId)!.ticketId,
      balance.balanceAfterCents,
    ]),
  );
  const agingTicket20 = deriveTicketCreditData(
    20,
    [{ formaPago: "CREDITO", importe: "80.00" }],
    [
      { id: 1, ticketId: 10, tipo: "VENTA_CREDITO", importe: "100.00", diasPlazo: 30, fechaVencimiento: "2026-02-01", createdAt: new Date(1) },
      { id: 2, ticketId: 20, tipo: "VENTA_CREDITO", importe: "80.00", diasPlazo: 30, fechaVencimiento: "2026-02-02", createdAt: new Date(2) },
      { id: 3, ticketId: null, tipo: "ABONO", importe: "-110.00", diasPlazo: null, fechaVencimiento: null, createdAt: new Date(3) },
      { id: 4, ticketId: 20, tipo: "REVERSO", importe: "-20.00", diasPlazo: null, fechaVencimiento: null, createdAt: new Date(4) },
    ],
  );
  assert.equal(Number(agingTicket20.saldoPendiente) * 100, appliedBalances.get(20));
  assert.equal(appliedBalances.get(20), 5_000);
});

test("reversing an ABONO restores the ticket balance", () => {
  const credit = deriveTicketCreditData(
    10,
    [{ formaPago: "CREDITO", importe: "100.00" }],
    [
      { id: 1, ticketId: 10, tipo: "VENTA_CREDITO", importe: "100.00", diasPlazo: 30, fechaVencimiento: "2026-02-01", createdAt: new Date(1) },
      { id: 2, ticketId: null, tipo: "ABONO", importe: "-100.00", diasPlazo: null, fechaVencimiento: null, createdAt: new Date(2) },
      { id: 3, ticketId: null, movimientoOrigenId: 2, tipo: "REVERSO", importe: "100.00", diasPlazo: null, fechaVencimiento: null, createdAt: new Date(3) },
    ],
  );

  assert.equal(credit.saldoPendiente, "100.00");
});

test("negative adjustment cannot be linked to a ticket and bypass FIFO", () => {
  assert.equal(canLinkAdjustmentToTicket(-100, 25), false);
  assert.equal(canLinkAdjustmentToTicket(-100, null), true);
  assert.equal(canLinkAdjustmentToTicket(100, 25), true);
});

test("financial export is a valid PDF byte stream", () => {
  const pdf = createTextPdf("Estado de cuenta", ["2026-01-01 | ABONO | 100.00"]);
  assert.equal(pdf.subarray(0, 8).toString("ascii"), "%PDF-1.4");
  assert.match(pdf.toString("ascii"), /xref[\s\S]*%%EOF$/);
});

test("financial PDF paginates without dropping rows", () => {
  const lines = Array.from({ length: 120 }, (_, index) => `Fila ${index + 1}`);
  const pdf = createTextPdf("Cartera", lines).toString("ascii");
  assert.equal((pdf.match(/\/Type \/Page\b/g) ?? []).length, 3);
  assert.match(pdf, /\(Fila 1\) Tj/);
  assert.match(pdf, /\(Fila 120\) Tj/);
});

test("credit due dates support every mandatory term from Mexico City sale date", () => {
  const sale = new Date("2026-08-31T04:30:00.000Z"); // Aug 30 in Mexico City
  assert.equal(mexicoCityDate(sale), "2026-08-30");
  assert.equal(creditDueDate(sale, 7), "2026-09-06");
  assert.equal(creditDueDate(sale, 15), "2026-09-14");
  assert.equal(creditDueDate(sale, 30), "2026-09-29");
  assert.equal(creditDueDate(sale, 60), "2026-10-29");
});

test("credit status boundaries are calculated at query time", () => {
  assert.equal(creditStatus(0, "2026-09-10", "2026-09-20"), "PAGADA");
  assert.equal(creditStatus(100, null, "2026-09-20"), "SIN_PLAZO");
  assert.equal(creditStatus(100, "2026-09-24", "2026-09-20"), "VIGENTE");
  assert.equal(creditStatus(100, "2026-09-23", "2026-09-20"), "POR_VENCER");
  assert.equal(creditStatus(100, "2026-09-20", "2026-09-20"), "POR_VENCER");
  assert.equal(creditStatus(100, "2026-09-19", "2026-09-20"), "VENCIDA");
});

test("only the four explicit credit terms are accepted", () => {
  for (const term of [7, 15, 30, 60]) assert.equal(isCreditTerm(term), true);
  for (const invalid of [undefined, null, 0, 14, 45, "30"]) {
    assert.equal(isCreditTerm(invalid), false);
  }
});

test("cash ticket does not infer credit from unrelated customer ledger", () => {
  const credit = deriveTicketCreditData(
    20,
    [{ formaPago: "EFECTIVO", importe: "150.00" }],
    [
      {
        id: 1,
        ticketId: 10,
        tipo: "VENTA_CREDITO",
        importe: "300.00",
        diasPlazo: 30,
        fechaVencimiento: "2026-09-30",
        createdAt: new Date("2026-08-31T12:00:00Z"),
      },
    ],
  );
  assert.deepEqual(credit, {
    esCredito: false,
    importeCredito: "0.00",
    diasPlazo: null,
    fechaVencimiento: null,
    saldoPendiente: "0.00",
  });
});

test("mixed ticket reports only its credit portion and persisted terms", () => {
  const credit = deriveTicketCreditData(
    20,
    [
      { formaPago: "EFECTIVO", importe: "75.00" },
      { formaPago: "CREDITO", importe: "125.00" },
    ],
    [
      {
        id: 1,
        ticketId: 20,
        tipo: "VENTA_CREDITO",
        importe: "125.00",
        diasPlazo: 15,
        fechaVencimiento: "2026-09-14",
        createdAt: new Date("2026-08-30T12:00:00Z"),
      },
    ],
  );
  assert.deepEqual(credit, {
    esCredito: true,
    importeCredito: "125.00",
    diasPlazo: 15,
    fechaVencimiento: "2026-09-14",
    saldoPendiente: "125.00",
  });
});

test("ticket credit balance uses FIFO abonos and linked reversals", () => {
  const credit = deriveTicketCreditData(
    20,
    [{ formaPago: "CREDITO", importe: "80.00" }],
    [
      {
        id: 1,
        ticketId: 10,
        tipo: "VENTA_CREDITO",
        importe: "100.00",
        diasPlazo: 7,
        fechaVencimiento: "2026-09-06",
        createdAt: new Date("2026-08-30T12:00:00Z"),
      },
      {
        id: 2,
        ticketId: 20,
        tipo: "VENTA_CREDITO",
        importe: "80.00",
        diasPlazo: 30,
        fechaVencimiento: "2026-09-30",
        createdAt: new Date("2026-08-31T12:00:00Z"),
      },
      {
        id: 3,
        ticketId: null,
        tipo: "ABONO",
        importe: "-110.00",
        diasPlazo: null,
        fechaVencimiento: null,
        createdAt: new Date("2026-09-01T12:00:00Z"),
      },
      {
        id: 4,
        ticketId: 20,
        tipo: "REVERSO",
        importe: "-20.00",
        diasPlazo: null,
        fechaVencimiento: null,
        createdAt: new Date("2026-09-02T12:00:00Z"),
      },
    ],
  );
  assert.equal(credit.importeCredito, "80.00");
  assert.equal(credit.saldoPendiente, "50.00");
  assert.equal(credit.fechaVencimiento, "2026-09-30");
});

test("aging examples remain current until due date and age only afterward", () => {
  assert.equal(creditStatus(100, "2026-01-31", "2026-01-21"), "VIGENTE");
  assert.equal(creditStatus(100, "2026-03-02", "2026-02-15"), "VIGENTE");
  assert.equal(creditStatus(100, "2026-01-08", "2026-01-21"), "VENCIDA");
  const overdueDays =
    (Date.parse("2026-01-21T00:00:00Z") -
      Date.parse("2026-01-08T00:00:00Z")) /
    86_400_000;
  assert.equal(overdueDays, 13);
});