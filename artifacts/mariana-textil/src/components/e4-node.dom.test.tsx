import assert from "node:assert/strict";
import { test, beforeEach, afterEach } from "node:test";
import React from "react";
import { render, screen, fireEvent, cleanup, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Role } from "@workspace/api-client-react";
import { GetCurrentUserResponse, ObtenerSesionCajaActualResponse, ListarSalidasDineroCajaResponse,
  ListarProveedoresActivosCajaResponse, CrearSalidaDineroCajaBody, RevisarSalidaDineroCajaBody } from "@workspace/api-zod";
import { SalidaDineroE4Item } from "./salidas-dinero-e4-item";
import { SalidasDineroE4Panel } from "./salidas-dinero-e4-panel";
import CobrosPage, { SalidasDineroPanel } from "../pages/cobros";
import { hooks, state, setGate, captureCalls, reviewCalls, resetHarness, visits } from "./e4-node-test-harness";

let client: QueryClient;
const wire = (value: unknown) => JSON.parse(JSON.stringify(value));
function user(role = "ADMIN", view = true, create = true, cortes = false) {
  hooks.useGetCurrentUser = () => ({ data: GetCurrentUserResponse.parse({
    id: 10, nombre: "Operador fixture", usuario: "fixture", rol: role, alcanceConsulta: "PROPIA",
    ubicacion: { id: state.tienda, nombre: "Tienda fixture", iniciales: "CO", tipo: "TIENDA", activa: true, esSistema: false },
    permisos: [
      { modulo: "cobros_pagos", puedeVer: view, puedeCrear: create, puedeEditar: false, puedeAutorizar: false },
      { modulo: "cortes", puedeVer: cortes, puedeCrear: cortes, puedeEditar: false, puedeAutorizar: false },
    ],
  }) });
}
beforeEach(() => {
  resetHarness(); client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  user();
  hooks.useListarSalidasDineroCaja = () => ({ data: ListarSalidasDineroCajaResponse.parse({ salidas: [] }), isLoading: false });
  hooks.useListarProveedoresActivosCaja = () => ({ data: ListarProveedoresActivosCajaResponse.parse([{ id: 1, nombre: "Proveedor activo fixture" }]) });
  hooks.useObtenerSesionCajaActual = () => ({ data: wire(ObtenerSesionCajaActualResponse.parse({
    sesion: { id: 10, ubicacionId: state.tienda, nombreUbicacion: "Tienda fixture", usuarioId: 10,
      nombreUsuario: "Operador fixture", abiertaAt: new Date().toISOString(), cerradaAt: null,
      fondoInicial: "0.00", efectivoContado: null, estado: "ABIERTA" }, resumen: null,
  })), isLoading: false, isError: false });
});
afterEach(() => { cleanup(); client.clear(); });
function mount(node: React.ReactNode) {
  return render(<QueryClientProvider client={client}>{node}</QueryClientProvider>);
}
function item(role: string, estado = "PENDIENTE", tienda = 1, userTienda = 1) {
  const salida = wire(ListarSalidasDineroCajaResponse.parse({ salidas: [{
    id: 4, sesionCajaId: 10, creadoPorId: 10, monto: "100.00", motivo: "Gasto fixture",
    proveedorId: null, cuentaOrigen: "CAJA_FISICA", tipo: "EXTRAORDINARIA",
    claveOperacion: "11111111-1111-4111-8111-111111111111", createdAt: "2026-09-22T12:00:00Z",
    e4: { estado, tipo: "EXTRAORDINARIA", version: 2, historial: [],
      claveOperacion: "11111111-1111-4111-8111-111111111111", desbloqueoCaja: null },
  }] }).salidas[0]);
  return mount(<SalidaDineroE4Item salida={salida} sesionId={10} userRole={role} tiendaId={tienda} userUbicacionId={userTienda} />);
}
const panel = (canCreate = true, tiendaId = 1) => mount(<SalidasDineroE4Panel sesionId={10} canCreate={canCreate} tiendaId={tiendaId} />);
function fill(reason = "Limpieza") {
  fireEvent.change(screen.getByLabelText(/Monto/i), { target: { value: "150.50" } });
  fireEvent.change(screen.getByLabelText(/^Motivo$/i), { target: { value: reason } });
}
const submit = () => fireEvent.submit(screen.getByRole("form", { name: "Registrar salida de dinero" }));
function fail(calls: any[][]) {
  act(() => { calls.at(-1)![1].onError(new Error("synthetic transport failure")); calls.at(-1)![1].onSettled(); });
}
function response() {
  item(Role.SUPERVISOR, "RECLAMADA");
  fireEvent.click(screen.getByText("Responder"));
  fireEvent.change(screen.getByPlaceholderText(/Detalla el motivo/i), { target: { value: "Soporte fixture" } });
  return screen.getByRole("button", { name: /Confirmar responder/i });
}
function select(label: RegExp, option: string) {
  const trigger = screen.getByRole("combobox", { name: label });
  fireEvent.focus(trigger); fireEvent.keyDown(trigger, { key: "ArrowDown" });
  fireEvent.click(screen.getByRole("option", { name: option }));
}
test("E4-ADMIN", () => {
  item(Role.ADMIN);
  assert.ok(screen.queryByText("Aceptar"), "E4-ADMIN");
  assert.ok(screen.queryByText("Reclamar")); assert.equal(Boolean(screen.queryByText("Responder")), false);
  cleanup();
  const salida = {
    id: 4, monto: "150.00", motivo: "Emergencia fixture", cuentaOrigen: "CAJA_FISICA",
    createdAt: "2026-09-22T12:00:00Z",
    e4: {
      estado: "RECLAMADA", tipo: "EXTRAORDINARIA", version: 1,
      claveOperacion: "11111111-1111-4111-8111-111111111111",
      desbloqueoCaja: {
        motivo: "Urgencia autorizada", usuarioId: 99, createdAt: "2026-09-22T12:00:00Z",
        saldoAntes: "10.00", egreso: "150.00",
      },
      historial: [{
        accion: "RECLAMAR", version: 1, usuarioId: 20, createdAt: "2026-09-22T12:05:00Z",
        explicacion: "Revisar soporte", comprobanteUrl: null,
      }],
    },
  } as any;
  mount(<SalidaDineroE4Item salida={salida} sesionId={10} userRole={Role.ADMIN} tiendaId={1} userUbicacionId={1} />);
  assert.ok(screen.queryByText("Urgencia autorizada"));
  assert.ok(screen.queryByText(/Usuario #99/));
  fireEvent.click(screen.getByText("Ver historial completo"));
  assert.ok(screen.queryByText(/Usuario #20 · versión 1/));
});
test("E4-SUPERVISOR", () => {
  item(Role.SUPERVISOR, "RECLAMADA");
  assert.ok(screen.queryByText("Responder"), "E4-SUPERVISOR");
  assert.equal(Boolean(screen.queryByText("Aceptar")), false); assert.equal(Boolean(screen.queryByText("Reclamar")), false);
});
test("E4-OTHER-STORE", () => {
  item(Role.SUPERVISOR, "RECLAMADA", 3, 1);
  assert.equal(Boolean(screen.queryByText("Responder")), false, "E4-OTHER-STORE");
});
test("E4-CLAIM-REASON", () => {
  item(Role.ADMIN); fireEvent.click(screen.getByText("Reclamar"));
  fireEvent.click(screen.getByRole("button", { name: /Confirmar reclamar/i }));
  assert.equal(reviewCalls.length, 0, "E4-CLAIM-REASON");
  fireEvent.change(screen.getByPlaceholderText(/Detalla el motivo/i), { target: { value: "Falta comprobante original" } });
  fireEvent.click(screen.getByRole("button", { name: /Confirmar reclamar/i }));
  assert.equal(reviewCalls.length, 1);
  const payload = reviewCalls[0][0];
  RevisarSalidaDineroCajaBody.parse(payload.data);
  assert.equal(payload.salidaId, 4); assert.equal(payload.id, 10);
  assert.equal(payload.data.accion, "RECLAMAR"); assert.equal(payload.data.version, 2);
  assert.equal(payload.data.explicacion, "Falta comprobante original");
});
test("E4-CAPTURE-RETRY", async () => {
  panel(); fill("Gastos de limpieza"); submit();
  await waitFor(() => assert.equal(captureCalls.length, 1));
  assert.equal(captureCalls.length, 1);
  const first = captureCalls[0][0]; CrearSalidaDineroCajaBody.parse(first.data);
  assert.equal(first.id, 10);
  assert.deepEqual({ ...first.data, claveOperacion: undefined }, { monto: "150.50", motivo: "Gastos de limpieza",
    cuentaOrigen: "CAJA_FISICA", tipo: "EXTRAORDINARIA", proveedorId: null, claveOperacion: undefined });
  assert.match(first.data.claveOperacion, /^[0-9a-f-]{36}$/i);
  assert.equal(screen.getByRole("combobox", { name: /Cuenta de origen/i }).getAttribute("disabled"), "");
  fail(captureCalls); submit(); await waitFor(() => assert.equal(captureCalls.length, 2));
  assert.equal(captureCalls.length, 2);
  assert.equal(captureCalls[1][0].data.claveOperacion, first.data.claveOperacion, "E4-CAPTURE-RETRY");
  assert.deepEqual(captureCalls[1][0], first);
  cleanup(); captureCalls.length = 0; state.balance = "10.00"; panel(); fill();
  await act(async () => { submit(); await Promise.resolve(); await Promise.resolve(); });
  assert.equal(captureCalls.length, 0);
  fireEvent.change(screen.getByLabelText(/Motivo de desbloqueo extraordinario/i), {
    target: { value: "Urgencia operativa autorizada" },
  });
  submit(); await waitFor(() => assert.equal(captureCalls.length, 1));
  CrearSalidaDineroCajaBody.parse(captureCalls[0][0].data);
  assert.deepEqual(captureCalls[0][0].data.desbloqueoCaja, { motivo: "Urgencia operativa autorizada" });
});
test("E4-PROVIDER-REQUIRED", async () => {
  panel(); select(/Tipo de Salida/i, "Proveedor"); fill();
  await act(async () => { submit(); await Promise.resolve(); await Promise.resolve(); });
  assert.equal(captureCalls.length, 0, "E4-PROVIDER-REQUIRED");
  select(/^Proveedor$/i, "Proveedor activo fixture");
  state.balance = "10.00";
  await act(async () => { submit(); await Promise.resolve(); await Promise.resolve(); });
  assert.equal(captureCalls.length, 0);
  assert.equal(Boolean(screen.queryByLabelText(/Motivo de desbloqueo extraordinario/i)), false);
  state.balance = "1000.00"; submit();
  await waitFor(() => assert.equal(captureCalls.length, 1));
  assert.equal(captureCalls.length, 1);
  CrearSalidaDineroCajaBody.parse(captureCalls[0][0].data);
  assert.equal(captureCalls[0][0].data.tipo, "PROVEEDOR");
  assert.equal(captureCalls[0][0].data.proveedorId, 1);
});
test("E4-GATE-OFF", () => {
  setGate(false); mount(<SalidasDineroPanel sesionId={10} canCreate tiendaId={1} />);
  assert.equal(Boolean(screen.queryByRole("form")), false, "E4-GATE-OFF");
  assert.equal(Boolean(screen.queryByRole("combobox", { name: /Tipo de Salida/i })), false);
  assert.equal(visits.includes("useRevisarSalidaDineroCaja"), false);
});
test("E4-CAPTURE-DOUBLE", async () => {
  panel(); fill();
  await act(async () => { submit(); submit(); await Promise.resolve(); await Promise.resolve(); });
  assert.equal(captureCalls.length, 1, "E4-CAPTURE-DOUBLE");
});
test("E4-CAPTURE-CONTENT", async () => {
  panel(); fill(); submit(); await waitFor(() => assert.equal(captureCalls.length, 1));
  const first = captureCalls[0][0].data.claveOperacion;
  fail(captureCalls); fill("Otro gasto"); submit(); await waitFor(() => assert.equal(captureCalls.length, 2));
  assert.notEqual(captureCalls[1][0].data.claveOperacion, first, "E4-CAPTURE-CONTENT");
});
test("E4-CAPTURE-PERMISSION", async () => {
  panel(false); assert.equal(Boolean(screen.queryByRole("form")), false, "E4-CAPTURE-PERMISSION");
  cleanup(); state.balance = "10.00"; user(Role.CAJA); panel(); fill();
  await act(async () => { submit(); await Promise.resolve(); await Promise.resolve(); });
  assert.equal(captureCalls.length, 0);
});
test("E4-PROVIDER-LOCATION", () => {
  panel(true, 2);
  const trigger = screen.getByRole("combobox", { name: /Tipo de Salida/i });
  fireEvent.focus(trigger); fireEvent.keyDown(trigger, { key: "ArrowDown" });
  assert.equal(Boolean(screen.queryByRole("option", { name: "Proveedor" })), false, "E4-PROVIDER-LOCATION");
});
test("E4-REVIEW-DOUBLE", () => {
  const button = response(); act(() => { fireEvent.click(button); fireEvent.click(button); });
  assert.equal(reviewCalls.length, 1, "E4-REVIEW-DOUBLE");
});
test("E4-REVIEW-RETRY", () => {
  const button = response(); fireEvent.click(button);
  const first = reviewCalls[0][0]; RevisarSalidaDineroCajaBody.parse(first.data);
  assert.equal(first.data.accion, "RESPONDER"); assert.equal(first.data.version, 2);
  assert.equal(first.data.explicacion, "Soporte fixture");
  fail(reviewCalls); fireEvent.click(button);
  assert.deepEqual(reviewCalls[1][0], first, "E4-REVIEW-RETRY");
});
test("E4-REVIEW-CONTENT", () => {
  const button = response(); fireEvent.click(button); const first = reviewCalls[0][0].data.claveOperacion;
  fail(reviewCalls);
  fireEvent.change(screen.getByPlaceholderText(/Detalla el motivo/i), { target: { value: "Soporte corregido" } });
  fireEvent.click(button);
  assert.notEqual(reviewCalls[1][0].data.claveOperacion, first, "E4-REVIEW-CONTENT");
});
test("E4-CAJA-NO-REVIEW", () => {
  item(Role.CAJA); assert.equal(Boolean(screen.queryByText("Aceptar")), false, "E4-CAJA-NO-REVIEW");
  assert.equal(Boolean(screen.queryByText("Reclamar")), false); assert.equal(Boolean(screen.queryByText("Responder")), false);
});
test("E4-PARENT-COCO", () => {
  state.tienda = 2; user("CAJA"); mount(<CobrosPage />);
  assert.ok(screen.queryByRole("button", { name: /Registrar salida extraordinaria/i }), "E4-PARENT-COCO");
  assert.ok(screen.queryByText("Caja Operativa"));
  cleanup(); state.tienda = 1; user("CAJA"); mount(<CobrosPage />);
  assert.ok(screen.queryByRole("button", { name: /Registrar salida extraordinaria/i }), "E4-PARENT-MARIANA");
});
test("E4-PARENT-CRUCES", () => {
  state.tienda = 3; user("SUPERVISOR"); mount(<CobrosPage />);
  assert.ok(screen.queryByRole("button", { name: /Registrar salida extraordinaria/i }), "E4-PARENT-CRUCES");
});
test("E4-PARENT-VIEW", () => {
  state.tienda = 2; user("CAJA", false, true, true); mount(<CobrosPage />);
  assert.equal(Boolean(screen.queryByText("Salidas de dinero")), false, "E4-PARENT-VIEW");
});
test("E4-PARENT-CREATE", () => {
  state.tienda = 2; user("CAJA", true, false, true); mount(<CobrosPage />);
  assert.equal(Boolean(screen.queryByRole("form", { name: "Registrar salida de dinero" })), false, "E4-PARENT-CREATE");
  assert.ok(screen.queryByText("Salidas de dinero"));
});
test("E4-PARENT-OFF-COCO", () => {
  setGate(false); state.tienda = 2; user("CAJA", true, true, true); mount(<CobrosPage />);
  assert.equal(Boolean(screen.queryByTestId("e4-disabled")), false, "E4-PARENT-OFF-COCO");
});
test("E4-PARENT-OFF-MARIANA", () => {
  setGate(false); user("CAJA", true, true, true); mount(<CobrosPage />);
  assert.equal(Boolean(screen.queryByText("Salidas de dinero")), false, "E4-PARENT-OFF-MARIANA");
  assert.equal(Boolean(screen.queryByRole("combobox", { name: /Tipo de Salida/i })), false);
  assert.ok(screen.queryByTestId("e4-disabled"));
});