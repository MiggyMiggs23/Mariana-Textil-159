import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import test from "node:test";
import { createRequire } from "node:module";
import ts from "typescript";
const front = path.join(import.meta.dirname, "frozen-root/artifacts/mariana-textil");
const requireFront = createRequire(path.join(front, "package.json"));
const React = requireFront("react"), { act } = React;
const { createRoot } = requireFront("react-dom/client");
const { flushSync } = requireFront("react-dom");
const jsdomName = fs.readdirSync("node_modules/.pnpm").find(n => n.startsWith("jsdom@"));
const { JSDOM } = createRequire(path.resolve("package.json"))(path.resolve("node_modules/.pnpm", jsdomName, "node_modules/jsdom"));
const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/reportes/clientes" });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, IS_REACT_ACT_ENVIRONMENT: true });
const primitive = tag => ({ children, ...props }) => React.createElement(tag, Object.fromEntries(Object.entries(props).filter(([key]) => !["variant", "size", "asChild", "onValueChange", "type"].includes(key))), children);
const block = {
  id: "credit-fixture", title: "Crédito completo", columns: [
    { key: "cliente", label: "Cliente", kind: "text" },
    { key: "saldo", label: "Saldo", kind: "money" },
  ],
  rows: Array.from({ length: 137 }, (_, i) => ({ id: i + 1, cliente: `Cliente ${String(i + 1).padStart(3, "0")}`, saldo: String(137 - i) })),
  totals: { saldo: "9453" },
};
const originalRows = JSON.stringify(block.rows), originalTotals = JSON.stringify(block.totals);
let payload = { tables: [block], kpis: [{ label: "Total completo", value: "9453" }], charts: [{ id: "all", data: block.rows }], hasEconomicAccess: true };
const requested = [], exported = [];
let filterProps;
const defaults = { periodo: "anual", modalidad: "TODO", productoIds: [], telas: [], colores: [], unidades: [], usuarioIds: [], clienteIds: [], proveedorIds: [], formasPago: [] };
const setLocation = () => {};
const stubs = {
  react: React, "react-dom": { flushSync }, "react/jsx-runtime": requireFront("react/jsx-runtime"),
  "@workspace/number-format": requireFront("@workspace/number-format"),
  "@tanstack/react-query": { useQueryClient: () => ({ invalidateQueries() {} }) },
  "wouter": { Link: primitive("a"), useLocation: () => ["/reportes/clientes", setLocation], useSearch: () => "" },
  "sonner": { toast: { info() {} } },
  "lucide-react": new Proxy({}, { get: () => () => null }),
  "@/lib/utils": { cn: (...args) => args.filter(Boolean).join(" ") },
  "@/components/ui/table": Object.fromEntries(Object.entries({ Table: "table", TableHeader: "thead", TableBody: "tbody", TableFooter: "tfoot", TableRow: "tr", TableHead: "th", TableCell: "td" }).map(([key, tag]) => [key, primitive(tag)])),
  "@/components/ui/card": { Card: primitive("section"), CardContent: primitive("div"), CardHeader: primitive("header"), CardTitle: primitive("h2") },
  "@/components/ui/button": { Button: primitive("button") },
  "@/components/layout/app-layout": { AppLayout: primitive("main") },
  "@/components/ui/tabs": { Tabs: primitive("div"), TabsList: primitive("div"), TabsTrigger: primitive("button") },
  "@/components/ui/toggle-group": { ToggleGroup: primitive("div"), ToggleGroupItem: primitive("button") },
  "@/components/reportes/report-warnings": { ReportWarnings: () => null },
  "@/components/reportes/report-kpis": { ReportKpis: ({ kpis }) => { assert.equal(kpis, payload.kpis); return React.createElement("p", { "data-testid": "kpi" }, kpis[0].value); } },
  "@/components/reportes/report-charts": { ReportCharts: ({ charts }) => { assert.equal(charts, payload.charts, "chart arrays must never be truncated"); return null; } },
  "@/components/reportes/report-filter-bar": {
    DEFAULT_FILTERS: defaults,
    ReportFilterBar: props => {
      filterProps = props;
      return React.createElement("div", null,
        React.createElement("button", { onClick: props.onDownloadExcel }, "Exportar XLSX"),
        React.createElement("button", { onClick: props.onDownloadPdf }, "Exportar PDF"));
    },
  },
  "@/lib/location-scope": { useLocationScope: () => ({ selectedLocationId: null }) },
  "@/components/credit-site-scope": { useCreditSiteScope: () => ({ ready: true, selectedSiteId: null, stores: [], loadingStores: false }) },
  "@workspace/api-client-react": {
    GetAdminDiferenciasAgrupacion: { semana: "semana" },
    useGetCurrentUser: () => ({ data: { id: 1, rol: "ADMIN", alcanceConsulta: "TODAS" } }),
    useGetReportesCatalogos: () => ({ data: undefined }),
    getGetReporteSeccionQueryKey: (section, params) => ["/api/reportes", section, params],
    useGetReporteSeccion: (section, params) => {
      requested.push({ section, params });
      return { data: section === "clientes" ? payload : { tables: [] }, isLoading: false, isError: false, refetch() {} };
    },
  },
};
for (const [file, name] of [["ventas", "VentasTab"], ["que-comprar", "QueComprarTab"], ["utilidad", "UtilidadTab"], ["control-operativo", "ControlOperativoTab"]]) {
  stubs[`@/components/reportes/tabs/${file}-tab`] = { [name]: () => null };
}
const modules = new Map();
function compile(file) {
  if (modules.has(file)) return modules.get(file);
  const compiled = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    fileName: file, reportDiagnostics: true,
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  });
  assert.deepEqual(compiled.diagnostics, []);
  const module = { exports: {} };
  vm.runInThisContext(`(function(require,module,exports){${compiled.outputText}\n})`)(name => {
    if (name in stubs) return stubs[name];
    const base = name.startsWith("@/") ? path.join(front, "src", name.slice(2)) : path.resolve(path.dirname(file), name);
    const dependency = [base + ".ts", base + ".tsx"].find(candidate => fs.existsSync(candidate));
    assert.ok(dependency, `Unexpected dependency ${name}`);
    return compile(dependency);
  }, module, module.exports);
  modules.set(file, module.exports);
  return module.exports;
}
const Reportes = compile(path.join(front, "src/pages/reportes.tsx")).default;
const { ReportTable } = compile(path.join(front, "src/components/reportes/report-table.tsx"));
const pause = () => new Promise(resolve => setTimeout(resolve, 5));
const button = (container, label) => [...container.querySelectorAll("button")].find(el => el.textContent === label);
async function click(element) {
  assert.ok(element);
  await act(async () => { element.click(); await pause(); });
}

