import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
import { runInNewContext } from "node:vm";

const tiempoRealPage = readFileSync(new URL("./pages/caja/tiempo-real.tsx", import.meta.url), "utf8");
const cuentasDestinoPage = readFileSync(new URL("./pages/caja/cuentas-destino.tsx", import.meta.url), "utf8");
const sharedHook = readFileSync(new URL("./hooks/use-shared-cuentas-destino.ts", import.meta.url), "utf8");

test("Ambas pantallas consumen el mismo hook para cobranza (identidad de fuente)", () => {
  assert.match(sharedHook, /useGetAdminCuentasDestino/);
  assert.match(sharedHook, /getGetAdminCuentasDestinoQueryKey/);
  assert.match(tiempoRealPage, /useSharedCuentasDestino/);
  assert.match(cuentasDestinoPage, /useSharedCuentasDestino/);
  assert.doesNotMatch(tiempoRealPage, /useGetAdminCuentasDestino/);
  assert.doesNotMatch(cuentasDestinoPage, /useGetAdminCuentasDestino/);
});

test("El tablero llama a la función para leer el dinero del periodo sin cálculo manual", () => {
  assert.match(tiempoRealPage, /cuentasData\?\.encabezado/);
  assert.match(tiempoRealPage, /breakdown.*POS.*ABONO.*ABONO_SALDO_FAVOR/s);
  assert.match(tiempoRealPage, /Contado cobrado/);
  assert.doesNotMatch(tiempoRealPage, /Cobrado \(Caja\)/);
});

function calls(source: string, name: string) {
  const file = ts.createSourceFile("surface.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let count = 0;
  function visit(node: ts.Node) {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === name) count++;
    ts.forEachChild(node, visit);
  }
  visit(file);
  return count;
}

function assertSingleCollectionSource(real: string, destination: string, hook: string) {
  for (const surface of [real, destination]) {
    assert.equal(calls(surface, "useSharedCuentasDestino"), 1);
    assert.equal(calls(surface, "useGetAdminCuentasDestino"), 0);
    assert.doesNotMatch(surface, /(?:fetch|axios)[\s\S]{0,100}admin\/cuentas-destino/);
  }
  // The only independent queries are the existing dashboard and its breakdown.
  assert.equal(calls(real, "useQuery"), 1);
  assert.equal(calls(real, "fetch"), 1);
  assert.equal(calls(destination, "useQuery"), 0);
  assert.equal(calls(destination, "fetch"), 0);
  assert.equal(calls(hook, "useGetAdminCuentasDestino"), 1);
  assert.equal(calls(hook, "useQuery"), 0);
  assert.equal(calls(hook, "fetch"), 0);
}

test("La guarda rechaza una consulta paralela o el reemplazo de la fuente común", () => {
  assertSingleCollectionSource(tiempoRealPage, cuentasDestinoPage, sharedHook);
  assert.throws(() => assertSingleCollectionSource(
    tiempoRealPage + "\nuseQuery({queryFn: otraConsulta});",
    cuentasDestinoPage, sharedHook,
  ));
  assert.throws(() => assertSingleCollectionSource(
    tiempoRealPage.replace("= useSharedCuentasDestino(", "= otraConsulta("),
    cuentasDestinoPage, sharedHook,
  ));
});

test("El hook real entrega intactos importe y fuentes, con idénticos filtros y query key", () => {
  const serverHeader = {
    total: "0.00", contado: "0.00", abonos: "25000.00", saldosFavor: "-25000.00",
  };
  const response = { data: { encabezado: { cobrado: serverHeader } } };
  const observed: Array<{ params: unknown; options: unknown }> = [];
  const exports: Record<string, (...args: unknown[]) => typeof response> = {};
  const compiled = ts.transpileModule(sharedHook, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  runInNewContext(compiled, {
    exports,
    require(name: string) {
      assert.equal(name, "@workspace/api-client-react");
      return {
        getGetAdminCuentasDestinoQueryKey: (params: unknown) => ["destino", params],
        useGetAdminCuentasDestino: (params: unknown, options: unknown) => {
          observed.push({ params, options });
          return response;
        },
      };
    },
  });
  const useShared = exports.useSharedCuentasDestino;
  assert.ok(useShared);
  const dashboard = useShared(2, "2026-09-15", "2026-09-15", "hoy");
  const destinations = useShared(2, "2026-09-15", "2026-09-15", "hoy", false);
  assert.strictEqual(dashboard.data.encabezado.cobrado, serverHeader);
  assert.strictEqual(destinations.data.encabezado.cobrado, serverHeader);
  assert.equal(JSON.stringify(observed[0]), JSON.stringify(observed[1]));
  assert.equal(observed.length, 2);
});

test("Un error de cobranza no oculta las cuatro tarjetas existentes", () => {
  assert.match(tiempoRealPage, /const isLoading = dashLoading;/);
  assert.match(tiempoRealPage, /const isError = dashError \|\| pendingError;/);
  assert.match(tiempoRealPage, /No se pudo consultar la cobranza del periodo/);
  assert.match(tiempoRealPage, /timeZone: "America\/Mexico_City"/);
});

test("Los grupos POS/ABONO/saldos a favor tienen accesores espejo", () => {
  for (const source of ["POS", "ABONO", "ABONO_SALDO_FAVOR"]) {
    assert.match(tiempoRealPage, new RegExp(source));
    assert.match(cuentasDestinoPage, new RegExp(source));
  }
  assert.match(tiempoRealPage, /cuentasData\?\.encabezado/);
  assert.match(cuentasDestinoPage, /data\?\.encabezado/);
  for (const accessor of ["contado", "abonos", "saldosFavor"]) {
    const pattern = new RegExp(`amount:\\s*header\\.cobrado\\.${accessor}`);
    assert.match(tiempoRealPage, pattern);
    assert.match(cuentasDestinoPage, pattern);
  }
});
