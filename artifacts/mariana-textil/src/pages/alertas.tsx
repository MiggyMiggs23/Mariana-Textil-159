import { useMemo, useState } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import {
  useGetAdminAlertas,
  getGetAdminAlertasQueryKey,
} from "@workspace/api-client-react";
import { Clock, AlertTriangle, RefreshCw, Loader2, ArrowRight, Store, UserSquare2, Ticket, CircleX, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatNumber } from "@workspace/number-format";
import { Link } from "wouter";

function ticketTime(value: string): string {
  return new Intl.DateTimeFormat("es-MX", {
    timeZone: "America/Mexico_City",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function dueLabel(days: number): string {
  if (days < 0) return `${Math.abs(days)} ${Math.abs(days) === 1 ? "día" : "días"} de atraso`;
  if (days === 0) return "Vence hoy";
  return `Vence en ${days} ${days === 1 ? "día" : "días"}`;
}

function transitAgeLabel(hours: number): string {
  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  return days > 0 ? `${days} ${days === 1 ? "día" : "días"} y ${remainingHours} h` : `${hours} h`;
}

export default function Alertas() {
  const [typeFilter, setTypeFilter] = useState("todas");
  const [dueFilter, setDueFilter] = useState("todos");
  const { data: alertas, isLoading, isError, refetch, isFetching } = useGetAdminAlertas({
    query: {
      queryKey: getGetAdminAlertasQueryKey(),
      refetchInterval: 30000,
    }
  });
  const visibleTickets = typeFilter === "creditos" || typeFilter === "salidas" ? [] : alertas?.ticketsPendientes ?? [];
  const visibleCredits = useMemo(() => {
    if (typeFilter === "tickets" || typeFilter === "salidas") return [];
    const creditos = alertas?.creditos ?? [];
    if (dueFilter === "vencidos") return creditos.filter(({ diasRestantes }) => diasRestantes < 0);
    if (dueFilter === "por-vencer") return creditos.filter(({ diasRestantes }) => diasRestantes >= 0);
    return creditos;
  }, [alertas?.creditos, dueFilter, typeFilter]);
  const visibleTransitExits = typeFilter === "tickets" || typeFilter === "creditos"
    ? []
    : alertas?.salidasEnTransito ?? [];

  return (
    <AppLayout>
      <div className="mx-auto max-w-[1600px] space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-sidebar flex items-center gap-2">
              <AlertTriangle className="h-8 w-8 text-destructive" />
              Alertas en Tiempo Real
            </h1>
            <p className="text-muted-foreground mt-1">
              Monitoreo de tickets sin cobrar, pagos de clientes y salidas sin recibir.
            </p>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <Button variant="outline" onClick={() => refetch()} disabled={isFetching}>
              <RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
              Actualizar
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap gap-3 rounded-lg border bg-card p-3">
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[220px]" aria-label="Filtrar tipo de alerta">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todos los tipos</SelectItem>
              <SelectItem value="tickets">Tickets sin cobrar</SelectItem>
              <SelectItem value="creditos">Pagos de clientes</SelectItem>
              <SelectItem value="salidas">Salidas sin recibir</SelectItem>
            </SelectContent>
          </Select>
          <Select value={dueFilter} onValueChange={setDueFilter} disabled={typeFilter === "tickets" || typeFilter === "salidas"}>
            <SelectTrigger className="w-[220px]" aria-label="Filtrar vencimiento">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos los vencimientos</SelectItem>
              <SelectItem value="vencidos">Solo vencidos</SelectItem>
              <SelectItem value="por-vencer">Por vencer</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="flex h-64 items-center justify-center">
            <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
          </div>
        ) : isError ? (
          <div className="flex h-64 items-center justify-center flex-col gap-3 rounded-xl border border-dashed border-destructive/30 bg-destructive/5">
            <CircleX className="h-10 w-10 text-destructive" />
            <p className="font-semibold text-destructive">No se pudieron cargar las alertas</p>
            <Button variant="outline" onClick={() => refetch()}>Reintentar</Button>
          </div>
        ) : alertas?.total === 0 ? (
          <div className="flex h-64 items-center justify-center flex-col gap-3 rounded-xl border border-dashed border-green-500/20 bg-green-50/50 dark:bg-green-950/10">
            <div className="h-12 w-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <Clock className="h-6 w-6 text-green-600 dark:text-green-500" />
            </div>
            <p className="text-lg font-bold text-green-600 dark:text-green-500">Sin alertas pendientes</p>
            <p className="text-sm text-green-700/70 dark:text-green-400/70">La operación fluye con normalidad.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
            {/* Tickets Section */}
            {typeFilter !== "creditos" && typeFilter !== "salidas" && <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-sidebar flex items-center gap-2">
                  <Clock className="h-5 w-5 text-amber-600" />
                  Tickets Pendientes
                  <span className="ml-2 rounded-full bg-amber-100 text-amber-800 px-2 py-0.5 text-xs font-bold dark:bg-amber-900/30 dark:text-amber-400">
                    {visibleTickets.length}
                  </span>
                </h2>
              </div>

              {visibleTickets.length === 0 ? (
                <Card className="bg-muted/20 border-dashed">
                  <CardContent className="p-8 text-center text-muted-foreground">
                    No hay tickets pendientes prolongados.
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-3">
                  {visibleTickets.map((ticket) => (
                    <Card key={ticket.id} className="border-l-4 border-l-amber-500 hover:bg-muted/30 transition-colors shadow-sm">
                      <CardContent className="p-4 flex items-center justify-between gap-4">
                        <div className="space-y-1.5 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-base">Folio {ticket.folio}</span>
                            <span className="text-amber-700 bg-amber-100 dark:text-amber-400 dark:bg-amber-900/30 px-1.5 py-0.5 rounded text-[10px] font-bold">
                              Hace {ticket.minutosTranscurridos} min
                            </span>
                          </div>
                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1 truncate" title={ticket.nombreUbicacion}><Store className="h-3.5 w-3.5" /> {ticket.nombreUbicacion}</span>
                            <span className="flex items-center gap-1 truncate" title={ticket.nombreCreador}><UserSquare2 className="h-3.5 w-3.5" /> {ticket.nombreCreador}</span>
                          </div>
                           <div className="text-xs text-muted-foreground">
                             Creado a las {ticketTime(ticket.createdAt)}
                           </div>
                          <div className="text-xs truncate text-foreground font-medium">
                            Cliente: {ticket.nombreCliente || 'Público General'}
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-2 shrink-0">
                          <span className="font-bold text-lg font-mono">{formatNumber(ticket.importe, { kind: "money" })}</span>
                          <Link href={`/tickets/${ticket.id}`} className="text-primary hover:underline text-sm font-medium flex items-center gap-1">
                            Revisar <ArrowRight className="h-3 w-3" />
                          </Link>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>}

            {/* Créditos Section */}
            {typeFilter !== "tickets" && typeFilter !== "salidas" && <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-sidebar flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                   Pagos por vencer o vencidos
                  <span className="ml-2 rounded-full bg-destructive/10 text-destructive px-2 py-0.5 text-xs font-bold">
                    {visibleCredits.length}
                  </span>
                </h2>
              </div>

              {visibleCredits.length === 0 ? (
                <Card className="bg-muted/20 border-dashed">
                  <CardContent className="p-8 text-center text-muted-foreground">
                     No hay pagos por vencer o vencidos.
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-3">
                  {visibleCredits.map((credito) => (
                    <Card
                      key={credito.movimientoId}
                      className={`border-l-4 hover:bg-muted/30 transition-colors shadow-sm ${
                        credito.diasRestantes < 0 ? "border-l-destructive" : "border-l-amber-500"
                      }`}
                    >
                      <CardContent className="p-4 flex items-center justify-between gap-4">
                        <div className="space-y-1.5 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-base truncate">{credito.nombreCliente}</span>
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold shrink-0 ${
                              credito.diasRestantes < 0
                                ? "text-destructive bg-destructive/10"
                                : "text-amber-700 bg-amber-100 dark:text-amber-400 dark:bg-amber-900/30"
                            }`}>
                              {dueLabel(credito.diasRestantes)}
                            </span>
                          </div>
                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1"><Ticket className="h-3.5 w-3.5" />
                               {credito.ticketFolio ? `Folio ${credito.ticketFolio}` : credito.nota || "Movimiento sin folio"}
                            </span>
                          </div>
                          <div className="text-xs font-medium text-foreground">
                             Vencimiento: {credito.fechaVencimiento.slice(0, 10)}
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-2 shrink-0">
                          <span className={`font-bold text-lg font-mono ${credito.diasRestantes < 0 ? "text-destructive" : "text-amber-700 dark:text-amber-400"}`}>
                            {formatNumber(credito.importe, { kind: "money" })}
                          </span>
                          <Link href={`/clientes/${credito.clienteId}?tab=estado`} className="text-primary hover:underline text-sm font-medium flex items-center gap-1">
                            Estado de cuenta <ArrowRight className="h-3 w-3" />
                          </Link>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>}

            {typeFilter !== "tickets" && typeFilter !== "creditos" && <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-sidebar flex items-center gap-2">
                  <Truck className="h-5 w-5 text-destructive" />
                  Salidas sin recibir (&gt;24 h)
                  <span className="ml-2 rounded-full bg-destructive/10 text-destructive px-2 py-0.5 text-xs font-bold">
                    {visibleTransitExits.length}
                  </span>
                </h2>
              </div>
              {visibleTransitExits.length === 0 ? (
                <Card className="bg-muted/20 border-dashed">
                  <CardContent className="p-8 text-center text-muted-foreground">
                    No hay salidas en tránsito sin recibir por más de 24 horas.
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-3">
                  {visibleTransitExits.map((salida) => (
                    <Card key={salida.id} className="border-l-4 border-l-destructive hover:bg-muted/30 transition-colors shadow-sm">
                      <CardContent className="p-4 flex items-center justify-between gap-4">
                        <div className="space-y-1.5 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-base">Salida {salida.folio}</span>
                            <span className="text-destructive bg-destructive/10 px-1.5 py-0.5 rounded text-[10px] font-bold">
                              {transitAgeLabel(salida.horasEnTransito)} en tránsito
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Store className="h-3.5 w-3.5 shrink-0" />
                            <span className="truncate">{salida.nombreOrigen}</span>
                            <ArrowRight className="h-3.5 w-3.5 shrink-0" />
                            <span className="truncate">{salida.nombreDestino}</span>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Enviada a las {ticketTime(salida.enviadaAt)}
                          </div>
                        </div>
                        <Link href={`/salidas?folio=${salida.folio}`} className="text-primary hover:underline text-sm font-medium flex items-center gap-1 shrink-0">
                          Revisar <ArrowRight className="h-3 w-3" />
                        </Link>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