test("mounted production Reportes → ClientesTab → renderer → table: sort all before paging, reset, full totals/export/print", async () => {
  const container = document.createElement("div"); document.body.appendChild(container);
  const root = createRoot(container);
  const originalFetch = globalThis.fetch, originalPrint = window.print;
  const createURL = URL.createObjectURL, revokeURL = URL.revokeObjectURL;
  const anchorClick = dom.window.HTMLAnchorElement.prototype.click;
  const exportBlobs = [];
  globalThis.fetch = async (url, options) => {
    exported.push({ url, options });
    return { ok: true, blob: async () => new Blob([JSON.stringify({ rows: block.rows, totals: block.totals })]) };
  };
  URL.createObjectURL = blob => { exportBlobs.push(blob); return "blob:complete"; };
  URL.revokeObjectURL = () => {};
  dom.window.HTMLAnchorElement.prototype.click = () => {};
  const render = async () => act(async () => { root.render(React.createElement(Reportes)); await pause(); });
  const table = () => container.querySelector('[data-testid="report-table-credit-fixture"]');
  const rows = () => [...table().querySelectorAll("tbody tr")];
  const first = () => rows()[0].textContent;
  try {
    await render();
    assert.equal(rows().length, 50);
    assert.match(first(), /Cliente 001/);
    const footer = table().querySelector("tfoot").textContent;
    assert.match(footer, /9[,.]453/);
    assert.equal(container.querySelector('[data-testid="kpi"]').textContent, "9453");
    assert.equal(button(table(), "Anterior").disabled, true);
    await click(button(table(), "Siguiente"));
    assert.match(first(), /Cliente 051/);
    // Ascending numeric sort must include rows beyond the previous page.
    await click(table().querySelector('[data-testid="th-saldo"]'));
    assert.match(first(), /Cliente 137/);
    assert.match(table().querySelector('[role="status"]').textContent, /Página 1 de 3/);
    assert.equal(table().querySelector("tfoot").textContent, footer);
    const visited = rows().map(row => row.cells[0].textContent);
    await click(button(table(), "Siguiente"));
    assert.match(first(), /Cliente 087/);
    visited.push(...rows().map(row => row.cells[0].textContent));
    await click(button(table(), "Siguiente"));
    visited.push(...rows().map(row => row.cells[0].textContent));
    assert.deepEqual(visited, block.rows.map(row => row.cliente).reverse(), "all sorted rows occur exactly once across pages");
    assert.equal(rows().length, 37);
    assert.match(rows().at(-1).textContent, /Cliente 001/);
    assert.equal(button(table(), "Siguiente").disabled, true);
    // Both server export handlers on the actual page remain full-filter requests.
    await click(button(container, "Exportar XLSX"));
    await click(button(container, "Exportar PDF"));
    assert.equal(exported.length, 2);
    for (const [i, record] of exported.entries()) {
      const url = new URL(record.url, "http://localhost");
      assert.equal(url.pathname, `/api/reportes/vistas/clientes/export.${i ? "pdf" : "xlsx"}`);
      assert.equal(record.options.credentials, "include");
      for (const name of ["page", "pageSize", "offset", "limit"]) assert.equal(url.searchParams.has(name), false);
      const read = requested.findLast(item => item.section === "clientes").params;
      for (const key of ["desde", "hasta", "periodo", "modalidad"]) assert.equal(url.searchParams.get(key), String(read[key]));
      const content = JSON.parse(await exportBlobs[i].text());
      assert.equal(content.rows.length, 137, "complete server response delivered, not sliced by UI");
      assert.deepEqual(content.totals, block.totals);
    }
    // Explicit print button triggers native lifecycle; assert synchronous full DOM.
    window.print = () => {
      window.dispatchEvent(new dom.window.Event("beforeprint"));
      assert.equal(rows().length, 137);
      assert.match(first(), /Cliente 137/);
      assert.match(rows().at(-1).textContent, /Cliente 001/);
      assert.equal(table().querySelector("tfoot").textContent, footer);
      assert.equal(table().querySelector("thead").classList.contains("sticky"), false);
      window.dispatchEvent(new dom.window.Event("afterprint"));
    };
    await click(button(table(), "Imprimir reporte completo"));
    assert.equal(rows().length, 37, "screen page restored after print");
    // Page size and filter changes reset to the beginning without altering sort/totals.
    await act(async () => {
      const select = table().querySelector("select"); select.value = "25";
      select.dispatchEvent(new dom.window.Event("change", { bubbles: true })); await pause();
    });
    assert.equal(rows().length, 25); assert.match(first(), /Cliente 137/);
    await click(button(table(), "Siguiente"));
    await act(async () => { filterProps.onChange({ ...defaults, periodo: "mensual" }); await pause(); });
    assert.match(table().querySelector('[role="status"]').textContent, /Página 1/);
    await act(async () => { filterProps.onChange(defaults); await pause(); });
    assert.match(table().querySelector('[role="status"]').textContent, /Página 1/, "returning to cached filters must not revive an old page");
    await click(button(table(), "Siguiente"));
    payload = { ...payload, tables: [{ ...block, rows: [...block.rows] }] };
    await render();
    assert.match(table().querySelector('[role="status"]').textContent, /Página 1/);
    assert.equal(JSON.stringify(block.rows), originalRows);
    assert.equal(JSON.stringify(block.totals), originalTotals);
    assert.equal(table().querySelector("tfoot").textContent, footer);
    await act(async () => {
      table().querySelector('[data-testid="th-saldo"]').dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    });
    assert.match(first(), /Cliente 001/);
    assert.equal(table().querySelector('[data-testid="th-saldo"]').getAttribute("aria-sort"), "descending");
  } finally {
    await act(async () => root.unmount()); container.remove();
    globalThis.fetch = originalFetch; window.print = originalPrint;
    URL.createObjectURL = createURL; URL.revokeObjectURL = revokeURL;
    dom.window.HTMLAnchorElement.prototype.click = anchorClick;
  }
});

