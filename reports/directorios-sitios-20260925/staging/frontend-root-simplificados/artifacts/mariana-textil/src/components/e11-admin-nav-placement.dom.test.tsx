import assert from "node:assert/strict";
import { test, beforeEach, afterEach } from "node:test";
import React from "react";
import { act, cleanup, render } from "@testing-library/react";
import { QueryClient, QueryClientProvider, timeoutManager } from "@tanstack/react-query";
import { Router } from "wouter";
import { E11ApplicationBoundary, E11RoutePage } from "../pages/e11";
import * as t from "./e11-node-test-transport";
import App from "../App";

// Screen placement: "Conciliaciones documentales" and "Administrar perfiles A/F"
// must not render in any header, neither the operational AppLayout nor the
// accounting E11 shell. They render in an administration group using the same
// session/profile/flag predicates. This is a separate file so the E11 mutant
// bijection (e11-node.dom.test.tsx and its cases) stays unchanged.
// Run with: node artifacts/mariana-textil/reports/screen-placement/run-e7-dom.mjs e11-placement
timeoutManager.setTimeoutProvider({
  setTimeout: (cb, delay) => { const timer = setTimeout(cb, delay); timer.unref(); return timer; },
  clearTimeout: timer => clearTimeout(timer),
  setInterval: (cb, delay) => { const timer = setInterval(cb, delay); timer.unref(); return timer; },
  clearInterval: timer => clearInterval(timer),
});
let client: QueryClient;
let id = "";
beforeEach(() => {
  t.reset();
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false } } });
  Object.defineProperty(globalThis, "sessionStorage", { configurable: true, value: window.sessionStorage });
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: window.localStorage });
  sessionStorage.clear(); localStorage.clear();
  Object.defineProperty(window, "matchMedia", { configurable: true, value: (media: string) => ({
    matches: false, media, onchange: null, addListener() {}, removeListener() {},
    addEventListener() {}, removeEventListener() {}, dispatchEvent() { return false; },
  }) });
});
afterEach(() => { cleanup(); client.clear(); });
const check = (value: unknown, why = "") => assert.equal(Boolean(value), true, `${id} ${why}`);
async function settle() { for (let i = 0; i < 8; i++) await act(async () => { await new Promise(r => setTimeout(r, 4)); }); }
const CONC = "Conciliaciones documentales", PERF = "Administrar perfiles A/F";
const headerNav = () => document.querySelector('nav[aria-label="Contabilidad"]');
const adminNav = () => document.querySelector('[data-testid="e11-admin-nav"]');
async function shell(caseId: string, route: string) {
  id = caseId; window.history.replaceState(null, "", route);
  render(<QueryClientProvider client={client}><Router><E11ApplicationBoundary><E11RoutePage /></E11ApplicationBoundary></Router></QueryClientProvider>);
  await settle();
}

test("PLACEMENT-SHELL-CONTADOR-F", async () => {
  await shell("PLACEMENT-SHELL-CONTADOR-F", "/contabilidad/fiscal");
  check(headerNav()?.textContent?.includes("Ventas y clientes facturados"), "operational header nav mounted");
  check(!headerNav()?.textContent?.includes(CONC), "no conciliaciones in header");
  check(adminNav()?.querySelector('a[href="/contabilidad/conciliaciones"]')?.textContent === CONC, "CONTADOR F keeps conciliaciones access");
  check(!adminNav()?.textContent?.includes(PERF), "profile admin stays admin-only");
});

test("PLACEMENT-SHELL-CONTADOR-A", async () => {
  t.reset("A"); await shell("PLACEMENT-SHELL-CONTADOR-A", "/contabilidad/finanzas");
  check(headerNav()?.textContent?.includes("Finanzas saneadas"), "operational header nav mounted");
  check(!adminNav(), "profile A has neither admin destination (same predicates as before)");
});

test("PLACEMENT-SHELL-FLAG-OFF", async () => {
  t.respond("/api/e11/disponibilidad", { ...t.available, conciliacion: false });
  await shell("PLACEMENT-SHELL-FLAG-OFF", "/contabilidad/fiscal");
  check(headerNav(), "header still mounted");
  check(!document.body.textContent?.includes(CONC), "flag off hides conciliaciones everywhere");
});

test("PLACEMENT-APP-ADMIN-SIDEBAR", async () => {
  t.reset(null); t.appSiblings(); id = "PLACEMENT-APP-ADMIN-SIDEBAR";
  window.history.replaceState(null, "", "/usuarios"); render(<App />); await settle();
  const main = document.querySelector("main");
  check(main, "operational layout mounted");
  check(![...main!.querySelectorAll("nav a")].some(a => a.textContent === CONC || a.textContent === PERF), "no admin links in operational header");
  const groups = [...document.querySelectorAll('[data-testid="nav-group-administracion-contable"]')];
  check(groups.length > 0, "sidebar administration group mounted");
  for (const g of groups) {
    check(g.querySelector('a[href="/contabilidad/conciliaciones"]')?.textContent?.includes(CONC), "conciliaciones in sidebar");
    check(g.querySelector('a[href="/usuarios"]')?.textContent?.includes(PERF), "profile admin in sidebar");
  }
});
