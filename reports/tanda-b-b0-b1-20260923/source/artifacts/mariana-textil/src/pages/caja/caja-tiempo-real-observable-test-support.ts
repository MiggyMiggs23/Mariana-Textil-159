import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  GetAdminCuentasDestinoResponse,
  GetAdminRealtimeDashboardResponse,
  GetAdminRealtimePendingResponse,
  ListAdminRealtimeBreakdownResponse,
} from "@workspace/api-zod";

const dashboard = GetAdminRealtimeDashboardResponse.parse({
  generatedAt: "2026-06-15T15:30:00.000Z",
  fullRefreshSeconds: 300,
  pendingRefreshSeconds: 30,
  totales: {
    ventas: "1000.00",
    cobrado: "850.00",
    pendiente: "150.00",
    subtotal: "862.07",
    iva: "137.93",
    costo: "500.00",
    margen: "350.00",
    margenPorcentaje: "35.00",
    tickets: 10,
    ticketsCobrados: 8,
    documentosPendientes: 2,
    cancelaciones: 2,
    lineasExcluidasMargen: 0,
  },
  cantidades: [{
    modalidad: "METRAJE",
    tipo: "NORMAL",
    unidad: "METRO",
    cantidad: "12.50",
  }],
  ventasCredito: { importe: "150.00", operaciones: 2 },
  cancelaciones: {
    tickets: 2,
    importe: "50.00",
    tasaCancelacion: "20.00",
    excedeUmbral: true,
  },
  salidasEnTransito: { conteo: 2, importe: "75.00" },
  salidasCanceladas: { conteo: 1, importe: "30.00" },
  pendientes: {
    tickets: 2,
    ticketsSinCobrar: 1,
    notasSinAutorizar: 1,
    importe: "150.00",
    tiendas: [],
  },
  tiendas: [{
    ubicacionId: 1,
    nombreUbicacion: "Sucursal observable",
    sesionCajaId: 10,
    abiertaAt: "2026-06-15T08:00:00.000Z",
    cajero: "Cajera observable",
    usuarioTerminal: "Terminal observable",
    vendido: "1000.00",
    cobrado: "850.00",
    pendiente: "150.00",
    tickets: 10,
    ticketsCobrados: 8,
    ticketPromedio: "100.00",
    margen: "350.00",
    margenPorcentaje: "35.00",
    efectivo: "500.00",
    transferencia: "350.00",
    credito: "150.00",
    creditoOperaciones: 2,
    pendientes30Min: 1,
    cancelaciones: 2,
    tasaCancelacion: "20.00",
    alertas: ["COBRO_PENDIENTE"],
  }],
  comparativo: [],
  ultimosTickets: [],
});

const pending = GetAdminRealtimePendingResponse.parse({
  tickets: 2,
  ticketsSinCobrar: 1,
  notasSinAutorizar: 1,
  importe: "150.00",
  tiendas: [],
});

const emptyAccountRow = {
  importe: "0.00",
  cuentaDestino: null,
  formasPago: [],
};
const cuentasDestino = GetAdminCuentasDestinoResponse.parse({
  resumen: [],
  tendencia: [],
  porTienda: [],
  encabezado: {
    vendido: {
      contado: "850.00",
      credito: "150.00",
      total: "1000.00",
      totalAnterior: null,
      variacionPorcentaje: null,
    },
    porCobrar: {
      periodo: "150.00",
      periodoAnterior: null,
      variacionPorcentaje: null,
    },
    cobrado: {
      contado: "850.00",
      abonos: "25.00",
      saldosFavor: "0.00",
      total: "875.00",
      totalAnterior: null,
      variacionPorcentaje: null,
    },
    previousDesde: null,
    previousHasta: null,
  },
  cobrosAnteriores: [],
  matriz: {
    filas: Array.from({ length: 3 }, () => ({
      facturado: null,
      efectivo: emptyAccountRow,
      transferencia: emptyAccountRow,
      porCobrar: emptyAccountRow,
      otras: emptyAccountRow,
      total: "0.00",
    })),
    cierra: true,
  },
  ivaFacturado: { base: "0.00", iva: "0.00" },
  incongruencias: { conteo: 0, importe: "0.00" },
  facturacion: {
    facturadoTotal: "0.00",
    noFacturadoTotal: "0.00",
    facturadoEfectivo: "0.00",
    facturadoTransferencia: "0.00",
    noFacturadoEfectivo: "0.00",
    noFacturadoTransferencia: "0.00",
  },
  ivaCobrado: "0.00",
  totalCobrado: "875.00",
});

