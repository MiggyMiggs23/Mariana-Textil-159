import assert from "node:assert/strict";
import test from "node:test";
import {
  addCalendarDays,
  canLinkAdjustmentToTicket,
  creditDueDate,
  creditStatus,
  deriveEstadoNota,
  deriveTicketCreditData,
  isCreditTerm,
  mexicoCityDate,
} from "./clientes-aging";
import { allocateCreditFifo, projectCreditLedger } from "./credit-allocation";
import { createTextPdf } from "./pdf";
import {
  authorizedCreditPredicate,
  collectedTicketPredicate,
} from "./accounted-document";
import { calendarDate } from "./date-only";

test("canonical note states distinguish unpaid, partial, paid, and overdue partial", () => {
  const common = { importeOriginal: "100.00", fechaVencimiento: "2025-01-10", hoy: "2025-01-11" };
  assert.equal(
    deriveEstadoNota({ ...common, saldoPendiente: "100.00" }),
    "CON_RETRASO",
  );
  assert.equal(
    deriveEstadoNota({
      ...common,
      saldoPendiente: "50.00",
      hoy: "2025-01-01",
    }),
    "ABONO_PARCIAL",
  );
  assert.equal(
    deriveEstadoNota({
      ...common,
      saldoPendiente: "100.00",
      fechaVencimiento: "2025-12-31",
      hoy: "2025-01-01",
    }),
    "PENDIENTE",
  );
  assert.equal(
    deriveEstadoNota({ ...common, saldoPendiente: "0.00" }),
    "PAGADA",
  );
});

test("explicit favor can target a protected new note without changing historical FIFO", () => {
  const projection = projectCreditLedger([
    {
      id: 1,
      ticketId: null,
      tipo: "ABONO",
      importe: "-150.00",
      createdAt: new Date(1),
      explicitFavorApplications: [
        { sourceId: 1, targetId: 20, amountCents: 5_000 },
      ],
    },
    {
      id: 10,
      ticketId: 10,
      tipo: "VENTA_CREDITO",
      importe: "100.00",
      createdAt: new Date(2),
    },
    {
      id: 20,
      ticketId: 20,
      tipo: "VENTA_CREDITO",
      importe: "50.00",
      createdAt: new Date(3),
      preventImplicitFavor: true,
    },
  ]);
  assert.deepEqual(
    projection.allCharges.map((charge) => [charge.movimientoId, charge.pendienteCents]),
    [[10, 0], [20, 0]],
  );
  assert.equal(projection.overpaymentCents, 0);
  assert.equal(
    projection.allocations.some(
      (allocation) =>
        allocation.sourceId === 1 &&
        allocation.targetId === 20 &&
        allocation.appliedCents === 5_000,
    ),
    true,
  );
});

test("later ordinary favor can settle a protected note", () => {
  const projection = projectCreditLedger([
    {
      id: 20,
      ticketId: 20,
      tipo: "VENTA_CREDITO",
      importe: "50.00",
      createdAt: new Date(1),
      preventImplicitFavor: true,
    },
    {
      id: 30,
      ticketId: null,
      tipo: "ABONO",
      importe: "-50.00",
      createdAt: new Date(2),
    },
  ]);
  assert.equal(projection.balanceCents, 0);
  assert.equal(projection.overpaymentCents, 0);
});

test("a new note with no explicit favor choice leaves prior favor available", () => {
  const projection = projectCreditLedger([
    {
      id: 10,
      ticketId: null,
      tipo: "ABONO",
      importe: "-50.00",
      createdAt: new Date(1),
    },
    {
      id: 20,
      ticketId: 20,
      tipo: "VENTA_CREDITO",
      importe: "50.00",
      createdAt: new Date(2),
      preventImplicitFavor: true,
    },
  ]);
  assert.equal(projection.balanceCents, 5_000);
  assert.equal(projection.overpaymentCents, 5_000);
});

