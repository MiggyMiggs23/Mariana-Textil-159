import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const supplierSchema = readFileSync(
  new URL("../../../lib/db/src/lib/pagos-proveedor-schema.ts", import.meta.url),
  "utf8",
);
const pendingCostsPage = readFileSync(
  new URL(
    "../../mariana-textil/src/pages/entradas-pendientes-costo.tsx",
    import.meta.url,
  ),
  "utf8",
);
const entryPage = readFileSync(
  new URL("../../mariana-textil/src/pages/entradas.tsx", import.meta.url),
  "utf8",
);
const inventoryRoutes = readFileSync(
  new URL("./routes/inventario.ts", import.meta.url),
  "utf8",
);
const inventoryEngine = readFileSync(
  new URL("./lib/inventario.ts", import.meta.url),
  "utf8",
);

test("startup guarantees the partial index required by pending-cost capture", () => {
  assert.match(supplierSchema, /pagos_proveedor_entrada_compra_idx/);
  assert.match(
    supplierSchema,
    /WHERE tipo='COMPRA' AND entrada_id IS NOT NULL/,
  );
  assert.match(supplierSchema, /HAVING COUNT\(\*\) > 1/);
  assert.match(supplierSchema, /conciliación manual/);
});

test("pending-cost listing groups every selected location field", () => {
  assert.match(
    inventoryRoutes,
    /GROUP BY e\.id, u\.iniciales, u\.nombre, p\.nombre, us\.nombre/,
  );
});

test("pending-cost capture preserves an existing immutable purchase", () => {
  const captureStart = inventoryEngine.indexOf(
    "export async function capturarCostosEntrada",
  );
  const captureEnd = inventoryEngine.indexOf(
    "// ─────────────────────────────────────────────────────────────────────────────",
    captureStart,
  );
  const capture = inventoryEngine.slice(captureStart, captureEnd);
  assert.match(capture, /DO NOTHING/);
  assert.doesNotMatch(capture, /DO UPDATE/);
  assert.match(capture, /ENTRY_PURCHASE_CONFLICT/);
});

test("pending-cost navigation remains available on narrow screens", () => {
  assert.match(entryPage, /href="\/entradas\/pendientes-costo"/);
  assert.doesNotMatch(entryPage, /hidden sm:flex/);
  assert.match(pendingCostsPage, /href="\/entradas"/);
});