const breakdowns = {
  COBRADO: ListAdminRealtimeBreakdownResponse.parse({
    concepto: "COBRADO",
    items: [{
      id: 101,
      folio: 5001,
      hora: "2026-06-15T10:15:00.000Z",
      cliente: "María Pagó",
      importe: "850.00",
      formaPago: "EFECTIVO",
      facturado: true,
      diasPlazo: null,
      fechaVencimiento: null,
      documentoTipo: "TICKET",
      minutosEspera: null,
      nombreUsuarioCancelacion: null,
      canceladoAt: null,
      motivoCancelacion: null,
    }],
    total: 1,
    page: 1,
    pageSize: 50,
    montoTotal: "850.00",
  }),
  CREDITO: ListAdminRealtimeBreakdownResponse.parse({
    concepto: "CREDITO",
    items: [{
      id: 102,
      folio: 5002,
      hora: "2026-06-15T10:20:00.000Z",
      cliente: "Cliente crédito",
      importe: "150.00",
      formaPago: "CREDITO",
      facturado: false,
      diasPlazo: 30,
      fechaVencimiento: "2026-07-15",
      documentoTipo: "NOTA",
      minutosEspera: null,
      nombreUsuarioCancelacion: null,
      canceladoAt: null,
      motivoCancelacion: null,
    }],
    total: 1,
    page: 1,
    pageSize: 50,
    montoTotal: "150.00",
  }),
  PENDIENTE: ListAdminRealtimeBreakdownResponse.parse({
    concepto: "PENDIENTE",
    items: [{
      id: 103,
      folio: 5003,
      hora: "2026-06-15T10:25:00.000Z",
      cliente: "Cliente pendiente",
      importe: "150.00",
      formaPago: null,
      facturado: null,
      diasPlazo: null,
      fechaVencimiento: null,
      documentoTipo: "NOTA",
      minutosEspera: 45,
      nombreUsuarioCancelacion: null,
      canceladoAt: null,
      motivoCancelacion: null,
    }],
    total: 1,
    page: 1,
    pageSize: 50,
    montoTotal: "150.00",
  }),
  CANCELADAS: ListAdminRealtimeBreakdownResponse.parse({
    concepto: "CANCELADAS",
    items: [{
      id: 104,
      folio: 5004,
      hora: "2026-06-15T10:30:00.000Z",
      cliente: "Cliente cancelado",
      importe: "50.00",
      formaPago: null,
      facturado: null,
      diasPlazo: null,
      fechaVencimiento: null,
      documentoTipo: "TICKET",
      minutosEspera: null,
      nombreUsuarioCancelacion: "Cajera Uno",
      canceladoAt: "2026-06-15T10:31:00.000Z",
      motivoCancelacion: "Captura duplicada",
    }],
    total: 1,
    page: 1,
    pageSize: 50,
    montoTotal: "50.00",
  }),
  SALIDAS_EN_TRANSITO: ListAdminRealtimeBreakdownResponse.parse({
    concepto: "SALIDAS_EN_TRANSITO",
    items: [{
      salidaId: 105,
      folio: 7001,
      origenId: 1,
      origen: "Matriz",
      destinoId: 2,
      destino: "Sucursal Centro",
      clienteId: null,
      cliente: null,
      fecha: "2026-06-15T10:35:00.000Z",
      importe: "75.00",
      href: "/salidas/105",
    }],
    total: 1,
    page: 1,
    pageSize: 50,
    montoTotal: "75.00",
  }),
  SALIDAS_CANCELADAS: ListAdminRealtimeBreakdownResponse.parse({
    concepto: "SALIDAS_CANCELADAS",
    items: [{
      salidaId: 106,
      folio: 7002,
      origenId: 1,
      origen: "Matriz",
      destinoId: null,
      destino: null,
      clienteId: 9,
      cliente: "Cliente salida",
      fecha: "2026-06-15T10:40:00.000Z",
      importe: "30.00",
      href: "/salidas/106",
    }],
    total: 1,
    page: 1,
    pageSize: 50,
    montoTotal: "30.00",
  }),
};

