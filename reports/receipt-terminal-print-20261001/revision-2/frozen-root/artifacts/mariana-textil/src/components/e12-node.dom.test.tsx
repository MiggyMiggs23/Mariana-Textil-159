import assert from "node:assert/strict";
import { test, beforeEach, afterEach } from "node:test";
import React from "react";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Route } from "wouter";
import * as schema from "@workspace/api-zod";
import { ProveedorPagoDialog } from "./proveedor-pago-dialog";
import { SolicitudPagoDirigidoDialog } from "./solicitud-pago-dirigido-dialog";
import { ProveedorCompraDetalle } from "./proveedor-compra-detalle";
import { SalidasDineroE4Panel } from "./salidas-dinero-e4-panel";
import { SalidaDineroE4Item } from "./salidas-dinero-e4-item";
import { CorteEfectivoDesglose } from "./corte-efectivo-desglose";
import ProveedorDetail from "../pages/proveedor-detail";
import PagosDirigidos from "../pages/pagos-dirigidos";
import * as fixture from "./e12-node-test-fixtures";
import { state, resetHarness, setGate, calls, mutationCalls, queryObservations,
  succeed, fail, visits } from "./e12-node-test-harness";

const PAY = "useRegistrarPagoProveedor", PREVIEW = "usePreviewPagoProveedor";
const DIRECT = "useCreateSolicitudPagoDirigido", APPROVE = "useAprobarSolicitudPagoDirigido";
const REVERSE = "useReversarPagoProveedor", OPTIONS = "useGetOpcionesPagoEfectivoProveedor";
const CASH_OUT = "useCrearSalidaDineroCaja";
let client: QueryClient;
beforeEach(() => {
  resetHarness();
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false } } });
  window.history.replaceState(null, "", "/proveedores/7");
});
afterEach(() => { cleanup(); client.clear(); });
const mount = (node: React.ReactNode) => render(<QueryClientProvider client={client}>{node}</QueryClientProvider>);
const change = (element: HTMLElement, value: string) => fireEvent.change(element, { target: { value } });
async function click(element: HTMLElement) { await act(async () => { fireEvent.click(element); }); }
async function choose(trigger: HTMLElement, option: string) {
  fireEvent.focus(trigger); fireEvent.keyDown(trigger, { key: "ArrowDown" });
  await click(screen.getByRole("option", { name: option }));
}
const last = (name: string) => mutationCalls(name).at(-1)!;
async function reject(name: string, code?: string) { await act(async () => { fail(last(name), code); }); }
const fifo = () => mount(<ProveedorPagoDialog open onOpenChange={() => {}} proveedorId={7} defaultAmount="150.50" />);
async function cashFields(caja = "50.25", fondo = "100.25") {
  await choose(screen.getAllByRole("combobox")[1], "Efectivo");
  if (state.user.rol === "ADMIN") {
    change(screen.getByTestId("input-e12-caja"), caja);
    change(screen.getByTestId("input-e12-fondo"), fondo);
  }
}
async function preview(id: string) {
  const before = mutationCalls(PREVIEW).length;
  const financialBefore = mutationCalls(PAY).length + mutationCalls(DIRECT).length;
  await click(screen.getByRole("button", { name: /^Vista Previa$/ }));
  assert.equal(mutationCalls(PREVIEW).length, before + 1, id);
  assert.equal(mutationCalls(PAY).length + mutationCalls(DIRECT).length, financialBefore, id);
  schema.PreviewPagoProveedorBody.parse(last(PREVIEW).variables.data);
  await act(async () => { succeed(last(PREVIEW), fixture.preview()); });
}
const confirm = () => click(screen.getByRole("button", { name: "Confirmar Pago" }));
const disabledPreview = () => screen.getByRole("button", { name: /^Vista Previa$/ }).hasAttribute("disabled");
const parent = () => mount(<Route path="/proveedores/:id"><ProveedorDetail /></Route>);
function detail(metadata = true, returned = false) {
  state.payment = fixture.paymentDetail({ metadata, returned });
  mount(<ProveedorCompraDetalle open onOpenChange={() => {}} proveedorId={7} compraId={0} pagoId={91} />);
}
async function reversal(metadata = true) {
  detail(metadata); await click(screen.getByTestId("button-retorno-proveedor"));
  change(screen.getByPlaceholderText("Explica por qué se anula este pago..."), "Recuperación documentada");
  change(screen.getAllByRole("textbox").at(-1)!, "REVERSAR");
}
const returnNature = (value = "Recuperación física de efectivo") => choose(screen.getByRole("combobox"), value);
const returnConfirm = () => click(screen.getByRole("button", { name: "Confirmar Reverso" }));
async function approval() {
  mount(<PagosDirigidos />);
  await click(screen.getByRole("button", { name: "Aprobar" }));
}
const approveConfirm = () => click(screen.getByRole("button", { name: "Confirmar Aprobación" }));
function p12() {
  mount(<SalidasDineroE4Panel sesionId={123} canCreate tiendaId={1} />);
  change(screen.getByLabelText(/Monto/i), "150.50");
  change(screen.getByLabelText(/^Motivo$/i), "Gasto extraordinario fixture");
}
const p12Submit = () => act(async () => { fireEvent.submit(screen.getByRole("form", { name: "Registrar salida de dinero" })); });

