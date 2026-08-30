import assert from "node:assert/strict";
import { ListSalidasExtraordinariasQueryParams } from "@workspace/api-zod";
import { parseMexicoDateQuery } from "./lib/mexico-date";

const valid = ListSalidasExtraordinariasQueryParams.safeParse({
  fechaDesde: "2026-08-22",
  fechaHasta: "2026-08-31",
});
assert.equal(valid.success, true);
if (valid.success) {
  assert.equal(valid.data.fechaDesde, "2026-08-22");
  assert.equal(valid.data.fechaHasta, "2026-08-31");
  assert.ok(parseMexicoDateQuery(valid.data.fechaDesde, "start"));
  assert.ok(parseMexicoDateQuery(valid.data.fechaHasta, "end"));
}

assert.equal(
  ListSalidasExtraordinariasQueryParams.safeParse({
    fechaDesde: "2026-8-22",
  }).success,
  false,
);

const impossibleCalendarDate = ListSalidasExtraordinariasQueryParams.safeParse({
  fechaHasta: "2026-02-30",
});
assert.equal(impossibleCalendarDate.success, true);
if (impossibleCalendarDate.success) {
  assert.equal(parseMexicoDateQuery(impossibleCalendarDate.data.fechaHasta, "end"), null);
}