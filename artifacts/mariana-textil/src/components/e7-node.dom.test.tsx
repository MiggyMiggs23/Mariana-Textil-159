import assert from "node:assert/strict";
import { test, beforeEach, afterEach } from "node:test";
import React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider, focusManager, timeoutManager } from "@tanstack/react-query";
import { Router } from "wouter";
import App from "../App";
import ClienteDetail from "../pages/cliente-detail";
import CajaTiempoReal from "../pages/caja/tiempo-real";
import { LocationScopeProvider } from "../lib/location-scope";
import * as t from "./e7-node-test-transport";
import { captureDownloads, deferred, downloadSites, exactSerializedBlob, serializedBlob } from "./e7-node-download-support";

// Prepared only. MAIN runs exact native IDs in isolated processes.
timeoutManager.setTimeoutProvider({
  setTimeout: (cb, delay) => { const timer = setTimeout(cb, delay); timer.unref(); return timer; },
  clearTimeout: timer => clearTimeout(timer),
  setInterval: (cb, delay) => { const timer = setInterval(cb, delay); timer.unref(); return timer; },
  clearInterval: timer => clearInterval(timer),
});
let id = "", restoreFetch = () => {}, warnings: string[] = [];
const originalError = console.error, originalWarn = console.warn;
const clients: QueryClient[] = [];
beforeEach(() => {
  t.resetE7(); restoreFetch = t.installFiniteFetch(); warnings = [];
  console.error = (...args) => { warnings.push(args.join(" ")); originalError(...args); };
  console.warn = (...args) => { warnings.push(args.join(" ")); originalWarn(...args); };
  Object.defineProperty(globalThis, "sessionStorage", { configurable: true, value: window.sessionStorage });
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: window.localStorage });
  sessionStorage.clear(); localStorage.clear();
  Object.defineProperty(window, "matchMedia", { configurable: true, value: (media: string) => ({
    matches: false, media, onchange: null, addListener() {}, removeListener() {},
    addEventListener() {}, removeEventListener() {}, dispatchEvent() { return false; },
  }) });
});
afterEach(() => {
  cleanup(); clients.splice(0).forEach(c => c.clear()); restoreFetch();
  console.error = originalError; console.warn = originalWarn;
  if (warnings.some(w => /same key|unique ["']key["']|E11_UNCONFIGURED|E7_UNCONFIGURED/.test(w)))
    throw Error("E7_INFRASTRUCTURE_OR_DUPLICATE_KEY_NOT_ASSERTION_RED");
});
const text = () => document.body.textContent ?? "";
const node = (name: string) => screen.queryByTestId(name);
const seen = (path: string) => t.requests.some(r => r.path === path);
const e7Requests = () => t.requests.filter(r => r.path.startsWith("/api/e7/"));
const check = (value: unknown) => assert.equal(Boolean(value), true, id);
const until = (predicate: () => unknown) => waitFor(() => check(predicate()), { timeout: 3000, interval: 10 });
async function app(caseId: string, route = "/caja/cuentas-destino") {
  id = caseId; window.history.replaceState(null, "", route); render(<App />);
  await waitFor(() => {
    if (!seen("/api/auth/me") || !document.querySelector("h1")) throw Error(`E7_ANCESTOR_CONTROL ${caseId}`);
  }, { timeout: 3000, interval: 10 });
}
async function attribution() { await until(() => node("e7-applications")); }
async function click(name: string) { const el = screen.getByRole("button", { name }); await act(async () => { fireEvent.click(el); }); }
async function focus() { await act(async () => { focusManager.setFocused(false); focusManager.setFocused(true); }); }
async function directParent(element: React.ReactNode, actor: ReturnType<typeof t.user>, route: string) {
  cleanup(); window.history.replaceState(null, "", route);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } }); clients.push(client);
  t.respond("/api/auth/me", actor);
  render(<QueryClientProvider client={client}><Router><LocationScopeProvider>{element}</LocationScopeProvider></Router></QueryClientProvider>);
  await waitFor(() => { if (!document.querySelector("h1")) throw Error(`E7_REAL_PARENT_CONTROL ${id}`); });
}

