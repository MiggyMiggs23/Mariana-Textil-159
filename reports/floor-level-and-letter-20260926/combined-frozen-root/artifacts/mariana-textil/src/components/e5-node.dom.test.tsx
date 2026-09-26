import assert from "node:assert/strict";
import { test, beforeEach, afterEach } from "node:test";
import React from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Router, Route } from "wouter";
import { E5Entry, E5DetallePage, E5PendientesPage } from "./e5-pendientes";
import E5DocumentoPage from "../pages/e5-documento";
import App from "../App";
import Cobros from "../pages/cobros";
import ClienteDetail from "../pages/cliente-detail";
import * as f from "./e5-node-test-fixtures";
import { state, resetHarness, visits, mutationCalls, succeed, fail, setGate, transportVisits } from "./e5-node-test-harness";

// Prepared source-derived native suite. MAIN alone executes guarded snapshots.
// Browser geometry is deterministic infrastructure, not a claim of physical PDF.
let client: QueryClient;
let restoreMetrics: () => void;
let prints = 0;
beforeEach(() => {
  resetHarness();
  Object.defineProperty(globalThis, "sessionStorage", { configurable: true, value: window.sessionStorage });
  sessionStorage.clear();
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false } } });
  window.history.replaceState(null, "", "/");
  prints = 0;
  Object.defineProperty(document, "fonts", { configurable: true, value: { ready: Promise.resolve() } });
  const rect = HTMLElement.prototype.getBoundingClientRect;
  HTMLElement.prototype.getBoundingClientRect = function () {
    const height = this.classList.contains("e5-doc-inner") ? 500
      : this.classList.contains("e5-doc-heading") ? 100
      : this.classList.contains("e5-doc-footer") ? 80 : this.tagName === "THEAD" ? 20 : 30;
    return { x: 0, y: 0, top: 0, left: 0, right: 600, bottom: height, width: 600, height, toJSON: () => ({}) };
  };
  restoreMetrics = () => { HTMLElement.prototype.getBoundingClientRect = rect; };
  window.print = () => { prints += 1; };
});
afterEach(() => { cleanup(); client.clear(); sessionStorage.clear(); restoreMetrics(); });
const mount = (node: React.ReactNode) => render(<QueryClientProvider client={client}><Router>{node}</Router></QueryClientProvider>);
const click = async (element: HTMLElement) => { await act(async () => { fireEvent.click(element); }); };
const change = (label: string | RegExp, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
const button = (name: string) => screen.getByRole("button", { name });
const last = (name: string) => mutationCalls(name).at(-1)!;
async function reception(entrada: "CAJA" | "CLIENTE" = "CAJA") {
  mount(<E5Entry clienteId={f.CLIENT} entrada={entrada} />);
  await click(button("Recibir dirigido"));
  for (const box of screen.getAllByRole("checkbox").slice(0, 2)) await click(box);
  if (screen.queryByLabelText("Importe recibido")) change("Importe recibido", f.TOTAL);
  change(/Sesión física/, String(f.CURRENT_SESSION));
  change("Motivo / evidencia obligatoria", "  Evidencia de recepción  ");
}
function detail() {
  window.history.replaceState(null, "", `/cobros/pendientes/${f.RECEIPT}`);
  mount(<Route path="/cobros/pendientes/:id"><E5DetallePage /></Route>);
}
async function proposal(mode = "preparar") {
  detail();
  change("Acción", mode);
  change("Motivo / evidencia obligatoria", "Evidencia explícita");
}
async function review() {
  await click(button("Revisar recepción"));
  await act(async () => { succeed(last("usePreviewE5Cobro"), f.preview()); });
}
const intentKeys = () => Object.keys(sessionStorage).filter(key => key.startsWith("e5-intencion:"));
const stored = () => JSON.parse(sessionStorage.getItem(intentKeys()[0])!);
const retry = () => click(screen.getByRole("button", { name: /Reintentar misma operación/ }));
const settle = async (name: string, data: unknown) => { await act(async () => { succeed(last(name), data); }); };
const reject = async (name: string, code: Parameters<typeof fail>[1] = "E5_VERSION_STALE", uncertain = false) =>
  act(async () => { fail(last(name), code, uncertain); });
async function sending() { await reception(); await review(); await click(button("Confirmar dinero recibido")); }
async function uncertainReceipt() { await sending(); await reject("useCreateE5Cobro", "E5_VERSION_STALE", true); }
function appAt(path: string) {
  // The real App mounts Sonner, whose system-theme subscription requires this
  // browser API absent from JSDOM. Stable light theme; actual event semantics.
  // Keep this App-only so previously completed non-App cases are unaffected.
  window.matchMedia = query => {
    if (query !== "(prefers-color-scheme: dark)") throw Error(`E5_UNCONFIGURED_MEDIA_QUERY ${query}`);
    const events = new window.EventTarget();
    return Object.assign(events, {
      matches: false, media: query, onchange: null,
      addListener: (listener: Parameters<MediaQueryList["addListener"]>[0]) => {
        if (listener) events.addEventListener("change", listener as EventListener);
      },
      removeListener: (listener: Parameters<MediaQueryList["removeListener"]>[0]) => {
        if (listener) events.removeEventListener("change", listener as EventListener);
      },
    });
  };
  window.history.replaceState(null, "", path);
  return render(<App />);
}
async function documentPage(documentId = f.RECEIPT_DOCUMENT) {
  window.history.replaceState(null, "", `/cobros/pendientes/${f.RECEIPT}/documentos/${documentId}`);
  await act(async () => { mount(<Route path="/cobros/pendientes/:id/documentos/:documentoId"><E5DocumentoPage /></Route>); });
}
async function printRequest() {
  change("Motivo de impresión / reimpresión", "Copia solicitada");
  await click(button("Solicitar impresión / reimpresión"));
  // Exercise the real waitForPrintableAssets/nextPaint; no print helper alias.
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 80)); });
}
function futureA() {
  state.user = f.currentUser("CONTADOR", 10, false);
  for (const row of [state.availability, state.context, state.detail])
    row.capacidades = f.capabilities("CONTADOR", { puedePreparar: true, preparacionADisponible: true });
}

