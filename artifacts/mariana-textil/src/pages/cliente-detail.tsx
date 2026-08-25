import { useMemo, useState } from "react";
import { Link, useRoute } from "wouter";
import { ArrowLeft, Download, Loader2, LockKeyhole, Printer } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  getGetClienteComprasQueryKey,
  getGetClienteCreditoQueryKey,
  getGetClienteEstadoCuentaQueryKey,
  getGetClienteEstadisticasQueryKey,
  getGetClientePagosQueryKey,
  getGetClientePreciosQueryKey,
  getGetClienteQueryKey,
  getGetCurrentUserQueryKey,
  useGetCliente,
  useGetClienteCredito,
  useGetClientePagos,
  useGetClientePrecios,
  useGetCurrentUser,
  useCreateClientePago,
} from "@workspace/api-client-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/app-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getApiErrorMessage } from "@/lib/api-error";
import { hasPermission, Modules } from "@/lib/permisos";
import { createAdjustment, downloadClientFile, getAccount, getClientAnalytics, getPortfolio, getPurchases, getStats, updateCreditTerms } from "@/lib/clientes-api";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { formatNumber } from "@workspace/number-format";

const date = (value?: string) => value ? new Intl.DateTimeFormat("es-MX", { dateStyle: "medium" }).format(new Date(value)) : "—";

