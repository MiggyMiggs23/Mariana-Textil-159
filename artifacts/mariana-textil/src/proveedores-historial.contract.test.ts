import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("historial vive solo en la pestaña global de Proveedores", async () => {
  const proveedores = await readFile(new URL("./pages/proveedores.tsx", import.meta.url), "utf8");
  const clientes = await readFile(new URL("./pages/clientes.tsx", import.meta.url), "utf8");
  const app = await readFile(new URL("./App.tsx", import.meta.url), "utf8");

  assert.match(proveedores, /TabsTrigger value="historial">Últimas compras/);
  assert.match(proveedores, /<HistorialCompras \/>/);
  assert.doesNotMatch(clientes, /Historial de compras|HistorialCompras/);
  assert.doesNotMatch(app, /historial-compras|Historial de compras/);
});

test("directorio y formularios de proveedor incluyen RFC sin reemplazar el historial", async () => {
  const directory = await readFile(new URL("./pages/proveedores.tsx", import.meta.url), "utf8");
  const detail = await readFile(new URL("./pages/proveedor-detail.tsx", import.meta.url), "utf8");
  const migration = await readFile(new URL("../../../lib/db/migrations/20260925_supplier_rfc.sql", import.meta.url), "utf8");
  assert.match(directory, /\[p\.nombre, p\.rfc, p\.contactoNombre, p\.telefono\].*\.some/s);
  assert.match(directory, /data-testid="input-create-supplier-rfc"/);
  assert.match(detail, /data-testid="input-edit-supplier-rfc"/);
  assert.match(detail, /data-testid="display-supplier-rfc"/);
  assert.match(migration, /ALTER TABLE proveedores ADD COLUMN IF NOT EXISTS rfc text;/);
  assert.doesNotMatch(migration, /\b(?:UPDATE|DELETE|INSERT|DROP|TRUNCATE)\b/i);
});

test("simplificación aprobada conserva tipo textual y purga solo con acciones aplicables", async () => {
  const source = await readFile(new URL("./pages/proveedores.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(source, /Building2|Globe2/);
  assert.match(source, /<Badge variant="outline" className=\{p\.tipo[\s\S]*?\{p\.tipo\}\s*<\/Badge>/);
  assert.match(source, /const showActions = user\?\.rol === "ADMIN" && sortedProveedores\.some\(p => !p\.activo\)/);
  assert.match(source, /\{showActions && <TableHead className="text-right">Acciones<\/TableHead>\}/);
  assert.match(source, /\{showActions && \(\s*<TableCell[\s\S]*?!p\.activo && <PurgaCatalogoButton/);
  assert.match(source, /<details[^>]*data-testid="supplier-analytics-details">[\s\S]*?<summary[^>]*>Gráficos y desgloses/);
  assert.match(source, /<TabsTrigger value="historial">Últimas compras<\/TabsTrigger>/);
});

test("conteos exigen ambos permisos y siguen limitados al sitio autorizado", async () => {
  const route = await readFile(new URL("../../api-server/src/routes/proveedores.ts", import.meta.url), "utf8");
  const directory = route.match(/router\.get\(\s*"\/proveedores\/directorio",([\s\S]*?)\n\);/)?.[1];
  assert.ok(directory, "ruta aditiva de directorio");
  assert.match(directory, /requierePermiso\("proveedores", "ver"\),\s*requierePermiso\("proveedores_finanzas", "ver"\)/);
  assert.match(directory, /resolveReadScope\(req\.auth!\)/);
  assert.match(directory, /if \(scopeError\) \{\s*res\.status\(403\)/);
  assert.match(directory, /e\.ubicacion_id = \$\{ubicacionId \?\? null\}/);
  const ui = await readFile(new URL("./pages/proveedores.tsx", import.meta.url), "utf8");
  assert.match(ui, /enabled: activeTab === "proveedores" && canViewFinanzas/);
  assert.match(ui, /\{canViewFinanzas && heading\("demanda", "Compras en periodo", true\)\}/);
});

test("última compra deja fechas ausentes al final en ambos sentidos sin mutar filas", async () => {
  const { sortSupplierDirectoryRows } = await import("./lib/supplier-directory-sort");
  const rows = [
    { id: 1, nombre: "Sin compra", tipo: "NACIONAL", activo: true, ultimaCompra: null },
    { id: 2, nombre: "Vieja", tipo: "NACIONAL", activo: true, ultimaCompra: "2025-01-01T00:00:00Z" },
    { id: 3, nombre: "Nueva", tipo: "NACIONAL", activo: true, ultimaCompra: "2026-01-01T00:00:00Z" },
    { id: 4, nombre: "Sin compra 2", tipo: "NACIONAL", activo: true, ultimaCompra: null },
  ];
  const counts = new Map<number, number>();
  assert.deepEqual(sortSupplierDirectoryRows(rows, "ultima", "desc", counts).map(row => row.id), [3, 2, 1, 4]);
  assert.deepEqual(sortSupplierDirectoryRows(rows, "ultima", "asc", counts).map(row => row.id), [2, 3, 1, 4]);
  assert.deepEqual(rows.map(row => row.id), [1, 2, 3, 4]);
});

test("tabla conserva seis columnas, enlace único, unidad, sticky y altura limitada", async () => {
  const source = await readFile(
    new URL("./components/proveedores/historial-compras.tsx", import.meta.url),
    "utf8",
  );
  assert.match(source, /max-h-\[600px\]/);
  assert.match(source, /sticky top-0/);
  assert.equal((source.match(/<Link/g) ?? []).length, 1);
  assert.match(source, /formatNumber\(row\.cantidad, \{ kind: "quantity" \}\).*formatUnit\(row\.unidad\)/s);
  assert.doesNotMatch(source, /Totales?|Ver detalle/i);
});

test("una acción de filtro escribe la dirección exactamente una vez", async () => {
  const source = await readFile(
    new URL("./components/proveedores/historial-compras.tsx", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(
    source,
    /useEffect\(\(\) => \{[\s\S]*?history\.replaceState[\s\S]*?\}, \[/,
    "La dirección no debe escribirse desde un efecto reactivo",
  );
  assert.match(
    source,
    /handleMultiSelectChange[\s\S]*writeCombinedFilterCriteriaFromUserAction/,
    "El cambio de selección debe escribir desde el handler de la acción",
  );
  const { writeCombinedFilterCriteriaFromUserAction } = await import(
    "./components/shared/combined-filter-url"
  );
  const location = {
    pathname: "/proveedores",
    search: "?tab=historial",
    hash: "",
  };
  let writes = 0;
  const history = {
    state: { preserved: true },
    replaceState(_state: unknown, _unused: string, url?: string | URL | null) {
      writes += 1;
      const next = new URL(String(url), "https://example.test");
      location.pathname = next.pathname;
      location.search = next.search;
      location.hash = next.hash;
    },
  };
  const criteria = {
    proveedorIds: [7],
    ubicacionIds: [],
    telas: [],
    colores: [],
  };

  writeCombinedFilterCriteriaFromUserAction(criteria, location, history);
  writeCombinedFilterCriteriaFromUserAction(criteria, location, history);

  assert.equal(writes, 1);
  assert.equal(location.search, "?tab=historial&proveedorIds=7");
});