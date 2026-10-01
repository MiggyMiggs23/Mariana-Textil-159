import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import test from "node:test";
import { createRequire } from "node:module";
import ts from "typescript";

// Test-only fixtures and boundary adapters. All four pagination/export targets
// and their pure formatting/scope helpers are loaded from unmodified source.
const workspace = path.resolve(import.meta.dirname, "../..");
const sourceRoot = path.resolve(workspace, process.env.SOURCE_ROOT || ".");
const front = path.join(sourceRoot, "artifacts/mariana-textil/src");
const requireFront = createRequire(path.join(workspace, "artifacts/mariana-textil/package.json"));
const React = requireFront("react");
const { act } = React;
const { createRoot } = requireFront("react-dom/client");
const { JSDOM } = requireFront("jsdom");
const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/reportes/clientes" });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, IS_REACT_ACT_ENVIRONMENT: true });
const primitive = tag => ({ children, ...props }) => React.createElement(tag,
  Object.fromEntries(Object.entries(props).filter(([key]) =>
    !["variant", "size", "asChild", "onValueChange", "value", "type"].includes(key))), children);
const defaults = { periodo: "personalizado", desde: "2026-09-01", hasta: "2026-09-30",
  modalidad: "TODO", productoIds: [], telas: [], colores: [], unidades: [],
  usuarioIds: [], clienteIds: [], proveedorIds: [], formasPago: [] };
