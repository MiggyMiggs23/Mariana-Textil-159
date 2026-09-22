import assert from "node:assert/strict";
import test from "node:test";

import {
  buildMexicoCityEffectiveDate,
  todayInMexicoCity,
} from "./fecha-efectiva";

const mexicoCalendarDate = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Mexico_City",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

test("September 15 is sent as September 15 in Mexico City", () => {
  const payload = buildMexicoCityEffectiveDate("2026-09-15");

  assert.equal(payload, "2026-09-15T12:00:00-06:00");
  assert.equal(mexicoCalendarDate.format(new Date(payload!)), "2026-09-15");
});

test("the date-only helper returns an explicit offset-bearing instant", () => {
  const payload = buildMexicoCityEffectiveDate("2026-01-15");

  assert.match(payload!, /^2026-01-15T12:00:00[+-]\d{2}:\d{2}$/);
  assert.notEqual(payload?.endsWith("Z"), true);
});

test("blank dates keep the server-now path", () => {
  assert.equal(buildMexicoCityEffectiveDate(""), null);
  assert.equal(buildMexicoCityEffectiveDate(null), null);
  assert.equal(buildMexicoCityEffectiveDate(undefined), null);
});

test("invalid calendar dates are rejected", () => {
  assert.throws(
    () => buildMexicoCityEffectiveDate("2026-02-30"),
    /no es válida/,
  );
});

test("today is derived in Mexico City rather than browser local time", () => {
  assert.equal(
    todayInMexicoCity(new Date("2026-09-15T05:00:00.000Z")),
    "2026-09-14",
  );
});