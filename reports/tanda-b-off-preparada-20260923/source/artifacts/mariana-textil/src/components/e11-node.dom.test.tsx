import assert from "node:assert/strict";
import { test, beforeEach, afterEach } from "node:test";
import React from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider, timeoutManager } from "@tanstack/react-query";
import { Router } from "wouter";
import { E11ApplicationBoundary, E11RoutePage, E11ProfileControl, E11AdminNotices, E11SnapshotNoticeLink } from "../pages/e11";
import { E11SessionProvider, useE11Session } from "../lib/e11-session";
import { E11RecoveryAdmin } from "./e11-recovery-admin";
import type { E11Recovery } from "../lib/e11-recovery";
import * as t from "./e11-node-test-transport";
import type * as api from "@workspace/api-client-react";
import App from "../App";
import { LocationScopeProvider } from "../lib/location-scope";
import { E5Entry } from "./e5-pendientes";
import * as e5 from "./e5-node-test-fixtures";

// Native mounted tests. MAIN executes; no productive hook/page approximations.
// Real App owns a private QueryClient with five-minute GC. Keep real timer
// durations/callbacks but do not let background cache GC keep a finished native
// test process alive. No fake clock, query result, hook or productive component.
timeoutManager.setTimeoutProvider({
  setTimeout: (callback, delay) => { const timer = setTimeout(callback, delay); timer.unref(); return timer; },
  clearTimeout: timer => clearTimeout(timer),
  setInterval: (callback, delay) => { const timer = setInterval(callback, delay); timer.unref(); return timer; },
  clearInterval: timer => clearInterval(timer),
});
let client: QueryClient;
let activeId = "";
beforeEach(() => {
  t.reset();
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false } } });
  Object.defineProperty(globalThis, "sessionStorage", { configurable: true, value: window.sessionStorage });
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: window.localStorage });
  sessionStorage.clear(); localStorage.clear();
  window.confirm = () => true;
  Object.defineProperty(window, "matchMedia", { configurable: true, value: (media: string) => ({
    matches: false, media, onchange: null, addListener() {}, removeListener() {},
    addEventListener() {}, removeEventListener() {}, dispatchEvent() { return false; },
  }) });
});
afterEach(() => { cleanup(); client.clear(); });
const check = (value: unknown) => assert.equal(Boolean(value), true, activeId);
const text = () => document.body.textContent ?? "";
const mismatch = () => /Respuesta (?:ajena|no correspondiente)/.test(text());
async function settle() { for (let i = 0; i < 8; i++) await act(async () => { await new Promise(r => setTimeout(r, 4)); }); }
async function mount(id: string, route: string, profile: "A" | "F" | null = "F", element?: React.ReactNode) {
  activeId = id;
  window.history.replaceState(null, "", route);
  const content = element === undefined ? <E11ApplicationBoundary><E11RoutePage /></E11ApplicationBoundary>
    : <E11SessionProvider user={t.user(profile ? "CONTADOR" : "ADMIN")}>{element}</E11SessionProvider>;
  const view = render(<QueryClientProvider client={client}><Router>{content}</Router></QueryClientProvider>);
  await settle(); return view;
}
async function click(label: string) {
  const element = screen.queryByRole("button", { name: label });
  check(element); if (element) fireEvent.click(element); await settle();
}
async function fill(label: string, value: string) {
  const element = screen.queryByLabelText(label, { exact: true });
  check(element); if (element) fireEvent.change(element, { target: { value } }); await settle();
}
const writes = () => t.requests.filter(r => r.method !== "GET");
const paths = () => t.requests.map(r => r.path);
const seen = (path: string) => paths().includes(path);
const noLegacy = () => check(paths().every(p => p.startsWith("/api/e11/") || p === "/api/auth/me"));
async function app(id: string, route: string) {
  activeId = id; window.history.replaceState(null, "", route);
  const view = render(<App />); await settle(); return view;
}
async function adminApp(id: string, route: string) {
  t.reset(null); t.appSiblings(); return app(id, route);
}
async function e5Entry(id: string) {
  t.reset(null);
  const actor: api.CurrentUser = { ...e5.currentUser("ADMIN", 7), alcanceConsulta: "PROPIA", ubicacion: { ...e5.currentUser().ubicacion!, id: e5.SITE } };
  t.respond("/api/auth/me", actor);
  t.respond("/api/e5/disponibilidad", e5.availability());
  t.respond("/api/e5/cobros", e5.page([]));
  t.respond("/api/e5/contexto", e5.context());
  return mount(id, "/cobros", null, <LocationScopeProvider><E5Entry clienteId={e5.CLIENT} entrada="CLIENTE" /></LocationScopeProvider>);
}
async function e5Review(id: string) {
  await e5Entry(id);
  t.respond("/api/e5/cobros/vista-previa", e5.preview(), "POST");
  await click("Recibir dirigido");
  for (const checkbox of screen.queryAllByRole("checkbox").slice(0, 2)) fireEvent.click(checkbox);
  await fill("Importe recibido", e5.TOTAL);
  const session = screen.queryByLabelText(/Sesión física/); check(session);
  if (session) fireEvent.change(session, { target: { value: String(e5.CURRENT_SESSION) } });
  await fill("Motivo / evidencia obligatoria", "Evidencia de recepción");
  await click("Revisar recepción"); check(Boolean(screen.queryByRole("button", { name: "Confirmar dinero recibido" })));
}
async function profileReview(id: string) {
  t.reset(null);
  await mount(id, "/usuarios", null, <E11ProfileControl usuarioId={9} active />);
  await click("Perfil contable A/F"); await fill("Perfil", "A");
  await fill("Motivo obligatorio", "  Asignación explícita  "); await click("Revisar cambio de perfil");
}
async function snapshotReview(id: string) {
  await mount(id, "/contabilidad/conciliaciones");
  await click("Revisar y congelar periodo"); await click("Revisar snapshot");
}
async function decisionReview(id: string, outcome = "ACEPTADA", amount = "120.00", observation = "") {
  await mount(id, `/contabilidad/conciliaciones/${t.ID}`);
  await fill("Resultado", outcome); await fill("Total del registro externo", amount);
  await fill("Referencia externa obligatoria (texto)", "  Registro externo  ");
  if (observation) await fill("Observación (obligatoria si no cuadra; sin datos sensibles)", observation);
  await click("Revisar decisión documental");
}
async function prepareReview(id: string, amount = "80.00", source?: api.E11Preparacion) {
  t.reset("A"); if (source) t.respond(`/api/e11/a/preparaciones/${t.ID}`, source);
  await mount(id, `/contabilidad/preparaciones/${t.ID}`, "A");
  await fill("Importe cargo 61", amount); await click("Revisar propuesta sin aplicación");
}
function hold(path: string, method = "POST") { t.routes.set(`${method} ${path}`, () => new Promise(() => {})); }
function profileSuccess(override: Partial<api.E11PerfilEvento> = {}) {
  t.routes.set("PUT /api/e11/usuarios/9/perfil", request => ({ ...t.event, uuid: (request.body as api.E11PerfilInput).uuid, ...override }));
}
test("E11-OFF-ROUTE", async () => {
  t.gates(false); await mount("E11-OFF-ROUTE", "/contabilidad/fiscal"); check(text().includes("cerrada")); check(t.requests.length === 0);
});
test("E11-DISABLED-NO-IDENTITY", async () => {
  t.respond("/api/e11/disponibilidad", { ...t.available, enabled: false });
  await mount("E11-DISABLED-NO-IDENTITY", "/contabilidad/fiscal"); check(!seen("/api/e11/identidad")); check(text().includes("E11 está cerrado")); noLegacy();
});
test("E11-IDENTITY-USER", async () => {
  t.respond("/api/e11/identidad", { ...t.identity(), usuarioId: 8 });
  await mount("E11-IDENTITY-USER", "/contabilidad/fiscal"); check(text().includes("no corresponde")); check(!seen("/api/e11/fiscal/ventas"));
});
test("E11-IDENTITY-ROLE", async () => {
  t.respond("/api/e11/identidad", { ...t.identity(), rolBase: "ADMIN" });
  await mount("E11-IDENTITY-ROLE", "/contabilidad/fiscal"); check(text().includes("no corresponde")); check(!seen("/api/e11/fiscal/ventas"));
});
test("E11-F-CLIENTS-SALES", async () => {
  await mount("E11-F-CLIENTS-SALES", "/contabilidad/fiscal");
  check(seen("/api/e11/fiscal/clientes") && seen("/api/e11/fiscal/ventas"));
  check(text().includes("FACTURADO-41") && !text().includes("NO-FACTURADA-51")); noLegacy();
});
test("E11-F-NOT-A", async () => {
  await mount("E11-F-NOT-A", "/contabilidad/finanzas"); check(!seen("/api/e11/finanzas/clientes")); check(text().includes("Ruta no autorizada"));
});
test("E11-A-NOT-F", async () => {
  t.reset("A"); await mount("E11-A-NOT-F", "/contabilidad/fiscal", "A"); check(!seen("/api/e11/fiscal/ventas")); check(text().includes("Ruta no autorizada"));
});
test("E11-CAPABILITY-FISCAL", async () => {
  t.respond("/api/e11/identidad", { ...t.identity(), capacidades: [] });
  await mount("E11-CAPABILITY-FISCAL", "/contabilidad/fiscal"); check(!seen("/api/e11/fiscal/ventas"));
});
test("E11-CLIENT-PARENT-F", async () => {
  await mount("E11-CLIENT-PARENT-F", "/clientes/21"); check(window.location.pathname === "/contabilidad/fiscal"); check(text().includes("FACTURADO-41")); noLegacy();
});
test("E11-CLIENT-PARENT-A", async () => {
  t.reset("A"); await mount("E11-CLIENT-PARENT-A", "/clientes/21", "A"); check(window.location.pathname === "/contabilidad/finanzas/clientes/21"); check(text().includes("NO-FACTURADA-51")); noLegacy();
});
test("E11-E5-PARENT-A", async () => {
  t.reset("A"); await mount("E11-E5-PARENT-A", `/cobros/pendientes/${t.ID}`, "A"); check(window.location.pathname === `/contabilidad/preparaciones/${t.ID}`); noLegacy();
});
test("E11-E5-PARENT-F", async () => {
  await mount("E11-E5-PARENT-F", `/cobros/pendientes/${t.ID}`); check(text().includes("no puede acceder a cobros E5")); noLegacy();
});
test("E11-LEGACY-DEEP-DENIED", async () => {
  await mount("E11-LEGACY-DEEP-DENIED", "/tickets/41/documento"); check(text().includes("Ruta no autorizada")); noLegacy();
});
test("E11-F-DOCUMENT", async () => {
  await mount("E11-F-DOCUMENT", "/contabilidad/fiscal/facturas/41"); check(text().includes("FACTURADO-41")); check(text().includes("no CFDI")); noLegacy();
});
test("E11-F-DOCUMENT-ID", async () => {
  t.respond("/api/e11/fiscal/facturas/41", { ...t.sale, facturaId: 42 });
  await mount("E11-F-DOCUMENT-ID", "/contabilidad/fiscal/facturas/41"); check(text().includes("Documento ajeno")); check(!text().includes("FACTURADO-41"));
});
test("E11-F-SALES-CLIENT-ID", async () => {
  t.respond("/api/e11/fiscal/ventas", { ...t.sales, items: [{ ...t.sale, cliente: { clienteId: 22, nombre: "AJENO" } }] });
  await mount("E11-F-SALES-CLIENT-ID", "/contabilidad/fiscal"); await click(t.customer.nombre);
  check(text().includes("Respuesta fiscal ajena")); check(!text().includes("AJENO"));
});
test("E11-F-PAGER", async () => {
  t.respond("/api/e11/fiscal/clientes", { ...t.fiscalClients, nextCursor: "opaque-page-2" });
  await mount("E11-F-PAGER", "/contabilidad/fiscal");
  const next = screen.queryAllByRole("button", { name: "Siguiente" })[0]; check(next); if (next) fireEvent.click(next); await settle();
  check(t.requests.some(r => r.path === "/api/e11/fiscal/clientes" && r.params.get("cursor") === "opaque-page-2"));
});
test("E11-READ-ERROR-NOT-ZERO", async () => {
  t.routes.set("GET /api/e11/fiscal/ventas", () => { throw t.error("DEPENDENCIA_NO_DISPONIBLE", 503); });
  await mount("E11-READ-ERROR-NOT-ZERO", "/contabilidad/fiscal"); check(text().includes("DEPENDENCIA_NO_DISPONIBLE")); check(!text().includes("Total facturado del intervalo")); noLegacy();
});
test("E11-A-CLIENTS", async () => {
  t.reset("A"); await mount("E11-A-CLIENTS", "/contabilidad/finanzas", "A"); check(text().includes(t.customer.nombre)); check(text().includes(t.customer.contacto!)); noLegacy();
});
test("E11-A-NOTES-UNINVOICED", async () => {
  t.reset("A"); await mount("E11-A-NOTES-UNINVOICED", "/contabilidad/finanzas/clientes/21", "A"); check(text().includes("NO-FACTURADA-51")); check(text().includes("ABONO")); noLegacy();
});
test("E11-A-ACCOUNT-ID", async () => {
  t.reset("A"); t.respond("/api/e11/finanzas/clientes/21/estado-cuenta", { ...t.account, cliente: { ...t.customer, clienteId: 22 } });
  await mount("E11-A-ACCOUNT-ID", "/contabilidad/finanzas/clientes/21", "A"); check(text().includes("Estado de cuenta ajeno"));
});
test("E11-A-NOTE-ID", async () => {
  t.reset("A"); t.respond("/api/e11/finanzas/clientes/21/notas", { ...t.notes, items: [{ ...t.note, clienteId: 22 }] });
  await mount("E11-A-NOTE-ID", "/contabilidad/finanzas/clientes/21", "A"); check(text().includes("Notas ajenas")); check(!text().includes("NO-FACTURADA-51"));
});
test("E11-PROFILE-ADMIN", async () => {
  await profileReview("E11-PROFILE-ADMIN"); profileSuccess(); await click("Confirmar asignación ADMIN");
  check(text().includes("Perfil A confirmado")); check((writes()[0]?.body as api.E11PerfilInput)?.motivo === "Asignación explícita");
});
test("E11-PROFILE-NONADMIN", async () => {
  await mount("E11-PROFILE-NONADMIN", "/usuarios", "F", <E11ProfileControl usuarioId={9} active />);
  check(!screen.queryByRole("button", { name: "Perfil contable A/F" })); check(!seen("/api/e11/usuarios/9/perfil"));
});
test("E11-PROFILE-REASON", async () => {
  t.reset(null); await mount("E11-PROFILE-REASON", "/usuarios", null, <E11ProfileControl usuarioId={9} active />);
  await click("Perfil contable A/F"); const button = screen.queryByRole("button", { name: "Revisar cambio de perfil" }) as HTMLButtonElement | null;
  check(button?.disabled); check(seen("/api/e11/usuarios/9/perfil/historial"));
});
test("E11-PROFILE-HISTORY-ID", async () => {
  t.reset(null); t.respond("/api/e11/usuarios/9/perfil/historial", { ...t.history, items: [{ ...t.event, usuarioId: 10 }] });
  await mount("E11-PROFILE-HISTORY-ID", "/usuarios", null, <E11ProfileControl usuarioId={9} active />); await click("Perfil contable A/F"); check(text().includes("Historial ajeno"));
});
test("E11-PROFILE-FRESH", async () => {
  await profileReview("E11-PROFILE-FRESH"); hold("/api/e11/usuarios/9/perfil", "PUT");
  t.respond("/api/e11/usuarios/9/perfil", { ...t.identity(), usuarioId: 9, perfilVersion: 4 });
  await click("Confirmar asignación ADMIN"); check(writes().length === 0); check(text().includes("Revisión del perfil cambió"));
});
test("E11-PROFILE-RESPONSE-ID", async () => {
  await profileReview("E11-PROFILE-RESPONSE-ID"); profileSuccess({ usuarioId: 10 }); await click("Confirmar asignación ADMIN");
  check(mismatch()); check(!text().includes("Perfil A confirmado")); check(sessionStorage.length > 0);
});
test("E11-PERIOD-WEEK-CALENDAR", async () => {
  t.respond("/api/e11/conciliaciones", { ...t.periods, items: [{ ...t.period, inicio: "2026-01-06", finExclusivo: "2026-01-13" }] });
  await mount("E11-PERIOD-WEEK-CALENDAR", "/contabilidad/conciliaciones"); check((screen.queryByRole("button", { name: "Revisar y congelar periodo" }) as HTMLButtonElement)?.disabled);
});
test("E11-PERIOD-OBLIGATION", async () => {
  t.respond("/api/e11/conciliaciones", { ...t.periods, items: [{ ...t.period, obligatorio: false }] });
  await mount("E11-PERIOD-OBLIGATION", "/contabilidad/conciliaciones"); check((screen.queryByRole("button", { name: "Revisar y congelar periodo" }) as HTMLButtonElement)?.disabled);
});
test("E11-PERIOD-OPEN", async () => {
  t.respond("/api/e11/conciliaciones", { ...t.periods, items: [{ ...t.period, estado: "ABIERTO" }] });
  await mount("E11-PERIOD-OPEN", "/contabilidad/conciliaciones"); check((screen.queryByRole("button", { name: "Revisar y congelar periodo" }) as HTMLButtonElement)?.disabled);
});
test("E11-SNAPSHOT-SEND", async () => {
  await snapshotReview("E11-SNAPSHOT-SEND"); t.routes.set("POST /api/e11/conciliaciones", r => ({ ...t.snapshot, uuid: (r.body as api.E11SnapshotInput).uuid }));
  await click("Confirmar snapshot inmutable"); check(text().includes("Snapshot confirmado")); check(!("totalRevisado" in (writes()[0]?.body as object)));
});
test("E11-SNAPSHOT-FRESH", async () => {
  await snapshotReview("E11-SNAPSHOT-FRESH"); hold("/api/e11/conciliaciones");
  t.respond("/api/e11/fiscal/ventas", { ...t.sales, fuenteRevision: "source-v2" }); await click("Confirmar snapshot inmutable");
  check(writes().length === 0); check(text().includes("FUENTE_CAMBIADA"));
});
test("E11-SNAPSHOT-ID", async () => {
  const valid = await mount("E11-SNAPSHOT-ID", `/contabilidad/conciliaciones/${t.ID}`);
  check(text().includes("FACTURADO-41")); check(seen(`/api/e11/conciliaciones/${t.ID}/ventas`));
  valid.unmount(); client.clear(); t.requests.length = 0;
  const otherSnapshot: api.E11Conciliacion = { ...t.snapshot, id: t.OTHER };
  const otherSales: api.E11FiscalVentas = { ...t.sales, items: [{ ...t.sale, facturaId: 42, ventaId: 42, folioFactura: "FACTURADO-SNAPSHOT-AJENO" }] };
  // Two finite, valid snapshot graphs. The mutated ID guard may consult the
  // foreign graph, but can never fail merely because its transport is missing.
  t.respond(`/api/e11/conciliaciones/${t.OTHER}`, otherSnapshot);
  t.respond(`/api/e11/conciliaciones/${t.OTHER}/ventas`, otherSales);
  t.respond(`/api/e11/conciliaciones/${t.ID}`, otherSnapshot);
  await mount("E11-SNAPSHOT-ID", `/contabilidad/conciliaciones/${t.ID}`);
  check(text().includes("Snapshot ajeno")); check(!text().includes("FACTURADO-SNAPSHOT-AJENO"));
  check(!seen(`/api/e11/conciliaciones/${t.ID}/ventas`) && !seen(`/api/e11/conciliaciones/${t.OTHER}/ventas`));
});
test("E11-SNAPSHOT-FROZEN", async () => {
  t.respond(`/api/e11/conciliaciones/${t.ID}/ventas`, { ...t.sales, fuenteRevision: "live-source-v2" });
  await mount("E11-SNAPSHOT-FROZEN", `/contabilidad/conciliaciones/${t.ID}`); check(text().includes("No se usarán datos vivos")); check(!text().includes("FACTURADO-41"));
});
test("E11-DECISION-EXACT", async () => {
  await decisionReview("E11-DECISION-EXACT", "ACEPTADA", "119.99"); check(text().includes("igualdad exacta")); check(!screen.queryByRole("button", { name: "Confirmar decisión" }));
});
test("E11-DECISION-OBSERVATION", async () => {
  await decisionReview("E11-DECISION-OBSERVATION", "NO_CUADRA"); check(text().includes("Referencia y observación")); check(!screen.queryByRole("button", { name: "Confirmar decisión" }));
});
test("E11-DECISION-NO-CUADRA", async () => {
  await decisionReview("E11-DECISION-NO-CUADRA", "NO_CUADRA", "120.00", "Difiere composición");
  t.routes.set(`POST /api/e11/conciliaciones/${t.ID}/decisiones`, r => ({ ...t.snapshot, decisiones: [{ ...(r.body as api.E11DecisionInput), id: t.OTHER, actorId: 7, creadoEn: t.instant, avisoAdminId: t.ID }] }));
  await click("Confirmar decisión"); check(text().includes("Decisión documental registrada")); check((writes()[0]?.body as api.E11DecisionInput)?.resultado === "NO_CUADRA");
});
test("E11-DECISION-FRESH", async () => {
  await decisionReview("E11-DECISION-FRESH"); hold(`/api/e11/conciliaciones/${t.ID}/decisiones`);
  t.respond("/api/e11/fiscal/ventas", { ...t.sales, fuenteRevision: "changed" }); await click("Confirmar decisión"); check(writes().length === 0); check(text().includes("FUENTE_CAMBIADA"));
});
test("E11-ADMIN-NOTICE", async () => {
  t.reset(null); t.respond("/api/e11/conciliaciones", { ...t.periods, items: [{ ...t.period, estado: "NO_CUADRA", ultimaConciliacionId: t.ID }, { ...t.period, tipo: "DIA", inicio: "2026-01-01", finExclusivo: "2026-01-02", obligatorio: false }] });
  await mount("E11-ADMIN-NOTICE", "/notificaciones", null, <E11AdminNotices />);
  check(text().includes("NO_CUADRA")); check(!text().includes("2026-01-01")); check(!screen.queryByRole("button", { name: "Revisar y congelar periodo" }));
});
test("E11-ADMIN-NOTICE-LINK", async () => {
  t.reset(null); await mount("E11-ADMIN-NOTICE-LINK", "/notificaciones", null, <E11SnapshotNoticeLink entity="e11_conciliaciones" id={t.ID} />);
  check(screen.queryByRole("link")?.getAttribute("href") === `/contabilidad/conciliaciones/${t.ID}`);
});
test("E11-PREPARATIONS", async () => {
  t.reset("A"); await mount("E11-PREPARATIONS", "/contabilidad/preparaciones", "A"); check(text().includes(`Recepción ${t.ID}`)); noLegacy();
});
test("E11-PREPARATION-ID", async () => {
  t.reset("A"); t.respond(`/api/e11/a/preparaciones/${t.ID}`, { ...t.preparation, cobroId: t.OTHER });
  await mount("E11-PREPARATION-ID", `/contabilidad/preparaciones/${t.ID}`, "A"); check(text().includes("Recepción/notas ajenas")); check(!screen.queryByLabelText("Importe cargo 61"));
});
test("E11-PREPARATION-SEND", async () => {
  await prepareReview("E11-PREPARATION-SEND"); t.respond(`/api/e11/a/preparaciones/${t.ID}`, { ...t.preparation, revision: 2, propuestaId: t.OTHER }, "POST");
  await click("Confirmar preparación A"); check(text().includes(`Propuesta ${t.OTHER} preparada`));
  assert.deepEqual((writes()[0]?.body as api.E11PreparacionInput)?.asignaciones, [{ notaId: 51, movimientoVentaId: 61, importe: "80.00" }], activeId); noLegacy();
});
test("E11-PREPARATION-RETAINED", async () => {
  await prepareReview("E11-PREPARATION-RETAINED", "121.00", { ...t.preparation, notas: [{ ...t.note, total: "200.00", saldo: "200.00" }] });
  check(!screen.queryByRole("button", { name: "Confirmar preparación A" })); check(text().includes("suma excede"));
});
test("E11-PREPARATION-FRESH", async () => {
  await prepareReview("E11-PREPARATION-FRESH"); hold(`/api/e11/a/preparaciones/${t.ID}`);
  t.respond(`/api/e11/a/preparaciones/${t.ID}`, { ...t.preparation, revision: 2 }); await click("Confirmar preparación A"); check(writes().length === 0); check(text().includes("Fuente/revisión cambió"));
});
test("E11-PREPARATION-RESPONSE", async () => {
  await prepareReview("E11-PREPARATION-RESPONSE"); t.respond(`/api/e11/a/preparaciones/${t.ID}`, { ...t.preparation, revision: 2, propuestaId: t.OTHER, retenido: "40.00" }, "POST");
  await click("Confirmar preparación A"); check(mismatch()); check(!text().includes(`Propuesta ${t.OTHER} preparada`));
});
test("E11-WRITE-DOUBLE", async () => {
  await profileReview("E11-WRITE-DOUBLE"); hold("/api/e11/usuarios/9/perfil", "PUT");
  const button = screen.queryByRole("button", { name: "Confirmar asignación ADMIN" }); check(button);
  await act(async () => { if (button) { fireEvent.click(button); fireEvent.click(button); } }); await settle(); check(writes().length === 1);
});
test("E11-WRITE-RETRY-EXACT", async () => {
  await profileReview("E11-WRITE-RETRY-EXACT"); t.routes.set("PUT /api/e11/usuarios/9/perfil", () => { throw new Error("Timeout ambiguo"); });
  await click("Confirmar asignación ADMIN"); const original = structuredClone(writes()[0]?.body);
  check(sessionStorage.length > 0); profileSuccess(); await click("Reintentar exactamente la intención incierta");
  assert.deepEqual(writes()[1]?.body, original, activeId); check(text().includes("Perfil A confirmado"));
});
test("E11-WRITE-409-NEW-UUID", async () => {
  await profileReview("E11-WRITE-409-NEW-UUID"); t.routes.set("PUT /api/e11/usuarios/9/perfil", () => { throw t.error("REVISION_OBSOLETA"); });
  await click("Confirmar asignación ADMIN"); const original = (writes()[0]?.body as api.E11PerfilInput)?.uuid;
  check(!screen.queryByRole("button", { name: "Reintentar exactamente la intención incierta" }));
  check((screen.queryByLabelText("Motivo obligatorio") as HTMLTextAreaElement)?.value.trim() === "Asignación explícita");
  profileSuccess(); await click("Revisar cambio de perfil"); await click("Confirmar asignación ADMIN");
  check((writes()[1]?.body as api.E11PerfilInput)?.uuid !== original);
});
test("E11-WRITE-REVOKED", async () => {
  await profileReview("E11-WRITE-REVOKED"); hold("/api/e11/usuarios/9/perfil", "PUT");
  t.respond("/api/e11/identidad", { ...t.identity(null), permisosVersion: "revoked" });
  await click("Confirmar asignación ADMIN"); check(writes().length === 0); check(sessionStorage.length === 0);
});
test("E11-CACHE-PROFILE-VERSION", async () => {
  await mount("E11-CACHE-PROFILE-VERSION", "/contabilidad/fiscal");
  const keys = () => client.getQueryCache().getAll().filter(q => String(q.queryKey[0]) === "/api/e11/fiscal/ventas").map(q => JSON.stringify(q.queryKey));
  const original = keys()[0]; check(original);
  t.respond("/api/e11/identidad", { ...t.identity(), perfilVersion: 4 });
  await act(async () => { await client.invalidateQueries({ predicate: q => q.queryKey[0] === "/api/e11/identidad" }); }); await settle();
  check(!keys().includes(original)); check(keys().length > 0);
});

