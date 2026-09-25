import React from "react";
export const state = { tienda: 1, balance: "1000.00", balanceError: null as Error | null };
export let E4_CASH_OUT_ENABLED = true;
export const setGate = (enabled: boolean) => { E4_CASH_OUT_ENABLED = enabled; };
export const hooks: Record<string, (...args: any[]) => any> = {};
export const visits: string[] = [];
export const captureCalls: any[][] = [];
export const reviewCalls: any[][] = [];
export function dispatchHook(name: string, args: any[]) {
  visits.push(name);
  if (hooks[name]) return hooks[name](...args);
  throw Error(`Unconfigured infrastructure hook ${name}`);
}
export function resetHarness() {
  for (const key of Object.keys(hooks)) delete hooks[key];
  captureCalls.length = 0; reviewCalls.length = 0; visits.length = 0;
  state.tienda = 1; state.balance = "1000.00"; state.balanceError = null; setGate(true);
  hooks.useCrearSalidaDineroCaja = () => ({ isPending: false, mutate: (...args: any[]) => captureCalls.push(args) });
  hooks.useRevisarSalidaDineroCaja = () => ({ isPending: false, mutate: (...args: any[]) => reviewCalls.push(args) });
  hooks.useListarSalidasDineroCaja = () => ({ data: { salidas: [] }, isLoading: false, isError: false });
  hooks.useListarProveedoresActivosCaja = () => ({ data: [{ id: 1, nombre: "Proveedor activo fixture" }] });
  hooks.useListarTicketsCaja = () => ({ data: [], isError: false });
  hooks.useObtenerCorteCaja = (...args: any[]) => {
    if (args.at(-1)?.query?.enabled === false) {
      return { data: undefined, error: null, isLoading: false, isError: false, refetch: async () => ({ data: undefined, error: null }) };
    }
    const current = () => state.balanceError
      ? { data: undefined, error: state.balanceError }
      : { data: { sesion: { estado: "ABIERTA" }, efectivoEsperado: state.balance }, error: null };
    const result = current();
    return { ...result, isLoading: false, isError: !!result.error, refetch: async () => current() };
  };
  for (const name of ["useObtenerTicket", "useObtenerProyeccionAutorizacionNota", "useListLocations"]) {
    hooks[name] = (...args: any[]) => {
      if (args.at(-1)?.query?.enabled !== false) throw Error(`Unexpected enabled query ${name}`);
      return { data: undefined, isLoading: false, isError: false, refetch: () => { throw Error(`Unexpected refetch ${name}`); } };
    };
  }
  for (const name of ["useCerrarSesionCaja", "useCobrarTicket", "useAutorizarNota"]) {
    hooks[name] = () => ({ isPending: false, mutate: () => { throw Error(`Unexpected unrelated mutation ${name}`); } });
  }
}
// Navigation infrastructure only; neither page, E4 panel/item nor UI primitives
// are substituted. Production role constants/query keys come from actual API.
export const AppLayout = ({ children }: React.PropsWithChildren) => <>{children}</>;
export const useLocationScope = () => ({ selectedLocationId: state.tienda });