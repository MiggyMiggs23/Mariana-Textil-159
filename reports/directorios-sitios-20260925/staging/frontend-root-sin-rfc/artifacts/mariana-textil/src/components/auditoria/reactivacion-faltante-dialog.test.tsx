import React, { createContext, useContext } from "react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactivacionFaltanteContexto } from "@workspace/api-client-react";

const harness = vi.hoisted(() => ({
  mutate: vi.fn(),
  onOpenChange: vi.fn(),
  onSuccess: vi.fn(),
}));

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  DialogDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
  DialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/ui/select", async () => {
  const Change = createContext<(value: string) => void>(() => undefined);
  return {
    Select: ({ children, onValueChange }: { children: React.ReactNode; onValueChange: (value: string) => void }) => (
      <Change.Provider value={onValueChange}><div>{children}</div></Change.Provider>
    ),
    SelectTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    SelectValue: ({ placeholder }: { placeholder?: string }) => <span>{placeholder}</span>,
    SelectContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    SelectItem: ({ children, value }: { children: React.ReactNode; value: string }) => {
      const change = useContext(Change);
      return <button type="button" onClick={() => change(value)}>{children}</button>;
    },
  };
});

vi.mock("@workspace/api-client-react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@workspace/api-client-react")>();
  return {
    ...actual,
    useListSitiosAuditoriaInventario: () => ({
      data: [
        { id: 2, nombre: "Tienda Aparición", iniciales: "TA" },
        { id: 3, nombre: "Otro Sitio", iniciales: "OS" },
      ],
    }),
    useListPisosLocation: (siteId: number) => ({
      data: siteId === 2 ? [{ id: 20, nombre: "Piso 2", activo: true, ubicacionId: 2 }] : [],
    }),
    useReactivarFaltante: () => ({ mutate: harness.mutate, isPending: false }),
  };
});

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import {
  buildReactivacionFaltanteInput,
  ReactivacionFaltanteDialog,
} from "./reactivacion-faltante-dialog";

const context: ReactivacionFaltanteContexto = {
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
  recepcionId: 91,
  entradaFolio: "BC-E-000091",
  proveedorId: 8,
  proveedorNombre: "Textiles Verificados",
  ubicacionBajaId: 1,
  ubicacionBaja: "Bodega Centro",
  auditoriasPosteriores: [
    { id: 72, ubicacionId: 2, folio: 72, cerradaAt: "2026-09-17T10:00:00.000Z" },
    { id: 73, ubicacionId: 3, folio: 73, cerradaAt: "2026-09-17T11:00:00.000Z" },
  ],
};

afterEach(() => {
  cleanup();
  harness.mutate.mockReset();
  harness.onOpenChange.mockReset();
  harness.onSuccess.mockReset();
});

function mount(origen: "AUDITORIA" | "ROLLO" = "AUDITORIA") {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <ReactivacionFaltanteDialog
        open
        onOpenChange={harness.onOpenChange}
        rolloId={999}
        origen={origen}
        contexto={context}
        onSuccess={harness.onSuccess}
      />
    </QueryClientProvider>,
  );
  return queryClient;
}

function completeRequiredFields() {
  fireEvent.click(screen.getByRole("button", { name: "Tienda Aparición" }));
  fireEvent.click(screen.getByRole("button", { name: "Piso 2" }));
  fireEvent.change(screen.getByTestId("input-reactivation-reason"), {
    target: { value: "Apareció detrás de otros rollos" },
  });
}

describe("ReactivacionFaltanteDialog", () => {
  test("builds the dedicated typed request without measurement or editable inventory fields", () => {
    expect(buildReactivacionFaltanteInput({
      auditoriaOrigenId: 41,
      origen: "AUDITORIA",
      ubicacionId: 2,
      pisoId: 20,
      motivo: "  Apareció detrás de otros rollos  ",
      uuidCliente: "11111111-1111-4111-8111-111111111111",
    })).toEqual({
      auditoriaOrigenId: 41,
      origen: "AUDITORIA",
      ubicacionId: 2,
      pisoId: 20,
      motivo: "Apareció detrás de otros rollos",
      uuidCliente: "11111111-1111-4111-8111-111111111111",
    });
  });

  test("submits original audit, appearance site/floor and reason once; an error stays open", () => {
    mount();

    expect(screen.getByText("Pendiente")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Tienda Aparición" }));
    expect(screen.getByTestId("reactivation-later-audits").textContent).toContain("Auditoría 72");
    expect(screen.getByTestId("reactivation-later-audits").textContent).not.toContain("Auditoría 73");
    fireEvent.click(screen.getByRole("button", { name: "Piso 2" }));
    fireEvent.change(screen.getByTestId("input-reactivation-reason"), {
      target: { value: "Apareció detrás de otros rollos" },
    });
    const submit = screen.getByTestId("button-confirm-reactivation");
    fireEvent.click(submit);
    fireEvent.click(submit);

    expect(harness.mutate).toHaveBeenCalledTimes(1);
    expect(harness.mutate.mock.calls[0]?.[0]).toEqual({
      id: 999,
      data: expect.objectContaining({
        auditoriaOrigenId: 41,
        origen: "AUDITORIA",
        ubicacionId: 2,
        pisoId: 20,
        motivo: "Apareció detrás de otros rollos",
      }),
    });
    expect(Object.keys(harness.mutate.mock.calls[0]?.[0].data).sort()).toEqual(
      ["auditoriaOrigenId", "motivo", "origen", "pisoId", "ubicacionId", "uuidCliente"].sort(),
    );
    harness.mutate.mock.calls[0]?.[1].onError({ data: { error: "Conflicto concurrente" } });
    expect(harness.onOpenChange).not.toHaveBeenCalled();
    expect(harness.onSuccess).not.toHaveBeenCalled();
  });

  test("success invalidates roll, context, inventory, origin audit and notification queries", () => {
    const queryClient = mount("ROLLO");
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");
    completeRequiredFields();
    fireEvent.click(screen.getByTestId("button-confirm-reactivation"));
    expect(harness.mutate.mock.calls[0]?.[0].data).toEqual(
      expect.objectContaining({ auditoriaOrigenId: 41, origen: "ROLLO" }),
    );
    harness.mutate.mock.calls[0]?.[1].onSuccess();

    const invalidatedKeys = invalidate.mock.calls.map(([options]) => JSON.stringify(options?.queryKey));
    expect(invalidatedKeys).toEqual(expect.arrayContaining([
      JSON.stringify(["/api/inventario/rollos/999"]),
      JSON.stringify(["/api/inventario/rollos"]),
      JSON.stringify(["/api/inventario/rollos/999/reactivacion-faltante"]),
      JSON.stringify(["/api/inventario/existencias/agrupadas"]),
      JSON.stringify(["/api/inventario/auditorias/41"]),
      JSON.stringify(["/api/notificaciones"]),
      JSON.stringify(["/api/notificaciones/feed"]),
    ]));
    expect(harness.onSuccess).toHaveBeenCalledTimes(1);
    expect(harness.onOpenChange).toHaveBeenCalledWith(false);
  });
});