let payload, filterProps, requests, downloads;
let search = "", siteId = 7, catalogos;
const user = { id: 999, rol: "ADMIN", alcanceConsulta: "TODAS" };
const stores = [{ id: 7, label: "Tienda 7" }, { id: 8, label: "Tienda 8" }];
const setLocation = () => {};
const stubs = {
  react: React, "react-dom": requireFront("react-dom"), "react/jsx-runtime": requireFront("react/jsx-runtime"),
  "@workspace/number-format": requireFront("@workspace/number-format"),
  "@tanstack/react-query": { useQueryClient: () => ({ invalidateQueries() {} }) },
  wouter: { Link: primitive("a"), useLocation: () => ["/reportes/clientes", setLocation], useSearch: () => search },
  sonner: { toast: { info() {} } },
  "lucide-react": new Proxy({}, { get: () => () => null }),
  "@/lib/utils": { cn: (...args) => args.filter(Boolean).join(" ") },
  "@/components/ui/table": Object.fromEntries(Object.entries({
    Table: "table", TableHeader: "thead", TableBody: "tbody", TableFooter: "tfoot",
    TableRow: "tr", TableHead: "th", TableCell: "td",
  }).map(([key, tag]) => [key, primitive(tag)])),
  "@/components/ui/card": { Card: primitive("section"), CardContent: primitive("div"), CardHeader: primitive("header"), CardTitle: primitive("h2") },
  "@/components/ui/button": { Button: primitive("button") },
  "@/components/layout/app-layout": { AppLayout: primitive("main") },
  "@/components/ui/tabs": { Tabs: primitive("div"), TabsList: primitive("div"), TabsTrigger: primitive("button") },
  "@/components/ui/toggle-group": { ToggleGroup: primitive("div"), ToggleGroupItem: primitive("button") },
  "@/components/reportes/report-warnings": { ReportWarnings: () => null },
  "@/components/reportes/report-kpis": { ReportKpis: ({ kpis }) => {
    assert.equal(kpis, payload.kpis, "KPI payload identity preserved");
    return React.createElement("p", { "data-testid": "kpi" }, kpis[0].value);
  } },
  "@/components/reportes/report-charts": { ReportCharts: ({ charts }) => {
    assert.equal(charts, payload.charts, "chart payload identity preserved");
    assert.equal(charts[0].data.length, 137);
    return null;
  } },
  "@/components/reportes/report-filter-bar": {
    DEFAULT_FILTERS: defaults,
    ReportFilterBar: props => {
      filterProps = props;
      return React.createElement("div", null,
        React.createElement("button", { onClick: props.onDownloadExcel, disabled: props.actionsDisabled }, "Exportar XLSX"),
        React.createElement("button", { onClick: props.onDownloadPdf, disabled: props.actionsDisabled }, "Exportar PDF"));
    },
  },
  "@/lib/location-scope": { useLocationScope: () => ({ selectedLocationId: 99 }) },
  "@/components/credit-site-scope": { useCreditSiteScope: () => ({ ready: true, selectedSiteId: siteId, stores, loadingStores: false }) },
  "@workspace/api-client-react": {
    GetAdminDiferenciasAgrupacion: { semana: "semana" },
    useGetCurrentUser: () => ({ data: user }),
    useGetReportesCatalogos: () => ({ data: catalogos }),
    getGetReporteSeccionQueryKey: (section, params) => ["/api/reportes", section, params],
    useGetReporteSeccion: (section, params, options) => {
      requests.push({ section, params, options });
      return { data: section === "clientes" ? payload : { tables: [makeBlock("resolved")] },
        isLoading: false, isError: false, refetch() {} };
    },
  },
};
for (const [file, name] of [["ventas-tab", "VentasTab"], ["que-comprar-tab", "QueComprarTab"],
  ["utilidad-tab", "UtilidadTab"], ["control-operativo-tab", "ControlOperativoTab"]]) {
  stubs[`@/components/reportes/tabs/${file}`] = { [name]: () => null };
}
const cache = new Map();
function load(file) {
  if (cache.has(file)) return cache.get(file);
  const source = fs.readFileSync(file, "utf8");
  const compiled = ts.transpileModule(source, { fileName: file, reportDiagnostics: true,
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } });
  assert.deepEqual(compiled.diagnostics, [], `Syntax diagnostics in ${file}`);
  const module = { exports: {} };
  cache.set(file, module.exports);
  vm.runInThisContext(`(function(require,module,exports){${compiled.outputText}\n})`, { filename: file })(name => {
    if (name in stubs) return stubs[name];
    if (name.startsWith("@/") || name.startsWith(".")) {
      const base = name.startsWith("@/") ? path.join(front, name.slice(2)) : path.resolve(path.dirname(file), name);
      const resolved = [base, `${base}.ts`, `${base}.tsx`].find(p => fs.existsSync(p) && fs.statSync(p).isFile());
      assert.ok(resolved, `Missing local dependency ${name}`);
      return load(resolved);
    }
    return requireFront(name);
  }, module, module.exports);
  cache.set(file, module.exports);
  return module.exports;
}
const { ReportTable } = load(path.join(front, "components/reportes/report-table.tsx"));
const { GenericReportRenderer } = load(path.join(front, "components/reportes/generic-report-renderer.tsx"));
const { ClientesTab } = load(path.join(front, "components/reportes/tabs/clientes-tab.tsx"));
const Reportes = load(path.join(front, "pages/reportes.tsx")).default;
function makeBlock(id = "credit") {
  return { id, title: id, columns: [
    { key: "cliente", label: "Cliente", kind: "text" },
    { key: "saldo", label: "Saldo", kind: "money" },
  ], rows: Array.from({ length: 137 }, (_, i) => ({
    id: i + 1, cliente: `Cliente ${String(i + 1).padStart(3, "0")}`, saldo: String(137 - i),
  })), totals: { cliente: "Total original del servidor", saldo: "987654.32" } };
}
function reset() {
  payload = { tables: [makeBlock(), makeBlock("second")], hasEconomicAccess: true,
    kpis: [{ value: "KPI completo 987654.32" }], charts: [{ data: makeBlock().rows }] };
  requests = []; downloads = []; search = ""; siteId = 7; catalogos = undefined;
}
async function mount(component) {
  const host = document.createElement("div"); document.body.append(host);
  const root = createRoot(host);
  await act(async () => root.render(component));
  return { host, render: async value => act(async () => root.render(value)),
    close: async () => { await act(async () => root.unmount()); host.remove(); } };
}
const table = (host, id = "credit") => host.querySelector(`[data-testid="report-table-${id}"]`);
const rows = el => [...el.querySelectorAll('tbody tr[data-testid]')];
const labels = el => rows(el).map(row => row.cells[0].textContent);
const status = el => el.querySelector('[role="status"]').textContent;
const button = (el, name) => [...el.querySelectorAll("button")].find(b => b.textContent === name);
const click = async (el, name) => { await act(async () => button(el, name).click()); };
const size = async (el, value) => { await act(async () => {
  el.querySelector("select").value = String(value);
  el.querySelector("select").dispatchEvent(new window.Event("change", { bubbles: true }));
}); };
const footer = el => el.querySelector("tfoot").textContent;
const sort = async el => act(async () => el.querySelector('[data-testid="th-saldo"]').click());
const ascendingLabels = Array.from({ length: 137 }, (_, i) => `Cliente ${String(137 - i).padStart(3, "0")}`);
const descendingLabels = [...ascendingLabels].reverse();

