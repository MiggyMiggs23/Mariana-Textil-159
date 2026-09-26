import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { createRequire } from "node:module";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { GetSalidaResponse, GetBorradorSalidaResponse } from "@workspace/api-zod";
import { loadBehaviorStatusCancelPage } from "./behavior-status-cancel-test-support";

const { JSDOM } = createRequire(import.meta.url)("jsdom") as {
  JSDOM: new (html: string, options: { url: string }) => { window: Window & typeof globalThis };
};
const units = ["METRO", "KILO", "BOLSA", "PIEZA"];
const labels = ["Metros", "Kilos", "Bolsas", "Piezas"];
function fixture(zero: boolean) {
  const values = zero ? [0, 0, 0, 0] : [12.5, 7.25, 3, 9];
  return {
    id: 425, folio: 425, folioFormateado: "S-00425", uuidCliente: "offline-totals",
    modalidad: "TRASLADO", estado: "ARMANDO", origenId: 10, destinoId: 20,
    nombreOrigen: "Origen", nombreDestino: "Destino", armadoPorId: 1,
    nombreArmadoPor: "Operadora", fechaArmado: "2026-09-24T12:00:00Z",
    createdAt: "2026-09-24T12:00:00Z", updatedAt: "2026-09-24T12:00:00Z",
    totalProductos: zero ? 0 : 4, totalRollos: zero ? 0 : 4,
    totalCantidadSolicitada: "0", totalCantidadEnviada: "0", totalCantidadRecibida: "0",
    totalMetros: String(values[0]), totalKilos: String(values[1]),
    totalBolsas: String(values[2]), totalPiezas: String(values[3]),
    diferenciasPendientes: false, transportista: null, enviadoPorId: null,
    nombreEnviadoPor: null, fechaEnvio: null, notaEnvio: null,
    recibidoPorId: null, nombreRecibidoPor: null, fechaRecepcion: null,
    notaRecepcion: null, canceladoPorId: null, nombreCanceladoPor: null,
    fechaCancelacion: null, motivoCancelacion: null, pisosRetorno: [], lineas: [],
    rollos: zero ? [] : units.map((unidad, i) => ({
      id: i + 1, lineaId: i + 1, rolloId: i + 1, serie: String(10000001 + i),
      estado: "DISPONIBLE", cantidadActual: String(values[i]),
      cantidadEnviada: String(values[i]), recibido: null, diferencia: null,
      productoId: i + 1, sku: `SKU-${i}`, tela: `Tela ${i}`, color: "Azul", unidad,
    })),
  };
}

test("routes mount the tested outgoing creation and detail pages", async () => {
  const app = await readFile(new URL("../App.tsx", import.meta.url), "utf8");
  for (const [name, path] of [["SalidaNueva", "salida-nueva"], ["SalidaDetail", "salida-detail"]]) {
    assert.ok(app.includes(`import ${name} from "@/pages/${path}"`));
    assert.ok(app.includes(`component={${name}}`));
  }
});

for (const page of ["new", "detail"] as const) {
  for (const zero of [false, true]) {
    test(`${page}: mounted ${zero ? "zero" : "mixed four-unit"} summary keeps quantities separate`, async () => {
      // The fixtures pass the exact response parser used for this surface.
      const raw = fixture(zero);
      const salida = page === "new"
        ? GetBorradorSalidaResponse.parse({ salida: raw }).salida!
        : GetSalidaResponse.parse(raw);
      const dom = new JSDOM("<!doctype html><html><body><div id='root'></div></body></html>", {
        url: "http://localhost/salidas/425",
      });
      const keys = ["window", "document", "navigator", "HTMLElement", "MutationObserver", "IS_REACT_ACT_ENVIRONMENT", "HTMLFormElement", "HTMLInputElement", "Event", "DocumentFragment", "getComputedStyle"];
      const previous = keys.map(key => Object.getOwnPropertyDescriptor(globalThis, key));
      const globals = [dom.window, dom.window.document, dom.window.navigator, dom.window.HTMLElement, dom.window.MutationObserver, true, dom.window.HTMLFormElement, dom.window.HTMLInputElement, dom.window.Event, dom.window.DocumentFragment, dom.window.getComputedStyle.bind(dom.window)];
      keys.forEach((key, i) => Object.defineProperty(globalThis, key, { configurable: true, writable: true, value: globals[i] }));
      const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
      const root = createRoot(dom.window.document.getElementById("root")!);
      try {
        const { Page } = await loadBehaviorStatusCancelPage(page, {
          actor: { id: 1, rol: "BODEGA", ubicacion: { id: 10 }, permisos: [] },
          salida,
        });
        await act(async () => {
          root.render(<QueryClientProvider client={client}><Router hook={memoryLocation({ path: "/salidas/425" }).hook}><Page /></Router></QueryClientProvider>);
        });
        const spans = [...dom.window.document.querySelectorAll("span")];
        const summary = spans.find(span => span.textContent === "Total Rollos")?.parentElement?.parentElement;
        assert.equal(Boolean(summary), true, "summary mounted");
        const row = (label: string) => [...summary!.querySelectorAll("span")].find(span => span.textContent === label)?.parentElement;
        assert.equal(row("Total Rollos")?.lastElementChild?.textContent, zero ? "0" : "4");
        labels.forEach((label, i) => {
          if (zero && page === "detail") {
            // Saved detail retains its existing positive-only policy.
            assert.equal(Boolean(row(label)), false, `${page}/${label}: zero omitted`);
          } else {
            assert.equal(Boolean(row(label)), true, `${page}/${label}: visible total`);
            assert.equal(row(label)?.lastElementChild?.textContent,
              zero ? "0.00" : ["12.50", "7.25", "3.00", "9.00"][i], `${page}/${label}: independent value`);
          }
        });
        if (page === "new") {
          const send = [...dom.window.document.querySelectorAll("button")].find(button => button.textContent?.includes("Guardar y enviar"));
          assert.equal(Boolean(send), true);
          assert.equal(send?.disabled, true, "no transportista supplied; display fix must not enable sending");
        }
      } finally {
        await act(async () => root.unmount());
        client.clear();
        dom.window.close();
        keys.forEach((key, i) => previous[i] ? Object.defineProperty(globalThis, key, previous[i]!) : Reflect.deleteProperty(globalThis, key));
      }
    });
  }
}