test("directed payment excess remains available favor", () => {
  const projection = projectCreditLedger([
    {
      id: 10,
      ticketId: 10,
      tipo: "VENTA_CREDITO",
      importe: "100.00",
      createdAt: new Date(1),
    },
    {
      id: 11,
      ticketId: 10,
      directedMovimientoId: 10,
      tipo: "ABONO",
      importe: "-150.00",
      createdAt: new Date(2),
    },
  ]);
  assert.equal(projection.balanceCents, 0);
  assert.equal(projection.overpaymentCents, 5_000);
  assert.equal(projection.overpaymentSources[0]?.availableCents, 5_000);
});

test("favor application preserves Cobrado classification and receipt-source conservation", () => {
  // Keep this assertion tied to the production predicate used by the period
  // Cobrado query: credit-note authorization is accounted separately and an
  // aplicaciones_credito row cannot alter a collected ticket.
  assert.equal(
    collectedTicketPredicate("f"),
    "(f.estado='VENDIDO' AND f.documento_tipo='TICKET' AND f.cobrado=true)",
  );
  assert.match(
    authorizedCreditPredicate("f"),
    /f\.documento_tipo='NOTA' AND f\.autorizacion_estado='AUTORIZADA'/,
  );

  const movements = [
    {
      id: 1,
      ticketId: null,
      tipo: "ABONO" as const,
      importe: "-150.00",
      createdAt: new Date(1),
      explicitFavorApplications: [
        { sourceId: 1, targetId: 20, amountCents: 5_000 },
      ],
    },
    {
      id: 10,
      ticketId: 10,
      tipo: "VENTA_CREDITO" as const,
      importe: "100.00",
      createdAt: new Date(2),
    },
    {
      id: 20,
      ticketId: 20,
      tipo: "VENTA_CREDITO" as const,
      importe: "50.00",
      createdAt: new Date(3),
      preventImplicitFavor: true,
    },
  ];
  const projection = projectCreditLedger(movements);
  const receiptCents = movements
    .filter((movement) => movement.tipo === "ABONO")
    .reduce((sum, movement) => sum + Math.abs(Number(movement.importe) * 100), 0);
  const sourceApplications = projection.allocations
    .filter((allocation) => allocation.sourceId === 1)
    .reduce((sum, allocation) => sum + allocation.appliedCents, 0);
  const sourceFavor = projection.overpaymentSources.find(
    (source) => source.movementId === 1,
  )?.availableCents ?? 0;
  assert.equal(sourceApplications + sourceFavor, receiptCents);
  assert.equal(projection.balanceCents, 0);

  // The destination read model emits an ABONO row for the applied portion
  // and an ABONO_SALDO_FAVOR row for the remaining portion.  Both are
  // collections, so receiving favor and applying it later must conserve
  // Cobrado rather than create a second receipt.
  const cobradoFromDestinationRows = (rows: Array<{ fuente: string; importe: string }>) =>
    rows
      .filter(({ fuente }) =>
        ["POS", "ABONO", "REVERSO_ABONO", "ABONO_SALDO_FAVOR", "REVERSO_ABONO_SALDO_FAVOR"]
          .includes(fuente),
      )
      .reduce((sum, row) => sum + Number(row.importe), 0);
  const beforeApplication = [
    { fuente: "ABONO_SALDO_FAVOR", importe: "150.00" },
  ];
  const afterApplication = [
    { fuente: "ABONO", importe: "50.00" },
    { fuente: "ABONO_SALDO_FAVOR", importe: "100.00" },
  ];
  assert.equal(
    cobradoFromDestinationRows(afterApplication),
    cobradoFromDestinationRows(beforeApplication),
  );
});

test("resulting favor includes existing favor separately from the new receipt excess", () => {
  const projection = projectCreditLedger([
    {
      id: 10,
      ticketId: 10,
      tipo: "VENTA_CREDITO",
      importe: "100.00",
      createdAt: new Date(1),
    },
    {
      id: 11,
      ticketId: null,
      tipo: "ABONO",
      importe: "-150.00",
      createdAt: new Date(2),
    },
    {
      id: 12,
      ticketId: null,
      tipo: "ABONO",
      importe: "-100.00",
      createdAt: new Date(3),
    },
  ]);
  assert.deepEqual(
    projection.overpaymentSources.map((source) => source.availableCents),
    [5_000, 10_000],
  );
  assert.equal(projection.overpaymentCents, 15_000);
});

