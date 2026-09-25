import React from "react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as api from "@workspace/api-client-react";
import {
  GetAuditoriaInventarioResponse,
  ListAuditoriasInventarioResponse,
  ListSitiosAuditoriaInventarioResponse,
} from "@workspace/api-zod";
import AuditoriasInventario from "./auditorias-inventario";

vi.mock("@/components/layout/app-layout", () => ({
  AppLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock("@/components/auditoria-inventario-print", () => ({ AuditoriaInventarioPrint: () => null }));
// Native controls stand in for Radix's portal/pointer plumbing, not the page's selection logic.
vi.mock("@/components/ui/select", () => ({
  Select: ({ value, onValueChange, children }: any) => {
    const [trigger, content] = React.Children.toArray(children) as React.ReactElement<any>[];
    return <select data-testid={trigger.props["data-testid"]} value={value}
      onChange={(event) => onValueChange(event.target.value)}>
      <option value="" disabled>Seleccionar</option>
      {content.props.children}
    </select>;
  },
  SelectTrigger: () => null,
  SelectValue: () => null,
  SelectContent: ({ children }: any) => <>{children}</>,
  SelectItem: ({ value, children }: any) => <option value={value}>{children}</option>,
}));
vi.mock("@/components/campo-escaneo", () => ({
  CampoEscaneo: React.forwardRef<HTMLInputElement, any>(function Scanner({ onChange, onScan, value, ...props }, ref) {
    return <input {...props} ref={ref} value={value} onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => { if (e.key === "Enter") void onScan(value, { serie: value }, "manual"); }} />;
  }),
}));

const sites = ListSitiosAuditoriaInventarioResponse.parse([
  { id: 1, nombre: "Centro", iniciales: "CE" },
  { id: 2, nombre: "Norte", iniciales: "NO" },
]);
const audits = ListAuditoriasInventarioResponse.parse([
  { id: 41, folio: 41, folioFormateado: "CE-AI-41", ubicacionId: 1, nombreUbicacion: "Centro", estado: "ABIERTA", totalSnapshot: 1, totalEscaneados: 0, cuadros: 0, faltantes: 0, sobrantes: 0, malAcomodados: 0, abiertaAt: "2026-09-24T10:00:00Z", creadaPor: "Admin" },
  { id: 42, folio: 42, folioFormateado: "NO-AI-42", ubicacionId: 2, nombreUbicacion: "Norte", estado: "ABIERTA", totalSnapshot: 1, totalEscaneados: 0, cuadros: 0, faltantes: 0, sobrantes: 0, malAcomodados: 0, abiertaAt: "2026-09-24T10:00:00Z", creadaPor: "Admin" },
]);
const details = new Map(audits.map((audit) => [audit.id, GetAuditoriaInventarioResponse.parse({
  ...audit, creadaPor: "Admin", resultados: [], participantes: [],
})]));

function setup({ url = "/inventario/auditorias", delayed = false } = {}) {
  window.history.replaceState({}, "", url);
  let detailReady = !delayed;
  const refresh = vi.fn();
  const mutationNames = [
    "useCreateProducto", "useScanAuditoriaInventario", "useCloseAuditoriaInventario",
    "useCancelAuditoriaInventario", "useConfirmAuditoriaInventario", "useCreateAuditoriaInventario",
  ] as const;
  const mutations = mutationNames.map((name) => {
    const mutate = vi.fn();
    const mutateAsync = vi.fn().mockResolvedValue({ serie: "TEST-001", duplicado: false, clasificacion: "CUADRO", estadoActual: "DISPONIBLE" });
    vi.spyOn(api, name).mockReturnValue({ mutate, mutateAsync, isPending: false } as any);
    return { name, mutate, mutateAsync };
  });
  vi.spyOn(api, "useGetCurrentUser").mockReturnValue({ data: { rol: "ADMIN" } } as any);
  vi.spyOn(api, "useListSitiosAuditoriaInventario").mockReturnValue({ data: sites } as any);
  vi.spyOn(api, "useListAuditoriasInventario").mockImplementation(() => {
    refresh();
    return { data: audits, isLoading: false, isError: false } as any;
  });
  vi.spyOn(api, "useListProductos").mockReturnValue({ data: [] } as any);
  const floors = vi.spyOn(api, "useListPisosLocation").mockImplementation(() => ({ data: [] }) as any);
  const detail = vi.spyOn(api, "useGetAuditoriaInventario").mockImplementation((id) => ({
    data: detailReady ? details.get(id) : undefined, isLoading: !detailReady, isError: false,
  }) as any);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const view = render(<QueryClientProvider client={client}><AuditoriasInventario /></QueryClientProvider>);
  const site = () => screen.getByTestId("select-audit-site") as HTMLSelectElement;
  const changeSite = (id: number) => fireEvent.change(site(), { target: { value: String(id) } });
  const noWrites = () => {
    for (const mutation of mutations) {
      expect(mutation.mutate, mutation.name).not.toHaveBeenCalled();
      expect(mutation.mutateAsync, mutation.name).not.toHaveBeenCalled();
    }
  };
  return { ...view, site, changeSite, detail, floors, mutations, noWrites, refresh,
    resolveDetail: () => { detailReady = true; view.rerender(<QueryClientProvider client={client}><AuditoriasInventario /></QueryClientProvider>); },
    rerender: () => view.rerender(<QueryClientProvider client={client}><AuditoriasInventario /></QueryClientProvider>),
  };
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  window.history.replaceState({}, "", "/inventario/auditorias");
});

describe("mounted audit site/selection ownership", () => {
  test("initial audit A, manual B, refresh and stale URL never select A again; B starts B", async () => {
    const page = setup({ url: "/inventario/auditorias?auditoriaId=41" });
    await waitFor(() => expect(page.site().value).toBe("1"));
    expect(screen.getByTestId("text-audit-folio").textContent).toBe("CE-AI-41");
    page.changeSite(2);
    await waitFor(() => {
      expect(page.site().value).toBe("2");
      expect(Boolean(screen.queryByTestId("text-audit-folio"))).toBe(false);
      expect(Boolean(screen.queryByTestId("button-audit-41"))).toBe(false);
      expect(Boolean(screen.queryByTestId("button-audit-42"))).toBe(true);
    });
    page.rerender(); // periodic list refresh with the same deep link
    expect(page.site().value).toBe("2");
    expect(Boolean(screen.queryByTestId("text-audit-folio"))).toBe(false);
    expect(Boolean(screen.queryByTestId("button-audit-41"))).toBe(false);
    fireEvent.click(screen.getByTestId("button-open-audit"));
    const create = page.mutations.find((m) => m.name === "useCreateAuditoriaInventario")!;
    expect(create.mutate).toHaveBeenCalledWith(expect.objectContaining({ data: { ubicacionId: 2 } }), expect.anything());
    for (const mutation of page.mutations.filter((m) => m !== create)) {
      expect(mutation.mutate).not.toHaveBeenCalled();
    }
  });

  test("site switch is read-only; reopening A restores its own detail, floors and scan id", async () => {
    const page = setup();
    await waitFor(() => expect(page.site().value).toBe("1"));
    page.changeSite(2);
    await waitFor(() => expect(Boolean(screen.queryByTestId("text-audit-folio"))).toBe(false));
    page.noWrites();
    fireEvent.click(screen.getByTestId("button-audit-42"));
    await waitFor(() => expect(page.site().value).toBe("2"));
    expect(screen.getByTestId("text-audit-folio").textContent).toBe("NO-AI-42");
    expect(page.floors).toHaveBeenCalledWith(2, expect.anything());
    page.changeSite(1);
    await waitFor(() => expect(Boolean(screen.queryByTestId("button-audit-41"))).toBe(true));
    fireEvent.click(screen.getByTestId("button-audit-41"));
    await waitFor(() => expect(page.site().value).toBe("1"));
    expect(screen.getByTestId("text-audit-folio").textContent).toBe("CE-AI-41");
    expect(page.floors).toHaveBeenCalledWith(1, expect.anything());
    fireEvent.change(screen.getByTestId("input-audit-scan"), { target: { value: "TEST-001" } });
    fireEvent.keyDown(screen.getByTestId("input-audit-scan"), { key: "Enter" });
    const scan = page.mutations.find((m) => m.name === "useScanAuditoriaInventario")!;
    await waitFor(() => expect(scan.mutateAsync).toHaveBeenCalledWith(
      { id: 41, data: { serie: "TEST-001", pisoId: null } }, expect.anything(),
    ));
  });

  test("delayed detail synchronizes site once per new selected audit, not on subsequent refresh", async () => {
    const page = setup({ delayed: true });
    await waitFor(() => expect(page.detail).toHaveBeenCalledWith(41, expect.objectContaining({ query: expect.objectContaining({ enabled: true }) })));
    page.resolveDetail();
    await waitFor(() => expect(page.site().value).toBe("1"));
    page.changeSite(2);
    await waitFor(() => expect(Boolean(screen.queryByTestId("button-audit-42"))).toBe(true));
    fireEvent.click(screen.getByTestId("button-audit-42"));
    await waitFor(() => expect(page.site().value).toBe("2"));
    page.rerender();
    expect(page.site().value).toBe("2");
    page.noWrites();
  });
});