test("137 rows: numeric-string global sorting precedes slicing, both directions, original rows/totals immutable", async () => {
  reset(); const block = payload.tables[0]; const before = JSON.stringify(block);
  const m = await mount(React.createElement(ReportTable, { block, hasEconomicAccess: true, paginationKey: "a" }));
  try {
    const el = table(m.host), originalFooter = footer(el);
    assert.equal(rows(el).length, 50);
    await click(el, "Siguiente");
    await sort(el);
    assert.match(status(el), /Página 1 de 3/);
    assert.deepEqual(labels(el), ascendingLabels.slice(0, 50));
    await click(el, "Siguiente");
    assert.deepEqual(labels(el), ascendingLabels.slice(50, 100));
    await click(el, "Siguiente");
    assert.deepEqual(labels(el), ascendingLabels.slice(100));
    assert.equal(footer(el), originalFooter);
    await sort(el);
    assert.deepEqual(labels(el), descendingLabels.slice(0, 50));
    await click(el, "Siguiente");
    assert.deepEqual(labels(el), descendingLabels.slice(50, 100));
    assert.equal(footer(el), originalFooter);
    assert.equal(JSON.stringify(block), before);
  } finally { await m.close(); }
});

test("25/50/100: complete coverage, last partial page and boundary buttons; page-size changes reset page", async () => {
  reset(); const m = await mount(React.createElement(ReportTable, { block: payload.tables[0], hasEconomicAccess: true, paginationKey: "a" }));
  try {
    const el = table(m.host), originalFooter = footer(el);
    for (const n of [25, 50, 100]) {
      await size(el, n);
      assert.match(status(el), new RegExp(`Página 1 de ${Math.ceil(137 / n)}`));
      assert.equal(button(el, "Anterior").disabled, true);
      const seen = [];
      for (let p = 1; p <= Math.ceil(137 / n); p++) {
        seen.push(...labels(el));
        assert.equal(rows(el).length, Math.min(n, 137 - (p - 1) * n));
        assert.equal(footer(el), originalFooter);
        if (p < Math.ceil(137 / n)) await click(el, "Siguiente");
      }
      assert.equal(button(el, "Siguiente").disabled, true);
      assert.equal(new Set(seen).size, 137);
      assert.deepEqual(seen, descendingLabels);
      assert.match(status(el), /de 137$/);
    }
  } finally { await m.close(); }
});

test("filter-context changes and row replacements reset; each generic-renderer table has independent state; empty report", async () => {
  reset();
  const props = { data: payload, isLoading: false, isError: false, refetch() {}, section: "clientes", tablePaginationKey: "scopeA" };
  const m = await mount(React.createElement(GenericReportRenderer, props));
  try {
    const a = table(m.host), b = table(m.host, "second");
    await size(a, 25); await click(a, "Siguiente"); await click(a, "Siguiente");
    assert.match(status(a), /Página 3 de 6/);
    assert.match(status(b), /Página 1 de 3/);
    await click(b, "Siguiente");
    assert.match(status(a), /Página 3 de 6/);
    assert.match(status(b), /Página 2 de 3/);
    await m.render(React.createElement(GenericReportRenderer, { ...props, tablePaginationKey: "scopeB" }));
    assert.match(status(a), /Página 1 de 6/); assert.match(status(b), /Página 1 de 3/);
    await click(a, "Siguiente");
    payload.tables[0] = { ...payload.tables[0], rows: [...payload.tables[0].rows] };
    await m.render(React.createElement(GenericReportRenderer, { ...props, tablePaginationKey: "scopeB" }));
    assert.match(status(a), /Página 1 de 6/);
    payload.tables[0] = { ...payload.tables[0], rows: [] };
    await m.render(React.createElement(GenericReportRenderer, { ...props, tablePaginationKey: "scopeB" }));
    assert.equal(rows(a).length, 0); assert.match(a.textContent, /No hay datos disponibles/);
    assert.match(status(a), /Página 1 de 1 · Filas 0–0 de 0/);
    assert.equal(button(a, "Anterior").disabled, true); assert.equal(button(a, "Siguiente").disabled, true);
    assert.equal(a.querySelector("tfoot"), null);
  } finally { await m.close(); }
});

