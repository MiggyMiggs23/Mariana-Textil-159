import assert from "node:assert/strict";
import test from "node:test";
import { buildCajaComparativoRequest } from "./comparativo-query";

test("embedded CajaComparativo uses the computed header window as custom", () => {
  assert.deepEqual(
    buildCajaComparativoRequest(
      { periodo: "mensual", desde: "2026-09-01", hasta: "2026-09-13" },
      "mensual",
      "2026-09-01",
      "2026-09-13",
    ),
    { periodo: "personalizado", desde: "2026-09-01", hasta: "2026-09-13" },
  );
});

test("standalone CajaComparativo keeps preset requests date-free", () => {
  assert.deepEqual(
    buildCajaComparativoRequest(undefined, "mensual", "2026-09-01", "2026-09-13"),
    { periodo: "mensual" },
  );
});

test("standalone CajaComparativo still sends dates for custom period", () => {
  assert.deepEqual(
    buildCajaComparativoRequest(undefined, "personalizado", "2026-09-01", "2026-09-13"),
    { periodo: "personalizado", desde: "2026-09-01", hasta: "2026-09-13" },
  );
});