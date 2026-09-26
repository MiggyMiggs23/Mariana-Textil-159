import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { GetClienteEstadoCuentaResponse, GetClienteResponse } from "@workspace/api-zod";
import { withBrowserFixture } from "./observable-test/browser";

const financeUtilityFixtureDirectory = await mkdtemp(join(tmpdir(), "finance-utility-"));
const financeUtilityApiPath = join(financeUtilityFixtureDirectory, "api-client-react.ts");
const financeUtilityQueryPath = join(financeUtilityFixtureDirectory, "react-query.ts");
const financeUtilityLayoutPath = join(financeUtilityFixtureDirectory, "layout.tsx");
const financeUtilityDialogPath = join(financeUtilityFixtureDirectory, "dialog.tsx");
const financeUtilityHistoryPath = join(financeUtilityFixtureDirectory, "history.tsx");
const financeUtilityClientesApiPath = join(financeUtilityFixtureDirectory, "clientes-api.ts");

const financeUtilityClient = GetClienteResponse.parse({
  id: 41, nombre: "Cliente observable", telefono: null, correo: null, direccion: null,
  direccionParticular: null, direccionEntrega: null, rfc: null, notas: null, activo: true,
  esSistema: false, contactoNombre: null, recibeNotaSinPrecios: false, limiteCredito: "800.00",
  saldoActual: "0.00", saldoAFavor: "0.00", diasCredito: 30,
  createdAt: "2026-01-01T12:00:00.000Z", updatedAt: "2026-01-01T12:00:00.000Z",
});
const financeUtilityAccount = GetClienteEstadoCuentaResponse.parse({
  clienteId: 41, movimientos: [], saldoActual: "0.00", saldoAFavor: "0.00",
});

await Promise.all([
  writeFile(financeUtilityApiPath, `
    export * from "/home/runner/workspace/lib/api-client-react/src/index.ts";
    const client = ${JSON.stringify(financeUtilityClient)};
    const account = ${JSON.stringify(financeUtilityAccount)};
    const result = (data) => ({ data, isLoading: false, isError: false, isFetching: false, error: null, refetch() {} });
    export const useGetCurrentUser = () => result({ rol: "ADMIN", permisos: [] });
    export const useListLocations = () => result([]);
    export const useGetClienteEvidenciaCredito = () => result({ clienteId: client.id, atribucionHabilitada: false, movimientos: [] });
    export const useGetCliente = () => result(client);
    export const useGetClienteCredito = () => result({});
    export const useGetClienteEstadoCuenta = () => result(account);
    export const useGetClientePagos = () => result({ pagos: [] });
    export const useGetClientePrecios = () => result({ precios: [] });
    export const useListClienteDocumentos = () => result([]);
    export const useObtenerComportamientoPagoCliente = () => result(null);
    export const useCreateClientePago = () => ({ mutate() {}, isPending: false });
    export const useBajaCliente = () => ({ mutate() {}, isPending: false });
    export const useReactivarCliente = () => ({ mutate() {}, isPending: false });
    export const useUpdateCliente = () => ({ mutate() {}, isPending: false });
    export const getGetClienteComprasQueryKey = () => [];
    export const getGetClienteCreditoQueryKey = () => [];
    export const getGetClienteEstadoCuentaQueryKey = () => [];
    export const getGetClienteEstadisticasQueryKey = () => [];
    export const getGetClientePagosQueryKey = () => [];
    export const getGetClientePreciosQueryKey = () => [];
    export const getGetClienteQueryKey = () => [];
    export const getGetCurrentUserQueryKey = () => [];
    export const getListClienteDocumentosQueryKey = () => [];
    export const getObtenerComportamientoPagoClienteQueryKey = () => [];
    export const viewClienteDocumento = async () => undefined;
    export const downloadClienteDocumento = async () => undefined;
    export const customFetch = async () => undefined;
  `),
  writeFile(financeUtilityQueryPath, `
    export * from "/home/runner/workspace/node_modules/.pnpm/@tanstack+react-query@5.101.4_react@19.1.0/node_modules/@tanstack/react-query/build/modern/index.js";
    export const useQueryClient = () => ({ invalidateQueries() {} });
    export const useMutation = () => ({ mutate() {}, isPending: false });
    export const useQuery = ({ queryKey }) => ({
      data: queryKey?.[0] === "cliente-lifetime-stats"
        ? { utilidadAcumulada: "1234.50", lineasExcluidasSinCosto: 0 }
        : undefined,
      isLoading: false, isError: false, error: null,
    });
  `),
  writeFile(financeUtilityLayoutPath, `export function AppLayout({ children }) { return <main>{children}</main>; }`),
  writeFile(financeUtilityDialogPath, `export function ClientePagoDialog() { return null; }`),
  writeFile(financeUtilityHistoryPath, `export function DirectedPaymentHistory() { return null; }`),
  writeFile(financeUtilityClientesApiPath, `
    export const getPurchases = async () => ({ compras: [] });
    export const getStats = async () => ({});
    export const getClientAnalytics = async () => ({});
    export const getPortfolio = async () => ({});
    export const createAdjustment = async () => ({});
    export const downloadClientFile = async () => undefined;
    export const updateCreditTerms = async () => ({});
  `),
]);

test.after(async () => {
  await rm(financeUtilityFixtureDirectory, { recursive: true, force: true });
});

