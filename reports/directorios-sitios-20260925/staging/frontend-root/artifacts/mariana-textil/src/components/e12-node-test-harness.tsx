import React from "react";
import * as fixtures from "./e12-node-test-fixtures";

// Infrastructure only. No payment, reversal, sources/permissions, money
// validation, UI primitive or productive parent is replaced by this module.
export let E12_ENABLED = true;
export let E4_CASH_OUT_ENABLED = true;
export const setGate = (value: boolean) => { E12_ENABLED = value; };
export const setE4Gate = (value: boolean) => { E4_CASH_OUT_ENABLED = value; };
export const AppLayout = ({ children }: React.PropsWithChildren) => <>{children}</>;
export const useLocationScope = () => ({ selectedLocationId: state.location });
export const hooks: Record<string, (...args: any[]) => any> = {};
export const visits: { name: string; args: any[] }[] = [];
export const queryObservations: { name: string; enabled: boolean; kind: "hook" | "refetch" }[] = [];
export type MutationCall = {
  name: string; variables: any; callbacks: any; defaults: any; settled: boolean;
  notify: () => void;
  resolve?: (value: any) => void; reject?: (error: unknown) => void;
};
export const calls: MutationCall[] = [];
export const state: Record<string, any> = {};

export function dispatchHook(name: string, args: any[]) {
  visits.push({ name, args });
  if (!hooks[name]) throw Error(`E12_UNCONFIGURED_INFRASTRUCTURE_HOOK ${name}`);
  return hooks[name](...args);
}

// These observations concern enabled/refetch contracts, NOT real HTTP counts.
export function installQuery(name: string, data: () => any, requireDisabled = false) {
  let enabled = false;
  const result = {
    data: undefined as any, isLoading: false, isFetching: false, isError: false,
    refetch: async () => {
      queryObservations.push({ name, enabled, kind: "refetch" });
      if (requireDisabled) throw Error(`E12_UNEXPECTED_UNRELATED_REFETCH ${name}`);
      return { data: data() };
    },
  };
  hooks[name] = (...args: any[]) => {
    enabled = args.at(-1)?.query?.enabled !== false;
    queryObservations.push({ name, enabled, kind: "hook" });
    if (requireDisabled && enabled) throw Error(`E12_UNEXPECTED_ENABLED_QUERY ${name}`);
    // A disabled React Query hook can legitimately expose cached data.
    result.data = data();
    return result;
  };
}

export function installMutation(name: string, allowed = true) {
  hooks[name] = (options?: any) => {
    // MutationObserver notifies its React subscriber AFTER per-call callbacks.
    // A ref reset in onSettled alone does not render (useToast uses Sonner and
    // does not subscribe this component). Preserve that completion notification
    // while deliberately withholding pending-state help from double-click tests.
    const [, notify] = React.useReducer((version: number) => version + 1, 0);
    const record = (variables: any, callbacks: any) => {
      if (!allowed) throw Error(`E12_UNRELATED_MUTATION ${name}`);
      const call: MutationCall = {
        name, variables: fixtures.wire(variables), callbacks: callbacks ?? {},
        defaults: options?.mutation ?? {}, settled: false, notify,
      };
      calls.push(call);
      return call;
    };
    return {
      // Deliberately no automatic pending state: synchronous double-click
      // tests exercise the component's intention lock before React rerenders.
      isPending: false,
      mutate: (variables: any, callbacks?: any) => { record(variables, callbacks); },
      mutateAsync: (variables: any, callbacks?: any) => {
        const call = record(variables, callbacks);
        return new Promise((resolve, reject) => { call.resolve = resolve; call.reject = reject; });
      },
    };
  };
}

export const mutationCalls = (name: string) => calls.filter(call => call.name === name);

// Caller wraps these deterministic transport callbacks in Testing Library act.
export function succeed(call: MutationCall, response: unknown) {
  if (!call || call.settled) throw Error("E12_FIXTURE_INVALID_SETTLEMENT");
  call.settled = true;
  for (const handlers of [call.defaults, call.callbacks]) {
    handlers.onSuccess?.(response, call.variables, undefined, undefined);
    handlers.onSettled?.(response, null, call.variables, undefined, undefined);
  }
  call.notify();
  call.resolve?.(response);
}

export function fail(call: MutationCall, code = "E12_SESSION_CLOSED") {
  if (!call || call.settled) throw Error("E12_FIXTURE_INVALID_SETTLEMENT");
  call.settled = true;
  const error = Object.assign(new Error(`Conflicto fixture ${code}`), {
    status: 409, data: { error: `Conflicto fixture ${code}`, code },
  });
  for (const handlers of [call.defaults, call.callbacks]) {
    handlers.onError?.(error, call.variables, undefined, undefined);
    handlers.onSettled?.(undefined, error, call.variables, undefined, undefined);
  }
  call.notify();
  call.reject?.(error);
}

export function resetHarness() {
  for (const key of Object.keys(hooks)) delete hooks[key];
  for (const key of Object.keys(state)) delete state[key];
  visits.length = 0; calls.length = 0; queryObservations.length = 0;
  setGate(true); setE4Gate(true);
  Object.assign(state, {
    location: 1, user: fixtures.currentUser(), options: fixtures.cashOptions(),
    payment: fixtures.paymentDetail(), purchase: fixtures.purchaseDetail(),
    directed: fixtures.directedRequests(), provider: fixtures.provider(),
    purchases: fixtures.purchases(), statement: fixtures.statement(), statistics: fixtures.statistics(),
    cut: fixtures.cut(), cashOuts: fixtures.cashOuts(), cashProviders: fixtures.cashProviders(),
  });
  for (const [name, key] of [
    ["useGetCurrentUser", "user"], ["useGetOpcionesPagoEfectivoProveedor", "options"],
    ["useGetProveedorPagoDetalle", "payment"], ["useGetProveedorCompraDetalle", "purchase"],
    ["useListSolicitudesPagoDirigido", "directed"], ["useGetProveedor", "provider"],
    ["useListComprasProveedor", "purchases"], ["useEstadoCuentaProveedor", "statement"],
    ["useEstadisticasProveedor", "statistics"],
    ["useObtenerCorteCaja", "cut"], ["useListarSalidasDineroCaja", "cashOuts"],
    ["useListarProveedoresActivosCaja", "cashProviders"],
  ]) installQuery(name, () => state[key]);
  for (const name of [
    "usePreviewPagoProveedor", "useRegistrarPagoProveedor", "useCreateSolicitudPagoDirigido",
    "useReversarPagoProveedor", "useAprobarSolicitudPagoDirigido", "useCrearSalidaDineroCaja",
  ]) installMutation(name);
  for (const name of ["useUpdateProveedor", "useRegistrarAjusteProveedor", "useRechazarSolicitudPagoDirigido", "useRevisarSalidaDineroCaja"])
    installMutation(name, false);
  installQuery("useGetProveedorUtilidad", () => undefined, true);
}