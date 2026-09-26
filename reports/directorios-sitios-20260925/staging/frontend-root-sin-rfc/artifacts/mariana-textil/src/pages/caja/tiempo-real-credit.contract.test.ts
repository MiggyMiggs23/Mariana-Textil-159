import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("realtime credit card uses dashboard aggregate without pending alert styling", async () => {
  const source = await readFile(new URL("./tiempo-real.tsx", import.meta.url), "utf8");
  const start = source.indexOf('data-testid="realtime-credit-card"');
  const end = source.indexOf("</Card>", start);
  const card = source.slice(start, end);

  assert.notEqual(start, -1);
  assert.match(card, /Ventas a crédito/);
  assert.match(card, /dashboard\.ventasCredito\.importe/);
  assert.match(card, /dashboard\.ventasCredito\.operaciones/);
  assert.doesNotMatch(card, /amber|pendientes30Min|mergedPending/);
});