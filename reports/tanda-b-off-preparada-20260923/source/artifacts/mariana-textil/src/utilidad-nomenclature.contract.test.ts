import assert from "node:assert/strict";
import { readFile, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  GetAdminComparacionTiendasResponse,
  ObtenerCorteCajaResponse,
} from "@workspace/api-zod";
import { withBrowserFixture } from "./observable-test/browser";
import { createCajaTiempoRealBrowserFixture } from "./pages/caja/caja-tiempo-real-observable-test-support";
import { readProfitExportOutput } from "./observable-test/profit-export-output";

const apiClientPath = new URL("../../../lib/api-client-react/src/index.ts", import.meta.url).pathname;

const comparison = GetAdminComparacionTiendasResponse.parse({
  periodo: "personalizado", desde: "2026-10-01", hasta: "2026-10-02",
  tiendas: [{
    ubicacionId: 1, nombreUbicacion: "Mariana", ventas: "1000.00", subtotal: "862.07", costo: "600.00", margen: "262.07",
    tickets: 4, ticketPromedio: "250.00", diferenciaTicketPromedio: "0.00", tendenciaPorcentaje: "0.00",
    mejorDia: { fecha: "2026-10-01", ventas: "600.00" }, peorDia: { fecha: "2026-10-02", ventas: "400.00" },
    metros: "10.00", kilos: "0.00", bolsas: "0.00", rollosMetros: "10.00", rollosKilos: "0.00", rollosBolsas: "0.00",
    metrajeMetros: "0.00", metrajeBolsas: "0.00", efectivo: "600.00", transferencia: "400.00", credito: "0.00",
    porcentajeFacturado: "0.00", diferenciaCaja: "0.00", participacion: "100.00", cancelaciones: 0, lineasExcluidasMargen: 0,
  }],
  totales: {
    ventas: "1000.00", subtotal: "862.07", costo: "600.00", margen: "262.07", tickets: 4, ticketPromedio: "250.00",
    cancelaciones: 0, lineasExcluidasMargen: 0, metros: "10.00", kilos: "0.00", bolsas: "0.00", rollosMetros: "10.00",
    rollosKilos: "0.00", rollosBolsas: "0.00", metrajeMetros: "0.00", metrajeBolsas: "0.00", efectivo: "600.00",
    transferencia: "400.00", credito: "0.00", porcentajeFacturado: "0.00", diferenciaCaja: "0.00", participacion: "100.00",
  },
  promedioGeneralTicket: "250.00",
  ventasPorFecha: [{ fecha: "2026-10-01", ubicacionId: 1, nombreUbicacion: "Mariana", ventas: "600.00" }],
});

const cut = ObtenerCorteCajaResponse.parse({
  sesion: { id: 70, ubicacionId: 1, nombreUbicacion: "Mariana", usuarioId: 2, nombreUsuario: "Caja", abiertaAt: "2026-10-02T10:00:00.000Z", cerradaAt: "2026-10-02T18:00:00.000Z", fondoInicial: "100.00", efectivoContado: "700.00", estado: "CERRADA" },
  formasPago: [], cuentasDestino: [], salidas: [], salidasPorCuenta: {}, facturacion: [], metreado: [], productos: [], pendientes: [], ticketsCobradosDetalle: [], ticketsCobrados: 0, cancelaciones: [],
  fondoInicial: "100.00", totalCobrado: "600.00", ivaCobrado: "82.76", efectivoEsperado: "700.00", efectivoContado: "700.00", diferencia: "0.00",
  hojaVentasDia: { sitio: "Mariana", fechaOperativa: "2026-10-02", cerrada: true, quienCerro: "Caja", secciones: [], totalRollos: "0.00", totalMetros: "0.00", totalKilos: "0.00", totalBolsas: "0.00", totalPiezas: "0.00", subtotal: "0.00", ivaFacturado: "0.00", totalGeneral: "0.00" },
  costo: "350.00", margen: "250.00", margenPorcentaje: "41.67", lineasExcluidasMargen: 0,
});

