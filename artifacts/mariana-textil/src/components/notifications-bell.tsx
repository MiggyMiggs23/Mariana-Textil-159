import { useState } from "react";
import { Link } from "wouter";
import {
  getGetNotificationFeedQueryKey,
  NotificationFamily,
  useGetNotificationFeed,
} from "@workspace/api-client-react";
import {
  AlertTriangle,
  Bell,
  BellRing,
  ClipboardList,
  ExternalLink,
  Info,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

const FAMILY_LABELS: Record<NotificationFamily, string> = {
  AVISO: "Aviso",
  SOLICITUD: "Solicitud",
  ALERTA: "Alerta",
};

function familyIcon(family: NotificationFamily) {
  if (family === NotificationFamily.ALERTA) {
    return <AlertTriangle className="h-4 w-4 text-destructive" />;
  }
  if (family === NotificationFamily.SOLICITUD) {
    return <ClipboardList className="h-4 w-4 text-blue-600" />;
  }
  return <Info className="h-4 w-4 text-emerald-600" />;
}

function eventTime(value: string): string {
  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Mexico_City",
  }).format(new Date(value));
}

export function NotificationsBell({
  mobile = false,
  isAdmin = false,
}: {
  mobile?: boolean;
  isAdmin?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const { data, isLoading, isError, refetch } = useGetNotificationFeed({
    query: {
      queryKey: getGetNotificationFeedQueryKey(),
      refetchInterval: 15_000,
      refetchOnWindowFocus: true,
    },
  });

  const events = data?.events ?? [];

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
          aria-label="Abrir notificaciones"
        >
          {events.length ? <BellRing className="h-5 w-5" /> : <Bell className="h-5 w-5" />}
          {events.length > 0 && (
            <span
              data-testid="badge-notifications"
              className="absolute right-0 top-0 flex h-5 min-w-5 -translate-y-1/4 translate-x-1/4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-white shadow-sm ring-2 ring-background"
            >
              {events.length > 99 ? "99+" : events.length}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(92vw,420px)] p-0">
        <div className="border-b bg-muted/20 px-4 py-3">
          <p className="font-semibold text-sidebar">Notificaciones</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {events.length ? `${events.length} evento(s) activos` : "Sin eventos activos"}
          </p>
        </div>

        <ScrollArea className="h-[380px]">
          {isLoading ? (
            <div className="flex h-32 items-center justify-center text-muted-foreground">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Cargando notificaciones…
            </div>
          ) : isError ? (
            <div className="flex h-40 flex-col items-center justify-center gap-3 px-6 text-center">
              <AlertTriangle className="h-6 w-6 text-destructive" />
              <p className="text-sm text-muted-foreground">No se pudieron cargar las notificaciones.</p>
              <Button size="sm" variant="outline" onClick={() => refetch()}>Reintentar</Button>
            </div>
          ) : events.length === 0 ? (
            <div className="flex h-48 flex-col items-center justify-center gap-3 text-muted-foreground">
              <Bell className="h-8 w-8" />
              <p className="font-medium">Sin notificaciones pendientes</p>
            </div>
          ) : (
            <div className="divide-y">
              {events.map((event) => (
                <Link
                  key={`${event.id}:${event.updatedAt}`}
                  href={event.href}
                  onClick={() => setOpen(false)}
                  className="block p-4 outline-none transition-colors hover:bg-muted focus:bg-muted"
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5">{familyIcon(event.family)}</div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-sm font-semibold text-sidebar">{event.title}</p>
                        <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                          {FAMILY_LABELS[event.family]}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">{event.message}</p>
                      <p className="mt-2 text-[10px] text-muted-foreground">{eventTime(event.updatedAt)}</p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </ScrollArea>

        {isAdmin && (
          <div className="grid grid-cols-2 gap-1 border-t bg-muted/40 p-2">
            <Link
              href="/alertas"
              onClick={() => setOpen(false)}
              className="flex items-center justify-center gap-1 rounded-md py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              Alertas <ExternalLink className="h-3.5 w-3.5" />
            </Link>
            <Link
              href="/notificaciones"
              onClick={() => setOpen(false)}
              className="flex items-center justify-center gap-1 rounded-md py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              Historial <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}