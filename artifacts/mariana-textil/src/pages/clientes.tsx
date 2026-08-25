import { useMemo, useState } from "react";
import { Link } from "wouter";
import { ArrowUpDown, LockKeyhole, Search, Users } from "lucide-react";
import {
  getGetClientesResumenQueryKey,
  getGetClientesCarteraQueryKey,
  getGetClienteCreditoQueryKey,
  getGetCurrentUserQueryKey,
  getListClientesQueryKey,
  useGetClientesResumen,
  useGetClientesCartera,
  useGetClienteCredito,
  useGetCurrentUser,
  useListClientes,
} from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout/app-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getApiErrorMessage } from "@/lib/api-error";
import { hasPermission, Modules } from "@/lib/permisos";
import { downloadClientFile } from "@/lib/clientes-api";
import { getGlobalAnalytics } from "@/lib/clientes-api";
import { useQuery } from "@tanstack/react-query";

const money = (value: string | number | null | undefined) =>
  Number(value ?? 0).toLocaleString("es-MX", { style: "currency", currency: "MXN" });

export default function Clientes() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("active");
  const [sort, setSort] = useState<"name" | "recent">("name");
  const [analyticsMonths, setAnalyticsMonths] = useState("12");
  const { data: user } = useGetCurrentUser({ query: { queryKey: getGetCurrentUserQueryKey() } });
  const canFinances = hasPermission(user, Modules.CLIENTES_FINANZAS, "ver");
  const canCredit = hasPermission(user, Modules.CLIENTES_CREDITO, "ver");
  const clientsQuery = useListClientes({ query: { queryKey: getListClientesQueryKey() } });
  const summaryQuery = useGetClientesResumen({
    query: { enabled: canFinances, queryKey: getGetClientesResumenQueryKey() },
  });
  const carteraQuery = useGetClientesCartera({
    query: { enabled: canFinances, queryKey: getGetClientesCarteraQueryKey() },
  });
  const analyticsPeriod = useMemo(() => { const now = new Date(); const start = new Date(); start.setMonth(start.getMonth() - Number(analyticsMonths)); return { desde: start.toISOString().slice(0, 10), hasta: now.toISOString().slice(0, 10) }; }, [analyticsMonths]);
  const analyticsQuery = useQuery({ queryKey: ["clientes-global-analytics", analyticsPeriod], queryFn: () => getGlobalAnalytics(analyticsPeriod), enabled: canFinances });
  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return [...(clientsQuery.data ?? [])]
      .filter((client) => status === "all" || client.activo === (status === "active"))
      .filter((client) => !term || [client.nombre, client.telefono, client.correo, client.rfc].some((field) => field?.toLowerCase().includes(term)))
      .sort((a, b) => sort === "name" ? a.nombre.localeCompare(b.nombre, "es") : +new Date(b.createdAt) - +new Date(a.createdAt));
  }, [clientsQuery.data, search, sort, status]);

  return (
    <AppLayout>
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-sidebar">Clientes</h1>
            <p className="mt-1 text-sm text-muted-foreground">Directorio, cartera y comportamiento comercial.</p>
          </div>
        </div>
        <Tabs defaultValue="clientes">
          <TabsList className="grid w-full grid-cols-3 sm:w-[430px]">
            <TabsTrigger value="clientes" data-testid="tab-clientes">Clientes</TabsTrigger>
            <TabsTrigger value="cartera" disabled={!canFinances} data-testid="tab-cartera">Cartera</TabsTrigger>
            <TabsTrigger value="analisis" disabled={!canFinances} data-testid="tab-analysis">Análisis</TabsTrigger>
          </TabsList>
          <TabsContent value="clientes" className="space-y-4">
            <Card>
              <CardContent className="grid gap-3 p-4 sm:grid-cols-[1fr_170px_170px]">
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Nombre, teléfono, correo o RFC" className="pl-9" data-testid="input-search-clients" />
                </div>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger data-testid="select-client-status"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="active">Activos</SelectItem><SelectItem value="inactive">Inactivos</SelectItem><SelectItem value="all">Todos</SelectItem></SelectContent>
                </Select>
                <Select value={sort} onValueChange={(value) => setSort(value as "name" | "recent")}>
                  <SelectTrigger data-testid="select-client-sort"><ArrowUpDown className="mr-2 h-4 w-4" /><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="name">Nombre A–Z</SelectItem><SelectItem value="recent">Más recientes</SelectItem></SelectContent>
                </Select>
              </CardContent>
            </Card>
            {clientsQuery.isLoading ? (
              <div className="space-y-3" aria-label="Cargando clientes">{[1, 2, 3].map((item) => <Skeleton key={item} className="h-16 w-full" />)}</div>
            ) : clientsQuery.isError ? (
              <Card className="border-destructive/30"><CardContent className="space-y-3 p-6 text-destructive" role="alert">
                <p data-testid="error-clients">{getApiErrorMessage(clientsQuery.error, "No se pudieron cargar los clientes.")}</p>
                <Button variant="outline" onClick={() => clientsQuery.refetch()} data-testid="button-retry-clients">Intentar de nuevo</Button>
              </CardContent></Card>
            ) : visible.length === 0 ? (
              <Card><CardContent className="grid place-items-center gap-2 p-12 text-center text-muted-foreground"><Users className="h-10 w-10 opacity-40" /><p data-testid="empty-clients">No hay clientes que coincidan con los filtros.</p></CardContent></Card>
            ) : (
              <Card className="overflow-hidden">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader><TableRow><TableHead>Cliente</TableHead><TableHead>Contacto</TableHead><TableHead>RFC</TableHead><TableHead>Estado</TableHead>{canCredit && <><TableHead className="text-right">Saldo</TableHead><TableHead className="text-right">Disponible</TableHead></>}<TableHead className="text-right">Acción</TableHead></TableRow></TableHeader>
                    <TableBody>{visible.map((client) => (
                      <TableRow key={client.id} data-testid={`row-client-${client.id}`}>
                        <TableCell className="font-medium">
                          {client.nombre}
                          {client.id === 1 && <Badge variant="secondary" className="ml-2"><LockKeyhole className="mr-1 h-3 w-3" />Sistema</Badge>}
                        </TableCell>
                        <TableCell><div>{client.telefono || "—"}</div><div className="text-xs text-muted-foreground">{client.correo}</div></TableCell>
                        <TableCell>{client.rfc || "—"}</TableCell>
                        <TableCell><Badge variant={client.activo ? "default" : "secondary"}>{client.activo ? "Activo" : "Inactivo"}</Badge></TableCell>
                        {canCredit && <ClientFinancialCells id={client.id} />}
                        <TableCell className="text-right"><Button variant="ghost" size="sm" asChild><Link href={`/clientes/${client.id}`} data-testid={`link-client-${client.id}`}>Ver detalle</Link></Button></TableCell>
                      </TableRow>
                    ))}</TableBody>
                  </Table>
                </div>
              </Card>
            )}
          </TabsContent>
          <TabsContent value="cartera" className="space-y-4">
            <SummaryPanel loading={summaryQuery.isLoading} error={summaryQuery.isError ? summaryQuery.error : null} values={[
              ["Cartera total", money(summaryQuery.data?.totalCartera)],
              ["Saldo vencido", money(summaryQuery.data?.totalVencido)],
              ["Clientes con saldo", String(summaryQuery.data?.clientesConSaldo ?? 0)],
              ["Clientes activos", String(summaryQuery.data?.totalClientes ?? 0)],
            ]} />
            <Card>
              <CardHeader className="flex-row items-center justify-between"><CardTitle>Antigüedad de cartera</CardTitle><Button variant="outline" size="sm" onClick={() => downloadClientFile("/clientes/cartera.xlsx", "cartera-clientes.xlsx")} data-testid="button-export-client-analytics"><DownloadIcon />Excel</Button></CardHeader>
              <CardContent>{carteraQuery.isLoading ? <Skeleton className="h-24 w-full" /> : carteraQuery.isError ? <p className="text-destructive">No se pudo cargar la cartera.</p> : <div className="grid gap-3 sm:grid-cols-5">{["POR_VENCER", "1_30", "31_60", "61_90", "MAS_90"].map((bucket) => { const total = (carteraQuery.data?.clientes ?? []).filter((item) => item.antiguedad === bucket).reduce((sum, item) => sum + Number(item.saldoActual), 0); return <div key={bucket} className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">{bucket.replace("_", "–").replace("POR_VENCER", "Por vencer").replace("MAS_90", "+90 días")}</p><p className="mt-1 font-bold">{money(total)}</p></div>; })}</div>}</CardContent>
            </Card>
            <Card><CardHeader><CardTitle>Clientes con saldo</CardTitle></CardHeader><CardContent><div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Cliente</TableHead><TableHead>Antigüedad</TableHead><TableHead>Días vencido</TableHead><TableHead className="text-right">Saldo</TableHead></TableRow></TableHeader><TableBody>{(carteraQuery.data?.clientes ?? []).map((item) => <TableRow key={item.id} className={item.diasVencido > 0 ? "bg-amber-50" : ""}><TableCell><Link className="font-medium hover:underline" href={`/clientes/${item.id}`}>{item.nombre}</Link></TableCell><TableCell>{item.antiguedad}</TableCell><TableCell>{item.diasVencido}</TableCell><TableCell className="text-right font-mono">{money(item.saldoActual)}</TableCell></TableRow>)}</TableBody></Table></div></CardContent></Card>
          </TabsContent>
          <TabsContent value="analisis">
            <div className="mb-4 flex justify-end"><Select value={analyticsMonths} onValueChange={setAnalyticsMonths}><SelectTrigger className="w-52"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="3">Últimos 3 meses</SelectItem><SelectItem value="6">Últimos 6 meses</SelectItem><SelectItem value="12">Últimos 12 meses</SelectItem><SelectItem value="24">Últimos 24 meses</SelectItem></SelectContent></Select></div>
            {analyticsQuery.isLoading ? <Skeleton className="h-64 w-full" /> : analyticsQuery.isError ? <p className="text-destructive">No se pudo cargar la analítica.</p> : <div className="space-y-4"><SummaryPanel loading={false} error={null} values={[["Ventas", money(analyticsQuery.data?.ventas)], ["Margen identificable", money(analyticsQuery.data?.margen)], ["Tickets", String(analyticsQuery.data?.tickets ?? "—")], ["Metros / kilos", `${analyticsQuery.data?.metros ?? "—"} / ${analyticsQuery.data?.kilos ?? "—"}`]]} /><div className="grid gap-4 lg:grid-cols-2"><AnalyticsTable title="Top por ventas" rows={(analyticsQuery.data?.topVentas ?? []).map((item) => [item.nombre, money(item.ventas), money(item.margen)])} /><AnalyticsTable title="Top por margen" rows={(analyticsQuery.data?.topMargen ?? []).map((item) => [item.nombre, money(item.ventas), money(item.margen)])} /><AnalyticsTable title="Pareto de clientes" rows={(analyticsQuery.data?.pareto ?? []).map((item) => [item.nombre, money(item.ventas), `${(Number(item.acumulado) * 100).toFixed(1)}%`])} /><AnalyticsTable title="Público vs registrado" rows={(analyticsQuery.data?.publicoVsRegistrado ?? []).map((item) => [item.segmento, money(item.ventas), `${item.tickets} tickets`])} /></div><AnalyticsTable title="Evolución mensual" rows={(analyticsQuery.data?.mensual ?? []).map((item) => [item.mes, money(item.ventas), money(item.margen)])} />{(analyticsQuery.data?.lineasSinCosto ?? 0) > 0 && <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-900">El margen excluye {analyticsQuery.data?.lineasSinCosto} línea(s) sin costo.</p>}<Button variant="outline" onClick={() => downloadClientFile(`/clientes/analitica.xlsx?desde=${analyticsPeriod.desde}&hasta=${analyticsPeriod.hasta}`, "analitica-clientes.xlsx")}>Exportar analítica Excel</Button></div>}
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}

function DownloadIcon() { return <span aria-hidden="true" className="mr-1">↓</span>; }
function AnalyticsTable({ title, rows }: { title: string; rows: string[][] }) { return <Card><CardHeader><CardTitle>{title}</CardTitle></CardHeader><CardContent>{rows.length ? <div className="space-y-2">{rows.map((row, index) => <div key={`${row[0]}-${index}`} className="grid grid-cols-3 gap-2 border-b py-2 text-sm"><span className="font-medium">{row[0]}</span><span className="text-right">{row[1]}</span><span className="text-right text-muted-foreground">{row[2]}</span></div>)}</div> : <p className="text-muted-foreground">Sin datos para el periodo.</p>}</CardContent></Card>; }

function ClientFinancialCells({ id }: { id: number }) {
  const query = useGetClienteCredito(id, {
    query: { queryKey: getGetClienteCreditoQueryKey(id), staleTime: 30_000 },
  });
  if (query.isLoading) return <><TableCell><Skeleton className="ml-auto h-4 w-16" /></TableCell><TableCell><Skeleton className="ml-auto h-4 w-16" /></TableCell></>;
  if (query.isError) return <><TableCell className="text-right text-muted-foreground">—</TableCell><TableCell className="text-right text-muted-foreground">—</TableCell></>;
  return <><TableCell className="text-right font-mono" data-testid={`text-client-balance-${id}`}>{money(query.data?.saldoActual)}</TableCell><TableCell className="text-right font-mono">{money(query.data?.creditoDisponible)}</TableCell></>;
}

function SummaryPanel({ loading, error, values }: { loading: boolean; error: unknown; values: string[][] }) {
  if (loading) return <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{values.map((_, index) => <Skeleton className="h-28" key={index} />)}</div>;
  if (error) return <Card><CardContent className="p-6 text-destructive">{getApiErrorMessage(error, "No se pudo cargar la información financiera.")}</CardContent></Card>;
  return <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{values.map(([label, value]) => <Card key={label}><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold" data-testid={`metric-${label.toLowerCase().replaceAll(" ", "-")}`}>{value}</p></CardContent></Card>)}</div>;
}