test("E7-PARENT-CUENTAS", async () => {
  await app("E7-PARENT-CUENTAS"); await attribution();
  await until(() => node("text-monto-ventas-totales")?.textContent?.includes("1,000"));
  check(!node("text-monto-cobrado"));
  t.fail("/api/e7/atribucion", "E7_READ_DENIED"); await click("Actualizar E7");
  await until(() => text().includes("E7_READ_DENIED"));
  check(!node("text-monto-cobrado") && !node("e7-collection"));
  check(node("text-monto-ventas-totales")?.textContent?.includes("1,000"));
});
test("E7-OFF", async () => {
  t.e7Gates(false); await app("E7-OFF");
  await until(() => node("text-monto-cobrado")?.textContent?.includes("875"));
  check(!node("e7-attribution") && e7Requests().length === 0);
});
test("E7-RECEIPT-APPLICATION", async () => {
  t.respond("/api/e7/atribucion", t.f.afterReceipt); await app("E7-RECEIPT-APPLICATION"); await attribution();
  check(node("e7-collection")?.textContent?.includes("120.00"));
  check(node("e7-retained")?.textContent?.includes("80.00"));
  t.respond("/api/e7/atribucion", t.f.afterApplication); await click("Actualizar E7");
  await until(() => node("e7-applications")?.textContent?.includes("50.00"));
  check(node("e7-collection")?.textContent?.includes("120.00"));
  check(node("e7-retained")?.textContent?.includes("30.00"));
});
test("E7-SITES-NOT-RECEIPTS", async () => {
  t.respond("/api/auth/me", t.actorAtSite(2)); await app("E7-SITES-NOT-RECEIPTS"); await attribution();
  check(node("e7-applications")?.textContent?.includes("50.00"));
  check(!node("e7-collection") && !node("e7-movements")?.textContent?.includes("RECEPCION"));
  check(text().includes("No se atribuye recepción física"));
});
test("E7-RETAINED-STOCK", async () => {
  t.respond("/api/e7/atribucion", t.f.agedStock);
  await app("E7-RETAINED-STOCK"); await attribution();
  const held = node("e7-retained")?.textContent ?? "";
  check(held.includes("33 días") && held.includes("2026-08-22") && held.includes("30.00") && held.includes("no limitado al periodo"));
});
test("E7-PHYSICAL-HISTORY", async () => {
  t.respond("/api/e7/atribucion", t.f.mixedProvenance); await app("E7-PHYSICAL-HISTORY"); await attribution();
  check(node("e7-collection")?.textContent?.includes("130.00"));
  check(text().includes("Recepciones físicas comprobadas: $120.00"));
  check(node("e7-applications")?.textContent?.includes("30.00"));
  check(node("e7-bridge")?.textContent?.includes("REGISTRO_HISTORICO") && node("e7-bridge")?.textContent?.includes("REVERSO_APLICACION"));
});
test("E7-QUERY-ERROR", async () => {
  await app("E7-QUERY-ERROR"); await attribution();
  t.fail("/api/e7/atribucion", "E7_REVOKED"); await click("Actualizar E7");
  await until(() => text().includes("E7_REVOKED"));
  check(!node("e7-movements") && !node("e7-retained") && !node("text-monto-cobrado"));
});
test("E7-PARENT-TIEMPO", async () => {
  await app("E7-PARENT-TIEMPO", "/caja/tiempo-real"); await attribution();
  await until(() => text().includes("1,000"));
  check(!node("text-monto-cobranza-del-periodo") && !text().includes("$875") && !text().includes("875.00"));
  const request = t.requests.find(r => r.path === "/api/e7/atribucion");
  check(request?.params.get("desde") === request?.params.get("hasta"));
});
test("E7-GROUP1-FOUR", async () => {
  t.respond("/api/auth/me", t.actorAtSite(2)); await app("E7-GROUP1-FOUR", "/clientes/21?tab=estado");
  await until(() => node("e7-global-four"));
  const four = node("e7-global-four")!;
  check(four.children.length === 4 && four.textContent?.includes("150.00") && four.textContent?.includes("500.00") && four.textContent?.includes("350.00"));
  check(text().includes("Estado de cuenta financiero") && text().includes("El resumen de crédito es global"));
  check(!seen("/api/clientes/21/estado-cuenta") && !node("button-export-account") && !node("button-print-account"));
  check(node("e7-client-export-pdf") && node("e7-client-export-xlsx") && node("e7-client-export-imprimir"));
});
test("E7-GROUP1-LINKS", async () => {
  t.respond("/api/auth/me", t.actorAtSite(2)); await app("E7-GROUP1-LINKS", "/clientes/21?tab=estado");
  await until(() => node("e7-client-export"));
  for (const [label, path] of [["pdf", "estado-cuenta.pdf"], ["xlsx", "estado-cuenta.xlsx"], ["imprimir", "estado-cuenta/imprimir"]])
    check(node(`e7-client-export-${label}`)?.getAttribute("href") === `/api/clientes/21/${path}?ubicacionId=2`);
  check(!node("e7-movements")?.textContent?.includes("NOTA-OTRO-SITIO"));
});
test("E7-FOREIGN-PREVIEW", async () => {
  await app("E7-FOREIGN-PREVIEW", "/clientes/21?tab=estado"); await until(() => node("e7-client-export"));
  t.respond("/api/e7/clientes/21/exportacion", t.f.foreignPreview); await focus();
  await until(() => text().includes("Respuesta ajena al cliente"));
  check(!node("e7-global-four") && !node("e7-client-export-pdf"));
});
test("E7-DOWNLOAD-CONTEXT", async () => {
  t.respond("/api/auth/me", t.actorAtSite(2)); await app("E7-DOWNLOAD-CONTEXT"); await attribution();
  for (const kind of ["pdf", "xlsx"]) {
    await act(async () => { fireEvent.click(screen.getByTestId(`e7-export-${kind}`)); });
    await until(() => seen(`/api/e7/atribucion.${kind}`));
    const request = t.requests.find(r => r.path === `/api/e7/atribucion.${kind}`)!;
    const read = t.requests.find(r => r.path === "/api/e7/atribucion")!;
    check(request.method === "GET" && request.params.toString() === read.params.toString());
    await until(() => text().includes("E7_EXPORT_SERVICE_UNAVAILABLE"));
  }
});
test("E7-DOWNLOAD-IDENTITY", async () => {
  await app("E7-DOWNLOAD-IDENTITY"); await attribution();
  t.respond("/api/auth/me", t.user("CONTADOR"));
  await act(async () => { fireEvent.click(screen.getByTestId("e7-export-pdf")); });
  await until(() => text().includes("Identidad modificada"));
  check(!seen("/api/e7/atribucion.pdf"));
});
test("E7-OPERATIONAL-BOUNDARY", async () => {
  await app("E7-OPERATIONAL-BOUNDARY", "/caja/cuentas-destino/CAJA_FISICA?desde=2026-09-22&hasta=2026-09-24");
  await until(() => seen("/api/admin/cuentas-destino/CAJA_FISICA/movimientos"));
  const notice = node("e7-legacy-detail-notice");
  check(notice?.textContent?.includes("No sumar este subtotal a la cobranza E7."));
  check(notice?.textContent?.includes("no incluye el dinero retenido E5"));
  check(notice?.querySelector("a")?.getAttribute("href")?.startsWith("/caja/cuentas-destino?"));
  check(e7Requests().length === 0 && !node("e7-attribution"));
});
test("E7-RANGE", async () => {
  // The real parent only mounts date inputs for the custom preset.
  await app("E7-RANGE", "/caja/cuentas-destino?preset=custom&desde=2026-09-22&hasta=2026-09-24"); await attribution();
  const count = t.requests.filter(r => r.path === "/api/e7/atribucion").length;
  const dates = document.querySelectorAll<HTMLInputElement>('input[type="date"]');
  check(dates.length === 2 && dates[0].value === "2026-09-22" && dates[1].value === "2026-09-24");
  const initial = t.requests.find(r => r.path === "/api/e7/atribucion")!;
  check(initial.params.get("desde") === "2026-09-22" && initial.params.get("hasta") === "2026-09-24");
  await act(async () => {
    // One committed date edit: do not issue two history updates from one stale
    // render, where the second handler could restore the old first date.
    fireEvent.change(dates[0], { target: { value: "2024-01-01" } });
  });
  await until(() => node("e7-range-error"));
  check((document.querySelectorAll<HTMLInputElement>('input[type="date"]')[1]).value === "2026-09-24");
  check(!node("e7-collection") && t.requests.filter(r => r.path === "/api/e7/atribucion").length === count);
});
test("E7-SCOPE-QUERY", async () => {
  await app("E7-SCOPE-QUERY"); await attribution(); check(node("e7-collection"));
  t.respond("/api/auth/me", t.actorAtSite(2)); await focus();
  await until(() => t.requests.some(r => r.path === "/api/e7/atribucion" && r.params.get("ubicacionId") === "2"));
  await until(() => !node("e7-collection") && node("e7-applications"));
  check(!node("e7-movements")?.textContent?.includes("RECEPCION"));
});
test("E7-AVAILABILITY", async () => {
  await app("E7-AVAILABILITY"); await attribution();
  t.respond("/api/e7/disponibilidad", t.f.unavailable); await focus();
  await until(() => text().includes("Esta lectura E7 está cerrada."));
  check(!node("e7-movements") && !node("text-monto-cobrado"));
});
test("E7-COUNTER-BOUNDARY", async () => {
  id = "E7-COUNTER-BOUNDARY";
  // Real E11 A/F positive ancestors, followed by a direct real parent to reach
  // the independent reader veto (App's stronger route veto otherwise masks it).
  for (const profile of ["A", "F"] as const) {
    cleanup(); t.reset(profile); t.appSiblings(); t.e7Gates(true);
    await app(id, profile === "A" ? "/contabilidad/finanzas" : "/contabilidad/fiscal");
    await until(() => text().includes(t.customer.nombre));
    check(e7Requests().length === 0);
    cleanup(); t.resetE7();
    const actor = { ...t.user("CONTADOR"), permisos: [{ modulo: "clientes_finanzas", puedeVer: true, puedeCrear: true, puedeEditar: true, puedeAutorizar: true }] };
    await directParent(<ClienteDetail />, actor, "/clientes/21?tab=estado");
    await until(() => text().includes("Consulta E7 no autorizada."));
    check(!node("e7-client-export") && e7Requests().length === 0);
  }
});
test("E7-SISTEMAS-TIEMPO", async () => {
  const actor = { ...t.user("SISTEMAS"), permisos: [{ modulo: "resumen_caja", puedeVer: true, puedeCrear: false, puedeEditar: false, puedeAutorizar: false }] };
  t.respond("/api/auth/me", actor); await app("E7-SISTEMAS-TIEMPO"); await attribution();
  t.requests.length = 0;
  await directParent(<CajaTiempoReal />, actor, "/caja/tiempo-real");
  await until(() => text().includes("Consulta E7 no autorizada."));
  check(!node("e7-attribution") && e7Requests().length === 0);
});
test("E7-LEGENDS", async () => {
  await app("E7-LEGENDS"); await attribution();
  const legends = node("e7-legends")?.textContent ?? "";
  for (const literal of [...t.f.legends, "Las aplicaciones a notas no son nuevos ingresos.",
    "El dinero retenido pendiente de aplicación no es saldo a favor ni reduce la deuda."]) check(legends.includes(literal));
  check(node("e7-movements")?.textContent?.includes("Sin sitio determinado"));
});

