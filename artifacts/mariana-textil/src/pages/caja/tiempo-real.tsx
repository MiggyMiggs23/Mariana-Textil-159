import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
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
import { RefreshCw, Activity, AlertCircle, Ban, Clock, Banknote, ShoppingBag, Loader2, CreditCard, LineChart, Users, Store } from "lucide-react";
import { formatNumber, formatUnit } from "@workspace/number-format";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { Link } from "wouter";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type BreakdownConcept = "COBRADO" | "CREDITO" | "PENDIENTE" | "CANCELADAS";
type BreakdownItem = {
  id: number;
  folio: number;
  hora: string;
  cliente: string;
  importe: string;
  formaPago: string | null;
  facturado: boolean | null;
  diasPlazo: number | null;
  fechaVencimiento: string | null;
  documentoTipo: "TICKET" | "NOTA" | null;
  minutosEspera: number | null;
  nombreUsuarioCancelacion: string | null;
  canceladoAt: string | null;
  motivoCancelacion: string | null;
};
type Breakdown = {
  concepto: BreakdownConcept;
  items: BreakdownItem[];
  total: number;
  page: number;
  pageSize: number;
  montoTotal: string;
};

async function fetchBreakdown(
  concepto: BreakdownConcept,
  ubicacionId: number | null,
  page: number,
): Promise<Breakdown> {
  const params = new URLSearchParams({ concepto, page: String(page), pageSize: "50" });
  if (ubicacionId) params.set("ubicacionId", String(ubicacionId));
  const response = await fetch(`/api/admin/dashboard/realtime/desglose?${params}`, {
    credentials: "include",
  });
  if (!response.ok) throw new Error("No se pudo cargar el desglose.");
  return response.json();
}

