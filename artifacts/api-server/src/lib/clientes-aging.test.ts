import assert from "node:assert/strict";
import test from "node:test";
import { allocateCreditFifo } from "./clientes-aging";
import { createTextPdf } from "./pdf";

test("linked REVERSO cancels its own later ticket before ABONO FIFO", () => {
  const result = allocateCreditFifo(
    [
      { ticketId: 10, amount: 100, linkedReversal: 0 },
      { ticketId: 20, amount: 80, linkedReversal: 80 },
    ],
    25,
  );
  assert.deepEqual(result, [{ ticketId: 10, outstanding: 75 }]);
});

test("unlinked negative amount applies oldest sale first", () => {
  const result = allocateCreditFifo(
    [
      { ticketId: 10, amount: 100, linkedReversal: 0 },
      { ticketId: 20, amount: 80, linkedReversal: 0 },
    ],
    120,
  );
  assert.deepEqual(result, [{ ticketId: 20, outstanding: 60 }]);
});

test("financial export is a valid PDF byte stream", () => {
  const pdf = createTextPdf("Estado de cuenta", ["2026-01-01 | ABONO | 100.00"]);
  assert.equal(pdf.subarray(0, 8).toString("ascii"), "%PDF-1.4");
  assert.match(pdf.toString("ascii"), /xref[\s\S]*%%EOF$/);
});