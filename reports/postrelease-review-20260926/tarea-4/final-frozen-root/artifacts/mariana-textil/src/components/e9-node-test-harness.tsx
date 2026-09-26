import React from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { E9ErrorResponseResponse } from "@workspace/api-client-react";
import * as fixtures from "./e9-node-test-fixtures";

// Infrastructure only. Never alias productive permissions, E9 producers or UI.
export let E9_ENABLED = true;
export const setGate = (enabled: boolean) => { E9_ENABLED = enabled; };
export const AppLayout = ({ children }: React.PropsWithChildren) => <>{children}</>;
export const useLocationScope = () => ({ selectedLocationId: state.location });
export const state: Record<string, any> = {};
export const hooks: Record<string, (...args: any[]) => any> = {};
export const visits: { name: string; args: any[]; enabled?: boolean; refetch?: boolean }[] = [];
export type MutationCall = {
  name: string; variables: any; callbacks: any; defaults: any; settled: boolean;
  notify: () => void; resolve?: (value: any) => void; reject?: (error: unknown) => void;
};
export const calls: MutationCall[] = [];
export const mutationCalls = (name: string) => calls.filter(call => call.name === name);
export function dispatchHook(name: string, args: any[]) {
  if (!hooks[name]) throw Error(`E9_UNCONFIGURED_INFRASTRUCTURE_HOOK ${name}`);
  return hooks[name](...args);
}
export function installQuery(name: string, data: () => any, requireDisabled = false) {
  hooks[name] = (...args: any[]) => {
    const client = useQueryClient();
    const queryKey = args.at(-1)?.query?.queryKey;
    const enabled = args.at(-1)?.query?.enabled !== false;
    visits.push({ name, args, enabled });
    if (requireDisabled && enabled) throw Error(`E9_UNEXPECTED_ENABLED_QUERY ${name}`);
    return {
      // Honor productive setQueryData; settlement's React notification/renders
      // expose that real cache value without mocking productive invalidation.
      data: queryKey ? client.getQueryData(queryKey) ?? data() : data(),
      isLoading: state.loadingQueries?.includes(name) ?? false,
      isFetching: false, isError: Boolean(state.queryErrors?.[name]), error: state.queryErrors?.[name],
      refetch: async () => {
        visits.push({ name, args, enabled, refetch: true });
        if (requireDisabled) throw Error(`E9_UNEXPECTED_REFETCH ${name}`);
        if (state.refetchHandlers?.[name]) return state.refetchHandlers[name](...args);
        return { data: data(), error: state.queryErrors?.[name] };
      },
    };
  };
}
export function installMutation(name: string, allowed = true) {
  hooks[name] = (options?: any) => {
    const [, notify] = React.useReducer((version: number) => version + 1, 0);
    const record = (variables: any, callbacks?: any) => {
      if (!allowed) throw Error(`E9_UNEXPECTED_MUTATION ${name}`);
      const call: MutationCall = { name, variables: fixtures.wire(variables),
        callbacks: callbacks ?? {}, defaults: options?.mutation ?? {}, settled: false, notify };
      calls.push(call);
      return call;
    };
    return {
      // Deliberately no pending-state help: producer must synchronously lock.
      isPending: false,
      mutate: (variables: any, callbacks?: any) => { record(variables, callbacks); },
      mutateAsync: (variables: any, callbacks?: any) => {
        const call = record(variables, callbacks);
        return new Promise((resolve, reject) => { call.resolve = resolve; call.reject = reject; });
      },
    };
  };
}
// Wrap in act. Ordering matches E12-corrected MutationObserver notification.
export function succeed(call: MutationCall, data: unknown) {
  if (!call || call.settled) throw Error("E9_INVALID_FIXTURE_SETTLEMENT");
  call.settled = true;
  for (const handlers of [call.defaults, call.callbacks]) {
    handlers.onSuccess?.(data, call.variables, undefined, undefined);
    handlers.onSettled?.(data, null, call.variables, undefined, undefined);
  }
  call.notify(); call.resolve?.(data);
}
export function fail(call: MutationCall, code: E9ErrorResponseResponse["error"]["code"] = "E9_CONTEO_STALE", uncertain = false) {
  if (!call || call.settled) throw Error("E9_INVALID_FIXTURE_SETTLEMENT");
  call.settled = true;
  const data: E9ErrorResponseResponse = { error: { code, message: `Conflicto fixture ${code}` } };
  const status = ["E9_DISABLED", "E9_FORBIDDEN"].includes(code) ? 403
    : code === "E9_NOT_FOUND" ? 404 : ["E9_VALIDATION", "E9_RECEIVED_ZERO"].includes(code) ? 400 : 409;
  const error = uncertain
    ? Object.assign(new Error("Tiempo de espera agotado; resultado desconocido"), { name: "TimeoutError" })
    : Object.assign(new Error(data.error.message), { status, data });
  for (const handlers of [call.defaults, call.callbacks]) {
    handlers.onError?.(error, call.variables, undefined, undefined);
    handlers.onSettled?.(undefined, error, call.variables, undefined, undefined);
  }
  call.notify(); call.reject?.(error);
}
export function resetHarness(role: Parameters<typeof fixtures.currentUser>[0] = "ADMIN") {
  for (const key of Object.keys(state)) delete state[key];
  for (const key of Object.keys(hooks)) delete hooks[key];
  visits.length = 0; calls.length = 0; setGate(true);
  Object.assign(state, { location: fixtures.SITE, user: fixtures.currentUser(role),
    availability: fixtures.availability(role), detail: fixtures.delivery({ role }),
    deliveries: fixtures.page([fixtures.delivery({ role })]), cut: fixtures.frozenCut(), cuts: fixtures.cuts(),
    users: fixtures.users(), adminCuts: fixtures.adminCuts() });
  for (const [name, key] of [
    ["useGetCurrentUser", "user"], ["useGetE9Disponibilidad", "availability"],
    ["useListE9Entregas", "deliveries"], ["useGetE9Entrega", "detail"],
    ["useObtenerCorteCaja", "cut"], ["useListarSesionesCaja", "cuts"],
    ["useListUsers", "users"], ["useListAdminCortes", "adminCuts"], ["useGetAdminCorte", "cut"],
  ]) installQuery(name, () => state[key]);
  for (const name of ["useCreateE9Entrega", "useCreateE9Conteo", "useAuthorizeE9Recepcion", "useCloseE9Investigacion"])
    installMutation(name);
  installQuery("useListCajaRecibosE3", () => undefined, true);
}