export default function CajaTiempoReal() {
  const { selectedLocationId } = useLocationScope();
  const [breakdownConcept, setBreakdownConcept] = useState<BreakdownConcept | null>(null);
  const [breakdownPage, setBreakdownPage] = useState(1);
  const breakdown = useQuery({
    queryKey: ["admin-realtime-breakdown", breakdownConcept, selectedLocationId, breakdownPage],
    queryFn: () => fetchBreakdown(breakdownConcept!, selectedLocationId, breakdownPage),
    enabled: breakdownConcept !== null,
  });

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
  const pendingTickets = pending?.ticketsSinCobrar
    ?? dashboard?.pendientes.ticketsSinCobrar
    ?? mergedPendingCount;
  const pendingNotes = pending?.notasSinAutorizar
    ?? dashboard?.pendientes.notasSinAutorizar
    ?? 0;
  const openBreakdown = (concepto: BreakdownConcept) => {
    setBreakdownPage(1);
    setBreakdownConcept(concepto);
  };

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
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
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

              <Card
                className="border-green-500/20 bg-green-50/30 dark:bg-green-950/10 shadow-sm cursor-pointer transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                role="button"
                tabIndex={0}
                onClick={() => openBreakdown("COBRADO")}
                onKeyDown={(event) => event.key === "Enter" && openBreakdown("COBRADO")}
              >
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

              <Card
                className="border-sidebar/10 shadow-sm cursor-pointer transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                data-testid="realtime-credit-card"
                role="button"
                tabIndex={0}
                onClick={() => openBreakdown("CREDITO")}
                onKeyDown={(event) => event.key === "Enter" && openBreakdown("CREDITO")}
              >
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-semibold text-muted-foreground uppercase">Ventas a crédito</CardTitle>
                  <CreditCard className="h-4 w-4 text-primary" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-black text-sidebar">
                    {formatNumber(dashboard.ventasCredito.importe, { kind: "money" })}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 font-medium">
                    {formatNumber(dashboard.ventasCredito.operaciones, { kind: "count" })} operaciones a crédito
                  </p>
                </CardContent>
              </Card>

              <Card className="border-sidebar/10 shadow-sm">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-semibold text-muted-foreground uppercase">Utilidad</CardTitle>
                  <LineChart className="h-4 w-4 text-primary" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-black text-sidebar">
                    {totals.margen == null ? "Pendiente" : formatNumber(totals.margen, { kind: "money" })}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 font-medium">
                    {totals.margenPorcentaje == null ? "Costo pendiente" : <>Margen {formatNumber(totals.margenPorcentaje, { kind: "percentage", percentageInput: "percent" })}</>}
                  </p>
                </CardContent>
              </Card>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card
                className={`border-amber-500/30 bg-amber-50/50 dark:bg-amber-950/20 shadow-sm relative overflow-hidden cursor-pointer transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${mergedPendingCount > 0 ? "ring-2 ring-amber-500/50" : ""}`}
                role="button"
                tabIndex={0}
                onClick={() => openBreakdown("PENDIENTE")}
                onKeyDown={(event) => event.key === "Enter" && openBreakdown("PENDIENTE")}
              >
                {mergedPendingCount > 0 && (
                  <div className="absolute top-0 right-0 w-2 h-full bg-amber-500/80 animate-pulse" />
                )}
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-semibold text-amber-700 dark:text-amber-400 uppercase">
                    Ventas pendientes de cobro o autorización
                  </CardTitle>
                  <Clock className="h-4 w-4 text-amber-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-black text-amber-700 dark:text-amber-400">
                    {formatNumber(mergedPendingAmount, { kind: "money" })}
                  </div>
                  <p className="text-xs text-amber-700/80 dark:text-amber-400/80 mt-1 font-bold">
                    {formatNumber(pendingTickets, { kind: "count" })} tickets ·{" "}
                    {formatNumber(pendingNotes, { kind: "count" })} notas
                  </p>
                </CardContent>
              </Card>

              <Card
                className={`border-red-500/30 bg-red-50/50 dark:bg-red-950/20 shadow-sm relative overflow-hidden cursor-pointer transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${dashboard.cancelaciones.excedeUmbral ? "ring-2 ring-red-500/50" : ""}`}
                role="button"
                tabIndex={0}
                onClick={() => openBreakdown("CANCELADAS")}
                onKeyDown={(event) => event.key === "Enter" && openBreakdown("CANCELADAS")}
              >
                {/* Red means "revisa esto", not error, because cancellation is legitimate but merits review. */}
                {dashboard.cancelaciones.excedeUmbral && (
                  <div className="absolute top-0 right-0 w-2 h-full bg-red-500/80 animate-pulse" />
                )}
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-semibold text-red-700 dark:text-red-400 uppercase">
                    Tickets cancelados
                  </CardTitle>
                  <Ban className="h-4 w-4 text-red-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-black text-red-700 dark:text-red-400">
                    {formatNumber(dashboard.cancelaciones.tickets, { kind: "count" })} tickets · {formatNumber(dashboard.cancelaciones.importe, { kind: "money" })}
                  </div>
                  <p className="text-xs text-red-700/80 dark:text-red-400/80 mt-1 font-bold">
                    Tasa de cancelación: {formatNumber(dashboard.cancelaciones.tasaCancelacion, { kind: "percentage", percentageInput: "percent" })}
                  </p>
                </CardContent>
              </Card>
              </div>
            </div>
            {dashboard && (
              <div className="flex flex-wrap gap-3" data-testid="analytics-quantities">
                {dashboard.cantidades.map((row) => (
                  <div
                    key={`${row.tipo}-${row.unidad}`}
                    className="rounded-md border bg-card px-4 py-2 text-sm"
                    data-testid={`quantity-${row.tipo.toLowerCase()}-${row.unidad.toLowerCase()}`}
                  >
                    <span className="font-semibold">{row.modalidad}</span>
                    <span className="ml-2 font-mono">{formatNumber(row.cantidad, { kind: "quantity" })} {formatUnit(row.unidad)}</span>
                  </div>
                ))}
              </div>
            )}

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
                          <p className="text-xs text-muted-foreground font-semibold">Tickets cobrados (Promedio)</p>
                          <p className="font-medium text-sidebar">
                            {store.ticketsCobrados} <span className="text-muted-foreground font-normal">({formatNumber(store.ticketPromedio, { kind: "money" })})</span>
                          </p>
                        </div>
                      </div>

                      <div className="bg-muted/50 rounded-md p-3 text-xs mb-3">
                        <div className="flex justify-between items-center mb-1 pb-1 border-b">
                          <span className="font-medium text-muted-foreground">Utilidad</span>
                          <span className="font-bold text-sidebar flex items-center gap-2">
                            {store.margen == null ? "Pendiente" : formatNumber(store.margen, { kind: "money" })}
                            <span className="text-muted-foreground text-[10px] bg-white dark:bg-black/20 px-1.5 py-0.5 rounded border">
                              {store.margenPorcentaje == null ? "Costo pendiente" : formatNumber(store.margenPorcentaje, { kind: "percentage", percentageInput: "percent" })}
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
                    <CardFooter className="pt-0 pb-4">
                      <Button asChild variant="outline" className="w-full text-sm h-8" size="sm">
                        <Link href={`/caja/tiendas/${store.ubicacionId}/ventas`}>
                          Ver ventas
                        </Link>
                      </Button>
                    </CardFooter>
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
                            <TableCell className="text-right font-mono font-medium">{t.margen == null ? "Pendiente" : formatNumber(t.margen, { kind: "money" })}</TableCell>
                            <TableCell className="text-right font-bold">{t.margenPorcentaje == null ? "Pendiente" : formatNumber(t.margenPorcentaje, { kind: "percentage", percentageInput: "percent" })}</TableCell>
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
                          <TableCell className="text-right font-mono font-bold">{totals.margen == null ? "Pendiente" : formatNumber(totals.margen, { kind: "money" })}</TableCell>
                          <TableCell className="text-right font-bold">{totals.margenPorcentaje == null ? "Pendiente" : formatNumber(totals.margenPorcentaje, { kind: "percentage", percentageInput: "percent" })}</TableCell>
                          <TableCell colSpan={3} className="text-right text-muted-foreground font-medium text-[10px]">Distribución en panel superior</TableCell>
                        </TableRow>
                      </TableFooter>
                    </Table>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Últimos documentos</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="divide-y">
                    {dashboard?.ultimosTickets.map(t => (
                      <Link key={t.id} href={`/tickets/${t.id}`} className="block hover:bg-muted/50 p-4 transition-colors">
                        <div className="flex justify-between items-start mb-1">
                          <span className="font-bold text-sidebar text-sm">
                            {t.documentoTipo === "NOTA" ? "Nota" : "Ticket"} · Folio {formatNumber(t.folio, { kind: "identifier" })}
                          </span>
                          <div className="flex flex-col items-end gap-1">
                             <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${(t.documentoTipo === "TICKET" ? t.cobrado : t.autorizacionEstado === "AUTORIZADA") ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"}`}>
                               {t.documentoTipo === "TICKET" ? (t.cobrado ? "Ticket cobrado" : "Ticket pendiente") : (t.autorizacionEstado === "AUTORIZADA" ? "Nota autorizada" : "Nota pendiente")}
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
                            <p className="font-mono text-green-600 dark:text-green-500 text-[10px] mt-0.5">{t.margen == null ? "Margen pendiente" : `${formatNumber(t.margen, { kind: "money" })} marg.`}</p>
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
      <Dialog
        open={breakdownConcept !== null}
        onOpenChange={(open) => !open && setBreakdownConcept(null)}
      >
        <DialogContent className="w-[calc(100vw-1rem)] max-w-6xl max-h-[90vh] overflow-hidden p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle>
              {breakdownConcept === "COBRADO"
                ? "Cobrado (Caja)"
                : breakdownConcept === "CREDITO"
                  ? "Ventas a crédito"
                  : breakdownConcept === "CANCELADAS"
                    ? "Tickets cancelados"
                    : "Ventas pendientes de cobro o autorización"}
            </DialogTitle>
            <DialogDescription>
              Documentos que componen la cifra de la tarjeta.
            </DialogDescription>
          </DialogHeader>
          <div className="overflow-auto max-h-[65vh]">
            {breakdown.isLoading ? (
              <div className="flex justify-center p-10"><Loader2 className="h-6 w-6 animate-spin" /></div>
            ) : breakdown.isError ? (
              <p className="p-6 text-center text-destructive">No se pudo cargar el desglose.</p>
            ) : (
              <Table className="min-w-[760px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Folio</TableHead>
                    {breakdownConcept !== "CANCELADAS" && <TableHead>Hora</TableHead>}
                    {breakdownConcept !== "CANCELADAS" && <TableHead>Cliente</TableHead>}
                    <TableHead className="text-right">Importe</TableHead>
                    {breakdownConcept === "COBRADO" && <><TableHead>Forma de pago</TableHead><TableHead>Facturada</TableHead></>}
                    {breakdownConcept === "CREDITO" && <><TableHead>Plazo</TableHead><TableHead>Vencimiento</TableHead></>}
                    {breakdownConcept === "PENDIENTE" && <><TableHead>Documento</TableHead><TableHead>Espera</TableHead></>}
                    {breakdownConcept === "CANCELADAS" && <><TableHead>Cancelado por</TableHead><TableHead>Fecha/Hora</TableHead><TableHead>Motivo</TableHead></>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {breakdown.data?.items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <Link href={`/tickets/${item.id}`} className="font-semibold text-primary underline-offset-4 hover:underline">
                          {formatNumber(item.folio, { kind: "identifier" })}
                        </Link>
                      </TableCell>
                      {breakdownConcept !== "CANCELADAS" && <TableCell>{format(parseISO(item.hora), "HH:mm")}</TableCell>}
                      {breakdownConcept !== "CANCELADAS" && <TableCell>{item.cliente}</TableCell>}
                      <TableCell className="text-right font-mono">{formatNumber(item.importe, { kind: "money" })}</TableCell>
                      {breakdownConcept === "COBRADO" && <><TableCell>{item.formaPago}</TableCell><TableCell>{item.facturado ? "Sí" : "No"}</TableCell></>}
                      {breakdownConcept === "CREDITO" && <><TableCell>{item.diasPlazo} días</TableCell><TableCell>{item.fechaVencimiento}</TableCell></>}
                      {breakdownConcept === "PENDIENTE" && <><TableCell>{item.documentoTipo === "NOTA" ? "Nota" : "Ticket"}</TableCell><TableCell>{item.minutosEspera} min</TableCell></>}
                      {breakdownConcept === "CANCELADAS" && (
                        <>
                          <TableCell>{item.nombreUsuarioCancelacion}</TableCell>
                          <TableCell>{item.canceladoAt ? format(parseISO(item.canceladoAt), "dd/MM/yyyy HH:mm") : ""}</TableCell>
                          <TableCell className="max-w-[200px] truncate" title={item.motivoCancelacion || ""}>{item.motivoCancelacion}</TableCell>
                        </>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell colSpan={3} className="font-semibold">Total ({breakdown.data?.total ?? 0})</TableCell>
                    <TableCell className="text-right font-mono font-bold">
                      {formatNumber(breakdown.data?.montoTotal ?? "0", { kind: "money" })}
                    </TableCell>
                    <TableCell colSpan={2} />
                  </TableRow>
                </TableFooter>
              </Table>
            )}
          </div>
          <div className="flex items-center justify-end gap-2">
            <Button variant="outline" disabled={breakdownPage <= 1 || breakdown.isFetching} onClick={() => setBreakdownPage((page) => page - 1)}>
              Anterior
            </Button>
            <span className="text-sm text-muted-foreground">Página {breakdownPage}</span>
            <Button
              variant="outline"
              disabled={!breakdown.data || breakdownPage * breakdown.data.pageSize >= breakdown.data.total || breakdown.isFetching}
              onClick={() => setBreakdownPage((page) => page + 1)}
            >
              Siguiente
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