test("E12-MIXED-ONE-PAYMENT", async t => {
  fifo(); await cashFields(); await preview(t.name); await confirm();
  assert.equal(mutationCalls(PAY).length, 1, t.name);
  const body = last(PAY).variables.data;
  assert.equal(body.efectivoE12.caja, "50.25", t.name);
  assert.equal(body.efectivoE12.fondo, "100.25"); assert.equal(body.importe, 150.50);
  assert.equal(body.formaPago, "EFECTIVO"); assert.equal(last(PAY).variables.id, 7);
  assert.equal(mutationCalls(DIRECT).length + mutationCalls(CASH_OUT).length, 0);
  schema.RegistrarPagoProveedorBody.parse(body);
});
test("E12-FUND-NO-SESSION", async t => {
  state.options = fixture.cashOptions({ session: null });
  fifo(); await cashFields("0.00", "150.50"); await preview(t.name); await confirm();
  assert.equal(mutationCalls(PAY).length, 1, t.name);
  assert.equal(last(PAY).variables.data.efectivoE12.sesionCajaId, null, t.name);
  assert.equal(visits.some(v => /AbrirSesion/.test(v.name)), false);
});
test("E12-CAJA-SESSION", async t => {
  fifo(); await cashFields(); await preview(t.name); await confirm();
  assert.equal(last(PAY).variables.data.efectivoE12.sesionCajaId, 123, t.name);
  cleanup(); state.options = fixture.cashOptions({ session: null }); fifo(); await cashFields();
  assert.equal(disabledPreview(), true);
  assert.ok(Boolean(screen.queryByText(/Se requiere una sesión abierta de Mariana/)));
});
test("E12-EXACT-CENTS", async t => {
  fifo(); await cashFields("50.24", "100.25");
  assert.equal(disabledPreview(), true, t.name);
  for (const value of ["-1", "50.251", "NaN"]) {
    change(screen.getByTestId("input-e12-caja"), value); assert.equal(disabledPreview(), true);
  }
  change(screen.getByTestId("input-e12-caja"), "50.25"); assert.equal(disabledPreview(), false);
});
test("E12-FUND-PRIVACY", async t => {
  state.user = fixture.currentUser("CAJA");
  // Privileged stale cached data must not create controls for the current actor.
  fifo(); await choose(screen.getAllByRole("combobox")[1], "Efectivo");
  assert.equal(Boolean(screen.queryByTestId("input-e12-fondo")), false, t.name);
  assert.equal(Boolean(screen.queryByTestId("input-e12-desbloqueo")), false);
  await preview(t.name); await confirm();
  assert.equal(last(PAY).variables.data.efectivoE12.caja, "150.50");
  assert.equal(Object.hasOwn(last(PAY).variables.data.efectivoE12, "fondo"), false);
});
test("E12-CAJA-OVERRIDE", async t => {
  state.options = fixture.cashOptions({ caja: "10.00" }); fifo(); await cashFields();
  assert.equal(disabledPreview(), true, t.name);
  change(screen.getByTestId("input-e12-desbloqueo"), "Autorización administrativa documentada");
  assert.equal(disabledPreview(), false); await preview(t.name); await confirm();
  assert.equal(last(PAY).variables.data.efectivoE12.desbloqueoCaja.motivo, "Autorización administrativa documentada");
});
test("E12-FUND-NO-OVERDRAFT", async t => {
  state.options = fixture.cashOptions({ fondo: "100.24" }); fifo(); await cashFields();
  change(screen.getByTestId("input-e12-desbloqueo"), "No permite sobregiro de Fondo");
  assert.equal(disabledPreview(), true, t.name);
  assert.equal(mutationCalls(PAY).length, 0);
});
test("E12-PAY-RETRY", async t => {
  fifo(); await cashFields(); await preview(t.name); await confirm();
  const first = last(PAY).variables; await reject(PAY); await confirm();
  assert.equal(mutationCalls(PAY).length, 2, t.name);
  assert.equal(last(PAY).variables.data.efectivoE12.claveOperacion, first.data.efectivoE12.claveOperacion, t.name);
  assert.deepEqual(last(PAY).variables, first);
});
test("E12-PAY-DOUBLE", async t => {
  fifo(); await cashFields(); await preview(t.name);
  const button = screen.getByRole("button", { name: "Confirmar Pago" });
  await act(async () => { fireEvent.click(button); fireEvent.click(button); });
  assert.equal(mutationCalls(PAY).length, 1, t.name);
});
test("E12-PAY-CONTENT", async t => {
  fifo(); await cashFields(); await preview(t.name); await confirm();
  const first = last(PAY).variables.data.efectivoE12.claveOperacion; await reject(PAY);
  await click(screen.getByRole("button", { name: "Atrás" }));
  change(document.querySelector<HTMLInputElement>('input[type="date"]')!, "2026-09-20");
  await click(screen.getByRole("button", { name: /^Vista Previa$/ }));
  await act(async () => { succeed(last(PREVIEW), fixture.preview()); });
  await confirm();
  assert.notEqual(last(PAY).variables.data.efectivoE12.claveOperacion, first, t.name);
});
test("E12-IDENTITY-CONTEXT", async t => {
  const view = fifo(); await cashFields(); await preview(t.name); await confirm();
  const first = last(PAY).variables.data.efectivoE12.claveOperacion;
  await reject(PAY); await click(screen.getByRole("button", { name: "Atrás" }));
  state.user = fixture.wire(schema.GetCurrentUserResponse.parse({ ...fixture.currentUser(), id: 11 }));
  const rerender = () => view.rerender(<QueryClientProvider client={client}><ProveedorPagoDialog
    open onOpenChange={() => {}} proveedorId={7} defaultAmount="150.50" /></QueryClientProvider>);
  rerender();
  assert.equal((screen.getByTestId("input-e12-caja") as HTMLInputElement).value, "");
  await cashFields(); await preview(t.name); await confirm();
  assert.notEqual(last(PAY).variables.data.efectivoE12.claveOperacion, first, t.name);
  await reject(PAY); await click(screen.getByRole("button", { name: "Atrás" }));
  state.user = fixture.wire(schema.GetCurrentUserResponse.parse({ ...fixture.currentUser("CAJA"), id: 11 }));
  rerender();
  assert.equal(Boolean(screen.queryByTestId("input-e12-fondo")), false);
  assert.equal(Boolean(screen.queryByTestId("input-e12-desbloqueo")), false);
  await preview(t.name); await confirm();
  assert.equal(last(PAY).variables.data.efectivoE12.caja, "150.50");
  assert.equal(Object.hasOwn(last(PAY).variables.data.efectivoE12, "fondo"), false);
});
test("E12-FRESH-CONFIRM", async t => {
  fifo(); await cashFields(); await preview(t.name);
  state.options = fixture.cashOptions({ fondo: "0.00" });
  await confirm(); assert.equal(mutationCalls(PAY).length, 0, t.name);
  assert.ok(queryObservations.some(q => q.name === OPTIONS && q.kind === "refetch"));
});
test("E12-OFF", async t => {
  setGate(false); fifo(); await choose(screen.getAllByRole("combobox")[1], "Efectivo");
  assert.equal(queryObservations.some(q => q.name === OPTIONS && (q.enabled || q.kind === "refetch")), false, t.name);
  assert.equal(Boolean(screen.queryByTestId("input-e12-fondo")), false);
  await preview(t.name); await confirm();
  assert.equal(Object.hasOwn(last(PAY).variables.data, "efectivoE12"), false);
  await act(async () => { succeed(last(PAY), fixture.payment()); });
  assert.equal(Boolean(screen.queryByText(/^Efectivo: Caja/)), false);
});
test("E12-NONCASH", async t => {
  fifo(); await preview(t.name); await confirm();
  assert.equal(Object.hasOwn(last(PAY).variables.data, "efectivoE12"), false, t.name);
  assert.equal(queryObservations.some(q => q.name === OPTIONS && (q.enabled || q.kind === "refetch")), false, t.name);
});
test("E12-DIRECTED-FIFO-ENTRY", async t => {
  fifo(); await choose(screen.getByTestId("select-proveedor-payment-mode"), "Pago dirigido");
  await cashFields(); await preview(t.name);
  await click(screen.getByRole("button", { name: /#1045/ }));
  change(screen.getByTestId("input-proveedor-directed-reason"), "Compra específica documentada");
  await click(screen.getByRole("button", { name: "Enviar solicitud" }));
  assert.equal(Boolean(last(DIRECT)?.variables.data.efectivoE12), true, t.name);
  assert.equal(last(DIRECT).variables.data.documentoMovimientoId, 35);
  assert.equal(last(DIRECT).variables.data.efectivoE12.fondo, "100.25");
  assert.equal(mutationCalls(PAY).length, 0);
  schema.CreateSolicitudPagoDirigidoBody.parse(last(DIRECT).variables.data);
  const first = last(DIRECT).variables.data.efectivoE12.claveOperacion;
  await reject(DIRECT);
  await click(screen.getByRole("button", { name: "Enviar solicitud" }));
  assert.equal(last(DIRECT).variables.data.efectivoE12.claveOperacion, first);
  await act(async () => { succeed(last(DIRECT), fixture.directedResponse()); });
  assert.ok(Boolean(screen.queryByText(/pendiente de aplicación, sin movimiento de dinero/)));
  assert.ok(Boolean(screen.queryByText(/Fuentes registradas: Caja 50.25 · Fondo 100.25/)));
});
test("E12-DIRECTED-DOCUMENT-ENTRY", async t => {
  mount(<SolicitudPagoDirigidoDialog open onOpenChange={() => {}} tipo="PROVEEDOR" entidadId={7}
    documentoMovimientoId={35} folio={1045} saldoPendiente="150.50" />);
  await choose(screen.getByRole("combobox"), "Efectivo");
  change(screen.getByTestId("input-e12-caja"), "50.25");
  change(screen.getByTestId("input-e12-fondo"), "100.25");
  change(screen.getByPlaceholderText(/Explique detalladamente/), "Compra específica documentada");
  const button = screen.getByRole("button", { name: "Aplicar pago dirigido" });
  await act(async () => { fireEvent.click(button); fireEvent.click(button); });
  assert.equal(mutationCalls(DIRECT).length, 1, t.name);
  assert.equal(Boolean(last(DIRECT)?.variables.data.efectivoE12), true, t.name);
  assert.equal(last(DIRECT).variables.data.documentoMovimientoId, 35);
  assert.equal(last(DIRECT).variables.data.efectivoE12.caja, "50.25");
  assert.equal(mutationCalls(PAY).length, 0);
  schema.CreateSolicitudPagoDirigidoBody.parse(last(DIRECT).variables.data);
  const first = last(DIRECT).variables.data.efectivoE12.claveOperacion;
  await reject(DIRECT); await click(button);
  assert.equal(last(DIRECT).variables.data.efectivoE12.claveOperacion, first);
  await reject(DIRECT);
  change(screen.getByPlaceholderText(/Explique detalladamente/), "Otra compra específica documentada");
  await click(button);
  assert.notEqual(last(DIRECT).variables.data.efectivoE12.claveOperacion, first);
  await act(async () => { succeed(last(DIRECT), fixture.directedResponse("APROBADA")); });
  assert.ok(Boolean(screen.queryByText(/Fuentes registradas: Caja 50.25 · Fondo 100.25/)));
});
test("E12-APPROVE-PERSISTED", async t => {
  await approval();
  assert.ok(Boolean(screen.queryByText("Propuesta persistida: Caja 50.25 · Fondo 100.25")));
  assert.equal(Boolean(screen.queryByTestId("input-e12-fondo")), false);
  await approveConfirm();
  assert.equal(mutationCalls(APPROVE).length, 1, t.name);
  assert.deepEqual(Object.keys(last(APPROVE).variables.data.aprobacionE12).sort(), ["claveOperacion"], t.name);
  assert.equal(last(APPROVE).variables.id, 81);
  schema.AprobarSolicitudPagoDirigidoBody.parse(last(APPROVE).variables.data);
  await act(async () => { succeed(last(APPROVE), fixture.approvalResponse()); });
  assert.ok(Boolean(screen.queryByText(/^Efectivo: Caja 50.25 · Fondo 100.25/)));
});
test("E12-APPROVE-SESSION", async t => {
  await approval(); state.options = fixture.cashOptions({ session: 456 });
  await approveConfirm(); assert.equal(mutationCalls(APPROVE).length, 0, t.name);
});
test("E12-APPROVE-RETRY", async t => {
  await approval();
  const button = screen.getByRole("button", { name: "Confirmar Aprobación" });
  await act(async () => { fireEvent.click(button); fireEvent.click(button); });
  assert.equal(mutationCalls(APPROVE).length, 1, t.name);
  const first = last(APPROVE).variables;
  await reject(APPROVE); await approveConfirm();
  assert.equal(mutationCalls(APPROVE).length, 2, t.name);
  assert.equal(last(APPROVE).variables.data.aprobacionE12.claveOperacion, first.data.aprobacionE12.claveOperacion, t.name);
  await reject(APPROVE);
  change(screen.getByPlaceholderText("Justificación si no hay saldo..."), "Motivo administrativo corregido");
  await approveConfirm();
  assert.notEqual(last(APPROVE).variables.data.aprobacionE12.claveOperacion, first.data.aprobacionE12.claveOperacion);
});
test("E12-RETURN-DERIVED", async t => {
  await reversal(); await returnNature(); await returnConfirm();
  assert.equal(mutationCalls(REVERSE).length, 1, t.name);
  const data = last(REVERSE).variables.data;
  assert.deepEqual(Object.keys(data.efectivoE12).sort(), ["claveOperacion", "naturaleza"], t.name);
  assert.equal(data.efectivoE12.naturaleza, "RECUPERACION_EFECTIVO");
  assert.equal(last(REVERSE).variables.pagoId, 91);
  schema.ReversarPagoProveedorBody.parse(data);
  assert.equal(calls.some(c => /CerrarSesion|RegistrarPagoProveedor|CrearSalida/.test(c.name)), false);
});
test("E12-RETURN-EXPLICIT", async t => {
  await reversal();
  assert.equal(screen.getByRole("button", { name: "Confirmar Reverso" }).hasAttribute("disabled"), true, t.name);
  assert.equal(mutationCalls(REVERSE).length, 0);
});
test("E12-RETURN-SERVER-REQUIRED", async t => {
  state.user = fixture.currentUser("CAJA"); await reversal(false);
  assert.equal(Boolean(screen.queryByRole("combobox")), false);
  await returnConfirm(); assert.equal(Object.hasOwn(last(REVERSE).variables.data, "efectivoE12"), false);
  await reject(REVERSE, "E12_RETURN_REQUIRED");
  assert.equal(mutationCalls(REVERSE).length, 1, t.name);
  assert.equal(Boolean(screen.queryByRole("combobox")), true, t.name);
  assert.equal((screen.getByPlaceholderText("Explica por qué se anula este pago...") as HTMLInputElement).value, "Recuperación documentada");
  assert.equal(Boolean(screen.queryByText(/^Efectivo: Caja/)), false);
  await returnNature("Corrección de captura"); await returnConfirm();
  assert.equal(mutationCalls(REVERSE).length, 2);
  assert.equal(last(REVERSE).variables.data.efectivoE12.naturaleza, "CORRECCION_CAPTURA");
});
test("E12-RETURN-RETRY", async t => {
  await reversal(); await returnNature();
  const button = screen.getByRole("button", { name: "Confirmar Reverso" });
  await act(async () => { fireEvent.click(button); fireEvent.click(button); });
  assert.equal(mutationCalls(REVERSE).length, 1, t.name);
  const first = last(REVERSE).variables;
  await reject(REVERSE); await returnConfirm();
  assert.equal(last(REVERSE).variables.data.efectivoE12.claveOperacion, first.data.efectivoE12.claveOperacion, t.name);
  await reject(REVERSE); change(screen.getByPlaceholderText("Explica por qué se anula este pago..."), "Motivo corregido");
  await returnConfirm(); assert.notEqual(last(REVERSE).variables.data.efectivoE12.claveOperacion, first.data.efectivoE12.claveOperacion);
});
test("E12-EVIDENCE-PRIVACY", async t => {
  state.user = fixture.currentUser("CAJA"); detail(true);
  assert.equal(Boolean(screen.queryByText(/^Efectivo: Caja/)), false, t.name);
  assert.equal(Boolean(screen.queryByRole("link", { name: "Movimiento de Fondo" })), false);
  cleanup(); state.user = fixture.currentUser(); detail(true);
  assert.ok(Boolean(screen.queryByText(/^Efectivo: Caja 50.25 · Fondo 100.25/)));
  assert.equal(screen.getByRole("link", { name: "Movimiento de Fondo" }).getAttribute("href"), `/fondo/movimientos/${fixture.FUND_MOVEMENT}`);
  cleanup(); detail(false); assert.equal(Boolean(screen.queryByText(/^Efectivo: Caja/)), false);
  cleanup(); detail(true, true);
  assert.equal(Boolean(screen.queryByTestId("button-retorno-proveedor")), false);
  assert.equal(screen.getByRole("link", { name: "Corte del retorno" }).getAttribute("href"), "/caja/cortes?sesionId=456");
  assert.ok(Boolean(screen.queryByText(/^Retorno completo: Caja 50.25 · Fondo 100.25 · Sesión 456/)));
});
test("E12-PARENT-PAYMENT", async t => {
  parent(); await click(screen.getByTestId("button-registrar-pago-header"));
  change(screen.getByTestId("proveedor-payment-amount"), "150.50");
  await cashFields(); await preview(t.name); await confirm();
  assert.equal(last(PAY).variables.id, 7, t.name);
  assert.equal(last(PAY).variables.data.efectivoE12.fondo, "100.25");
});
test("E12-PARENT-LEDGER", async t => {
  state.statement = fixture.statementWithPayment();
  state.payment = { ...fixture.paymentDetail(), aplicaciones: [] };
  parent();
  await act(async () => { fireEvent.mouseDown(screen.getByTestId("tab-pagos"), { button: 0, ctrlKey: false }); });
  assert.equal(Boolean(screen.queryByTestId("button-detalle-pago-91")), true, t.name);
  await click(screen.getByTestId("button-detalle-pago-91"));
  assert.ok(Boolean(screen.queryByTestId("button-retorno-proveedor")));
  assert.ok(Boolean(screen.queryByRole("link", { name: "Movimiento de Fondo" })));
});
test("E12-REFRESH-KEYS", async t => {
  const keys = ["/api/proveedores/7/pagos/efectivo-opciones", "/api/proveedores/7/estado-cuenta",
    "/api/caja/sesiones/123/corte", "/api/fondo/movimientos"];
  for (const key of keys) client.setQueryData([key], { fixture: true });
  fifo(); await cashFields(); await preview(t.name); await confirm();
  await act(async () => { succeed(last(PAY), fixture.payment()); });
  assert.equal(client.getQueryState([keys[0]])?.isInvalidated, true, t.name);
  assert.ok(Boolean(screen.queryByText(/^Efectivo: Caja 50.25 · Fondo 100.25/)));
  for (const key of keys) assert.equal(client.getQueryState([key])?.isInvalidated, true);
  const query = visits.find(v => v.name === OPTIONS && v.args.at(-1)?.query?.enabled)?.args.at(-1)?.query;
  assert.equal(query.refetchOnMount, "always"); assert.equal(query.refetchOnWindowFocus, true);
  assert.equal(query.refetchInterval, 15000);
  cleanup(); resetHarness();
  state.user = fixture.currentUser("CAJA"); state.options = fixture.cashOptions({ fondo: false, unlock: false });
  for (const key of keys) client.setQueryData([key], { fixture: true });
  fifo(); await cashFields(); await preview(t.name); await confirm();
  await act(async () => { succeed(last(PAY), fixture.payment({ metadata: false, caja: "150.50", fondo: "0.00" })); });
  assert.equal(client.getQueryState([keys[0]])?.isInvalidated, true);
  assert.equal(client.getQueryState([keys[3]])?.isInvalidated, false);
});
test("E12-P12-ADMIN", async t => {
  state.cut = fixture.cut("10.00"); p12(); await p12Submit();
  assert.equal(mutationCalls(CASH_OUT).length, 0, t.name);
  change(screen.getByLabelText(/Motivo Desbloqueo Caja E12/), "Urgencia administrativa documentada");
  await p12Submit(); assert.equal(mutationCalls(CASH_OUT).length, 1);
  assert.equal(last(CASH_OUT).variables.data.desbloqueoCajaE12.motivo, "Urgencia administrativa documentada");
  schema.CrearSalidaDineroCajaBody.parse(last(CASH_OUT).variables.data);
});
test("E12-P12-NONADMIN", async t => {
  state.user = fixture.currentUser("CAJA"); state.cut = fixture.cut("10.00"); p12();
  assert.equal(Boolean(screen.queryByLabelText(/Motivo Desbloqueo Caja E12/)), false, t.name);
  await p12Submit(); assert.equal(mutationCalls(CASH_OUT).length, 0);
});
test("E12-P12-CONTENT", async t => {
  p12(); change(screen.getByLabelText(/Motivo Desbloqueo Caja E12/), "Motivo administrativo primero");
  await p12Submit(); const first = last(CASH_OUT).variables.data.claveOperacion;
  await reject(CASH_OUT);
  change(screen.getByLabelText(/Motivo Desbloqueo Caja E12/), "Motivo administrativo corregido");
  await p12Submit();
  assert.notEqual(last(CASH_OUT).variables.data.claveOperacion, first, t.name);
});
test("E12-P12-OFF", async t => {
  setGate(false); p12();
  assert.equal(queryObservations.some(q => q.name === "useObtenerCorteCaja" && (q.enabled || q.kind === "refetch")), false, t.name);
  await p12Submit();
  assert.equal(mutationCalls(CASH_OUT).length, 1);
  assert.equal(Object.hasOwn(last(CASH_OUT).variables.data, "desbloqueoCajaE12"), false);
});
test("E12-P12-ITEM-PRIVACY", t => {
  const salida = fixture.wire(schema.ListarSalidasDineroCajaResponse.parse({ salidas: [{
    id: 61, sesionCajaId: 123, creadoPorId: 10, monto: "50.25", motivo: "Pago proveedor",
    cuentaOrigen: "CAJA_FISICA", createdAt: fixture.WHEN, pagoProveedorIdE12: 91,
    e4: { estado: "NO_APLICA", tipo: "PROVEEDOR", version: 0, historial: [], claveOperacion: fixture.ORIGINAL_KEY },
  }] }).salidas[0]);
  mount(<SalidaDineroE4Item salida={salida} sesionId={123} userRole="CAJA" tiendaId={1} userUbicacionId={1} />);
  assert.equal(Boolean(screen.queryByText(/E12 Pago:/)), false, t.name);
});
test("E12-CORTE-RETURN", t => {
  const breakdown = fixture.returnBreakdown();
  mount(<CorteEfectivoDesglose desglose={breakdown} />);
  const row = screen.getByText("Efectivo esperado").parentElement!;
  assert.match(row.textContent ?? "", /150\.25/, t.name);
  assert.equal(screen.getAllByText("Retornos de proveedor").length, 1);
  assert.ok(Boolean(screen.queryByText("Recuperación física de efectivo")));
  assert.equal(screen.getByRole("link").getAttribute("href"), "/proveedores/7");
  assert.equal(JSON.stringify(breakdown), JSON.stringify(fixture.returnBreakdown()));
});