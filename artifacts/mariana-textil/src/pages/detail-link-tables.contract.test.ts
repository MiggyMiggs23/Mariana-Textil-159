import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../../../../", import.meta.url);

/**
 * Task #53 Block 3 review record. Table files with literal "Ver detalle",
 * "Detalle", or "Acción" headers/cells were reviewed as follows:
 * - clientes.tsx: REMOVE: the sole final Acción control navigated to /clientes/:id;
 *   Cliente is the stable primary identifier and is now the detail link.
 * - auditoria/index.tsx: KEEP: Detalle opens the audit detail sheet; it is not
 *   navigation to an entity detail route.
 * - conciliacion.tsx: KEEP: Acción recalculates inventory cache discrepancies.
 * - etiquetas.tsx: KEEP: Acción adds a roll to the label-print selection.
 * - entradas.tsx: KEEP: Detalle expands a draft line and coexists with editing controls.
 * - entradas-pendientes-costo.tsx: KEEP: Acción opens the cost-capture workflow.
 *
 * proveedores.tsx is also covered because its primary name is the existing
 * /proveedores/:id detail link. It already has no final detail-only action column.
 */
test("client and provider tables use accessible primary-name detail links", async () => {
  const [clientes, proveedores] = await Promise.all([
    readFile(new URL("artifacts/mariana-textil/src/pages/clientes.tsx", root), "utf8"),
    readFile(new URL("artifacts/mariana-textil/src/pages/proveedores.tsx", root), "utf8"),
  ]);

  assert.match(
    clientes,
    /<Link[\s\S]*?href=\{`\/clientes\/\$\{client\.id\}`\}[\s\S]*?className="text-primary underline underline-offset-4 hover:text-primary\/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"[\s\S]*?\{client\.nombre\}/,
  );
  assert.doesNotMatch(clientes, /<TableHead[^>]*>Acción<\/TableHead>/);
  assert.doesNotMatch(clientes, />Ver detalle</);

  assert.match(
    proveedores,
    /<Link[\s\S]*?href=\{`\/proveedores\/\$\{p\.id\}`\}[\s\S]*?className="block h-full w-full py-2 text-primary underline underline-offset-4 hover:text-primary\/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"[\s\S]*?\{p\.nombre\}/,
  );
  assert.doesNotMatch(proveedores, /<TableHead[^>]*>Acción<\/TableHead>/);
  assert.doesNotMatch(proveedores, />Ver detalle</);
});