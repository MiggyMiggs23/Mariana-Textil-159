import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { 
  getGetClienteQueryKey, 
  getGetClientePagosQueryKey, 
  getGetClienteEstadoCuentaQueryKey, 
  getGetClienteCreditoQueryKey, 
  getObtenerSesionCajaActualQueryKey,
  getGetReciboAbonoE3QueryKey,
  getListClienteRecibosE3QueryKey,
  usePreviewCajaAbonoE3,
  useConfirmCajaAbonoE3,
  usePreviewClienteRecapturaE3,
  useConfirmClienteRecapturaE3,
  useGetReciboAbonoE3,
  useListClienteRecibosE3,
  useListCajaRecibosE3,
  useRecordReciboE3Print,
  E3CollectionInput,
  E3CollectionResult,
  E3PrintInput
} from "@workspace/api-client-react";
import { E3_ENABLED } from "@/lib/e3-feature-flags";

export function useE3AbonosPreview() {
  return usePreviewCajaAbonoE3();
}

export function useE3AbonosConfirm() {
  const queryClient = useQueryClient();
  const mutation = useConfirmCajaAbonoE3();
  
  return useMutation({
    mutationFn: ({ data }: { data: E3CollectionInput }) => mutation.mutateAsync({ data }),
    onSuccess: (_data: E3CollectionResult, { data: variables }: { data: E3CollectionInput }) => {
      queryClient.invalidateQueries({ queryKey: getGetClienteQueryKey(variables.clienteId) });
      queryClient.invalidateQueries({ queryKey: getGetClientePagosQueryKey(variables.clienteId) });
      queryClient.invalidateQueries({ queryKey: getGetClienteEstadoCuentaQueryKey(variables.clienteId) });
      queryClient.invalidateQueries({ queryKey: getGetClienteCreditoQueryKey(variables.clienteId) });
      if (variables.sitioId) {
        queryClient.invalidateQueries({ queryKey: getObtenerSesionCajaActualQueryKey({ ubicacionId: variables.sitioId }) });
      }
      queryClient.invalidateQueries({ predicate: (query) => typeof query.queryKey[0] === 'string' && query.queryKey[0].startsWith('/api/caja/cortes') });
      queryClient.invalidateQueries({ predicate: (query) => typeof query.queryKey[0] === "string" && /recibos-e3|sesiones-caja|abonos-e3\/contexto/.test(query.queryKey[0]) });
    }
  });
}

export function useE3RecapturasPreview(clienteId: number) {
  const mutation = usePreviewClienteRecapturaE3();
  return useMutation({
    mutationFn: (variables: E3CollectionInput) => mutation.mutateAsync({ id: clienteId, data: variables })
  });
}

export function useE3RecapturasConfirm(clienteId: number) {
  const queryClient = useQueryClient();
  const mutation = useConfirmClienteRecapturaE3();
  return useMutation({
    mutationFn: (variables: E3CollectionInput) => mutation.mutateAsync({ id: clienteId, data: variables }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: getGetClienteQueryKey(clienteId) });
      queryClient.invalidateQueries({ queryKey: getGetClientePagosQueryKey(clienteId) });
      queryClient.invalidateQueries({ queryKey: getGetClienteEstadoCuentaQueryKey(clienteId) });
      queryClient.invalidateQueries({ queryKey: getGetClienteCreditoQueryKey(clienteId) });
      queryClient.invalidateQueries({ queryKey: getListClienteRecibosE3QueryKey(clienteId) });
    }
  });
}

export function useE3GetRecibo(folio: string, enabled: boolean = true) {
  return useGetReciboAbonoE3(folio, {
    query: {
      queryKey: getGetReciboAbonoE3QueryKey(folio),
      enabled: enabled && !!folio && E3_ENABLED,
      staleTime: 0,
      refetchOnMount: "always",
    }
  });
}

export function useE3ListRecibosCliente(clienteId: number, enabled: boolean = true) {
  return useListClienteRecibosE3(clienteId, undefined, {
    query: {
      queryKey: getListClienteRecibosE3QueryKey(clienteId),
      enabled: enabled && !!clienteId && E3_ENABLED,
      staleTime: 0,
      refetchOnMount: "always",
      refetchInterval: 30000,
    }
  });
}

export function useE3RegistrarImpresion() {
  const mutation = useRecordReciboE3Print();
  return useMutation({
    mutationFn: ({ folio, motivo }: { folio: string; motivo: string }) => 
      mutation.mutateAsync({ folio, data: { motivo } })
  });
}
