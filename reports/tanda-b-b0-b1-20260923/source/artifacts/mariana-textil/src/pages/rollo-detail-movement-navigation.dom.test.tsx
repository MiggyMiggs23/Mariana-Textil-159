import React from "react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as apiClient from "@workspace/api-client-react";
import RolloDetail from "./rollo-detail";

vi.mock("wouter", () => ({
  useParams: () => ({ id: "999" }),
  useSearch: () => "?movimientoId=701",
  Link: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
}));
vi.mock("@/components/layout/app-layout", () => ({
  AppLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock("@/lib/internal-navigation", () => ({
  AppBackLink: () => <a href="/inventario">Volver</a>,
}));
vi.mock("@/components/reprint-labels-dialog", () => ({ ReprintLabelsDialog: () => null }));
vi.mock("@/components/movimiento-documento-link", () => ({ MovimientoDocumento: () => null }));
vi.mock("@/components/auditoria/reactivacion-faltante-dialog", () => ({
  ReactivacionFaltanteDialog: () => null,
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("RolloDetail movement deep link", () => {
  test("scrolls to and highlights the exact real kardex row from movimientoId", () => {
    const scrollIntoView = vi.fn();
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: scrollIntoView,
    });
    vi.spyOn(apiClient, "useGetCurrentUser").mockReturnValue({ data: { rol: "ADMIN" } } as any);
    vi.spyOn(apiClient, "useListPisosLocation").mockReturnValue({ data: [] } as any);
    vi.spyOn(apiClient, "useUpdateRolloPiso").mockReturnValue({ mutate: vi.fn(), isPending: false } as any);
    vi.spyOn(apiClient, "useRevertSalidaExtraordinaria").mockReturnValue({ mutate: vi.fn(), isPending: false } as any);
    vi.spyOn(apiClient, "useGetRollo").mockReturnValue({
      data: {
        id: 999,
        serie: "FAL-123",
        productoId: 12,
        skuProducto: "GAB-AZU",
        telaProducto: "Gabardina",
        colorProducto: "Azul",
        unidadProducto: "METRO",
        cantidadInicial: "150.500",
        cantidadActual: "150.500",
        costoUnitario: "90.0000",
        costoTotal: "13545.0000",
        estado: "ACTIVO",
        ubicacionId: 1,
        nombreUbicacion: "Bodega Centro",
        createdAt: "2026-09-18T10:00:00.000Z",
        notas: null,
        historial: [
          {
            id: 700,
            tipo: "BAJA",
            cantidad: "-150.500",
            saldoPosterior: "0",
            nombreUbicacion: "Bodega Centro",
            createdAt: "2026-09-18T11:00:00.000Z",
          },
          {
            id: 701,
            tipo: "REACTIVACION_FALTANTE",
            cantidad: "150.500",
            saldoPosterior: "150.500",
            nombreUbicacion: "Bodega Centro",
            createdAt: "2026-09-18T12:00:00.000Z",
          },
        ],
      },
      isLoading: false,
    } as any);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    render(<QueryClientProvider client={client}><RolloDetail /></QueryClientProvider>);

    const target = screen.getByTestId("rollo-movement-row-701");
    expect(target.getAttribute("aria-current")).toBe("true");
    expect(target.className).toContain("ring-primary");
    expect(screen.getByTestId("rollo-movement-row-700").hasAttribute("aria-current")).toBe(false);
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: "smooth", block: "center" });
    expect(document.activeElement).toBe(target);
  });
});