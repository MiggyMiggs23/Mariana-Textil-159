/** OFFLINE: the real grouped-inventory handler runs in an allowlisted VM. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import vm from "node:vm";
import ts from "typescript";

const routeSource = readFileSync(
  new URL("./routes/inventario.ts", import.meta.url),
  "utf8",
);
const routeStart = routeSource.indexOf(
  'inventarioRouter.get(\n  "/existencias/agrupadas"',
);
const routeEnd = routeSource.indexOf(
  'inventarioRouter.get(\n  "/existencias",',
  routeStart,
);
assert.ok(routeStart >= 0 && routeEnd > routeStart);

type ProductFixture = {
  id: number;
  sku: string;
  tela: string;
  color: string;
  unidad: "METRO";
  activo: boolean;
  rollos: Array<{ estado: string; ubicacionId: number; cantidad: number }>;
};

const products: ProductFixture[] = [
  {
    id: 1,
    sku: "ACT-STOCK",
    tela: "Lino",
    color: "Azul",
    unidad: "METRO",
    activo: true,
    rollos: [
      { estado: "DISPONIBLE", ubicacionId: 2, cantidad: 7 },
      { estado: "VENDIDO", ubicacionId: 1, cantidad: 99 },
    ],
  },
  {
    id: 2,
    sku: "ACT-ZERO",
    tela: "Lana",
    color: "Rojo",
    unidad: "METRO",
    activo: true,
    rollos: [],
  },
  {
    id: 3,
    sku: "INACTIVE-STOCK",
    tela: "Seda oculta",
    color: "Negro",
    unidad: "METRO",
    activo: false,
    rollos: [
      { estado: "DISPONIBLE", ubicacionId: 1, cantidad: 11 },
    ],
  },
  {
    id: 4,
    sku: "INACTIVE-ZERO",
    tela: "Mezclilla oculta",
    color: "Gris",
    unidad: "METRO",
    activo: false,
    rollos: [],
  },
];

function buildHarness() {
  const registrations: unknown[][] = [];
  const executed: Array<{ text: string; params: unknown[] }> = [];
  const router = {
    get(...args: unknown[]) {
      registrations.push(args);
    },
  };
  const sql = (strings: TemplateStringsArray, ...params: unknown[]) => ({
    text: strings.join("?"),
    params,
  });
  let isolated = routeSource.slice(routeStart, routeEnd);
  if (process.env.INVENTORY_ACTIVE_FILTER_MUTANT === "1") {
    isolated = isolated.replace("WHERE p.activo = true\n          AND (", "WHERE (");
  }
  const compiled = ts.transpileModule(isolated, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const db = {
    async execute(query: { text: string; params: unknown[] }) {
      executed.push(query);
      const [location, repeatedLocation, search, ...tail] = query.params;
      assert.equal(location, repeatedLocation);
      assert.deepEqual(tail.slice(0, 3), [search, search, search]);
      const includeWithoutStock = Boolean(tail[3]);
      const activeOnly = query.text.includes("p.activo = true");
      const needle = typeof search === "string"
        ? search.replaceAll("%", "").toLocaleLowerCase("es-MX")
        : null;
      const rows = products.flatMap((product) => {
        if (activeOnly && !product.activo) return [];
        if (
          needle &&
          ![product.tela, product.color, product.sku].some((value) =>
            value.toLocaleLowerCase("es-MX").includes(needle)
          )
        ) return [];
        const available = product.rollos.filter((roll) =>
          roll.estado === "DISPONIBLE" &&
          (location == null || roll.ubicacionId === location)
        );
        if (!includeWithoutStock && available.length === 0) return [];
        return [{
          producto_id: product.id,
          sku: product.sku,
          tela: product.tela,
          color: product.color,
          unidad: product.unidad,
          rollos_count: available.length,
          cantidad_total: available.reduce((sum, roll) => sum + roll.cantidad, 0),
        }];
      });
      return { rows };
    },
  };
  vm.runInNewContext(compiled, {
    inventarioRouter: router,
    requireSession: "session",
    requierePermiso: () => "inventory:read",
    GetExistenciasAgrupadasQueryParams: {
      parse: (query: Record<string, unknown>) => query,
    },
    GetExistenciasAgrupadasResponse: { parse: (value: unknown) => value },
    resolveReadScope: (_auth: unknown, ubicacionId: unknown) => ({
      ubicacionId,
      scopeError: null,
    }),
    db,
    sql,
    Map,
    Number,
    String,
  });
  assert.equal(registrations.length, 1);
  const [path, session, permission, handler] = registrations[0];
  assert.equal(path, "/existencias/agrupadas");
  assert.equal(session, "session");
  assert.equal(permission, "inventory:read");

  async function request(query: Record<string, unknown>) {
    let body: unknown;
    let error: unknown;
    await (handler as Function)(
      { query, auth: { user: { rol: "ADMIN" } } },
      {
        status() {
          throw new Error("Unexpected status");
        },
        json(value: unknown) {
          body = value;
        },
      },
      (value: unknown) => {
        error = value;
      },
    );
    assert.ifError(error);
    return JSON.parse(JSON.stringify(body)) as Array<{
      telaProducto: string;
      rollosCount: number;
      colores: Array<{ sku: string; cantidadTotal: string }>;
    }>;
  }
  return { request, executed };
}

test("grouped inventory returns only active products with stock, without stock, search and location scope", async () => {
  const harness = buildHarness();

  const stocked = await harness.request({ includeSinExistencia: false });
  assert.deepEqual(stocked.map((row) => row.telaProducto), ["Lino"]);
  assert.equal(stocked[0].rollosCount, 1);
  assert.equal(stocked[0].colores[0].cantidadTotal, "7.000");

  const includingZero = await harness.request({ includeSinExistencia: true });
  assert.deepEqual(
    includingZero.map((row) => row.telaProducto).sort(),
    ["Lana", "Lino"],
  );

  const inactiveSearch = await harness.request({
    includeSinExistencia: true,
    search: "oculta",
  });
  assert.deepEqual(inactiveSearch, []);

  const activeSearch = await harness.request({
    includeSinExistencia: true,
    search: "ACT-ZERO",
  });
  assert.deepEqual(activeSearch.map((row) => row.telaProducto), ["Lana"]);

  const wrongLocation = await harness.request({
    includeSinExistencia: false,
    ubicacionId: 1,
  });
  assert.deepEqual(wrongLocation, []);
  assert.equal(harness.executed.length, 5);
});