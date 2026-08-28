import { useMemo, useState } from "react";
import { Link } from "wouter";
import { ArrowUpDown, Loader2, LockKeyhole, Plus, Search, Users } from "lucide-react";
import {
  getGetClientesResumenQueryKey,
  getGetClientesCarteraQueryKey,
  getGetClienteCreditoQueryKey,
  getGetCurrentUserQueryKey,
  getListClientesQueryKey,
  getListCuentasIncobrablesQueryKey,
  useGetClientesResumen,
  useGetClientesCartera,
  useGetClienteCredito,
  useGetCurrentUser,
  useListClientes,
  useCreateCliente,
  useListCuentasIncobrables,
} from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout/app-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getApiErrorMessage } from "@/lib/api-error";
import { hasPermission, Modules } from "@/lib/permisos";
import { downloadClientFile } from "@/lib/clientes-api";
import { getGlobalAnalytics } from "@/lib/clientes-api";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { formatNumber } from "@workspace/number-format";
import { toast } from "sonner";
import { PurgaCatalogoButton } from "@/components/purga-catalogo-button";

export default function Clientes() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("active");
  const [sort, setSort] = useState<"name" | "recent">("name");
  const [analyticsMonths, setAnalyticsMonths] = useState("12");
  const [createOpen, setCreateOpen] = useState(false);
  const { data: user } = useGetCurrentUser({ query: { queryKey: getGetCurrentUserQueryKey() } });
  const canFinances = hasPermission(user, Modules.CLIENTES_FINANZAS, "ver") && user?.rol !== "SUPERVISOR";
  const canCredit = hasPermission(user, Modules.CLIENTES_CREDITO, "ver") && user?.rol !== "SUPERVISOR";
  const canCreate = hasPermission(user, Modules.CLIENTES, "crear");
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
      .sort((a, b) => {
        if (sort === "name") {
          const aIsSys = a.esSistema || a.id === 1;
          const bIsSys = b.esSistema || b.id === 1;
          if (aIsSys && !bIsSys) return -1;
          if (!aIsSys && bIsSys) return 1;
          return a.nombre.localeCompare(b.nombre, "es", { sensitivity: "base", numeric: true });
        }
        return +new Date(b.createdAt) - +new Date(a.createdAt);
      });
  }, [clientsQuery.data, search, sort, status]);

  return (
    <AppLayout>
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-sidebar">Clientes</h1>
            <p className="mt-1 text-sm text-muted-foreground">Directorio, cartera y comportamiento comercial.</p>
          </div>
          {canCreate && (
            <Button onClick={() => setCreateOpen(true)} className="w-full sm:w-auto" data-testid="button-create-client">
              <Plus className="mr-2 h-4 w-4" />
              Nuevo cliente
            </Button>
          )}
        </div>
        <Tabs defaultValue="clientes">
          <TabsList className="flex w-full flex-wrap sm:w-auto">
            <TabsTrigger value="clientes" data-testid="tab-clientes">Clientes</TabsTrigger>
            {canFinances && <TabsTrigger value="cartera" data-testid="tab-cartera">Cartera</TabsTrigger>}
            {canFinances && <TabsTrigger value="analisis" data-testid="tab-analysis">Análisis</TabsTrigger>}
            {user?.rol === "ADMIN" && <TabsTrigger value="incobrables" data-testid="tab-incobrables">Incobrables</TabsTrigger>}
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
                    <TableHeader><TableRow><TableHead>Cliente</TableHead><TableHead>Contacto</TableHead><TableHead>RFC</TableHead><TableHead>Estado</TableHead>{canCredit && <><TableHead className="text-right">Saldo</TableHead><TableHead className="text-right">Disponible</TableHead></>}{user?.rol === "ADMIN" && <TableHead className="text-right">Acciones</TableHead>}</TableRow></TableHeader>
                    <TableBody>{visible.map((client) => (
                      <TableRow key={client.id} data-testid={`row-client-${client.id}`}>
                        <TableCell className="font-medium">
                          <Link
                            href={`/clientes/${client.id}`}
                            className="text-primary underline underline-offset-4 hover:text-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                            data-testid={`link-client-${client.id}`}
                          >
                            {client.nombre}
                          </Link>
                          {client.id === 1 && <Badge variant="secondary" className="ml-2"><LockKeyhole className="mr-1 h-3 w-3" />Sistema</Badge>}
                        </TableCell>
                        <TableCell><div>{client.telefono || "—"}</div><div className="text-xs text-muted-foreground">{client.correo}</div></TableCell>
                        <TableCell>{client.rfc || "—"}</TableCell>
                        <TableCell><Badge variant={client.activo ? "default" : "secondary"}>{client.activo ? "Activo" : "Inactivo"}</Badge></TableCell>
                        {canCredit && <ClientFinancialCells id={client.id} />}
                        {user?.rol === "ADMIN" && (
                          <TableCell className="text-right">
                            {!client.activo && !client.esSistema && (
                              <PurgaCatalogoButton entidad="clientes" id={client.id} nombreVisible={client.nombre} invalidateQueryKey={getListClientesQueryKey()} />
                            )}
                          </TableCell>
                        )}
                      </TableRow>
                    ))}</TableBody>
                  </Table>
                </div>
              </Card>
            )}
          </TabsContent>
          <TabsContent value="cartera" className="space-y-4">
            <SummaryPanel loading={summaryQuery.isLoading} error={summaryQuery.isError ? summaryQuery.error : null} values={[
              ["Cartera total", formatNumber(summaryQuery.data?.totalCartera, { kind: "money" })],
              ["Saldo vencido", formatNumber(summaryQuery.data?.totalVencido, { kind: "money" })],
              ["Clientes con saldo", String(summaryQuery.data?.clientesConSaldo ?? 0)],
              ["Clientes activos", String(summaryQuery.data?.totalClientes ?? 0)],
            ]} />
            <Card>
              <CardHeader className="flex-row items-center justify-between"><CardTitle>Antigüedad de cartera</CardTitle><Button variant="outline" size="sm" onClick={() => downloadClientFile("/clientes/cartera.xlsx", "cartera-clientes.xlsx")} data-testid="button-export-client-analytics"><DownloadIcon />Excel</Button></CardHeader>
              <CardContent>{carteraQuery.isLoading ? <Skeleton className="h-24 w-full" /> : carteraQuery.isError ? <p className="text-destructive">No se pudo cargar la cartera.</p> : <div className="grid gap-3 sm:grid-cols-5">{["POR_VENCER", "1_30", "31_60", "61_90", "MAS_90"].map((bucket) => { const total = (carteraQuery.data?.clientes ?? []).filter((item) => item.antiguedad === bucket).reduce((sum, item) => sum + Number(item.saldoActual), 0); return <div key={bucket} className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">{bucket.replace("_", "–").replace("POR_VENCER", "Por vencer").replace("MAS_90", "+90 días")}</p><p className="mt-1 font-bold">{formatNumber(total, { kind: "money" })}</p></div>; })}</div>}</CardContent>
            </Card>
            <Card><CardHeader><CardTitle>Clientes con saldo</CardTitle></CardHeader><CardContent><div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Cliente</TableHead><TableHead>Antigüedad</TableHead><TableHead>Días vencido</TableHead><TableHead className="text-right">Saldo</TableHead></TableRow></TableHeader><TableBody>{(carteraQuery.data?.clientes ?? []).map((item) => <TableRow key={item.id} className={item.diasVencido > 0 ? "bg-amber-50" : ""}><TableCell><Link className="font-medium hover:underline" href={`/clientes/${item.id}`}>{item.nombre}</Link></TableCell><TableCell>{item.antiguedad}</TableCell><TableCell>{item.diasVencido}</TableCell><TableCell className="text-right font-mono">{formatNumber(item.saldoActual, { kind: "money" })}</TableCell></TableRow>)}</TableBody></Table></div></CardContent></Card>
          </TabsContent>
          <TabsContent value="analisis">
            <div className="mb-4 flex justify-end"><Select value={analyticsMonths} onValueChange={setAnalyticsMonths}><SelectTrigger className="w-52"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="3">Últimos 3 meses</SelectItem><SelectItem value="6">Últimos 6 meses</SelectItem><SelectItem value="12">Últimos 12 meses</SelectItem><SelectItem value="24">Últimos 24 meses</SelectItem></SelectContent></Select></div>
            {analyticsQuery.isLoading ? <Skeleton className="h-64 w-full" /> : analyticsQuery.isError ? <p className="text-destructive">No se pudo cargar la analítica.</p> : <div className="space-y-4"><SummaryPanel loading={false} error={null} values={[["Ventas", formatNumber(analyticsQuery.data?.ventas, { kind: "money" })], ["Margen", analyticsQuery.data?.margen == null ? "Pendiente" : formatNumber(analyticsQuery.data.margen, { kind: "money" })], ["Tickets", formatNumber(analyticsQuery.data?.tickets, { kind: "count" })], ["ROLLOS · METRO", formatNumber(analyticsQuery.data?.rollosMetros, { kind: "quantity" })], ["ROLLOS · KILO", formatNumber(analyticsQuery.data?.rollosKilos, { kind: "quantity" })], ["METRAJE · METRO", formatNumber(analyticsQuery.data?.metrajeMetros, { kind: "quantity" })]]} /><div className="grid gap-4 lg:grid-cols-2"><AnalyticsTable title="Top por ventas" rows={(analyticsQuery.data?.topVentas ?? []).map((item) => [item.nombre, formatNumber(item.ventas, { kind: "money" }), item.margen == null ? "Pendiente" : formatNumber(item.margen, { kind: "money" })])} /><AnalyticsTable title="Top por margen" rows={(analyticsQuery.data?.topMargen ?? []).map((item) => [item.nombre, formatNumber(item.ventas, { kind: "money" }), item.margen == null ? "Pendiente" : formatNumber(item.margen, { kind: "money" })])} /><AnalyticsTable title="Pareto de clientes" rows={(analyticsQuery.data?.pareto ?? []).map((item) => [item.nombre, formatNumber(item.ventas, { kind: "money" }), formatNumber(item.acumulado, { kind: "percentage", percentageInput: "ratio" })])} /><AnalyticsTable title="Público vs registrado" rows={(analyticsQuery.data?.publicoVsRegistrado ?? []).map((item) => [item.segmento, formatNumber(item.ventas, { kind: "money" }), `${formatNumber(item.tickets, { kind: "count" })} tickets`])} /></div><AnalyticsTable title="Evolución mensual" rows={(analyticsQuery.data?.mensual ?? []).map((item) => [item.mes, formatNumber(item.ventas, { kind: "money" }), item.margen == null ? "Pendiente" : formatNumber(item.margen, { kind: "money" })])} />{(analyticsQuery.data?.lineasSinCosto ?? 0) > 0 && <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-900">Costo y margen pendientes por {formatNumber(analyticsQuery.data?.lineasSinCosto, { kind: "count" })} línea(s) sin costo congelado.</p>}<Button variant="outline" onClick={() => downloadClientFile(`/clientes/analitica.xlsx?desde=${analyticsPeriod.desde}&hasta=${analyticsPeriod.hasta}`, "analitica-clientes.xlsx")}>Exportar analítica Excel</Button></div>}
          </TabsContent>
          {user?.rol === "ADMIN" && (
            <TabsContent value="incobrables">
              <IncobrablesTab />
            </TabsContent>
          )}
        </Tabs>
      </div>
      {canCreate && <CreateClienteDialog open={createOpen} onClose={() => setCreateOpen(false)} canCredit={canCredit} />}
    </AppLayout>
  );
}

type ClientForm = {
  nombre: string;
  telefono: string;
  correo: string;
  rfc: string;
  direccionParticular: string;
  direccionEntrega: string;
  mismaDireccion: boolean;
  contactoNombre: string;
  limiteCredito: string;
  diasCredito: string;
  notas: string;
  recibeNotaSinPrecios: boolean;
};

const emptyClientForm: ClientForm = {
  nombre: "",
  telefono: "",
  correo: "",
  rfc: "",
  direccionParticular: "",
  direccionEntrega: "",
  mismaDireccion: true,
  contactoNombre: "",
  limiteCredito: "",
  diasCredito: "",
  notas: "",
  recibeNotaSinPrecios: false,
};

function duplicateClientId(error: unknown): number | null {
  if (!error || typeof error !== "object") return null;
  const data = (error as { data?: unknown }).data;
  if (!data || typeof data !== "object") return null;
  const record = data as Record<string, unknown>;
  return record.code === "CLIENT_NAME_CONFLICT" && typeof record.existingClientId === "number"
    ? record.existingClientId
    : null;
}

function CreateClienteDialog({ open, onClose, canCredit }: { open: boolean; onClose: () => void; canCredit: boolean }) {
  const [form, setForm] = useState<ClientForm>(emptyClientForm);
  const [existingId, setExistingId] = useState<number | null>(null);
  const create = useCreateCliente();
  const queryClient = useQueryClient();
  const set = (field: keyof ClientForm, value: string) =>
    setForm((current) => ({ ...current, [field]: value }));

  const close = () => {
    setForm(emptyClientForm);
    setExistingId(null);
    onClose();
  };
  const submit = () => {
    if (!form.nombre.trim()) {
      toast.error("El nombre es obligatorio.");
      return;
    }
    if (form.limiteCredito.trim() && !form.diasCredito.trim()) {
      toast.error("Los días de crédito son obligatorios al capturar un límite.");
      return;
    }
    setExistingId(null);
    create.mutate({
      data: {
        nombre: form.nombre.trim(),
        telefono: form.telefono.trim() || null,
        correo: form.correo.trim() || null,
        rfc: form.rfc.trim() || null,
        direccionParticular: form.direccionParticular.trim() || null,
        direccionEntrega: form.mismaDireccion ? (form.direccionParticular.trim() || null) : (form.direccionEntrega.trim() || null),
        contactoNombre: form.contactoNombre.trim() || null,
        notas: form.notas.trim() || null,
        recibeNotaSinPrecios: form.recibeNotaSinPrecios,
        ...(form.limiteCredito.trim()
          ? {
              limiteCredito: form.limiteCredito.trim(),
              diasCredito: Number(form.diasCredito),
            }
          : {}),
      },
    }, {
      onSuccess: (client) => {
        queryClient.invalidateQueries({ queryKey: getListClientesQueryKey() });
        toast.success("Cliente creado", { description: client.nombre });
        close();
      },
      onError: (error) => {
        const id = duplicateClientId(error);
        if (id) setExistingId(id);
        else toast.error("No se pudo crear el cliente", {
          description: getApiErrorMessage(error),
        });
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={(value) => !value && close()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Nuevo cliente</DialogTitle>
          <DialogDescription>Registra los datos comerciales del cliente.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2 sm:grid-cols-2">
          <ClientField label="Nombre *" value={form.nombre} onChange={(value) => set("nombre", value)} testId="input-create-client-name" />
          <ClientField label="Teléfono" value={form.telefono} onChange={(value) => set("telefono", value)} />
          <ClientField label="Correo" value={form.correo} onChange={(value) => set("correo", value)} type="email" />
          <ClientField label="RFC" value={form.rfc} onChange={(value) => set("rfc", value)} />

          <ClientField label="Dirección Particular" value={form.direccionParticular} onChange={(value) => {
            set("direccionParticular", value);
            if (form.mismaDireccion) set("direccionEntrega", value);
          }} />

          <div className="space-y-2">
            <Label>Dirección de Entrega</Label>
            <Input
              value={form.mismaDireccion ? form.direccionParticular : form.direccionEntrega}
              onChange={(e) => set("direccionEntrega", e.target.value)}
              disabled={form.mismaDireccion}
            />
            <div className="flex items-center space-x-2 mt-1">
              <input
                type="checkbox"
                id="same-address"
                checked={form.mismaDireccion}
                onChange={(e) => {
                  const checked = e.target.checked;
                  set("mismaDireccion", checked as any);
                  if (checked) set("direccionEntrega", form.direccionParticular);
                }}
                className="rounded border-gray-300"
              />
              <label htmlFor="same-address" className="text-xs text-muted-foreground cursor-pointer">
                La misma que la particular
              </label>
            </div>
          </div>

          <ClientField label="Nombre de contacto" value={form.contactoNombre} onChange={(value) => set("contactoNombre", value)} />
          {canCredit && (
            <>
              <ClientField label="Límite de crédito" value={form.limiteCredito} onChange={(value) => set("limiteCredito", value)} type="number" />
              <ClientField label={`Días de crédito${form.limiteCredito.trim() ? " *" : ""}`} value={form.diasCredito} onChange={(value) => set("diasCredito", value)} type="number" />
            </>
          )}
          <div className="sm:col-span-2">
            <ClientField label="Notas" value={form.notas} onChange={(value) => set("notas", value)} />
          </div>
          <div className="sm:col-span-2 flex items-center space-x-2 rounded-md border p-3">
            <input
              type="checkbox"
              id="create-client-noprices"
              checked={form.recibeNotaSinPrecios}
              onChange={(e) => setForm((c) => ({ ...c, recibeNotaSinPrecios: e.target.checked }))}
              className="rounded border-gray-300"
            />
            <label htmlFor="create-client-noprices" className="text-sm text-foreground cursor-pointer">
              Recibe nota sin precios <span className="text-muted-foreground text-xs font-normal">(Imprime "Nota de Productos" por defecto)</span>
            </label>
          </div>
        </div>
        {existingId && (
          <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950" role="alert">
            <p>Ya existe un cliente activo con ese nombre.</p>
            <Button variant="link" className="h-auto p-0 text-amber-950 underline" asChild>
              <Link href={`/clientes/${existingId}`}>Abrir cliente</Link>
            </Button>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={close}>Cancelar</Button>
          <Button onClick={submit} disabled={create.isPending} data-testid="button-save-client">
            {create.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ClientField({ label, value, onChange, type = "text", testId }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  testId?: string;
}) {
  return <div className="space-y-2"><Label>{label}</Label><Input type={type} value={value} onChange={(event) => onChange(event.target.value)} data-testid={testId} min={type === "number" ? 0 : undefined} /></div>;
}

function DownloadIcon() { return <span aria-hidden="true" className="mr-1">↓</span>; }
function AnalyticsTable({ title, rows }: { title: string; rows: string[][] }) { return <Card><CardHeader><CardTitle>{title}</CardTitle></CardHeader><CardContent>{rows.length ? <div className="space-y-2">{rows.map((row, index) => <div key={`${row[0]}-${index}`} className="grid grid-cols-3 gap-2 border-b py-2 text-sm"><span className="font-medium">{row[0]}</span><span className="text-right">{row[1]}</span><span className="text-right text-muted-foreground">{row[2]}</span></div>)}</div> : <p className="text-muted-foreground">Sin datos para el periodo.</p>}</CardContent></Card>; }

function ClientFinancialCells({ id }: { id: number }) {
  const query = useGetClienteCredito(id, {
    query: { queryKey: getGetClienteCreditoQueryKey(id), staleTime: 30_000 },
  });
  if (query.isLoading) return <><TableCell><Skeleton className="ml-auto h-4 w-16" /></TableCell><TableCell><Skeleton className="ml-auto h-4 w-16" /></TableCell></>;
  if (query.isError) return <><TableCell className="text-right text-muted-foreground">—</TableCell><TableCell className="text-right text-muted-foreground">—</TableCell></>;
  return <><TableCell className="text-right font-mono" data-testid={`text-client-balance-${id}`}>{formatNumber(query.data?.saldoActual, { kind: "money" })}</TableCell><TableCell className="text-right font-mono">{formatNumber(query.data?.creditoDisponible, { kind: "money" })}</TableCell></>;
}

function IncobrablesTab() {
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");

  const { data, isLoading, isError } = useListCuentasIncobrables(
    { fechaDesde: desde || undefined, fechaHasta: hasta || undefined },
    { query: { queryKey: getListCuentasIncobrablesQueryKey({ fechaDesde: desde || undefined, fechaHasta: hasta || undefined }) } }
  );

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle>Cuentas Incobrables</CardTitle>
          <div className="flex items-center gap-2">
            <Input type="date" value={desde} onChange={e => setDesde(e.target.value)} className="w-40" aria-label="Desde" />
            <Input type="date" value={hasta} onChange={e => setHasta(e.target.value)} className="w-40" aria-label="Hasta" />
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : isError ? (
            <p className="text-destructive py-4 text-center">Error al cargar cuentas incobrables.</p>
          ) : (
            <>
              <div className="mb-4">
                <p className="text-sm text-muted-foreground">Total del periodo</p>
                <p className="text-3xl font-bold text-destructive">{formatNumber(data?.total, { kind: "money" })}</p>
              </div>
              <div className="overflow-x-auto border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Ejecutó</TableHead>
                      <TableHead>Autorizó</TableHead>
                      <TableHead>Motivo</TableHead>
                      <TableHead className="text-right">Monto</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(!data?.filas || data.filas.length === 0) ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          No hay cuentas incobrables en este periodo.
                        </TableCell>
                      </TableRow>
                    ) : (
                      data.filas.map((row) => (
                        <TableRow key={row.id}>
                          <TableCell className="whitespace-nowrap">
                            {row.fecha && new Date(row.fecha).toLocaleDateString("es-MX", { dateStyle: "medium" })}
                          </TableCell>
                          <TableCell className="font-medium">
                            <Link href={`/clientes/${row.clienteId}`} className="hover:underline text-primary">
                              {row.cliente}
                            </Link>
                          </TableCell>
                          <TableCell>{row.ejecutadoPor}</TableCell>
                          <TableCell>{row.autorizadoPor}</TableCell>
                          <TableCell className="max-w-[300px] truncate" title={row.motivo}>
                            {row.motivo}
                          </TableCell>
                          <TableCell className="text-right font-mono font-semibold text-destructive">
                            {formatNumber(row.monto, { kind: "money" })}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryPanel({ loading, error, values }: { loading: boolean; error: unknown; values: string[][] }) {
  if (loading) return <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{values.map((_, index) => <Skeleton className="h-28" key={index} />)}</div>;
  if (error) return <Card><CardContent className="p-6 text-destructive">{getApiErrorMessage(error, "No se pudo cargar la información financiera.")}</CardContent></Card>;
  return <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{values.map(([label, value]) => <Card key={label}><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold" data-testid={`metric-${label.toLowerCase().replaceAll(" ", "-")}`}>{value}</p></CardContent></Card>)}</div>;
}