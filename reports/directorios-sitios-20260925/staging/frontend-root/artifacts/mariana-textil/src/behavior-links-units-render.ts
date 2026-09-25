import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Router } from "wouter";
import { loadRenderTestModule } from "./render-test-bundle";

type BehaviorPage = React.ComponentType;
type BehaviorProvider = React.ComponentType<{ children: React.ReactNode }>;
const apiSchemasPath = new URL(
  "../../../lib/api-client-react/src/generated/api.schemas.ts",
  import.meta.url,
).pathname;

const apiClientStub = `
import {
  EstadoContenedor, EstadoSalida, ImportPreviewRowEstado,
  ListProductosExistencia, MotivoSalidaExtraordinaria, NotificationFamily,
  Role, TipoMovimiento, UnidadProducto,
} from ${JSON.stringify(apiSchemasPath)};
export {
  EstadoContenedor, EstadoSalida, ImportPreviewRowEstado,
  ListProductosExistencia, MotivoSalidaExtraordinaria, NotificationFamily,
  Role, TipoMovimiento, UnidadProducto,
};
let fixture = {};
export function setBehaviorFixture(next) { fixture = next; }
const result = (key) => ({ data: fixture[key], isLoading: false, isError: false, isFetching: false });
export function useGetCurrentUser() { return result("user"); }
export function useListLocations() { return result("locations"); }
export function useListProductos() { return result("productos"); }
export function useCreateProducto() { return { mutate() {}, isPending: false }; }
export function usePreviewImportProductos() { return { mutate() {}, isPending: false }; }
export function useConfirmImportProductos() { return { mutate() {}, isPending: false }; }
export function useGetKardexGrouped() { return result("movimientos"); }
export function useListKardexFilters() { return result("kardexFilters"); }
export function useListEntradasPendientesCosto() { return result("entradasPendientes"); }
export function useGetEntrada() { return result("entrada"); }
export function useCapturarCostosEntrada() { return { mutate() {}, isPending: false }; }
export function useListSalidas() { return result("salidas"); }
export function useGetUbicacionesSalida() { return result("ubicacionesSalida"); }
export function useListUsers() { return result("usuarios"); }
export function useListViajes() { return result("viajes"); }
export function useListContenedores() { return result("contenedores"); }
export function useGetResumenContenedores() { return result("resumenContenedores"); }
export function useGetCatalogosContenedores() { return result("catalogosContenedores"); }
export function useLogout() { return { mutate() {}, isPending: false }; }
export function useListAjustesPendientes() { return result("ajustesPendientes"); }
export function useCountEntradasPendientesCosto() { return result("countEntradasPendientes"); }
export function useGetUbicacionesInventario() { return result("ubicacionesInventario"); }
export function useObtenerSesionCajaActual() { return result("sesionCaja"); }
export function useGetNotificationFeed() { return result("notificaciones"); }
export function useListNotificaciones() { return result("notificaciones"); }
export function useMarkAllNotificacionesRead() { return { mutate() {}, isPending: false }; }
export function useMarkNotificacionRead() { return { mutate() {}, isPending: false }; }
export function useAprobarSolicitudPagoDirigido() { return { mutate() {}, isPending: false }; }
export async function listSolicitudesPagoDirigido() {
  if (!fixture.solicitudesPagoDirigido) throw new Error("Directed-payment fixture was not configured");
  return fixture.solicitudesPagoDirigido;
}
export function useRechazarSolicitudPagoDirigido() { return { mutate() {}, isPending: false }; }
export function useGetSalidaRecepcion() { return result("salidaRecepcion"); }
export function useListSalidasRecepcion() { return result("salidasRecepcion"); }
export function useRecibirSalida() { return { mutate() {}, isPending: false }; }
export function useListPisosLocation() { return result("pisos"); }
export function useCancelarSalida() { return { mutate() {}, isPending: false }; }
export function useGetSalida() { return result("salida"); }
export function useCrearSalidaMostrador() { return { mutate() {}, isPending: false }; }
export function useEntregarSalidaVentaCliente() { return { mutate() {}, isPending: false }; }
export function useVerificarAutorizacionVentaSalidas() { return result("autorizacionVenta"); }
export function useListSalidasExtraordinarias() { return result("salidasExtraordinarias"); }
export function useCreateSalidaExtraordinaria() { return { mutate() {}, isPending: false }; }
export function useListRollos() { return result("rollos"); }
export const getListProductosQueryKey = () => ["productos"];
export const getGetCurrentUserQueryKey = () => ["usuario"];
export const getListLocationsQueryKey = (params) => ["/api/locations", ...(params ? [params] : [])];
export const getGetKardexGroupedQueryKey = () => ["kardex"];
export const getListEntradasPendientesCostoQueryKey = () => ["entradas-pendientes"];
export const getGetEntradaQueryKey = () => ["entrada"];
export const getCountEntradasPendientesCostoQueryKey = () => ["count-entradas"];
export const getGetUbicacionesSalidaQueryKey = () => ["ubicaciones-salida"];
export const getListUsersQueryKey = () => ["usuarios"];
export const getListViajesQueryKey = () => ["viajes"];
export const getListSalidasQueryKey = () => ["salidas"];
export const getListContenedoresQueryKey = () => ["contenedores"];
export const getGetResumenContenedoresQueryKey = () => ["resumen-contenedores"];
export const getGetCatalogosContenedoresQueryKey = () => ["catalogos-contenedores"];
export const getGetUbicacionesInventarioQueryKey = () => ["ubicaciones-inventario"];
export const getListAjustesPendientesQueryKey = () => ["ajustes"];
export const getObtenerSesionCajaActualQueryKey = () => ["sesion-caja"];
export const getGetNotificationFeedQueryKey = () => ["notificaciones-feed"];
export const getCountNotificacionesNoLeidasQueryKey = () => ["notificaciones-count"];
export const getListNotificacionesQueryKey = () => ["notificaciones"];
export const getListSolicitudesPagoDirigidoQueryKey = () => ["solicitudes-pago"];
export const getGetSalidaRecepcionQueryKey = () => ["salida-recepcion"];
export const getListSalidasRecepcionQueryKey = () => ["salidas-recepcion"];
export const getGetSalidaQueryKey = () => ["salida"];
export const getGetExistenciasAgrupadasQueryKey = () => ["existencias-agrupadas"];
export const getGetExistenciasQueryKey = () => ["existencias"];
export const getListarTicketsCajaQueryKey = () => ["tickets-caja"];
export const getListarTicketsPendientesQueryKey = () => ["tickets-pendientes"];
export const getListarTicketsQueryKey = () => ["tickets"];
export const getListRollosQueryKey = () => ["rollos"];
export const getObtenerTicketQueryKey = () => ["ticket"];
export const getVerificarAutorizacionVentaSalidasQueryKey = () => ["autorizacion-venta"];
export const getListSalidasExtraordinariasQueryKey = () => ["salidas-extraordinarias"];
export const getGetRolloQueryKey = () => ["rollo"];
export const customFetch = async () => ({});
export async function exportKardexXlsx() { return new Blob(); }
export async function exportarSalidas() { return new Blob(); }
export async function exportContenedoresPdf() { return new Blob(); }
export async function exportContenedoresXlsx() { return new Blob(); }
`;