test("client utility starts visually hidden and exposes a touch-friendly toggle", () => {
  return withBrowserFixture({
    entrySource: `
      import React from "react";
      import { Router } from "wouter";
      import { memoryLocation } from "wouter/memory-location";
      import ClienteDetail from ${JSON.stringify(new URL("./pages/cliente-detail.tsx", import.meta.url).pathname)};
      import { LocationScopeProvider } from ${JSON.stringify(new URL("./lib/location-scope.tsx", import.meta.url).pathname)};
      const location = memoryLocation({ path: "/clientes/41" });
      export default function Fixture() {
        const boot = Number(window.name || "0") + 1;
        window.name = String(boot);
        return <Router hook={location.hook}>
          <output data-testid="finance-utility-boot">{boot}</output>
          <LocationScopeProvider><ClienteDetail /></LocationScopeProvider>
        </Router>;
      }
    `,
    moduleAliases: {
      "@workspace/api-client-react": financeUtilityApiPath,
      "@tanstack/react-query": financeUtilityQueryPath,
      "@/components/layout/app-layout": financeUtilityLayoutPath,
      "@/components/cliente-pago-dialog": financeUtilityDialogPath,
      "@/components/directed-payment-history": financeUtilityHistoryPath,
      "@/lib/clientes-api": financeUtilityClientesApiPath,
    },
    viewport: { width: 402, height: 874 },
  }, async (page) => {
    await page.waitFor(`document.querySelector('[data-testid="button-toggle-client-utility"]') !== null`);
    const initiallyHidden = await page.evaluate<{ hidden: boolean; targetSize: boolean }>(`
      (() => {
        const value = document.querySelector('[data-testid="metric-client-lifetime-utility"]');
        const control = document.querySelector('[data-testid="button-toggle-client-utility"]');
        const rectangle = control?.getBoundingClientRect();
        return {
          hidden: value?.textContent?.includes("••••••") === true
            && control?.getAttribute("aria-pressed") === "false",
          targetSize: (rectangle?.width ?? 0) >= 44 && (rectangle?.height ?? 0) >= 44,
        };
      })()
    `);
    assert.equal(initiallyHidden.hidden, true, "utility begins obscured on a newly mounted client page");
    assert.equal(initiallyHidden.targetSize, true, "utility toggle has a 44 by 44 pixel touch target");

    await page.click('[data-testid="button-toggle-client-utility"]');
    await page.waitFor(`document.querySelector('[data-testid="metric-client-lifetime-utility"]')?.textContent?.includes("1,234.50") === true`);
    const visibleAndBalancesIndependent = await page.evaluate<boolean>(`
      (() => {
        const utility = document.querySelector('[data-testid="metric-client-lifetime-utility"]')?.textContent ?? "";
        const debt = document.querySelector('[data-testid="metric-client-saldo-deudor"]')?.textContent ?? "";
        const favor = document.querySelector('[data-testid="metric-client-saldo-a-favor"]')?.textContent ?? "";
        return !utility.includes("••••••") && utility.includes("1,234.50")
          && debt.includes("0.00") && !debt.includes("-")
          && favor.includes("0.00");
      })()
    `);
    assert.equal(visibleAndBalancesIndependent, true, "revealed utility and the zero debt/zero favor balances remain separately observable");

    await page.click('[data-testid="button-toggle-client-utility"]');
    await page.waitFor(`document.querySelector('[data-testid="metric-client-lifetime-utility"]')?.textContent?.includes("••••••") === true`);
    const hiddenAgain = await page.evaluate<boolean>(
      `document.querySelector('[data-testid="button-toggle-client-utility"]')?.getAttribute("aria-pressed") === "false"`,
    );
    assert.equal(hiddenAgain, true, "hiding utility resets the pressed accessibility state");

    await page.click('[data-testid="button-toggle-client-utility"]');
    await page.waitFor(`document.querySelector('[data-testid="metric-client-lifetime-utility"]')?.textContent?.includes("1,234.50") === true`);
    await page.evaluate(`setTimeout(() => location.reload(), 0)`);
    await page.waitFor(`document.querySelector('[data-testid="finance-utility-boot"]')?.textContent === "2"`);
    const reloadStartsHidden = await page.evaluate<boolean>(`
      document.querySelector('[data-testid="metric-client-lifetime-utility"]')?.textContent?.includes("••••••") === true
        && document.querySelector('[data-testid="button-toggle-client-utility"]')?.getAttribute("aria-pressed") === "false"
    `);
    assert.equal(reloadStartsHidden, true, "a fresh browser document hides utility even after it was revealed before reload");
  });
});

test("client utility is server-gated and declares every excluded no-cost line", () => {
  const page = readFileSync(new URL("./pages/cliente-detail.tsx", import.meta.url), "utf8");
  const clientApi = readFileSync(new URL("./lib/clientes-api.ts", import.meta.url), "utf8");
  const route = readFileSync(new URL("../../api-server/src/routes/clientes.ts", import.meta.url), "utf8");
  assert.match(page, /enabled: canFinances/);
  assert.match(page, /enabled: canFinances && utilityVisible && Number\.isFinite\(id\)/);
  assert.match(page, /canFinances && \(/);
  assert.match(page, /lineasExcluidasSinCosto \?\? 0/);
  assert.match(clientApi, /utilidadAcumulada\?: string/);
  assert.match(route, /requierePermiso\("clientes_finanzas", "ver"\)/);
  assert.match(route, /FILTER \(WHERE l\.costo_total_congelado IS NOT NULL\),0\)::text AS "utilidadAcumulada"/);
  assert.match(route, /lineasExcluidasSinCosto: summary\?\.lineasSinCosto \?\? 0/);
});