import React from "react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as api from "@workspace/api-client-react";
import * as auditFloors from "@/components/auditoria/use-audit-floors";
import * as toastHooks from "@/hooks/use-toast";
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
  { id: 3, nombre: "Sur", iniciales: "SU" },
]);
const audits = ListAuditoriasInventarioResponse.parse([
  { id: 41, folio: 41, folioFormateado: "CE-AI-41", ubicacionId: 1, nombreUbicacion: "Centro", estado: "ABIERTA", totalSnapshot: 1, totalEscaneados: 0, cuadros: 0, faltantes: 0, sobrantes: 0, malAcomodados: 0, abiertaAt: "2026-09-24T10:00:00Z", creadaPor: "Admin" },
  { id: 42, folio: 42, folioFormateado: "NO-AI-42", ubicacionId: 2, nombreUbicacion: "Norte", estado: "ABIERTA", totalSnapshot: 1, totalEscaneados: 0, cuadros: 0, faltantes: 0, sobrantes: 0, malAcomodados: 0, abiertaAt: "2026-09-24T10:00:00Z", creadaPor: "Admin" },
  { id: 43, folio: 43, folioFormateado: "CE-AI-43", ubicacionId: 1, nombreUbicacion: "Centro", estado: "ABIERTA", totalSnapshot: 3, totalEscaneados: 1, cuadros: 1, faltantes: 2, sobrantes: 0, malAcomodados: 0, abiertaAt: "2026-09-24T10:00:00Z", creadaPor: "Admin" },
]);
const details = new Map(audits.map((audit) => [audit.id, GetAuditoriaInventarioResponse.parse({
  ...audit, creadaPor: "Admin", resultados: [], participantes: [],
  participantesActivos: 0, maxParticipantes: 5, expiracionSegundos: 90,
})]));
const configuredFloors = new Map([
  [1, [
    { id: 11, ubicacionId: 1, nombre: "Primer piso", activo: true },
    { id: 12, ubicacionId: 1, nombre: "Segundo piso", activo: true },
    { id: 13, ubicacionId: 1, nombre: "Tercer piso", activo: true },
  ]],
  [2, [{ id: 21, ubicacionId: 2, nombre: "Piso 3", activo: true }]],
  [3, [{ id: 31, ubicacionId: 3, nombre: "Piso sur", activo: true }]],
]);

function setup({ url = "/inventario/auditorias?auditoriaId=41", delayed = false, joined = false, joinError = false, canCreate = true, canEdit = true, mobile = false, noFloors = false, loadingFloors = false } = {}) {
  window.history.replaceState({}, "", url);
  vi.spyOn(navigator, "userAgent", "get").mockReturnValue(mobile ? "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Mobile" : "Mozilla/5.0 (X11; Linux x86_64)");
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
  vi.spyOn(api, "useGetCurrentUser").mockReturnValue({ data: {
    id: joined || joinError ? 7 : undefined,
    rol: canCreate ? "ADMIN" : "ALMACEN",
    permisos: canCreate ? [] : [{ modulo: "auditoria_inventario", puedeVer: true, puedeCrear: false, puedeEditar: canEdit, puedeAutorizar: false }],
  } } as any);
  if (joined || joinError) {
    const fetch = vi.spyOn(api, "customFetch").mockResolvedValue({
      participantesActivos: 1, maxParticipantes: 5, expiracionSegundos: 90,
      expiraAt: new Date(Date.now() + 90_000).toISOString(),
    } as any);
    if (joinError) fetch.mockRejectedValueOnce({
      data: { code: "AUDIT_PARTICIPANT_LIMIT", error: "Ya hay 5 usuarios activos en esta auditoría. Espera a que se libere un lugar." },
    });
  }
  vi.spyOn(api, "useListSitiosAuditoriaInventario").mockReturnValue({ data: sites } as any);
  vi.spyOn(api, "useListAuditoriasInventario").mockImplementation(() => {
    refresh();
    return { data: audits, isLoading: false, isError: false } as any;
  });
  vi.spyOn(api, "useListProductos").mockReturnValue({ data: [] } as any);
  const floors = vi.spyOn(auditFloors, "useAuditFloors").mockImplementation((id) => ({
    data: loadingFloors ? undefined : noFloors ? [] : configuredFloors.get(details.get(id ?? 0)?.ubicacionId ?? 0) ?? [],
    isLoading: loadingFloors, isError: false,
  }) as any);
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
  vi.useRealTimers();
  vi.restoreAllMocks();
  window.history.replaceState({}, "", "/inventario/auditorias");
});

