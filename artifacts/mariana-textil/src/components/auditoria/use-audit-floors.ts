import { useQuery } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";

export type AuditFloor = {
  id: number;
  nombre: string;
  ubicacionId: number;
  activo: boolean;
};

export const auditFloorsQueryKey = (auditId: number, userId: number | null) =>
  ["audit-floors", userId, auditId] as const;

export function useAuditFloors(auditId: number | null, userId: number | null, open: boolean) {
  return useQuery({
    queryKey: auditFloorsQueryKey(auditId ?? 0, userId),
    queryFn: ({ signal }) =>
      customFetch<AuditFloor[]>(`/api/inventario/auditorias/${auditId}/pisos`, { signal }),
    enabled: !!auditId && !!userId && open,
    retry: false,
    refetchInterval: open ? 3000 : false,
    refetchIntervalInBackground: true,
    refetchOnMount: "always",
  });
}