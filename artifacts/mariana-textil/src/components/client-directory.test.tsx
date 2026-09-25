import React from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ClientDirectory } from "./client-directory";

const requests: URLSearchParams[] = [];
let client: QueryClient;
let rows = [
  { id: 200, nombre: "Aarón Arvizu Rodríguez", telefono: "5551234567", rfc: "XAXX010101000", activo: true, esSistema: false, limiteCredito: "150000.00", saldoActual: "250.00", saldoAFavor: "0.00", movementCount: 7, lastActivity: "2026-09-25T15:00:00Z" },
  { id: 201, nombre: "Cliente sin deuda", telefono: null, rfc: null, activo: true, esSistema: false, limiteCredito: "150000.00", saldoActual: "0.00", saldoAFavor: "100.00", movementCount: 2, lastActivity: null },
];
function mount(canFinances = true) {
  return render(<QueryClientProvider client={client}><ClientDirectory enabled canFinances={canFinances} isAdmin authPartition="ADMIN:global" /></QueryClientProvider>);
}
beforeEach(() => {
  history.replaceState(null, "", "/clientes");
  requests.length = 0;
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  vi.stubGlobal("fetch", vi.fn(async (input: string) => {
    const params = new URL(input, "http://localhost").searchParams;
    requests.push(params);
    return { ok: true, json: async () => ({ items: rows, total: 2575, page: Number(params.get("page")), pageSize: 50 }) };
  }));
});
afterEach(() => { cleanup(); client.clear(); vi.unstubAllGlobals(); });
it("uses activity desc by default, one paged query and no per-row credit requests", async () => {
  mount();
  await screen.findByText("Aarón Arvizu Rodríguez");
  expect(requests).toHaveLength(1);
  expect(Object.fromEntries(requests[0])).toMatchObject({ sort: "lastActivity", direction: "desc", pageSize: "50", period: "all" });
  expect(screen.getByTestId("sort-clients-lastActivity").closest("th")?.getAttribute("aria-sort")).toBe("descending");
  expect(screen.getByText("Con deuda")).toBeTruthy();
  expect(screen.getByText("Sin deuda")).toBeTruthy();
  expect(screen.getByText("A favor: $100.00")).toBeTruthy();
});
it("inverts sortable columns and exposes the active direction", async () => {
  mount();
  await screen.findByText("Aarón Arvizu Rodríguez");
  for (const sort of ["nombre", "rfc", "telefono", "limiteCredito", "saldoActual", "movementCount", "lastActivity"]) {
    fireEvent.click(screen.getByTestId(`sort-clients-${sort}`));
    await waitFor(() => expect(requests.at(-1)?.get("sort")).toBe(sort));
    await waitFor(() => expect(screen.queryByText("Buscando…")).toBeNull());
    expect(screen.getByTestId(`sort-clients-${sort}`).closest("th")?.getAttribute("aria-sort")).toBe("ascending");
    fireEvent.click(screen.getByTestId(`sort-clients-${sort}`));
    await waitFor(() => expect(screen.queryByText("Buscando…")).toBeNull());
    expect(screen.getByTestId(`sort-clients-${sort}`).closest("th")?.getAttribute("aria-sort")).toBe("descending");
  }
});
it("debounces typing without delaying the input and resets pagination", async () => {
  mount();
  await screen.findByText("Aarón Arvizu Rodríguez");
  fireEvent.click(screen.getByLabelText("Página siguiente"));
  await waitFor(() => expect(requests.at(-1)?.get("page")).toBe("2"));
  const input = screen.getByTestId("input-search-clients") as HTMLInputElement;
  fireEvent.change(input, { target: { value: "Ar" } });
  fireEvent.change(input, { target: { value: "Arvizu" } });
  expect(input.value).toBe("Arvizu");
  expect(requests.some(query => query.get("q") === "Arvizu")).toBe(false);
  await waitFor(() => expect(requests.at(-1)?.get("q")).toBe("Arvizu"));
  expect(requests.at(-1)?.get("page")).toBe("1");
  expect(requests.some(query => query.get("q") === "Ar")).toBe(false);
});
it("quick filters and period changes reset page and transmit exact criteria", async () => {
  mount();
  await screen.findByText("Aarón Arvizu Rodríguez");
  fireEvent.click(screen.getByTestId("quick-order-movementCount"));
  await waitFor(() => expect(requests.at(-1)?.get("sort")).toBe("movementCount"));
  await waitFor(() => expect((screen.getByLabelText("Página siguiente") as HTMLButtonElement).disabled).toBe(false));
  expect(requests.at(-1)?.get("direction")).toBe("desc");
  fireEvent.click(screen.getByLabelText("Página siguiente"));
  await waitFor(() => expect(requests.at(-1)?.get("page")).toBe("2"));
  fireEvent.change(screen.getByTestId("select-movement-period"), { target: { value: "3m" } });
  await waitFor(() => expect(requests.at(-1)?.get("period")).toBe("3m"));
  expect(requests.at(-1)?.get("page")).toBe("1");
  fireEvent.click(screen.getByTestId("quick-order-saldoActual"));
  await waitFor(() => expect(requests.at(-1)?.get("sort")).toBe("saldoActual"));
});
it("does not render finances or activity controls for catalog-only users", async () => {
  mount(false);
  await screen.findByText("Aarón Arvizu Rodríguez");
  expect(requests[0].get("sort")).toBe("nombre");
  expect(screen.queryByTestId("sort-clients-saldoActual")).toBeNull();
  expect(screen.queryByTestId("select-movement-period")).toBeNull();
  expect(screen.queryByText("Con deuda")).toBeNull();
});