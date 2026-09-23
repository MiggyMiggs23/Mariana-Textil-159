import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import test from "node:test";
import ts from "typescript";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { JSDOM } from "jsdom";
import * as financial from "../../lib/cuentas-destino-financial";
import * as attention from "./attention-card-tone";
import * as dateOnly from "../../lib/date-only";

const require = createRequire(import.meta.url);
const current = readFileSync(new URL("./cuentas-destino.tsx", import.meta.url), "utf8");
// Frozen pre-E6 source, not a reimplementation of the component or its calculations.
const baseline = readFileSync(new URL(
  "../../../../../reports/tanda-nocturna-20260919/tarea-2/baseline-source.txt", import.meta.url,
), "utf8");
const realtimeCurrent = readFileSync(new URL("./tiempo-real.tsx", import.meta.url), "utf8");
const realtimeBaseline = readFileSync(new URL(
  "../../../../../reports/tanda-nocturna-20260919/tarea-2/baseline-tiempo-real-source.txt", import.meta.url,
), "utf8");
// Reuse schema-validated offline dashboard fixtures, without invoking their browser/server helper.
const fixtureSource = ts.createSourceFile("fixtures.ts", readFileSync(new URL(
  "./caja-tiempo-real-observable-test-support.ts", import.meta.url,
), "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
function existingFixture(name: string) {
  for (const statement of fixtureSource.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    const declaration = statement.declarationList.declarations.find(item => item.name.getText(fixtureSource) === name);
    if (declaration?.initializer) return runInNewContext(
      declaration.initializer.getText(fixtureSource), require("@workspace/api-zod"),
    );
  }
  throw new Error(`Missing existing offline fixture ${name}`);
}
// Match the existing browser helper's JSON transport (schema dates become ISO strings).
const dashboard = JSON.parse(JSON.stringify(existingFixture("dashboard")));
const pending = JSON.parse(JSON.stringify(existingFixture("pending")));
const emptyCell = { importe: "0.00", cuentaDestino: null, formasPago: [] };
function fixture(contado: string, abonos: string, favor: string, total: string) {
  const vendido = financial.formatCentsAsMoney(financial.parseMoneyToCents(contado) + 15008n);
  return {
    resumen: [], tendencia: [], porTienda: [{
      ubicacionId: 1, nombreUbicacion: "Sucursal de ensayo aislado",
      cobrado: total, vendido, porCobrar: "150.08",
    }],
    encabezado: {
      vendido: { contado, credito: "150.08", total: vendido, totalAnterior: "900.03", variacionPorcentaje: "11.12" },
      cobrado: { contado, abonos, saldosFavor: favor, total, totalAnterior: "775.04", variacionPorcentaje: "12.89" },
      porCobrar: { periodo: "150.08", periodoAnterior: "120.07", variacionPorcentaje: "24.99" },
      previousDesde: "2026-06-14", previousHasta: "2026-06-14",
    },
    cobrosAnteriores: [],
    matriz: { filas: [true, false, null].map(facturado => ({
      facturado, efectivo: emptyCell, transferencia: emptyCell,
      porCobrar: emptyCell, otras: emptyCell, total: "0.00",
    })), cierra: true },
    ivaFacturado: { base: "0.00", iva: "0.00" },
    incongruencias: { conteo: 0, importe: "0.00" },
    facturacion: {
      facturadoTotal: "0.00", noFacturadoTotal: "0.00", facturadoEfectivo: "0.00",
      facturadoTransferencia: "0.00", noFacturadoEfectivo: "0.00", noFacturadoTransferencia: "0.00",
    },
    ivaCobrado: "0.00", totalCobrado: total,
  };
}

async function mount(source: string, data: ReturnType<typeof fixture>, collectionLoading = false) {
  const dom = new JSDOM("<!doctype html><html><body><div id='root'></div></body></html>", {
    url: "http://offline.invalid/caja/cuentas-destino",
  });
  const originals = Object.getOwnPropertyDescriptors(globalThis);
  Object.defineProperties(globalThis, {
    window: { configurable: true, value: dom.window },
    document: { configurable: true, value: dom.window.document },
    navigator: { configurable: true, value: dom.window.navigator },
    IS_REACT_ACT_ENVIRONMENT: { configurable: true, writable: true, value: true },
  });
  const observedCalls: unknown[][] = [];
  const exports: { default?: React.ComponentType } = {};
  const wrapper = ({ children, href, ...props }: any) => React.createElement(
    href ? "a" : "div",
    { href, "data-testid": props["data-testid"], "aria-label": props["aria-label"] }, children,
  );
  const inertUi = new Proxy({}, { get: () => wrapper });
  const compiled = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
  } }).outputText;
  runInNewContext(compiled, {
    exports, URLSearchParams, console,
    require(name: string) {
      if (name === "react" || name === "react/jsx-runtime" || name.startsWith("date-fns") ||
          name === "@workspace/number-format") return require(name);
      if (name.endsWith(".css")) return {};
      if (name === "./attention-card-tone") return attention;
      if (name === "@/lib/date-only") return dateOnly;
      if (name === "@tanstack/react-query") return {
        useQuery: () => ({ data: undefined, isLoading: false, isError: false }),
      };
      if (name === "@/lib/cuentas-destino-financial") return financial;
      if (name === "@/hooks/use-shared-cuentas-destino") return {
        useSharedCuentasDestino: (...args: unknown[]) => {
          observedCalls.push(args);
          return { data, isLoading: collectionLoading, isError: false, refetch() {} };
        },
      };
      if (name === "@/lib/location-scope") return { useLocationScope: () => ({ selectedLocationId: 7 }) };
      if (name === "@/hooks/use-toast") return { useToast: () => ({ toast() {} }) };
      if (name === "wouter") return {
        Link: wrapper,
        useSearch: () => "?desde=2026-06-15&hasta=2026-06-15&preset=custom&compare=true",
        useLocation: () => ["/caja/cuentas-destino", () => {}],
      };
      if (name === "@workspace/api-client-react") return {
        useGetAdminRealtimeDashboard: () => ({ data: dashboard, isLoading: false, isError: false, dataUpdatedAt: 0 }),
        useGetAdminRealtimePending: () => ({ data: pending, isLoading: false, isError: false, dataUpdatedAt: 0 }),
        getGetAdminRealtimeDashboardQueryKey: () => ["dashboard"],
        getGetAdminRealtimePendingQueryKey: () => ["pending"],
        exportAdminCuentasDestinoXlsx: () => { throw new Error("Network/export forbidden in this fixture"); },
        exportAdminCuentasDestinoPdf: () => { throw new Error("Network/export forbidden in this fixture"); },
      };
      if (name === "@/lib/api-error") return { getApiErrorMessage: () => "fixture error" };
      if (name === "@/lib/report-chart-colors") return { getAccountDestinationChartColor: () => "#000" };
      if (name.startsWith("@/components/") || name === "lucide-react" || name === "recharts") return inertUi;
      throw new Error(`Unexpected dependency: ${name}`);
    },
  });
  const root = createRoot(dom.window.document.getElementById("root")!);
  try {
    await act(async () => { root.render(React.createElement(exports.default!)); });
    const document = dom.window.document;
    const leaves = [...document.querySelectorAll("div,a,span,p,h2")].filter(node => !node.children.length);
    return {
      text: document.body.textContent!,
      ariaLabels: [...document.querySelectorAll("[aria-label]")].map(node => node.getAttribute("aria-label")),
      // Every rendered numeric leaf, in order: components, totals, comparisons, percentages and matrix.
      numbers: leaves.map(node => node.textContent!).filter(text => /\d/.test(text)),
      links: [...document.querySelectorAll("a")].map(node => ({
        href: node.getAttribute("href"),
        numbers: node.textContent!.match(/-?\$[\d,]+\.\d{2}|-?[\d,.]+%/g),
      })),
      amounts: Object.fromEntries([...document.querySelectorAll("[data-testid]")].map(node =>
        [node.getAttribute("data-testid"), node.textContent])),
      observedCalls: JSON.parse(JSON.stringify(observedCalls)),
    };
  } finally {
    await act(async () => { root.unmount(); });
    dom.window.close();
    for (const key of ["window", "document", "navigator", "IS_REACT_ACT_ENVIRONMENT"]) {
      if (originals[key]) Object.defineProperty(globalThis, key, originals[key]);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
}

test("E6 mounted labels preserve every numeric component, total and filter at the cent; isolated mutants fail", async () => {
  assert.equal(createHash("sha256").update(baseline).digest("hex"),
    "d47f22f2a1e406c943f98adf8231f2cf8bcbf952159b5e7751efe35a8c35327a",
    "pre-rename component evidence must not be rewritten");
  const samples = [
    fixture("850.01", "25.17", "-0.09", "875.09"),
    fixture("850.01", "-25.17", "0.09", "824.93"),
    fixture("0.00", "25000.01", "-25000.01", "0.00"),
  ];
  const checkLabels = (view: Awaited<ReturnType<typeof mount>>) => {
    assert.equal(view.text.split("Contado cobrado").length - 1, 2,
      "both the sales card and collection component need exact Contado cobrado");
    assert.ok(view.text.includes("Cobranza del periodo"), "missing exact Cobranza del periodo label");
    assert.ok(!view.text.includes("Cobros directos"), "obsolete collection component label");
    assert.ok(view.amounts["text-monto-cobrado"], "collection total keeps its technical test id");
  };
  const before = await mount(baseline, samples[0]);
  const mutantLabel = current.replaceAll("Contado cobrado", "Cobros directos");
  const labelView = await mount(mutantLabel, samples[0]);
  assert.throws(() => checkLabels(labelView), assert.AssertionError);
  console.log("MUTANT label: FAIL expected AssertionError (missing exact Contado cobrado label)");
  const titleView = await mount(current.replaceAll("Cobranza del periodo", "Cobrado"), samples[0]);
  assert.throws(() => checkLabels(titleView), assert.AssertionError);
  console.log("MUTANT title: FAIL expected AssertionError (missing exact Cobranza del periodo label)");
  const mutantAmount = current.replace("amount: header.cobrado.abonos", 'amount: "25.18"');
  const amountView = await mount(mutantAmount, samples[0]);
  assert.throws(() => assert.deepEqual(amountView.numbers, before.numbers), assert.AssertionError);
  console.log("MUTANT one-cent component: FAIL expected AssertionError (rendered numeric leaves differ)");
  const totalView = await mount(current.replace("amount: header.cobrado.total", 'amount: "875.10"'), samples[0]);
  assert.throws(() => assert.deepEqual(totalView.numbers, before.numbers), assert.AssertionError);
  console.log("MUTANT one-cent total: FAIL expected AssertionError (rendered numeric leaves differ)");
  for (const data of samples) {
    const originalData = JSON.stringify(data);
    const oldView = await mount(baseline, data);
    const newView = await mount(current, data);
    checkLabels(newView);
    assert.deepEqual(newView.numbers, oldView.numbers);
    assert.deepEqual(newView.links, oldView.links);
    assert.deepEqual(newView.amounts, oldView.amounts);
    assert.deepEqual(newView.observedCalls, oldView.observedCalls);
    assert.equal(JSON.stringify(data), originalData, "API contract payload must remain unchanged");
    console.log("RESTORED PASS cents", JSON.stringify(data.encabezado), JSON.stringify(newView.numbers));
  }
});

test("E6 Tiempo real mounted presentation retains every component and total; isolated label/cent mutants fail", async () => {
  assert.equal(createHash("sha256").update(realtimeBaseline).digest("hex"),
    "bf194277cc072572d40273b6bc27cbbc6f1e594fcdf641194fd0b02cec899596");
  const samples = [
    fixture("850.01", "25.17", "-0.09", "875.09"),
    fixture("850.01", "-25.17", "0.09", "824.93"),
    fixture("0.00", "25000.01", "-25000.01", "0.00"),
  ];
  const checkLabels = (view: Awaited<ReturnType<typeof mount>>) => {
    assert.ok(view.text.includes("Cobranza del periodo"), "missing collection title");
    assert.equal(view.text.split("Contado cobrado").length - 1, 2,
      "both the dashboard card and collection component need exact Contado cobrado");
    assert.ok(!view.text.includes("Cobros directos"), "obsolete collection component label");
    assert.ok(view.amounts["text-monto-cobranza-del-periodo"], "preserve collection technical id");
  };
  const before = await mount(realtimeBaseline, samples[0]);
  for (const [name, mutant] of [
    ["title", realtimeCurrent.replace('title: "Cobranza del periodo"', 'title: "Cobrado en el periodo"')],
    ["component-label", realtimeCurrent.replace('label: "Contado cobrado"', 'label: "Cobros directos"')],
  ]) {
    const view = await mount(mutant, samples[0]);
    assert.throws(() => checkLabels(view), assert.AssertionError);
    console.log(`TIEMPO REAL MUTANT ${name}: FAIL expected AssertionError`);
  }
  const checkAria = (view: Awaited<ReturnType<typeof mount>>) =>
    assert.ok(view.ariaLabels.includes("Cobranza del periodo"), "missing accessible collection label");
  const ariaMutant = await mount(realtimeCurrent.replace(
    'aria-label="Cobranza del periodo"', 'aria-label="Cobrado en el periodo"',
  ), samples[0], true);
  assert.throws(() => checkAria(ariaMutant), assert.AssertionError);
  console.log("TIEMPO REAL MUTANT aria-label: FAIL expected AssertionError");
  checkAria(await mount(realtimeCurrent, samples[0], true));
  console.log("TIEMPO REAL RESTORED PASS accessible loading label");
  for (const [name, mutant] of [
    ["component-cent", realtimeCurrent.replace("amount: header.cobrado.abonos", 'amount: "25.18"')],
    ["total-cent", realtimeCurrent.replace("amount: header.cobrado.total", 'amount: "875.10"')],
  ]) {
    const view = await mount(mutant, samples[0]);
    assert.throws(() => assert.deepEqual(view.numbers, before.numbers), assert.AssertionError);
    console.log(`TIEMPO REAL MUTANT ${name}: FAIL expected AssertionError`);
  }
  for (const data of samples) {
    const originalData = JSON.stringify(data);
    const oldView = await mount(realtimeBaseline, data);
    const newView = await mount(realtimeCurrent, data);
    checkLabels(newView);
    assert.deepEqual(newView.numbers, oldView.numbers);
    assert.deepEqual(newView.links, oldView.links);
    assert.deepEqual(newView.amounts, oldView.amounts);
    assert.deepEqual(newView.observedCalls, oldView.observedCalls);
    assert.equal(JSON.stringify(data), originalData);
    console.log("TIEMPO REAL RESTORED PASS cents", JSON.stringify(data.encabezado.cobrado), JSON.stringify(newView.numbers));
  }
});