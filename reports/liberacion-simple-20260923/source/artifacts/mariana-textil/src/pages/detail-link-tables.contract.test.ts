import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  behaviorLinkHref,
  loadBehaviorLinksUnitsPages,
  renderBehaviorLinksUnitsPage,
} from "../behavior-links-units-render";

const root = new URL("../../../../", import.meta.url);
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

test("detail-capable table identifiers resolve their controlled primary keys", async () => {
  const pages = await loadBehaviorLinksUnitsPages();
  pages.setBehaviorFixture({
    user: { id: 1, nombre: "Admin", rol: "ADMIN", alcanceConsulta: "TODAS", permisos: [] },
    productos: [{ id: 701, tela: "Tela enlace", color: "Color enlace", sku: "SKU-701", unidad: "METRO", rollos: 1, cantidad: "3", sitiosConExistencia: 1, activo: true }],
    movimientos: { grupos: [{ groupId: "grupo-309", latestDate: "2026-02-10T12:00:00.000Z", fechaMin: "2026-02-10T12:00:00.000Z", fechaMax: "2026-02-10T12:00:00.000Z", tipo: "ALTA", documentoRuta: null, documentoTipo: null, documentoId: null, documentoEtiqueta: null, ticketId: null, justificacion: null, productos: [{ telaProducto: "Tela enlace", colorProducto: "Color enlace", skuProducto: "SKU-701" }], nombreUbicacion: "Central", ubicacionActiva: true, ubicacionId: 1, distinctRolloCount: 1, totalesPorUnidad: [{ unidad: "METRO", cantidad: "3" }], usuarios: [], partialitiesMerged: 1, rollos: [{ movementId: 901, rolloId: 309, serie: "ROLLO-SERIE-309", cantidad: "3", unidad: "METRO", referenciaRolloRuta: "/inventario/rollos/309" }] }], resumen: { totalMetros: "3", totalKilos: "0", totalBolsas: "0", totalPiezas: "0" }, total: 1, page: 1, totalPages: 1 },
    kardexFilters: { tipos: [], ubicaciones: [], productos: [], usuarios: [] },
    entradasPendientes: { items: [{ id: 211, folioFormateado: "EP-0088", fecha: "2026-02-10", nombreUbicacion: "Central", nombreProveedor: "Proveedor", rollosPendientes: 1, totalMetros: "3", totalKilos: "0", totalBolsas: "0", nombreUsuario: "Admin", overdue48h: false }] },
    salidas: { items: [{ id: 401, folioFormateado: "SAL-0042", createdAt: "2026-02-10T12:00:00.000Z", nombreOrigen: "Central", nombreDestino: "Norte", modalidad: "TRASLADO", totalCantidadSolicitada: "3", totalCantidadEnviada: "3", estado: "ARMANDO" }], total: 1, pageSize: 100 },
    ubicacionesSalida: [], usuarios: [],
    viajes: [{ id: 501, folioFormateado: "VIA-0007", nombreOrigen: "Central", salidaAt: "2026-02-10T12:00:00.000Z", camioneta: "Camioneta 1", chofer: "Chofer", documentos: 1 }],
    contenedores: { items: [{ id: 601, folio: 73, proveedor: "Proveedor", referencia: "REF", sitioDestino: "Central", estado: "EN_TRANSITO", diasParaLlegar: 4, fechaEstimadaLlegada: "2026-02-20", lineasCount: 0 }], total: 1, pageSize: 20 },
    catalogosContenedores: { proveedores: [], sitios: [], productos: [] },
  });

  const productHtml = renderBehaviorLinksUnitsPage(pages.Productos, { "productos.expanded-telas": new Set(["Tela enlace"]) }, pages.BehaviorLocationScopeProvider);
  const movementHtml = renderBehaviorLinksUnitsPage(pages.Movimientos, { "movimientos.expanded-groups": ["grupo-309"] }, pages.BehaviorLocationScopeProvider);
  const pendingHtml = renderBehaviorLinksUnitsPage(pages.EntradasPendientesCosto, {}, pages.BehaviorLocationScopeProvider);
  const salidaHtml = renderBehaviorLinksUnitsPage(pages.Salidas, {}, pages.BehaviorLocationScopeProvider);
  const viajeHtml = renderBehaviorLinksUnitsPage(pages.Viajes, {}, pages.BehaviorLocationScopeProvider);
  const contenedorHtml = renderBehaviorLinksUnitsPage(pages.Contenedores, {}, pages.BehaviorLocationScopeProvider);

  assert.equal(behaviorLinkHref(productHtml, "Color enlace"), "/productos/701");
  assert.equal(behaviorLinkHref(movementHtml, "ROLLO-SERIE-309"), "/inventario/rollos/309");
  assert.equal(behaviorLinkHref(pendingHtml, "#EP-0088"), "/entradas/211/documento");
  assert.equal(behaviorLinkHref(salidaHtml, "SAL-0042"), "/salidas/401");
  assert.equal(behaviorLinkHref(viajeHtml, "VIA-0007"), "/viajes/501");
  assert.equal(behaviorLinkHref(contenedorHtml, "#00073"), "/contenedores/601");

  assert.notEqual(behaviorLinkHref(movementHtml, "ROLLO-SERIE-309"), "/inventario/rollos/ROLLO-SERIE-309");
});