// Download extension; the pending RANGE preparation is repaired separately.
test("E7-DOWNLOAD-REAL-BINARIES", async () => {
  const capture = captureDownloads();
  try {
    for (const kind of ["pdf", "xlsx"] as const)
      t.routes.set(`GET /api/e7/atribucion.${kind}`, () => serializedBlob(kind));
    await app("E7-DOWNLOAD-REAL-BINARIES"); await attribution();
    for (const [index, kind] of (["pdf", "xlsx"] as const).entries()) {
      await act(async () => { fireEvent.click(screen.getByTestId(`e7-export-${kind}`)); });
      await until(() => capture.saved.length === index + 1);
      const request = t.requests.find(r => r.path === `/api/e7/atribucion.${kind}`)!;
      const read = t.requests.find(r => r.path === "/api/e7/atribucion")!;
      check(request.method === "GET" && request.params.toString() === read.params.toString());
      check(await exactSerializedBlob(capture.created[index].blob, kind));
      check(capture.saved[index].url === capture.created[index].url
        && capture.saved[index].name === `atribucion-${request.params.get("desde")}-${request.params.get("hasta")}.${kind}`
        && capture.revoked.includes(capture.created[index].url));
      await until(() => !(node(`e7-export-${kind}`) as HTMLButtonElement).disabled);
    }
  } finally { capture.restore(); }
});

