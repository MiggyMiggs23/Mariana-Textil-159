import {
  getCountNotificacionesNoLeidasQueryKey,
  getGetNotificationFeedQueryKey,
  getListNotificacionesQueryKey,
  useListNotificaciones,
  useMarkAllNotificacionesRead,
  useMarkNotificacionRead,
} from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Bell, Check, Clock, RefreshCw } from "lucide-react";
import { formatNumber } from "@workspace/number-format";
import { Link } from "wouter";

function formatCalendarDate(value: string): string {
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  if (!year || !month || !day) return value;
  return new Intl.DateTimeFormat("es-MX", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year!, month! - 1, day!)));
}

export default function Notificaciones() {
  const queryClient = useQueryClient();
  const notifications = useListNotificaciones({
    query: { queryKey: getListNotificacionesQueryKey() },
  });
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: getListNotificacionesQueryKey() });
    void queryClient.invalidateQueries({ queryKey: getCountNotificacionesNoLeidasQueryKey() });
    void queryClient.invalidateQueries({ queryKey: getGetNotificationFeedQueryKey() });
  };
  const markOne = useMarkNotificacionRead({ mutation: { onSuccess: refresh } });
  const markAll = useMarkAllNotificacionesRead({ mutation: { onSuccess: refresh } });
  const data = notifications.data;

  return <AppLayout>
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="text-2xl font-bold text-sidebar">Notificaciones</h1><p className="text-sm text-muted-foreground">Avisos operativos, ventas a crédito y alertas calculadas con el saldo actual.</p></div>
        <div className="flex gap-2"><Button variant="outline" onClick={() => notifications.refetch()}><RefreshCw className="mr-2 h-4 w-4" />Actualizar</Button><Button onClick={() => markAll.mutate()} disabled={markAll.isPending || !data || ![...data.sistema, ...data.notificaciones].some((item) => !item.leidaAt)}><Check className="mr-2 h-4 w-4" />Marcar guardadas como leídas</Button></div>
      </div>
      {notifications.isLoading ? <div className="py-16 text-center text-muted-foreground">Cargando notificaciones…</div> : null}
      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold"><AlertTriangle className="h-5 w-5 text-amber-600" />Avisos operativos</h2>
        {!data?.sistema.length ? <Card><CardContent className="p-6 text-muted-foreground">No hay avisos operativos.</CardContent></Card> : data.sistema.map((item) =>
          <Card key={item.id} className={item.leidaAt ? "opacity-70" : "border-amber-300 bg-amber-50/40"}>
            <CardContent className="flex flex-wrap items-center justify-between gap-4 p-4">
              <div className="space-y-1"><p className="font-semibold">{item.titulo}</p><p className="text-sm text-muted-foreground">{item.mensaje}</p>{item.entidad === "solicitudes_pago_dirigido" ? <Link href="/pagos-dirigidos" className="text-sm font-medium text-primary hover:underline">Ver pagos dirigidos</Link> : null}<p className="text-xs text-muted-foreground">{new Date(item.createdAt).toLocaleString("es-MX")}</p></div>
              {!item.leidaAt ? <Button size="sm" variant="outline" onClick={() => markOne.mutate({ tipo: "sistema", id: item.id })}><Check className="mr-1 h-4 w-4" />Leída</Button> : <span className="text-sm text-muted-foreground">Leída</span>}
            </CardContent>
          </Card>,
        )}</section>
      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold"><Bell className="h-5 w-5" />Ventas a crédito</h2>
        {!data?.notificaciones.length ? <Card><CardContent className="p-6 text-muted-foreground">No hay notificaciones de crédito.</CardContent></Card> : data.notificaciones.map((item) =>
          <Card key={item.id} className={item.urgente ? "border-destructive bg-destructive/5" : item.leidaAt ? "opacity-70" : ""}>
            <CardContent className="flex flex-wrap items-center justify-between gap-4 p-4">
              <div className="space-y-1"><p className="font-semibold">{item.urgente && <AlertTriangle className="mr-1 inline h-4 w-4 text-destructive" />}{item.clienteNombre} · Folio {item.folio}</p><p className="text-sm text-muted-foreground">{formatNumber(item.importe, { kind: "money" })} · {item.diasPlazo} días · vence {formatCalendarDate(item.fechaVencimiento)}</p><p className="text-xs text-muted-foreground">Cajero: {item.cajeroNombre} · Tienda: {item.tiendaNombre}</p></div>
              {!item.leidaAt ? <Button size="sm" variant={item.urgente ? "destructive" : "outline"} onClick={() => markOne.mutate({ tipo: "credito", id: item.id })}><Check className="mr-1 h-4 w-4" />Leída</Button> : <span className="text-sm text-muted-foreground">Leída</span>}
            </CardContent>
          </Card>,
        )}</section>
      <div className="grid gap-5 md:grid-cols-2">
        <AlertList title="Por vencer (próximos 3 días)" rows={data?.porVencer ?? []} accent="text-amber-600" />
        <AlertList title="Notas vencidas" rows={data?.vencidas ?? []} accent="text-destructive" />
      </div>
      <Card><CardHeader><CardTitle>Clientes con más de una nota vencida</CardTitle></CardHeader><CardContent className="space-y-2">{data?.clientesConMultiplesVencidas.length ? data.clientesConMultiplesVencidas.map((item) => <div key={item.clienteId} className="flex justify-between border-b pb-2 text-sm"><span>{item.clienteNombre} · {item.notasVencidas} notas</span><strong>{formatNumber(item.saldoVencido, { kind: "money" })}</strong></div>) : <p className="text-sm text-muted-foreground">No hay clientes en esta condición.</p>}</CardContent></Card>
    </div>
  </AppLayout>;
}

function AlertList({ title, rows, accent }: { title: string; rows: Array<{ movimientoId: number; clienteNombre: string; folio: number | null; pendiente: string; fechaVencimiento: string; diasVencido: number }>; accent: string }) {
  return <Card><CardHeader><CardTitle className={accent}><Clock className="mr-2 inline h-5 w-5" />{title}</CardTitle></CardHeader><CardContent className="space-y-2">{rows.length ? rows.map((item) => <div key={item.movimientoId} className="border-b pb-2 text-sm"><p className="font-medium">{item.clienteNombre}{item.folio ? ` · Folio ${item.folio}` : ""}</p><p className="text-muted-foreground">{formatNumber(item.pendiente, { kind: "money" })} · vence {formatCalendarDate(item.fechaVencimiento)}{item.diasVencido ? ` · ${item.diasVencido} días vencida` : ""}</p></div>) : <p className="text-sm text-muted-foreground">Sin alertas.</p>}</CardContent></Card>;
}