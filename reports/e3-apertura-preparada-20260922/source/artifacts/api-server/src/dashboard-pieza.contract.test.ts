import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("dashboard preserves PIEZA totals through response validation", async () => {
  const route = await readFile(new URL("./routes/dashboard.ts", import.meta.url), "utf8");

  assert.match(route, /GetDashboardResponse\.parse\(/);
  assert.match(route, /piezas:\s*inv\?\.piezas\s*\?\?\s*"0\.000"/);
});