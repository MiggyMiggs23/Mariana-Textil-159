import type { ReactNode } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { Chofer } from "@workspace/api-client-react";
import { toast } from "sonner";
import Choferes from "./choferes";
import type { TelefonoChofer } from "./chofer-telefonos";

// Mount the real directory, dialogs, phone editor and generated API hooks.
// Only the unrelated app shell and transport are replaced.
vi.mock("@/components/layout/app-layout", () => ({
  AppLayout: ({ children }: { children: ReactNode }) => <main>{children}</main>,
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

type DirectoryChofer = Omit<Chofer, "telefonos"> & { telefonos?: TelefonoChofer[] };
const legacy: DirectoryChofer = {
  id: 1,
  nombreCompleto: "Chofer anterior",
  telefono: "5551000000",
  activo: true,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
};
const phones: TelefonoChofer[] = [
  { numero: "5552000001", etiqueta: "Personal" },
  { numero: "5552000002", etiqueta: "Trabajo" },
  { numero: "5552000003" },
  { numero: "5552000004", etiqueta: "Alternativo" },
  { numero: "5552000005" },
];
let rows: DirectoryChofer[];
let client: QueryClient;
let role: string;
let failSave: boolean;
const writes: { method: string; path: string; data: Record<string, unknown> }[] = [];

function mount() {
  return render(<QueryClientProvider client={client}><Choferes /></QueryClientProvider>);
}
function change(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}
function phoneInputs() {
  return within(screen.getByRole("dialog")).getAllByLabelText(/^Teléfono \d+ \*$/);
}
function multiPhoneChofer(): DirectoryChofer {
  return { ...legacy, telefono: phones[0].numero, telefonos: phones.map(phone => ({ ...phone })) };
}
async function edit() {
  fireEvent.click(await screen.findByRole("button", { name: `Editar ${legacy.nombreCompleto}` }));
  return screen.getByRole("dialog");
}

beforeEach(() => {
  rows = [{ ...legacy }];
  role = "ADMIN";
  failSave = false;
  writes.length = 0;
  vi.clearAllMocks();
  client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, options?: RequestInit) => {
    const path = new URL(String(input), "http://localhost").pathname;
    const method = options?.method ?? "GET";
    const response = (value: unknown, status = 200) =>
      new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json" } });
    if (path === "/api/auth/me") return response({ id: 1, rol: role, permisos: [] });
    if (path === "/api/choferes" && method === "GET") return response(rows);
    if (path.startsWith("/api/choferes") && (method === "POST" || method === "PATCH")) {
      const data = JSON.parse(options?.body as string);
      writes.push({ method, path, data });
      if (failSave) return response({ error: "No se pudo guardar la lista" }, 400);
      if (method === "POST") {
        const created = { ...legacy, ...data, id: 2 };
        rows = [...rows, created];
        return response(created);
      }
      rows = rows.map(row => row.id === Number(path.split("/").at(-1)) ? { ...row, ...data } : row);
      return response(rows.find(row => row.id === Number(path.split("/").at(-1))));
    }
    throw new Error(`Unexpected test request: ${method} ${path}`);
  }));
});

afterEach(() => {
  cleanup();
  client.clear();
  vi.unstubAllGlobals();
});

it("adds five phone rows, permits a sixth, and POSTs the complete ordered list plus the primary", async () => {
  mount();
  fireEvent.click(await screen.findByRole("button", { name: "Nuevo chofer" }));
  change("Nombre completo *", "  Nuevo contacto  ");
  change("Teléfono 1 *", " 5553000001 ");
  change("Etiqueta 1 (opcional)", " Personal ");
  for (let number = 2; number <= 5; number++) {
    fireEvent.click(screen.getByRole("button", { name: "Agregar teléfono" }));
    change(`Teléfono ${number} *`, `555300000${number}`);
  }
  expect(phoneInputs()).toHaveLength(5);
  fireEvent.click(screen.getByRole("button", { name: "Agregar teléfono" }));
  change("Teléfono 6 *", "5553000006");
  change("Etiqueta 6 (opcional)", "   ");
  expect(phoneInputs()).toHaveLength(6);
  expect(screen.getAllByText("Principal")).toHaveLength(1);
  fireEvent.click(screen.getByRole("button", { name: "Registrar chofer" }));
  await waitFor(() => expect(writes).toHaveLength(1));
  expect(writes[0]).toEqual({
    method: "POST",
    path: "/api/choferes",
    data: {
      nombreCompleto: "Nuevo contacto",
      activo: true,
      telefono: "5553000001",
      telefonos: [
        { numero: "5553000001", etiqueta: "Personal" },
        ...[2, 3, 4, 5, 6].map(number => ({ numero: `555300000${number}` })),
      ],
    },
  });
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(await screen.findAllByText("Nuevo contacto")).toHaveLength(2);
  expect(screen.queryByText("5553000006")).toBeNull();
});

