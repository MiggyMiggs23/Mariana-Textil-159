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
import { useSharedCuentasDestino } from "@/hooks/use-shared-cuentas-destino";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useLocationScope } from "@/lib/location-scope";
import { attentionCardTone } from "./attention-card-tone";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import "./tiempo-real-layout.css";

type BreakdownConcept = "COBRADO" | "CREDITO" | "PENDIENTE" | "CANCELADAS" | "SALIDAS_EN_TRANSITO" | "SALIDAS_CANCELADAS";
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
type SalidaBreakdownItem = {
  salidaId: number;
  folio: number;
  origenId: number;
  origen: string;
  destinoId: number | null;
  destino: string | null;
  clienteId: number | null;
  cliente: string | null;
  fecha: string;
  importe: string;
  href: string;
};
type Breakdown = {
  concepto: BreakdownConcept;
  items: (BreakdownItem | SalidaBreakdownItem)[];
  total: number;
  page: number;
  pageSize: number;
  montoTotal: string;
};

function formatCountLabel(
  value: number,
  singular: string,
  plural: string,
) {
  return `${formatNumber(value, { kind: "count" })} ${value === 1 ? singular : plural}`;
}

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

  const todayStr = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const { data: cuentasData, isLoading: cuentasLoading, isError: cuentasError, refetch: refetchCuentas } = useSharedCuentasDestino(
    selectedLocationId ?? undefined,
    todayStr,
    todayStr,
    "hoy"
  );

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
    refetchCuentas();
  };

  const lastUpdated = Math.max(dashUpdatedAt, pendingUpdatedAt);

  const totals = dashboard?.totales;
  const mergedPendingAmount = pending?.importe ?? totals?.pendiente ?? "0";
  const mergedPendingCount = pending?.tickets ?? totals?.documentosPendientes ?? 0;
  const pendingTickets = pending?.ticketsSinCobrar
    ?? dashboard?.pendientes.ticketsSinCobrar
    ?? mergedPendingCount;
  const pendingNotes = pending?.notasSinAutorizar
    ?? dashboard?.pendientes.notasSinAutorizar
    ?? 0;
  const pendingTone = attentionCardTone("amber", mergedPendingCount, mergedPendingAmount);
  const cancelledTone = attentionCardTone("red", dashboard?.cancelaciones.tickets, dashboard?.cancelaciones.importe);
  const transitTone = attentionCardTone("amber", dashboard?.salidasEnTransito.conteo, dashboard?.salidasEnTransito.importe);
  const cancelledExitsTone = attentionCardTone("red", dashboard?.salidasCanceladas.conteo, dashboard?.salidasCanceladas.importe);
  const isSalidaBreakdown = breakdownConcept === "SALIDAS_EN_TRANSITO" || breakdownConcept === "SALIDAS_CANCELADAS";
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

  const detailHref = (fuentes: string[]) => {
    const params = new URLSearchParams({ desde: todayStr, hasta: todayStr, preset: "hoy" });
    if (selectedLocationId != null) params.set("ubicacionId", String(selectedLocationId));
    fuentes.forEach((fuente) => params.append("fuente", fuente));
    return `/caja/cuentas-destino/TODAS?${params.toString()}`;
  };

  const header = cuentasData?.encabezado;
  const cobranzaStat = header ? {
    title: "Cobrado en el periodo",
    amount: header.cobrado.total,
    fuentes: ["POS", "ABONO", "ABONO_SALDO_FAVOR"],
    breakdown: [
       { label: "Cobros directos", amount: header.cobrado.contado, fuentes: ["POS"] },
       { label: "Abonos a notas (neto de reversos)", amount: header.cobrado.abonos, fuentes: ["ABONO"] },
       { label: "Saldo a favor (neto de reversos)", amount: header.cobrado.saldosFavor, fuentes: ["ABONO_SALDO_FAVOR"] },
    ],
    className: "border-l-4 border-l-primary",
  } : null;

  return (
    <AppLayout>
      <div className="tiempo-real-layout max-w-[1600px] mx-auto space-y-6">
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
              <div className="grid w-full min-w-0 grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              <Card className="border-sidebar/10 shadow-sm recon-top-card">
                <div className="recon-icon-box blue">
                  <ShoppingBag className="h-6 w-6" />
                </div>
                <div className="recon-top-card-content">
                  <span className="recon-top-card-label">Ventas totales</span>
                  <span className="recon-top-card-value">
                    {formatNumber(totals.ventas, { kind: "money" })}
                  </span>
                  <span className="recon-top-card-sub">
                    {formatCountLabel(totals.tickets, "ticket total", "tickets totales")}
                  </span>
                </div>
              </Card>

              <Card
                className="border-sidebar/10 shadow-sm cursor-pointer transition-shadow hover:shadow-md recon-top-card"
                role="button"
                tabIndex={0}
                onClick={() => openBreakdown("COBRADO")}
                onKeyDown={(event) => event.key === "Enter" && openBreakdown("COBRADO")}
              >
                <div className="recon-icon-box green">
                  <Banknote className="h-6 w-6" />
                </div>
                <div className="recon-top-card-content">
                  <span className="recon-top-card-label">Contado cobrado</span>
                  <span className="recon-top-card-value text-green-700 dark:text-green-400">
                    {formatNumber(totals.cobrado, { kind: "money" })}
                  </span>
                  <span className="recon-top-card-sub">
                     {formatCountLabel(totals.ticketsCobrados, "ticket cobrado", "tickets cobrados")}
                  </span>
                </div>
              </Card>

              <Card
                className="border-sidebar/10 shadow-sm cursor-pointer transition-shadow hover:shadow-md recon-top-card"
                data-testid="realtime-credit-card"
                role="button"
                tabIndex={0}
                onClick={() => openBreakdown("CREDITO")}
                onKeyDown={(event) => event.key === "Enter" && openBreakdown("CREDITO")}
              >
                <div className="recon-icon-box blue">
                  <CreditCard className="h-6 w-6" />
                </div>
                <div className="recon-top-card-content">
                  <span className="recon-top-card-label">Ventas a crédito</span>
                  <span className="recon-top-card-value">
                    {formatNumber(dashboard.ventasCredito.importe, { kind: "money" })}
                  </span>
                  <span className="recon-top-card-sub">
                     {formatCountLabel(dashboard.ventasCredito.operaciones, "operación a crédito", "operaciones a crédito")}
                  </span>
                </div>
              </Card>

              <Card className="border-sidebar/10 shadow-sm recon-top-card">
                <div className="recon-icon-box blue">
                  <LineChart className="h-6 w-6" />
                </div>
                <div className="recon-top-card-content">
                  <span className="recon-top-card-label">Utilidad</span>
                  <span className="recon-top-card-value">
                    {totals.margen == null ? "Pendiente" : formatNumber(totals.margen, { kind: "money" })}
                  </span>
                  <span className="recon-top-card-sub">
                    {totals.margenPorcentaje == null ? "Costo pendiente" : <>Margen {formatNumber(totals.margenPorcentaje, { kind: "percentage", percentageInput: "percent" })}</>}
                  </span>
                </div>
              </Card>
              </div>

              <div className="grid w-full min-w-0 grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              <Card
                className={`${pendingTone.card} shadow-sm relative overflow-hidden cursor-pointer transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring`}
                data-attention={pendingTone.state}
                role="button"
                tabIndex={0}
                onClick={() => openBreakdown("PENDIENTE")}
                onKeyDown={(event) => event.key === "Enter" && openBreakdown("PENDIENTE")}
              >
                {/* Amber indicates pending operational attention, such as items in transit. */}
                {pendingTone.active && (
                  <div className="absolute top-0 right-0 w-1 h-full bg-amber-500" />
                )}
                <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4 pb-2">
                  <CardTitle className={`text-xs font-semibold ${pendingTone.title} uppercase line-clamp-2`}>
                    Ventas pendientes de cobro o autorización
                  </CardTitle>
                  <Clock className={`h-4 w-4 ${pendingTone.icon}`} />
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <div className={`text-xl font-black ${pendingTone.text}`}>
                    {formatNumber(mergedPendingAmount, { kind: "money" })}
                  </div>
                  <p className={`text-xs ${pendingTone.text} mt-1 font-bold`}>
                     {formatCountLabel(pendingTickets, "ticket", "tickets")} ·{" "}
                     {formatCountLabel(pendingNotes, "nota", "notas")}
                  </p>
                </CardContent>
              </Card>

              <Card
                className={`${transitTone.card} shadow-sm relative overflow-hidden cursor-pointer transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring`}
                data-attention={transitTone.state}
                role="button"
                tabIndex={0}
                onClick={() => openBreakdown("SALIDAS_EN_TRANSITO")}
                onKeyDown={(event) => event.key === "Enter" && openBreakdown("SALIDAS_EN_TRANSITO")}
              >
                {/* Amber indicates pending operational attention, such as items in transit. */}
                {transitTone.active && (
                  <div className="absolute top-0 right-0 w-1 h-full bg-amber-500" />
                )}
                <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4 pb-2">
                  <CardTitle className={`text-xs font-semibold ${transitTone.title} uppercase line-clamp-2`}>
                    Salidas en tránsito
                  </CardTitle>
                  <Clock className={`h-4 w-4 ${transitTone.icon}`} />
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <div className={`text-xl font-black ${transitTone.text}`}>
                    {formatCountLabel(dashboard.salidasEnTransito.conteo, "salida", "salidas")}
                  </div>
                </CardContent>
              </Card>

              <Card
                className={`${cancelledTone.card} shadow-sm relative overflow-hidden cursor-pointer transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring`}
                data-attention={cancelledTone.state}
                role="button"
                tabIndex={0}
                onClick={() => openBreakdown("CANCELADAS")}
                onKeyDown={(event) => event.key === "Enter" && openBreakdown("CANCELADAS")}
              >
                {/* Red means "revisa esto", not error, because cancellation is legitimate but merits review. */}
                <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4 pb-2">
                  <CardTitle className={`text-xs font-semibold ${cancelledTone.title} uppercase line-clamp-2`}>
                    Tickets cancelados
                  </CardTitle>
                  <Ban className={`h-4 w-4 ${cancelledTone.icon}`} />
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <div className={`text-xl font-black ${cancelledTone.text}`}>
                     {formatCountLabel(dashboard.cancelaciones.tickets, "ticket", "tickets")} · {formatNumber(dashboard.cancelaciones.importe, { kind: "money" })}
                  </div>
                    <p className={`text-xs ${cancelledTone.text} mt-1 font-bold`}>
                       Tasa de cancelación: {formatNumber(dashboard.cancelaciones.tasaCancelacion, { kind: "percentage", percentageInput: "percent" })}
                     </p>
                </CardContent>
              </Card>

              <Card
                className={`${cancelledExitsTone.card} shadow-sm relative overflow-hidden cursor-pointer transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring`}
                data-attention={cancelledExitsTone.state}
                role="button"
                tabIndex={0}
                onClick={() => openBreakdown("SALIDAS_CANCELADAS")}
                onKeyDown={(event) => event.key === "Enter" && openBreakdown("SALIDAS_CANCELADAS")}
              >
                {/* Red means "revisa esto", not error, because cancellation is legitimate but merits review. */}
                <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4 pb-2">
                  <CardTitle className={`text-xs font-semibold ${cancelledExitsTone.title} uppercase line-clamp-2`}>
                    Salidas canceladas
                  </CardTitle>
                  <Ban className={`h-4 w-4 ${cancelledExitsTone.icon}`} />
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <div className={`text-xl font-black ${cancelledExitsTone.text}`}>
                    {formatCountLabel(dashboard.salidasCanceladas.conteo, "salida", "salidas")}
                  </div>
                </CardContent>
              </Card>
              </div>
            </div>

             {(cuentasLoading || cuentasError) && (
               <div aria-label="Cobrado en el periodo" aria-live="polite">
                 {cuentasError ? (
                   <Alert variant="destructive">
                     <AlertCircle className="h-4 w-4" />
                     <AlertTitle>No se pudo consultar la cobranza del periodo</AlertTitle>
                     <AlertDescription>
                       Las cifras de ventas conservan su consulta independiente.
                       <Button variant="outline" size="sm" className="ml-3" onClick={() => refetchCuentas()}>Reintentar cobranza</Button>
                     </AlertDescription>
                   </Alert>
                 ) : (
                   <div className="py-3 text-sm text-muted-foreground">Consultando cobranza del periodo…</div>
                 )}
               </div>
             )}
             {!cuentasLoading && !cuentasError && cobranzaStat && (
               <div className="py-6 border-y border-sidebar/10">
                 <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                   <div>
                     <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                       {cobranzaStat.title}
                     </p>
                     <Link
                       href={detailHref(cobranzaStat.fuentes)}
                       className="mt-1 inline-block text-3xl font-black text-sidebar hover:text-primary hover:underline"
                       data-testid="text-monto-cobranza-del-periodo"
                     >
                       {formatNumber(cobranzaStat.amount, { kind: "money" })}
                     </Link>
                   </div>
                   <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-8 flex-1 md:max-w-2xl md:border-l border-sidebar/10 md:pl-8 border-t md:border-t-0 pt-4 md:pt-0">
                     {cobranzaStat.breakdown.map((part) => (
                       <Link
                         key={part.label}
                         href={detailHref(part.fuentes)}
                         className="flex sm:flex-col items-center sm:items-start justify-between sm:justify-start gap-1 text-sm hover:text-primary hover:underline group"
                       >
                         <span className="text-muted-foreground text-xs">{part.label}</span>
                         <span className="font-mono font-semibold group-hover:underline">
                           {formatNumber(part.amount, { kind: "money" })}
                         </span>
                       </Link>
                     ))}
                   </div>
                 </div>
               </div>
             )}

             {dashboard && dashboard.cantidades.length > 0 && (
               <div className="flex w-full flex-col sm:flex-row sm:items-center justify-around gap-2 rounded-md border bg-card px-6 py-2.5 text-sm shadow-sm" data-testid="analytics-quantities">
                 {dashboard.cantidades.map((row) => (
                   <div
                     key={`${row.tipo}-${row.unidad}`}
                     data-testid={`quantity-${row.tipo.toLowerCase()}-${row.unidad.toLowerCase()}`}
                     className="flex items-center justify-between sm:justify-start gap-2"
                   >
                     <span className="font-semibold text-muted-foreground">{row.modalidad}</span>
                     <span className="font-mono font-bold text-sidebar text-base">{formatNumber(row.cantidad, { kind: "quantity" })} {formatUnit(row.unidad)}</span>
                   </div>
                 ))}
               </div>
             )}

             <h3 className="recon-heading mt-10">Estado por tienda</h3>
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
              {mergedStores.map(store => {
                const hasPendingAlert = store.pendientes30Min > 0;
                return (
                   <Card key={store.ubicacionId} className="flex flex-col relative overflow-hidden shadow-sm">
                     <CardContent className="p-5 flex-1">
                       <div className="flex items-start justify-between mb-4">
                         <div className="flex gap-3">
                           <div className="mt-0.5 text-primary">
                             <Store className="w-5 h-5" />
                           </div>
                           <div>
                             <div className="font-bold text-base text-sidebar">{store.nombreUbicacion}</div>
                             <div className="text-[11px] text-muted-foreground flex items-center gap-1.5 mt-0.5 font-medium">
                               {store.sesionCajaId ? (
                                 <>
                                   <div className="w-1.5 h-1.5 rounded-full bg-green-500"></div>
                                   Caja abierta {store.abiertaAt && `• ${format(parseISO(store.abiertaAt), "HH:mm")}`}
                                 </>
                               ) : (
                                 <>
                                   <div className="w-1.5 h-1.5 rounded-full bg-gray-400"></div>
                                   Caja cerrada
                                 </>
                               )}
                               <span className="flex items-center gap-1">
                                 <Users className="w-3 h-3" />
                                 {store.cajero || "Sin cajero"}
                               </span>
                             </div>
                           </div>
                         </div>
                         {hasPendingAlert && (
                            <div className="bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-400 text-[10px] px-2 py-0.5 rounded font-bold">
                              {store.pendientes30Min} pendientes {'>'} 30 min
                            </div>
                         )}
                       </div>

                       <div className="grid grid-cols-3 gap-y-4 gap-x-2 mb-4">
                         <div className="recon-store-item">
                           <span className="recon-store-item-label">Vendido</span>
                           <span className="recon-store-item-val">{formatNumber(store.vendido, { kind: "money" })}</span>
                         </div>
                         <div className="recon-store-item">
                           <span className="recon-store-item-label">Cobrado</span>
                           <span className="recon-store-item-val green">{formatNumber(store.cobrado, { kind: "money" })}</span>
                         </div>
                         <div className="recon-store-item">
                           <span className="recon-store-item-label">Margen</span>
                           <span className="recon-store-item-val">
                             {store.margenPorcentaje == null ? "Costo pendiente" : formatNumber(store.margenPorcentaje, { kind: "percentage", percentageInput: "percent" })}
                           </span>
                         </div>
                         <div className="recon-store-item">
                           <span className="recon-store-item-label">Pendiente</span>
                           <span className={`recon-store-item-val ${Number(store.pendiente) > 0 ? "amber" : ""}`}>
                             {formatNumber(store.pendiente, { kind: "money" })}
                           </span>
                         </div>
                         <div className="recon-store-item">
                           <span className="recon-store-item-label">Utilidad</span>
                           <span className="recon-store-item-val">
                             {store.margen == null ? "Pendiente" : formatNumber(store.margen, { kind: "money" })}
                           </span>
                         </div>
                         <div className="recon-store-item">
                           <span className="recon-store-item-label">Tickets cobrados</span>
                           <span className="recon-store-item-val">{store.ticketsCobrados}</span>
                           <span className="text-[10px] text-muted-foreground mt-0.5 leading-tight">
                             Ticket promedio<br/>{formatNumber(store.ticketPromedio, { kind: "money" })}
                           </span>
                         </div>
                       </div>

                       <div className="border-t border-sidebar/10 pt-4 grid grid-cols-3 gap-2 mb-4">
                         <div className="recon-store-item">
                           <span className="recon-store-item-label">Efectivo</span>
                           <span className="recon-store-item-val">{formatNumber(store.efectivo, { kind: "money" })}</span>
                         </div>
                         <div className="recon-store-item">
                           <span className="recon-store-item-label">Transferencia</span>
                           <span className="recon-store-item-val">{formatNumber(store.transferencia, { kind: "money" })}</span>
                         </div>
                         <div className="recon-store-item">
                           <span className="recon-store-item-label">Crédito</span>
                           <span className="recon-store-item-val">{formatNumber(store.credito, { kind: "money" })}</span>
                         </div>
                       </div>

                       <div className="border-t border-sidebar/10 pt-3 flex items-center justify-between">
                         <div className="text-[11px] text-muted-foreground flex items-center gap-1.5 font-medium">
                           {store.sesionCajaId ? (
                             <>
                               <Activity className="w-3.5 h-3.5" />
                               Sesión #{store.sesionCajaId} · Term: {store.usuarioTerminal || "—"}
                             </>
                           ) : (
                             <>
                               <Ban className="w-3.5 h-3.5" />
                               Caja cerrada
                             </>
                           )}
                         </div>
                       </div>

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
                     <div className="bg-muted/10 border-t px-5 py-2">
                       <Link href={`/caja/tiendas/${store.ubicacionId}/ventas`} className="text-primary text-xs font-semibold flex items-center justify-center gap-1 hover:underline">
                         Ver ventas →
                       </Link>
                     </div>
                  </Card>
                )
              })}
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 pt-6">
              <Card className="xl:col-span-3 shadow-sm">
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
                       <TableRow className="bg-muted/20">
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

              <Card className="xl:col-span-3 shadow-sm">
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
                           <div className="min-w-0">
                            <p className="text-muted-foreground">{t.nombreUbicacion}</p>
                             <p className="font-medium break-words">{t.nombreCliente || "Sin Cliente"}</p>
                          </div>
                           <div className="text-right shrink-0">
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
                ? "Contado cobrado"
                : breakdownConcept === "CREDITO"
                  ? "Ventas a crédito"
                  : breakdownConcept === "CANCELADAS"
                    ? "Tickets cancelados"
                    : breakdownConcept === "SALIDAS_EN_TRANSITO"
                      ? "Salidas en tránsito"
                      : breakdownConcept === "SALIDAS_CANCELADAS"
                        ? "Salidas canceladas"
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
                    {isSalidaBreakdown ? (
                      <>
                        <TableHead>Origen</TableHead>
                        <TableHead>Destino o Cliente</TableHead>
                        <TableHead>Fecha</TableHead>
                      </>
                    ) : (
                      <>
                        {breakdownConcept !== "CANCELADAS" && <TableHead>Hora</TableHead>}
                        {breakdownConcept !== "CANCELADAS" && <TableHead>Cliente</TableHead>}
                      </>
                    )}
                    <TableHead className="text-right">Importe</TableHead>
                    {breakdownConcept === "COBRADO" && <><TableHead>Forma de pago</TableHead><TableHead>Facturada</TableHead></>}
                    {breakdownConcept === "CREDITO" && <><TableHead>Plazo</TableHead><TableHead>Vencimiento</TableHead></>}
                    {breakdownConcept === "PENDIENTE" && <><TableHead>Documento</TableHead><TableHead>Espera</TableHead></>}
                    {breakdownConcept === "CANCELADAS" && <><TableHead>Cancelado por</TableHead><TableHead>Fecha/Hora</TableHead><TableHead>Motivo</TableHead></>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {breakdown.data?.items.map((rawItem) => {
                    if (isSalidaBreakdown) {
                      const item = rawItem as SalidaBreakdownItem;
                      return (
                        <TableRow key={item.salidaId}>
                          <TableCell>
                            <Link href={item.href} className="font-semibold text-primary underline-offset-4 hover:underline">
                              {formatNumber(item.folio, { kind: "identifier" })}
                            </Link>
                          </TableCell>
                          <TableCell>{item.origen}</TableCell>
                          <TableCell>{item.destino || item.cliente || "N/A"}</TableCell>
                          <TableCell>{format(parseISO(item.fecha), "dd/MM/yyyy HH:mm")}</TableCell>
                          <TableCell className="text-right font-mono">{formatNumber(item.importe, { kind: "money" })}</TableCell>
                        </TableRow>
                      );
                    } else {
                      const item = rawItem as BreakdownItem;
                      return (
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
                      );
                    }
                  })}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell colSpan={isSalidaBreakdown ? 4 : 3} className="font-semibold">
                      Total ({breakdown.data?.total ?? 0}) {isSalidaBreakdown ? ((breakdown.data?.total ?? 0) === 1 ? "salida" : "salidas") : ((breakdown.data?.total ?? 0) === 1 ? "documento" : "documentos")}
                    </TableCell>
                    <TableCell className="text-right font-mono font-bold">
                      {formatNumber(breakdown.data?.montoTotal ?? "0", { kind: "money" })}
                    </TableCell>
                    {!isSalidaBreakdown && <TableCell colSpan={2} />}
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
