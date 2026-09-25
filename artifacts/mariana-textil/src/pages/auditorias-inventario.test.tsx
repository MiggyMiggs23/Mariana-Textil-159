import { afterEach, describe, test, expect, vi } from "vitest";
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import AuditoriasInventario from "./auditorias-inventario";
import * as apiClient from "@workspace/api-client-react";

vi.mock("@/components/layout/app-layout", () => ({
  AppLayout: ({ children }: any) => <div data-testid="layout">{children}</div>
}));
vi.mock("@/components/auditoria-inventario-print", () => ({
  AuditoriaInventarioPrint: () => null,
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  window.history.replaceState({}, "", "/inventario/auditorias");
});

const reactivation = {
  rolloId: 999,
  serie: "FAL-123",
  elegible: true,
  bloqueo: null,
  auditoriaOrigenId: 41,
  movimientoBajaId: 501,
  cantidadAnterior: "150.500",
  producto: "Gabardina / Azul",
  unidad: "METRO",
  costoUnitario: null,
  recepcionId: null,
  entradaFolio: null,
  proveedorId: null,
  proveedorNombre: null,
  ubicacionBajaId: 1,
  ubicacionBaja: "Bodega Centro",
  auditoriasPosteriores: [],
} as const;

function hookResult(data: unknown) {
  return { data, isLoading: false, isError: false, isPending: false };
}

describe("AuditoriasInventario Component", () => {
  test("a CONFIRMADA origin separates financial/unknown surplus and opens its exact missing reactivation", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0, staleTime: Infinity } },
    });
    queryClient.setQueryData(
      apiClient.getGetReactivacionFaltanteQueryKey(999),
      reactivation,
    );
    const fetchQuery = vi.spyOn(queryClient, "fetchQuery");

    vi.spyOn(apiClient, "useGetCurrentUser").mockReturnValue(hookResult({ rol: "ADMIN" }) as any);
    vi.spyOn(apiClient, "useListSitiosAuditoriaInventario").mockReturnValue(hookResult([{ id: 1, nombre: "Bodega Centro", iniciales: "BC" }]) as any);
    vi.spyOn(apiClient, "useListAuditoriasInventario").mockReturnValue(hookResult([{ id: 41, ubicacionId: 1, estado: "CONFIRMADA", folioFormateado: "BC-AI-000041", nombreUbicacion: "Bodega Centro", totalEscaneados: 2, totalSnapshot: 1 }]) as any);
    vi.spyOn(apiClient, "useListProductos").mockReturnValue(hookResult([]) as any);
    vi.spyOn(apiClient, "useListPisosLocation").mockReturnValue(hookResult([]) as any);
    vi.spyOn(apiClient, "useCreateProducto").mockReturnValue({ mutate: vi.fn(), isPending: false } as any);
    vi.spyOn(apiClient, "useScanAuditoriaInventario").mockReturnValue({ mutate: vi.fn(), isPending: false } as any);
    vi.spyOn(apiClient, "useCloseAuditoriaInventario").mockReturnValue({ mutate: vi.fn(), isPending: false } as any);
    vi.spyOn(apiClient, "useCancelAuditoriaInventario").mockReturnValue({ mutate: vi.fn(), isPending: false } as any);
    vi.spyOn(apiClient, "useConfirmAuditoriaInventario").mockReturnValue({ mutate: vi.fn(), isPending: false } as any);
    vi.spyOn(apiClient, "useCreateAuditoriaInventario").mockReturnValue({ mutate: vi.fn(), isPending: false } as any);
    vi.spyOn(apiClient, "useReactivarFaltante").mockReturnValue({ mutate: vi.fn(), isPending: false } as any);
    vi.spyOn(apiClient, "useResolverSobranteAuditoriaInventario").mockReturnValue({ mutate: vi.fn(), isPending: false } as any);

    vi.spyOn(apiClient, "useGetAuditoriaInventario").mockReturnValue({
      data: {
        id: 41,
        estado: "CONFIRMADA",
        ubicacionId: 1,
        nombreUbicacion: "Bodega Centro",
        folioFormateado: "BC-AI-000041",
        creadaPor: "Admin",
        abiertaAt: "2026-09-18T10:00:00.000Z",
        cerradaAt: "2026-09-18T10:05:00.000Z",
        totalEscaneados: 2,
        totalSnapshot: 1,
        cuadros: 0,
        faltantes: 1,
        sobrantes: 2,
        malAcomodados: 0,
        participantes: [],
        resultados: [
          {
            serie: "SOLD-123",
            clasificacion: "SOBRANTE",
            producto: "Satín / Negro",
            cantidad: "40.000",
            unidad: "METRO",
            estadoActual: "VENDIDO",
            resolucion: "RESOLUCION_MANUAL",
            sobrante: {
              caso: "VENDIDO_FISICAMENTE_AQUI",
              grave: true,
              sitioRegistradoId: 1,
              sitioRegistrado: "Bodega Centro",
              estadoRegistrado: "VENDIDO",
              pendiente: true,
              estadoResolucion: "PENDIENTE",
              bloqueo: "Resolver venta",
              historial: [],
              documentos: [{ tipo: "TICKET", id: 55, folio: "BC-000055", href: "/tickets/55" }],
            },
          },
          {
            serie: "UNK-123",
            clasificacion: "SOBRANTE",
            producto: "NO DEBE MOSTRARSE",
            cantidad: "999.000",
            unidad: "METRO",
            estadoActual: "DESCONOCIDO",
            resolucion: "RESOLUCION_MANUAL",
            sobrante: {
              caso: "SIN_REGISTRO_PREVIO",
              grave: false,
              sitioRegistradoId: null,
              sitioRegistrado: null,
              estadoRegistrado: null,
              documentos: [],
              pendiente: true,
              estadoResolucion: "PENDIENTE",
              bloqueo: "Sin registro",
              historial: [],
            },
          },
          {
            serie: "FAL-123",
            rolloId: 999,
            clasificacion: "FALTANTE",
            producto: "Gabardina / Azul",
            cantidad: "150.500",
            unidad: "METRO",
            ubicacionActual: "Bodega Centro",
            estadoActual: "BAJA",
            resolucion: "APLICADA",
          }
        ]
      },
      isLoading: false,
      isError: false,
    } as any);

    render(
      <QueryClientProvider client={queryClient}>
        <AuditoriasInventario />
      </QueryClientProvider>
    );

    const financial = screen.getByText("Riesgo Financiero: Vendidos Físicamente Aquí").closest("div.border");
    expect(financial).not.toBeNull();
    expect(within(financial as HTMLElement).getByText("SOLD-123")).toBeTruthy();
    expect(within(financial as HTMLElement).getByRole("link", { name: /BC-000055/ }).getAttribute("href")).toBe("/tickets/55");
    expect(screen.queryByTestId("row-audit-result-SOLD-123")).toBeNull();

    const unknownRow = screen.getByTestId("row-audit-result-unknown-UNK-123");
    expect(unknownRow.textContent).toContain("UNK-123");
    expect(unknownRow.textContent).not.toContain("NO DEBE MOSTRARSE");
    expect(unknownRow.textContent).not.toContain("999");
    expect(screen.queryByTestId("row-audit-result-UNK-123")).toBeNull();

    fireEvent.click(screen.getByTestId("button-reactivate-audit-missing-FAL-123"));
    expect(fetchQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: apiClient.getGetReactivacionFaltanteQueryKey(999),
      }),
    );
    expect(await screen.findByText("Reactivar Rollo Faltante")).toBeTruthy();
    expect(screen.getByTestId("reactivation-previous-quantity").textContent).toBe("150.50 Mts.");
    expect(screen.queryByText("Origen del hallazgo")).toBeNull();
  });

  test("notification deep-link changes select the exact audit on the mounted route", async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const getDetail = vi.spyOn(apiClient, "useGetAuditoriaInventario").mockReturnValue({ isLoading: true } as any);
    vi.spyOn(apiClient, "useGetCurrentUser").mockReturnValue(hookResult({ rol: "ADMIN" }) as any);
    vi.spyOn(apiClient, "useListSitiosAuditoriaInventario").mockReturnValue(hookResult([]) as any);
    vi.spyOn(apiClient, "useListAuditoriasInventario").mockReturnValue(hookResult([]) as any);
    vi.spyOn(apiClient, "useListProductos").mockReturnValue(hookResult([]) as any);
    vi.spyOn(apiClient, "useListPisosLocation").mockReturnValue(hookResult([]) as any);
    for (const name of ["useCreateProducto", "useScanAuditoriaInventario", "useCloseAuditoriaInventario", "useCancelAuditoriaInventario", "useConfirmAuditoriaInventario", "useCreateAuditoriaInventario"] as const) {
      vi.spyOn(apiClient, name).mockReturnValue({ mutate: vi.fn(), isPending: false } as any);
    }
    render(<QueryClientProvider client={queryClient}><AuditoriasInventario /></QueryClientProvider>);
    window.history.pushState({}, "", "/inventario/auditorias?auditoriaId=77");
    window.dispatchEvent(new PopStateEvent("popstate"));
    await waitFor(() => {
      expect(getDetail).toHaveBeenCalledWith(
        77,
        expect.objectContaining({ query: expect.objectContaining({ enabled: true }) }),
      );
    });
  });
});
