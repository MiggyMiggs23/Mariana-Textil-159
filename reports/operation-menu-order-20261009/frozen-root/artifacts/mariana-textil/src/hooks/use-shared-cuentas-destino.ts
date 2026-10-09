import { useGetAdminCuentasDestino, GetAdminCuentasDestinoPreset, getGetAdminCuentasDestinoQueryKey } from "@workspace/api-client-react";

export function useSharedCuentasDestino(
  ubicacionId: number | undefined,
  desde: string,
  hasta: string,
  preset: GetAdminCuentasDestinoPreset = "hoy",
  compare: boolean = false
) {
  const params = {
    desde,
    hasta,
    ubicacionId,
    compare,
    preset,
  };
  return useGetAdminCuentasDestino(params, {
    query: {
      refetchInterval: 300000,
      queryKey: getGetAdminCuentasDestinoQueryKey(params),
    }
  });
}
