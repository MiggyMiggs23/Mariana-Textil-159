import assert from "node:assert/strict";
import test from "node:test";

import { formatDateOnlyMx } from "./date-only";

test("date-only payment dates keep their persisted calendar day in Mexico", () => {
  assert.equal(formatDateOnlyMx("2026-10-02"), "02/10/2026");
});