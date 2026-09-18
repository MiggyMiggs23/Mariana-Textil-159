import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  ListarTicketsCajaResponse,
  ObtenerSesionCajaActualResponse,
  ObtenerProyeccionAutorizacionNotaResponse,
} from "@workspace/api-zod";
import { withBrowserFixture } from "../observable-test/browser";

test("customer payment receipt exposes excess and resulting favor", async () => {
  const source = await readFile(new URL("./cliente-pago-dialog.tsx", import.meta.url), "utf8");
  assert.match(source, /Excedente recibido/);
  assert.match(source, /Saldo a favor resultante/);
  assert.match(source, /saldoAFavorGenerado/);
  assert.match(source, /receipt-payment-excess/);
});

test("cash authorization previews the server-calculated automatic favor application", async (t) => {
  const financeCashFixtureDirectory = await mkdtemp(join(tmpdir(), "finance-cash-"));
  const financeCashApiPath = join(financeCashFixtureDirectory, "api-client-react.ts");
  const financeCashLayoutPath = join(financeCashFixtureDirectory, "layout.tsx");
  const financeCashScopePath = join(financeCashFixtureDirectory, "location-scope.tsx");
  const financeCashDialogPath = join(financeCashFixtureDirectory, "dialog.tsx");
  const financeCashScanPath = join(financeCashFixtureDirectory, "scan.tsx");
  const financeCashDirectedPath = join(financeCashFixtureDirectory, "directed.tsx");
  const financeCashQueryPath = join(financeCashFixtureDirectory, "react-query.ts");
  const tickets = ListarTicketsCajaResponse.parse([{
    id: 77, folio: 9007, subtotal: "500.00", iva: "0.00", tasaIva: "0.00", total: "500.00",
    facturado: false, createdAt: "2026-10-02T12:00:00.000Z", cobrado: false, cobradoAt: null,
    documentoTipo: "NOTA", autorizacionEstado: "PENDIENTE", autorizadoAt: null, formasPago: [],
  }]);
  const projection = ObtenerProyeccionAutorizacionNotaResponse.parse({
    ticketId: 77, clienteNombre: "Cliente observable", saldoActual: "300.00",
    saldoAFavorDisponible: "500.00", saldoAFavorAplicadoAutomaticamente: "500.00",
    saldoAFavorRemanente: "0.00", saldoDeudorProyectado: "300.00", importe: "500.00",
    suma: "300.00", limiteCredito: "1000.00", creditoDisponibleResultante: "700.00",
    exceso: "0.00", autorizable: true, motivoBloqueo: null,
  });
  const session = ObtenerSesionCajaActualResponse.parse({
    sesion: {
      id: 4, ubicacionId: 2, nombreUbicacion: "Sucursal", usuarioId: 7,
      nombreUsuario: "Caja", abiertaAt: "2026-10-02T12:00:00.000Z", cerradaAt: null,
      fondoInicial: "0.00", efectivoContado: null, estado: "ABIERTA",
    },
    resumen: { ticketsCobrados: 0, documentosPendientes: 1, totalCobrado: "0.00", efectivoEsperado: "0.00" },
  });
  try {
    await Promise.all([
      writeFile(financeCashApiPath, `
        export * from "/home/runner/workspace/lib/api-client-react/src/index.ts";
        const result = (data) => ({ data, isLoading: false, isError: false, isFetching: false, error: null, refetch() {} });
        export const useGetCurrentUser = () => result({ rol: "ADMIN", permisos: [] });
        export const useListLocations = () => result([]);
        export const useObtenerSesionCajaActual = () => result(${JSON.stringify(session)});
        export const useListarTicketsCaja = () => result(${JSON.stringify(tickets)});
        export const useObtenerProyeccionAutorizacionNota = () => result(${JSON.stringify(projection)});
        export const useObtenerCorteCaja = () => result(undefined);
        export const useObtenerTicket = () => result(undefined);
        export const useListarSesionesCaja = () => result([]);
        export const useListarTickets = () => result([]);
        export const useGetClienteEstadoCuenta = () => result(undefined);
        export const useListarSalidasDineroCaja = () => result([]);
        export const useListarProveedoresActivosCaja = () => result([]);
        const mutation = () => ({ mutate(_data, options) { options?.onSuccess?.(); }, isPending: false });
        export const useAbrirSesionCaja = mutation; export const useCerrarSesionCaja = mutation;
        export const useCobrarTicket = mutation; export const useAutorizarNota = mutation;
        export const useCreateClientePago = mutation; export const useCrearSalidaDineroCaja = mutation;
        export const getObtenerProyeccionAutorizacionNotaQueryKey = () => [];
        export const getObtenerSesionCajaActualQueryKey = () => [];
        export const getListarTicketsCajaQueryKey = () => [];
        export const getObtenerTicketQueryKey = () => [];
        export const getObtenerCorteCajaQueryKey = () => [];
        export const getListarSesionesCajaQueryKey = () => [];
        export const getListarTicketsQueryKey = () => [];
        export const getGetClienteEstadoCuentaQueryKey = () => [];
        export const getListarSalidasDineroCajaQueryKey = () => [];
      `),
      writeFile(financeCashLayoutPath, `export function AppLayout({ children }) { return <main>{children}</main>; }`),
      writeFile(financeCashScopePath, `export function useLocationScope() { return { selectedLocationId: 2, setSelectedLocationId() {} }; }`),
      writeFile(financeCashDialogPath, `export function ClientePagoDialog() { return null; }`),
      writeFile(financeCashScanPath, `export function CampoEscaneo() { return null; }`),
      writeFile(financeCashDirectedPath, `export function SolicitudPagoDirigidoDialog() { return null; }`),
      writeFile(financeCashQueryPath, `
        export * from "/home/runner/workspace/node_modules/.pnpm/@tanstack+react-query@5.101.4_react@19.1.0/node_modules/@tanstack/react-query/build/modern/index.js";
        export function useQueryClient() { return { invalidateQueries() {} }; }
      `),
    ]);
    await withBrowserFixture({
      entrySource: `
        import React from "react";
        import CobrosPage from ${JSON.stringify(new URL("../pages/cobros.tsx", import.meta.url).pathname)};
        export default function Fixture() { return <CobrosPage />; }
      `,
      moduleAliases: {
        "@workspace/api-client-react": financeCashApiPath,
        "@tanstack/react-query": financeCashQueryPath,
        "@/components/layout/app-layout": financeCashLayoutPath,
        "@/lib/location-scope": financeCashScopePath,
        "@/components/cliente-pago-dialog": financeCashDialogPath,
        "@/components/campo-escaneo": financeCashScanPath,
        "@/components/solicitud-pago-dirigido-dialog": financeCashDirectedPath,
      },
    }, async (page) => {
      await page.waitFor(`Array.from(document.querySelectorAll("button")).some((button) => button.textContent?.trim() === "Autorizar")`);
      await page.evaluate(`Array.from(document.querySelectorAll("button")).find((button) => button.textContent?.trim() === "Autorizar")?.click()`);
      await page.waitFor(`document.querySelector('[role="dialog"]') !== null`);
      const observation = await page.evaluate<{
        preview: { disponible: boolean; aplicado: boolean; remanente: boolean; manualControl: boolean };
        controls: { tag: string; role: string | null; name: string }[];
        injectionDetected: boolean; afterRemovalDetected: boolean;
      }>(`
        (() => {
          const dialog = document.querySelector('[role="dialog"]');
          if (!dialog) throw new Error("Authorization dialog is missing");
          const value = (id) => document.querySelector('[data-testid="' + id + '"]')?.textContent ?? "";
          const controls = () => Array.from(dialog.querySelectorAll('input:not([type="hidden"]), textarea, select, [role="radio"], [role="combobox"], [contenteditable="true"]'));
          const controlName = (control) => [
            control.getAttribute("aria-label"),
            ...(control.getAttribute("aria-labelledby") ?? "").split(/\\s+/).filter(Boolean)
              .map(id => document.getElementById(id)?.textContent ?? ""),
            ...Array.from(control.labels ?? []).map(label => label.textContent ?? ""),
            control.getAttribute("name"), control.getAttribute("id"),
          ].filter(Boolean).join(" ");
          // Operational site/note metadata is editable, but monetary favor
          // application must remain exclusively the automatic server preview.
          const hasManualFavorControl = () => controls().some(control =>
            /favor|(?:importe|monto|saldo).*aplic|aplic.*(?:importe|monto|saldo)/i.test(controlName(control)));
          const originalControls = controls().map(control => ({
            tag: control.tagName, role: control.getAttribute("role"), name: controlName(control),
          }));
          const preview = {
            disponible: value("text-authorization-saldo-a-favor-disponible").includes("500.00"),
            aplicado: value("text-authorization-saldo-a-favor-aplicado").includes("500.00"),
            remanente: value("text-authorization-saldo-a-favor-remanente").includes("0.00"),
            manualControl: hasManualFavorControl(),
          };
          // Positive control for the detector, only in this fixture DOM. The
          // input intentionally relies on its associated label, not aria-label.
          const probe = document.createElement("div");
          const label = document.createElement("label");
          label.htmlFor = "manual-money-probe";
          label.textContent = "Importe de saldo a favor a aplicar manualmente";
          const input = document.createElement("input");
          input.id = label.htmlFor;
          input.type = "number";
          input.step = "0.01";
          probe.append(label, input);
          let injectionDetected;
          dialog.append(probe);
          try { injectionDetected = hasManualFavorControl(); }
          finally { probe.remove(); }
          return {
            preview, controls: originalControls, injectionDetected,
            afterRemovalDetected: hasManualFavorControl(),
          };
        })()
      `);
      t.diagnostic("Authorization dialog controls: " + JSON.stringify(observation.controls));
      assert.deepEqual(observation.preview, {
        disponible: true, aplicado: true, remanente: true, manualControl: false,
      }, "the real Cobros authorization dialog presents the automatic server preview without a manual favor control");
      assert.equal(observation.injectionDetected, true, "a labelled manual monetary favor input must be detected");
      assert.equal(observation.afterRemovalDetected, false, "the temporary manual-favor probe is removed from the fixture");
    });
  } finally {
    await rm(financeCashFixtureDirectory, { recursive: true, force: true });
  }
});