export default function ClienteDetail() {
  const [, params] = useRoute("/clientes/:id");
  const id = Number(params?.id);
  const [period, setPeriod] = useState("12");
  const [movementType, setMovementType] = useState("all");
  const [movementFrom, setMovementFrom] = useState("");
  const [movementTo, setMovementTo] = useState("");
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [adjustmentOpen, setAdjustmentOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("EFECTIVO");
  const [reference, setReference] = useState("");
  const [paymentDate, setPaymentDate] = useState("");
  const [paymentNotes, setPaymentNotes] = useState("");
  const [paymentTicketId, setPaymentTicketId] = useState("");
  const [reason, setReason] = useState("");
  const [creditOpen, setCreditOpen] = useState(false);
  const [creditLimit, setCreditLimit] = useState("");
  const [creditDays, setCreditDays] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: user } = useGetCurrentUser({ query: { queryKey: getGetCurrentUserQueryKey() } });
  const canCredit = hasPermission(user, Modules.CLIENTES_CREDITO, "ver");
  const canPrices = hasPermission(user, Modules.CLIENTES_PRECIOS, "ver");
  const canFinances = hasPermission(user, Modules.CLIENTES_FINANZAS, "ver");
  const canCreatePayment = hasPermission(user, Modules.CLIENTES_FINANZAS, "crear");
  const canAdjust = hasPermission(user, Modules.CLIENTES_FINANZAS, "autorizar");
  const canEditCredit = hasPermission(user, Modules.CLIENTES_CREDITO, "editar");
  const clientQuery = useGetCliente(id, { query: { enabled: Number.isFinite(id), queryKey: getGetClienteQueryKey(id) } });
  const credit = useGetClienteCredito(id, { query: { enabled: canCredit && Number.isFinite(id), queryKey: getGetClienteCreditoQueryKey(id) } });
  const periodDates = useMemo(() => {
    if (period === "1200") return {};
    const until = new Date(); const since = new Date(); since.setMonth(since.getMonth() - Number(period));
    return { desde: since.toISOString().slice(0, 10), hasta: until.toISOString().slice(0, 10) };
  }, [period]);
  const account = useQuery({ queryKey: ["cliente-account", id], queryFn: () => getAccount(id), enabled: canFinances && Number.isFinite(id) });
  const purchases = useQuery({ queryKey: ["cliente-purchases", id, periodDates], queryFn: () => getPurchases(id, periodDates), enabled: canFinances && Number.isFinite(id) });
  const stats = useQuery({ queryKey: ["cliente-stats", id, periodDates], queryFn: () => getStats(id, periodDates), enabled: canFinances && Number.isFinite(id) });
  const analytics = useQuery({ queryKey: ["cliente-analytics", id, periodDates], queryFn: () => getClientAnalytics(id, periodDates), enabled: canFinances && Number.isFinite(id) });
  const portfolio = useQuery({ queryKey: ["clientes-portfolio"], queryFn: getPortfolio, enabled: canCredit && Number.isFinite(id) });
  const payments = useGetClientePagos(id, { query: { enabled: canFinances && Number.isFinite(id), queryKey: getGetClientePagosQueryKey(id) } });
  const prices = useGetClientePrecios(id, { query: { enabled: canPrices && Number.isFinite(id), queryKey: getGetClientePreciosQueryKey(id) } });
  const filteredPurchases = purchases.data?.compras ?? [];
  const chartData = useMemo(() => {
    const months = new Map<string, number>();
    filteredPurchases.forEach((item) => {
      if (!item.fecha) return;
      const key = new Intl.DateTimeFormat("es-MX", { month: "short", year: "2-digit" }).format(new Date(item.fecha));
      months.set(key, (months.get(key) ?? 0) + Number(item.total ?? 0));
    });
    return Array.from(months, ([month, total]) => ({ month, total })).reverse();
  }, [filteredPurchases]);

  const createPayment = useCreateClientePago();
  const adjustment = useMutation({ mutationFn: () => createAdjustment(id, { importe: Number(amount), motivo: reason }), onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["cliente-account", id] }); queryClient.invalidateQueries({ queryKey: getGetClienteCreditoQueryKey(id) }); setAdjustmentOpen(false); setAmount(""); setReason(""); toast({ title: "Ajuste registrado" }); }, onError: (error) => toast({ title: "No se pudo registrar el ajuste", description: getApiErrorMessage(error, "Intenta de nuevo."), variant: "destructive" }) });
  const creditUpdate = useMutation({ mutationFn: () => updateCreditTerms(id, { limiteCredito: Number(creditLimit), diasCredito: Number(creditDays) }), onSuccess: () => { queryClient.invalidateQueries({ queryKey: getGetClienteCreditoQueryKey(id) }); queryClient.invalidateQueries({ queryKey: getGetClienteQueryKey(id) }); setCreditOpen(false); toast({ title: "Crédito actualizado" }); }, onError: (error) => toast({ title: "No se pudo actualizar", description: getApiErrorMessage(error, "Intenta de nuevo."), variant: "destructive" }) });
  const submitPayment = () => createPayment.mutate({ id, data: { importe: Number(amount), formaPago: paymentMethod, referencia: reference || null, notas: paymentNotes || null, fechaEfectiva: paymentDate || null, ticketId: paymentTicketId ? Number(paymentTicketId) : null } }, { onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["cliente-account", id] }); queryClient.invalidateQueries({ queryKey: getGetClientePagosQueryKey(id) }); queryClient.invalidateQueries({ queryKey: getGetClienteCreditoQueryKey(id) }); setPaymentOpen(false); setAmount(""); setReference(""); setPaymentDate(""); setPaymentNotes(""); setPaymentTicketId(""); toast({ title: "Pago registrado" }); }, onError: (error) => toast({ title: "No se pudo registrar el pago", description: getApiErrorMessage(error, "Intenta de nuevo."), variant: "destructive" }) });

  if (clientQuery.isLoading) return <AppLayout><div className="mx-auto max-w-7xl space-y-4"><Skeleton className="h-12 w-72" /><Skeleton className="h-96 w-full" /></div></AppLayout>;
  if (clientQuery.isError || !clientQuery.data) return <AppLayout><Card className="mx-auto max-w-xl border-destructive/30"><CardContent className="space-y-4 p-8 text-center"><p className="text-destructive" role="alert" data-testid="error-client-detail">{getApiErrorMessage(clientQuery.error, "No se pudo cargar el cliente.")}</p><Button asChild><Link href="/clientes">Volver a clientes</Link></Button></CardContent></Card></AppLayout>;
  const client = clientQuery.data;

  return (
    <AppLayout>
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <Button variant="ghost" size="icon" asChild><Link href="/clientes" aria-label="Volver a clientes" data-testid="link-back-clients"><ArrowLeft className="h-5 w-5" /></Link></Button>
            <div><div className="flex flex-wrap items-center gap-2"><h1 className="text-2xl font-bold text-sidebar" data-testid="text-client-name">{client.nombre}</h1>{client.id === 1 && <Badge variant="secondary"><LockKeyhole className="mr-1 h-3 w-3" />Cliente de sistema</Badge>}<Badge variant={client.activo ? "default" : "secondary"}>{client.activo ? "Activo" : "Inactivo"}</Badge></div><p className="text-sm text-muted-foreground">Cliente #{formatNumber(client.id, { kind: "identifier" })} · Alta {date(client.createdAt)}</p></div>
          </div>
          {canFinances && <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => downloadClientFile(`/clientes/${id}/estado-cuenta.pdf`, `estado-cuenta-${id}.pdf`)} data-testid="button-export-account"><Download className="mr-2 h-4 w-4" />Descargar PDF</Button><Button variant="outline" onClick={() => window.print()} data-testid="button-print-account"><Printer className="mr-2 h-4 w-4" />Imprimir</Button></div>}
        </div>
        <Tabs defaultValue="datos">
          <TabsList className="h-auto w-full justify-start overflow-x-auto">
            <TabsTrigger value="datos">Datos</TabsTrigger>
            {canCredit && <TabsTrigger value="credito">Crédito</TabsTrigger>}
            {canFinances && <TabsTrigger value="estado">Estado de cuenta</TabsTrigger>}
            {canFinances && <TabsTrigger value="compras">Compras</TabsTrigger>}
            {(canFinances || canPrices) && <TabsTrigger value="analitica">Analítica</TabsTrigger>}
          </TabsList>
          <TabsContent value="datos">
            <Card><CardHeader><CardTitle>Datos de contacto</CardTitle></CardHeader><CardContent className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              <Datum label="Teléfono" value={client.telefono} /><Datum label="Correo" value={client.correo} /><Datum label="RFC" value={client.rfc} /><Datum label="Dirección" value={client.direccion} /><Datum label="Notas" value={client.notas} />
            </CardContent></Card>
          </TabsContent>
          {canCredit && <TabsContent value="credito"><QueryState query={credit}>{(() => {
            const limit = Number(credit.data?.limiteCredito);
            const balance = Number(credit.data?.saldoActual);
            const utilization = credit.data?.utilizacion != null ? Number(credit.data.utilizacion) : limit > 0 ? (balance / limit) * 100 : null;
            const aging = portfolio.data?.clientes.find((item) => item.id === id);
            const apiAging = (credit.data?.antiguedad ?? []) as Array<Record<string, unknown>>;
            return <><div className="mb-4 flex justify-end">{canEditCredit && !client.esSistema && <Button variant="outline" onClick={() => { setCreditLimit(credit.data?.limiteCredito ?? ""); setCreditDays(String(credit.data?.diasCredito ?? client.diasCredito)); setCreditOpen(true); }}>Editar términos</Button>}</div><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><Kpi label="Límite" value={formatNumber(credit.data?.limiteCredito, { kind: "money" })} /><Kpi label="Saldo actual" value={formatNumber(credit.data?.saldoActual, { kind: "money" })} /><Kpi label="Disponible" value={formatNumber(credit.data?.creditoDisponible, { kind: "money" })} /><Kpi label="Días de crédito" value={formatNumber(credit.data?.diasCredito ?? client.diasCredito, { kind: "count" })} /><Kpi label="Total vencido" value={formatNumber(credit.data?.totalVencido, { kind: "money" })} />{credit.data?.primeraCompra && <Kpi label="Primera compra" value={date(credit.data.primeraCompra)} />}{credit.data?.ultimaActividad && <Kpi label="Última actividad" value={date(credit.data.ultimaActividad)} />}</div>{utilization !== null && Number.isFinite(utilization) && <Card className="mt-4"><CardContent className="pt-6"><div className="flex justify-between text-sm"><span>Utilización</span><strong>{formatNumber(utilization, { kind: "percentage", percentageInput: "percent" })}</strong></div><div className="mt-2 h-3 overflow-hidden rounded-full bg-muted"><div className={`h-full ${utilization > 100 ? "bg-destructive" : utilization > 80 ? "bg-amber-500" : "bg-emerald-500"}`} style={{ width: `${Math.min(100, utilization)}%` }} /></div></CardContent></Card>}<Card className="mt-4"><CardHeader><CardTitle>Antigüedad real</CardTitle></CardHeader><CardContent className="grid gap-3 sm:grid-cols-5">{apiAging.length ? apiAging.map((bucket, index) => <Aging key={String(bucket.rango ?? index)} label={String(bucket.rango ?? bucket.bucket ?? "Periodo")} value={String(bucket.importe ?? bucket.saldo ?? "")} />) : aging ? <><Aging label="Por vencer" value={aging.porVencer} /><Aging label="1–30 días" value={aging["1_30"]} /><Aging label="31–60 días" value={aging["31_60"]} /><Aging label="61–90 días" value={aging["61_90"]} /><Aging label="+90 días" value={aging.mas90} /></> : <p className="col-span-full text-muted-foreground">Sin saldo pendiente.</p>}</CardContent></Card></>;
          })()}</QueryState></TabsContent>}
          {canFinances && <TabsContent value="estado"><QueryState query={account}><div className="mb-4 flex flex-wrap gap-2"><Select value={movementType} onValueChange={setMovementType}><SelectTrigger className="w-48"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todos los movimientos</SelectItem><SelectItem value="VENTA_CREDITO">Ventas a crédito</SelectItem><SelectItem value="ABONO">Pagos</SelectItem><SelectItem value="AJUSTE">Ajustes</SelectItem></SelectContent></Select><Input type="date" aria-label="Movimientos desde" value={movementFrom} onChange={(e) => setMovementFrom(e.target.value)} className="w-40" /><Input type="date" aria-label="Movimientos hasta" value={movementTo} onChange={(e) => setMovementTo(e.target.value)} className="w-40" /><Button variant="outline" onClick={() => downloadClientFile(`/clientes/${id}/estado-cuenta.xlsx`, `estado-cuenta-${id}.xlsx`)}>Excel</Button>{canCreatePayment && <Button onClick={() => setPaymentOpen(true)} data-testid="button-register-payment">Registrar pago</Button>}{canAdjust && <Button variant="outline" onClick={() => setAdjustmentOpen(true)} data-testid="button-register-adjustment">Ajuste</Button>}</div><Card><CardHeader><CardTitle>Movimientos, pagos y ajustes</CardTitle></CardHeader><CardContent><ResponsiveTable headers={["Fecha", "Tipo", "Folio", "Pago", "Referencia / notas", "Usuario", "Importe", "Saldo"]} rows={(account.data?.movimientos ?? []).filter((item) => (movementType === "all" || item.tipo === movementType) && (!movementFrom || (item.fechaEfectiva ?? item.fecha ?? "") >= movementFrom) && (!movementTo || (item.fechaEfectiva ?? item.fecha ?? "").slice(0, 10) <= movementTo)).map((item, index) => [date(item.fechaEfectiva ?? item.fecha), item.tipo ?? "Movimiento", formatNumber(item.ticketFolio, { kind: "identifier" }), item.formaPago ?? "—", [item.referencia, item.notas].filter(Boolean).join(" · ") || "—", item.nombreUsuario ?? "—", formatNumber(item.importe, { kind: "money" }), formatNumber(item.saldoCorrido, { kind: "money" }), String(index)])} empty="No hay movimientos en la cuenta." /></CardContent></Card><div className="mt-4"><Kpi label="Saldo actual" value={formatNumber(account.data?.saldoActual, { kind: "money" })} /></div></QueryState></TabsContent>}
          {canFinances && <TabsContent value="compras" className="space-y-4"><Period value={period} onChange={setPeriod} /><QueryState query={purchases}><Card><CardContent className="pt-6"><ResponsiveTable headers={["Fecha", "Folio", "Subtotal", "IVA", "Total", "Metros", "Kilos", "Margen"]} rows={filteredPurchases.map((item, index) => [date(item.fecha), formatNumber(item.folio ?? item.id, { kind: "identifier" }), formatNumber(item.subtotal, { kind: "money" }), formatNumber(item.iva, { kind: "money" }), formatNumber(item.total, { kind: "money" }), formatNumber(item.metros, { kind: "quantity" }), formatNumber(item.kilos, { kind: "quantity" }), item.lineasSinCosto ? "N/D (sin costo)" : formatNumber(item.margen, { kind: "money" }), String(index)])} empty="No hay compras en este periodo." /></CardContent></Card><p className="text-right text-sm font-semibold">Total del periodo: {formatNumber(filteredPurchases.reduce((sum, item) => sum + Number(item.total ?? 0), 0), { kind: "money" })}</p></QueryState></TabsContent>}
          {(canFinances || canPrices) && <TabsContent value="analitica" className="space-y-4"><Period value={period} onChange={setPeriod} />{canFinances && <QueryState query={stats}><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><Kpi label="Compra acumulada" value={formatNumber(stats.data?.totalCompras, { kind: "money" })} /><Kpi label="Tickets" value={formatNumber(stats.data?.comprasCount, { kind: "count" })} /><Kpi label="Ticket promedio" value={formatNumber(Number(stats.data?.totalCompras ?? 0) / Math.max(1, stats.data?.comprasCount ?? 0), { kind: "money" })} /><Kpi label="Metros" value={formatNumber(stats.data?.metros, { kind: "quantity" })} /><Kpi label="Kilos" value={formatNumber(stats.data?.kilos, { kind: "quantity" })} /><Kpi label="Costo identificable" value={formatNumber(stats.data?.costo, { kind: "money" })} /><Kpi label="Margen identificable" value={formatNumber(stats.data?.margen, { kind: "money" })} /></div>{(stats.data?.lineasSinCosto ?? 0) > 0 && <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">Margen parcial: {formatNumber(stats.data?.lineasSinCosto, { kind: "count" })} línea(s) no tienen costo congelado.</p>}<Card className="mt-4"><CardHeader><CardTitle>Compras por mes</CardTitle></CardHeader><CardContent>{chartData.length ? <div className="h-72" data-testid="chart-client-purchases"><ResponsiveContainer width="100%" height="100%"><BarChart data={chartData}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="month" /><YAxis /><Tooltip formatter={(value) => formatNumber(Number(value), { kind: "money" })} /><Bar dataKey="total" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div> : <p className="py-12 text-center text-muted-foreground">Sin datos para graficar en este periodo.</p>}</CardContent></Card></QueryState>}{canPrices && <QueryState query={prices}><Card className="mt-4"><CardHeader><CardTitle>Precios negociados recientes</CardTitle></CardHeader><CardContent><ResponsiveTable headers={["Fecha", "SKU", "Precio", "Promedio últimas 3"]} rows={(prices.data?.precios ?? []).map((item, index) => [date(item.fecha), item.sku, formatNumber(item.precioUnitario, { kind: "money" }), formatNumber(item.promedio3, { kind: "money" }), String(index)])} empty="No hay precios registrados." /></CardContent></Card></QueryState>}{canFinances && payments.data?.pagos?.length ? <p className="text-sm text-muted-foreground">{formatNumber(payments.data.pagos.length, { kind: "count" })} pago(s) registrados en el historial.</p> : null}</TabsContent>}
          {canFinances && <ClientAnalyticsBlocks query={analytics} />}
        </Tabs>
        <Dialog open={paymentOpen} onOpenChange={setPaymentOpen}><DialogContent><DialogHeader><DialogTitle>Registrar pago</DialogTitle></DialogHeader><div className="space-y-3"><Label>Importe</Label><Input type="number" min="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} /><Label>Forma de pago</Label><Select value={paymentMethod} onValueChange={setPaymentMethod}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="EFECTIVO">Efectivo</SelectItem><SelectItem value="TRANSFERENCIA">Transferencia</SelectItem></SelectContent></Select><Label>Fecha efectiva</Label><Input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} /><Label>Ticket relacionado (opcional)</Label><Input type="number" min="1" value={paymentTicketId} onChange={(e) => setPaymentTicketId(e.target.value)} /><Label>Referencia</Label><Input value={reference} onChange={(e) => setReference(e.target.value)} /><Label>Notas</Label><Textarea value={paymentNotes} onChange={(e) => setPaymentNotes(e.target.value)} /></div><DialogFooter><Button onClick={submitPayment} disabled={!Number(amount) || createPayment.isPending}>Guardar pago</Button></DialogFooter></DialogContent></Dialog>
        <Dialog open={adjustmentOpen} onOpenChange={setAdjustmentOpen}><DialogContent><DialogHeader><DialogTitle>Ajuste de saldo</DialogTitle></DialogHeader><div className="space-y-3"><Label>Importe (positivo o negativo)</Label><Input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} /><Label>Motivo (mínimo 10 caracteres)</Label><Textarea value={reason} onChange={(e) => setReason(e.target.value)} /></div><DialogFooter><Button onClick={() => adjustment.mutate()} disabled={!Number(amount) || reason.trim().length < 10 || adjustment.isPending}>Registrar ajuste</Button></DialogFooter></DialogContent></Dialog>
        <Dialog open={creditOpen} onOpenChange={setCreditOpen}><DialogContent><DialogHeader><DialogTitle>Editar términos de crédito</DialogTitle></DialogHeader><div className="space-y-3"><Label>Límite de crédito</Label><Input type="number" min="0" value={creditLimit} onChange={(e) => setCreditLimit(e.target.value)} /><Label>Días de crédito</Label><Input type="number" min="0" step="1" value={creditDays} onChange={(e) => setCreditDays(e.target.value)} /></div><DialogFooter><Button onClick={() => creditUpdate.mutate()} disabled={Number(creditLimit) < 0 || Number(creditDays) < 0 || creditUpdate.isPending}>Guardar términos</Button></DialogFooter></DialogContent></Dialog>
      </div>
    </AppLayout>
  );
}

