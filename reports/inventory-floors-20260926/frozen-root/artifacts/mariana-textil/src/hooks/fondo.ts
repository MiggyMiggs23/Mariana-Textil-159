import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { 
  useGetFondo as useGenGetFondo,
  useListFondoMovimientos as useGenGetFondoMovimientos,
  useGetFondoMovimiento as useGenGetFondoMovimiento,
  useListFondoArqueos as useGenGetFondoArqueos,
  useGetFondoArqueo as useGenGetFondoArqueo,
  useCreateFondoMovimiento as useGenCreateFondoMovimiento,
  useReverseFondoMovimiento as useGenReverseFondoMovimiento,
  useCreateFondoArqueo as useGenCreateFondoArqueo,
  exportFondoCsv,
  getGetFondoQueryKey,
  getListFondoMovimientosQueryKey,
  getGetFondoMovimientoQueryKey,
  getListFondoArqueosQueryKey,
  getGetFondoArqueoQueryKey,
  useGetCurrentUser,
  getGetCurrentUserQueryKey,
  type FondoCategoria,
  type FondoNaturaleza,
  type FondoMovimientoInput,
  type FondoInversoInput,
  type FondoArqueoInput,
  type ListFondoMovimientosParams,
  type ListFondoArqueosParams
} from "@workspace/api-client-react";

export type CategoriaFondo = FondoCategoria;
export type NaturalezaFondo = FondoNaturaleza;

function useFondoAuthGuard() {
  const { data: user } = useGetCurrentUser({
    query: { queryKey: getGetCurrentUserQueryKey(), staleTime: Infinity }
  });
  const isFondoEnabled = import.meta.env?.VITE_FONDO_E10_ENABLED === "true" || (typeof window !== "undefined" && (window as any).__test_FondoEnabled);
  const isAuthorized = isFondoEnabled && user?.rol === "ADMIN";
  const authKey = isAuthorized ? ["fondo-auth", String(user.id), user.rol] : ["fondo-auth", "unauthorized"];
  return { user, isAuthorized, authKey };
}

// Helper to invalidate all Fondo queries strictly matching the current auth scope
export function invalidateFondoQueries(queryClient: any, authKey: string[]) {
  queryClient.invalidateQueries({ predicate: (query: any) => query.queryKey[0] === "fondo-auth" && query.queryKey[1] === authKey[1] && query.queryKey[2] === authKey[2] });
}

function decorateKey(baseKey: readonly unknown[], authKey: string[]) {
  return [...authKey, ...baseKey];
}

export function useGetFondo() {
  const { isAuthorized, authKey } = useFondoAuthGuard();
  const baseKey = getGetFondoQueryKey();
  const queryKey = decorateKey(baseKey, authKey);
  
  return useGenGetFondo({ 
    query: { 
      queryKey, 
      enabled: isAuthorized,
      refetchInterval: 30000,
    } 
  });
}

export function useGetFondoMovimientos(params?: ListFondoMovimientosParams) {
  const { isAuthorized, authKey } = useFondoAuthGuard();
  const baseKey = getListFondoMovimientosQueryKey(params);
  const queryKey = decorateKey(baseKey, authKey);

  return useGenGetFondoMovimientos(params, { 
    query: { 
      queryKey, 
      enabled: isAuthorized,
      refetchInterval: 30000,
    } 
  });
}

export function useGetFondoMovimiento(id: string) {
  const { isAuthorized, authKey } = useFondoAuthGuard();
  const baseKey = getGetFondoMovimientoQueryKey(id);
  const queryKey = decorateKey(baseKey, authKey);

  return useGenGetFondoMovimiento(id, { 
    query: { 
      queryKey, 
      enabled: isAuthorized && !!id 
    } 
  });
}

export function useGetFondoArqueos(params?: ListFondoArqueosParams) {
  const { isAuthorized, authKey } = useFondoAuthGuard();
  const baseKey = getListFondoArqueosQueryKey(params);
  const queryKey = decorateKey(baseKey, authKey);

  return useGenGetFondoArqueos(params, { 
    query: { 
      queryKey, 
      enabled: isAuthorized,
      refetchInterval: 30000,
    } 
  });
}

export function useGetFondoArqueo(id: string) {
  const { isAuthorized, authKey } = useFondoAuthGuard();
  const baseKey = getGetFondoArqueoQueryKey(id);
  const queryKey = decorateKey(baseKey, authKey);

  return useGenGetFondoArqueo(id, { 
    query: { 
      queryKey, 
      enabled: isAuthorized && !!id 
    } 
  });
}

export function useCreateFondoMovimiento() {
  const queryClient = useQueryClient();
  const { authKey } = useFondoAuthGuard();
  return useGenCreateFondoMovimiento({
    mutation: {
      onSuccess: () => {
        invalidateFondoQueries(queryClient, authKey);
      },
    },
  });
}

export function useCreateFondoMovimientoInverso() {
  const queryClient = useQueryClient();
  const { authKey } = useFondoAuthGuard();
  return useGenReverseFondoMovimiento({
    mutation: {
      onSuccess: () => {
        invalidateFondoQueries(queryClient, authKey);
      },
    },
  });
}

export function useCreateFondoArqueo() {
  const queryClient = useQueryClient();
  const { authKey } = useFondoAuthGuard();
  return useGenCreateFondoArqueo({
    mutation: {
      onSuccess: () => {
        invalidateFondoQueries(queryClient, authKey);
      },
    },
  });
}

export async function exportarFondoCSV(tipo: "movimientos" | "arqueos", queryClient: QueryClient) {
  const isFondoEnabled = import.meta.env?.VITE_FONDO_E10_ENABLED === "true" || (typeof window !== "undefined" && (window as any).__test_FondoEnabled);
  if (!isFondoEnabled) {
    throw new Error("Fondo no habilitado");
  }
  
  const text = (await exportFondoCsv({ tipo }, { responseType: "blob" })) as unknown;
  
  // Verify auth transition hasn't occurred in-flight
  const currentUser = queryClient.getQueryData<any>(getGetCurrentUserQueryKey());
  if (!currentUser || currentUser.rol !== "ADMIN") {
    throw new Error("Transición de sesión: Exportación abortada");
  }

  const blob = text instanceof Blob ? text : new Blob([text as string], { type: "text/csv;charset=utf-8;" });
  
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `fondo-mariana-${tipo}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}