// These adapters only make otherwise-portal/closed controls observable to SSR.
// The page JSX, its data mapping, and all of its visible link destinations stay real.
const selectStub = `
import * as React from "react";
const box = (tag = "div") => React.forwardRef(({ children, ...props }, ref) =>
  React.createElement(tag, { ...props, ref }, children));
export const Root = ({ children }) => React.createElement("section", { "data-behavior-select-root": "" }, children);
export const Group = box(); export const Trigger = box("button"); export const Value = box("span");
export const Icon = ({ children }) => React.createElement(React.Fragment, null, children);
export const Portal = ({ children }) => React.createElement(React.Fragment, null, children);
export const Content = box(); export const Viewport = box();
export const Item = React.forwardRef(({ children, value, ...props }, ref) =>
  React.createElement("div", { ...props, ref, "data-behavior-select-value": value }, children));
export const ItemIndicator = ({ children }) => React.createElement(React.Fragment, null, children);
export const ItemText = ({ children }) => React.createElement(React.Fragment, null, children);
export const ScrollUpButton = box("button"); export const ScrollDownButton = box("button");
export const Label = box("span"); export const Separator = box();
`;

const dialogStub = `
import * as React from "react";
const box = (tag = "div") => React.forwardRef(({ children, ...props }, ref) =>
  React.createElement(tag, { ...props, ref }, children));
export const Root = ({ children }) => React.createElement(React.Fragment, null, children);
export const Trigger = box("button"); export const Portal = ({ children }) => React.createElement(React.Fragment, null, children);
export const Overlay = box(); export const Content = box(); export const Close = box("button");
export const Title = box("h2"); export const Description = box("p");
`;

