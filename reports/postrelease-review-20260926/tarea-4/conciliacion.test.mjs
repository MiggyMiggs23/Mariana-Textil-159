import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import test from "node:test";
import { createRequire } from "node:module";
import ts from "typescript";

const root = path.resolve(import.meta.dirname, "../../..");
const front = path.join(root, "artifacts/mariana-textil");
const requireFront = createRequire(path.join(front, "package.json"));
const React = requireFront("react");
const { renderToStaticMarkup } = requireFront("react-dom/server");
const source = process.env.REVIEW_SOURCE || path.join(front, "src/pages/conciliacion.tsx");
let query;
let retry;
const primitive = tag => ({ children }) => React.createElement(tag, null, children);
const stubs = {
  react: React,
  "react/jsx-runtime": requireFront("react/jsx-runtime"),
  wouter: { Link: primitive("a") },
  "@/pages/e11": { E11AdminNotices: () => null },
  "@/components/layout/app-layout": { AppLayout: primitive("main") },
  "@/components/product-combobox": { ProductCombobox: () => null },
  "@tanstack/react-query": { useQueryClient: () => ({ invalidateQueries() {} }) },
  "@/lib/permisos": { Modules: { CONCILIACION: "conciliacion" }, hasPermission: () => true },
  "@workspace/api-client-react": {
    useGetCurrentUser: () => ({ data: { rol: "ADMIN" } }),
    getGetCurrentUserQueryKey: () => ["/api/auth/me"],
    useListProductos: () => ({ data: [] }),
    useListLocations: () => ({ data: [] }),
    useGetConciliacion: () => query,
    useRecalcularExistencias: () => ({ mutate() {}, isPending: false }),
    getGetConciliacionQueryKey: () => ["/api/conciliacion"],
  },
  "@workspace/number-format": { formatNumber: value => String(value) },
  sonner: { toast: { error() {}, success() {} } },
  "lucide-react": new Proxy({}, { get: () => () => null }),
};
for (const [file, exports] of Object.entries({
  card: ["Card", "CardContent", "CardHeader", "CardTitle", "CardDescription"],
  button: ["Button"], badge: ["Badge"],
  select: ["Select", "SelectContent", "SelectItem", "SelectTrigger", "SelectValue"],
  table: ["Table", "TableBody", "TableCell", "TableHead", "TableHeader", "TableRow"],
})) stubs[`@/components/ui/${file}`] = Object.fromEntries(exports.map(name => [name, primitive("div")]));
stubs["@/components/ui/button"].Button = ({ children, onClick }) => {
  if (children === "Reintentar") retry = onClick;
  return React.createElement("button", null, children);
};
const compiled = ts.transpileModule(fs.readFileSync(source, "utf8"), {
  fileName: source, reportDiagnostics: true,
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
});
assert.deepEqual(compiled.diagnostics, []);
const module = { exports: {} };
vm.runInThisContext(`(function(require,module,exports){${compiled.outputText}\n})`)(name => {
  assert.ok(name in stubs, `Unexpected dependency: ${name}`);
  return stubs[name];
}, module, module.exports);
function render(state) {
  query = { isLoading: false, isError: false, refetch() {}, ...state };
  return renderToStaticMarkup(React.createElement(module.exports.default));
}
test("failed reconciliation never claims inventory matches ledger or offers repair", () => {
  for (const data of [undefined, [], [{ productoId: 1, ubicacionId: 1, discrepancia: true }]]) {
    const html = render({ isError: true, data, error: new Error("HTTP 500: database internal detail") });
    assert.match(html, /No se pudo consultar la conciliación/);
    assert.doesNotMatch(html, /Las existencias coinciden|Recalcular|database internal detail/);
    assert.match(html, /Reintentar/);
  }
});
test("loading remains pending, successful empty and matching queries remain healthy", () => {
  assert.match(render({ isLoading: true }), /Analizando integridad/);
  assert.doesNotMatch(render({ isLoading: true }), /Las existencias coinciden/);
  assert.match(render({ data: [] }), /Las existencias coinciden/);
  assert.match(render({ data: [{ discrepancia: false }] }), /1 combinaciones/);
});
test("successful discrepancies still show repair and ledger values", () => {
  const html = render({ data: [{
    productoId: 12, ubicacionId: 3, ubicacionNombre: "Sitio de prueba", ubicacionActiva: true,
    discrepancia: true, cantidadMovimientos: "12", cantidadCache: "10",
    rollosMovimientos: 2, rollosCache: 1,
  }] });
  assert.match(html, /Discrepancias Encontradas/);
  assert.match(html, /Recalcular/);
  assert.doesNotMatch(html, /Las existencias coinciden/);
});
test("retry calls query refetch without invoking a recalculation mutation", () => {
  let calls = 0;
  render({ isError: true, refetch: () => { calls++; return Promise.resolve(); } });
  assert.equal(typeof retry, "function");
  retry();
  assert.equal(calls, 1);
});