import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { withBrowserFixture } from "../../observable-test/browser";

const appLayoutStub = `
import React from "react";
export function AppLayout({ children }) {
  return React.createElement("main", { "data-testid": "app-layout" }, children);
}
`;

test("FondoSummary E10 integration tests", async (t) => {
  const fixtureDir = await mkdtemp(join(tmpdir(), "fondo-test-"));
  const apiClientStub = join(fixtureDir, "api-client-react.ts");
  const layoutStub = join(fixtureDir, "app-layout.tsx");

  // We will build a test harness inside the fixture that mounts the actual components
  // and exposes a window.__setMockState API to control the backend responses.

  await writeFile(layoutStub, appLayoutStub);
  await writeFile(apiClientStub, `
    import React from "react";
    import { useQuery, useMutation } from "@tanstack/react-query";
    export const Role = { ADMIN: "ADMIN", CONTADOR: "CONTADOR" };
    
    // We store the current backend state in window so the test runner can mutate it
    window.__mockState = window.__mockState || {
      user: { id: 1, rol: "ADMIN" },
      fondoResumen: {
        fondo: { id: "123", nombre: "Fondo de Mariana", ubicacion: { id: 1, nombre: "TIENDA MARIANA" } },
        saldo: "0.00",
        versionSaldo: null,
        totalMovimientos: 0,
        ultimoMovimientoFecha: null,
        ultimoArqueo: null
      },
      exportThrows: null,
      exportDeferred: false,
      exportPending: false,
      mutateThrows: null
    };

    export const useGetCurrentUser = (options) => useQuery({
      ...options.query,
      queryFn: async () => window.__mockState.user,
      initialData: window.__mockState.user,
    });
    
    export const getGetCurrentUserQueryKey = () => ["getGetCurrentUser"];
    export const getGetFondoQueryKey = () => ["getGetFondo"];
    export const getListFondoMovimientosQueryKey = () => ["getListFondoMovimientos"];
    export const getGetFondoMovimientoQueryKey = (id) => ["getGetFondoMovimiento", id];
    export const getListFondoArqueosQueryKey = () => ["getListFondoArqueos"];
    export const getGetFondoArqueoQueryKey = (id) => ["getGetFondoArqueo", id];

    export function useGetFondo(options) {
      return useQuery({
        ...options.query,
        queryFn: async () => window.__mockState.fondoResumen,
      });
    }

    export function useCreateFondoMovimiento(options) {
      return useMutation({
        mutationFn: async (vars) => {
          if (window.__mockState.mutateThrows) {
            throw new Error(window.__mockState.mutateThrows);
          }
          window.__mockState.lastMutation = vars;
          return { id: "new-id" };
        },
        ...options.mutation
      });
    }

    export function useReverseFondoMovimiento(options) {
      return useMutation({
        mutationFn: async () => { return { id: "inverso-id" } },
        ...options.mutation
      });
    }

    export function useListFondoMovimientos() { return { data: undefined }; }
    export function useGetFondoMovimiento() { return { data: undefined }; }
    export function useListFondoArqueos() { return { data: undefined }; }
    export function useGetFondoArqueo() { return { data: undefined }; }

    export function useCreateFondoArqueo(options) {
      return useMutation({
        mutationFn: async (vars) => {
          if (window.__mockState.mutateThrows) {
            throw new Error(window.__mockState.mutateThrows);
          }
          window.__mockState.lastArqueo = vars;
          return { id: "new-arq-id" };
        },
        ...options.mutation
      });
    }

    export async function exportFondoCsv(params, options) {
      if (window.__mockState.exportThrows) {
        throw new Error(window.__mockState.exportThrows);
      }
      const result = new Blob(["id,fecha,importe\\n1,2026-09-18,500.00"]);
      if (!window.__mockState.exportDeferred) return result;
      window.__mockState.exportPending = true;
      return await new Promise((resolve) => {
        window.__resolveExport = () => resolve(result);
      });
    }
  `);

  const entrySource = `
    import React, { useState } from "react";
    import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
    import FondoSummary from ${JSON.stringify(new URL("../../pages/fondo/index.tsx", import.meta.url).pathname)};
    import { Toaster } from "@/components/ui/toaster";

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: 0 } }
    });

    // Expose a way to force re-render/refetch from outside
    window.__forceUpdate = () => {};
    window.__clearQueryCache = () => queryClient.clear();
    window.__queryClient = queryClient;
    window.__setCachedUser = (user) => {
      window.__mockState.user = user;
      queryClient.setQueryData(["getGetCurrentUser"], user);
    };
    
    export default function Fixture() {
      // Set test flag so hooks consider it enabled
      window.__test_FondoEnabled = true;

      const [tick, setTick] = useState(0);
      window.__forceUpdate = () => {
        // Also invalidate to force refetch
        queryClient.invalidateQueries();
        setTick(t => t + 1);
      };

      return (
        <QueryClientProvider client={queryClient}>
          <div data-tick={tick}>
            <FondoSummary />
          </div>
          <Toaster />
        </QueryClientProvider>
      );
    }
  `;

  await withBrowserFixture({
    entrySource,
    moduleAliases: {
      "@workspace/api-client-react": apiClientStub,
      "@/components/layout/app-layout": layoutStub,
    }
  }, async (page) => {

    await t.test("1. Muestra estado inicial vacío (Fondo no inicializado) cuando no hay versionSaldo", async () => {
      // The mock is initially set to versionSaldo: null
      await page.waitFor(`document.body?.textContent?.includes("Fondo no inicializado")`);
      const hasRegistrar = await page.evaluate(`document.body?.textContent?.includes("Registrar Saldo Inicial")`);
      assert.equal(hasRegistrar, true);
    });

    await t.test("2. Muestra saldo y botones de operación cuando el fondo está inicializado", async () => {
      await page.evaluate(`
        window.__mockState.fondoResumen.versionSaldo = "uuid-1";
        window.__mockState.fondoResumen.saldo = "1500.50";
        window.__mockState.fondoResumen.totalMovimientos = 5;
        window.__forceUpdate();
      `);
      
      await page.waitFor(`document.body?.textContent?.includes("$1,500.50")`);
      const hasRegistrar = await page.evaluate(`document.body?.textContent?.includes("Fondo no inicializado")`);
      assert.equal(hasRegistrar, false);
      const hasRetiro = await page.evaluate(`document.body?.textContent?.includes("Registrar Retiro")`);
      assert.equal(hasRetiro, true);
    });

    await t.test("3. Envía un retiro correctamente formateado (sin conciliación inicial)", async () => {
      await page.evaluate(`
        window.__mockState.fondoResumen.versionSaldo = "uuid-1";
        window.__mockState.fondoResumen.saldo = "1500.50";
        window.__forceUpdate();
      `);
      
      await page.waitFor(`document.body?.textContent?.includes("Registrar Retiro")`);
      
      // Click registrar retiro
      await page.evaluate(`Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes("Registrar Retiro")).click()`);
      await page.waitFor(`document.querySelector('[role="dialog"]') !== null`);
      
      // Fill form
      await page.evaluate(`
        const inputs = document.querySelectorAll('input');
        const textarea = document.querySelector('textarea');
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
        nativeInputValueSetter.call(inputs[0], "500.00");
        inputs[0].dispatchEvent(new Event('input', { bubbles: true }));
        
        const nativeTextareaValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value").set;
        nativeTextareaValueSetter.call(textarea, "Pago de servicios");
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
        
        document.querySelector('button[type="submit"]').click();
      `);

      // Wait for dialog to close
      await page.waitFor(`document.querySelector('[role="dialog"]') === null`);
      
      // Check last mutation
      const lastMutation = await page.evaluate(`window.__mockState.lastMutation`);
      assert.equal(lastMutation.data.categoria, "RETIRO");
      assert.equal(lastMutation.data.importe, "500.00");
      assert.equal(lastMutation.data.motivo, "Pago de servicios");
      assert.ok(lastMutation.data.idempotencyKey);
      assert.equal(lastMutation.data.conciliacionInicial, undefined);
    });

    await t.test("4. Aborta una exportación realmente pendiente si el rol cambia en el mismo QueryClient", async () => {
      await page.evaluate(`
        window.__setCachedUser({ id: 1, rol: "ADMIN" });
        window.__mockState.exportThrows = null;
        window.__mockState.exportDeferred = true;
        window.__mockState.exportPending = false;
        window.__downloadAttempts = 0;
        window.URL.createObjectURL = () => {
          window.__downloadAttempts += 1;
          return "blob:fondo-test";
        };
      `);

      await page.evaluate(`
        Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes("Movimientos CSV")).click();
      `);
      await page.waitFor(`window.__mockState.exportPending === true`);

      await page.evaluate(`
        window.__setCachedUser({ id: 1, rol: "CONTADOR" });
        window.__resolveExport();
      `);
      await page.waitFor(`document.body?.textContent?.includes("Transición de sesión: Exportación abortada") || window.__downloadAttempts > 0`);

      const transitionErrorShown = await page.evaluate(`document.body?.textContent?.includes("Transición de sesión: Exportación abortada")`);
      assert.equal(transitionErrorShown, true);
      const downloadAttempts = await page.evaluate(`window.__downloadAttempts`);
      assert.equal(downloadAttempts, 0);
      const successShown = await page.evaluate(`document.body?.textContent?.includes("Exportación exitosa")`);
      assert.equal(successShown, false);
      await page.evaluate(`
        window.__mockState.exportDeferred = false;
        window.__setCachedUser({ id: 1, rol: "ADMIN" });
        window.__forceUpdate();
      `);
    });

    await t.test("5. Transición ADMIN -> CONTADOR en el QueryClient bloquea el render", async () => {
      await page.evaluate(`
        window.__setCachedUser({ id: 1, rol: "CONTADOR" });
        window.__forceUpdate();
      `);

      await page.waitFor(`document.body?.textContent?.includes("Error al cargar el fondo") || document.body?.textContent?.includes("$1,500.50")`);
      const hasError = await page.evaluate(`document.body?.textContent?.includes("Error al cargar el fondo")`);
      assert.equal(hasError, true);
      const hasSaldo = await page.evaluate(`document.body?.textContent?.includes("$1,500.50")`);
      assert.equal(hasSaldo, false);
    });

    await t.test("6. Exact money rendering to cent at largest supported amounts without precision loss", async () => {
      await page.evaluate(`
        window.__setCachedUser({ id: 1, rol: "ADMIN" });
        window.__mockState.fondoResumen.versionSaldo = "uuid-1";
        window.__mockState.fondoResumen.saldo = "9999999999.99"; // Large string out of 32-bit float precision if converted unsafely, though in safe integer it might barely fit, let's use a very large one.
        window.__forceUpdate();
      `);
      
      // We expect the exact formatted string without missing cents or float noise
      await page.waitFor(`document.body?.textContent?.includes("$9,999,999,999.99")`);
      
      await page.evaluate(`
        window.__mockState.fondoResumen.saldo = "9007199254740991.99"; // Exceeds Number.MAX_SAFE_INTEGER
        window.__forceUpdate();
      `);
      
      await page.waitFor(`document.body?.textContent?.includes("$9,007,199,254,740,991.99")`);
    });

  });

  await rm(fixtureDir, { recursive: true, force: true });
});