// Original obligations retained against final original-actor metadata contract.
test("E11-UNCERTAIN-RETRY-403-PRESERVES", async () => {
  await profileReview("E11-UNCERTAIN-RETRY-403-PRESERVES");
  t.routes.set("PUT /api/e11/usuarios/9/perfil", () => { throw new Error("Transport lost after possible commit"); });
  await click("Confirmar asignación ADMIN"); const first = structuredClone(writes()[0]?.body);
  check(sessionStorage.length > 0);
  check(recoveryRecords().some(r => r.actorId === 7 && r.accion === "PERFIL" && r.uuidOriginal === (first as api.E11PerfilInput).uuid));
  t.routes.set("PUT /api/e11/usuarios/9/perfil", () => { throw t.error("PERMISO_DENEGADO", 403); });
  await click("Reintentar exactamente la intención incierta");
  assert.deepEqual(writes()[1]?.body, first, activeId);
  check(sessionStorage.length > 0);
  check(!screen.queryByRole("button", { name: "Revisar cambio de perfil" }));
});
test("E11-UNCERTAIN-RETRY-STALE-PRESERVES", async () => {
  await profileReview("E11-UNCERTAIN-RETRY-STALE-PRESERVES");
  t.routes.set("PUT /api/e11/usuarios/9/perfil", () => { throw new Error("Transport lost after possible commit"); });
  await click("Confirmar asignación ADMIN"); const first = structuredClone(writes()[0]?.body);
  t.routes.set("PUT /api/e11/usuarios/9/perfil", () => { throw t.error("REVISION_OBSOLETA", 409); });
  await click("Reintentar exactamente la intención incierta");
  assert.deepEqual(writes()[1]?.body, first, activeId);
  check(sessionStorage.length > 0);
  check(recoveryRecords().some(r => r.actorId === 7 && r.accion === "PERFIL" && r.uuidOriginal === (first as api.E11PerfilInput).uuid));
  check(!screen.queryByRole("button", { name: "Revisar cambio de perfil" }));
});
test("E11-POSTCOMMIT-PROFILE-PRIVACY-UUID", async () => {
  await prepareReview("E11-POSTCOMMIT-PROFILE-PRIVACY-UUID");
  t.routes.set(`POST /api/e11/a/preparaciones/${t.ID}`, () => {
    // Server effect exists; delivery now observes revoked A. No result is exposed.
    t.respond("/api/e11/identidad", { ...t.identity("F"), perfilVersion: 4 });
    return { ...t.preparation, revision: 2, propuestaId: t.OTHER };
  });
  await click("Confirmar preparación A");
  check(writes().length === 1);
  check(!text().includes(`Propuesta ${t.OTHER} preparada`));
  check(!text().includes("NO-FACTURADA-51"));
  const uuid = (writes()[0]?.body as api.E11PreparacionInput)?.uuid;
  const receipt = recoveryRecords().find(r => r.uuidOriginal === uuid);
  assert.deepEqual(receipt, { actorId: 7, accion: "PREPARACION", uuidOriginal: uuid, state: "QUARANTINE" }, activeId);
  check(Object.keys(sessionStorage).every(key => !key.startsWith("e11-intencion:")));
  const persisted = [...Object.keys(localStorage).map(k => localStorage.getItem(k)), ...Object.keys(sessionStorage).map(k => sessionStorage.getItem(k))].join("");
  check(!persisted.includes("NO-FACTURADA-51") && !persisted.includes("asignaciones") && !persisted.includes("retenido"));
});

