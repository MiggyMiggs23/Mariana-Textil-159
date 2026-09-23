import assert from "node:assert/strict";
import { test, beforeEach, afterEach } from "node:test";
import React from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as schema from "@workspace/api-zod";
import { E9EnvioPanel } from "./e9-envio-panel";
import { E9EntregasPanel } from "./e9-entregas-panel";
import CajaCortes from "../pages/caja/cortes";
import CorteDetail from "../pages/corte-detail-shared";
import * as f from "./e9-node-test-fixtures";
import { state, resetHarness, setGate, visits, mutationCalls, succeed, fail } from "./e9-node-test-harness";

const SEND = "useCreateE9Entrega", COUNT = "useCreateE9Conteo";
const AUTH = "useAuthorizeE9Recepcion", CLOSE = "useCloseE9Investigacion";
const DETAIL = "useGetE9Entrega", CUT = "useObtenerCorteCaja";
let client: QueryClient;
beforeEach(() => {
  resetHarness();
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false } } });
  window.history.replaceState(null, "", "/caja/cortes");
});
afterEach(() => { cleanup(); client.clear(); });
const wrapped = (node: React.ReactNode) => <QueryClientProvider client={client}>{node}</QueryClientProvider>;
const mount = (node: React.ReactNode) => render(wrapped(node));
const sendNode = () => <E9EnvioPanel corteId={f.CUT} ubicacionId={f.SITE} />;
const listNode = () => <E9EntregasPanel ubicacionId={f.SITE} />;
const change = (id: string, value: string) => fireEvent.change(screen.getByTestId(id), { target: { value } });
const click = async (element: HTMLElement) => { await act(async () => { fireEvent.click(element); }); };
const confirm = () => click(screen.getByTestId("button-e9-confirmar"));
const sendConfirm = () => click(screen.getByTestId("button-e9-confirmar-envio"));
const last = (name: string) => mutationCalls(name).at(-1)!;
const absent = (id: string) => Boolean(screen.queryByTestId(id)) === false;
async function reject(name: string) { await act(async () => { fail(last(name), "E9_STATE_CONFLICT"); }); }
async function timeout(name: string) { await act(async () => { fail(last(name), "E9_STATE_CONFLICT", true); }); }
async function settle(name: string, response: unknown) { await act(async () => { succeed(last(name), response); }); }
async function sending() {
  const view = mount(sendNode());
  await click(screen.getByTestId("button-e9-envio"));
  change("input-e9-evidencia", "  Acta envío  ");
  change("input-e9-referencias", "  REF-1 \n\nREF-2 ");
  return view;
}
async function detail() {
  const view = mount(listNode());
  await click(screen.getByTestId(`button-e9-detalle-${f.DELIVERY}`));
  return view;
}
type Action = "conteo" | "autorizar" | "cierre";
const hook = (action: Action) => action === "conteo" ? COUNT : action === "autorizar" ? AUTH : CLOSE;
async function actionForm(action: Action) {
  state.detail = f.delivery({ stage: "CONTADA" });
  const view = await detail();
  await click(screen.getByTestId(`button-e9-${action}`));
  if (action === "conteo") change("input-e9-recibido", "140.25");
  else change("input-e9-motivo", "Conclusión o autorización documentada");
  if (action !== "autorizar") change("input-e9-evidencia", "Acta física");
  return view;
}
async function doubleClick(id: string) {
  const button = screen.getByTestId(id);
  // One outer act: both native clicks precede React's pending/disabled render.
  await act(async () => { button.click(); button.click(); });
}
async function retryAction(action: Action, id: string) {
  await actionForm(action); await confirm();
  const first = last(hook(action)).variables.data.claveOperacion;
  await timeout(hook(action));
  change(action === "conteo" ? "input-e9-recibido" : "input-e9-motivo",
    action === "conteo" ? " 00140.25 " : "  Conclusión o autorización documentada  ");
  await confirm();
  assert.equal(last(hook(action)).variables.data.claveOperacion, first, id);
  assert.equal(mutationCalls(hook(action)).length, 2, id);
}
async function changedAction(action: Action, id: string) {
  await actionForm(action); await confirm();
  const first = last(hook(action)).variables.data.claveOperacion;
  await reject(hook(action));
  change(action === "conteo" ? "input-e9-recibido" : "input-e9-motivo", action === "conteo" ? "141.25" : "Otra conclusión o motivo");
  await confirm();
  assert.notEqual(last(hook(action)).variables.data.claveOperacion, first, id);
}

