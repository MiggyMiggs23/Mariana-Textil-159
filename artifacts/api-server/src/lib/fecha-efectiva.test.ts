import assert from "node:assert/strict";
import test from "node:test";

import {
  FechaEfectivaValidationError,
  parseFechaEfectiva,
} from "./fecha-efectiva";

const mexicoCalendarDate = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Mexico_City",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

test("an explicit Mexico City offset keeps September 15 on September 15 locally", () => {
  const parsed = parseFechaEfectiva("2026-09-15T12:00:00-06:00");

  assert.equal(mexicoCalendarDate.format(parsed), "2026-09-15");
});

test("an offset-bearing date-time is accepted", () => {
  const parsed = parseFechaEfectiva("2026-09-15T18:45:00Z");

  assert.equal(parsed.toISOString(), "2026-09-15T18:45:00.000Z");
});

test("a bare date is rejected before zod coercion", () => {
  assert.throws(
    () => parseFechaEfectiva("2026-09-15"),
    (error: unknown) =>
      error instanceof FechaEfectivaValidationError &&
      error.statusCode === 400 &&
      error.message.includes("fechaEfectiva") &&
      error.message.includes("desplazamiento"),
  );
});

test("a date-time without an offset is rejected", () => {
  assert.throws(
    () => parseFechaEfectiva("2026-09-15T12:00:00"),
    FechaEfectivaValidationError,
  );
});

test("invalid calendar dates are rejected", () => {
  assert.throws(
    () => parseFechaEfectiva("2026-02-30T12:00:00-06:00"),
    FechaEfectivaValidationError,
  );
});

test("null and undefined preserve server-now semantics", () => {
  const serverNow = new Date("2026-09-15T18:00:00.000Z");

  assert.equal(parseFechaEfectiva(null, serverNow).getTime(), serverNow.getTime());
  assert.equal(parseFechaEfectiva(undefined, serverNow).getTime(), serverNow.getTime());
});