test("replayed explicit application evidence is idempotent", () => {
  const projection = projectCreditLedger([
    {
      id: 1,
      ticketId: null,
      tipo: "ABONO",
      importe: "-50.00",
      createdAt: new Date(1),
      explicitFavorApplications: [
        { sourceId: 1, targetId: 20, amountCents: 5_000 },
        // A retry cannot consume the same source/target twice.
        { sourceId: 1, targetId: 20, amountCents: 5_000 },
      ],
    },
    {
      id: 20,
      ticketId: 20,
      tipo: "VENTA_CREDITO",
      importe: "50.00",
      createdAt: new Date(2),
      preventImplicitFavor: true,
    },
  ]);
  assert.equal(
    projection.allocations.filter(
      (allocation) => allocation.sourceId === 1 && allocation.targetId === 20,
    ).reduce((sum, allocation) => sum + allocation.appliedCents, 0),
    5_000,
  );
  assert.equal(projection.balanceCents, 0);
  assert.equal(projection.overpaymentCents, 0);
});

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

test("credit due-date boundaries use Mexico calendar labels, not sale instants", () => {
  // Mexico City is still on the previous calendar day immediately before
  // midnight and on the new day immediately after it.
  assert.equal(
    creditDueDate(new Date("2026-10-16T05:59:59.000Z"), 15),
    "2026-10-30",
  );
  assert.equal(
    creditDueDate(new Date("2026-10-16T06:00:00.000Z"), 15),
    "2026-10-31",
  );
  assert.equal(creditStatus(100, "2026-10-16", "2026-10-16"), "POR_VENCER");
  assert.equal(creditStatus(100, "2026-10-15", "2026-10-16"), "VENCIDA");
});

test("date-only database values retain their label when normalized for JSON and Excel", () => {
  const dateLabels = [
    ["2026-01-01", 2026, 1, 1],
    ["2026-02-28", 2026, 2, 28],
    ["2024-02-29", 2024, 2, 29],
    ["2026-03-31", 2026, 3, 31],
  ] as const;
  for (const [label, year, month, day] of dateLabels) {
    assert.match(calendarDate(label), /^\d{4}-\d{2}-\d{2}$/);
    // Schema adapters can represent DATE as UTC midnight.
    assert.equal(calendarDate(new Date(`${label}T00:00:00.000Z`)), label);
    // pg's DATE parser can represent the same DATE at local midnight.
    assert.equal(calendarDate(new Date(year, month - 1, day)), label);
  }
});

test("calendar-day addition preserves month ends and leap days", () => {
  assert.equal(addCalendarDays("2026-01-01", 7), "2026-01-08");
  assert.equal(addCalendarDays("2026-01-31", 7), "2026-02-07");
  assert.equal(addCalendarDays("2024-02-28", 7), "2024-03-06");
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

test("ticket credit derives from its sale movement without a ticket payment", () => {
  const credit = deriveTicketCreditData(
    20,
    [],
    [
      {
        id: 1,
        ticketId: 20,
        tipo: "VENTA_CREDITO",
        importe: "90.00",
        diasPlazo: 30,
        fechaVencimiento: "2026-09-30",
        createdAt: new Date("2026-08-31T12:00:00Z"),
      },
      {
        id: 2,
        ticketId: null,
        directedMovimientoId: 1,
        tipo: "ABONO",
        importe: "-30.00",
        diasPlazo: null,
        fechaVencimiento: null,
        createdAt: new Date("2026-09-01T12:00:00Z"),
      },
    ],
  );

  assert.deepEqual(credit, {
    esCredito: true,
    importeCredito: "90.00",
    diasPlazo: 30,
    fechaVencimiento: "2026-09-30",
    saldoPendiente: "60.00",
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