function QueryState({ query, children }: { query: { isLoading: boolean; isError: boolean; error: unknown }; children: React.ReactNode }) {
  if (query.isLoading) return <div className="flex h-48 items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-primary" /></div>;
  if (query.isError) return <Card><CardContent className="p-6 text-destructive" role="alert">{getApiErrorMessage(query.error, "No se pudo cargar esta sección.")}</CardContent></Card>;
  return <>{children}</>;
}
function ClientAnalyticsBlocks({ query }: { query: { data?: Awaited<ReturnType<typeof getClientAnalytics>>; isLoading: boolean; isError: boolean; error: unknown } }) {
  return <div className="mt-4 space-y-4"><QueryState query={query}><div className="grid gap-4 lg:grid-cols-2"><Card><CardHeader><CardTitle>Actividad del periodo</CardTitle></CardHeader><CardContent className="grid grid-cols-2 gap-4"><Datum label="Última compra" value={query.data?.actividad.ultimaCompra ? date(query.data.actividad.ultimaCompra) : "Sin compras"} /><Datum label="Tickets" value={formatNumber(query.data?.actividad.tickets, { kind: "count" })} /><Datum label="Ticket promedio" value={formatNumber(query.data?.actividad.ticketPromedio, { kind: "money" })} /><Datum label="Ticket máximo" value={formatNumber(query.data?.actividad.ticketMaximo, { kind: "money" })} /></CardContent></Card><Card><CardHeader><CardTitle>Mezcla de pagos</CardTitle></CardHeader><CardContent><ResponsiveTable headers={["Forma", "Importe", "Movimientos"]} rows={(query.data?.mezclaPagos ?? []).map((item, index) => [item.forma ?? "Sin forma", formatNumber(item.importe, { kind: "money" }), formatNumber(item.movimientos, { kind: "count" }), String(index)])} empty="Sin pagos en el periodo." /></CardContent></Card></div><Card><CardHeader><CardTitle>Tendencia mensual</CardTitle></CardHeader><CardContent><ResponsiveTable headers={["Mes", "Tickets", "Ventas"]} rows={(query.data?.tendencia ?? []).map((item, index) => [item.mes, formatNumber(item.tickets, { kind: "count" }), formatNumber(item.ventas, { kind: "money" }), String(index)])} empty="Sin tendencia disponible." /></CardContent></Card><Card><CardHeader><CardTitle>Productos por unidad, tela y color</CardTitle></CardHeader><CardContent><ResponsiveTable headers={["SKU", "Tela", "Color", "Unidad", "Cantidad", "Ventas", "Margen"]} rows={(query.data?.productos ?? []).map((item, index) => [item.sku, item.tela, item.color, item.unidad, formatNumber(item.cantidad, { kind: "quantity" }), formatNumber(item.ventas, { kind: "money" }), formatNumber(item.margen, { kind: "money" }), String(index)])} empty="Sin productos en el periodo." /></CardContent></Card></QueryState></div>;
}
function Datum({ label, value }: { label: string; value?: string | null }) { return <div><p className="text-xs font-medium uppercase text-muted-foreground">{label}</p><p className="mt-1 whitespace-pre-wrap" data-testid={`text-client-${label.toLowerCase()}`}>{value || "—"}</p></div>; }
function Kpi({ label, value }: { label: string; value: string }) { return <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">{label}</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold" data-testid={`metric-client-${label.toLowerCase().replaceAll(" ", "-")}`}>{value}</p></CardContent></Card>; }
function Aging({ label, value }: { label: string; value?: string }) { return <div className="rounded-lg border p-4"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 font-semibold">{formatNumber(value, { kind: "money" })}</p></div>; }
function Period({ value, onChange }: { value: string; onChange: (value: string) => void }) { return <div className="flex justify-end"><Select value={value} onValueChange={onChange}><SelectTrigger className="w-full sm:w-52" data-testid="select-client-period"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="3">Últimos 3 meses</SelectItem><SelectItem value="6">Últimos 6 meses</SelectItem><SelectItem value="12">Últimos 12 meses</SelectItem><SelectItem value="1200">Todo el historial</SelectItem></SelectContent></Select></div>; }
function ResponsiveTable({ headers, rows, empty }: { headers: string[]; rows: string[][]; empty: string }) {
  if (!rows.length) return <p className="py-10 text-center text-muted-foreground">{empty}</p>;
  return <div className="overflow-x-auto"><Table><TableHeader><TableRow>{headers.map((header) => <TableHead key={header} className={header === "Importe" || header === "Total" ? "text-right" : ""}>{header}</TableHead>)}</TableRow></TableHeader><TableBody>{rows.map((row) => <TableRow key={row.at(-1)}>{row.slice(0, -1).map((cell, index) => <TableCell key={index} className={index === headers.length - 1 ? "text-right font-mono" : ""}>{headers[index] === "Folio" ? <Link href={`/tickets/${row.at(-1)}`} className="font-medium text-primary hover:underline">{cell}</Link> : cell}</TableCell>)}</TableRow>)}</TableBody></Table></div>;
}