test("E5-RECEPTION-DOCUMENT-UNIQUE", async t => {
  state.context = f.context("ADMIN", false, true);
  await reception();
  assert.equal(screen.getAllByRole("checkbox").length, 3, t.name);
  await click(button("Revisar recepción"));
  assert.deepEqual(last("usePreviewE5Cobro").variables.data.notasIndicadas, [101, 102], t.name);
});
test("E5-RECEPTION-CASH-SESSION", async t => {
  await reception(); await click(button("Revisar recepción"));
  const data = last("usePreviewE5Cobro").variables.data;
  assert.equal(data.sesionCajaId, f.CURRENT_SESSION, t.name);
  assert.equal(data.cuentaDestino, "CAJA_FISICA", t.name);
});
test("E5-RECEPTION-TRANSFER-NO-PHYSICAL", async t => {
  await reception();
  change("Medio", "TRANSFERENCIA"); change("Cuenta receptora", "CUENTA_FISCAL");
  change(/Sesión operativa/, String(f.CURRENT_SESSION));
  await click(button("Revisar recepción"));
  const data = last("usePreviewE5Cobro").variables.data;
  assert.equal(Object.hasOwn(data, "sesionCajaId"), false, t.name);
});
test("E5-RECEPTION-TRANSFER-OPERATIVE", async t => {
  await reception();
  change("Medio", "TRANSFERENCIA"); change("Cuenta receptora", "CUENTA_NO_FISCAL");
  change(/Sesión operativa/, String(f.CURRENT_SESSION));
  await click(button("Revisar recepción"));
  assert.equal(last("usePreviewE5Cobro").variables.data.sesionOperativaId, f.CURRENT_SESSION, t.name);
});
test("E5-RECEPTION-EVIDENCE-REQUIRED", async t => {
  await reception(); change("Motivo / evidencia obligatoria", "  ");
  await click(button("Revisar recepción"));
  assert.equal(mutationCalls("usePreviewE5Cobro").length, 0, t.name);
});
test("E5-RECEPTION-PREVIEW-VERSION", async t => {
  await reception(); await click(button("Revisar recepción"));
  await act(async () => { succeed(last("usePreviewE5Cobro"), { ...f.preview(), versionContexto: "changed" }); });
  assert.equal(Boolean(screen.queryByRole("button", { name: "Confirmar dinero recibido" })), false, t.name);
});
test("E5-RECEPTION-PREVIEW-LOCK", async t => {
  await reception();
  const target = button("Revisar recepción");
  await act(async () => { target.click(); target.click(); });
  assert.equal(mutationCalls("usePreviewE5Cobro").length, 1, t.name);
});
test("E5-RECEPTION-ATOMIC-EXACT-MOVEMENT", async t => {
  state.context = f.context("ADMIN", false, true);
  await reception();
  await click(screen.getByLabelText("ADMIN: autorizar aplicación al recibir (atómica)"));
  change("Importe nota N-101 cargo 903", "25");
  await click(button("Revisar recepción"));
  assert.deepEqual(last("usePreviewE5Cobro").variables.data.aplicarAhora,
    [{ notaId: 101, movimientoVentaId: 903, importe: "25.00" }], t.name);
});
test("E5-PROPOSAL-FAVOR-EXPLICIT", async t => {
  state.detail = f.favorReceipt();
  await proposal();
  change(/Favor explícito a proponer/, "20");
  await click(button("Revisar preparar")); await click(button("Confirmar preparar"));
  const data = last("useCreateE5Propuesta").variables.data;
  assert.equal(data.importeFavorPropuesto, "20.00", t.name);
  assert.deepEqual(data.asignaciones, [], t.name);
});
test("E5-AUTHORIZE-FAVOR-CEILING", async t => {
  state.detail = f.favorReceipt();
  await proposal("autorizar");
  change(/Favor explícito a autorizar/, "40.01");
  await click(button("Revisar autorizar"));
  assert.equal(Boolean(screen.queryByRole("button", { name: "Confirmar autorizar" })), false, t.name);
});
test("E5-AUTHORIZE-MOVEMENT-CEILING", async t => {
  state.detail = f.receipt({ stage: "proposed" });
  state.detail.propuestas[0].asignaciones[0].importe = "40.10";
  await proposal("autorizar"); change("Importe nota N-101 cargo 901", "40.11");
  await click(button("Revisar autorizar"));
  assert.equal(Boolean(screen.queryByRole("button", { name: "Confirmar autorizar" })), false, t.name);
});
test("E5-AUTHORIZE-STALE-PROPOSAL", t => {
  state.detail = f.receipt({ stage: "proposed" });
  state.context.notas[0].saldoPendiente = "1.00";
  detail();
  assert.equal((screen.getByRole("option", { name: "ADMIN: autorizar parte o total" }) as HTMLOptionElement).disabled, true, t.name);
});
test("E5-REFUND-APPLIED-RESIDUAL", t => {
  state.detail = f.receipt({ stage: "partial" });
  state.detail.capacidades.puedeDevolver = true;
  detail();
  assert.equal((screen.getByRole("option", { name: "ADMIN: devolver total nunca aplicado" }) as HTMLOptionElement).disabled, true, t.name);
});
test("E5-REFUND-EXPLICIT-REQUEST", async t => {
  await proposal("devolver");
  change("Fuente actual", JSON.stringify(state.refundOptions.fuentes[0]));
  await click(button("Revisar devolver"));
  assert.equal(Boolean(screen.queryByRole("button", { name: "Confirmar devolver" })), false, t.name);
});
test("E5-REFUND-ORIGINAL-TOTAL", async t => {
  state.refundOptions.importe = "1.00";
  await proposal("devolver");
  change("Fuente actual", JSON.stringify(state.refundOptions.fuentes[0]));
  change("Petición expresa del cliente", "Restituir íntegro");
  await click(button("Revisar devolver"));
  assert.equal(Boolean(screen.queryByRole("button", { name: "Confirmar devolver" })), false, t.name);
});
test("E5-REJECT-NO-REFUND", async t => {
  state.detail = f.receipt({ stage: "proposed" });
  await proposal("rechazar");
  await click(button("Revisar rechazar")); await click(button("Confirmar rechazar"));
  assert.equal(mutationCalls("useRejectE5Propuesta").length, 1, t.name);
  assert.equal(mutationCalls("useReturnE5Cobro").length, 0, t.name);
});
test("E5-RECEPTION-CONTEXT-OPAQUE", async t => {
  await reception(); await click(button("Revisar recepción"));
  assert.equal(mutationCalls("usePreviewE5Cobro").length, 1, t.name);
  assert.equal(last("usePreviewE5Cobro").variables.data.versionContexto, f.CONTEXT_VERSION, t.name);
});
test("E5-RECEPTION-PREVIEW-NONMONETARY", async t => {
  await reception(); await review();
  assert.equal(mutationCalls("useCreateE5Cobro").length, 0, t.name);
  assert.equal(visits.some(v => v.name === "useGetE5Contexto" && v.refetch), true, t.name);
  await click(button("Confirmar dinero recibido"));
  assert.equal(mutationCalls("useCreateE5Cobro").length, 1, t.name);
});
test("E5-OFF-ENTRY", t => {
  setGate(false); mount(<E5Entry clienteId={f.CLIENT} entrada="CAJA" />);
  assert.equal(visits.length, 0, t.name);
});
test("E5-OFF-ROUTE-LIST", t => {
  setGate(false); appAt("/cobros/pendientes");
  assert.equal(Boolean(screen.queryByText("404")), true, t.name);
});
test("E5-OFF-ROUTE-DETAIL", t => {
  setGate(false); appAt(`/cobros/pendientes/${f.RECEIPT}`);
  assert.equal(Boolean(screen.queryByText("404")), true, t.name);
});
test("E5-OFF-ROUTE-DOCUMENT", t => {
  setGate(false); appAt(`/cobros/pendientes/${f.RECEIPT}/documentos/${f.RECEIPT_DOCUMENT}`);
  assert.equal(Boolean(screen.queryByText("404")), true, t.name);
});
test("E5-ROUTE-LIST", t => {
  appAt("/cobros/pendientes");
  assert.equal(Boolean(screen.queryByRole("heading", { name: "Cobros pendientes de aplicación" })), true, t.name);
});
test("E5-ROUTE-DETAIL", t => {
  appAt(`/cobros/pendientes/${f.RECEIPT}`);
  assert.equal(visits.some(v => v.name === "useGetE5Cobro" && v.args[0] === f.RECEIPT), true, t.name);
});
test("E5-ROUTE-DOCUMENT", async t => {
  await act(async () => { appAt(`/cobros/pendientes/${f.RECEIPT}/documentos/${f.RECEIPT_DOCUMENT}`); });
  assert.equal(visits.some(v => v.name === "useGetE5Documento" && v.args[1] === f.RECEIPT_DOCUMENT), true, t.name);
});
test("E5-ROUTE-PERMISSION", t => {
  state.user = f.currentUser("CAJA", 10, false); appAt("/cobros/pendientes");
  assert.equal(Boolean(screen.queryByText(/No tienes permisos para ver este módulo/)), true, t.name);
  assert.equal(visits.some(v => v.name === "useGetE5Disponibilidad"), false, t.name);
});
test("E5-PARENT-CAJA", async t => {
  window.history.replaceState(null, "", `/cobros?tab=cartera&ticketId=${f.NOTE}`);
  mount(<Cobros />);
  assert.equal(Boolean(screen.queryByRole("button", { name: "Recibir dirigido" })), true, t.name);
  await click(button("Recibir dirigido"));
  assert.equal(visits.some(v => v.name === "useGetE5Contexto" && v.args[0].clienteId === f.CLIENT), true, t.name);
  assert.equal(Boolean(screen.queryByText(/dependencia E3 cerrada/)), false, t.name);
});
test("E5-PARENT-CLIENT", async t => {
  // Only this real parent mounts these historical-credit siblings. Keep their
  // explicit transport fixtures local; do not expand any completed case's hooks.
  const { installQuery, installMutation } = await import("./e5-node-test-harness");
  const creditEvidence = { clienteId: f.CLIENT, atribucionHabilitada: false, movimientos: [] } satisfies
    import("@workspace/api-client-react").CreditEvidence;
  const directedHistory = { solicitudes: [] } satisfies
    import("@workspace/api-client-react").SolicitudesPagoDirigidoResult;
  installQuery("useGetClienteEvidenciaCredito", () => creditEvidence);
  installQuery("useListSolicitudesPagoDirigido", () => directedHistory);
  installMutation("useAtribuirClienteCredito", false);
  // Identity documents belong to the inactive Datos tab, not this Estado entry.
  installQuery("useListClienteDocumentos", () => [], true);
  window.history.replaceState(null, "", `/clientes/${f.CLIENT}?tab=estado`);
  await act(async () => { mount(<ClienteDetail />); });
  assert.equal(Boolean(screen.queryByRole("button", { name: "Recibir dirigido" })), true, t.name);
  await click(button("Recibir dirigido"));
  assert.equal(Boolean(screen.queryByText(/Entrada CLIENTE/)), true, t.name);
  assert.equal(visits.some(v => v.name === "useGetClienteEvidenciaCredito" && v.enabled && v.args[0] === f.CLIENT), true, t.name);
  assert.equal(visits.some(v => v.name === "useListSolicitudesPagoDirigido" && v.enabled &&
    v.args[0].tipo === "CLIENTE" && v.args[0].entidadId === f.CLIENT), true, t.name);
  assert.equal(visits.some(v => ["useListClienteDocumentos", "useGetCajaAbonoE3Context", "useGetCreditRefundOptions"]
    .includes(v.name) && v.enabled), false, t.name);
  assert.equal(mutationCalls("useAtribuirClienteCredito").length, 0, t.name);
});
test("E5-SELECTOR-DEPENDENCY", async t => {
  mount(<E5Entry entrada="CAJA" />); await click(button("Recibir dirigido"));
  assert.equal(Boolean(screen.queryByRole("alert", { name: "" })), true, t.name);
  assert.equal(screen.getByRole("alert").textContent?.includes("dependencia E3 cerrada"), true, t.name);
});
test("E5-READ-PERMISSION", t => {
  state.user = f.currentUser("CAJA", 10, false);
  mount(<E5Entry clienteId={f.CLIENT} entrada="CAJA" />);
  assert.equal(visits.some(v => v.name === "useGetE5Disponibilidad"), false, t.name);
});
test("E5-RECEIVE-PERMISSION", t => {
  state.user = f.currentUser("CAJA");
  for (const p of state.user.permisos) p.puedeCrear = false;
  mount(<E5Entry clienteId={f.CLIENT} entrada="CAJA" />);
  assert.equal(Boolean(screen.queryByRole("button", { name: "Recibir dirigido" })), false, t.name);
});
test("E5-RECEIVE-ROLE", t => {
  futureA(); state.availability.capacidades.puedeRecibir = true;
  state.user = f.currentUser("CONTADOR");
  mount(<E5Entry clienteId={f.CLIENT} entrada="CAJA" />);
  assert.equal(Boolean(screen.queryByRole("button", { name: "Recibir dirigido" })), false, t.name);
});
test("E5-FUTURE-A-PREPARE-WITHOUT-RECEIVE-PERMISSION", t => {
  futureA(); detail();
  assert.equal(Boolean(screen.queryByRole("button", { name: "Revisar preparar" })), true, t.name);
  assert.equal((button("Revisar preparar") as HTMLButtonElement).disabled, false, t.name);
  assert.equal(Boolean(screen.queryByLabelText(/Favor explícito a proponer/)), false, t.name);
});
test("E5-LEGACY-CONTADOR-NOT-A", t => {
  state.user = f.currentUser("CONTADOR");
  state.availability.capacidades = f.capabilities("CONTADOR", { puedePreparar: true });
  detail();
  assert.equal(Boolean(screen.queryByRole("button", { name: "Revisar preparar" })), false, t.name);
});
test("E5-SERVER-CLOSED", t => {
  state.availability.enabled = false; mount(<E5Entry clienteId={f.CLIENT} entrada="CAJA" />);
  assert.equal(Boolean(screen.queryByRole("button", { name: "Recibir dirigido" })), false, t.name);
});
test("E5-CONTEXT-IDENTITY", async t => {
  state.context.clienteId = 999;
  mount(<E5Entry clienteId={f.CLIENT} entrada="CAJA" />); await click(button("Recibir dirigido"));
  assert.equal(Boolean(screen.queryByRole("button", { name: "Revisar recepción" })), false, t.name);
});
test("E5-DETAIL-IDENTITY", t => {
  state.detail.id = f.PROPOSAL; detail();
  assert.equal(Boolean(screen.queryByRole("button", { name: "Revisar preparar" })), false, t.name);
});
test("E5-SEND-LOCK", async t => {
  await reception(); await review();
  const target = button("Confirmar dinero recibido");
  await act(async () => { target.click(); target.click(); });
  assert.equal(mutationCalls("useCreateE5Cobro").length, 1, t.name);
});
test("E5-PERSIST-BEFORE-SEND", async t => {
  await sending();
  assert.equal(intentKeys().length, 1, t.name);
  assert.deepEqual(stored().data, last("useCreateE5Cobro").variables.data, t.name);
});
test("E5-UNCERTAIN-RETRY-EXACT", async t => {
  await uncertainReceipt();
  const first = f.wire(last("useCreateE5Cobro").variables);
  await retry();
  assert.equal(mutationCalls("useCreateE5Cobro").length, 2, t.name);
  assert.deepEqual(last("useCreateE5Cobro").variables, first, t.name);
});
test("E5-RECOVERY-REMOUNT", async t => {
  await uncertainReceipt(); const first = f.wire(last("useCreateE5Cobro").variables);
  cleanup(); mount(<E5Entry clienteId={f.CLIENT} entrada="CAJA" />); await click(button("Recibir dirigido"));
  assert.equal(Boolean(screen.queryByRole("button", { name: /Reintentar misma operación/ })), true, t.name);
  await retry();
  assert.deepEqual(last("useCreateE5Cobro").variables, first, t.name);
  assert.equal(mutationCalls("useCreateE5Cobro").length, 2, t.name);
});
test("E5-RECOVERY-COMMAND-SCOPE", async t => {
  await uncertainReceipt();
  const key = intentKeys()[0], saved = stored(); saved.data.clienteId = 999;
  sessionStorage.setItem(key, JSON.stringify(saved)); cleanup();
  mount(<E5Entry clienteId={f.CLIENT} entrada="CAJA" />); await click(button("Recibir dirigido"));
  assert.equal(Boolean(screen.queryByRole("button", { name: /Reintentar misma operación/ })), false, t.name);
});
test("E5-RETRY-EXACT-ROLE", async t => {
  state.user = f.currentUser("CAJA");
  await uncertainReceipt();
  state.user.rol = "TERMINAL";
  await retry();
  assert.equal(mutationCalls("useCreateE5Cobro").length, 1, t.name);
  assert.equal(intentKeys().length, 1, t.name);
});
test("E5-RETRY-AVAILABILITY", async t => {
  await uncertainReceipt(); state.availability.enabled = false; await retry();
  assert.equal(mutationCalls("useCreateE5Cobro").length, 1, t.name);
});
test("E5-RETRY-CONTEXT", async t => {
  await uncertainReceipt(); state.context.versionContexto = "changed"; await retry();
  assert.equal(mutationCalls("useCreateE5Cobro").length, 1, t.name);
});
test("E5-RETRY-PERMISSION-CONTEXT", async t => {
  await uncertainReceipt();
  state.user.permisos.find((p: any) => p.modulo === "caja_abonos").puedeCrear = false;
  await retry();
  assert.equal(mutationCalls("useCreateE5Cobro").length, 1, t.name);
});
test("E5-RETRY-CAPABILITY", async t => {
  await uncertainReceipt(); state.context.capacidades.puedeRecibir = false; await retry();
  assert.equal(mutationCalls("useCreateE5Cobro").length, 1, t.name);
});
test("E5-RESPONSE-IDENTITY", async t => {
  await sending();
  await settle("useCreateE5Cobro", { ...f.createResponse(), clienteId: 999 });
  assert.equal(intentKeys().length, 1, t.name);
  assert.equal(Boolean(screen.queryByText(/Operación confirmada ·/)), false, t.name);
});
test("E5-RESPONSE-AMOUNT-METHOD-SESSION", async t => {
  await sending();
  await settle("useCreateE5Cobro", { ...f.createResponse(), sesionCajaId: f.ORIGINAL_SESSION });
  assert.equal(intentKeys().length, 1, t.name);
});
test("E5-RESPONSE-DOCUMENTS", async t => {
  await sending();
  await settle("useCreateE5Cobro", { ...f.createResponse(), notasIndicadas: [f.notes()[0]] });
  assert.equal(intentKeys().length, 1, t.name);
});
test("E5-RESPONSE-EXACT-APPLICATION", async t => {
  await reception();
  await click(screen.getByLabelText("ADMIN: autorizar aplicación al recibir (atómica)"));
  change("Importe nota N-101 cargo 901", f.PARTIAL);
  await review(); await click(button("Confirmar dinero recibido"));
  const response = f.createResponse(true); response.aplicaciones[0].asignaciones[0].movimientoVentaId = 902;
  await settle("useCreateE5Cobro", response);
  assert.equal(intentKeys().length, 1, t.name);
});
test("E5-DEFINITIVE-ERROR", async t => {
  await sending(); await reject("useCreateE5Cobro", "E5_NOTA_STALE");
  assert.equal(intentKeys().length, 0, t.name);
  assert.equal(Boolean(screen.queryByText(/E5_NOTA_STALE: Conflicto/)), true, t.name);
});
test("E5-IDEMPOTENCY-CONFLICT-UNCERTAIN", async t => {
  await sending(); await reject("useCreateE5Cobro", "E5_IDEMPOTENCY_CONFLICT");
  assert.equal(intentKeys().length, 1, t.name);
});
test("E5-INVALIDATIONS", async t => {
  const keys = ["/api/e5/cobros", "/api/clientes/7/credito", "/api/clientes/7/estado-cuenta",
    "/api/clientes/7/pagos", "/api/tickets/101", "/api/caja", "/api/sesiones-caja",
    "/api/notificaciones", "/api/fondo", "/api/cobros"];
  for (const key of keys) client.setQueryData([key], { money: "backend" });
  client.setQueryData(["/api/productos"], []);
  await sending(); await settle("useCreateE5Cobro", f.createResponse());
  assert.deepEqual(keys.map(key => client.getQueryState([key])?.isInvalidated), keys.map(() => true), t.name);
  assert.equal(client.getQueryState(["/api/productos"])?.isInvalidated, false, t.name);
});
test("E5-REFRESH-FAILURE-NO-SECOND-SEND", async t => {
  client.invalidateQueries = async () => { throw new Error("Refresh unavailable"); };
  await sending(); await settle("useCreateE5Cobro", f.createResponse());
  assert.equal(Boolean(screen.queryByText(/Operación confirmada; no se pudo actualizar/)), true, t.name);
  assert.equal(intentKeys().length, 0, t.name);
  assert.equal(Boolean(screen.queryByRole("button", { name: /Reintentar misma operación/ })), false, t.name);
  assert.equal(mutationCalls("useCreateE5Cobro").length, 1, t.name);
});
test("E5-LIST-FILTER-CURSOR", async t => {
  state.receipts.nextCursor = "opaque-next";
  mount(<E5Entry clienteId={f.CLIENT} entrada="CLIENTE" />);
  await click(button("Siguiente"));
  change("Estado", "PARCIAL");
  const v = visits.filter(v => v.name === "useListE5Cobros").at(-1)!;
  assert.deepEqual(v.args[0], { ubicacionId: f.SITE, clienteId: f.CLIENT, estado: "PARCIAL", cursor: undefined, limit: 20 }, t.name);
});
test("E5-ADMIN-ALERT-SERVER-AGE", t => {
  state.alerts = f.page([f.receipt({ age: 9 })]);
  mount(<E5PendientesPage />);
  assert.equal(document.querySelector("aside a")?.textContent?.includes("9 días"), true, t.name);
  assert.equal(visits.some(v => v.name === "useListE5Avisos" && v.enabled), true, t.name);
});
test("E5-DOCUMENT-ADMIN", async t => {
  state.user = f.currentUser("CAJA");
  await documentPage();
  assert.equal(visits.some(v => v.name === "useGetE5Documento"), false, t.name);
});
test("E5-DOCUMENT-MEMBERSHIP", async t => {
  state.detail.reciboId = f.APPLICATION_DOCUMENT; await documentPage();
  assert.equal(visits.some(v => v.name === "useGetE5Documento"), false, t.name);
});
test("E5-DOCUMENT-SNAPSHOT", async t => {
  state.detail.importePendiente = "1.00"; await documentPage();
  const pages = document.querySelector("#e5-document-pages")!;
  assert.match(pages.textContent ?? "", /Pendiente al emitir:\s*\$?\s*150\.30/, t.name);
  assert.equal(pages.querySelectorAll(".e5-doc-sheet").length, 2, t.name);
});
test("E5-DOCUMENT-FONTS-READY", async t => {
  let resolve!: () => void;
  Object.defineProperty(document, "fonts", { configurable: true, value: { ready: new Promise<void>(r => { resolve = r; }) } });
  await documentPage();
  assert.equal(document.querySelectorAll("#e5-document-pages .e5-doc-sheet").length, 0, t.name);
  await act(async () => { resolve(); });
  assert.equal(document.querySelectorAll("#e5-document-pages .e5-doc-sheet").length, 2, t.name);
});
test("E5-DOCUMENT-INCOMPLETE-BLOCKED", async t => {
  state.document.asignaciones = f.partialAllocations(); state.document.notas = [];
  await documentPage();
  assert.equal(document.querySelectorAll("#e5-document-pages .e5-doc-sheet").length, 0, t.name);
});
test("E5-DOCUMENT-OVERFLOW-BLOCKED", async t => {
  const original = HTMLElement.prototype.getBoundingClientRect;
  HTMLElement.prototype.getBoundingClientRect = function () {
    const rect = original.call(this); return this.tagName === "TR" ? { ...rect, height: 800 } : rect;
  };
  await documentPage();
  assert.equal(document.querySelectorAll("#e5-document-pages .e5-doc-sheet").length, 0, t.name);
});
test("E5-PRINT-AUDIT-BEFORE-PRINT", async t => {
  await documentPage(); await printRequest();
  assert.equal(mutationCalls("useRecordE5Impresion").length, 1, t.name);
  assert.equal(prints, 0, t.name);
  await settle("useRecordE5Impresion", f.printResponse());
  assert.equal(prints, 1, t.name);
  assert.equal(mutationCalls("useCreateE5Cobro").length, 0, t.name);
});
test("E5-PRINT-UNCERTAIN-UUID", async t => {
  await documentPage(); await printRequest();
  const first = f.wire(last("useRecordE5Impresion").variables);
  await reject("useRecordE5Impresion", "E5_VERSION_STALE", true);
  await click(button("Reintentar solicitud auditada"));
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 80)); });
  assert.equal(mutationCalls("useRecordE5Impresion").length, 2, t.name);
  assert.deepEqual(last("useRecordE5Impresion").variables, first, t.name);
});
test("E5-AUTHORIZE-SUBSET-SEND", async t => {
  state.detail = f.receipt({ stage: "proposed" });
  await proposal("autorizar"); change("Importe nota N-101 cargo 901", f.PARTIAL);
  await click(button("Revisar autorizar")); await click(button("Confirmar autorizar"));
  assert.equal(mutationCalls("useAuthorizeE5Aplicacion").length, 1, t.name);
  const data = last("useAuthorizeE5Aplicacion").variables.data;
  assert.deepEqual(data.asignaciones, f.partialAllocations(), t.name);
  assert.equal(data.propuestaId, f.PROPOSAL, t.name);
  assert.equal(data.revisionEsperada, 2, t.name);
  assert.equal(mutationCalls("useCreateE5Cobro").length, 0, t.name);
});
test("E5-REFUND-VERIFIED-SOURCE-SEND", async t => {
  for (const fuente of f.refundOptions().fuentes) {
    cleanup(); resetHarness(); sessionStorage.clear();
    await proposal("devolver");
    change("Fuente actual", JSON.stringify(fuente));
    change("Petición expresa del cliente", "Restitución íntegra solicitada");
    await click(button("Revisar devolver")); await click(button("Confirmar devolver"));
    assert.equal(mutationCalls("useReturnE5Cobro").length, 1, t.name);
    const data = last("useReturnE5Cobro").variables.data;
    assert.equal(Object.hasOwn(data, "importe"), false, t.name);
    assert.deepEqual(data.fuente, fuente, t.name);
    assert.equal(transportVisits.some(v => v.name === "getE5DevolucionOpciones"), true, t.name);
  }
});
test("E5-RETRY-REFUND-SOURCE", async t => {
  await proposal("devolver"); change("Fuente actual", JSON.stringify(state.refundOptions.fuentes[0]));
  change("Petición expresa del cliente", "Restitución íntegra solicitada");
  await click(button("Revisar devolver")); await click(button("Confirmar devolver"));
  await reject("useReturnE5Cobro", "E5_VERSION_STALE", true);
  state.refundOptions.fuentes = [];
  await retry();
  assert.equal(mutationCalls("useReturnE5Cobro").length, 1, t.name);
});
test("E5-RETRY-DETAIL-REVISION", async t => {
  await proposal(); change("Importe nota N-101 cargo 901", "1");
  await click(button("Revisar preparar")); await click(button("Confirmar preparar"));
  await reject("useCreateE5Propuesta", "E5_VERSION_STALE", true);
  state.detail.revision += 1;
  await retry();
  assert.equal(mutationCalls("useCreateE5Propuesta").length, 1, t.name);
});
test("E5-NONADMIN-EXACT-MULTICHARGE", async t => {
  state.user = f.currentUser("CAJA"); state.context = f.context("CAJA", false, true);
  await reception(); await click(button("Revisar recepción"));
  assert.equal(last("usePreviewE5Cobro").variables.data.importe, "175.30", t.name);
  assert.deepEqual(last("usePreviewE5Cobro").variables.data.notasIndicadas, [101, 102], t.name);
});
test("E5-RECEPTION-CLIENT-TRANSFER", async t => {
  await reception("CLIENTE"); change("Medio", "TRANSFERENCIA"); change("Cuenta receptora", "CUENTA_FISCAL");
  await click(button("Revisar recepción"));
  assert.equal(mutationCalls("usePreviewE5Cobro").length, 1, t.name);
  const data = last("usePreviewE5Cobro").variables.data;
  assert.equal(data.entrada, "CLIENTE", t.name);
  assert.equal(Object.hasOwn(data, "sesionOperativaId"), false, t.name);
  assert.equal(Object.hasOwn(data, "sesionCajaId"), false, t.name);
});
test("E5-UUID-CHANGED-CONTENT", async t => {
  await reception(); await review(); const first = last("usePreviewE5Cobro").variables.data.claveOperacion;
  await click(button("Volver y modificar")); change("Importe recibido", "12.30");
  await click(button("Revisar recepción"));
  assert.notEqual(last("usePreviewE5Cobro").variables.data.claveOperacion, first, t.name);
});
test("E5-UUID-NORMALIZED-CONTENT", async t => {
  await reception(); await review(); const first = last("usePreviewE5Cobro").variables.data.claveOperacion;
  await click(button("Volver y modificar")); change("Importe recibido", " 00150.3 ");
  await click(button("Revisar recepción"));
  assert.equal(last("usePreviewE5Cobro").variables.data.claveOperacion, first, t.name);
});
test("E5-MONEY-NO-ROUNDING", async t => {
  await reception(); change("Importe recibido", "12.345"); await click(button("Revisar recepción"));
  assert.equal(mutationCalls("usePreviewE5Cobro").length, 0, t.name);
});
test("E5-EVIDENCE-TEXT-NOT-URL", t => {
  state.detail.evidenciaRecepcion.referencias = ["javascript:alert(1)", "https://private.example.test/receipt"];
  detail();
  assert.equal(Boolean(document.querySelector('a[href="https://private.example.test/receipt"]')), false, t.name);
  assert.equal(Boolean(screen.queryByText("Referencia: https://private.example.test/receipt")), true, t.name);
});
test("E5-DOCUMENT-TWO-COPIES", async t => {
  await documentPage();
  assert.equal(document.querySelectorAll("#e5-document-pages .e5-doc-sheet").length, 2, t.name);
  assert.equal(document.querySelectorAll("#e5-document-pages .e5-doc-signatures").length, 2, t.name);
  // Sonner's real App import also inserts a head stylesheet; stylesheet order
  // is not the A5 obligation. Locate the productive document's actual rule.
  assert.equal(Array.from(document.querySelectorAll("style")).some(style =>
    style.textContent?.includes("@page { size:A5 landscape; margin:0; }")), true, t.name);
});
test("E5-QUERY-ERROR-NOT-EMPTY", t => {
  state.queryErrors = { useListE5Cobros: { data: { error: { code: "E5_DEPENDENCY_DISABLED", message: "Productor cerrado" } } } };
  mount(<E5Entry clienteId={f.CLIENT} entrada="CLIENTE" />);
  assert.equal(Boolean(screen.queryByText("E5_DEPENDENCY_DISABLED: Productor cerrado")), true, t.name);
  assert.equal(Boolean(screen.queryByText("No hay recepciones en este alcance/filtro.")), false, t.name);
});
test("E5-RECEIVE-CAPABILITY", t => {
  state.availability.capacidades.puedeRecibir = false;
  mount(<E5Entry clienteId={f.CLIENT} entrada="CAJA" />);
  assert.equal(Boolean(screen.queryByRole("button", { name: "Recibir dirigido" })), false, t.name);
});
test("E5-NONOPERATIVE-READ-ROLE", t => {
  for (const role of ["SISTEMAS", "BODEGA"] as const) {
    cleanup(); resetHarness(); state.user = f.currentUser(role);
    mount(<E5Entry clienteId={f.CLIENT} entrada="CAJA" />);
    assert.equal(visits.some(v => v.name === "useGetE5Disponibilidad"), false, t.name);
  }
});
test("E5-SCOPE-CACHE-ROLE", t => {
  state.user = f.currentUser("CAJA");
  const node = () => <QueryClientProvider client={client}><Router><E5Entry clienteId={f.CLIENT} entrada="CAJA" /></Router></QueryClientProvider>;
  const view = render(node());
  const first = visits.filter(v => v.name === "useListE5Cobros").at(-1)!.args[1].query.queryKey;
  state.user.rol = "TERMINAL"; view.rerender(node());
  const second = visits.filter(v => v.name === "useListE5Cobros").at(-1)!.args[1].query.queryKey;
  assert.notDeepEqual(first, second, t.name);
});
test("E5-SCOPE-CACHE-SITE", t => {
  const node = () => <QueryClientProvider client={client}><Router><E5Entry clienteId={f.CLIENT} entrada="CAJA" /></Router></QueryClientProvider>;
  const view = render(node());
  state.location = 3; view.rerender(node());
  const latest = visits.filter(v => v.name === "useListE5Cobros").at(-1)!;
  assert.equal(latest.args[0].ubicacionId, 3, t.name);
  assert.equal(JSON.stringify(latest.args[1].query.queryKey).includes(":3:"), true, t.name);
});
test("E5-INITIAL-GET-CONTEXT-IDENTITY", async t => {
  await reception(); await review();
  state.transportHandlers = { getE5Contexto: () => ({ ...state.context, clienteId: 999 }) };
  await click(button("Confirmar dinero recibido"));
  assert.equal(mutationCalls("useCreateE5Cobro").length, 0, t.name);
  assert.equal(transportVisits.some(v => v.name === "getE5Contexto"), true, t.name);
});
test("E5-INITIAL-GET-DETAIL-IDENTITY", async t => {
  await proposal(); change("Importe nota N-101 cargo 901", "1");
  state.transportHandlers = { getE5Cobro: () => ({ ...state.detail, id: f.PROPOSAL }) };
  await click(button("Revisar preparar")); await click(button("Confirmar preparar"));
  assert.equal(mutationCalls("useCreateE5Propuesta").length, 0, t.name);
});
test("E5-INITIAL-LAST-ACTOR-RECHECK", async t => {
  await reception(); await review();
  let reads = 0;
  state.refetchHandlers = { useGetCurrentUser: async () => ({ data: ++reads === 1 ? state.user : f.currentUser("ADMIN", 11) }) };
  await click(button("Confirmar dinero recibido"));
  assert.equal(mutationCalls("useCreateE5Cobro").length, 0, t.name);
});
test("E5-RECOVERY-STORAGE-FAILURE", async t => {
  await uncertainReceipt(); sessionStorage.setItem(intentKeys()[0], "{broken");
  cleanup(); mount(<E5Entry clienteId={f.CLIENT} entrada="CAJA" />); await click(button("Recibir dirigido"));
  const form = button("Revisar recepción").closest("fieldset")!;
  assert.equal(form.disabled, true, t.name);
  assert.equal(mutationCalls("useCreateE5Cobro").length, 1, t.name);
});
test("E5-PENDING-NO-NEW-INTENT", async t => {
  await uncertainReceipt();
  assert.equal((button("Ocultar captura") as HTMLButtonElement).disabled, true, t.name);
  assert.equal(button("Confirmar dinero recibido").closest("fieldset")!.disabled, true, t.name);
});
test("E5-RECEIPT-IMMEDIATE-NO-PRINT", async t => {
  await sending(); await settle("useCreateE5Cobro", f.createResponse());
  const status = screen.getByRole("status");
  assert.equal(Array.from(status.querySelectorAll("a")).some(a => a.textContent === "Recibo inmediato" &&
    a.getAttribute("href") === `/cobros/pendientes/${f.RECEIPT}/documentos/${f.RECEIPT_DOCUMENT}`), true, t.name);
  assert.equal(prints, 0, t.name);
});
test("E5-APPLICATION-DISTINCT-CONSTANCIA", async t => {
  state.detail = f.receipt({ stage: "proposed" });
  await proposal("autorizar"); change("Importe nota N-101 cargo 901", f.PARTIAL);
  await click(button("Revisar autorizar")); await click(button("Confirmar autorizar"));
  await settle("useAuthorizeE5Aplicacion", f.authorizeResponse());
  const urls = Array.from(screen.getByRole("status").querySelectorAll("a")).map(a => a.getAttribute("href"));
  assert.equal(urls.includes(`/cobros/pendientes/${f.RECEIPT}/documentos/${f.RECEIPT_DOCUMENT}`), true, t.name);
  assert.equal(urls.includes(`/cobros/pendientes/${f.RECEIPT}/documentos/${f.APPLICATION_DOCUMENT}`), true, t.name);
});
test("E5-FAVOR-AUTHORIZE-ONLY", async t => {
  state.detail = f.favorReceipt(false, true);
  await proposal("autorizar"); change(/Favor explícito a autorizar/, "20");
  await click(button("Revisar autorizar")); await click(button("Confirmar autorizar"));
  assert.equal(mutationCalls("useAuthorizeE5Aplicacion").length, 1, t.name);
  const data = last("useAuthorizeE5Aplicacion").variables.data;
  assert.equal(data.importeFavorAutorizado, "20.00", t.name);
  assert.deepEqual(data.asignaciones, [], t.name);
  await settle("useAuthorizeE5Aplicacion", f.favorAuthorizeResponse(true));
  assert.equal(screen.getByRole("status").textContent?.includes("180.30"), true, t.name);
});
test("E5-FAVOR-OMISSION-ZERO", async t => {
  await proposal(); change("Importe nota N-101 cargo 901", "1");
  await click(button("Revisar preparar")); await click(button("Confirmar preparar"));
  assert.equal(Object.hasOwn(last("useCreateE5Propuesta").variables.data, "importeFavorPropuesto"), false, t.name);
});
test("E5-FAVOR-RETAINED-LIMIT", async t => {
  state.detail = f.favorReceipt();
  await proposal(); change("Importe nota N-101 cargo 901", "100.10"); change(/Favor explícito a proponer/, "100.21");
  await click(button("Revisar preparar"));
  assert.equal(Boolean(screen.queryByRole("button", { name: "Confirmar preparar" })), false, t.name);
});
test("E5-DOCUMENT-FAVOR-SNAPSHOT", async t => {
  state.detail = f.favorReceipt(true); state.document = f.favorDocument();
  await documentPage(f.APPLICATION_DOCUMENT);
  assert.match(document.querySelector("#e5-document-pages")?.textContent ?? "", /Favor autorizado generado en esta constancia:\s*\$?\s*20\.00/, t.name);
});
test("E5-DOCUMENT-PAGINATION", async t => {
  state.document.notas = Array.from({ length: 20 }, (_, i) => ({
    ...f.notes()[0], notaId: 200 + i, movimientoVentaId: 1000 + i, folio: `SNAP-${i}`,
  }));
  await documentPage();
  assert.equal(document.querySelectorAll("#e5-document-pages .e5-doc-sheet").length, 6, t.name);
  assert.equal(document.querySelectorAll("#e5-document-pages tbody tr").length, 40, t.name);
});
test("E5-PRINT-MOTIVE-REQUIRED", async t => {
  await documentPage();
  assert.equal((button("Solicitar impresión / reimpresión") as HTMLButtonElement).disabled, true, t.name);
  assert.equal(mutationCalls("useRecordE5Impresion").length, 0, t.name);
});
test("E5-PRINT-RECOVERY-REMOUNT", async t => {
  await documentPage(); await printRequest();
  const first = f.wire(last("useRecordE5Impresion").variables);
  await reject("useRecordE5Impresion", "E5_VERSION_STALE", true); cleanup(); await documentPage();
  assert.equal(Boolean(screen.queryByRole("button", { name: "Reintentar solicitud auditada" })), true, t.name);
  await click(button("Reintentar solicitud auditada"));
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 80)); });
  assert.deepEqual(last("useRecordE5Impresion").variables, first, t.name);
});
test("E5-PRINT-FRESH-ADMIN", async t => {
  await documentPage();
  state.refetchHandlers = { useGetCurrentUser: async () => ({ data: f.currentUser("CAJA") }) };
  await printRequest();
  assert.equal(mutationCalls("useRecordE5Impresion").length, 0, t.name);
  assert.equal(prints, 0, t.name);
});
test("E5-PRINT-FAILURE-NO-MONEY", async t => {
  await documentPage(); window.print = () => { throw new Error("Printer unavailable"); }; await printRequest();
  await settle("useRecordE5Impresion", f.printResponse());
  assert.equal(Boolean(screen.queryByText(/No se repite el cobro ni la aplicación/)), true, t.name);
  assert.equal(mutationCalls("useCreateE5Cobro").length + mutationCalls("useAuthorizeE5Aplicacion").length, 0, t.name);
  assert.equal(document.body.classList.contains("e5-print"), false, t.name);
});
test("E5-NONADMIN-DOCUMENT-LINKS", t => {
  state.user = f.currentUser("CAJA"); state.detail = f.receipt({ stage: "partial" });
  detail();
  assert.equal(Boolean(screen.queryByRole("link", { name: "Recibo inmediato" })), false, t.name);
  assert.equal(Boolean(document.querySelector('a[href*="/documentos/"]')), false, t.name);
});
test("E5-DETAIL-HISTORY", t => {
  state.detail = f.receipt({ stage: "rejected" }); detail();
  assert.equal(Boolean(screen.queryByText(/Propuesta v1/)), true, t.name);
  assert.equal(Boolean(screen.queryByText(/Rechazo ·/)), true, t.name);
  assert.equal(Boolean(screen.queryByText(/Devuelto 150/)), false, t.name);
});
test("E5-RETRY-PROPOSAL-VERSION", async t => {
  state.detail = f.receipt({ stage: "proposed" });
  await proposal("autorizar"); change("Importe nota N-101 cargo 901", f.PARTIAL);
  await click(button("Revisar autorizar")); await click(button("Confirmar autorizar"));
  await reject("useAuthorizeE5Aplicacion", "E5_VERSION_STALE", true);
  state.detail.propuestaVigenteId = f.APPLICATION;
  await retry();
  assert.equal(mutationCalls("useAuthorizeE5Aplicacion").length, 1, t.name);
});
test("E5-PRINT-SYNC-LOCK", async t => {
  await documentPage(); change("Motivo de impresión / reimpresión", "Entrega copia");
  const target = button("Solicitar impresión / reimpresión");
  await act(async () => { target.click(); target.click(); });
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 80)); });
  assert.equal(mutationCalls("useRecordE5Impresion").length, 1, t.name);
});
test("E5-DOCUMENT-RESPONSE-IDENTITY", async t => {
  state.document.cobroId = f.PROPOSAL; await documentPage();
  assert.equal(Boolean(document.querySelector("#e5-document-pages")), false, t.name);
});
test("E5-QUERY-AVAILABILITY-ERROR", t => {
  state.queryErrors = { useGetE5Disponibilidad: new Error("Servicio indisponible") };
  mount(<E5Entry clienteId={f.CLIENT} entrada="CAJA" />);
  assert.equal(Boolean(screen.queryByRole("button", { name: "Recibir dirigido" })), false, t.name);
  assert.equal(Boolean(screen.queryByText("Servicio indisponible")), true, t.name);
});
test("E5-RESPONSE-DETAIL-UUID", async t => {
  await proposal(); change("Importe nota N-101 cargo 901", "1");
  await click(button("Revisar preparar")); await click(button("Confirmar preparar"));
  const result = f.proposalResponse();
  result.id = f.APPLICATION; result.propuestas[0].asignaciones = last("useCreateE5Propuesta").variables.data.asignaciones;
  await settle("useCreateE5Propuesta", result);
  assert.equal(intentKeys().length, 1, t.name);
});
test("E5-RESPONSE-IDENTITY-MATRIX", async t => {
  const changes = [{ ubicacionId: 999 }, { receptor: { ...f.actor, id: 999 } }, { importeRecibido: "1.00" },
    { formaPago: "TRANSFERENCIA" }, { cuentaDestino: "CUENTA_FISCAL" }, { sesionOperativaId: 999 }];
  for (const change of changes) {
    cleanup(); resetHarness(); sessionStorage.clear();
    await sending(); await settle("useCreateE5Cobro", { ...f.createResponse(), ...change });
    assert.equal(intentKeys().length, 1, t.name);
    assert.equal(Boolean(screen.queryByText(/Operación confirmada ·/)), false, t.name);
  }
});
test("E5-REFUND-NO-SOURCE", async t => {
  state.refundOptions.fuentes = []; await proposal("devolver");
  assert.equal(Boolean(screen.queryByText("No existe una fuente actual comprobada; no se puede devolver.")), true, t.name);
  assert.equal(mutationCalls("useReturnE5Cobro").length, 0, t.name);
});
test("E5-ROUTE-FUTURE-A", t => {
  futureA(); appAt(`/cobros/pendientes/${f.RECEIPT}`);
  assert.equal(Boolean(screen.queryByRole("button", { name: "Revisar preparar" })), true, t.name);
  assert.equal((button("Revisar preparar") as HTMLButtonElement).disabled, false, t.name);
});
test("E5-ROUTE-DETAIL-PERMISSION", t => {
  state.user = f.currentUser("CAJA", 10, false); appAt(`/cobros/pendientes/${f.RECEIPT}`);
  assert.equal(Boolean(screen.queryByText(/No tienes permisos para ver este módulo/)), true, t.name);
  assert.equal(visits.some(v => v.name === "useGetE5Cobro"), false, t.name);
});
test("E5-ROUTE-DOCUMENT-ADMIN", t => {
  state.user = f.currentUser("CAJA");
  appAt(`/cobros/pendientes/${f.RECEIPT}/documentos/${f.RECEIPT_DOCUMENT}`);
  assert.equal(Boolean(screen.queryByText("Tu rol no tiene acceso a esta sección.")), true, t.name);
  assert.equal(visits.some(v => v.name === "useGetE5Documento"), false, t.name);
});
test("E5-FUTURE-A-CONTEXT-CAPABILITY", t => {
  futureA(); state.context.capacidades.preparacionADisponible = false; detail();
  assert.equal((button("Revisar preparar") as HTMLButtonElement).disabled, true, t.name);
});
test("E5-NONADMIN-FUND-PRIVACY", t => {
  state.user = f.currentUser("CAJA");
  // Deliberately expose previously cached ADMIN transport data to a non-ADMIN.
  detail(); change("Acción", "devolver");
  assert.equal(Boolean(screen.queryByLabelText("Fuente actual")), false, t.name);
  assert.equal(visits.some(v => v.name === "useGetE5DevolucionOpciones" && v.enabled), false, t.name);
  assert.equal(document.body.textContent?.includes("FONDO"), false, t.name);
});