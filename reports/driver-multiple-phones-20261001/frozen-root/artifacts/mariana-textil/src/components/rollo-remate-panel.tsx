import { useGetRolloRemate, useMarcarRolloRemate, useRetirarRolloRemate, useGetCurrentUser, getGetRolloRemateQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { RemateControl } from "./tarea4-remate";
import { hasPermission } from "@/lib/permisos";

export function RolloRematePanel({ rolloId }: { rolloId: number }) {
  const { data: user } = useGetCurrentUser();
  const state = useGetRolloRemate(rolloId, { query: { queryKey: getGetRolloRemateQueryKey(rolloId), refetchInterval: 15000 } });
  const mark = useMarcarRolloRemate();
  const remove = useRetirarRolloRemate();
  const cache = useQueryClient();
  if (state.isLoading) return <p>Cargando remate…</p>;
  if (state.error || !state.data) return <p role="alert">No se pudo consultar el estado de remate.</p>;
  const refresh = () => cache.invalidateQueries({ queryKey: getGetRolloRemateQueryKey(rolloId) });
  return <RemateControl rolloId={rolloId} marked={state.data.remate}
    canMark={hasPermission(user, "marcar_remate", "autorizar")} canRemove={user?.rol === "ADMIN"}
    onMark={async (id, motivo) => { await mark.mutateAsync({ id, data: { motivo } }); await refresh(); }}
    onRemove={async (id, motivo) => { await remove.mutateAsync({ id, data: { motivo } }); await refresh(); }} />;
}