describe("mounted audit site/selection ownership", () => {
  test("mobile floor selection requires explicit confirmation; cancel preserves the committed floor", async () => {
    const page = setup({ joined: true, mobile: true });
    fireEvent.click(screen.getByTestId("button-join-audit-41"));
    await waitFor(() => expect(screen.getByTestId("dialog-audit-floor")).toBeTruthy());
    expect((screen.getByTestId("input-audit-scan") as HTMLInputElement).disabled).toBe(true);
    fireEvent.change(screen.getByTestId("select-audit-floor"), { target: { value: "12" } });
    fireEvent.click(screen.getByTestId("button-continue-audit-floor"));
    expect(screen.getByTestId("audit-floor-confirmation").textContent).toContain("Segundo piso");
    expect(screen.getByTestId("audit-floor-name").textContent).toContain("Selecciona un piso");
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(screen.getByTestId("audit-floor-name").textContent).toContain("Selecciona un piso");
    fireEvent.click(screen.getByTestId("button-change-audit-floor"));
    fireEvent.change(screen.getByTestId("select-audit-floor"), { target: { value: "12" } });
    fireEvent.click(screen.getByTestId("button-continue-audit-floor"));
    fireEvent.click(screen.getByTestId("button-confirm-audit-floor"));
    expect(screen.getByTestId("audit-floor-name").textContent).toBe("Segundo piso");
    expect((screen.getByTestId("input-audit-scan") as HTMLInputElement).disabled).toBe(false);
    const originalWidth = window.innerWidth;
    try {
      Object.defineProperty(window, "innerWidth", { configurable: true, value: 1400 });
      fireEvent(window, new Event("resize"));
      page.rerender();
      expect(screen.getByTestId("button-change-audit-floor")).toBeTruthy();
    } finally {
      Object.defineProperty(window, "innerWidth", { configurable: true, value: originalWidth });
    }
    const scan = page.mutations.find((mutation) => mutation.name === "useScanAuditoriaInventario")!;
    fireEvent.change(screen.getByTestId("input-audit-scan"), { target: { value: "ABC-1" } });
    fireEvent.keyDown(screen.getByTestId("input-audit-scan"), { key: "Enter" });
    expect(scan.mutateAsync).toHaveBeenCalledWith({ id: 41, data: { serie: "ABC-1", pisoId: 12 } });
    fireEvent.click(screen.getByTestId("button-change-audit-floor"));
    fireEvent.change(screen.getByTestId("select-audit-floor"), { target: { value: "13" } });
    fireEvent.click(screen.getByTestId("button-continue-audit-floor"));
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(screen.getByTestId("audit-floor-name").textContent).toBe("Segundo piso");
  });

  test("desktop uses first configured floor (not a hard-coded ground floor), even at phone-width viewport", async () => {
    const page = setup({ joined: true });
    fireEvent.click(screen.getByTestId("button-join-audit-41"));
    await waitFor(() => expect((screen.getByTestId("input-audit-scan") as HTMLInputElement).disabled).toBe(false));
    expect(screen.getByTestId("audit-floor-name").textContent).toBe("Primer piso");
    expect(screen.queryByTestId("button-change-audit-floor")).toBeNull();
    const originalWidth = window.innerWidth;
    try {
      Object.defineProperty(window, "innerWidth", { configurable: true, value: 375 });
      fireEvent(window, new Event("resize"));
      page.rerender();
      expect(screen.queryByTestId("button-change-audit-floor")).toBeNull();
      expect(screen.getByTestId("audit-floor-name").textContent).toBe("Primer piso");
    } finally {
      Object.defineProperty(window, "innerWidth", { configurable: true, value: originalWidth });
    }
  });

  test("unconfigured or loading site floors visibly block both device modes", async () => {
    const empty = setup({ joined: true, noFloors: true });
    fireEvent.click(screen.getByTestId("button-join-audit-41"));
    await waitFor(() => expect(screen.getByTestId("status-audit-participation").textContent).toContain("Puedes escanear"));
    expect(screen.getByTestId("audit-floor-name").textContent).toContain("Faltan pisos configurados");
    expect((screen.getByTestId("input-audit-scan") as HTMLInputElement).disabled).toBe(true);
    empty.unmount();
    const loading = setup({ joined: true, mobile: true, loadingFloors: true });
    fireEvent.click(screen.getByTestId("button-join-audit-41"));
    expect(screen.getByTestId("audit-floor-name").textContent).toContain("Cargando pisos");
    expect((screen.getByTestId("input-audit-scan") as HTMLInputElement).disabled).toBe(true);
    expect(loading.mutations.find((mutation) => mutation.name === "useScanAuditoriaInventario")!.mutateAsync).not.toHaveBeenCalled();
  });

  test("removing the previously confirmed mobile floor invalidates scans immediately", async () => {
    const page = setup({ joined: true, mobile: true });
    const original = configuredFloors.get(1)!;
    try {
      fireEvent.click(screen.getByTestId("button-join-audit-41"));
      await waitFor(() => expect(screen.getByTestId("select-audit-floor")).toBeTruthy());
      fireEvent.change(screen.getByTestId("select-audit-floor"), { target: { value: "12" } });
      fireEvent.click(screen.getByTestId("button-continue-audit-floor"));
      fireEvent.click(screen.getByTestId("button-confirm-audit-floor"));
      expect((screen.getByTestId("input-audit-scan") as HTMLInputElement).disabled).toBe(false);
      configuredFloors.set(1, original.filter((floor) => floor.id !== 12));
      page.rerender();
      expect(screen.getByTestId("audit-floor-name").textContent).toBe("Selecciona un piso");
      expect((screen.getByTestId("input-audit-scan") as HTMLInputElement).disabled).toBe(true);
    } finally {
      configuredFloors.set(1, original);
    }
  });

  test("every open audit in the selected site has a large explicit join card, including mobile layout", async () => {
    const page = setup({ joined: true });
    await waitFor(() => expect(page.site().value).toBe("1"));
    const cards = screen.getByTestId("open-audit-list");
    expect(cards.className).toContain("grid-cols-1");
    expect(cards.className).toContain("md:grid-cols-2");
    expect(screen.getByTestId("open-audit-41").textContent).toContain("CE-AI-41");
    expect(screen.getByTestId("open-audit-43").textContent).toContain("CE-AI-43");
    expect(screen.queryByTestId("open-audit-42")).toBeNull();
    expect(screen.getByTestId("button-join-audit-41").textContent).toBe("Unirme a la auditoría");
    expect(screen.getByTestId("button-join-audit-43").textContent).toBe("Unirme a la auditoría");
    expect(screen.queryByTestId("button-open-audit")).toBeNull();
    expect(api.customFetch).not.toHaveBeenCalled();
    expect(screen.getByTestId("audit-floor-name").textContent).toBe("Primer piso");
    expect(screen.queryByTestId("button-change-audit-floor")).toBeNull();
    expect(screen.getByTestId("shared-escaneados").textContent).toBe("0");
    expect(screen.getByTestId("shared-faltantes").textContent).toBe("0");
  });

  test("no open audit offers create only to a permitted user", async () => {
    const page = setup();
    page.changeSite(3);
    expect(screen.getByTestId("status-no-open-audits").textContent).toContain("No hay auditorías abiertas");
    fireEvent.click(screen.getByTestId("button-open-audit"));
    expect(page.mutations.find((m) => m.name === "useCreateAuditoriaInventario")!.mutate)
      .toHaveBeenCalledWith({ data: { ubicacionId: 3 } }, expect.anything());
    page.unmount();
    const restricted = setup({ canCreate: false });
    restricted.changeSite(3);
    expect(screen.queryByTestId("button-open-audit")).toBeNull();
    expect(screen.getByTestId("status-no-open-audits").textContent).toContain("Consulta el historial");
  });

  test("audit editor without ubicaciones/ver can load audit-scoped floors and scan", async () => {
    const page = setup({ joined: true, canCreate: false });
    expect(screen.queryByTestId("button-open-audit")).toBeNull();
    expect(screen.queryByTestId("button-close-audit")).toBeNull();
    expect(screen.getByTestId("button-cancel-audit")).toBeTruthy();
    fireEvent.click(screen.getByTestId("button-join-audit-41"));
    await waitFor(() => expect((screen.getByTestId("input-audit-scan") as HTMLInputElement).disabled).toBe(false));
    expect(screen.queryByTestId("button-close-audit")).toBeNull();
    expect(page.floors).toHaveBeenCalledWith(41, 7, true);
    expect(screen.getByTestId("audit-floor-name").textContent).toBe("Primer piso");
    fireEvent.change(screen.getByTestId("input-audit-scan"), { target: { value: "EDIT-001" } });
    fireEvent.keyDown(screen.getByTestId("input-audit-scan"), { key: "Enter" });
    expect(page.mutations.find((mutation) => mutation.name === "useScanAuditoriaInventario")!.mutateAsync)
      .toHaveBeenCalledWith({ id: 41, data: { serie: "EDIT-001", pisoId: 11 } });
    expect(page.mutations.find((mutation) => mutation.name === "useCloseAuditoriaInventario")!.mutate).not.toHaveBeenCalled();
  });

  test("scan toast never presents provisional CUADRO/SOBRANTE as authoritative classification", async () => {
    const toast = vi.fn();
    vi.spyOn(toastHooks, "useToast").mockReturnValue({ toast } as any);
    const page = setup({ joined: true });
    const scan = page.mutations.find((mutation) => mutation.name === "useScanAuditoriaInventario")!;
    scan.mutateAsync.mockResolvedValue({
      serie: "TEST-001", duplicado: true, clasificacion: "CUADRO",
      estadoActual: "DISPONIBLE", usuarioNombre: "Alicia",
    });
    fireEvent.click(screen.getByTestId("button-join-audit-41"));
    await waitFor(() => expect((screen.getByTestId("input-audit-scan") as HTMLInputElement).disabled).toBe(false));
    fireEvent.change(screen.getByTestId("input-audit-scan"), { target: { value: "TEST-001" } });
    fireEvent.keyDown(screen.getByTestId("input-audit-scan"), { key: "Enter" });
    await waitFor(() => expect(toast).toHaveBeenCalledWith({
      title: "Serie ya registrada",
      description: "TEST-001 · Registrado · DISPONIBLE · Escaneado por Alicia",
    }));
    expect(toast.mock.calls.map(([value]) => value.description).join(" ")).not.toMatch(/CUADRO|SOBRANTE/);
  });

  test("a read-only auditor sees neither close nor cancel; ADMIN can close without joining", () => {
    const viewer = setup({ joined: true, canCreate: false, canEdit: false });
    expect(screen.queryByTestId("button-close-audit")).toBeNull();
    expect(screen.queryByTestId("button-cancel-audit")).toBeNull();
    viewer.noWrites();
    viewer.unmount();
    const admin = setup({ joined: true });
    expect(api.customFetch).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId("button-close-audit"));
    expect(admin.mutations.find((mutation) => mutation.name === "useCloseAuditoriaInventario")!.mutate)
      .toHaveBeenCalledWith({ id: 41 }, expect.anything());
    expect(api.customFetch).not.toHaveBeenCalled();
  });

  test("intentional creation joins the newly created audit, not a previous site's audit", async () => {
    const page = setup({ joined: true });
    page.changeSite(3);
    fireEvent.click(screen.getByTestId("button-open-audit"));
    const create = page.mutations.find((m) => m.name === "useCreateAuditoriaInventario")!;
    const created = { ...audits[0], id: 44, ubicacionId: 3, nombreUbicacion: "Sur", folioFormateado: "SU-AI-44" };
    details.set(44, GetAuditoriaInventarioResponse.parse({
      ...created, participantesActivos: 0, maxParticipantes: 5, expiracionSegundos: 90,
      resultados: [], participantes: [],
    }));
    try {
      await act(async () => {
        create.mutate.mock.calls[0]![1].onSuccess(created);
      });
      await waitFor(() => expect(api.customFetch).toHaveBeenCalledWith(
        "/api/inventario/auditorias/44/participar", { method: "POST" },
      ));
      expect(screen.getByTestId("text-audit-folio").textContent).toBe("SU-AI-44");
    } finally {
      details.delete(44);
    }
  });

  test("browsing and direct links never send an admission or heartbeat before explicit click", async () => {
    vi.useFakeTimers();
    setup({ joined: true, url: "/inventario/auditorias?auditoriaId=41" });
    await act(async () => { vi.advanceTimersByTime(60_000); });
    expect(api.customFetch).not.toHaveBeenCalled();
    expect((screen.getByTestId("input-audit-scan") as HTMLInputElement).disabled).toBe(true);
    fireEvent.click(screen.getByTestId("button-join-audit-41"));
    await act(async () => { await Promise.resolve(); });
    expect(api.customFetch).toHaveBeenCalledTimes(1);
    await act(async () => { vi.advanceTimersByTime(20_000); });
    expect(api.customFetch).toHaveBeenCalledTimes(2);
  });

  test("shared scanned/missing counts and original scanner update from refreshed detail", async () => {
    const page = setup({ joined: true });
    const original = details.get(41)!;
    const timestamp = "2026-09-24T10:01:00Z";
    details.set(41, GetAuditoriaInventarioResponse.parse({
      ...original, totalEscaneados: 2, faltantes: 2, malAcomodados: 1, participantesActivos: 1,
      participantes: [{
        usuarioId: 8, nombre: "Alicia", escaneos: 1, primeroAt: timestamp,
        ultimoAt: timestamp, activo: true, expiraAt: "2026-09-24T12:00:00Z",
      }],
      resultados: [{
        serie: "TEST-001", usuarioId: 8, usuarioNombre: "Alicia", escaneadoAt: timestamp,
        clasificacion: "CUADRO", cantidad: null, unidad: null, estadoActual: "DISPONIBLE", resolucion: "PENDIENTE",
      }, {
        serie: "TEST-002", usuarioId: 8, usuarioNombre: "Alicia", escaneadoAt: timestamp,
        clasificacion: "MAL_ACOMODADO", cantidad: null, unidad: null,
        pisoEsperado: "Primer piso", pisoReal: "Tercer piso",
        estadoActual: "DISPONIBLE", resolucion: "PENDIENTE",
      }],
    }));
    try {
      page.rerender();
      expect(screen.getByTestId("shared-escaneados").textContent).toBe("2");
      expect(screen.getByTestId("shared-faltantes").textContent).toBe("2");
      expect(screen.getByTestId("audit-participant-names").textContent).toBe("Alicia");
      expect(screen.getByTestId("audit-scanner-TEST-001").textContent).toContain("Escaneado por Alicia");
      expect(screen.getByTestId("audit-floor-difference-TEST-002").textContent).toContain("Esperado: Primer piso");
      expect(screen.getByTestId("audit-floor-difference-TEST-002").textContent).toContain("Real: Tercer piso");
      expect(page.detail).toHaveBeenCalledWith(41, expect.objectContaining({
        query: expect.objectContaining({ refetchIntervalInBackground: true }),
      }));
    } finally {
      details.set(41, original);
    }
  });

  test("initial audit A, manual B, refresh and stale URL never select A again; B joins B", async () => {
    const page = setup({ url: "/inventario/auditorias?auditoriaId=41", joined: true });
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
    expect(screen.queryByTestId("button-open-audit")).toBeNull();
    fireEvent.click(screen.getByTestId("button-join-audit-42"));
    const create = page.mutations.find((m) => m.name === "useCreateAuditoriaInventario")!;
    expect(create.mutate).not.toHaveBeenCalled();
    await waitFor(() => expect(api.customFetch).toHaveBeenCalledWith("/api/inventario/auditorias/42/participar", { method: "POST" }));
    for (const mutation of page.mutations) {
      expect(mutation.mutate).not.toHaveBeenCalled();
    }
  });

  test("site switch is read-only; reopening A restores its own detail, floors and scan id", async () => {
    const page = setup({ joined: true });
    await waitFor(() => expect(page.site().value).toBe("1"));
    page.changeSite(2);
    await waitFor(() => expect(Boolean(screen.queryByTestId("text-audit-folio"))).toBe(false));
    page.noWrites();
    fireEvent.click(screen.getByTestId("button-audit-42"));
    await waitFor(() => expect(page.site().value).toBe("2"));
    expect(screen.getByTestId("text-audit-folio").textContent).toBe("NO-AI-42");
    expect(page.floors).toHaveBeenCalledWith(42, 7, true);
    page.changeSite(1);
    await waitFor(() => expect(Boolean(screen.queryByTestId("button-audit-41"))).toBe(true));
    fireEvent.click(screen.getByTestId("button-audit-41"));
    await waitFor(() => expect(page.site().value).toBe("1"));
    expect(screen.getByTestId("text-audit-folio").textContent).toBe("CE-AI-41");
    expect(page.floors).toHaveBeenCalledWith(41, 7, true);
    fireEvent.click(screen.getByTestId("button-audit-detail-join"));
    await waitFor(() => expect(screen.getByTestId("status-audit-participation").textContent).toContain("Puedes escanear"));
    fireEvent.change(screen.getByTestId("input-audit-scan"), { target: { value: "TEST-001" } });
    fireEvent.keyDown(screen.getByTestId("input-audit-scan"), { key: "Enter" });
    const scan = page.mutations.find((m) => m.name === "useScanAuditoriaInventario")!;
    await waitFor(() => expect(scan.mutateAsync).toHaveBeenCalledWith(
      { id: 41, data: { serie: "TEST-001", pisoId: 11 } },
    ));
  });

  test("scanner waits for admission and serializes rapid local submits", async () => {
    const page = setup({ joined: true });
    const scan = page.mutations.find((m) => m.name === "useScanAuditoriaInventario")!;
    let complete!: (value: unknown) => void;
    scan.mutateAsync.mockImplementation(() => new Promise((resolve) => { complete = resolve; }));
    expect(api.customFetch).not.toHaveBeenCalled();
    expect((screen.getByTestId("input-audit-scan") as HTMLInputElement).disabled).toBe(true);
    fireEvent.click(screen.getByTestId("button-join-audit-41"));
    await waitFor(() => expect(screen.getByTestId("status-audit-participation").textContent).toContain("Puedes escanear"));
    const input = screen.getByTestId("input-audit-scan");
    fireEvent.change(input, { target: { value: "TEST-001" } });
    fireEvent.keyDown(input, { key: "Enter" });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(scan.mutateAsync).toHaveBeenCalledTimes(1);
    expect(scan.mutateAsync).toHaveBeenCalledWith({ id: 41, data: { serie: "TEST-001", pisoId: 11 } });
    complete({ serie: "TEST-001", duplicado: false, clasificacion: "CUADRO", estadoActual: "DISPONIBLE" });
    await waitFor(() => expect(screen.getByTestId("input-audit-scan")).toBeTruthy());
  });

  test("sixth user sees full message, cannot scan, and can retry the same audit", async () => {
    const page = setup({ joinError: true });
    fireEvent.click(screen.getByTestId("button-join-audit-41"));
    await waitFor(() => expect(screen.getByTestId("status-audit-participation").textContent).toContain("Ya hay 5 usuarios activos"));
    expect((screen.getByTestId("input-audit-scan") as HTMLInputElement).disabled).toBe(true);
    fireEvent.keyDown(screen.getByTestId("input-audit-scan"), { key: "Enter" });
    expect(page.mutations.find((m) => m.name === "useScanAuditoriaInventario")!.mutateAsync).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId("button-audit-retry-join"));
    await waitFor(() => expect((screen.getByTestId("input-audit-scan") as HTMLInputElement).disabled).toBe(false));
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