import assert from "node:assert/strict";
import test from "node:test";
import { allocateCreditFifo, isValidPaymentDestination, projectCreditLedger } from "./credit-allocation";

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

test("full ledger projection excludes reversed ABONOs and applies ticket reversals before FIFO", () => {
  const result = projectCreditLedger([
    { id: 1, ticketId: 10, tipo: "VENTA_CREDITO", importe: "100.00", createdAt: at(1), fechaVencimiento: "2026-02-01" },
    { id: 2, ticketId: 10, tipo: "ABONO", importe: "-25.00", createdAt: at(2) },
    { id: 3, ticketId: 10, tipo: "REVERSO", importe: "25.00", movimientoOrigenId: 2, createdAt: at(3) },
    { id: 4, ticketId: 10, tipo: "REVERSO", importe: "-40.00", createdAt: at(4) },
    { id: 5, ticketId: null, tipo: "AJUSTE", importe: "10.00", createdAt: at(5) },
    { id: 6, ticketId: null, tipo: "AJUSTE", importe: "-5.00", createdAt: at(6) },
  ]);
  assert.equal(result.balanceCents, 65_00);
  assert.deepEqual(result.charges.map((charge) => [charge.movimientoId, charge.pendienteCents]), [[1, 5500], [5, 1000]]);
});

test("directed ABONOs reduce only their linked ticket before normal FIFO", () => {
  const now = new Date("2026-08-27T12:00:00.000Z");
  const projection = projectCreditLedger([
    {
      id: 1,
      ticketId: 101,
      tipo: "VENTA_CREDITO",
      importe: "120.00",
      createdAt: new Date(now.getTime() - 2_000),
    },
    {
      id: 2,
      ticketId: 102,
      tipo: "VENTA_CREDITO",
      importe: "90.00",
      createdAt: new Date(now.getTime() - 1_000),
    },
    {
      id: 3,
      ticketId: 102,
      directedMovimientoId: 2,
      tipo: "ABONO",
      importe: "-30.00",
      createdAt: now,
    },
    {
      id: 4,
      ticketId: null,
      tipo: "ABONO",
      importe: "-50.00",
      createdAt: new Date(now.getTime() + 1_000),
    },
    {
      id: 5,
      ticketId: 101,
      tipo: "REVERSO",
      importe: "-60.00",
      createdAt: new Date(now.getTime() + 2_000),
    },
    {
      id: 6,
      ticketId: null,
      tipo: "ABONO",
      importe: "-20.00",
      createdAt: new Date(now.getTime() + 3_000),
    },
  ]);

  assert.deepEqual(
    projection.allocations
      .filter((allocation) => allocation.sourceId === 6)
      .map((allocation) => [allocation.targetId, allocation.appliedCents]),
    [
      [1, 1_000],
      [2, 1_000],
    ],
  );
});

test("legacy ticket-linked ABONOs remain normal FIFO without a directed marker", () => {
  const projection = projectCreditLedger([
    { id: 1, ticketId: 101, tipo: "VENTA_CREDITO", importe: "100.00", createdAt: at(1) },
    { id: 2, ticketId: 102, tipo: "VENTA_CREDITO", importe: "100.00", createdAt: at(2) },
    { id: 3, ticketId: 102, tipo: "ABONO", importe: "-60.00", createdAt: at(3) },
  ]);

  assert.deepEqual(
    projection.allocations.map((allocation) => [
      allocation.sourceId,
      allocation.targetId,
      allocation.appliedCents,
    ]),
    [[3, 1, 6_000]],
  );
});

test("directed ABONOs reduce only the selected movement when a ticket has multiple charges", () => {
  const projection = projectCreditLedger([
    { id: 1, ticketId: 101, tipo: "VENTA_CREDITO", importe: "40.00", createdAt: at(1) },
    { id: 2, ticketId: 101, tipo: "VENTA_CREDITO", importe: "60.00", createdAt: at(2) },
    {
      id: 3,
      ticketId: 101,
      directedMovimientoId: 2,
      tipo: "ABONO",
      importe: "-30.00",
      createdAt: at(3),
    },
  ]);

  assert.deepEqual(
    projection.allCharges.map((charge) => [
      charge.movimientoId,
      charge.pendienteCents,
    ]),
    [
      [1, 4_000],
      [2, 3_000],
    ],
  );
});

