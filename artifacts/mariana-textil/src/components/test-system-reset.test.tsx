import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useGetCurrentUser, useLogin } from "@workspace/api-client-react";
import { TEST_RESET_LOGIN_MESSAGE, TEST_RESET_LOGIN_NOTICE_KEY, TestSystemResetButton } from "./test-system-reset";
import Login from "../pages/login";

vi.mock("@workspace/api-client-react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@workspace/api-client-react")>()),
  useGetCurrentUser: vi.fn(),
  useLogin: vi.fn(),
}));

const calls: Array<{ method: string; body?: string }> = [];
let available = true;
let protectCustomers = false;
let failPost = false;
let client: QueryClient;

function mount() {
  render(<QueryClientProvider client={client}><TestSystemResetButton /></QueryClientProvider>);
}

beforeEach(() => {
  calls.length = 0;
  available = true;
  protectCustomers = false;
  failPost = false;
  sessionStorage.clear();
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  vi.stubGlobal("fetch", vi.fn(async (_url: string, options?: RequestInit) => {
    const method = options?.method ?? "GET";
    calls.push({ method, body: options?.body as string | undefined });
    return {
      ok: method === "GET" || !failPost,
      status: failPost && method === "POST" ? 503 : 200,
      json: async () => method === "GET"
        ? { enabled: available, protectCustomers }
        : failPost ? { error: "Operación no confirmada" } : { success: true, requiresLogin: true },
    };
  }));
});
afterEach(() => {
  cleanup();
  client.clear();
  history.replaceState(null, "", "/");
  vi.unstubAllGlobals();
});

describe("temporary test-reset UI", () => {
  it("hides the destructive control when the server switch is off", async () => {
    available = false;
    mount();
    await waitFor(() => expect(calls.length).toBeGreaterThan(0));
    expect(screen.queryByTestId("button-test-reset")).toBeNull();
  });

  it("requires the exact confirmation, never submits on a failed response", async () => {
    failPost = true;
    mount();
    fireEvent.click(await screen.findByTestId("button-test-reset"));
    const confirm = screen.getByTestId("button-confirm-test-reset") as HTMLButtonElement;
    expect(confirm.disabled).toBe(true);
    fireEvent.change(screen.getByTestId("input-test-reset-confirmation"), { target: { value: "borrar" } });
    expect(confirm.disabled).toBe(true);
    fireEvent.change(screen.getByTestId("input-test-reset-confirmation"), { target: { value: "BORRAR" } });
    fireEvent.click(confirm);
    expect(await screen.findByRole("alert")).toHaveProperty("textContent", "Operación no confirmada");
    expect(calls.filter(call => call.method === "POST")).toEqual([{ method: "POST", body: '{"confirmation":"BORRAR"}' }]);
    expect(sessionStorage.getItem(TEST_RESET_LOGIN_NOTICE_KEY)).toBeNull();
  });

  it("protects customers in the modal when the backend switch is on", async () => {
    protectCustomers = true;
    mount();
    fireEvent.click(await screen.findByTestId("button-test-reset"));
    expect(screen.getByText(/y todos los clientes/i)).toBeTruthy();
    expect(screen.queryByText(/clientes de prueba;/i)).toBeNull();
  });

  it("clears user cache and writes a sign-in notice only after confirmed success", async () => {
    // jsdom has no real navigation; production calls location.replace("/login").
    const navigationWarning = vi.spyOn(console, "error").mockImplementation(() => {});
    client.setQueryData(["sensitive-customer-list"], [{ id: 21 }]);
    mount();
    fireEvent.click(await screen.findByTestId("button-test-reset"));
    fireEvent.change(screen.getByTestId("input-test-reset-confirmation"), { target: { value: "BORRAR" } });
    fireEvent.click(screen.getByTestId("button-confirm-test-reset"));
    fireEvent.click(screen.getByTestId("button-confirm-test-reset"));
    await waitFor(() => expect(sessionStorage.getItem(TEST_RESET_LOGIN_NOTICE_KEY)).toBe(TEST_RESET_LOGIN_MESSAGE));
    expect(client.getQueryData(["sensitive-customer-list"])).toBeUndefined();
    expect(calls.filter(call => call.method === "POST")).toHaveLength(1);
    navigationWarning.mockRestore();
  });

  it("renders the actual login page with the reset message, including after reload", () => {
    vi.mocked(useGetCurrentUser).mockReturnValue({
      data: undefined, isLoading: false, error: { status: 401 },
    } as ReturnType<typeof useGetCurrentUser>);
    vi.mocked(useLogin).mockReturnValue({ isPending: false, mutate: vi.fn() } as unknown as ReturnType<typeof useLogin>);
    sessionStorage.setItem(TEST_RESET_LOGIN_NOTICE_KEY, TEST_RESET_LOGIN_MESSAGE);
    const loginClient = new QueryClient();
    const first = render(<QueryClientProvider client={loginClient}><Login /></QueryClientProvider>);
    expect(screen.getByTestId("test-reset-login-notice").textContent).toBe(TEST_RESET_LOGIN_MESSAGE);
    first.unmount();
    render(<QueryClientProvider client={loginClient}><Login /></QueryClientProvider>);
    expect(screen.getByTestId("test-reset-login-notice").textContent).toBe(TEST_RESET_LOGIN_MESSAGE);
    expect(sessionStorage.getItem(TEST_RESET_LOGIN_NOTICE_KEY)).toBe(TEST_RESET_LOGIN_MESSAGE);
    loginClient.clear();
  });

  it("shows the sign-in explanation even if session storage is unavailable", () => {
    vi.mocked(useGetCurrentUser).mockReturnValue({
      data: undefined, isLoading: false, error: { status: 401 },
    } as ReturnType<typeof useGetCurrentUser>);
    vi.mocked(useLogin).mockReturnValue({ isPending: false, mutate: vi.fn() } as unknown as ReturnType<typeof useLogin>);
    history.replaceState(null, "", "/login?testReset=complete");
    const loginClient = new QueryClient();
    render(<QueryClientProvider client={loginClient}><Login /></QueryClientProvider>);
    expect(screen.getByTestId("test-reset-login-notice").textContent).toBe(TEST_RESET_LOGIN_MESSAGE);
    loginClient.clear();
  });
});