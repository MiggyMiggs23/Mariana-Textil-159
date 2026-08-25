import { useState } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import {
  useGetAdminRealtimeDashboard,
  useGetAdminRealtimePending,
  getGetAdminRealtimeDashboardQueryKey,
  getGetAdminRealtimePendingQueryKey,
  AdminRealtimeStore,
  AdminPendingSummaryTiendasItem
} from "@workspace/api-client-react";
import { useLocationScope } from "@/lib/location-scope";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { RefreshCw, Activity, AlertCircle, Clock, Banknote, ShoppingBag, Loader2, Target, LineChart, Users, Store, Receipt } from "lucide-react";
import { formatNumber } from "@workspace/number-format";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { Link } from "wouter";

export default function CajaTiempoReal() {
  const { selectedLocationId } = useLocationScope();

  const {
    data: dashboard,
    isLoading: dashLoading,
    isError: dashError,
    refetch: refetchDash,
    dataUpdatedAt: dashUpdatedAt
  } = useGetAdminRealtimeDashboard(
    selectedLocationId ? { ubicacionId: selectedLocationId } : undefined,
    {
      query: {
        refetchInterval: 300000,
        queryKey: getGetAdminRealtimeDashboardQueryKey(selectedLocationId ? { ubicacionId: selectedLocationId } : undefined)
      }
    }
  );

  const {
    data: pending,
    isLoading: pendingLoading,
    isError: pendingError,
    refetch: refetchPending,
    dataUpdatedAt: pendingUpdatedAt
  } = useGetAdminRealtimePending(
    selectedLocationId ? { ubicacionId: selectedLocationId } : undefined,
    {
      query: {
        refetchInterval: 30000,
        queryKey: getGetAdminRealtimePendingQueryKey(selectedLocationId ? { ubicacionId: selectedLocationId } : undefined)
      }
    }
  );

  const isLoading = dashLoading;
  const isError = dashError || pendingError;

  const handleRefresh = () => {
    refetchDash();
    refetchPending();
  };

  const lastUpdated = Math.max(dashUpdatedAt, pendingUpdatedAt);

  const totals = dashboard?.totales;
  const mergedPendingAmount = pending?.importe ?? totals?.pendiente ?? "0";
  const mergedPendingCount = pending?.tickets ?? totals?.ticketsPendientes ?? 0;

  // Merge tiendas with pending per store
  const mergedStores = (dashboard?.tiendas || []).map((store) => {
    const pStore = pending?.tiendas?.find(p => p.ubicacionId === store.ubicacionId);
    return {
      ...store,
      pendiente: pStore?.pendiente ?? store.pendiente,
      pendientes30Min: pStore?.pendientes30Min ?? store.pendientes30Min,
      alertas: pStore?.alertas ?? store.alertas
    };
  });

  return (
    <AppLayout>
      <div className="max-w-[1600px] mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-sidebar flex items-center gap-2">
              <Activity className="h-8 w-8 text-primary" />
              Caja en Tiempo Real
            </h1>
            <p className="text-muted-foreground mt-1">
              Monitoreo operativo de cobros.
            </p>
          </div>
          <div className="flex items-center gap-4 text-sm">
            {lastUpdated > 0 && (
              <span className="text-muted-foreground flex items-center gap-1">
                <Clock className="h-4 w-4" />
                Actualizado: {format(new Date(lastUpdated), "HH:mm:ss", { locale: es })}
              </span>
            )}
            <Button variant="outline" onClick={handleRefresh} disabled={dashLoading || pendingLoading}>
              <RefreshCw className={`mr-2 h-4 w-4 ${(dashLoading || pendingLoading) ? "animate-spin" : ""}`} />
              Actualizar
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="h-[400px] flex items-center justify-center">
            <Loader2 className="h-12 w-12 animate-spin text-primary opacity-50" />
          </div>
        ) : isError ? (
          <div className="h-[200px] flex flex-col items-center justify-center text-destructive bg-destructive/5 rounded-xl border border-destructive/20">
            <AlertCircle className="h-10 w-10 mb-2 opacity-80" />
            <p className="font-semibold">No se pudo cargar o actualizar el tablero</p>
            <p className="text-sm opacity-80 mt-1">Es posible que la conexión esté intermitente.</p>
            <Button variant="outline" className="mt-4" onClick={handleRefresh}>Intentar de nuevo</Button>
          </div>
        ) : totals ? (
          <div className="space-y-6 animate-in fade-in duration-500">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="border-sidebar/10 shadow-sm">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-semibold text-muted-foreground uppercase">Ventas (Total)</CardTitle>
                  <ShoppingBag className="h-4 w-4 text-primary" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-black text-sidebar">
                    {formatNumber(totals.ventas, { kind: "money" })}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatNumber(totals.tickets, { kind: "count" })} tickets totales
                  </p>
                </CardContent>
              </Card>

              <Card className="border-green-500/20 bg-green-50/30 dark:bg-green-950/10 shadow-sm">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-semibold text-green-700 dark:text-green-400 uppercase">Cobrado (Caja)</CardTitle>
                  <Banknote className="h-4 w-4 text-green-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-black text-green-700 dark:text-green-400">
                    {formatNumber(totals.cobrado, { kind: "money" })}
                  </div>
                  <p className="text-xs text-green-700/70 dark:text-green-400/70 mt-1 font-medium">
                    {formatNumber(totals.ticketsCobrados, { kind: "count" })} tickets cobrados
                  </p>
                </CardContent>
              </Card>

              <Card className={`border-amber-500/30 bg-amber-50/50 dark:bg-amber-950/20 shadow-sm relative overflow-hidden ${mergedPendingCount > 0 ? "ring-2 ring-amber-500/50" : ""}`}>
                {mergedPendingCount > 0 && (
                  <div className="absolute top-0 right-0 w-2 h-full bg-amber-500/80 animate-pulse" />
                )}
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-semibold text-amber-700 dark:text-amber-400 uppercase">Pendiente de Cobro</CardTitle>
                  <Clock className="h-4 w-4 text-amber-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-black text-amber-700 dark:text-amber-400">
                    {formatNumber(mergedPendingAmount, { kind: "money" })}
                  </div>
                  <p className="text-xs text-amber-700/80 dark:text-amber-400/80 mt-1 font-bold">
                    {formatNumber(mergedPendingCount, { kind: "count" })} tickets en espera
                  </p>
                </CardContent>
              </Card>

              <Card className="border-sidebar/10 shadow-sm">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-semibold text-muted-foreground uppercase">Rentabilidad Bruta</CardTitle>
                  <LineChart className="h-4 w-4 text-primary" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-black text-sidebar">
                    {formatNumber(totals.margen, { kind: "money" })}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 font-medium">
                    Margen {formatNumber(totals.margenPorcentaje, { kind: "percentage", percentageInput: "percent" })}
                  </p>
                </CardContent>
              </Card>
            </div>

            <h3 className="text-xl font-bold tracking-tight text-sidebar mt-10 mb-4">Estado por Tienda</h3>
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
              {mergedStores.map(store => {
                const hasPendingAlert = store.pendientes30Min > 0;
                return (
                  <Card key={store.ubicacionId} className="flex flex-col relative overflow-hidden">
                    {hasPendingAlert && (
                       <div className="absolute top-0 right-0 w-1.5 h-full bg-amber-500" />
                    )}
                    <CardHeader className="pb-3 border-b bg-muted/20">
                      <CardTitle className="text-lg flex items-center justify-between">
                        <span className="flex items-center gap-2">
                          <Store className="w-5 h-5 text-sidebar-primary" />
                          {store.nombreUbicacion}
                        </span>
                      </CardTitle>
                      <CardDescription className="flex items-center gap-4 text-xs mt-2">
                        <span className="flex items-center gap-1.5">
                          <Users className="w-3.5 h-3.5" />
                          {store.cajero || "Caja Cerrada"}
                        </span>
                        {store.abiertaAt && (
                          <span className="flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5" />
                            {format(parseISO(store.abiertaAt), "HH:mm")}
                          </span>
                        )}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-4 flex-1">
                      <div className="grid grid-cols-2 gap-y-4 gap-x-2 text-sm mb-4">
                        <div>
                          <p className="text-xs text-muted-foreground font-semibold">Vendido</p>
                          <p className="font-bold text-base text-sidebar">{formatNumber(store.vendido, { kind: "money" })}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground font-semibold">Cobrado</p>
                          <p className="font-bold text-base text-green-700">{formatNumber(store.cobrado, { kind: "money" })}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground font-semibold">Pendiente</p>
                          <p className={`font-bold text-base ${Number(store.pendiente) > 0 ? "text-amber-700" : ""}`}>
                            {formatNumber(store.pendiente, { kind: "money" })}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground font-semibold">Tickets (Promedio)</p>
                          <p className="font-medium text-sidebar">
                            {store.tickets} <span className="text-muted-foreground font-normal">({formatNumber(store.ticketPromedio, { kind: "money" })})</span>
                          </p>
                        </div>
                      </div>

                      <div className="bg-muted/50 rounded-md p-3 text-xs mb-3">
                        <div className="flex justify-between items-center mb-1 pb-1 border-b">
                          <span className="font-medium text-muted-foreground">Rentabilidad</span>
                          <span className="font-bold text-sidebar flex items-center gap-2">
                            {formatNumber(store.margen, { kind: "money" })}
                            <span className="text-muted-foreground text-[10px] bg-white dark:bg-black/20 px-1.5 py-0.5 rounded border">
                              {formatNumber(store.margenPorcentaje, { kind: "percentage", percentageInput: "percent" })}
                            </span>
                          </span>
                        </div>
                        <div className="flex justify-between items-center mb-1">
                          <span className="font-medium text-muted-foreground">Efectivo / Transf</span>
                          <span>{formatNumber(store.efectivo, { kind: "money" })} / {formatNumber(store.transferencia, { kind: "money" })}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="font-medium text-muted-foreground">Crédito</span>
                          <span>{formatNumber(store.credito, { kind: "money" })}</span>
                        </div>
                      </div>

                      {store.sesionCajaId ? (
                        <div className="text-xs text-muted-foreground mb-3 flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-green-500"></span>
                          Sesión #{store.sesionCajaId} abierta
                          {store.usuarioTerminal && ` • Term: ${store.usuarioTerminal}`}
                        </div>
                      ) : (
                        <div className="text-xs text-muted-foreground mb-3 flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-muted-foreground"></span>
                          Caja Cerrada
                        </div>
                      )}

                      {store.alertas.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-1">
                          {store.alertas.map((alerta, i) => (
                            <span key={i} className="bg-destructive/10 text-destructive text-[10px] px-2 py-0.5 rounded font-bold border border-destructive/20">
                              {alerta}
                            </span>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )
              })}
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 pt-6">
              <Card className="xl:col-span-2">
                <CardHeader>
                  <CardTitle>Tabla Comparativa</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/40">
                          <TableHead>Tienda</TableHead>
                          <TableHead className="text-right">Tck</TableHead>
                          <TableHead className="text-right">Vendido</TableHead>
                          <TableHead className="text-right">Cobrado</TableHead>
                          <TableHead className="text-right">Pendiente</TableHead>
                          <TableHead className="text-right">Margen $</TableHead>
                          <TableHead className="text-right">Margen %</TableHead>
                          <TableHead className="text-right">Efectivo</TableHead>
                          <TableHead className="text-right">Transf</TableHead>
                          <TableHead className="text-right">Crédito</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {dashboard?.comparativo.map(t => (
                          <TableRow key={t.ubicacionId}>
                            <TableCell className="font-bold">{t.nombreUbicacion}</TableCell>
                            <TableCell className="text-right">{formatNumber(t.tickets, { kind: "count" })}</TableCell>
                            <TableCell className="text-right font-mono">{formatNumber(t.vendido, { kind: "money" })}</TableCell>
                            <TableCell className="text-right font-mono text-green-700">{formatNumber(t.cobrado, { kind: "money" })}</TableCell>
                            <TableCell className="text-right font-mono text-amber-700">{formatNumber(t.pendiente, { kind: "money" })}</TableCell>
                            <TableCell className="text-right font-mono font-medium">{formatNumber(t.margen, { kind: "money" })}</TableCell>
                            <TableCell className="text-right font-bold">{formatNumber(t.margenPorcentaje, { kind: "percentage", percentageInput: "percent" })}</TableCell>
                            <TableCell className="text-right font-mono text-muted-foreground">{formatNumber(t.efectivo, { kind: "money" })}</TableCell>
                            <TableCell className="text-right font-mono text-muted-foreground">{formatNumber(t.transferencia, { kind: "money" })}</TableCell>
                            <TableCell className="text-right font-mono text-muted-foreground">{formatNumber(t.credito, { kind: "money" })}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                      <TableFooter>
                        <TableRow>
                          <TableCell className="font-bold">Total General</TableCell>
                          <TableCell className="text-right font-bold">{formatNumber(totals.tickets, { kind: "count" })}</TableCell>
                          <TableCell className="text-right font-mono font-bold">{formatNumber(totals.ventas, { kind: "money" })}</TableCell>
                          <TableCell className="text-right font-mono font-bold">{formatNumber(totals.cobrado, { kind: "money" })}</TableCell>
                          <TableCell className="text-right font-mono font-bold">{formatNumber(totals.pendiente, { kind: "money" })}</TableCell>
                          <TableCell className="text-right font-mono font-bold">{formatNumber(totals.margen, { kind: "money" })}</TableCell>
                          <TableCell className="text-right font-bold">{formatNumber(totals.margenPorcentaje, { kind: "percentage", percentageInput: "percent" })}</TableCell>
                          <TableCell colSpan={3} className="text-right text-muted-foreground font-medium text-[10px]">Distribución en panel superior</TableCell>
                        </TableRow>
                      </TableFooter>
                    </Table>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Últimos Tickets</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="divide-y">
                    {dashboard?.ultimosTickets.map(t => (
                      <Link key={t.id} href={`/tickets/${t.id}`} className="block hover:bg-muted/50 p-4 transition-colors">
                        <div className="flex justify-between items-start mb-1">
                          <span className="font-bold text-sidebar text-sm">
                            Folio {formatNumber(t.folio, { kind: "identifier" })}
                          </span>
                          <div className="flex flex-col items-end gap-1">
                            <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${t.cobrado ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"}`}>
                              {t.cobrado ? "Cobrado" : "Pdte"}
                            </span>
                            <span className="text-[10px] text-muted-foreground">{format(parseISO(t.createdAt), "HH:mm")}</span>
                          </div>
                        </div>
                        <div className="flex justify-between items-end text-xs">
                          <div>
                            <p className="text-muted-foreground">{t.nombreUbicacion}</p>
                            <p className="font-medium truncate max-w-[150px]">{t.nombreCliente || "Sin Cliente"}</p>
                          </div>
                          <div className="text-right">
                            <p className="font-mono font-bold text-sm">{formatNumber(t.importe, { kind: "money" })}</p>
                            <p className="font-mono text-green-600 dark:text-green-500 text-[10px] mt-0.5">{formatNumber(t.margen, { kind: "money" })} marg.</p>
                          </div>
                        </div>
                      </Link>
                    ))}
                    {dashboard?.ultimosTickets.length === 0 && (
                      <div className="p-6 text-center text-muted-foreground text-sm">Sin tickets recientes</div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        ) : null}
      </div>
    </AppLayout>
  );
}