test("backdated preview from the full ledger matches the subsequently inserted ABONO", () => {
  const ledger = [
    { id: 1, ticketId: 10, tipo: "VENTA_CREDITO" as const, importe: "100.00", createdAt: at(1) },
    { id: 2, ticketId: 20, tipo: "VENTA_CREDITO" as const, importe: "100.00", createdAt: at(4) },
    { id: 3, ticketId: null, tipo: "ABONO" as const, importe: "-100.00", createdAt: at(5) },
  ];
  const previewSourceId = Number.MAX_SAFE_INTEGER;
  const preview = projectCreditLedger([
    ...ledger,
    { id: previewSourceId, ticketId: null, tipo: "ABONO", importe: "-100.00", createdAt: at(3) },
  ]).allocations.filter((item) => item.sourceId === previewSourceId);
  const posted = projectCreditLedger([
    ...ledger,
    { id: 4, ticketId: null, tipo: "ABONO", importe: "-100.00", createdAt: at(3) },
  ]).allocations.filter((item) => item.sourceId === 4);

  assert.deepEqual(
    preview.map(({ targetId, appliedCents }) => ({ targetId, appliedCents })),
    posted.map(({ targetId, appliedCents }) => ({ targetId, appliedCents })),
  );
  assert.deepEqual(
    preview.map(({ targetId, appliedCents }) => [targetId, appliedCents]),
    [[1, 10_000]],
  );
});

test("same-day and next-day ABONOs reduce the sale for partial, exact, and excess payments", () => {
  const sale = {
    id: 1,
    ticketId: 10,
    tipo: "VENTA_CREDITO" as const,
    importe: "100.00",
    createdAt: new Date("2026-08-31T14:00:00.000Z"),
  };
  const cases = [
    {
      name: "same-day partial",
      amount: "-40.00",
      paidAt: new Date("2026-08-31T18:00:00.000Z"),
      balanceCents: 6_000,
      overpaymentCents: 0,
    },
    {
      name: "same-day exact",
      amount: "-100.00",
      paidAt: new Date("2026-08-31T18:00:00.000Z"),
      balanceCents: 0,
      overpaymentCents: 0,
    },
    {
      name: "same-day excess",
      amount: "-150.00",
      paidAt: new Date("2026-08-31T18:00:00.000Z"),
      balanceCents: 0,
      overpaymentCents: 5_000,
    },
    {
      name: "next-day partial",
      amount: "-25.00",
      paidAt: new Date("2026-09-01T18:00:00.000Z"),
      balanceCents: 7_500,
      overpaymentCents: 0,
    },
  ];

  for (const scenario of cases) {
    const projection = projectCreditLedger([
      sale,
      {
        id: 2,
        ticketId: null,
        tipo: "ABONO",
        importe: scenario.amount,
        createdAt: scenario.paidAt,
      },
    ]);
    assert.equal(projection.balanceCents, scenario.balanceCents, scenario.name);
    assert.equal(
      projection.overpaymentCents,
      scenario.overpaymentCents,
      scenario.name,
    );
    assert.deepEqual(
      projection.allocations.map(({ sourceId, targetId }) => [
        sourceId,
        targetId,
      ]),
      [[2, 1]],
      `${scenario.name}: the single ABONO is the only payment source`,
    );
  }
});

test("validates payment destination against its payment method", () => {
  assert.equal(isValidPaymentDestination("EFECTIVO", "CAJA_FISICA"), true);
  assert.equal(isValidPaymentDestination("TRANSFERENCIA", "CUENTA_FISCAL"), true);
  assert.equal(isValidPaymentDestination("TRANSFERENCIA", "CUENTA_NO_FISCAL"), true);
  assert.equal(isValidPaymentDestination("EFECTIVO", "CUENTA_FISCAL"), false);
  assert.equal(isValidPaymentDestination("TRANSFERENCIA", "CAJA_FISICA"), false);
});