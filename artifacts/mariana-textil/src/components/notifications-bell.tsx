import { useState } from "react";
import { Link } from "wouter";
import {
  getCountNotificacionesNoLeidasQueryKey,
  getListNotificacionesQueryKey,
  useListNotificaciones,
  useMarkAllNotificacionesRead,
  useMarkNotificacionRead,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Bell, Check, ExternalLink, Loader2 } from "lucide-react";
import { formatNumber } from "@workspace/number-format";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

function formatNotificationTime(value: Date | string) {
  return new Intl.DateTimeFormat("es-MX", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function NotificationsBell({
  unreadCount,
  mobile = false,
}: {
  unreadCount: number;
  mobile?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const notifications = useListNotificaciones({
    query: {
      enabled: open,
      queryKey: getListNotificacionesQueryKey(),
    },
  });
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: getListNotificacionesQueryKey() });
    void queryClient.invalidateQueries({ queryKey: getCountNotificacionesNoLeidasQueryKey() });
  };
  const markOne = useMarkNotificacionRead({ mutation: { onSuccess: refresh } });
  const markAll = useMarkAllNotificacionesRead({ mutation: { onSuccess: refresh } });
  const recent = notifications.data?.notificaciones.slice(0, 8) ?? [];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          data-testid="button-notifications"
          className={cn(
            "relative",
            mobile ? "text-white hover:bg-sidebar-accent" : "text-muted-foreground",
          )}
          aria-label="Abrir notificaciones"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span
              data-testid="badge-notificaciones"
              className="absolute right-0 top-0 flex h-5 min-w-5 -translate-y-1/4 translate-x-1/4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-white"
            >
              {unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(92vw,390px)] p-0">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div>
            <p className="font-semibold">Notificaciones</p>
            <p className="text-xs text-muted-foreground">
              {formatNumber(unreadCount, { kind: "count" })} sin leer
            </p>
          </div>
          <Link
            href="/notificaciones"
            onClick={() => setOpen(false)}
            className="flex items-center gap-1 text-sm font-medium text-primary hover:underline"
          >
            Ver todas <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        </div>

        <ScrollArea className="h-[360px]">
          {notifications.isLoading ? (
            <div className="flex h-32 items-center justify-center text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Cargando…
            </div>
          ) : recent.length === 0 ? (
            <div className="px-4 py-12 text-center text-sm text-muted-foreground">
              No hay notificaciones recientes.
            </div>
          ) : (
            <div className="divide-y">
              {recent.map((item) => (
                <Link
                  key={item.id}
                  href={`/tickets/${item.ticketId}`}
                  onClick={() => {
                    if (!item.leidaAt) markOne.mutate({ id: item.id });
                    setOpen(false);
                  }}
                  className={cn(
                    "block space-y-1 px-4 py-3 transition-colors hover:bg-muted",
                    !item.leidaAt && "bg-primary/5",
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className={cn("text-sm", !item.leidaAt && "font-semibold")}>
                      {item.clienteNombre} · Folio {item.folio}
                    </p>
                    {!item.leidaAt && <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" />}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {formatNumber(item.importe, { kind: "money" })} · vence {String(item.fechaVencimiento).slice(0, 10)}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {formatNotificationTime(item.createdAt)}
                  </p>
                </Link>
              ))}
            </div>
          )}
        </ScrollArea>

        <div className="border-t p-3">
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => markAll.mutate()}
            disabled={unreadCount === 0 || markAll.isPending}
          >
            <Check className="mr-2 h-4 w-4" />
            Marcar todas como leídas
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}