test("E11-APP-COUNTER-BOUNDARY", async () => {
  await app("E11-APP-COUNTER-BOUNDARY", "/contabilidad/fiscal");
  check(text().includes("FACTURADO-41")); check(text().includes("Contabilidad · F")); noLegacy();
});
test("E11-APP-ADMIN-ROUTE", async () => {
  await adminApp("E11-APP-ADMIN-ROUTE", "/contabilidad/conciliaciones");
  check(seen("/api/e11/conciliaciones")); check(text().includes("Conciliaciones de ventas facturadas"));
  check(!screen.queryByRole("button", { name: "Revisar y congelar periodo" }));
});
test("E11-APP-E5-DOCUMENT-PRIVATE", async () => {
  t.reset("A"); await app("E11-APP-E5-DOCUMENT-PRIVATE", `/cobros/pendientes/${t.ID}/documentos/${t.OTHER}`);
  check(text().includes("Ruta no autorizada")); check(!paths().some(p => p.startsWith("/api/e5/"))); noLegacy();
});
test("E11-APP-PAGOS-REDIRECT", async () => {
  t.reset("A"); await app("E11-APP-PAGOS-REDIRECT", "/pagos-dirigidos");
  check(window.location.pathname === "/contabilidad/preparaciones"); check(seen("/api/e11/a/preparaciones")); noLegacy();
});
test("E11-USUARIOS-PARENT-CONTROL", async () => {
  await adminApp("E11-USUARIOS-PARENT-CONTROL", "/usuarios");
  check(seen("/api/users")); check(text().includes("Contador destinatario")); await click("Perfil contable A/F");
  check(seen("/api/e11/usuarios/9/perfil")); check(seen("/api/e11/usuarios/9/perfil/historial"));
});
test("E11-USUARIOS-NOT-OTHER-ROLES", async () => {
  await adminApp("E11-USUARIOS-NOT-OTHER-ROLES", "/usuarios");
  check(text().includes("Caja sin perfil")); check(screen.queryAllByRole("button", { name: "Perfil contable A/F" }).length === 1);
});
test("E11-USUARIOS-PARENT-ASSIGN", async () => {
  await adminApp("E11-USUARIOS-PARENT-ASSIGN", "/usuarios");
  await click("Perfil contable A/F"); await fill("Perfil", "A"); await fill("Motivo obligatorio", "Asignación explícita");
  await click("Revisar cambio de perfil"); profileSuccess(); await click("Confirmar asignación ADMIN");
  check(text().includes("Perfil A confirmado")); check(writes().length === 1); check(writes()[0]?.path === "/api/e11/usuarios/9/perfil");
});
test("E11-NOTIFICACIONES-PARENT", async () => {
  await adminApp("E11-NOTIFICACIONES-PARENT", "/notificaciones");
  check(seen("/api/notificaciones")); check(seen("/api/e11/conciliaciones"));
  check(screen.queryByRole("link", { name: "Revisar snapshot NO CUADRA (sin efecto monetario)" })?.getAttribute("href") === `/contabilidad/conciliaciones/${t.ID}`);
});
test("E11-CONCILIACION-PARENT", async () => {
  await adminApp("E11-CONCILIACION-PARENT", "/administracion/conciliacion");
  check(seen("/api/inventario/conciliacion")); check(seen("/api/e11/conciliaciones"));
  check(text().includes("ADMIN · discrepancias documentales"));
});
test("E11-E5-SCOPE-PROFILE-VERSION", async () => {
  await e5Entry("E11-E5-SCOPE-PROFILE-VERSION");
  check(text().includes("Dinero recibido pendiente de aplicación"));
  const keys = () => client.getQueryCache().getAll().filter(q => String(q.queryKey[0]) === "/api/e5/disponibilidad").map(q => JSON.stringify(q.queryKey));
  const original = keys()[0]; check(original);
  t.respond("/api/e11/identidad", { ...t.identity(null), perfilVersion: 4 });
  await act(async () => { await client.invalidateQueries({ predicate: q => q.queryKey[0] === "/api/e11/identidad" }); }); await settle();
  check(keys().length > 0 && !keys().includes(original));
});
test("E11-E5-SCOPE-PERMISSIONS-VERSION", async () => {
  await e5Entry("E11-E5-SCOPE-PERMISSIONS-VERSION");
  const keys = () => client.getQueryCache().getAll().filter(q => String(q.queryKey[0]) === "/api/e5/disponibilidad").map(q => JSON.stringify(q.queryKey));
  const original = keys()[0]; check(original);
  t.respond("/api/e11/identidad", { ...t.identity(null), permisosVersion: "permissions-v4" });
  await act(async () => { await client.invalidateQueries({ predicate: q => q.queryKey[0] === "/api/e11/identidad" }); }); await settle();
  check(keys().length > 0 && !keys().includes(original));
});
test("E11-E5-LEGACY-CONTADOR-BLOCKED", async () => {
  t.reset("A");
  t.respond("/api/auth/me", { ...e5.currentUser("CONTADOR", 7), alcanceConsulta: "PROPIA" });
  t.respond("/api/e5/disponibilidad", { enabled: true, capacidades: e5.capabilities("CONTADOR", { puedePreparar: true, preparacionADisponible: true }) } satisfies api.E5Disponibilidad);
  await mount("E11-E5-LEGACY-CONTADOR-BLOCKED", "/cobros", "A", <LocationScopeProvider><E5Entry clienteId={e5.CLIENT} entrada="CLIENTE" /></LocationScopeProvider>);
  check(text().includes("exclusivamente las proyecciones")); check(!paths().some(p => p.startsWith("/api/e5/")));
});
async function periodButton(id: string, value: api.E11Periodo, disabled: boolean) {
  t.respond("/api/e11/conciliaciones", { ...t.periods, items: [value] } satisfies api.E11Periodos);
  await mount(id, "/contabilidad/conciliaciones");
  const button = screen.queryByRole("button", { name: value.ultimaConciliacionId ? "Revisar nueva versión vinculada" : "Revisar y congelar periodo" }) as HTMLButtonElement | null;
  check(button); assert.equal(button?.disabled, disabled, id);
}
test("E11-CALENDAR-MONTH-FIRST", async () => {
  await periodButton("E11-CALENDAR-MONTH-FIRST", { ...t.period, tipo: "MES", inicio: "2026-01-02", finExclusivo: "2026-02-02" }, true);
});
test("E11-CALENDAR-WEEK-LENGTH", async () => {
  await periodButton("E11-CALENDAR-WEEK-LENGTH", { ...t.period, finExclusivo: "2026-01-13" }, true);
});
test("E11-CALENDAR-MONTH-LEAP", async () => {
  await periodButton("E11-CALENDAR-MONTH-LEAP", { ...t.period, tipo: "MES", inicio: "2024-02-01", finExclusivo: "2024-03-01" }, false);
});
test("E11-CALENDAR-DAY-OPTIONAL", async () => {
  await periodButton("E11-CALENDAR-DAY-OPTIONAL", { ...t.period, tipo: "DIA", inicio: "2026-01-05", finExclusivo: "2026-01-06", obligatorio: false }, false);
  check(text().includes("Aceptación opcional"));
});
test("E11-CALENDAR-NO-DEADLINE", async () => {
  await periodButton("E11-CALENDAR-NO-DEADLINE", { ...t.period, inicio: "2001-01-01", finExclusivo: "2001-01-08" }, false);
  check(text().includes("Sin vencimientos ni efectos monetarios"));
});
test("E11-CALENDAR-FUTURE", async () => {
  await periodButton("E11-CALENDAR-FUTURE", { ...t.period, tipo: "MES", inicio: "2099-01-01", finExclusivo: "2099-02-01" }, true);
});
test("E11-CALENDAR-ACCEPTED", async () => {
  await periodButton("E11-CALENDAR-ACCEPTED", { ...t.period, estado: "ACEPTADA", ultimaConciliacionId: t.ID }, true);
});
test("E11-SNAPSHOT-PERIOD-FRESH", async () => {
  await snapshotReview("E11-SNAPSHOT-PERIOD-FRESH"); hold("/api/e11/conciliaciones");
  t.respond("/api/e11/conciliaciones", { ...t.periods, items: [{ ...t.period, ultimaConciliacionId: t.OTHER }] });
  await click("Confirmar snapshot inmutable"); check(writes().length === 0); check(text().includes("periodo o su revisión cambió"));
});
test("E11-SNAPSHOT-RESPONSE-PERIOD", async () => {
  await snapshotReview("E11-SNAPSHOT-RESPONSE-PERIOD");
  t.routes.set("POST /api/e11/conciliaciones", r => ({ ...t.snapshot, uuid: (r.body as api.E11SnapshotInput).uuid, periodo: { ...t.period, inicio: "2026-01-12", finExclusivo: "2026-01-19" } }));
  await click("Confirmar snapshot inmutable"); check(mismatch()); check(!text().includes("Snapshot confirmado"));
});
test("E11-SNAPSHOT-RESPONSE-TOTAL", async () => {
  await snapshotReview("E11-SNAPSHOT-RESPONSE-TOTAL");
  t.routes.set("POST /api/e11/conciliaciones", r => ({ ...t.snapshot, uuid: (r.body as api.E11SnapshotInput).uuid, totalFacturado: "119.99" }));
  await click("Confirmar snapshot inmutable"); check(mismatch()); check(!text().includes("Snapshot confirmado"));
});
test("E11-DECISION-RESPONSE-ACTOR", async () => {
  await decisionReview("E11-DECISION-RESPONSE-ACTOR");
  t.routes.set(`POST /api/e11/conciliaciones/${t.ID}/decisiones`, r => ({ ...t.snapshot, decisiones: [{ ...(r.body as api.E11DecisionInput), id: t.OTHER, actorId: 8, creadoEn: t.instant, avisoAdminId: null }] }));
  await click("Confirmar decisión"); check(mismatch()); check(!text().includes("Decisión documental registrada"));
});
test("E11-DECISION-HISTORICAL", async () => {
  t.respond(`/api/e11/conciliaciones/${t.ID}`, { ...t.snapshot, vigente: false });
  await mount("E11-DECISION-HISTORICAL", `/contabilidad/conciliaciones/${t.ID}`);
  check(text().includes("Revisión histórica")); check(!screen.queryByLabelText("Resultado"));
});
test("E11-DECISION-ALREADY-DECIDED", async () => {
  const decision: api.E11Decision = { id: t.OTHER, uuid: t.OTHER, actorId: 7, creadoEn: t.instant, resultado: "NO_CUADRA", totalExterno: "120.00", referenciaExterna: "Registro", observacion: "Difiere composición", avisoAdminId: t.ID };
  t.respond(`/api/e11/conciliaciones/${t.ID}`, { ...t.snapshot, decisiones: [decision] });
  await mount("E11-DECISION-ALREADY-DECIDED", `/contabilidad/conciliaciones/${t.ID}`);
  check(text().includes("no satisface aceptación obligatoria")); check(!screen.queryByLabelText("Resultado"));
});
test("E11-PROFILE-RESPONSE-UUID", async () => {
  await profileReview("E11-PROFILE-RESPONSE-UUID"); profileSuccess({ uuid: t.OTHER }); await click("Confirmar asignación ADMIN");
  check(mismatch()); check(!text().includes("Perfil A confirmado"));
});
test("E11-PROFILE-RESPONSE-ACTOR", async () => {
  await profileReview("E11-PROFILE-RESPONSE-ACTOR"); profileSuccess({ actorId: 8 }); await click("Confirmar asignación ADMIN");
  check(mismatch()); check(!text().includes("Perfil A confirmado"));
});
test("E11-PROFILE-RESPONSE-REVISION", async () => {
  await profileReview("E11-PROFILE-RESPONSE-REVISION"); profileSuccess({ revision: 3 }); await click("Confirmar asignación ADMIN");
  check(mismatch()); check(!text().includes("Perfil A confirmado"));
});
test("E11-FISCAL-PRIVATE-FIELDS", async () => {
  t.respond("/api/e11/fiscal/facturas/41", { ...t.sale, medio: "PRIVATE_BANK_SECRET", notasLibres: "PRIVATE_ADDRESS_SECRET", saldoAFavor: "PRIVATE_CREDIT_SECRET" });
  await mount("E11-FISCAL-PRIVATE-FIELDS", "/contabilidad/fiscal/facturas/41");
  check(text().includes("FACTURADO-41")); check(!text().includes("PRIVATE_")); noLegacy();
});
test("E11-A-PRIVATE-FIELDS", async () => {
  t.reset("A"); t.respond("/api/e11/finanzas/clientes", { ...t.financialClients, items: [{ ...t.customer, domicilio: "PRIVATE_ADDRESS_SECRET", notas: "PRIVATE_FREE_TEXT_SECRET" }] });
  await mount("E11-A-PRIVATE-FIELDS", "/contabilidad/finanzas", "A");
  check(text().includes(t.customer.nombre)); check(!text().includes("PRIVATE_")); noLegacy();
});
test("E11-A-TO-F-REVOKES-CACHE", async () => {
  t.reset("A"); await mount("E11-A-TO-F-REVOKES-CACHE", "/contabilidad/finanzas/clientes/21", "A");
  check(text().includes("NO-FACTURADA-51"));
  const keys = client.getQueryCache().getAll().filter(q => String(q.queryKey[0]).includes("/finanzas/")).map(q => q.queryHash); check(keys.length > 0);
  t.respond("/api/e11/identidad", { ...t.identity("F"), perfilVersion: 4 });
  await act(async () => { await client.invalidateQueries({ predicate: q => q.queryKey[0] === "/api/e11/identidad" }); }); await settle();
  check(!text().includes("NO-FACTURADA-51")); check(!client.getQueryCache().getAll().some(q => keys.includes(q.queryHash)));
});
async function paginate(path: string, index = 0) {
  const buttons = screen.queryAllByRole("button", { name: "Siguiente" }); check(buttons[index]);
  if (buttons[index]) fireEvent.click(buttons[index]); await settle();
  check(t.requests.some(r => r.path === path && r.params.get("cursor") === "opaque-next"));
}
test("E11-FINANCE-NOTES-PAGE", async () => {
  t.reset("A"); t.respond("/api/e11/finanzas/clientes/21/notas", { ...t.notes, nextCursor: "opaque-next" });
  await mount("E11-FINANCE-NOTES-PAGE", "/contabilidad/finanzas/clientes/21", "A"); await paginate("/api/e11/finanzas/clientes/21/notas", 1);
});
test("E11-FINANCE-ACCOUNT-PAGE", async () => {
  t.reset("A"); t.respond("/api/e11/finanzas/clientes/21/estado-cuenta", { ...t.account, nextCursor: "opaque-next" });
  await mount("E11-FINANCE-ACCOUNT-PAGE", "/contabilidad/finanzas/clientes/21", "A"); await paginate("/api/e11/finanzas/clientes/21/estado-cuenta");
});
test("E11-FISCAL-SALES-PAGE", async () => {
  t.respond("/api/e11/fiscal/ventas", { ...t.sales, nextCursor: "opaque-next" });
  await mount("E11-FISCAL-SALES-PAGE", "/contabilidad/fiscal"); await paginate("/api/e11/fiscal/ventas", 1);
});
test("E11-SNAPSHOT-SALES-PAGE", async () => {
  t.respond(`/api/e11/conciliaciones/${t.ID}/ventas`, { ...t.sales, nextCursor: "opaque-next" });
  await mount("E11-SNAPSHOT-SALES-PAGE", `/contabilidad/conciliaciones/${t.ID}`); await paginate(`/api/e11/conciliaciones/${t.ID}/ventas`);
});
test("E11-PREPARATIONS-PAGE", async () => {
  t.reset("A"); t.respond("/api/e11/a/preparaciones", { ...t.preparations, nextCursor: "opaque-next" });
  await mount("E11-PREPARATIONS-PAGE", "/contabilidad/preparaciones", "A"); await paginate("/api/e11/a/preparaciones");
});
test("E11-HISTORY-PAGE", async () => {
  t.reset(null); t.respond("/api/e11/usuarios/9/perfil/historial", { ...t.history, nextCursor: "opaque-next" });
  await mount("E11-HISTORY-PAGE", "/usuarios", null, <E11ProfileControl usuarioId={9} active />); await click("Perfil contable A/F"); await paginate("/api/e11/usuarios/9/perfil/historial");
});
test("E11-PAGE-ERROR-RESTART", async () => {
  t.routes.set("GET /api/e11/fiscal/clientes", r => {
    if (r.params.has("cursor")) throw t.error("FUENTE_CAMBIADA", 409);
    return { ...t.fiscalClients, nextCursor: "opaque-next" };
  });
  await mount("E11-PAGE-ERROR-RESTART", "/contabilidad/fiscal"); await paginate("/api/e11/fiscal/clientes");
  check(text().includes("FUENTE_CAMBIADA")); await click("Descartar cursor y volver al inicio");
  check(!text().includes("FUENTE_CAMBIADA")); check(Boolean(screen.queryByRole("button", { name: t.customer.nombre })));
});
test("E11-IDENTITY-AUTH-REVOKED", async () => {
  await mount("E11-IDENTITY-AUTH-REVOKED", "/contabilidad/fiscal");
  check(text().includes("FACTURADO-41"));
  t.routes.set("GET /api/e11/identidad", () => { throw t.error("NO_AUTENTICADO", 401); });
  await act(async () => { await client.invalidateQueries({ predicate: q => q.queryKey[0] === "/api/e11/identidad" }); }); await settle();
  check(text().includes("NO_AUTENTICADO")); check(!text().includes("FACTURADO-41")); noLegacy();
});
test("E11-FISCAL-FORBIDDEN-NO-FALLBACK", async () => {
  t.routes.set("GET /api/e11/fiscal/ventas", () => { throw t.error("PERFIL_DENEGADO", 403); });
  await mount("E11-FISCAL-FORBIDDEN-NO-FALLBACK", "/contabilidad/fiscal");
  check(text().includes("PERFIL_DENEGADO")); check(!text().includes("FACTURADO-41")); noLegacy();
});
test("E11-PERIODS-PAGE", async () => {
  t.respond("/api/e11/conciliaciones", { ...t.periods, nextCursor: "opaque-next" });
  await mount("E11-PERIODS-PAGE", "/contabilidad/conciliaciones"); await paginate("/api/e11/conciliaciones");
});
test("E11-FINANCE-CLIENTS-PAGE", async () => {
  t.reset("A"); t.respond("/api/e11/finanzas/clientes", { ...t.financialClients, nextCursor: "opaque-next" });
  await mount("E11-FINANCE-CLIENTS-PAGE", "/contabilidad/finanzas", "A"); await paginate("/api/e11/finanzas/clientes");
});
test("E11-PREPARATION-NOTE-BALANCE", async () => {
  await prepareReview("E11-PREPARATION-NOTE-BALANCE", "80.00", { ...t.preparation, notas: [{ ...t.note, saldo: "79.99" }] });
  check(text().includes("Importe inválido")); check(!screen.queryByRole("button", { name: "Confirmar preparación A" }));
});
test("E11-PREPARATION-EXACT-CHARGE-FRESH", async () => {
  await prepareReview("E11-PREPARATION-EXACT-CHARGE-FRESH"); hold(`/api/e11/a/preparaciones/${t.ID}`);
  t.respond(`/api/e11/a/preparaciones/${t.ID}`, { ...t.preparation, notas: [{ ...t.note, movimientoVentaId: 62 }] });
  await click("Confirmar preparación A"); check(writes().length === 0); check(text().includes("NOTA_SIN_SALDO"));
});
test("E11-PREPARATION-NOTES-SAME-CLIENT", async () => {
  t.reset("A"); t.respond(`/api/e11/a/preparaciones/${t.ID}`, { ...t.preparation, notas: [{ ...t.note, clienteId: 22 }] });
  await mount("E11-PREPARATION-NOTES-SAME-CLIENT", `/contabilidad/preparaciones/${t.ID}`, "A");
  check(text().includes("Recepción/notas ajenas")); check(!screen.queryByLabelText("Importe cargo 61"));
});
test("E11-PREPARATION-LIST-CLIENT", async () => {
  t.reset("A"); t.respond("/api/e11/a/preparaciones", { ...t.preparations, items: [{ ...t.preparation, clienteId: 22 }] });
  await mount("E11-PREPARATION-LIST-CLIENT", "/contabilidad/preparaciones?clienteId=21", "A");
  check(text().includes("Recepciones ajenas")); check(!text().includes(`Recepción ${t.ID}`));
});
test("E11-PREPARATION-DEPENDENCY-OFF", async () => {
  t.reset("A"); t.respond("/api/e11/disponibilidad", { ...t.available, preparacionE5: false });
  await mount("E11-PREPARATION-DEPENDENCY-OFF", "/contabilidad/preparaciones", "A");
  check(!seen("/api/e11/a/preparaciones")); check(!screen.queryByRole("link", { name: "Preparaciones E5 (sin aplicar)" }));
});
test("E11-PROFILE-DEPENDENCY-OFF", async () => {
  t.reset(null); t.respond("/api/e11/disponibilidad", { ...t.available, perfiles: false });
  await mount("E11-PROFILE-DEPENDENCY-OFF", "/usuarios", null, <E11ProfileControl usuarioId={9} active />);
  check(!screen.queryByRole("button", { name: "Perfil contable A/F" })); check(!seen("/api/e11/usuarios/9/perfil"));
});
test("E11-CONCILIATION-DEPENDENCY-OFF", async () => {
  t.respond("/api/e11/disponibilidad", { ...t.available, conciliacion: false });
  await mount("E11-CONCILIATION-DEPENDENCY-OFF", "/contabilidad/conciliaciones");
  check(!seen("/api/e11/conciliaciones")); check(!screen.queryByRole("link", { name: "Conciliaciones documentales" }));
});
test("E11-APP-OFF-USUARIOS", async () => {
  t.reset(null); t.appSiblings(); t.gates(false);
  await app("E11-APP-OFF-USUARIOS", "/usuarios");
  check(text().includes("Contador destinatario"));
  check(!paths().some(p => p.startsWith("/api/e11/")));
  check(!screen.queryByRole("button", { name: "Perfil contable A/F" }));
});
test("E11-APP-ADMIN-NAVIGATION", async () => {
  await adminApp("E11-APP-ADMIN-NAVIGATION", "/usuarios");
  check(Boolean(screen.queryByRole("link", { name: "Administrar perfiles A/F" })));
});
const noticeFeed: api.NotificationFeed = { ...t.notificationFeed, events: [{
  id: "system:81", kind: "SYSTEM", family: "AVISO", title: "Snapshot NO CUADRA", message: "Composición difiere",
  href: `/contabilidad/conciliaciones/${t.ID}`, updatedAt: t.instant, siteId: null, action: null,
}] };
async function openAppBell(id: string, off = false) {
  t.reset(null); t.appSiblings(); if (off) t.gates(false);
  t.respond("/api/notificaciones/feed", noticeFeed);
  await app(id, "/usuarios");
  const bell = screen.queryAllByRole("button", { name: "Abrir notificaciones" })[0]; check(bell);
  if (bell) fireEvent.click(bell); await settle();
}
test("E11-ADMIN-BELL-LINK", async () => {
  await openAppBell("E11-ADMIN-BELL-LINK");
  check(screen.queryAllByRole("link", { name: "Ver detalle" }).some(link => link.getAttribute("href") === `/contabilidad/conciliaciones/${t.ID}`));
});
test("E11-OFF-BELL-NO-LINK", async () => {
  await openAppBell("E11-OFF-BELL-NO-LINK", true);
  check(!screen.queryAllByRole("link", { name: "Ver detalle" }).some(link => link.getAttribute("href") === `/contabilidad/conciliaciones/${t.ID}`));
  check(!paths().some(p => p.startsWith("/api/e11/")));
});
test("E11-E5-LAST-PROFILE-RECHECK", async () => {
  await e5Review("E11-E5-LAST-PROFILE-RECHECK"); hold("/api/e5/cobros");
  t.routes.set("GET /api/e5/contexto", () => {
    t.respond("/api/e11/identidad", { ...t.identity(null), perfilVersion: 4 });
    return e5.context();
  });
  await click("Confirmar dinero recibido");
  check(!t.requests.some(r => r.method === "POST" && r.path === "/api/e5/cobros"));
});
test("E11-E5-LAST-PERMISSIONS-RECHECK", async () => {
  await e5Review("E11-E5-LAST-PERMISSIONS-RECHECK"); hold("/api/e5/cobros");
  t.routes.set("GET /api/e5/contexto", () => {
    t.respond("/api/e11/identidad", { ...t.identity(null), permisosVersion: "revoked-after-source" });
    return e5.context();
  });
  await click("Confirmar dinero recibido");
  check(!t.requests.some(r => r.method === "POST" && r.path === "/api/e5/cobros"));
});
test("E11-E5-OFF-LEGACY-CAPABILITY", async () => {
  activeId = "E11-E5-OFF-LEGACY-CAPABILITY"; t.reset("A"); t.gates(false);
  t.respond("/api/auth/me", { ...e5.currentUser("CONTADOR", 7), alcanceConsulta: "PROPIA" });
  t.respond("/api/e5/disponibilidad", { enabled: true, capacidades: e5.capabilities("CONTADOR", { puedePreparar: true, preparacionADisponible: true }) } satisfies api.E5Disponibilidad);
  t.respond("/api/e5/cobros", e5.page([]));
  render(<QueryClientProvider client={client}><Router><LocationScopeProvider><E5Entry clienteId={e5.CLIENT} entrada="CLIENTE" /></LocationScopeProvider></Router></QueryClientProvider>);
  await settle(); check(text().includes("Dinero recibido pendiente de aplicación")); check(!paths().some(p => p.startsWith("/api/e11/")));
});

