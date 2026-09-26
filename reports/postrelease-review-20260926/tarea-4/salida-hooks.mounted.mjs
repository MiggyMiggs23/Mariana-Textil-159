import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { createRequire } from "node:module";
import ts from "typescript";
const root = path.resolve(import.meta.dirname, "../../..");
const front = path.join(root, "reports/priority-20260926/credit-presentation/frozen-root/artifacts/mariana-textil");
const req = createRequire(path.join(root, "artifacts/mariana-textil/package.json"));
const React = req("react"), { act } = React;
const { createRoot } = req("react-dom/client");
const { JSDOM } = req("jsdom");
const dom = new JSDOM("<html><body><div id='root'></div></body></html>", { url: "http://localhost/salidas/nueva" });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, IS_REACT_ACT_ENVIRONMENT: true });
Object.assign(globalThis, {
  location: dom.window.location, history: dom.window.history, Event: dom.window.Event,
  addEventListener: dom.window.addEventListener.bind(dom.window),
  removeEventListener: dom.window.removeEventListener.bind(dom.window),
  dispatchEvent: dom.window.dispatchEvent.bind(dom.window),
});
const wouter = req("wouter");
const primitive = ({ children }) => React.createElement("div", null, children);
const ui = new Proxy({}, { get: () => primitive });
const user = { rol: "ADMIN" }, draft = { isSuccess: false, data: undefined };
const mutation = { isPending: false, mutate() { throw new Error("No writes allowed"); } };
const stubs = {
  react: React, "react/jsx-runtime": req("react/jsx-runtime"),
  wouter,
  "@/components/layout/app-layout": { AppLayout: primitive },
  "@/components/campo-escaneo": { CampoEscaneo: () => null },
  "@/components/salida-venta-cliente-nueva": { SalidaVentaClienteNueva: () => React.createElement("p", null, "VENTA_CLIENTE branch") },
  "@tanstack/react-query": { useQueryClient: () => ({ invalidateQueries() {} }) },
  "@workspace/api-client-react": {
    Role: { ADMIN: "ADMIN" }, useGetCurrentUser: () => ({ data: user }),
    useGetUbicacionesSalida: () => ({ data: [] }), useGetBorradorSalida: () => draft,
    useAgregarRolloBorradorSalida: () => mutation, useQuitarRolloBorradorSalida: () => mutation, useEnviarSalida: () => mutation,
    getGetCurrentUserQueryKey: () => [], getGetUbicacionesSalidaQueryKey: () => [],
    getGetBorradorSalidaQueryKey: () => [], getListSalidasQueryKey: () => [], getListSalidasRecepcionQueryKey: () => [],
  },
  "@/hooks/use-toast": { useToast: () => ({ toast() {} }) },
  "@/lib/api-error": { ApiErrorDetails: () => null, getApiErrorMessage: () => "" },
  "@workspace/number-format": { formatNumber: String, formatUnit: String },
  "@workspace/scanned-code": {},
  "date-fns": req("date-fns"), "date-fns/locale": req("date-fns/locale"),
  "lucide-react": new Proxy({}, { get: () => () => null }),
};
const file = process.env.REVIEW_SOURCE || path.join(front, "src/pages/salida-nueva.tsx");
const compiled = ts.transpileModule(fs.readFileSync(file, "utf8"), {
  fileName: file, reportDiagnostics: true,
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
});
assert.deepEqual(compiled.diagnostics, []);
const module = { exports: {} };
vm.runInThisContext(`(function(require,module,exports){${compiled.outputText}\n})`)(name => {
  if (name.startsWith("@/components/ui/")) return ui;
  assert.ok(name in stubs, `Unexpected dependency ${name}`);
  return stubs[name];
}, module, module.exports);
function RouteParent() {
  return React.createElement(wouter.Route, { path: "/salidas/nueva", component: module.exports.default });
}
const intervals = new Set(), nativeSet = globalThis.setInterval, nativeClear = globalThis.clearInterval;
globalThis.setInterval = () => { const id = {}; intervals.add(id); return id; };
globalThis.clearInterval = id => intervals.delete(id);
const observations = [], queryOnlyTransitions = [], errors = [];
const controlNode = document.createElement("div");
document.body.appendChild(controlNode);
const control = createRoot(controlNode);
await act(async () => control.render(React.createElement(module.exports.default)));
assert.equal(intervals.size, 1, "transfer alone installs one timer");
await act(async () => control.unmount());
assert.equal(intervals.size, 0, "ordinary transfer unmount cleans its timer");
controlNode.remove();
const mounted = createRoot(document.getElementById("root"), { onCaughtError: error => errors.push(error.message), onUncaughtError: error => errors.push(error.message) });
try {
  for (const search of ["", "?modalidad=VENTA_CLIENTE", "", "?modalidad=VENTA_CLIENTE"]) {
    await act(async () => {
      window.history.replaceState({}, "", `/salidas/nueva${search}`);
      mounted.render(React.createElement(RouteParent));
    });
    observations.push({ search, branch: document.body.textContent.includes("VENTA_CLIENTE branch") ? "sale" : "transfer", scannerIntervals: intervals.size, errors: [...errors] });
  }
  if (process.env.EXPECT_BASELINE !== "1") {
    for (const search of ["", "?modalidad=VENTA_CLIENTE"]) {
      await act(async () => window.history.replaceState({}, "", `/salidas/nueva${search}`));
      queryOnlyTransitions.push({ search, branch: document.body.textContent.includes("VENTA_CLIENTE branch") ? "sale" : "transfer", scannerIntervals: intervals.size });
    }
  }
} finally {
  await act(async () => mounted.unmount());
  globalThis.setInterval = nativeSet;
  globalThis.clearInterval = nativeClear;
  dom.window.close();
}
const result = { source: file, method: "actual page with real wouter Route/useLocation/useSearch, controlled history and parent rerender plus query-only navigation; peripheral API/child mocked; no full App/browser/DB claim", observations, queryOnlyTransitions, remainingAfterUnmount: intervals.size };
const expectedBaseline = process.env.EXPECT_BASELINE === "1";
fs.writeFileSync(path.join(import.meta.dirname, expectedBaseline ? "salida-hooks-baseline-routing.json" : "salida-hooks-fixed-routing.json"), JSON.stringify(result, null, 2) + "\n");
console.log(JSON.stringify(result, null, 2));
assert.deepEqual(observations.map(item => item.branch), ["transfer", "sale", "transfer", "sale"]);
assert.deepEqual(errors, []);
assert.deepEqual(observations.map(item => item.scannerIntervals), expectedBaseline ? [1, 1, 2, 2] : [1, 0, 1, 0]);
assert.equal(intervals.size, expectedBaseline ? 2 : 0, "scanner effects must be cleaned at modality switch and final unmount");
if (!expectedBaseline) {
  assert.deepEqual(queryOnlyTransitions.map(item => item.branch), ["transfer", "sale"], "query-only navigation reacts without a forced parent render");
  assert.deepEqual(queryOnlyTransitions.map(item => item.scannerIntervals), [1, 0]);
}