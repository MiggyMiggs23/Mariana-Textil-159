import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { formatPackageQuantityLabel, formatUnit } from "@workspace/number-format";

const root = new URL("../../../../", import.meta.url);

const visibleUnitSurfaces = [
  "artifacts/mariana-textil/src/components/label-print.tsx",
  "artifacts/mariana-textil/src/components/recepcion-salidas.tsx",
  "artifacts/mariana-textil/src/components/reportes/report-table.tsx",
  "artifacts/mariana-textil/src/pages/entrada-documento.tsx",
  "artifacts/mariana-textil/src/pages/salida-documento.tsx",
  "artifacts/mariana-textil/src/pages/inventario.tsx",
  "artifacts/mariana-textil/src/pages/dashboard.tsx",
  "artifacts/mariana-textil/src/pages/salidas.tsx",
  "artifacts/mariana-textil/src/pages/salida-detail.tsx",
  "artifacts/mariana-textil/src/pages/salida-nueva.tsx",
  "artifacts/mariana-textil/src/pages/etiquetas.tsx",
  "artifacts/mariana-textil/src/pages/pos.tsx",
  "artifacts/mariana-textil/src/pages/cobros.tsx",
  "artifacts/mariana-textil/src/pages/corte-detail-shared.tsx",
  "artifacts/mariana-textil/src/pages/caja/tiempo-real.tsx",
  "artifacts/mariana-textil/src/pages/contenedores/index.tsx",
  "artifacts/mariana-textil/src/pages/contenedores/detail.tsx",
  "artifacts/mariana-textil/src/pages/precios/index.tsx",
  "artifacts/mariana-textil/src/pages/precios/detail.tsx",
  "artifacts/mariana-textil/src/pages/producto-detail.tsx",
  "artifacts/mariana-textil/src/pages/rollo-detail.tsx",
  "artifacts/mariana-textil/src/pages/ticket-detail.tsx",
  "artifacts/mariana-textil/src/pages/entradas.tsx",
  "artifacts/mariana-textil/src/pages/entradas-pendientes-costo.tsx",
  "artifacts/mariana-textil/src/pages/proveedor-detail.tsx",
  "artifacts/mariana-textil/src/pages/proveedores.tsx",
  "artifacts/mariana-textil/src/pages/viaje-detail.tsx",
  "artifacts/mariana-textil/src/pages/viaje-documento.tsx",
] as const;

test("unit labels have the prescribed visible values", () => {
  assert.deepEqual(
    ["METRO", "KILO", "BOLSA"].map(formatUnit),
    ["Mts.", "Kg.", "Bolsas"],
  );
  assert.equal(formatPackageQuantityLabel("BOLSA"), "BOLSAS POR CAJA");
});

test("inventoried visible unit surfaces use the shared formatter", async () => {
  for (const path of visibleUnitSurfaces) {
    const source = await readFile(new URL(path, root), "utf8");
    assert.match(source, /format(Unit|PackageQuantityLabel)/, `${path} must use the shared unit presentation boundary`);
  }

  const reportExport = await readFile(
    new URL("artifacts/api-server/src/lib/report-export.ts", root),
    "utf8",
  );
  assert.match(reportExport, /row\.unidad = formatUnit/);
});