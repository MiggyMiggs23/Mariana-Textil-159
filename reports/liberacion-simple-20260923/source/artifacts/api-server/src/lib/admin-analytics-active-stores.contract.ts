import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("store comparison excludes inactive and non-store locations from every series", async () => {
  const source = await readFile(new URL("./admin-analytics.ts", import.meta.url), "utf8");
  const start = source.indexOf("export async function compareStores");
  const end = source.indexOf("\nexport async function", start + 1);
  const comparisonSource = source.slice(start, end);

  assert.notEqual(start, -1);
  assert.ok(comparisonSource.length > 0);
  assert.equal(
    comparisonSource.match(/u\.tipo='TIENDA' AND u\.activa/g)?.length,
    3,
  );
});