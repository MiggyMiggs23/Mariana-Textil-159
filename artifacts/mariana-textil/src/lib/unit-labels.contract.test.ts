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
  "artifacts/mariana-textil/src/pages/cliente-detail.tsx",
  "artifacts/mariana-textil/src/pages/corte-detail-shared.tsx",
  "artifacts/mariana-textil/src/pages/caja/tiempo-real.tsx",
  "artifacts/mariana-textil/src/pages/caja/comparativo.tsx",
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
  "artifacts/mariana-textil/src/pages/productos.tsx",
  "artifacts/mariana-textil/src/pages/auditorias-inventario.tsx",
  "artifacts/mariana-textil/src/pages/movimientos.tsx",
] as const;

test("unit labels have the prescribed visible values", () => {
  assert.deepEqual(
    ["METRO", "KILO", "BOLSA", "PIEZA"].map(formatUnit),
    ["Mts.", "Kg.", "Bolsas", "Pzas."],
  );
  assert.equal(formatPackageQuantityLabel("BOLSA"), "BOLSAS POR CAJA");
});

test("inventoried visible unit surfaces use the shared formatter", async () => {
  for (const path of visibleUnitSurfaces) {
    const source = await readFile(new URL(path, root), "utf8");
    assert.match(source, /format(Unit|PackageQuantityLabel)/, `${path} must use the shared unit presentation boundary`);
    assert.doesNotMatch(
      source,
      /\{(?:prod|product)\.unidad\.toLowerCase\(\)\}/,
      `${path} must not render a raw lower-case unit enum`,
    );
    assert.doesNotMatch(
      source,
      /unidadProducto === "KILO" \? "kg" : "m"/,
      `${path} must not collapse BOLSA pricing labels into metres`,
    );
    assert.doesNotMatch(
      source,
      /[?:]\s*["']KILO["']/,
      `${path} must not render the raw KILO enum label`,
    );
  }

  const reportExport = await readFile(
    new URL("artifacts/api-server/src/lib/report-export.ts", root),
    "utf8",
  );
  assert.match(reportExport, /row\.unidad = formatUnit/);
});

test("Task 62 quantity surfaces render bag totals separately when present", async () => {
  const surfaces = [
    "artifacts/mariana-textil/src/pages/dashboard.tsx",
    "artifacts/mariana-textil/src/pages/inventario.tsx",
    "artifacts/mariana-textil/src/components/recepcion-salidas.tsx",
    "artifacts/mariana-textil/src/pages/viaje-detail.tsx",
    "artifacts/mariana-textil/src/pages/viaje-documento.tsx",
  ];

  for (const path of surfaces) {
    const source = await readFile(new URL(path, root), "utf8");
    assert.match(source, /totalBolsas|item\.bolsas/, `${path} must render bag totals`);
    assert.match(source, /formatUnit\("BOLSA"\)/, `${path} must label bag totals with the shared formatter`);
  }
});

test("Task PIEZA reception summary uses the shared formatter", async () => {
  const source = await readFile(
    new URL("artifacts/mariana-textil/src/components/recepcion-salidas.tsx", root),
    "utf8",
  );
  assert.match(source, /totalPiezas/, "reception must support piece totals");
  assert.match(source, /formatUnit\("PIEZA"\)/, "reception must label pieces with the shared formatter");
});