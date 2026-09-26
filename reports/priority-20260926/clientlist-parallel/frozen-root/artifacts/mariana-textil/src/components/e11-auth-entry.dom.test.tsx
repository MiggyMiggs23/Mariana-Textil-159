import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Router, useLocation } from "wouter";
import { E11ApplicationBoundary } from "../pages/e11";
import Login from "../pages/login";
import * as t from "./e11-node-test-transport";
import { getGetCurrentUserQueryKey } from "@workspace/api-client-react";

// Mounted component regression tests with an offline transport, NOT end-to-end.
let client: QueryClient;
let protectedMounts = 0;
beforeEach(() => {
  t.reset();
  protectedMounts = 0;
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
});
afterEach(() => { cleanup(); client.clear(); });
function ProtectedSource() {
  protectedMounts++;
  return <p>Protected source mounted</p>;
}
function Routes() {
  const [path] = useLocation();
  return path === "/login" ? <Login /> : <ProtectedSource />;
}
function mount(path: string) {
  window.history.replaceState(null, "", path);
  return render(<QueryClientProvider client={client}><Router><E11ApplicationBoundary><Routes /></E11ApplicationBoundary></Router></QueryClientProvider>);
}
function reject(error: Error) {
  t.routes.set("GET /api/auth/me", () => { throw error; });
}
const unauthorized = () => Object.assign(new Error("Debes iniciar sesión"), { status: 401 });
async function settled() {
  await waitFor(() => assert.equal(client.getQueryState(getGetCurrentUserQueryKey())?.status, "error"));
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 30)); });
}
for (const path of ["/", "/clientes/21"]) {
  test(`auth 401 redirects ${path} to public login without mounting protected children`, async () => {
    reject(unauthorized()); mount(path);
    await waitFor(() => assert.equal(window.location.pathname, "/login"));
    assert.equal(new URLSearchParams(window.location.search).get("returnTo"), path);
    assert.ok(await screen.findByLabelText("Contraseña"));
    assert.equal(protectedMounts, 0);
    assert.ok(t.requests.every(r => r.path === "/api/auth/me"));
  });
}
test("public login passes through the boundary on 401", async () => {
  reject(unauthorized()); mount("/login?returnTo=%2Fclientes%2F21");
  assert.ok(await screen.findByLabelText("Contraseña"));
  await settled();
  assert.equal(window.location.search, "?returnTo=%2Fclientes%2F21");
  assert.equal(protectedMounts, 0);
});
for (const error of [
  Object.assign(new Error("Acceso denegado"), { status: 403 }),
  Object.assign(new Error("Servidor no disponible"), { status: 500 }),
  new TypeError("Network unavailable; 401 is only text"),
]) {
  test(`${error.message}: fail closed, preserve error and offer retry`, async () => {
    reject(error); mount("/clientes/21"); await settled();
    assert.equal(window.location.pathname, "/clientes/21");
    assert.equal(protectedMounts, 0);
    assert.ok(document.body.textContent?.includes(error.message));
    const count = t.requests.length;
    fireEvent.click(screen.getByRole("button", { name: "Reintentar sesión" }));
    await waitFor(() => assert.ok(t.requests.length > count));
    assert.equal(protectedMounts, 0);
    assert.ok(t.requests.every(r => r.path === "/api/auth/me"));
  });
}
test("expired session with cached user unmounts protected content and redirects", async () => {
  t.respond("/api/auth/me", t.user("CAJA")); mount("/clientes/21");
  await screen.findByText("Protected source mounted");
  reject(unauthorized());
  await act(async () => { await client.invalidateQueries({ queryKey: getGetCurrentUserQueryKey() }); });
  await waitFor(() => assert.equal(window.location.pathname, "/login"));
  await settled();
  assert.equal(window.location.pathname, "/login");
  assert.ok(screen.getByLabelText("Contraseña"));
  assert.equal(screen.queryByText("Protected source mounted"), null);
});
test("gate off preserves passthrough without auth requests", async () => {
  t.gates(false); mount("/");
  assert.ok(screen.getByText("Protected source mounted"));
  assert.equal(t.requests.length, 0);
});