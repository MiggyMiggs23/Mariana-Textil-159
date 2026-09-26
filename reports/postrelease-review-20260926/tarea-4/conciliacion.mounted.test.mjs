import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import test from "node:test";
import { createRequire } from "node:module";
import ts from "typescript";
const root = path.resolve(import.meta.dirname, "../../..");
const front = path.join(root, "artifacts/mariana-textil");
const req = createRequire(path.join(front, "package.json"));
const React = req("react"), { act } = React;
const { createRoot } = req("react-dom/client");
const { QueryClient, QueryClientProvider, useQuery, useQueryClient } = req("@tanstack/react-query");
const { JSDOM } = req("jsdom");
const dom = new JSDOM("<html><body><div id='root'></div></body></html>", { url: "http://localhost/conciliacion" });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, IS_REACT_ACT_ENVIRONMENT: true });
const primitive = tag => ({ children, ...props }) => React.createElement(tag, Object.fromEntries(Object.entries(props).filter(([key]) => ["role", "onClick", "disabled"].includes(key))), children);
let fail = true, requests = 0, mutations = 0;
const stubs = {
  react: React, "react/jsx-runtime": req("react/jsx-runtime"),
  wouter: { Link: primitive("a") },
  "@/pages/e11": { E11AdminNotices: () => null },
  "@/components/layout/app-layout": { AppLayout: primitive("main") },
  "@/components/product-combobox": { ProductCombobox: () => null },
  "@tanstack/react-query": { useQueryClient },
  "@/lib/permisos": { Modules: { CONCILIACION: "conciliacion" }, hasPermission: () => true },
  "@workspace/api-client-react": {
    useGetCurrentUser: () => ({ data: { rol: "ADMIN" } }),
    getGetCurrentUserQueryKey: () => ["/api/auth/me"],
    useListProductos: () => ({ data: [] }), useListLocations: () => ({ data: [] }),
    useGetConciliacion: params => useQuery({
      queryKey: ["/api/conciliacion", params], retry: false,
      queryFn: async () => { requests++; if (fail) throw new Error("SQL technical details"); return []; },
    }),
    useRecalcularExistencias: () => ({ mutate() { mutations++; }, isPending: false }),
    getGetConciliacionQueryKey: () => ["/api/conciliacion"],
  },
  "@workspace/number-format": { formatNumber: value => String(value) },
  sonner: { toast: { error() {}, success() {} } },
  "lucide-react": new Proxy({}, { get: () => () => null }),
};
for (const [file, exports] of Object.entries({
  card: ["Card", "CardContent", "CardHeader", "CardTitle", "CardDescription"], badge: ["Badge"],
  select: ["Select", "SelectContent", "SelectItem", "SelectTrigger", "SelectValue"],
  table: ["Table", "TableBody", "TableCell", "TableHead", "TableHeader", "TableRow"],
})) stubs[`@/components/ui/${file}`] = Object.fromEntries(exports.map(name => [name, primitive("div")]));
stubs["@/components/ui/button"] = { Button: primitive("button") };
const source = process.env.REVIEW_SOURCE || path.join(front, "src/pages/conciliacion.tsx");
const compiled = ts.transpileModule(fs.readFileSync(source, "utf8"), {
  fileName: source, reportDiagnostics: true,
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
});
assert.deepEqual(compiled.diagnostics, []);
const module = { exports: {} };
vm.runInThisContext(`(function(require,module,exports){${compiled.outputText}\n})`)(name => {
  assert.ok(name in stubs, `Unexpected dependency ${name}`);
  return stubs[name];
}, module, module.exports);
async function settle() {
  for (let i = 0; i < 4; i++) await act(async () => { await new Promise(resolve => setTimeout(resolve, 10)); });
}
test("mounted real query failure, DOM retry success, and stale refetch failure", async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  const mounted = createRoot(document.getElementById("root"));
  try {
    await act(async () => mounted.render(React.createElement(QueryClientProvider, { client }, React.createElement(module.exports.default))));
    await settle();
    assert.match(document.body.textContent, /No se pudo consultar la conciliación/);
    assert.doesNotMatch(document.body.textContent, /Las existencias coinciden|SQL technical/);
    assert.equal(Boolean(document.querySelector('[role="alert"]')), true);
    assert.equal(requests, 1);
    fail = false;
    await act(async () => document.querySelector("button").click());
    await settle();
    assert.match(document.body.textContent, /Las existencias coinciden/);
    assert.equal(requests, 2);
    assert.equal(mutations, 0, "retry must not repair inventory");
    fail = true;
    await act(async () => { await client.refetchQueries({ queryKey: ["/api/conciliacion"] }); });
    await settle();
    assert.match(document.body.textContent, /No se pudo consultar la conciliación/);
    assert.doesNotMatch(document.body.textContent, /Las existencias coinciden|SQL technical/);
    assert.equal(requests, 3);
  } finally {
    await act(async () => mounted.unmount());
    client.clear();
    dom.window.close();
  }
});