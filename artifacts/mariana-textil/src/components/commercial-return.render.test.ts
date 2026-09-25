import assert from "node:assert/strict";
import { after, test } from "node:test";
import { createRequire } from "node:module";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { loadRenderTestModule } from "../render-test-bundle";

// Synthetic, finite transport. Actual component/client/schema; only the CLOSED
// UI constant is changed in a disposable test module, never application files.
const require = createRequire(import.meta.url);
const { JSDOM } = require("jsdom");
const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/tickets/10", pretendToBeVisual: true });
for (const key of ["window", "document", "navigator", "location", "history", "HTMLElement", "HTMLInputElement", "HTMLButtonElement",
  "Element", "Node", "Document", "DocumentFragment", "MutationObserver", "Event", "MouseEvent", "CustomEvent",
  "HTMLFormElement", "HTMLSelectElement", "SVGElement", "NodeFilter", "sessionStorage"]) {
  Object.defineProperty(globalThis, key, { configurable: true, value: dom.window[key], writable: true });
}
for (const key of ["getComputedStyle", "requestAnimationFrame", "cancelAnimationFrame", "addEventListener", "removeEventListener", "dispatchEvent"]) {
  Object.defineProperty(globalThis, key, { configurable: true, value: dom.window[key].bind(dom.window), writable: true });
}
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const React = await import("react");
const { renderToStaticMarkup } = await import("react-dom/server");
const { act, render, cleanup, fireEvent, waitFor } = await import("@testing-library/react");
const { QueryClient, QueryClientProvider } = await import("@tanstack/react-query");
const entry = `export { CommercialReturnAction } from ${JSON.stringify(new URL("./commercial-return-dialog.tsx", import.meta.url).pathname)};`;
const closed = await loadRenderTestModule(entry);
const temp = await mkdtemp(new URL("../../.commercial-return-test-", import.meta.url).pathname);
const actualClient = await readFile(new URL("../lib/commercial-return.ts", import.meta.url), "utf8");
assert.ok(actualClient.includes("COMMERCIAL_RETURN_UI_ENABLED = false"));
await writeFile(join(temp, "client.ts"), actualClient.replace("COMMERCIAL_RETURN_UI_ENABLED = false", "COMMERCIAL_RETURN_UI_ENABLED = true"));
const enabled = await loadRenderTestModule(entry, { moduleAliases: { "@/lib/commercial-return": join(temp, "client.ts") } });
await rm(temp, { recursive: true, force: true });
const ticket = { id: 10, folio: "TEST-N10", ubicacionId: 2, documentoTipo: "NOTA", estado: "VENDIDO", autorizacionEstado: "AUTORIZADA",
  lineas: [{ id: 11, rolloId: 20, tipo: "NORMAL", cantidad: "10.000", serieRollo: "TEST-SERIE20", telaProducto: "TEST", colorProducto: "TEST", unidadProducto: "BOLSAS" }] };
const quote = { ticketId: 10, lineaId: 11, serie: "TEST-SERIE20", cantidad: "10.000", ubicacionRecepcionId: 2, sesionCajaId: 5,
  importeRollo: "1000.00", deudaCancelada: "200.00", efectivoDevuelto: "800.00" };
const receipt = { ...quote, id: "04d6016c-7171-46d1-b03d-bddfe9399ff4", rolloId: 20, motivo: "TEST devolución íntegra", createdAt: "2026-09-25T12:00:00.000Z" };
const originalFetch = globalThis.fetch;
after(() => { cleanup(); globalThis.fetch = originalFetch; dom.window.close(); });
const text = () => document.body.textContent ?? "";
function button(label: string) {
  const found = [...document.querySelectorAll("button")].find(node => node.textContent?.trim() === label);
  assert.ok(found, label); return found;
}
async function click(label: string) { await act(async () => { fireEvent.click(button(label)); }); }
function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  render(React.createElement(QueryClientProvider, { client }, React.createElement(enabled.CommercialReturnAction, { ticket, actorId: 1, isAdmin: true })));
  return client;
}
test("actual CLOSED capture and enabled nonADMIN render no action and perform zero requests", () => {
  let calls = 0;
  globalThis.fetch = async () => { calls++; throw Error("Unexpected transport"); };
  assert.equal(renderToStaticMarkup(React.createElement(closed.CommercialReturnAction, { ticket, actorId: 1, isAdmin: true })), "");
  assert.equal(renderToStaticMarkup(React.createElement(enabled.CommercialReturnAction, { ticket, actorId: 1, isAdmin: false })), "");
  assert.equal(calls, 0);
});
test("mounted review displays server money; uncertain send survives remount and exact retry returns one receipt", async () => {
  sessionStorage.clear();
  const posted: string[] = [];
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    let payload: unknown;
    if (url === "/api/locations") payload = [{ id: 2, nombre: "TEST TIENDA", activa: true, tipo: "TIENDA" }];
    else if (url.startsWith("/api/sesiones-caja/actual")) payload = { sesion: { id: 5, ubicacionId: 2, nombreUbicacion: "TEST TIENDA", estado: "ABIERTA" } };
    else if (url.endsWith("/vista-previa")) payload = quote;
    else if (url === "/api/devoluciones-comerciales") {
      posted.push(String(init?.body));
      if (posted.length === 1) throw Error("TEST respuesta perdida");
      payload = receipt;
    } else throw Error(`Unexpected transport ${url}`);
    return new Response(JSON.stringify(payload), { status: 200, headers: { "Content-Type": "application/json" } });
  };
  let client = mount();
  try {
    await click("Devolver rollo completo");
    await waitFor(() => assert.match(text(), /Caja abierta: TEST TIENDA/));
    await act(async () => {
      fireEvent.change(document.getElementById("commercial-roll")!, { target: { value: "11" } });
      fireEvent.change(document.getElementById("commercial-reason")!, { target: { value: receipt.motivo } });
    });
    await click("Revisar devolución");
    await waitFor(() => assert.match(text(), /Cancelar deuda: \$200.00/));
    assert.match(text(), /Devolver de la caja del día: \$800.00/);
    assert.equal(document.querySelector('input[type="number"]'), null);
    await click("Confirmar devolución");
    await waitFor(() => assert.match(text(), /Confirmación pendiente de recuperar/));
    const request = JSON.parse(posted[0]!);
    assert.equal(request.cantidad, "10.000");
    assert.equal(request.revision.efectivoDevuelto, "800.00");
    cleanup(); client.clear(); client = mount();
    await click("Devolver rollo completo");
    assert.match(text(), /Confirmación pendiente de recuperar/);
    await click("Reintentar misma solicitud");
    await waitFor(() => assert.match(text(), /Devolución registrada · Serie TEST-SERIE20/));
    assert.equal(posted.length, 2);
    assert.equal(posted[0], posted[1]);
    assert.equal(sessionStorage.getItem("commercial-return:1:10"), null);
    assert.match(text(), /Deuda cancelada\$200.00Efectivo devuelto\$800.00/);
  } finally { cleanup(); client.clear(); }
});
test("corrupt recovery journal blocks capture instead of silently issuing a new command", async () => {
  sessionStorage.setItem("commercial-return:1:10", "{damaged");
  globalThis.fetch = async () => new Response(JSON.stringify([]), { headers: { "Content-Type": "application/json" } });
  const client = mount();
  try {
    await click("Devolver rollo completo");
    assert.match(text(), /No se pudo verificar la solicitud guardada/);
    assert.equal(button("Revisar devolución").disabled, true);
  } finally { cleanup(); client.clear(); sessionStorage.clear(); }
});