test("E7-DOWNLOAD-LATE-REVOCATION", async () => {
  const capture = captureDownloads(), pending = deferred<Blob>();
  try {
    t.routes.set("GET /api/e7/atribucion.pdf", () => serializedBlob("pdf"));
    t.routes.set("GET /api/e7/atribucion.xlsx", () => pending.promise);
    await app("E7-DOWNLOAD-LATE-REVOCATION"); await attribution();
    await act(async () => { fireEvent.click(screen.getByTestId("e7-export-pdf")); });
    await until(() => capture.saved.length === 1);
    check(await exactSerializedBlob(capture.created[0].blob, "pdf"));
    await until(() => !(node("e7-export-xlsx") as HTMLButtonElement).disabled);
    await act(async () => { fireEvent.click(screen.getByTestId("e7-export-xlsx")); });
    await until(() => seen("/api/e7/atribucion.xlsx"));
    check(capture.saved.length === 1 && capture.created.length === 1);
    // Identity changes only after dispatch, while the real XLSX is pending.
    t.respond("/api/auth/me", t.user("CONTADOR"));
    await act(async () => {
      pending.resolve(serializedBlob("xlsx")); await pending.promise;
      // A single event-loop checkpoint drains the known resolved transport
      // chain. No sleep/polling window is used to hide an old-file save.
      await new Promise<void>(done => setImmediate(done));
    });
    check(capture.saved.length === 1 && capture.created.length === 1);
    await until(() => /revocad|modificad|descartad/i.test(text()));
  } finally { pending.resolve(serializedBlob("xlsx")); capture.restore(); }
});

