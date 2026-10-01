import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../../../../../", import.meta.url);

test("Cortes consumes report date/site filters and opens sesionId through the existing detail hook", async () => {
  const cortes = await readFile(
    new URL("artifacts/mariana-textil/src/pages/caja/cortes.tsx", root),
    "utf8",
  );

  assert.match(cortes, /useSearch/);
  assert.match(cortes, /parseDateOnlyQuery\(search, "desde"\)/);
  assert.match(cortes, /parseDateOnlyQuery\(search, "hasta"\)/);
  assert.match(cortes, /parsePositiveQueryId\(search, "ubicacionId"\)/);
  assert.match(cortes, /useListAdminCortes\(\{[\s\S]*?desde,[\s\S]*?hasta,[\s\S]*?ubicacionId: effectiveLocationId/);
  assert.match(cortes, /useGetAdminCorte\(selectedCorteId \|\| 0,[\s\S]*?enabled: !!selectedCorteId/);
  assert.doesNotMatch(cortes, /if\s*\(requestedSessionId\)\s*\{\s*useGetAdminCorte/);
});