test("pagination is opt-in: unrelated report tables retain all rows", async () => {
  const container = document.createElement("div"), root = createRoot(container);
  try {
    await act(async () => root.render(React.createElement(ReportTable, { block, hasEconomicAccess: true, section: "ventas" })));
    assert.equal(container.querySelectorAll("tbody tr").length, 137);
    assert.equal(container.querySelector("nav"), null);
  } finally { await act(async () => root.unmount()); }
});

test("comparison credit tables page independently; native print includes every row for both sites", async () => {
  const { ClientesTab } = compile(path.join(front, "src/components/reportes/tabs/clientes-tab.tsx"));
  const container = document.createElement("div"), root = createRoot(container);
  try {
    await act(async () => root.render(React.createElement(ClientesTab, {
      apiParams: {}, isDateRangeValid: true, comparisonMode: true,
      comparisonFrames: [1, 2].map(siteId => ({ siteId, siteLabel: `Tienda ${siteId}`, apiParams: { ubicacionId: siteId } })),
    })));
    const tables = [...container.querySelectorAll('[data-testid="report-table-credit-fixture"]')];
    assert.equal(tables.length, 2);
    await click(button(tables[0], "Siguiente"));
    assert.match(tables[0].querySelector("tbody").textContent, /^Cliente 051/);
    assert.match(tables[1].querySelector("tbody").textContent, /^Cliente 001/);
    await act(async () => {
      window.dispatchEvent(new dom.window.Event("beforeprint"));
      for (const table of tables) assert.equal(table.querySelectorAll("tbody tr").length, 137);
      window.dispatchEvent(new dom.window.Event("afterprint"));
    });
    for (const table of tables) assert.equal(table.querySelectorAll("tbody tr").length, 50);
  } finally { await act(async () => root.unmount()); }
});