// Real session/notice/resolver/generated hooks. Only transport and native confirm
// are controlled. Metadata is the exact final persisted format, not a fake UI.
const recoveryRecord: E11Recovery = { actorId: t.recoveryActorId, accion: "PREPARACION", uuidOriginal: t.ID, state: "QUARANTINE" };
const markerKey = (r = recoveryRecord) => `e11-recovery:${r.actorId}:${r.accion}:${r.uuidOriginal}`;
function seedRecovery(r = recoveryRecord) { localStorage.setItem(markerKey(r), JSON.stringify(r)); }
function recoveryRecords(): E11Recovery[] { return Object.keys(localStorage).filter(k => k.startsWith("e11-recovery:")).map(k => JSON.parse(localStorage.getItem(k)!)); }
const retained = (r = recoveryRecord) => localStorage.getItem(markerKey(r)) !== null;
const resolverWrites = () => writes().filter(r => r.path.endsWith("/resolucion"));
const resolverStored = () => Object.keys(sessionStorage).filter(k => k.startsWith("e11-resolver:")).map(k => JSON.parse(sessionStorage.getItem(k)!));
function recoveryTransport() {
  t.reset(null); t.recoveryRoutes();
  // Finite valid adversaries for parameter mutations, never an unknown endpoint.
  t.respond(`/api/e11/operaciones/7/PREPARACION/${t.ID}`, { ...t.recoveryPending, actorId: 7 } satisfies api.E11OperacionRecuperacion);
  t.respond(`/api/e11/operaciones/9/PERFIL/${t.ID}`, { ...t.recoveryPending, accion: "PERFIL" } satisfies api.E11OperacionRecuperacion);
  t.respond(`/api/e11/operaciones/9/PREPARACION/${t.OTHER}`, { ...t.recoveryPending, uuidOriginal: t.OTHER } satisfies api.E11OperacionRecuperacion);
}
async function recovery(id: string, response: api.E11OperacionRecuperacion = t.recoveryPending) {
  recoveryTransport(); seedRecovery(); t.respond(t.recoveryPath, response);
  return mount(id, "/usuarios", null, <span>Recuperación documental</span>);
}
async function resolveRecovery() {
  await fill("Motivo de resolución ADMIN", "  Evidencia documental revisada  ");
  await click("Revisar y resolver cuarentena");
}
function pendingResolution() { t.respond(`${t.recoveryPath}/resolucion`, t.recoveryPending, "POST"); }
function lostResolution(code?: api.E11OutcomeError["code"]) {
  t.routes.set(`POST ${t.recoveryPath}/resolucion`, r => {
    if (code) throw t.outcomeError(code, (r.body as api.ResolveE11OperacionBody).uuid);
    throw new Error("Respuesta resolutora perdida después de posible commit");
  });
}
async function expectInvalidRecovery(id: string, value: api.E11OperacionRecuperacion) {
  await recovery(id, value); check(retained()); check(!text().includes("Servidor:"));
  check(text().includes("ajena a la terna original o inválida")); check(resolverWrites().length === 0);
}
function RecoveryGateProbe({ epoch = 0 }: { epoch?: number }) {
  const session = useE11Session();
  return session ? <E11RecoveryAdmin key={epoch} record={recoveryRecord} session={session} /> : null;
}
test("E11-RECOVERY-ORIGINAL-ACTOR", async () => {
  await recovery("E11-RECOVERY-ORIGINAL-ACTOR"); check(seen(t.recoveryPath)); check(!seen(`/api/e11/operaciones/7/PREPARACION/${t.ID}`));
  pendingResolution(); await resolveRecovery(); check(resolverWrites()[0]?.path === `${t.recoveryPath}/resolucion`);
});
test("E11-RECOVERY-ORIGINAL-ACTION", async () => {
  await recovery("E11-RECOVERY-ORIGINAL-ACTION"); check(seen(t.recoveryPath)); check(!seen(`/api/e11/operaciones/9/PERFIL/${t.ID}`));
  pendingResolution(); await resolveRecovery(); check(resolverWrites()[0]?.path === `${t.recoveryPath}/resolucion`);
});
test("E11-RECOVERY-ORIGINAL-UUID", async () => {
  await recovery("E11-RECOVERY-ORIGINAL-UUID"); check(seen(t.recoveryPath)); check(!seen(`/api/e11/operaciones/9/PREPARACION/${t.OTHER}`));
  pendingResolution(); await resolveRecovery(); check(resolverWrites()[0]?.path === `${t.recoveryPath}/resolucion`);
});
test("E11-RECOVERY-RELOAD", async () => {
  const view = await recovery("E11-RECOVERY-RELOAD"); view.unmount(); client.clear(); t.requests.length = 0;
  await mount("E11-RECOVERY-RELOAD", "/usuarios", null, <span>Reload</span>);
  check(seen(t.recoveryPath)); check(retained()); check(Boolean(screen.queryByTestId("e11-recovery-admin")));
  assert.deepEqual(recoveryRecords(), [recoveryRecord], activeId); check(sessionStorage.length === 0);
});
test("E11-RECOVERY-ADMIN-INDEPENDENT-GATES", async () => {
  recoveryTransport(); t.appSiblings(); seedRecovery();
  await app("E11-RECOVERY-ADMIN-INDEPENDENT-GATES", "/usuarios");
  check(Boolean(screen.queryByTestId("e11-recovery-admin"))); check(seen(t.recoveryPath)); check(text().includes("Contador destinatario"));
  t.respond(`${t.recoveryPath}/resolucion`, t.recoveryTombstone, "POST"); await resolveRecovery();
  check(!retained()); check(text().includes("CERRADA_SIN_EFECTO"));
});
test("E11-RECOVERY-CAPABILITY", async () => {
  recoveryTransport(); t.respond("/api/e11/identidad", { ...t.recoveryIdentity, capacidades: [] });
  await mount("E11-RECOVERY-CAPABILITY", "/usuarios", null, <RecoveryGateProbe />);
  check(!seen(t.recoveryPath)); check(!screen.queryByTestId("e11-recovery-admin"));
});
test("E11-RECOVERY-NONADMIN", async () => {
  recoveryTransport(); t.respond("/api/e11/identidad", t.identity("F"));
  await mount("E11-RECOVERY-NONADMIN", "/contabilidad/fiscal", "F", <RecoveryGateProbe />);
  check(!seen(t.recoveryPath)); check(!screen.queryByTestId("e11-recovery-admin"));
});
test("E11-RECOVERY-OFF", async () => {
  recoveryTransport();
  const view = await mount("E11-RECOVERY-OFF", "/usuarios", null, <RecoveryGateProbe />);
  seedRecovery(); t.gates(false); t.requests.length = 0;
  view.rerender(<QueryClientProvider client={client}><Router><E11SessionProvider user={t.user("ADMIN")}><RecoveryGateProbe epoch={1} /></E11SessionProvider></Router></QueryClientProvider>);
  await settle(); check(!seen(t.recoveryPath)); check(retained());
});
test("E11-RECOVERY-GET-PENDING", async () => {
  await recovery("E11-RECOVERY-GET-PENDING"); check(text().includes("Servidor: PENDIENTE")); check(retained()); check(writes().length === 0);
});
test("E11-RECOVERY-GET-COMMITTED-UNAUDITED", async () => {
  await recovery("E11-RECOVERY-GET-COMMITTED-UNAUDITED", t.recoveryCommitted);
  check(text().includes("aún no auditada")); check(retained()); check(Boolean(screen.queryByRole("button", { name: "Revisar y resolver cuarentena" })));
});
test("E11-RECOVERY-GET-CONFIRMED", async () => {
  await recovery("E11-RECOVERY-GET-CONFIRMED", t.recoveryConfirmed);
  check(!retained()); check(text().includes("CONFIRMADA") && text().includes(t.OTHER)); check(writes().length === 0);
});
test("E11-RECOVERY-GET-TOMBSTONE", async () => {
  await recovery("E11-RECOVERY-GET-TOMBSTONE", t.recoveryTombstone);
  check(!retained()); check(text().includes("CERRADA_SIN_EFECTO")); check(writes().length === 0);
});
test("E11-RECOVERY-GET-404", async () => {
  recoveryTransport(); seedRecovery();
  t.routes.set(`GET ${t.recoveryPath}`, () => { throw t.error("NO_ENCONTRADO", 404); });
  await mount("E11-RECOVERY-GET-404", "/usuarios", null, <span />);
  check(retained()); check(text().includes("No se libera por error ni 404")); check(writes().length === 0);
});
test("E11-RECOVERY-GET-ERROR", async () => {
  recoveryTransport(); seedRecovery();
  t.routes.set(`GET ${t.recoveryPath}`, () => { throw t.error("DEPENDENCIA_NO_DISPONIBLE", 503); });
  await mount("E11-RECOVERY-GET-ERROR", "/usuarios", null, <span />);
  check(retained()); check(text().includes("No se libera por error ni 404")); check(writes().length === 0);
});
test("E11-RECOVERY-RESPONSE-ACTOR", async () => {
  await expectInvalidRecovery("E11-RECOVERY-RESPONSE-ACTOR", { ...t.recoveryConfirmed, actorId: 7 });
});
test("E11-RECOVERY-RESPONSE-ACTION", async () => {
  await expectInvalidRecovery("E11-RECOVERY-RESPONSE-ACTION", { ...t.recoveryConfirmed, accion: "PERFIL" });
});
test("E11-RECOVERY-RESPONSE-UUID", async () => {
  await expectInvalidRecovery("E11-RECOVERY-RESPONSE-UUID", { ...t.recoveryConfirmed, uuidOriginal: t.OTHER });
});
test("E11-RECOVERY-RESPONSE-REVISION", async () => {
  await expectInvalidRecovery("E11-RECOVERY-RESPONSE-REVISION", { ...t.recoveryConfirmed, revision: "v1" });
});
test("E11-RECOVERY-RESPONSE-RESOLUTION-ID", async () => {
  await expectInvalidRecovery("E11-RECOVERY-RESPONSE-RESOLUTION-ID", { ...t.recoveryConfirmed, resolucionId: "-".repeat(36) });
});
test("E11-RECOVERY-RESPONSE-RESOLVED-AT", async () => {
  await expectInvalidRecovery("E11-RECOVERY-RESPONSE-RESOLVED-AT", { ...t.recoveryConfirmed, resueltoEn: "not-a-date" });
});
test("E11-RECOVERY-EXACT-RELEASE", async () => {
  await recovery("E11-RECOVERY-EXACT-RELEASE");
  const otherActor: E11Recovery = { ...recoveryRecord, actorId: 10 };
  const otherAction: E11Recovery = { ...recoveryRecord, accion: "PERFIL" };
  seedRecovery(otherActor); seedRecovery(otherAction);
  t.respond(`/api/e11/operaciones/10/PREPARACION/${t.ID}`, { ...t.recoveryPending, actorId: 10 } satisfies api.E11OperacionRecuperacion);
  t.respond(t.recoveryPath, t.recoveryConfirmed);
  await click("Consultar resultado original");
  check(!retained()); check(retained(otherActor) && retained(otherAction));
});
test("E11-RECOVERY-POST-BODY", async () => {
  await recovery("E11-RECOVERY-POST-BODY"); pendingResolution(); await resolveRecovery();
  const body = resolverWrites()[0]?.body as api.ResolveE11OperacionBody; check(body);
  assert.deepEqual(Object.keys(body).sort(), ["identidadVersion", "motivo", "revisionEsperada", "uuid"], activeId);
  check(body.motivo === "Evidencia documental revisada" && body.identidadVersion === t.recoveryIdentity.permisosVersion);
});
test("E11-RECOVERY-POST-UUID", async () => {
  await recovery("E11-RECOVERY-POST-UUID"); pendingResolution(); await resolveRecovery();
  const uuid = (resolverWrites()[0]?.body as api.ResolveE11OperacionBody)?.uuid;
  check(/^[a-f0-9-]{36}$/i.test(uuid) && uuid !== t.ID); check(resolverStored()[0]?.body.uuid === uuid);
});
test("E11-RECOVERY-POST-REASON", async () => {
  await recovery("E11-RECOVERY-POST-REASON"); await fill("Motivo de resolución ADMIN", "  ");
  check((screen.queryByRole("button", { name: "Revisar y resolver cuarentena" }) as HTMLButtonElement)?.disabled); check(writes().length === 0);
});
test("E11-RECOVERY-POST-FRESH-IDENTITY", async () => {
  await recovery("E11-RECOVERY-POST-FRESH-IDENTITY"); pendingResolution();
  t.respond("/api/e11/identidad", { ...t.recoveryIdentity, permisosVersion: "e".repeat(64), capacidades: [] });
  await resolveRecovery(); check(resolverWrites().length === 0); check(retained()); check(resolverStored().length === 0);
});
test("E11-RECOVERY-POST-FRESH-CAS", async () => {
  await recovery("E11-RECOVERY-POST-FRESH-CAS");
  t.respond(t.recoveryPath, { ...t.recoveryPending, revision: "e".repeat(64) }); pendingResolution();
  await resolveRecovery();
  check((resolverWrites()[0]?.body as api.ResolveE11OperacionBody)?.revisionEsperada === "e".repeat(64));
});
test("E11-RECOVERY-POST-DOUBLE", async () => {
  await recovery("E11-RECOVERY-POST-DOUBLE"); await fill("Motivo de resolución ADMIN", "Evidencia"); hold(`${t.recoveryPath}/resolucion`);
  const button = screen.queryByRole("button", { name: "Revisar y resolver cuarentena" }); check(button);
  await act(async () => { if (button) { fireEvent.click(button); fireEvent.click(button); } }); await settle();
  check(resolverWrites().length === 1);
});
test("E11-RECOVERY-POST-TERMINAL", async () => {
  await recovery("E11-RECOVERY-POST-TERMINAL"); t.respond(`${t.recoveryPath}/resolucion`, t.recoveryConfirmed, "POST");
  await resolveRecovery(); check(resolverWrites().length === 1); check(!retained()); check(resolverStored().length === 0); check(text().includes("CONFIRMADA"));
});
test("E11-RECOVERY-POST-PENDING", async () => {
  await recovery("E11-RECOVERY-POST-PENDING"); pendingResolution(); await resolveRecovery();
  check(retained()); check(resolverStored().length === 1); check(text().includes("Servidor: PENDIENTE"));
});
test("E11-RECOVERY-POST-UNCERTAIN", async () => {
  await recovery("E11-RECOVERY-POST-UNCERTAIN"); lostResolution(); await resolveRecovery();
  check(retained()); assert.deepEqual(resolverStored()[0]?.body, resolverWrites()[0]?.body, activeId);
  check(Boolean(screen.queryByRole("button", { name: "Reintentar resolución exacta" })));
});
test("E11-RECOVERY-POST-OUTCOME-ERRORS", async () => {
  await recovery("E11-RECOVERY-POST-OUTCOME-ERRORS"); lostResolution("RESULTADO_CONFIRMADO_NO_CONSULTABLE"); await resolveRecovery();
  const first = structuredClone(resolverWrites()[0]?.body);
  check(retained()); assert.deepEqual(resolverStored()[0]?.body, first, activeId);
  lostResolution("RESULTADO_INCIERTO"); await click("Reintentar resolución exacta");
  assert.deepEqual(resolverWrites()[1]?.body, first, activeId); assert.deepEqual(recoveryRecords(), [recoveryRecord], activeId);
});
test("E11-RECOVERY-POST-REPLAY-EXACT", async () => {
  await recovery("E11-RECOVERY-POST-REPLAY-EXACT"); lostResolution(); await resolveRecovery();
  const first = structuredClone(resolverWrites()[0]?.body);
  t.respond(`${t.recoveryPath}/resolucion`, t.recoveryTombstone, "POST"); await click("Reintentar resolución exacta");
  assert.deepEqual(resolverWrites()[1]?.body, first, activeId); check(!retained()); check(text().includes("CERRADA_SIN_EFECTO"));
});
test("E11-RECOVERY-POST-REPLAY-403", async () => {
  await recovery("E11-RECOVERY-POST-REPLAY-403"); lostResolution(); await resolveRecovery();
  const first = structuredClone(resolverWrites()[0]?.body);
  t.routes.set(`POST ${t.recoveryPath}/resolucion`, () => { throw t.error("PERMISO_DENEGADO", 403); });
  await click("Reintentar resolución exacta"); check(retained());
  assert.deepEqual(resolverWrites()[1]?.body, first, activeId); assert.deepEqual(resolverStored()[0]?.body, first, activeId);
});
test("E11-RECOVERY-POST-CAS-PENDING", async () => {
  await recovery("E11-RECOVERY-POST-CAS-PENDING");
  t.routes.set(`POST ${t.recoveryPath}/resolucion`, () => {
    t.respond(t.recoveryPath, { ...t.recoveryPending, revision: "e".repeat(64) }); throw t.error("REVISION_OBSOLETA");
  });
  await resolveRecovery(); check(retained()); check(resolverStored().length === 1);
  check(t.requests.filter(r => r.path === t.recoveryPath).length >= 3);
  check(text().includes("Servidor: PENDIENTE"));
});
test("E11-RECOVERY-POST-CAS-TERMINAL", async () => {
  await recovery("E11-RECOVERY-POST-CAS-TERMINAL");
  t.routes.set(`POST ${t.recoveryPath}/resolucion`, () => { t.respond(t.recoveryPath, t.recoveryConfirmed); throw t.error("REVISION_OBSOLETA"); });
  await resolveRecovery(); check(!retained()); check(resolverStored().length === 0); check(text().includes("CONFIRMADA"));
});
test("E11-RECOVERY-POST-TIMEOUT-GET-CONFIRMED", async () => {
  await recovery("E11-RECOVERY-POST-TIMEOUT-GET-CONFIRMED");
  t.routes.set(`POST ${t.recoveryPath}/resolucion`, () => { t.respond(t.recoveryPath, t.recoveryConfirmed); throw new Error("Postcommit delivery lost"); });
  await resolveRecovery(); check(!retained()); check(resolverWrites().length === 1); check(text().includes("CONFIRMADA"));
});
test("E11-RECOVERY-POST-TIMEOUT-GET-TOMBSTONE", async () => {
  await recovery("E11-RECOVERY-POST-TIMEOUT-GET-TOMBSTONE");
  t.routes.set(`POST ${t.recoveryPath}/resolucion`, () => { t.respond(t.recoveryPath, t.recoveryTombstone); throw new Error("Tombstone commit delivery lost"); });
  await resolveRecovery(); check(!retained()); check(resolverWrites().length === 1); check(text().includes("CERRADA_SIN_EFECTO"));
});
test("E11-RECOVERY-NO-RECURSIVE-QUARANTINE", async () => {
  await recovery("E11-RECOVERY-NO-RECURSIVE-QUARANTINE"); lostResolution("RESULTADO_INCIERTO"); await resolveRecovery();
  assert.deepEqual(recoveryRecords(), [recoveryRecord], activeId);
  check(!recoveryRecords().some(r => r.uuidOriginal === (resolverWrites()[0]?.body as api.ResolveE11OperacionBody)?.uuid));
});
test("E11-RECOVERY-ADMIN-SESSION-LOSS", async () => {
  await recovery("E11-RECOVERY-ADMIN-SESSION-LOSS"); lostResolution(); await resolveRecovery(); check(resolverStored().length === 1);
  t.respond("/api/e11/identidad", { ...t.recoveryIdentity, permisosVersion: "e".repeat(64), capacidades: [] });
  await act(async () => { await client.invalidateQueries({ predicate: q => q.queryKey[0] === "/api/e11/identidad" }); }); await settle();
  check(resolverStored().length === 0); assert.deepEqual(recoveryRecords(), [recoveryRecord], activeId);
  check(!text().includes("Evidencia documental revisada")); check(!screen.queryByTestId("e11-recovery-admin"));
});
test("E11-RECOVERY-SECOND-ADMIN", async () => {
  const first = await recovery("E11-RECOVERY-SECOND-ADMIN"); lostResolution(); await resolveRecovery();
  first.unmount(); client.clear(); t.requests.length = 0;
  t.respond("/api/e11/identidad", { ...t.recoveryIdentity, usuarioId: 8 });
  t.respond(t.recoveryPath, t.recoveryConfirmed);
  render(<QueryClientProvider client={client}><Router><E11SessionProvider user={{ ...t.user("ADMIN"), id: 8 }}><span>Segundo ADMIN</span></E11SessionProvider></Router></QueryClientProvider>);
  await settle(); check(seen(t.recoveryPath)); check(!retained()); check(resolverStored().length === 0); check(writes().length === 0);
});
test("E11-RECOVERY-LEGACY-MARKER-NO-GUESS", async () => {
  recoveryTransport(); const key = `e11-recovery:${t.ID}`;
  localStorage.setItem(key, JSON.stringify({ uuid: t.ID, action: "preparacion", state: "QUARANTINE" }));
  await mount("E11-RECOVERY-LEGACY-MARKER-NO-GUESS", "/usuarios", null, <span />);
  check(localStorage.getItem(key) !== null); check(text().includes("No se pudo leer el registro de recuperación"));
  check(!seen(t.recoveryPath)); check(writes().length === 0);
});
test("E11-RECOVERY-NO-BUSINESS-RESEND", async () => {
  await profileReview("E11-RECOVERY-NO-BUSINESS-RESEND");
  t.routes.set("PUT /api/e11/usuarios/9/perfil", () => { throw new Error("Unknown original commit"); });
  await click("Confirmar asignación ADMIN");
  const uuid = (writes()[0]?.body as api.E11PerfilInput).uuid;
  const path = `/api/e11/operaciones/7/PERFIL/${uuid}`;
  t.respond("/api/e11/identidad", { ...t.recoveryIdentity, usuarioId: 8 });
  t.respond(path, { ...t.recoveryPending, actorId: 7, accion: "PERFIL", uuidOriginal: uuid } satisfies api.E11OperacionRecuperacion);
  t.respond(`${path}/resolucion`, { ...t.recoveryConfirmed, actorId: 7, accion: "PERFIL", uuidOriginal: uuid } satisfies api.E11OperacionRecuperacion, "POST");
  // A second live, authorized session resolves through the real UI/API. Its
  // productive terminal event must settle the still-mounted original form.
  const secondClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false } } });
  const secondView = render(<QueryClientProvider client={secondClient}><Router><E11SessionProvider user={{ ...t.user("ADMIN"), id: 8 }}><span>ADMIN resolutor</span></E11SessionProvider></Router></QueryClientProvider>);
  await settle(); await resolveRecovery();
  check(!screen.queryByRole("button", { name: "Reintentar exactamente la intención incierta" }));
  const confirm = screen.queryByRole("button", { name: "Confirmar asignación ADMIN" });
  check(!confirm || confirm.closest("fieldset")?.disabled);
  check(writes().filter(r => r.path === "/api/e11/usuarios/9/perfil").length === 1); check(resolverWrites().length === 1);
  secondView.unmount(); secondClient.clear();
});