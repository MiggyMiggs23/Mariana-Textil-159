import { useEffect, useMemo, useState } from "react";
import { Link, useRoute, useSearch } from "wouter";
import {
  exportAdminCuentaDestinoMovimientosXlsx,
  getListAdminCuentaDestinoMovimientosQueryKey,
  useListAdminCuentaDestinoMovimientos,
  useGetAdminCuadreFiscal,
  useGetCurrentUser,
  useCreateAdminCuadreFiscalConfirmacion,
  useCreateAdminCuadreFiscalDiferencia,
  useResolveAdminCuadreFiscalDiferencia,
  getGetAdminCuadreFiscalQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { formatAccountDestination, formatNumber } from "@workspace/number-format";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useLocationScope } from "@/lib/location-scope";
import { useToast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/api-error";
import { AlertCircle, ArrowLeft, ChevronLeft, ChevronRight, Download, Loader2 } from "lucide-react";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";

const DESTINATIONS = [
  "CAJA_FISICA",
  "CUENTA_NO_FISCAL",
  "CUENTA_FISCAL",
  "CUENTAS_POR_COBRAR",
] as const;
type Destination = (typeof DESTINATIONS)[number];

function isDestination(value: string | undefined): value is Destination {
  return DESTINATIONS.some((destination) => destination === value);
}

export default function CuentaDestinoDetalle() {
  const [, routeParams] = useRoute("/caja/cuentas-destino/:cuentaDestino");
  const search = useSearch();
  const inherited = useMemo(() => new URLSearchParams(search), [search]);
  const destination = isDestination(routeParams?.cuentaDestino)
    ? routeParams.cuentaDestino
    : "CAJA_FISICA";
  const { selectedLocationId } = useLocationScope();
  const inheritedLocation = Number(inherited.get("ubicacionId"));
  const ubicacionId = selectedLocationId ?? (Number.isInteger(inheritedLocation) && inheritedLocation > 0
    ? inheritedLocation
    : undefined);
  const [desde, setDesde] = useState(inherited.get("desde") ?? "");
  const [hasta, setHasta] = useState(inherited.get("hasta") ?? "");
  const [page, setPage] = useState(1);
  const pageSize = 50;
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: currentUser } = useGetCurrentUser();
  const fiscalQuery = useGetAdminCuadreFiscal({ desde: desde || undefined, hasta: hasta || undefined, ubicacionId }, {
    query: { enabled: destination === "CUENTA_FISCAL", queryKey: getGetAdminCuadreFiscalQueryKey({ desde: desde || undefined, hasta: hasta || undefined, ubicacionId }) },
  });
  const confirm = useCreateAdminCuadreFiscalConfirmacion();
  const report = useCreateAdminCuadreFiscalDiferencia();
  const resolve = useResolveAdminCuadreFiscalDiferencia();
  const [differenceAmount, setDifferenceAmount] = useState("");
  const [differenceDirection, setDifferenceDirection] = useState<"MAS" | "MENOS">("MAS");
  const [differenceDescription, setDifferenceDescription] = useState("");
  const [resolutionNotes, setResolutionNotes] = useState<Record<number, string>>({});

  useEffect(() => setPage(1), [desde, hasta, ubicacionId]);

  const params = {
    desde: desde || undefined,
    hasta: hasta || undefined,
    ubicacionId,
    page,
    pageSize,
  };
  const query = useListAdminCuentaDestinoMovimientos(destination, params, {
    query: {
      enabled: isDestination(routeParams?.cuentaDestino),
      queryKey: getListAdminCuentaDestinoMovimientosQueryKey(destination, params),
    },
  });

  const parentParams = new URLSearchParams();
  if (desde) parentParams.set("desde", desde);
  if (hasta) parentParams.set("hasta", hasta);
  if (ubicacionId != null) parentParams.set("ubicacionId", String(ubicacionId));

  const handleExport = async () => {
    try {
      const blob = await exportAdminCuentaDestinoMovimientosXlsx(destination, {
        desde: desde || undefined,
        hasta: hasta || undefined,
        ubicacionId,
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `movimientos-${destination.toLowerCase()}-${desde || "inicio"}-a-${hasta || "hoy"}.xlsx`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      toast({
        title: "Error al exportar",
        description: getApiErrorMessage(error),
        variant: "destructive",
      });
    }
  };
  const fiscalInput = { desde, hasta, ...(ubicacionId == null ? {} : { ubicacionId }) };
  const refreshFiscal = () => queryClient.invalidateQueries({ queryKey: getGetAdminCuadreFiscalQueryKey({ desde: desde || undefined, hasta: hasta || undefined, ubicacionId }) });

  if (!isDestination(routeParams?.cuentaDestino)) {
    return (
      <AppLayout>
        <div className="p-10 text-center text-destructive" data-testid="status-cuenta-invalida">
          La cuenta solicitada no existe.
        </div>
      </AppLayout>
    );
  }

  const totalPages = Math.max(1, Math.ceil((query.data?.total ?? 0) / pageSize));

  return (
    <AppLayout>
      <div className="max-w-[1600px] mx-auto space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <Link
              href={`/caja/cuentas-destino?${parentParams.toString()}`}
              className="mb-3 inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
              data-testid="link-volver-cuentas-destino"
            >
              <ArrowLeft className="mr-2 h-4 w-4" /> Volver a Cuentas
            </Link>
            <h1 className="text-2xl font-bold tracking-tight text-sidebar" data-testid="text-cuenta-destino">
              {formatAccountDestination(destination)}
            </h1>
            <p className="text-sm text-muted-foreground">Movimientos financieros del periodo seleccionado.</p>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <label className="space-y-1 text-xs font-medium text-muted-foreground">
              Desde
              <Input
                type="date"
                value={desde}
                onChange={(event) => setDesde(event.target.value)}
                className="w-[150px]"
                data-testid="input-movimientos-desde"
              />
            </label>
            <label className="space-y-1 text-xs font-medium text-muted-foreground">
              Hasta
              <Input
                type="date"
                value={hasta}
                onChange={(event) => setHasta(event.target.value)}
                className="w-[150px]"
                data-testid="input-movimientos-hasta"
              />
            </label>
            <Button variant="outline" onClick={handleExport} data-testid="button-exportar-movimientos">
              <Download className="mr-2 h-4 w-4" /> Excel
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between text-lg">
              <span>Detalle de movimientos</span>
              {query.data && (
                <span className="text-base font-bold" data-testid="text-monto-total">
                  Total: {formatNumber(query.data.montoTotal, { kind: "money" })}
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {query.isLoading ? (
              <div className="flex h-64 items-center justify-center" data-testid="status-cargando-movimientos">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : query.isError ? (
              <div className="p-10 text-center text-destructive" data-testid="status-error-movimientos">
                <AlertCircle className="mx-auto mb-2 h-8 w-8" />
                {getApiErrorMessage(query.error, "No se pudieron cargar los movimientos.")}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Documento</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Sitio</TableHead>
                      <TableHead className="text-right">Monto</TableHead>
                      <TableHead>Registró</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {query.data?.items.map((movement) => (
                      <TableRow key={movement.id} data-testid={`row-movimiento-${movement.id}`}>
                        <TableCell className="whitespace-nowrap">
                          {format(parseISO(movement.fecha), "dd MMM yyyy, HH:mm", { locale: es })}
                        </TableCell>
                        <TableCell>{movement.tipo}</TableCell>
                        <TableCell>
                          <Link
                            href={movement.documentoTipo === "CLIENTE" ? `/clientes/${movement.documentoId}` : `/tickets/${movement.documentoId}`}
                            className="font-medium text-primary hover:underline"
                            data-testid={`link-documento-${movement.id}`}
                          >
                            {movement.documento}
                          </Link>
                        </TableCell>
                        <TableCell>{movement.cliente ?? "Público general"}</TableCell>
                        <TableCell>{movement.sitio}</TableCell>
                        <TableCell className="text-right font-mono">
                          {formatNumber(movement.monto, { kind: "money" })}
                        </TableCell>
                        <TableCell>{movement.registro}</TableCell>
                      </TableRow>
                    ))}
                    {query.data?.items.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                          Sin movimientos en el periodo.
                        </TableCell>
                      </TableRow>
                    )}
                    {query.data && (
                      <TableRow className="bg-muted/40 font-bold">
                        <TableCell colSpan={5}>Total del periodo ({formatNumber(query.data.total, { kind: "count" })} movimientos)</TableCell>
                        <TableCell className="text-right font-mono" data-testid="text-total-pie">
                          {formatNumber(query.data.montoTotal, { kind: "money" })}
                        </TableCell>
                        <TableCell />
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
        {destination === "CUENTA_FISCAL" && fiscalQuery.data && (
          <Card>
            <CardHeader><CardTitle>Cuadre Fiscal</CardTitle></CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded border p-3"><p className="text-sm text-muted-foreground">Facturado del periodo</p><p className="text-xl font-bold" data-testid="text-fiscal-facturado">{formatNumber(fiscalQuery.data.facturado, { kind: "money" })}</p></div>
                <div className="rounded border p-3"><p className="text-sm text-muted-foreground">Cobrado a cuenta fiscal</p><p className="text-xl font-bold">{formatNumber(fiscalQuery.data.cobradoCuentaFiscal, { kind: "money" })}</p></div>
                <div className="rounded border p-3"><p className="text-sm text-muted-foreground">Por cobrar de ventas fiscales</p><p className="text-xl font-bold">{formatNumber(fiscalQuery.data.porCobrarFiscal, { kind: "money" })}</p></div>
              </div>
              <p className="text-sm text-muted-foreground">La diferencia entre facturado y cobrado es cartera, no un descuadre.</p>
              {(currentUser?.rol === "CONTADOR" || currentUser?.rol === "ADMIN") && <div className="flex flex-wrap gap-2">
                <Button onClick={() => confirm.mutate({ data: fiscalInput }, { onSuccess: refreshFiscal, onError: (error) => toast({ title: "No se pudo confirmar", description: getApiErrorMessage(error), variant: "destructive" }) })} disabled={confirm.isPending} data-testid="button-confirmar-cuentas">Confirmar cuentas</Button>
                <Input type="number" min="0.01" step="0.01" value={differenceAmount} onChange={(e) => setDifferenceAmount(e.target.value)} placeholder="Monto" className="w-28" data-testid="input-diferencia-monto" />
                <select value={differenceDirection} onChange={(e) => setDifferenceDirection(e.target.value as "MAS" | "MENOS")} className="rounded border bg-background px-2" data-testid="select-diferencia-direccion"><option value="MAS">Más</option><option value="MENOS">Menos</option></select>
                <textarea value={differenceDescription} onChange={(e) => setDifferenceDescription(e.target.value)} placeholder="Descripción (mínimo 20 caracteres)" className="min-h-10 flex-1 rounded border bg-background p-2 text-sm" data-testid="input-diferencia-descripcion" />
                <Button variant="outline" disabled={report.isPending || differenceDescription.trim().length < 20 || Number(differenceAmount) <= 0} onClick={() => report.mutate({ data: { ...fiscalInput, monto: Number(differenceAmount), direccion: differenceDirection, descripcion: differenceDescription } }, { onSuccess: () => { setDifferenceAmount(""); setDifferenceDescription(""); refreshFiscal(); }, onError: (error) => toast({ title: "No se pudo reportar", description: getApiErrorMessage(error), variant: "destructive" }) })} data-testid="button-reportar-diferencia">Reportar diferencia</Button>
              </div>}
              <div><h3 className="mb-2 font-semibold">Histórico</h3>{fiscalQuery.data.historial.length === 0 ? <p className="text-sm text-muted-foreground">Sin confirmaciones ni diferencias.</p> : <div className="space-y-2">{fiscalQuery.data.historial.map((item) => <div key={item.id} className="rounded border p-3 text-sm" data-testid={`fiscal-registro-${item.id}`}><b>{item.tipo}</b> · {item.desde} a {item.hasta} · Facturado congelado {formatNumber(item.facturadoCongelado, { kind: "money" })} · {item.actor} · {item.estado}{item.direccion ? ` · ${item.direccion} ${formatNumber(item.monto, { kind: "money" })}` : ""}{item.descripcion ? ` · ${item.descripcion}` : ""}{item.notaResolucion ? ` · Resolución: ${item.notaResolucion}` : ""}{currentUser?.rol === "ADMIN" && item.tipo === "DIFERENCIA" && item.estado === "PENDIENTE" && <div className="mt-2 flex gap-2"><Input value={resolutionNotes[item.id] ?? ""} onChange={(e) => setResolutionNotes((notes) => ({ ...notes, [item.id]: e.target.value }))} placeholder="Nota de resolución" data-testid={`input-resolucion-${item.id}`} /><Button size="sm" disabled={!resolutionNotes[item.id]?.trim() || resolve.isPending} onClick={() => resolve.mutate({ id: item.id, data: { nota: resolutionNotes[item.id]! } }, { onSuccess: refreshFiscal })} data-testid={`button-resolver-${item.id}`}>Resolver</Button></div>}</div>)}</div>}</div>
            </CardContent>
          </Card>
        )}

        {query.data && query.data.total > pageSize && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground" data-testid="text-paginacion-movimientos">
              Página {page} de {totalPages} · {query.data.total} movimientos
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={page <= 1}
                data-testid="button-pagina-anterior"
              >
                <ChevronLeft className="mr-1 h-4 w-4" /> Anterior
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                disabled={page >= totalPages}
                data-testid="button-pagina-siguiente"
              >
                Siguiente <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}