const currentUser = {
  id: 1, nombre: "Contabilidad", usuario: "contador", rol: "ADMIN",
  ubicacion: null, alcanceConsulta: "TODAS", permisos: [],
};
const client = {
  id: 41, nombre: "Cliente Mariana", telefono: null, correo: null, direccion: null, direccionParticular: null, direccionEntrega: null,
  rfc: null, notas: null, activo: true, esSistema: false, contactoNombre: null, recibeNotaSinPrecios: false,
  limiteCredito: "1000.00", saldoActual: "0.00", saldoAFavor: "0.00", diasCredito: 30,
  createdAt: "2026-10-01T00:00:00.000Z", updatedAt: "2026-10-01T00:00:00.000Z",
};

function jsonFetch(responses: Record<string, unknown>) {
  return `
    globalThis.fetch = async (input) => {
      const url = new URL(String(input), window.location.origin);
      const result = ${JSON.stringify(responses)}[url.pathname];
      return new Response(JSON.stringify(result ?? { error: "fixture route not found" }), {
        status: result === undefined ? 404 : 200, headers: { "content-type": "application/json" },
      });
    };
  `;
}

test("monetary profit labels use Utilidad while percentages remain Margen", async () => {
  const supplierFixture = JSON.parse(await readFile(
    new URL("../test-fixtures/supplier-utility-browser-fixture.json", import.meta.url), "utf8",
  )) as { responses: Record<string, unknown> };
  const supplierResponses = Object.fromEntries(Object.entries(supplierFixture.responses).map(([key, value]) => [
    key.replace(/^GET /, "").replace(/\?.*$/, ""), value,
  ]));

  const realtimeFixture = await createCajaTiempoRealBrowserFixture();
  try {
    await withBrowserFixture(realtimeFixture.options, async (page) => {
      await page.waitFor(`document.body?.textContent?.includes("Utilidad") && document.body?.textContent?.includes("Margen 35.00%")`);
      const text = await page.evaluate<string>(`document.body.textContent ?? ""`);
      assert.match(text, /Utilidad/);
      assert.match(text, /Margen 35\.00%/);
      assert.doesNotMatch(text, /Rentabilidad/);
    });
  } finally {
    await realtimeFixture.dispose();
  }

  const fixtureDirectory = await mkdtemp(join(tmpdir(), "profit-labels-"));
  const comparisonApi = join(fixtureDirectory, "comparison-api.ts");
  const supplierApi = join(fixtureDirectory, "supplier-api.ts");
  try {
    await Promise.all([writeFile(comparisonApi, `
      export * from ${JSON.stringify(apiClientPath)};
      export const useGetAdminComparacionTiendas = () => ({
        data: ${JSON.stringify(comparison)}, isLoading: false, isError: false, error: null, refetch() {},
      });
    `), writeFile(supplierApi, `
      export * from ${JSON.stringify(apiClientPath)};
      const result = (data) => ({ data, isLoading: false, isError: false, isFetching: false, error: null, refetch() {} });
      const provider = ${JSON.stringify(supplierResponses["/api/proveedores/12"])};
      const utility = ${JSON.stringify(supplierResponses["/api/proveedores/12/utilidad"])};
      const stats = ${JSON.stringify(supplierResponses["/api/proveedores/12/estadisticas"])};
      const account = ${JSON.stringify(supplierResponses["/api/proveedores/12/estado-cuenta"])};
      const purchases = ${JSON.stringify(supplierResponses["/api/proveedores/12/compras"])};
      const user = ${JSON.stringify(supplierResponses["/api/auth/me"])};
      export const useGetCurrentUser = () => result(user);
      export const useGetProveedor = () => result(provider);
      export const useGetProveedorUtilidad = () => result(utility);
      export const useEstadisticasProveedor = () => result(stats);
      export const useEstadoCuentaProveedor = () => result(account);
      export const useListComprasProveedor = () => result(purchases);
      export const useUpdateProveedor = () => ({ mutate() {}, isPending: false });
      export const useRegistrarPagoProveedor = () => ({ mutate() {}, isPending: false });
      export const useRegistrarAjusteProveedor = () => ({ mutate() {}, isPending: false });
    `)]);
    await withBrowserFixture({
      entrySource: `
        import React from "react";
        import CajaComparativo from ${JSON.stringify(new URL("./pages/caja/comparativo.tsx", import.meta.url).pathname)};
        export default function Fixture() { return <CajaComparativo embedded filters={{ periodo: "mensual", desde: "2026-10-01", hasta: "2026-10-02" }} />; }
      `,
      moduleAliases: { "@workspace/api-client-react": comparisonApi },
    }, async (page) => {
      await page.waitFor(`document.body?.textContent?.includes("Comparativo de Tiendas") && document.body?.textContent?.includes("Utilidad")`);
      const text = await page.evaluate<string>(`document.body.textContent ?? ""`);
      assert.match(text, /Utilidad/);
      assert.doesNotMatch(text, /Rentabilidad/);
    });

    await withBrowserFixture({
      entrySource: `
        import React from "react";
        import CorteDetail from ${JSON.stringify(new URL("./pages/corte-detail-shared.tsx", import.meta.url).pathname)};
        const corte = ${JSON.stringify(cut)};
        export default function Fixture() { return <CorteDetail corte={corte} />; }
      `,
    }, async (page) => {
      await page.waitFor(`document.body?.textContent?.includes("Utilidad del turno") && document.body?.textContent?.includes("41.67%")`);
      const text = await page.evaluate<string>(`document.body.textContent ?? ""`);
      assert.match(text, /Utilidad del turno/);
      assert.match(text, /41\.67%/);
      assert.doesNotMatch(text, /Rentabilidad/);
    });

    await withBrowserFixture({
      entrySource: `
        import React from "react";
        import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
        import { Router } from "wouter";
        import { memoryLocation } from "wouter/memory-location";
        import { LocationScopeProvider } from ${JSON.stringify(new URL("./lib/location-scope.tsx", import.meta.url).pathname)};
        import ProveedorDetail from ${JSON.stringify(new URL("./pages/proveedor-detail.tsx", import.meta.url).pathname)};
        const location = memoryLocation({ path: "/proveedores/12" });
        const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
        export default function Fixture() { return <QueryClientProvider client={queryClient}><LocationScopeProvider><Router hook={location.hook}><ProveedorDetail /></Router></LocationScopeProvider></QueryClientProvider>; }
      `,
      moduleAliases: { "@workspace/api-client-react": supplierApi },
    }, async (page) => {
      await page.waitFor(`document.querySelector('[data-testid="tab-estadisticas"]') !== null`);
      await page.click('[data-testid="tab-estadisticas"]');
      await page.waitFor(`document.querySelector('[data-testid="button-toggle-supplier-utility"]') !== null`);
      await page.click('[data-testid="button-toggle-supplier-utility"]');
      await page.waitFor(`document.body?.textContent?.includes("Utilidad generada por ventas") && document.querySelector('[data-testid="metric-supplier-utility"]')?.textContent?.includes("••••••") === false`);
      const labels = await page.evaluate<string[]>(`(() => [
        document.querySelector('[data-testid="metric-supplier-utility"]')?.previousElementSibling?.textContent?.trim() ?? "",
        document.querySelector('[data-testid="metric-supplier-utility-margin"]')?.previousElementSibling?.textContent?.trim() ?? "",
        document.body.textContent ?? "",
      ])()`);
      const [utilityLabel, marginLabel, text] = labels;
      assert.match(text, /Utilidad generada por ventas/);
      assert.deepEqual([utilityLabel, marginLabel], ["Utilidad", "Margen"], "supplier metric labels distinguish monetary utility from percentage margin");
      assert.doesNotMatch(text, /Rentabilidad/);
    });

    const clientResponses = {
      "/api/auth/me": currentUser,
      "/api/clientes": [client],
      "/api/clientes/41": client,
      "/api/clientes/41/credito": { clienteId: 41, limiteCredito: "1000.00", saldoActual: "0.00", saldoAFavor: "0.00", creditoDisponible: "1000.00", diasCredito: 30, utilizacion: "0.00", antiguedad: [] },
      "/api/clientes/41/estado-cuenta": { clienteId: 41, movimientos: [], saldoActual: "0.00", saldoAFavor: "0.00" },
      "/api/clientes/41/pagos": { pagos: [] },
      "/api/clientes/41/precios": { precios: [] },
      "/api/clientes/41/estadisticas": { ventas: "2000.00", utilidadAcumulada: "450.00", lineasExcluidasSinCosto: 0, compras: [] },
      "/api/clientes/41/analitica": { actividad: { ultimaCompra: null, tickets: 2, ticketPromedio: "1000.00", ticketMaximo: "1000.00" }, mezclaPagos: [], tendencia: [], productos: [] },
      "/api/clientes/cartera": { alcance: { tipo: "GLOBAL", ubicacionIds: [], generadoEn: "2026-10-02T00:00:00.000Z" }, resumen: { totalClientes: 1, clientesConSaldo: 0, totalCartera: "0.00", totalVencido: "0.00" }, clientes: [] },
      "/api/clientes/analitica": { ventas: "2000.00", margen: "450.00", tickets: 2, rollosMetros: "0.00", rollosKilos: "0.00", metrajeMetros: "0.00", topVentas: [{ nombre: "Cliente Mariana", ventas: "2000.00", margen: "450.00" }], topMargen: [{ nombre: "Cliente Mariana", ventas: "2000.00", margen: "450.00" }], pareto: [], publicoVsRegistrado: [], evolucion: [] },
    };
    await withBrowserFixture({
      entrySource: `
        import React from "react";
        import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
        import Clientes from ${JSON.stringify(new URL("./pages/clientes.tsx", import.meta.url).pathname)};
        import { LocationScopeProvider } from ${JSON.stringify(new URL("./lib/location-scope.tsx", import.meta.url).pathname)};
        ${jsonFetch(clientResponses)}
        const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
        export default function Fixture() { return <QueryClientProvider client={queryClient}><LocationScopeProvider><Clientes /></LocationScopeProvider></QueryClientProvider>; }
      `,
    }, async (page) => {
      await page.waitFor(`document.querySelector('[data-testid="tab-analysis"]') !== null`);
      await page.click('[data-testid="tab-analysis"]');
      await page.waitFor(`document.body?.textContent?.includes("Top por utilidad")`);
      const text = await page.evaluate<string>(`document.body.textContent ?? ""`);
      assert.match(text, /Top por utilidad/);
      assert.match(text, /Utilidad/);
      assert.doesNotMatch(text, /Rentabilidad/);
    });
    await withBrowserFixture({
      entrySource: `
        import React from "react";
        import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
        import { Router } from "wouter";
        import { memoryLocation } from "wouter/memory-location";
        import ClienteDetail from ${JSON.stringify(new URL("./pages/cliente-detail.tsx", import.meta.url).pathname)};
        import { LocationScopeProvider } from ${JSON.stringify(new URL("./lib/location-scope.tsx", import.meta.url).pathname)};
        ${jsonFetch(clientResponses)}
        const location = memoryLocation({ path: "/clientes/41" });
        const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
        export default function Fixture() { return <QueryClientProvider client={queryClient}><LocationScopeProvider><Router hook={location.hook}><ClienteDetail /></Router></LocationScopeProvider></QueryClientProvider>; }
      `,
    }, async (page) => {
      await page.waitFor(`document.querySelector('[data-testid="button-toggle-client-utility"]') !== null`);
      await page.click('[data-testid="button-toggle-client-utility"]');
      await page.waitFor(`document.querySelector('[data-testid="metric-client-lifetime-utility"]')?.textContent?.includes("450.00") === true`);
      const text = await page.evaluate<string>(`document.body.textContent ?? ""`);
      assert.match(text, /Utilidad acumulada/);
      assert.doesNotMatch(text, /Rentabilidad/);
    });
  } finally {
    await rm(fixtureDirectory, { recursive: true, force: true });
  }

  const exports = await readProfitExportOutput();
  assert.deepEqual(exports.customerHeaders, ["Cliente", "Folio", "Fecha", "Subtotal", "Modalidad", "Unidad", "Cantidad", "Utilidad"]);
  assert.equal(exports.customerRows[0]?.[7], 600, "the real customer workbook writes monetary utility in its Utilidad column");
  assert.ok(exports.cutXlsxLabels.includes("Utilidad"), "the real cut XLSX handler labels margin money as Utilidad");
  assert.match(exports.cutPdfText, /Utilidad: \$600\.00/, "the real cut PDF handler labels the monetary amount as Utilidad");
});