test("E7-DOWNLOAD-LATE-SCOPE", async () => {
  const capture = captureDownloads(), pending = deferred<Blob>();
  try {
    t.respond("/api/inventario/ubicaciones", downloadSites);
    t.routes.set("GET /api/e7/atribucion.pdf", () => serializedBlob("pdf"));
    t.routes.set("GET /api/e7/atribucion.xlsx", () => pending.promise);
    await app("E7-DOWNLOAD-LATE-SCOPE"); await attribution();
    await act(async () => { fireEvent.click(screen.getByTestId("e7-export-pdf")); });
    await until(() => capture.saved.length === 1);
    check(await exactSerializedBlob(capture.created[0].blob, "pdf"));
    await until(() => !(node("e7-export-xlsx") as HTMLButtonElement).disabled);
    await act(async () => { fireEvent.click(screen.getByTestId("e7-export-xlsx")); });
    await until(() => seen("/api/e7/atribucion.xlsx"));
    const select = screen.getAllByRole("combobox").find(el => el.textContent?.includes("Vista Global"));
    if (!select) throw Error("E7_REAL_SCOPE_SELECTOR_CONTROL");
    await act(async () => { fireEvent.keyDown(select, { key: "ArrowDown" }); });
    await until(() => screen.queryByRole("option", { name: "Sitio aplicación sintético" }));
    await act(async () => { fireEvent.click(screen.getByRole("option", { name: "Sitio aplicación sintético" })); });
    await until(() => t.requests.some(r => r.path === "/api/e7/atribucion" && r.params.get("ubicacionId") === "2")
      && node("e7-applications") && !node("e7-collection"));
    // Current user is unchanged; only the actual parent location selector
    // changes scope. The old response contains real global/foreign receipt data.
    await act(async () => {
      pending.resolve(serializedBlob("xlsx")); await pending.promise;
      await new Promise<void>(done => setImmediate(done));
    });
    check(capture.saved.length === 1 && capture.created.length === 1);
    // Positive control after the adverse transition: new scoped file can save.
    t.routes.set("GET /api/e7/atribucion.xlsx", ({ params }) =>
      serializedBlob("xlsx", params.get("ubicacionId") === "2" ? "site2" : "global"));
    await act(async () => { fireEvent.click(screen.getByTestId("e7-export-xlsx")); });
    await until(() => capture.saved.length === 2);
    check(await exactSerializedBlob(capture.created[1].blob, "xlsx", "site2"));
    check(capture.revoked.includes(capture.created[1].url));
  } finally { pending.resolve(serializedBlob("xlsx")); capture.restore(); }
});