test("E9-OFF-SEND", t => {
  setGate(false); mount(sendNode());
  assert.equal(visits.length, 0, t.name); assert.equal(absent("e9-envio-panel"), true, t.name);
});
test("E9-OFF-LIST", t => {
  setGate(false); mount(listNode());
  assert.equal(visits.length, 0, t.name); assert.equal(absent("e9-entregas-panel"), true, t.name);
});
test("E9-PARENT-LIST", t => {
  state.users = schema.ListUsersResponse.parse([]);
  mount(<CajaCortes />);
  assert.equal(Boolean(screen.queryByTestId("e9-entregas-panel")), true, t.name);
  assert.equal(visits.some(v => v.name === "useGetE9Disponibilidad" && v.args[0].ubicacionId === f.SITE), true, t.name);
});
test("E9-PARENT-CLOSED-EXACT", t => {
  mount(<CorteDetail corte={state.cut} />);
  assert.equal(Boolean(screen.queryByTestId("e9-envio-panel")), true, t.name);
  assert.equal(visits.some(v => v.name === CUT && v.args[0] === f.CUT && v.enabled), true, t.name);
  cleanup(); state.cut.sesion.estado = "ABIERTA"; mount(<CorteDetail corte={state.cut} />);
  assert.equal(absent("e9-envio-panel"), true, t.name);
});
test("E9-SEND-ROLE", t => {
  state.user = f.currentUser("CAJA"); mount(sendNode());
  assert.equal(absent("e9-envio-panel"), true, t.name);
});
test("E9-SEND-SCOPE", t => {
  state.user = f.currentUser("SUPERVISOR"); state.user.ubicacion.id = 3; mount(sendNode());
  assert.equal(absent("e9-envio-panel"), true, t.name);
});
test("E9-SEND-CAPABILITY", t => {
  state.availability.capacidades.puedeEnviar = false; mount(sendNode());
  assert.equal(absent("button-e9-envio"), true, t.name);
  assert.equal(visits.some(v => v.name === CUT && v.enabled), false, t.name);
});
test("E9-SEND-CLOSED", t => {
  state.cut.sesion.estado = "ABIERTA"; mount(sendNode());
  assert.equal(absent("button-e9-envio"), true, t.name);
});
test("E9-SEND-VERSION", t => {
  delete state.cut.versionCorte; mount(sendNode());
  assert.equal(absent("button-e9-envio"), true, t.name);
  assert.equal(Boolean(screen.queryByText(/falta evidencia canónica congelada/)), true, t.name);
});
test("E9-SEND-CUT-IDENTITY", t => {
  state.cut.sesion.id = f.CUT + 1; mount(sendNode());
  assert.equal(absent("button-e9-envio"), true, t.name);
});
test("E9-SEND-POSITIVE", t => {
  state.cut.efectivoContado = "0.00"; mount(sendNode());
  assert.equal(absent("button-e9-envio"), true, t.name);
});
test("E9-SEND-PHYSICAL", async t => {
  state.user = f.currentUser("SUPERVISOR");
  await sending();
  assert.equal(screen.getByTestId("text-e9-total-envio").textContent?.includes(f.SENT), true, t.name);
  assert.equal(Boolean(screen.queryByTestId("input-e9-recibido")), false, t.name);
  await sendConfirm();
  const body = last(SEND).variables.data;
  assert.deepEqual(Object.keys(body).sort(), ["claveOperacion", "corteId", "evidencia", "versionCorte"], t.name);
  assert.equal(body.corteId, f.CUT, t.name); assert.equal(body.versionCorte, f.FROZEN_VERSION, t.name);
  assert.deepEqual(body.evidencia, { descripcion: "Acta envío", referencias: ["REF-1", "REF-2"] }, t.name);
  schema.CreateE9EntregaBody.parse(body);
});
test("E9-SEND-RECHECK-VERSION", async t => {
  await sending();
  state.refetchHandlers = { [CUT]: async () => ({ data: { ...state.cut, versionCorte: "changed-server-token" } }) };
  await sendConfirm();
  assert.equal(mutationCalls(SEND).length, 0, t.name);
});
test("E9-SEND-RECHECK-CLOSED", async t => {
  await sending();
  state.refetchHandlers = { [CUT]: async () => ({ data: { ...state.cut, sesion: { ...state.cut.sesion, estado: "ABIERTA" } } }) };
  await sendConfirm();
  assert.equal(mutationCalls(SEND).length, 0, t.name);
});
test("E9-SEND-RESPONSE-VERSION", async t => {
  await sending(); await sendConfirm();
  await settle(SEND, { ...f.sentResponse(), versionCorte: "wrong-server-version" });
  assert.equal(Boolean(screen.queryByText(/Envío registrado/)), false, t.name);
  assert.equal(Boolean(screen.queryByRole("alert")), true, t.name);
});
test("E9-SEND-RETRY", async t => {
  await sending(); await sendConfirm(); const key = last(SEND).variables.data.claveOperacion;
  await timeout(SEND); change("input-e9-evidencia", "Acta envío"); await sendConfirm();
  assert.equal(last(SEND).variables.data.claveOperacion, key, t.name);
});
test("E9-SEND-CONTENT", async t => {
  await sending(); await sendConfirm(); const key = last(SEND).variables.data.claveOperacion;
  await reject(SEND); change("input-e9-evidencia", "Otra acta"); await sendConfirm();
  assert.notEqual(last(SEND).variables.data.claveOperacion, key, t.name);
});
test("E9-SEND-DOUBLE", async t => {
  await sending(); await doubleClick("button-e9-confirmar-envio");
  assert.equal(mutationCalls(SEND).length, 1, t.name);
});
test("E9-LIST-AVAILABILITY-SITE", t => {
  state.availability.ubicacionId = 3; mount(listNode());
  assert.equal(visits.some(v => v.name === "useListE9Entregas" && v.enabled), false, t.name);
});
test("E9-LIST-PRIVACY", t => {
  state.deliveries.items.push({ ...f.delivery(), id: f.OLD_COUNT, ubicacionId: 3, ubicacionNombre: "TIENDA AJENA PRIVADA" });
  mount(listNode());
  assert.equal(Boolean(screen.queryByText(/TIENDA AJENA PRIVADA/)), false, t.name);
});
test("E9-LIST-PAGINATION", async t => {
  state.deliveries.nextCursor = "opaque-page-two"; mount(listNode());
  await click(screen.getByRole("button", { name: "Siguiente" }));
  assert.equal(visits.filter(v => v.name === "useListE9Entregas").at(-1)?.args[0].cursor, "opaque-page-two", t.name);
  await click(screen.getByRole("button", { name: "Anterior" }));
  assert.equal(visits.filter(v => v.name === "useListE9Entregas").at(-1)?.args[0].cursor, undefined, t.name);
});
test("E9-DETAIL-SCOPE", async t => {
  state.detail = { ...f.delivery(), ubicacionId: 3, ubicacionNombre: "DETALLE AJENO PRIVADO" };
  await detail();
  assert.equal(Boolean(screen.queryByText(/DETALLE AJENO PRIVADO/)), false, t.name);
});
test("E9-DETAIL-FONDO", async t => {
  state.user = f.currentUser("SUPERVISOR");
  state.detail = f.delivery({ stage: "AUTORIZADA" }); // Intentionally cached ADMIN transport.
  await detail();
  assert.equal(absent("link-e9-fondo"), true, t.name);
  assert.equal(document.body.innerHTML.includes(f.FUND_ENTRY), false, t.name);
});
test("E9-DETAIL-ROLE", async t => {
  state.user = f.currentUser("SUPERVISOR"); state.detail = f.delivery({ stage: "CONTADA" });
  await detail();
  assert.equal(["conteo", "autorizar", "cierre"].every(a => absent(`button-e9-${a}`)), true, t.name);
});
test("E9-DETAIL-CAPABILITY", async t => {
  state.detail.capacidades = f.capabilities("CAJA"); await detail();
  assert.equal(absent("button-e9-conteo"), true, t.name);
});
test("E9-DETAIL-ZERO", async t => {
  state.detail = f.delivery({ stage: "CONTADA", received: "0.00" });
  state.detail.capacidades.puedeAutorizar = true; await detail();
  assert.equal(absent("button-e9-autorizar"), true, t.name);
  assert.equal(Boolean(screen.queryByText(/Conteo cero: recepción pendiente/)), true, t.name);
});
test("E9-COUNT-ZERO", async t => {
  await actionForm("conteo"); change("input-e9-recibido", "0"); await confirm();
  assert.equal(mutationCalls(COUNT).length, 1, t.name);
  assert.equal(last(COUNT).variables.data.importeRecibido, "0.00", t.name);
  schema.CreateE9ConteoBody.parse(last(COUNT).variables.data);
  assert.equal(mutationCalls(AUTH).length, 0, t.name);
  await settle(COUNT, f.countResponse("0.00"));
  assert.equal(Boolean(screen.queryByText(/Conteo cero: recepción pendiente/)), true, t.name);
});
test("E9-COUNT-DECIMAL", async t => {
  await actionForm("conteo"); change("input-e9-recibido", "0001.2"); await confirm();
  assert.equal(last(COUNT).variables.data.importeRecibido, "1.20", t.name);
  schema.CreateE9ConteoBody.parse(last(COUNT).variables.data);
});
test("E9-COUNT-PRECISION", async t => {
  await actionForm("conteo"); change("input-e9-recibido", "1.001"); await confirm();
  assert.equal(mutationCalls(COUNT).length, 0, t.name);
});
test("E9-COUNT-HISTORY", async t => {
  state.detail = f.delivery({ stage: "CONTADA", history: true }); await detail();
  assert.equal(Boolean(screen.queryByText("Conteo anterior conservado")), true, t.name);
  assert.equal(Boolean(screen.queryByText("Recibido 149.00 · Diferencia -1.50")), true, t.name);
});
test("E9-AUTH-REASON", async t => {
  await actionForm("autorizar"); change("input-e9-motivo", ""); await confirm();
  assert.equal(mutationCalls(AUTH).length, 0, t.name);
});
test("E9-AUTH-CAS", async t => {
  await actionForm("autorizar");
  state.refetchHandlers = { [DETAIL]: async () => ({ data: { ...state.detail, conteoVigenteId: f.OLD_COUNT } }) };
  await confirm(); assert.equal(mutationCalls(AUTH).length, 0, t.name);
});
test("E9-AUTH-POSITIVE", async t => {
  await actionForm("autorizar"); await confirm();
  assert.equal(last(AUTH).variables.data.conteoId, f.COUNT, t.name);
  assert.deepEqual(Object.keys(last(AUTH).variables.data).sort(), ["claveOperacion", "conteoId", "motivo"], t.name);
  schema.AuthorizeE9RecepcionBody.parse(last(AUTH).variables.data);
  assert.equal(visits.some(v => /SesionActual|AbrirSesion/.test(v.name)), false, t.name);
});
test("E9-CLOSE-EVIDENCE", async t => {
  await actionForm("cierre"); change("input-e9-evidencia", ""); await confirm();
  assert.equal(mutationCalls(CLOSE).length, 0, t.name);
});
test("E9-CLOSE-CONCLUSION", async t => {
  await actionForm("cierre"); change("input-e9-motivo", ""); await confirm();
  assert.equal(mutationCalls(CLOSE).length, 0, t.name);
});
test("E9-CLOSE-PRESERVE", async t => {
  state.detail = f.closedResponse(); await detail();
  assert.equal(Boolean(screen.queryByText("Recibido vigente: 140.25 · Diferencia: -10.25")), true, t.name);
  assert.equal(Boolean(screen.queryByText("Investigación: CERRADA_DOCUMENTAL")), true, t.name);
  assert.equal(Boolean(screen.queryByText("Conteo anterior conservado")), true, t.name);
});
test("E9-COUNT-RETRY", async t => { await retryAction("conteo", t.name); });
test("E9-AUTH-RETRY", async t => { await retryAction("autorizar", t.name); });
test("E9-CLOSE-RETRY", async t => { await retryAction("cierre", t.name); });
test("E9-COUNT-CONTENT", async t => { await changedAction("conteo", t.name); });
test("E9-AUTH-CONTENT", async t => { await changedAction("autorizar", t.name); });
test("E9-CLOSE-CONTENT", async t => { await changedAction("cierre", t.name); });
test("E9-COUNT-DOUBLE", async t => {
  await actionForm("conteo"); await doubleClick("button-e9-confirmar");
  assert.equal(mutationCalls(COUNT).length, 1, t.name);
});
test("E9-AUTH-DOUBLE", async t => {
  await actionForm("autorizar"); await doubleClick("button-e9-confirmar");
  assert.equal(mutationCalls(AUTH).length, 1, t.name);
});
test("E9-CLOSE-DOUBLE", async t => {
  await actionForm("cierre"); await doubleClick("button-e9-confirmar");
  assert.equal(mutationCalls(CLOSE).length, 1, t.name);
});
test("E9-DETAIL-IDENTITY", async t => {
  const view = await actionForm("conteo");
  const oldKey = visits.filter(v => v.name === DETAIL).at(-1)!.args[1].query.queryKey;
  client.setQueryData(oldKey, state.detail);
  let resolve!: (value: any) => void;
  state.refetchHandlers = { [DETAIL]: () => new Promise(done => { resolve = done; }) };
  await confirm();
  state.user = f.currentUser("ADMIN", 11);
  view.rerender(wrapped(listNode()));
  await act(async () => { resolve({ data: state.detail }); });
  assert.equal(mutationCalls(COUNT).length, 0, t.name);
  assert.equal(client.getQueryState(oldKey)?.isInvalidated, true, t.name);
});
test("E9-AUTH-INVALIDATION", async t => {
  for (const url of ["/api/fondo/movimientos", "/api/e9/entregas", "/api/admin/cortes"]) client.setQueryData([url], {});
  await actionForm("autorizar"); await confirm(); await settle(AUTH, f.authorizedResponse());
  assert.equal(client.getQueryState(["/api/fondo/movimientos"])?.isInvalidated, true, t.name);
  assert.equal(client.getQueryState(["/api/e9/entregas"])?.isInvalidated, true, t.name);
  assert.equal(client.getQueryState(["/api/admin/cortes"])?.isInvalidated, true, t.name);
});
test("E9-DETAIL-ERROR-NESTED", async t => {
  await actionForm("conteo"); await confirm(); await reject(COUNT);
  assert.equal(screen.getByRole("alert").textContent?.startsWith("E9_STATE_CONFLICT:"), true, t.name);
});
test("E9-DETAIL-RESPONSE-SCOPE", async t => {
  await actionForm("conteo"); await confirm();
  await settle(COUNT, { ...f.countResponse(), ubicacionId: 3 });
  assert.equal(Boolean(screen.queryByText("Conteo registrado como nueva evidencia.")), false, t.name);
});
test("E9-DETAIL-EXACT-NAVIGATION", async t => {
  await detail();
  const href = screen.getByRole("link", { name: "Ver corte exacto" }).getAttribute("href");
  assert.equal(href, `/caja/cortes?sesionId=${f.CUT}`, t.name);
  cleanup(); window.history.replaceState(null, "", href!); state.users = schema.ListUsersResponse.parse([]);
  mount(<CajaCortes />);
  assert.equal(visits.some(v => v.name === "useGetAdminCorte" && v.args[0] === f.CUT && v.enabled), true, t.name);
  assert.equal(visits.some(v => v.name === CUT && v.args[0] === f.CUT && v.enabled), true, t.name);
});
test("E9-AUTH-POSITIVE-DISCREPANCY", async t => {
  state.detail = f.delivery({ stage: "CONTADA", received: "160.75" }); await detail();
  await click(screen.getByTestId("button-e9-autorizar")); await confirm();
  assert.equal(mutationCalls(AUTH).length, 0, t.name);
});
test("E9-COUNT-ALREADY-AUTHORIZED", async t => {
  await actionForm("conteo");
  state.refetchHandlers = { [DETAIL]: async () => ({ data: {
    ...state.detail, estado: "AUTORIZADA", capacidades: { ...state.detail.capacidades, puedeContar: true },
  } }) };
  await confirm(); assert.equal(mutationCalls(COUNT).length, 0, t.name);
});
test("E9-CLOSE-ALREADY-CLOSED", async t => {
  await actionForm("cierre");
  state.refetchHandlers = { [DETAIL]: async () => ({ data: {
    ...state.detail, investigacion: { ...state.detail.investigacion, estado: "CERRADA_DOCUMENTAL" },
  } }) };
  await confirm(); assert.equal(mutationCalls(CLOSE).length, 0, t.name);
});
test("E9-AUTH-RESPONSE-FINAL", async t => {
  await actionForm("autorizar"); await confirm(); await settle(AUTH, f.authorizedResponse());
  assert.equal(Boolean(screen.queryByText("Enviado: 150.50 · Recepción: AUTORIZADA")), true, t.name);
  assert.equal(Boolean(screen.queryByText("Investigación: ABIERTA")), true, t.name);
  assert.equal(screen.getByTestId("link-e9-fondo").getAttribute("href"), `/fondo/movimientos/${f.FUND_ENTRY}`, t.name);
  assert.equal(absent("button-e9-autorizar") && absent("button-e9-conteo"), true, t.name);
});
test("E9-CLOSE-RESPONSE", async t => {
  await actionForm("cierre"); await confirm();
  const body = last(CLOSE).variables.data;
  assert.deepEqual(Object.keys(body).sort(), ["claveOperacion", "conclusion", "evidencia"], t.name);
  schema.CloseE9InvestigacionBody.parse(body);
  await settle(CLOSE, f.closedResponse());
  assert.equal(Boolean(screen.queryByText("Investigación: CERRADA_DOCUMENTAL")), true, t.name);
  assert.equal(Boolean(screen.queryByText("Recibido vigente: 140.25 · Diferencia: -10.25")), true, t.name);
});
test("E9-SEND-IDENTITY", async t => {
  const view = await sending();
  let resolve!: (value: any) => void;
  state.refetchHandlers = { useGetE9Disponibilidad: () => new Promise(done => { resolve = done; }) };
  await sendConfirm(); state.user = f.currentUser("ADMIN", 11);
  view.rerender(wrapped(sendNode()));
  await act(async () => { resolve({ data: state.availability }); });
  assert.equal(mutationCalls(SEND).length, 0, t.name);
});
test("E9-SEND-REFRESH-CAPABILITY", async t => {
  await sending();
  state.refetchHandlers = { useGetE9Disponibilidad: async () => ({ data: f.availability("CAJA") }) };
  await sendConfirm(); assert.equal(mutationCalls(SEND).length, 0, t.name);
});
test("E9-LIST-PERMISSION", t => {
  state.user = f.currentUser("CAJA", 10, false); mount(listNode());
  assert.equal(absent("e9-entregas-panel"), true, t.name);
  assert.equal(visits.some(v => v.name.startsWith("useGetE9")), false, t.name);
});
test("E9-DETAIL-QUERY-ERROR", async t => {
  state.detail = f.authorizedResponse();
  state.queryErrors = { [DETAIL]: { status: 404, data: { error: { code: "E9_NOT_FOUND", message: "No encontrada" } } } };
  await detail();
  assert.equal(absent("link-e9-fondo"), true, t.name);
  assert.equal(Boolean(screen.queryByText("Enviado: 150.50 · Recepción: AUTORIZADA")), false, t.name);
});