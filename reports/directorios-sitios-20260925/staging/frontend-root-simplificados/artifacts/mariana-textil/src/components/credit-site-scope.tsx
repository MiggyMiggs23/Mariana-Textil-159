import { useState } from "react";
import {
  getListLocationsQueryKey,
  LocationType,
  useGetCurrentUser,
  useListLocations,
  type Location,
} from "@workspace/api-client-react";
import { useLocationScope } from "@/lib/location-scope";
import { getApiErrorMessage } from "@/lib/api-error";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// This scope belongs only to credit readers. It never writes the operational
// header scope, which is shared by stock, movements, trips and cash operations.
export function creditStores(locations: Location[]): Location[] {
  return locations.filter((site) => site.tipo === LocationType.TIENDA);
}

export function useCreditSiteScope(enabled: boolean) {
  const { selectedLocationId: headerSiteId } = useLocationScope();
  const { data: user } = useGetCurrentUser();
  const canChoose = user?.alcanceConsulta === "TODAS" && user.rol !== "CAJA" && user.rol !== "TERMINAL";
  // A header change invalidates the local choice immediately, without a
  // transient global request or changing the operational selector.
  const [choice, setChoice] = useState<{ header: number | null; value: number | null }>({
    header: headerSiteId, value: headerSiteId,
  });
  const selectedSiteId = choice.header === headerSiteId ? choice.value : headerSiteId;
  const locations = useListLocations(undefined, {
    query: {
      enabled: enabled && !!user && canChoose,
      queryKey: [...getListLocationsQueryKey(), "credit-sites", user?.id],
      refetchOnMount: "always",
    },
  });
  const stores = creditStores(locations.data ?? []);
  const error = !user ? "Verificando el alcance de crédito…" :
    !canChoose && selectedSiteId === null ? "No hay un sitio autorizado asignado para esta consulta." :
    canChoose && selectedSiteId !== null && locations.isError
      ? getApiErrorMessage(locations.error, "No se pudieron cargar las tiendas de crédito.") :
    canChoose && selectedSiteId !== null && (!locations.data || locations.isFetching)
      ? "Verificando la tienda seleccionada…" :
    canChoose && selectedSiteId !== null && !stores.some((site) => site.id === selectedSiteId)
      ? "El sitio seleccionado no es una tienda disponible para crédito. Elige otra tienda o Global." :
    !canChoose && user?.ubicacion?.tipo !== LocationType.TIENDA
      ? "El sitio asignado no es una tienda para esta consulta de crédito." :
    null;
  const selector = canChoose && enabled ? (
    <div className="space-y-1 rounded-lg border bg-card p-3" data-testid="credit-site-selector">
      <Label className="text-xs">Sitio de crédito (independiente del sitio operativo)</Label>
      <Select value={selectedSiteId === null ? "global" : String(selectedSiteId)}
        onValueChange={(value) => setChoice({ header: headerSiteId, value: value === "global" ? null : Number(value) })}>
        <SelectTrigger className="w-full sm:w-64" aria-label="Sitio de crédito">
          <SelectValue placeholder="Selecciona una tienda" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="global">Global</SelectItem>
          {stores.map((site) => <SelectItem key={site.id} value={String(site.id)}>{site.nombre}</SelectItem>)}
        </SelectContent>
      </Select>
      {locations.isError && <p role="alert" className="text-sm text-destructive">{getApiErrorMessage(locations.error, "No se pudieron cargar las tiendas de crédito.")}</p>}
    </div>
  ) : null;
  return { selectedSiteId, stores, ready: enabled && !error, error, loadingStores: canChoose && (!locations.data || locations.isFetching), selector };
}