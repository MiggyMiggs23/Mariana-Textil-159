import { useState } from "react";
import { Link } from "wouter";
import {
  useGetAdminAlertas,
  getGetAdminAlertasQueryKey,
  useCountNotificacionesNoLeidas,
  getCountNotificacionesNoLeidasQueryKey,
} from "@workspace/api-client-react";
import { Bell, AlertTriangle, ExternalLink, Loader2, Clock, MessageSquareWarning, Store } from "lucide-react";
import { formatNumber } from "@workspace/number-format";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

function dueLabel(days: number): string {
  if (days < 0) return `${Math.abs(days)}d de atraso`;
  if (days === 0) return "Vence hoy";
  return `Vence en ${days}d`;
}

export function NotificationsBell({
  mobile = false,
  adminOnly = false,
}: {
  mobile?: boolean;
  adminOnly?: boolean;
}) {
  const [open, setOpen] = useState(false);

  const { data: alertas, isLoading: loadingAlertas } = useGetAdminAlertas({
    query: {
      enabled: adminOnly,
      queryKey: getGetAdminAlertasQueryKey(),
      refetchInterval: 30_000,
    },
  });

  const { data: notificacionesCount } = useCountNotificacionesNoLeidas({
    query: {
      enabled: adminOnly,
      queryKey: getCountNotificacionesNoLeidasQueryKey(),
      refetchInterval: 60_000,
    },
  });

  if (!adminOnly) return null;

  const totalAlertas = alertas?.total ?? 0;
  const unreadNotifs = notificacionesCount?.count ?? 0;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          data-testid="button-notifications"
          className={cn(
            "relative",
            mobile ? "text-white hover:bg-sidebar-accent" : "text-muted-foreground hover:text-foreground",
          )}
          aria-label="Abrir alertas"
        >
          <Bell className="h-5 w-5" />
          {totalAlertas > 0 && (
            <span
              data-testid="badge-alertas"
              className="absolute right-0 top-0 flex h-5 min-w-5 -translate-y-1/4 translate-x-1/4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-white shadow-sm ring-2 ring-background"
            >
              {totalAlertas > 99 ? '99+' : totalAlertas}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(92vw,400px)] p-0">
        <div className="flex items-center justify-between border-b px-4 py-3 bg-muted/20">
          <div>
            <p className="font-semibold text-sidebar">Alertas en tiempo real</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {formatNumber(totalAlertas, { kind: "count" })} pendientes
            </p>
          </div>
          <Link
            href="/alertas"
            onClick={() => setOpen(false)}
            className="flex items-center gap-1 text-sm font-medium text-primary hover:underline"
          >
            Ver todas <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        </div>

        <ScrollArea className="h-[360px]">
          {loadingAlertas ? (
            <div className="flex h-32 items-center justify-center text-muted-foreground">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Cargando alertas...
            </div>
          ) : totalAlertas === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 gap-3">
              <div className="h-10 w-10 rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center">
                <Clock className="h-5 w-5 text-green-600 dark:text-green-500" />
              </div>
              <p className="font-medium text-green-600 dark:text-green-500">Sin alertas pendientes</p>
            </div>
          ) : (
            <div className="divide-y">
              {alertas?.ticketsPendientes.map((item) => (
                <Link
                  key={`ticket-${item.id}`}
                  href={`/tickets/${item.id}`}
                  onClick={() => setOpen(false)}
                  className="block p-4 transition-colors hover:bg-muted focus:bg-muted outline-none"
                >
                  <div className="flex items-start justify-between gap-3 mb-1.5">
                    <p className="text-sm font-semibold text-amber-700 dark:text-amber-500 flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5" /> Ticket Pendiente
                    </p>
                    <span className="text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 px-1.5 py-0.5 rounded">
                      Hace {item.minutosTranscurridos}m
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-medium text-sidebar">Folio {item.folio}</span>
                    <span className="font-mono font-semibold">{formatNumber(item.importe, { kind: "money" })}</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                    <Store className="h-3 w-3" /> {item.nombreUbicacion} · {item.nombreCreador}
                  </p>
                </Link>
              ))}
              {alertas?.creditos.map((item) => (
                <Link
                  key={`credito-${item.movimientoId}`}
                  href={`/clientes/${item.clienteId}?tab=estado`}
                  onClick={() => setOpen(false)}
                  className="block p-4 transition-colors hover:bg-muted focus:bg-muted outline-none"
                >
                  <div className="flex items-start justify-between gap-3 mb-1.5">
                    <p className={`text-sm font-semibold flex items-center gap-1.5 ${
                      item.diasRestantes < 0 ? "text-destructive" : "text-amber-700 dark:text-amber-500"
                    }`}>
                      <AlertTriangle className="h-3.5 w-3.5" /> Pago de cliente
                    </p>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                      item.diasRestantes < 0
                        ? "bg-destructive/10 text-destructive"
                        : "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"
                    }`}>
                      {dueLabel(item.diasRestantes)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-medium text-sidebar truncate">{item.nombreCliente}</span>
                    <span className={`font-mono font-semibold shrink-0 ${
                      item.diasRestantes < 0 ? "text-destructive" : "text-amber-700 dark:text-amber-400"
                    }`}>{formatNumber(item.importe, { kind: "money" })}</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    {item.ticketFolio ? `Folio ${item.ticketFolio}` : item.nota || "Movimiento sin folio"}
                  </p>
                </Link>
              ))}
            </div>
          )}
        </ScrollArea>

        <div className="border-t bg-muted/40 p-2">
          <Link
            href="/notificaciones"
            onClick={() => setOpen(false)}
            className="flex w-full items-center justify-center gap-2 rounded-md py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <MessageSquareWarning className="h-4 w-4" />
            Ver notificaciones de crédito
            {unreadNotifs > 0 && (
              <span className="ml-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold text-primary-foreground">
                {unreadNotifs}
              </span>
            )}
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}
