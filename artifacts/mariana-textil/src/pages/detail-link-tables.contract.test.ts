import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../../../../", import.meta.url);
const primaryLinkClass =
  "text-primary underline underline-offset-4 hover:text-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";
const tableFiles = [
  "ajustes.tsx", "auditoria/index.tsx", "auditorias-inventario.tsx",
  "caja/comparativo.tsx", "caja/cortes.tsx", "caja/cuenta-destino-detalle.tsx",
  "caja/cuentas-destino.tsx", "caja/diferencias.tsx", "caja/tiempo-real.tsx",
  "cliente-detail.tsx", "clientes.tsx", "conciliacion.tsx",
  "configuracion/camionetas.tsx", "configuracion/choferes.tsx",
  "contenedores/detail.tsx", "contenedores/index.tsx", "contenedores/nuevo.tsx",
  "corte-detail-shared.tsx", "dashboard.tsx", "entradas-pendientes-costo.tsx",
  "entradas.tsx", "etiquetas.tsx", "inventario.tsx", "movimientos.tsx",
  "precios/detail.tsx", "precios/index.tsx", "producto-detail.tsx",
  "productos.tsx", "proveedor-detail.tsx", "proveedores.tsx",
  "rollo-detail.tsx", "ubicaciones.tsx", "usuarios.tsx",
];

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

test("table inventory has no obsolete Ver detalle column", async () => {
  const sources = await Promise.all(
    tableFiles.map((file) =>
      readFile(new URL(`artifacts/mariana-textil/src/pages/${file}`, root), "utf8"),
    ),
  );

  for (let index = 0; index < sources.length; index += 1) {
    assert.doesNotMatch(
      sources[index],
      /(?:<TableHead[^>]*>|<th[^>]*>)\s*Ver detalle\s*<\//i,
      `${tableFiles[index]} retains an obsolete Ver detalle column`,
    );
  }
});

test("detail-capable table identifiers have one primary link and declared routes", async () => {
  const [app, productos, movimientos, entradasPendientes, salidas, viajes, contenedores] =
    await Promise.all([
      readFile(new URL("artifacts/mariana-textil/src/App.tsx", root), "utf8"),
      readFile(new URL("artifacts/mariana-textil/src/pages/productos.tsx", root), "utf8"),
      readFile(new URL("artifacts/mariana-textil/src/pages/movimientos.tsx", root), "utf8"),
      readFile(new URL("artifacts/mariana-textil/src/pages/entradas-pendientes-costo.tsx", root), "utf8"),
      readFile(new URL("artifacts/mariana-textil/src/pages/salidas.tsx", root), "utf8"),
      readFile(new URL("artifacts/mariana-textil/src/pages/viajes.tsx", root), "utf8"),
      readFile(new URL("artifacts/mariana-textil/src/pages/contenedores/index.tsx", root), "utf8"),
    ]);

  for (const route of [
    "/productos/:id", "/inventario/rollos/:id", "/entradas/:id/documento",
    "/salidas/:id", "/tickets/:id", "/viajes/:id", "/contenedores/:id",
  ]) {
    assert.match(app, new RegExp(`path="${route}"`));
  }

  for (const [source, href, identifier] of [
    [productos, /href=\{`\/productos\/\$\{p\.id\}`\}/, /\{p\.color\}/],
    [movimientos, /href=\{row\.referenciaRolloRuta\}/, /\{row\.serie\}/],
    [entradasPendientes, /href=\{`\/entradas\/\$\{item\.id\}\/documento`\}/, /\{item\.folioFormateado\}/],
    [salidas, /href=\{`\/salidas\/\$\{salida\.id\}`\}/, /\{salida\.folioFormateado\}/],
    [viajes, /href=\{`\/viajes\/\$\{viaje\.id\}`\}/, /\{viaje\.folioFormateado\}/],
    [contenedores, /href=\{`\/contenedores\/\$\{item\.id\}`\}/, /\{item\.folio\.toString\(\)\.padStart/],
  ] as const) {
    assert.match(source, href);
    assert.match(source, identifier);
    assert.match(source, new RegExp(primaryLinkClass.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }

  assert.doesNotMatch(movimientos, /(?:link|mobile-link)-doc-/);
});