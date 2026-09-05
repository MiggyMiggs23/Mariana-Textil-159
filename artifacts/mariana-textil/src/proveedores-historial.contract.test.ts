import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("historial vive solo en la pestaña global de Proveedores", async () => {
  const proveedores = await readFile(new URL("./pages/proveedores.tsx", import.meta.url), "utf8");
  const clientes = await readFile(new URL("./pages/clientes.tsx", import.meta.url), "utf8");
  const app = await readFile(new URL("./App.tsx", import.meta.url), "utf8");

  assert.match(proveedores, /TabsTrigger value="historial">Historial de compras/);
  assert.match(proveedores, /<HistorialCompras \/>/);
  assert.doesNotMatch(clientes, /Historial de compras|HistorialCompras/);
  assert.doesNotMatch(app, /historial-compras|Historial de compras/);
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