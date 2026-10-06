import React from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { E5ErrorResponseResponse } from "@workspace/api-client-react";
import * as fixture from "./e5-node-test-fixtures";

// Infrastructure preparation only. No productive permissions, money helpers,
// parents, E5 producers or UI primitives may be aliased to this module.
export let E5_ENABLED = true;
export const setGate = (enabled: boolean) => { E5_ENABLED = enabled; };
export const AppLayout = ({ children }: React.PropsWithChildren) => <>{children}</>;
export const LocationScopeProvider = AppLayout;
export const useLocationScope = () => ({ selectedLocationId: state.location });
export const state: Record<string, any> = {};
export const hooks: Record<string, (...args: any[]) => any> = {};
export const visits: { name: string; args: any[]; enabled?: boolean; refetch?: boolean }[] = [];
export type MutationCall = {
  name: string; variables: any; callbacks: any; defaults: any; settled: boolean; notify: () => void;
  resolve?: (value: any) => void; reject?: (error: unknown) => void;
};
export const calls: MutationCall[] = [];
export const transportVisits: { name: string; args: any[] }[] = [];
export async function dispatchTransport(name: string, args: any[]) {
  transportVisits.push({ name, args: fixture.wire(args) });
  if (state.transportHandlers?.[name]) return state.transportHandlers[name](...args);
  const key = ({ getE5Disponibilidad: "availability", getE5Contexto: "context",
    getE5Cobro: "detail", getE5DevolucionOpciones: "refundOptions",
    getPurchases: "purchases", getStats: "stats", getClientAnalytics: "analytics", getPortfolio: "portfolio" } as Record<string, string>)[name];
  if (!key || !(key in state)) throw Error(`E5_UNCONFIGURED_TRANSPORT ${name}`);
  return fixture.wire(state[key]);
}
export const mutationCalls = (name: string) => calls.filter(call => call.name === name);
export function dispatchHook(name: string, args: any[]) {
  if (!hooks[name]) throw Error(`E5_UNCONFIGURED_INFRASTRUCTURE_HOOK ${name}`);
  return hooks[name](...args);
}
export function installQuery(name: string, data: () => any, requireDisabled = false) {
  hooks[name] = (...args: any[]) => {
    const client = useQueryClient(), key = args.at(-1)?.query?.queryKey;
    const enabled = args.at(-1)?.query?.enabled !== false;
    visits.push({ name, args, enabled });
    if (requireDisabled && enabled) throw Error(`E5_UNEXPECTED_ENABLED_QUERY ${name}`);
    return {
      // Disabled hooks can still expose cached data; keep that privacy challenge.
      data: key ? client.getQueryData(key) ?? data() : data(),
      isLoading: state.loadingQueries?.includes(name) ?? false, isFetching: false,
      error: state.queryErrors?.[name], isError: Boolean(state.queryErrors?.[name]),
      refetch: async () => {
        visits.push({ name, args, enabled, refetch: true });
        if (requireDisabled) throw Error(`E5_UNEXPECTED_REFETCH ${name}`);
        return state.refetchHandlers?.[name]
          ? state.refetchHandlers[name](...args) : { data: data(), error: state.queryErrors?.[name] };
      },
    };
  };
}
export function installMutation(name: string, allowed = true) {
  hooks[name] = (options?: any) => {
    visits.push({ name, args: [options] });
    const [, notify] = React.useReducer((version: number) => version + 1, 0);
    const record = (variables: any, callbacks?: any) => {
      if (!allowed) throw Error(`E5_UNEXPECTED_MUTATION ${name}`);
      const call: MutationCall = { name, variables: fixture.wire(variables), callbacks: callbacks ?? {},
        defaults: options?.mutation ?? {}, settled: false, notify };
      calls.push(call); return call;
    };
    return {
      isPending: false, // Synchronous productive ref must work before pending state.
      mutate: (variables: any, callbacks?: any) => { record(variables, callbacks); },
      mutateAsync: (variables: any, callbacks?: any) => {
        const call = record(variables, callbacks);
        return new Promise((resolve, reject) => { call.resolve = resolve; call.reject = reject; });
      },
    };
  };
}
// Caller wraps deterministic settlement in act. Notification follows callbacks.
export function succeed(call: MutationCall, data: unknown) {
  if (!call || call.settled) throw Error("E5_INVALID_FIXTURE_SETTLEMENT");
  call.settled = true;
  for (const handlers of [call.defaults, call.callbacks]) {
    handlers.onSuccess?.(data, call.variables, undefined, undefined);
    handlers.onSettled?.(data, null, call.variables, undefined, undefined);
  }
  call.notify(); call.resolve?.(data);
}
export function fail(call: MutationCall, code: E5ErrorResponseResponse["error"]["code"] = "E5_VERSION_STALE", uncertain = false) {
  if (!call || call.settled) throw Error("E5_INVALID_FIXTURE_SETTLEMENT");
  call.settled = true;
  const data: E5ErrorResponseResponse = { error: { code, message: `Conflicto E5 fixture ${code}` } };
  const status = ["E5_DISABLED", "E5_DEPENDENCY_DISABLED", "E5_FORBIDDEN"].includes(code) ? 403
    : code === "E5_NOT_FOUND" ? 404 : ["E5_VALIDATION", "E5_EXACT_REQUIRED"].includes(code) ? 400 : 409;
  const error = uncertain ? Object.assign(new Error("Resultado desconocido por timeout"), { name: "TimeoutError" })
    : Object.assign(new Error(data.error.message), { status, data });
  for (const handlers of [call.defaults, call.callbacks]) {
    handlers.onError?.(error, call.variables, undefined, undefined);
    handlers.onSettled?.(undefined, error, call.variables, undefined, undefined);
  }
  call.notify(); call.reject?.(error);
}
export function resetHarness(role: Parameters<typeof fixture.currentUser>[0] = "ADMIN") {
  for (const key of Object.keys(state)) delete state[key];
  for (const key of Object.keys(hooks)) delete hooks[key];
   visits.length = 0; calls.length = 0; transportVisits.length = 0; setGate(true);
  Object.assign(state, {
    location: fixture.SITE, user: fixture.currentUser(role), availability: fixture.availability(role),
    context: fixture.context(role), detail: fixture.receipt({ role }),
    receipts: fixture.page([fixture.receipt({ role })]), refundOptions: fixture.refundOptions(),
    alerts: fixture.alerts(), document: fixture.document(),
    client: { id: fixture.CLIENT, nombre: "Cliente E5 fixture", activo: true, esSistema: false },
    ticket: { id: fixture.NOTE, clienteId: fixture.CLIENT, folio: "N-101", nombreCliente: "Cliente E5 fixture" },
    account: { clienteId: fixture.CLIENT, movimientos: [], saldoActual: fixture.TOTAL, saldoAFavor: "0.00" },
    purchases: { clienteId: fixture.CLIENT, compras: [], total: 0 },
    stats: { clienteId: fixture.CLIENT },
    analytics: { clienteId: fixture.CLIENT, periodo: { desde: null, hasta: null }, productos: [],
      telasColores: [], tendencia: [], mezclaPagos: [], actividad: { ultimaCompra: null, tickets: 0, ticketPromedio: null, ticketMaximo: null } },
    portfolio: { clientes: [] },
  });
  for (const [name, key] of [
    ["useGetCurrentUser", "user"], ["useGetE5Disponibilidad", "availability"],
    ["useGetE5Contexto", "context"], ["useListE5Cobros", "receipts"], ["useGetE5Cobro", "detail"],
    ["useGetE5DevolucionOpciones", "refundOptions"], ["useListE5Avisos", "alerts"], ["useGetE5Documento", "document"],
  ]) installQuery(name, () => state[key]);
  for (const [name, key] of [["useGetCliente", "client"], ["useObtenerTicket", "ticket"],
    ["useGetClienteEstadoCuenta", "account"]]) installQuery(name, () => state[key]);
  for (const name of ["useListarTickets", "useGetClientePagos", "useGetClientePrecios", "useListLocations"])
    installQuery(name, () => []);
  for (const name of ["useGetClienteCredito", "useObtenerComportamientoPagoCliente"])
    installQuery(name, () => undefined);
  installQuery("useGetCajaAbonoE3Context", () => undefined, true);
  installQuery("useGetCreditRefundOptions", () => undefined, true);
  installQuery("useListClienteRecibosE3", () => undefined, true);
  for (const name of ["useUpdateCliente", "useReactivarCliente", "useBajaCliente"])
    installMutation(name, false);
  for (const name of ["usePreviewE5Cobro", "useCreateE5Cobro", "useCreateE5Propuesta",
    "useAuthorizeE5Aplicacion", "useRejectE5Propuesta", "useReturnE5Cobro", "useRecordE5Impresion"])
    installMutation(name);
  // Other parent hooks stay strict until actual stable parents are inspected.
  for (const name of ["useConfirmCajaAbonoE3", "useCreateSolicitudPagoDirigido",
    "usePreviewCajaAbonoE3", "usePreviewClientePago", "useCreateClientePago", "useDevolverCreditoFisico"])
    installMutation(name, false);
}