export async function createCajaTiempoRealBrowserFixture() {
  const directory = await mkdtemp(join(tmpdir(), "caja-tiempo-real-observable-"));
  const apiClientPath = join(directory, "api-client-react.ts");
  const locationScopePath = join(directory, "location-scope.ts");
  const layoutPath = join(directory, "layout.tsx");
  const cuentasDestinoPath = join(directory, "cuentas-destino.ts");
  const pagePath = new URL("./tiempo-real.tsx", import.meta.url).pathname;

  await Promise.all([
    writeFile(
      apiClientPath,
      `
        const dashboard = ${JSON.stringify(dashboard)};
        const pending = ${JSON.stringify(pending)};
        export const getGetAdminRealtimeDashboardQueryKey = () => ["realtime-dashboard"];
        export const getGetAdminRealtimePendingQueryKey = () => ["realtime-pending"];
        export const useGetAdminRealtimeDashboard = () => ({
          data: dashboard, isLoading: false, isError: false, dataUpdatedAt: 0, refetch() {},
        });
        export const useGetAdminRealtimePending = () => ({
          data: pending, isLoading: false, isError: false, dataUpdatedAt: 0, refetch() {},
        });
      `,
      "utf8",
    ),
    writeFile(
      locationScopePath,
      `export const useLocationScope = () => ({ selectedLocationId: null, setSelectedLocationId() {} });`,
      "utf8",
    ),
    writeFile(
      layoutPath,
      `export function AppLayout({ children }: { children: import("react").ReactNode }) { return <main>{children}</main>; }`,
      "utf8",
    ),
    writeFile(
      cuentasDestinoPath,
      `const cuentasDestino = ${JSON.stringify(cuentasDestino)};
       export const useSharedCuentasDestino = () => ({
         data: cuentasDestino, isLoading: false, isError: false, refetch() {},
       });`,
      "utf8",
    ),
  ]);

  return {
    options: {
      entrySource: `
        import React from "react";
        import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
        import CajaTiempoReal from ${JSON.stringify(pagePath)};

        const queryClient = new QueryClient({
          defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
        });
        const breakdowns = ${JSON.stringify(breakdowns)};
        globalThis.fetch = async (input) => {
          const url = new URL(String(input), window.location.origin);
          if (url.pathname !== "/api/admin/dashboard/realtime/desglose") {
            return new Response("not found", { status: 404 });
          }
          const detail = breakdowns[url.searchParams.get("concepto")];
          return new Response(JSON.stringify(detail), {
            status: detail ? 200 : 404,
            headers: { "content-type": "application/json" },
          });
        };

        export default function Fixture() {
          return <QueryClientProvider client={queryClient}><CajaTiempoReal /></QueryClientProvider>;
        }
      `,
      moduleAliases: {
        "@workspace/api-client-react": apiClientPath,
        "@/components/layout/app-layout": layoutPath,
        "@/hooks/use-shared-cuentas-destino": cuentasDestinoPath,
        "@/lib/location-scope": locationScopePath,
      },
    },
    async dispose() {
      await rm(directory, { recursive: true, force: true });
    },
  };
}