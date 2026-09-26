import { TableCell, TableRow } from "@/components/ui/table";
import { formatNumber } from "@workspace/number-format";

export interface InventoryLocation {
  ubicacionId: number;
  nombreUbicacion: string;
  pisoId: number | null;
  nombrePiso: string | null;
  rollosCount: number;
  cantidadTotal: string;
  unidad: "METRO" | "KILO" | "BOLSA" | "PIEZA";
}

export function floorLabel(nombrePiso?: string | null) {
  return nombrePiso?.trim() || "Sin piso";
}

export function locationKey(location: InventoryLocation) {
  return JSON.stringify([location.ubicacionId, location.pisoId]);
}

export function locationLabel(location: InventoryLocation, consolidado: boolean) {
  const piso = floorLabel(location.nombrePiso);
  return consolidado ? `${location.nombreUbicacion} · ${piso}` : piso;
}

export function existingLocations(locations: readonly InventoryLocation[] = []) {
  return locations.filter((location) => location.rollosCount > 0);
}

export function locationSummary(locations: readonly InventoryLocation[], rollosCount: number, consolidado: boolean, compact = false) {
  if (rollosCount === 0) return "Sin existencias";
  const unique = [...new Map(existingLocations(locations).map((location) => [locationKey(location), location])).values()];
  if (!unique.length) return "Ubicación no disponible";
  if (compact && unique.length > 1) return `${unique.length} pisos`;
  return unique.map((location) => locationLabel(location, consolidado)).join(", ");
}

export function InventoryLocationRows({ locations, showSitio, consolidado, showBolsas, showPiezas }: {
  locations: readonly InventoryLocation[];
  showSitio: boolean;
  consolidado: boolean;
  showBolsas: boolean;
  showPiezas: boolean;
}) {
  const units = ["METRO", "KILO", ...(showBolsas ? ["BOLSA"] : []), ...(showPiezas ? ["PIEZA"] : [])];
  return existingLocations(locations).map((location) => (
    <TableRow key={`${locationKey(location)}-${location.unidad}`} className="bg-muted/10">
      <TableCell />
      <TableCell className="pl-10 py-2 text-xs text-muted-foreground">Por ubicación</TableCell>
      {showSitio && <TableCell className="py-2 text-sm">{location.nombreUbicacion}</TableCell>}
      <TableCell className="py-2 text-sm">{locationLabel(location, consolidado)}</TableCell>
      <TableCell className="text-right py-2">{formatNumber(location.rollosCount, { kind: "count" })}</TableCell>
      {units.map((unit) => (
        <TableCell key={unit} className="text-right tabular-nums py-2">
          {unit === location.unidad ? formatNumber(location.cantidadTotal, { kind: "quantity" }) : "-"}
        </TableCell>
      ))}
    </TableRow>
  ));
}