export async function loadBehaviorLinksUnitsPages() {
  const directory = await mkdtemp(join(tmpdir(), "behavior-links-units-"));
  const apiClientPath = join(directory, "api-client-react.ts");
  const selectPath = join(directory, "radix-select.tsx");
  const dialogPath = join(directory, "radix-dialog.tsx");
  await Promise.all([
    writeFile(apiClientPath, apiClientStub),
    writeFile(selectPath, selectStub),
    writeFile(dialogPath, dialogStub),
  ]);

  try {
    return await loadRenderTestModule(
      `
        import Productos from ${JSON.stringify(new URL("./pages/productos.tsx", import.meta.url).pathname)};
        import Movimientos from ${JSON.stringify(new URL("./pages/movimientos.tsx", import.meta.url).pathname)};
        import EntradasPendientesCosto from ${JSON.stringify(new URL("./pages/entradas-pendientes-costo.tsx", import.meta.url).pathname)};
        import Salidas from ${JSON.stringify(new URL("./pages/salidas.tsx", import.meta.url).pathname)};
        import Viajes from ${JSON.stringify(new URL("./pages/viajes.tsx", import.meta.url).pathname)};
        import Contenedores from ${JSON.stringify(new URL("./pages/contenedores/index.tsx", import.meta.url).pathname)};
        import { LocationScopeProvider } from ${JSON.stringify(new URL("./lib/location-scope.tsx", import.meta.url).pathname)};
        export { Productos, Movimientos, EntradasPendientesCosto, Salidas, Viajes, Contenedores };
        export { LocationScopeProvider as BehaviorLocationScopeProvider };
        export { setBehaviorFixture } from "@workspace/api-client-react";
      `,
      {
        moduleAliases: {
          "@workspace/api-client-react": apiClientPath,
          "@radix-ui/react-select": selectPath,
          "@radix-ui/react-dialog": dialogPath,
        },
      },
    ) as {
      Productos: BehaviorPage;
      Movimientos: BehaviorPage;
      EntradasPendientesCosto: BehaviorPage;
      Salidas: BehaviorPage;
      Viajes: BehaviorPage;
      Contenedores: BehaviorPage;
      BehaviorLocationScopeProvider: BehaviorProvider;
      setBehaviorFixture: (fixture: Record<string, unknown>) => void;
    };
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

export function renderBehaviorLinksUnitsPage(
  Page: BehaviorPage,
  pageState: Record<string, unknown> = {},
  LocationScope: BehaviorProvider = React.Fragment as unknown as BehaviorProvider,
) {
  const previousWindow = globalThis.window;
  const previousReact = (globalThis as { React?: typeof React }).React;
  // tsx compiles this legacy provider with the classic transform in test mode.
  // Supplying React here is host plumbing only; page modules remain auto-JSX bundles.
  Object.defineProperty(globalThis, "React", { configurable: true, value: React });
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      location: { search: "" },
      history: { state: { __marianaPageState: pageState }, replaceState() {} },
      sessionStorage: { getItem: () => null, setItem() {} },
    },
  });
  try {
    return renderToStaticMarkup(
      React.createElement(
        Router,
        {
          ssrPath: "/",
          children: React.createElement(
            QueryClientProvider,
            { client: new QueryClient() },
            React.createElement(
              LocationScope,
              null,
              React.createElement(Page),
            ),
          ),
        },
      ),
    );
  } finally {
    if (previousWindow === undefined) delete (globalThis as { window?: Window }).window;
    else Object.defineProperty(globalThis, "window", { configurable: true, value: previousWindow });
    if (previousReact === undefined) delete (globalThis as { React?: typeof React }).React;
    else Object.defineProperty(globalThis, "React", { configurable: true, value: previousReact });
  }
}

export function behaviorLinkHref(html: string, visibleText: string) {
  for (const match of html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)) {
    const text = match[2].replace(/<[^>]+>/g, "").replace(/&amp;/g, "&");
    if (text === visibleText) {
      return match[1].match(/\bhref="([^"]*)"/)?.[1] ?? null;
    }
  }
  return null;
}

export function behaviorSelectValueGroups(html: string) {
  return [...html.matchAll(/<section data-behavior-select-root="">([\s\S]*?)<\/section>/g)].map(
    (section) => [...section[1].matchAll(/data-behavior-select-value="([^"]+)"/g)].map(
      (value) => value[1],
    ),
  );
}