test("print button and browser events synchronously expose all sorted rows then restore exact page and footer", async () => {
  reset(); const m = await mount(React.createElement(GenericReportRenderer, {
    data: payload, isLoading: false, isError: false, refetch() {}, section: "clientes", tablePaginationKey: "print",
  }));
  try {
    const a = table(m.host), b = table(m.host, "second");
    await size(a, 25); await sort(a); await click(a, "Siguiente"); await click(a, "Siguiente");
    await click(b, "Siguiente");
    const pageA = labels(a), pageB = labels(b), footA = footer(a), footB = footer(b);
    let printed = 0;
    window.print = () => {
      window.dispatchEvent(new window.Event("beforeprint"));
      assert.deepEqual(labels(a), ascendingLabels, "beforeprint flushes synchronously");
      assert.equal(rows(b).length, 137);
      assert.equal(footer(a), footA); assert.equal(footer(b), footB);
      printed++;
      window.dispatchEvent(new window.Event("afterprint"));
    };
    await click(a, "Imprimir reporte completo");
    assert.equal(printed, 1);
    assert.deepEqual(labels(a), pageA); assert.deepEqual(labels(b), pageB);
    assert.match(status(a), /Página 3 de 6/); assert.match(status(b), /Página 2 de 3/);
    await act(async () => window.dispatchEvent(new window.Event("beforeprint")));
    assert.equal(rows(a).length, 137);
    await act(async () => window.dispatchEvent(new window.Event("afterprint")));
    assert.deepEqual(labels(a), pageA);
  } finally { await m.close(); }
});

test("ClientesTab opts in only credit tables; same exact filter params to hooks; comparison frames paginate independently", async () => {
  reset(); const params = { desde: "2026-09-01", hasta: "2026-09-30", clienteIds: [11, 12], ubicacionIds: [7] };
  const m = await mount(React.createElement(ClientesTab, { apiParams: params, isDateRangeValid: true }));
  try {
    assert.equal(rows(table(m.host)).length, 50);
    assert.equal(rows(table(m.host, "resolved")).length, 137, "resolved requests retain unpaginated presentation");
    for (const request of requests) assert.equal(request.params, params);
    await click(table(m.host), "Siguiente");
    await m.render(React.createElement(ClientesTab, { apiParams: { ...params, clienteIds: [13] }, isDateRangeValid: true }));
    assert.match(status(table(m.host)), /Página 1 de 3/);
    const frames = stores.map(s => ({ siteId: s.id, siteLabel: s.label, apiParams: { ...params, ubicacionIds: [s.id] } }));
    await m.render(React.createElement(ClientesTab, { apiParams: params, isDateRangeValid: true, comparisonMode: true, comparisonFrames: frames }));
    const credits = [...m.host.querySelectorAll('[data-testid="report-table-credit"]')];
    assert.equal(credits.length, 2);
    await click(credits[0], "Siguiente");
    assert.match(status(credits[0]), /Página 2 de 3/); assert.match(status(credits[1]), /Página 1 de 3/);
    for (const f of frames) assert.ok(requests.some(r => r.params === f.apiParams));
  } finally { await m.close(); }
});

