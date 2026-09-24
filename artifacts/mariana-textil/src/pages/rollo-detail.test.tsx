import React from "react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as apiClient from "@workspace/api-client-react";
import RolloDetail from "./rollo-detail";

vi.mock("wouter", () => ({
  useParams: () => ({ id: "999" }),
  useSearch: () => "",
  Link: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
}));
vi.mock("@/components/layout/app-layout", () => ({
  AppLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock("@/lib/internal-navigation", () => ({
  AppBackLink: () => <a href="/inventario">Volver</a>,
}));
vi.mock("@/components/reprint-labels-dialog", () => ({
  ReprintLabelsDialog: () => null,
}));
vi.mock("@/components/movimiento-documento-link", () => ({
  MovimientoDocumento: () => null,
}));
vi.mock("@/components/auditoria/reactivacion-faltante-dialog", () => ({
  ReactivacionFaltanteDialog: (props: {
    origen: string;
    contexto: { auditoriaOrigenId: number | null };
  }) => (
    <div data-testid="roll-detail-reactivation-dialog">
      {props.origen}:{props.contexto.auditoriaOrigenId}
    </div>
  ),
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("RolloDetail reactivation", () => {
  test.each([
    ["CANCELACION", "1.000", "+1.00", "text-emerald", false],
    ["VENTA", "-1.000", "-1.00", "text-red", true],
    ["TRANSFERENCIA_SALIDA", "-2.500", "-2.50", "text-red", true],
    ["BAJA", "-3.000", "-3.00", "text-red", true],
    ["CANCELACION", "-1.000", "-1.00", "text-red", true],
    ["AJUSTE_POSITIVO", "0.000", "0.00", "", false],
  ])("uses signed ledger quantity for %s (%s)", (tipo, cantidad, text, color, destructive) => {
    vi.spyOn(apiClient, "useGetCurrentUser").mockReturnValue({ data: { rol: "ADMIN" } } as any);
    vi.spyOn(apiClient, "useListPisosLocation").mockReturnValue({ data: [] } as any);
    vi.spyOn(apiClient, "useUpdateRolloPiso").mockReturnValue({ mutate: vi.fn(), isPending: false } as any);
    vi.spyOn(apiClient, "useRevertSalidaExtraordinaria").mockReturnValue({ mutate: vi.fn(), isPending: false } as any);
    vi.spyOn(apiClient, "useGetRollo").mockReturnValue({
      data: {
        id: 999, serie: "TEST-SIGNED-LEDGER", productoId: 12,
        skuProducto: "GAB-AZU", telaProducto: "Gabardina", colorProducto: "Azul",
        unidadProducto: "METRO", cantidadInicial: "1.000", cantidadActual: "1.000",
        costoUnitario: "100.0000", costoTotal: "100.0000", estado: "DISPONIBLE",
        ubicacionId: 1, nombreUbicacion: "Bodega Centro",
        createdAt: "2026-09-24T03:23:00.000Z", notas: null,
        historial: [{
          id: 700, tipo, cantidad, saldoPosterior: "6.000",
          nombreUbicacion: "Bodega Centro", createdAt: "2026-09-24T03:23:00.000Z",
        }],
      },
      isLoading: false,
    } as any);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><RolloDetail /></QueryClientProvider>);
    const row = within(screen.getByTestId("rollo-movement-row-700"));
    const quantity = row.getByText(text);
    expect(quantity.className).toContain(color);
    if (!color) {
      expect(quantity.className).not.toMatch(/text-(emerald|red)/);
    }
    expect(row.getByText(String(tipo).replaceAll("_", " ")).className.includes("bg-destructive")).toBe(destructive);
    expect(row.getByText("6.00")).toBeTruthy();
  });

  test("a BAJA roll opens the ROLLO entry point and labels reactivation as a distinct positive movement", async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: Infinity } },
    });
    client.setQueryData(apiClient.getGetReactivacionFaltanteQueryKey(999), {
      rolloId: 999,
      serie: "FAL-123",
      elegible: true,
      bloqueo: null,
      auditoriaOrigenId: 41,
      movimientoBajaId: 501,
      cantidadAnterior: "150.500",
      producto: "Gabardina / Azul",
      unidad: "METRO",
      costoUnitario: "90.0000",
      recepcionId: null,
      entradaFolio: null,
      proveedorId: null,
      proveedorNombre: null,
      ubicacionBajaId: 1,
      ubicacionBaja: "Bodega Centro",
      auditoriasPosteriores: [],
    });
    const fetchQuery = vi.spyOn(client, "fetchQuery");
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
        estado: "BAJA",
        ubicacionId: 1,
        nombreUbicacion: "Bodega Centro",
        createdAt: "2026-09-18T10:00:00.000Z",
        notas: null,
        historial: [{
          id: 700,
          tipo: "REACTIVACION_FALTANTE",
          cantidad: "150.500",
          saldoPosterior: "150.500",
          nombreUbicacion: "Tienda Aparición",
          createdAt: "2026-09-18T12:00:00.000Z",
          justificacion: "Apareció detrás de otros rollos",
        }],
      },
      isLoading: false,
    } as any);

    render(<QueryClientProvider client={client}><RolloDetail /></QueryClientProvider>);
    expect(screen.getByText("Reactivación de faltante")).toBeTruthy();
    expect(screen.getByText("+150.50").className).toContain("text-emerald");
    fireEvent.click(screen.getByRole("button", { name: "Reactivar Faltante" }));
    expect(fetchQuery).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: apiClient.getGetReactivacionFaltanteQueryKey(999) }),
    );
    expect(await screen.findByTestId("roll-detail-reactivation-dialog")).toHaveProperty(
      "textContent",
      "ROLLO:41",
    );
  });
});