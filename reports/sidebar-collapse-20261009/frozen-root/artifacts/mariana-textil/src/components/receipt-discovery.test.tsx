import React from "react";
import { afterEach, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReceiptDiscovery } from "./receipt-discovery";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
function mount(permission: boolean, role = "TERMINAL", failure = false) {
  const visits: string[] = [];
  const user = { id: 7, rol: role, ubicacion: { id: 1, nombre: "Sitio sintético" },
    permisos: [{ modulo: "recibos_abonos", puedeVer: permission, puedeCrear: false, puedeEditar: false, puedeAutorizar: false }] };
  vi.stubGlobal("fetch", vi.fn(async (input: string) => {
    const url = String(input); visits.push(url);
    if (url.endsWith("/auth/me")) return Response.json(user);
    if (failure) return Response.json({ error: "Consulta fallida" }, { status: 503 });
    if (url.includes("/caja/recibos-e3")) return Response.json([{ folio: "E3-1-00000001", clienteNombre: "Cliente sintético E3", recibidoEn: "2026-10-01T12:00:00Z" }]);
    if (url.includes("/e5/recibos")) return Response.json([{ id: "doc", cobroId: "cobro", folio: "E5-R-doc", clienteNombre: "Cliente sintético E5", fechaRecepcion: "2026-10-01T12:00:00Z" }]);
    throw new Error(`Forbidden financial API: ${url}`);
  }));
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } } });
  render(<QueryClientProvider client={client}><ReceiptDiscovery /></QueryClientProvider>);
  return visits;
}
test("mounted TERMINAL discovery uses both documentary sources and searchable links without financial APIs", async () => {
  const visits = mount(true);
  expect((await screen.findByRole("link", { name: /Cliente sintético E3/ })).getAttribute("href")).toBe("/recibos-e3/E3-1-00000001");
  expect((await screen.findByRole("link", { name: /Cliente sintético E5/ })).getAttribute("href")).toBe("/cobros/pendientes/cobro/documentos/doc");
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "folio específico" } });
  await waitFor(() => expect(visits.some(url => url.includes("buscar=folio%20espec%C3%ADfico"))).toBe(true));
  expect(visits.every(url => /\/auth\/me$|\/caja\/recibos-e3\?|\/e5\/recibos\?/.test(url))).toBe(true);
});
test("mounted explicit deny does not discover receipts", async () => {
  const visits = mount(false);
  await waitFor(() => expect(visits.length).toBe(1));
  expect(Boolean(screen.queryByRole("textbox"))).toBe(false);
});
test("mounted custom grant is not hardcoded to TERMINAL", async () => {
  mount(true, "SUPERVISOR");
  expect(Boolean(await screen.findByRole("link", { name: /Cliente sintético E3/ }))).toBe(true);
});
test("mounted failure is explicit, not an empty receipt list", async () => {
  mount(true, "TERMINAL", true);
  expect(Boolean(await screen.findByRole("alert"))).toBe(true);
  expect(Boolean(screen.queryByText(/No hay recibos/))).toBe(false);
});