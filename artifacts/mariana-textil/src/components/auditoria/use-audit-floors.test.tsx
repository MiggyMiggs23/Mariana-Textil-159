import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import * as api from "@workspace/api-client-react";
import { auditFloorsQueryKey, useAuditFloors } from "./use-audit-floors";

function Station({ auditId, userId, open }: {
  auditId: number | null;
  userId: number | null;
  open: boolean;
}) {
  const floors = useAuditFloors(auditId, userId, open);
  return <div data-testid="floors">{floors.data?.map((floor) => floor.nombre).join(", ") ?? "bloqueado"}</div>;
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

test("fetches configured active floors by audit ID with no administrative site-floor call", async () => {
  const request = vi.spyOn(api, "customFetch").mockResolvedValue([
    { id: 30, nombre: "Primer piso", ubicacionId: 3, activo: true },
    { id: 31, nombre: "Segundo piso", ubicacionId: 3, activo: true },
  ] as any);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const view = render(<QueryClientProvider client={client}><Station auditId={41} userId={7} open /></QueryClientProvider>);
  await waitFor(() => expect(screen.getByTestId("floors").textContent).toBe("Primer piso, Segundo piso"));
  expect(request).toHaveBeenCalledWith("/api/inventario/auditorias/41/pisos", { signal: expect.any(AbortSignal) });
  expect(client.getQueryData(auditFloorsQueryKey(41, 7))).toHaveLength(2);
  view.rerender(<QueryClientProvider client={client}><Station auditId={42} userId={8} open /></QueryClientProvider>);
  expect(screen.getByTestId("floors").textContent).toBe("bloqueado");
  await waitFor(() => expect(request).toHaveBeenCalledWith("/api/inventario/auditorias/42/pisos", { signal: expect.any(AbortSignal) }));
  expect(client.getQueryData(auditFloorsQueryKey(42, 8))).toHaveLength(2);
});

test("does not fetch without an identified, readable open audit", () => {
  const request = vi.spyOn(api, "customFetch");
  const client = new QueryClient();
  const view = render(<QueryClientProvider client={client}><Station auditId={null} userId={7} open /></QueryClientProvider>);
  view.rerender(<QueryClientProvider client={client}><Station auditId={41} userId={null} open /></QueryClientProvider>);
  view.rerender(<QueryClientProvider client={client}><Station auditId={41} userId={7} open={false} /></QueryClientProvider>);
  expect(request).not.toHaveBeenCalled();
  expect(screen.getByTestId("floors").textContent).toBe("bloqueado");
});