import { useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import {
  getGetCurrentUserQueryKey,
  getGetUbicacionesSalidaQueryKey,
  getListSalidasVentaPendientesPorClienteQueryKey,
  useGetCurrentUser,
  useGetUbicacionesSalida,
  useGenerarVentaDesdeSalidas,
  useListSalidasVentaPendientesPorCliente,
  type SalidasVentaPendientesCliente,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, ArrowLeft, PackageCheck } from "lucide-react";
import { CREDIT_TERMS, type CreditTerm } from "@/lib/credit-terms";
import { useToast } from "@/hooks/use-toast";
import { ApiErrorDetails, getApiErrorMessage } from "@/lib/api-error";
import { formatNumber, formatUnit } from "@workspace/number-format";

export function SalidasPendientesCobro({ onBack }: { onBack: () => void }) {
  const [, setLocation] = useLocation();
  const clientContextParam = typeof window !== "undefined"
    ? new URLSearchParams(window.location.search).get("salidaClienteId")
    : null;
  const clientContext = clientContextParam !== null && /^\d+$/.test(clientContextParam)
    ? Number(clientContextParam)
    : null;
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const query = useListSalidasVentaPendientesPorCliente({
    query: { queryKey: getListSalidasVentaPendientesPorClienteQueryKey(), refetchInterval: 30_000 },
  });
  const { data: currentUser } = useGetCurrentUser({
    query: { queryKey: getGetCurrentUserQueryKey() },
  });
  const assignedStore =
    currentUser?.ubicacion?.activa === true && currentUser.ubicacion.tipo === "TIENDA"
      ? currentUser.ubicacion
      : null;
  const locationsQuery = useGetUbicacionesSalida({
    query: {
      enabled: currentUser !== undefined && assignedStore === null,
      queryKey: getGetUbicacionesSalidaQueryKey(),
    },
  });
  const [selected, setSelected] = useState<Record<number, boolean>>({});
  const [prices, setPrices] = useState<Record<number, number>>({});
  const [documentoTipo, setDocumentoTipo] = useState<"TICKET" | "NOTA">("TICKET");
  const [diasPlazo, setDiasPlazo] = useState<CreditTerm | null>(null);
  const [selectedStoreId, setSelectedStoreId] = useState<number | null>(null);
  const generate = useGenerarVentaDesdeSalidas();

  const activeStores = (locationsQuery.data ?? []).filter(
    (location) => location.activa && location.tipo === "TIENDA",
  );
  const selectedStore = activeStores.find((location) => location.id === selectedStoreId) ?? null;
  const saleLocationId = assignedStore?.id ?? selectedStore?.id ?? null;
  const groups = (query.data ?? []).filter((group) => clientContext === null || group.clienteId === clientContext);
  const groupState = (group: SalidasVentaPendientesCliente) => {
    const enabled = group.salidas.filter((s) => selected[s.id] !== false);
    return enabled.flatMap((s) => s.lineas);
  };
  const totalSelected = useMemo(() => groups.reduce((n, g) => n + groupState(g).length, 0), [groups, selected]);
  const toggleSalida = (id: number, value: boolean) => setSelected((current) => ({ ...current, [id]: value }));

  const confirm = (group: SalidasVentaPendientesCliente) => {
    if (saleLocationId === null) {
      toast({
        title: "Selecciona una tienda activa",
        description: "Indica la tienda desde la que se emitirá el documento de venta.",
        variant: "destructive",
      });
      return;
    }
    const salidas = group.salidas.filter((s) => selected[s.id] !== false);
    if (!salidas.length) {
      toast({ title: "Selecciona al menos una salida", variant: "destructive" });
      return;
    }
    if (documentoTipo === "NOTA" && !diasPlazo) {
      toast({ title: "Selecciona el plazo de crédito", description: "Elige 7, 15, 30 o 60 días.", variant: "destructive" });
      return;
    }
    const lineas = salidas.flatMap((s) => s.lineas);
    const data = documentoTipo === "NOTA" ? {
        uuidCliente: crypto.randomUUID(),
        ubicacionId: saleLocationId,
        clienteId: group.clienteId,
        salidaIds: salidas.map((s) => s.id),
        precios: lineas.map((line) => ({
          salidaRolloId: line.salidaRolloId,
          precioUnitario: prices[line.salidaRolloId] ?? Number(line.precioSugerido ?? 0),
        })),
        documentoTipo: "NOTA" as const,
        diasPlazo: diasPlazo!,
      } : {
        uuidCliente: crypto.randomUUID(),
        ubicacionId: saleLocationId,
        clienteId: group.clienteId,
        salidaIds: salidas.map((s) => s.id),
        precios: lineas.map((line) => ({
          salidaRolloId: line.salidaRolloId,
          precioUnitario: prices[line.salidaRolloId] ?? Number(line.precioSugerido ?? 0),
        })),
        documentoTipo: "TICKET" as const,
      };
    generate.mutate({ data }, {
      onSuccess: (ticket) => {
        void queryClient.invalidateQueries({ queryKey: getListSalidasVentaPendientesPorClienteQueryKey() });
        setLocation(`/tickets/${ticket.id}`);
      },
      onError: (error) => toast({ title: "No se pudo generar la venta", description: <ApiErrorDetails error={error} />, variant: "destructive" }),
    });
  };

  if (query.isLoading) return <div className="flex items-center justify-center p-10"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  if (query.error) return <p className="rounded border border-destructive p-4 text-destructive">{getApiErrorMessage(query.error)}</p>;

  return (
    <div className="space-y-5" data-testid="salidas-pendientes-cobro">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="icon" onClick={onBack} aria-label="Volver"><ArrowLeft className="h-4 w-4" /></Button>
        <div><h1 className="text-2xl font-bold">Salidas pendientes a cobro</h1><p className="text-sm text-muted-foreground">Agrupa salidas por cliente en un solo documento de venta.</p></div>
      </div>
      {groups.length === 0 ? <p className="rounded border p-8 text-center text-muted-foreground">No hay salidas pendientes a cobro.</p> : groups.map((group) => (
        <Card key={group.clienteId} data-testid={`card-pendientes-cliente-${group.clienteId}`}>
          <CardHeader><CardTitle>{group.nombreCliente}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {group.salidas.map((salida) => (
              <div key={salida.id} className="rounded-md border p-3" data-testid={`salida-pendiente-${salida.id}`}>
                <label className="flex items-center gap-2 font-semibold">
                  <Checkbox checked={selected[salida.id] !== false} onCheckedChange={(v) => toggleSalida(salida.id, v === true)} />
                  <Link className="text-primary underline" href={`/salidas/${salida.id}`}>{salida.folioFormateado}</Link>
                  <span className="font-normal text-muted-foreground">· Origen: {salida.nombreOrigen}</span>
                </label>
                {selected[salida.id] !== false && salida.lineas.map((line) => (
                  <div key={line.salidaRolloId} className="mt-2 grid grid-cols-[minmax(0,1fr)_7rem] items-center gap-2 pl-7 text-sm">
                    <span className="min-w-0 truncate"><span className="font-mono">{line.serie}</span> · {line.tela} {line.color} · {formatNumber(line.cantidad, { kind: "quantity" })} {formatUnit(line.unidad)}</span>
                    <Input aria-label={`Precio ${line.serie}`} type="number" min="0.01" step="0.01" value={prices[line.salidaRolloId] ?? Number(line.precioSugerido ?? 0)} onChange={(e) => setPrices((p) => ({ ...p, [line.salidaRolloId]: Number(e.target.value) }))} />
                  </div>
                ))}
              </div>
            ))}
            <div className="grid gap-3 border-t pt-4 sm:grid-cols-4">
              <div>
                <Label>Tienda emisora</Label>
                {assignedStore ? (
                  <div className="flex h-10 items-center rounded-md border bg-muted px-3 text-sm" data-testid="assigned-sale-store">
                    {assignedStore.nombre}
                  </div>
                ) : (
                  <Select
                    value={selectedStoreId === null ? "" : String(selectedStoreId)}
                    onValueChange={(value) => setSelectedStoreId(Number(value))}
                    disabled={locationsQuery.isLoading || activeStores.length === 0}
                  >
                    <SelectTrigger aria-label="Tienda emisora">
                      <SelectValue placeholder={locationsQuery.isLoading ? "Cargando tiendas…" : "Seleccionar tienda"} />
                    </SelectTrigger>
                    <SelectContent>
                      {activeStores.map((store) => (
                        <SelectItem key={store.id} value={String(store.id)}>{store.nombre}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                {locationsQuery.error && (
                  <p className="mt-1 text-xs text-destructive">{getApiErrorMessage(locationsQuery.error)}</p>
                )}
                {!assignedStore && !locationsQuery.isLoading && !locationsQuery.error && activeStores.length === 0 && (
                  <p className="mt-1 text-xs text-destructive">No hay una tienda activa disponible para emitir la venta.</p>
                )}
              </div>
              <div><Label>Tipo de documento</Label><Select value={documentoTipo} onValueChange={(v) => setDocumentoTipo(v as "TICKET" | "NOTA")}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="TICKET">TICKET (Contado)</SelectItem><SelectItem value="NOTA">NOTA (Crédito)</SelectItem></SelectContent></Select></div>
              {documentoTipo === "NOTA" && <div><Label>Plazo de crédito</Label><Select value={diasPlazo ? String(diasPlazo) : ""} onValueChange={(v) => setDiasPlazo(Number(v) as CreditTerm)}><SelectTrigger><SelectValue placeholder="Seleccionar plazo" /></SelectTrigger><SelectContent>{CREDIT_TERMS.map((term) => <SelectItem key={term} value={String(term)}>{term} días</SelectItem>)}</SelectContent></Select></div>}
              <Button className="self-end" disabled={generate.isPending || totalSelected === 0 || saleLocationId === null} onClick={() => confirm(group)}><PackageCheck className="mr-2 h-4 w-4" />{generate.isPending ? "Generando venta…" : "Recibir y generar venta"}</Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}