test("mounted Reportes XLSX/PDF requests identical before/after page/size/sort; complete filter/site scope and untouched payload", async () => {
  reset(); const originalPayload = JSON.stringify(payload);
  globalThis.fetch = async (url, options) => { downloads.push({ url, options }); return { ok: true, blob: async () => new Blob(["test-only-download-boundary"]) }; };
  URL.createObjectURL = () => "blob:test"; URL.revokeObjectURL = () => {};
  const originalAnchorClick = window.HTMLAnchorElement.prototype.click;
  window.HTMLAnchorElement.prototype.click = () => {};
  const m = await mount(React.createElement(Reportes));
  try {
    await click(m.host, "Exportar XLSX"); await click(m.host, "Exportar PDF");
    const a = table(m.host);
    await size(a, 25); await sort(a); await click(a, "Siguiente"); await click(a, "Siguiente");
    await click(m.host, "Exportar XLSX"); await click(m.host, "Exportar PDF");
    assert.deepEqual(downloads.slice(0, 2), downloads.slice(2, 4));
    for (const [i, d] of downloads.entries()) {
      const url = new URL(d.url, "http://localhost");
      assert.equal(url.pathname, `/api/reportes/vistas/clientes/export.${i % 2 ? "pdf" : "xlsx"}`);
      assert.equal(d.options.credentials, "include");
      assert.equal(url.searchParams.get("ubicacionIds"), "7");
      assert.equal(url.searchParams.get("ubicacionId"), "7");
      assert.equal(url.searchParams.get("desde"), "2026-09-01");
      assert.equal(url.searchParams.get("hasta"), "2026-09-30");
      assert.equal(url.searchParams.get("modo"), "normal");
      assert.ok(![...url.searchParams.keys()].some(k => /page|offset|limit|pagin/i.test(k)));
    }
    await act(async () => filterProps.onChange({ ...defaults, clienteIds: [11, 12], modalidad: "ROLLOS" }));
    assert.match(status(a), /Página 1 de 6/);
    await click(m.host, "Exportar XLSX");
    const changed = new URL(downloads.at(-1).url, "http://localhost");
    assert.equal(changed.searchParams.get("clienteIds"), "11,12");
    assert.equal(changed.searchParams.get("modalidad"), "ROLLOS");
    assert.equal(JSON.stringify(payload), originalPayload);
    assert.equal(m.host.querySelector('[data-testid="kpi"]').textContent, "KPI completo 987654.32");
    for (const r of requests) assert.ok(!Object.keys(r.params).some(k => /page|offset|limit|pagin/i.test(k)));
  } finally { await m.close(); window.HTMLAnchorElement.prototype.click = originalAnchorClick; }
});

test("mounted comparison exports include exactly credit stores, not header scope or pagination", async () => {
  reset(); siteId = null; search = "modo=comparar&periodo=personalizado&desde=2026-09-01&hasta=2026-09-30";
  catalogos = { suppliers: [], fabrics: [], colors: [], products: [], units: [], users: [], clients: [],
    paymentMethods: [], comparisonLocations: [...stores, { id: 99, label: "Bodega excluida" }] };
  globalThis.fetch = async (url, options) => { downloads.push({ url, options }); return { ok: true, blob: async () => new Blob(["test-only"]) }; };
  const originalAnchorClick = window.HTMLAnchorElement.prototype.click;
  window.HTMLAnchorElement.prototype.click = () => {};
  const m = await mount(React.createElement(Reportes));
  try {
    const credits = [...m.host.querySelectorAll('[data-testid="report-table-credit"]')];
    assert.equal(credits.length, 2);
    await click(m.host, "Exportar PDF");
    await size(credits[0], 100); await click(credits[0], "Siguiente");
    await click(m.host, "Exportar PDF");
    assert.deepEqual(downloads[0], downloads[1]);
    const url = new URL(downloads[0].url, "http://localhost");
    assert.equal(url.searchParams.get("ubicacionIds"), "7,8");
    assert.equal(url.searchParams.get("modo"), "comparar");
    assert.equal(url.searchParams.has("ubicacionId"), false);
    assert.ok(![...url.searchParams.keys()].some(k => /page|offset|limit|pagin/i.test(k)));
  } finally { await m.close(); window.HTMLAnchorElement.prototype.click = originalAnchorClick; }
});

test.after(() => dom.window.close());