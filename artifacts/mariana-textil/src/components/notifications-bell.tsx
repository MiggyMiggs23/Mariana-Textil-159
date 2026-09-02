import { useState } from "react";
import { Link } from "wouter";
import {
  getGetNotificationFeedQueryKey,
  getCountNotificacionesNoLeidasQueryKey,
  getListNotificacionesQueryKey,
  getListSolicitudesPagoDirigidoQueryKey,
  NotificationFamily,
  useAprobarSolicitudPagoDirigido,
  useGetNotificationFeed,
  useMarkAllNotificacionesRead,
  useRechazarSolicitudPagoDirigido,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Bell,
  BellRing,
  Check,
  ClipboardList,
  ExternalLink,
  Info,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/api-error";

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

function isStoredEvent(kind: string): boolean {
  return kind === "SYSTEM" || kind === "CREDIT_NOTICE";
}

export function NotificationsBell({
  mobile = false,
  isAdmin = false,
}: {
  mobile?: boolean;
  isAdmin?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [rejecting, setRejecting] = useState<number | null>(null);
  const [motivoRechazo, setMotivoRechazo] = useState("");
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const approve = useAprobarSolicitudPagoDirigido();
  const reject = useRechazarSolicitudPagoDirigido();
  const markAllStored = useMarkAllNotificacionesRead({
    mutation: {
      onSuccess: ({ count }) => {
        void queryClient.invalidateQueries({ queryKey: getGetNotificationFeedQueryKey() });
        void queryClient.invalidateQueries({ queryKey: getCountNotificacionesNoLeidasQueryKey() });
        void queryClient.invalidateQueries({ queryKey: getListNotificacionesQueryKey() });
        toast({ title: `${count} notificación(es) marcada(s) como leídas` });
      },
      onError: (error) => toast({
        title: "No se pudieron marcar como leídas",
        description: getApiErrorMessage(error),
        variant: "destructive",
      }),
    },
  });
  const { data, isLoading, isError, refetch } = useGetNotificationFeed({
    query: {
      queryKey: getGetNotificationFeedQueryKey(),
      refetchInterval: 15_000,
      refetchOnWindowFocus: true,
    },
  });

  const events = data?.events ?? [];
  const storedUnreadCount = events.filter((event) => isStoredEvent(event.kind)).length;
  const derivedCount = events.length - storedUnreadCount;
  const refreshDirected = () => {
    queryClient.invalidateQueries({ queryKey: getGetNotificationFeedQueryKey() });
    queryClient.invalidateQueries({ queryKey: getListSolicitudesPagoDirigidoQueryKey() });
    queryClient.invalidateQueries({ queryKey: ["/api/clientes"] });
    queryClient.invalidateQueries({ queryKey: ["/api/proveedores"] });
  };
  const approveDirected = (requestId: number) => approve.mutate({ id: requestId }, {
    onSuccess: () => { refreshDirected(); toast({ title: "Pago dirigido aprobado" }); },
    onError: (error) => toast({ title: "No se pudo aprobar", description: getApiErrorMessage(error), variant: "destructive" }),
  });
  const rejectDirected = () => {
    if (rejecting == null || motivoRechazo.trim().length < 10) return;
    reject.mutate({ id: rejecting, data: { motivoRechazo: motivoRechazo.trim() } }, {
      onSuccess: () => { refreshDirected(); setRejecting(null); setMotivoRechazo(""); toast({ title: "Pago dirigido rechazado" }); },
      onError: (error) => toast({ title: "No se pudo rechazar", description: getApiErrorMessage(error), variant: "destructive" }),
    });
  };

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
          <div className="flex items-center justify-between gap-3">
            <p className="font-semibold text-sidebar">Notificaciones</p>
            {isAdmin && (
              <Button
                size="sm"
                variant="outline"
                disabled={storedUnreadCount === 0 || markAllStored.isPending}
                onClick={() => markAllStored.mutate()}
              >
                <Check className="mr-1 h-3.5 w-3.5" />
                Marcar guardadas como leídas
              </Button>
            )}
          </div>
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
                <div
                  key={`${event.id}:${event.updatedAt}`}
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
                      <p className="mt-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                        {isStoredEvent(event.kind)
                          ? "Notificación guardada · se marca como leída"
                          : "Evento derivado · se resuelve al atender la condición"}
                      </p>
                      {isAdmin && event.kind === "DIRECTED_PAYMENT" && event.action ? (
                        <div className="mt-2 space-y-2" data-testid={`directed-payment-action-${event.action.requestId}`}>
                          <p className="text-xs"><strong>{event.action.documento}</strong> · {event.action.contraparte}</p>
                          <p className="text-xs text-muted-foreground">{event.action.motivo}</p>
                          <div className="flex gap-2">
                            <Button size="sm" disabled={approve.isPending || reject.isPending} onClick={() => approveDirected(event.action!.requestId)}>Aprobar</Button>
                            <Button size="sm" variant="destructive" disabled={approve.isPending || reject.isPending} onClick={() => { setRejecting(event.action!.requestId); setMotivoRechazo(""); }}>Rechazar</Button>
                          </div>
                        </div>
                      ) : (
                        <Link href={event.href} onClick={() => setOpen(false)} className="mt-2 inline-block text-xs font-medium text-primary hover:underline">Ver detalle</Link>
                      )}
                      <p className="mt-2 text-[10px] text-muted-foreground">{eventTime(event.updatedAt)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        {isAdmin && derivedCount > 0 && (
          <p className="border-t px-4 py-2 text-xs text-muted-foreground">
            Marcar como leídas solo afecta notificaciones guardadas. Los eventos derivados
            desaparecen cuando se atiende la condición que los genera.
          </p>
        )}

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
      <Dialog open={rejecting != null} onOpenChange={(value) => { if (!value) { setRejecting(null); setMotivoRechazo(""); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Rechazar pago dirigido</DialogTitle></DialogHeader>
          <Textarea value={motivoRechazo} onChange={(event) => setMotivoRechazo(event.target.value)} placeholder="Motivo del rechazo (mínimo 10 caracteres)" data-testid="input-directed-rejection-reason" />
          <DialogFooter><Button variant="ghost" onClick={() => setRejecting(null)}>Cancelar</Button><Button variant="destructive" onClick={rejectDirected} disabled={reject.isPending || motivoRechazo.trim().length < 10}>Confirmar rechazo</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </Popover>
  );
}