it("opens all five existing phones, edits one, removes the principal and PATCHes the new principal", async () => {
  rows = [multiPhoneChofer()];
  mount();
  await edit();
  expect(phoneInputs().map(input => (input as HTMLInputElement).value)).toEqual(phones.map(phone => phone.numero));
  change("Teléfono 3 *", "5559999999");
  change("Etiqueta 2 (opcional)", "");
  fireEvent.click(screen.getByRole("button", { name: "Quitar teléfono 1" }));
  expect(phoneInputs()).toHaveLength(4);
  expect(screen.getByLabelText("Teléfono 1 *")).toHaveProperty("value", phones[1].numero);
  expect(screen.getAllByText("Principal")).toHaveLength(1);
  fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
  await waitFor(() => expect(writes).toHaveLength(1));
  expect(writes[0]).toEqual({
    method: "PATCH",
    path: "/api/choferes/1",
    data: {
      nombreCompleto: legacy.nombreCompleto,
      activo: true,
      telefono: phones[1].numero,
      telefonos: [{ numero: phones[1].numero }, { numero: "5559999999" }, phones[3], phones[4]],
    },
  });
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  await screen.findAllByText(phones[1].numero);
  await edit();
  expect(phoneInputs()).toHaveLength(4);
  expect(screen.getByLabelText("Teléfono 2 *")).toHaveProperty("value", "5559999999");
});

it("searches nonprimary phones while the table and mobile cards display only the primary", async () => {
  rows = [multiPhoneChofer(), { ...legacy, id: 2, nombreCompleto: "Otro chofer" }];
  mount();
  await screen.findByRole("button", { name: `Editar ${legacy.nombreCompleto}` });
  fireEvent.change(screen.getByPlaceholderText("Buscar por nombre o teléfono..."), { target: { value: phones[4].numero } });
  expect(screen.getAllByText(legacy.nombreCompleto)).toHaveLength(2);
  expect(screen.queryByText("Otro chofer")).toBeNull();
  expect(screen.getAllByText(phones[0].numero)).toHaveLength(2);
  expect(screen.queryByText(phones[4].numero)).toBeNull();
});

it.each([undefined, []])("preserves legacy telefono when telefonos is %j and keeps at least one row", async (telefonos) => {
  rows = [{ ...legacy, ...(telefonos ? { telefonos } : {}) }];
  mount();
  await screen.findByRole("button", { name: `Editar ${legacy.nombreCompleto}` });
  fireEvent.change(screen.getByPlaceholderText("Buscar por nombre o teléfono..."), { target: { value: legacy.telefono } });
  expect(screen.getAllByText(legacy.nombreCompleto)).toHaveLength(2);
  await edit();
  expect(phoneInputs()).toHaveLength(1);
  expect(screen.getByLabelText("Teléfono 1 *")).toHaveProperty("value", legacy.telefono);
  expect(screen.getByRole("button", { name: "Quitar teléfono 1" })).toHaveProperty("disabled", true);
  fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
  await waitFor(() => expect(writes).toHaveLength(1));
  expect(writes[0].data).toEqual({
    nombreCompleto: legacy.nombreCompleto,
    activo: true,
    telefono: legacy.telefono,
    telefonos: [{ numero: legacy.telefono }],
  });
});

it("moves a labeled phone up to principal without losing its label or other numbers", async () => {
  rows = [multiPhoneChofer()];
  mount();
  await edit();
  fireEvent.click(screen.getByRole("button", { name: "Subir teléfono 2" }));
  expect(screen.getByLabelText("Teléfono 1 *")).toHaveProperty("value", phones[1].numero);
  expect(screen.getByLabelText("Etiqueta 1 (opcional)")).toHaveProperty("value", "Trabajo");
  fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
  await waitFor(() => expect(writes).toHaveLength(1));
  expect(writes[0].data.telefono).toBe(phones[1].numero);
  expect(writes[0].data.telefonos).toEqual([phones[1], phones[0], ...phones.slice(2)]);
});

it("rejects empty added rows instead of silently dropping them and surfaces save errors", async () => {
  mount();
  await edit();
  fireEvent.click(screen.getByRole("button", { name: "Agregar teléfono" }));
  fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
  expect(writes).toHaveLength(0);
  expect(toast.error).toHaveBeenCalledWith("Datos incompletos", expect.any(Object));
  expect(phoneInputs()).toHaveLength(2);
  change("Teléfono 2 *", "5554000000");
  failSave = true;
  fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
  await waitFor(() => expect(toast.error).toHaveBeenCalledWith("No se pudo guardar el chofer", {
    description: "No se pudo guardar la lista",
  }));
  expect(screen.getByRole("dialog")).toBeTruthy();
  expect(screen.getByLabelText("Teléfono 2 *")).toHaveProperty("value", "5554000000");
});

it("keeps status changes status-only and leaves the phone list intact", async () => {
  rows = [multiPhoneChofer()];
  mount();
  fireEvent.click((await screen.findAllByRole("button", { name: "Desactivar" }))[0]);
  fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Desactivar" }));
  await waitFor(() => expect(writes).toHaveLength(1));
  expect(writes[0].data).toEqual({ activo: false });
  expect(rows[0].telefonos).toEqual(phones);
});

it("does not grant catalog editing to a non-manager", async () => {
  role = "VENDEDOR";
  mount();
  await screen.findAllByText(legacy.nombreCompleto);
  expect(screen.queryByRole("button", { name: "Nuevo chofer" })).toBeNull();
  expect(screen.queryByRole("button", { name: `Editar ${legacy.nombreCompleto}` })).toBeNull();
  expect(screen.queryByRole("button", { name: "Editar" })).toBeNull();
});