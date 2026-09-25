import { useMemo, useState } from "react";
import { Link } from "wouter";
import { useHistoryEntryState } from "@/lib/internal-navigation";
import { Loader2, Plus } from "lucide-react";
import {
  getGetClientesCarteraQueryKey,
  getGetCurrentUserQueryKey,
  getListClientesQueryKey,
  getListLocationsQueryKey,
  getListCuentasIncobrablesQueryKey,
  LocationType,
  type Location,
  useGetClientesCartera,
  useGetCurrentUser,
  useListLocations,
  useCreateCliente,
  useListCuentasIncobrables,
  useListarComportamientoPagoClientes,
  getListarComportamientoPagoClientesQueryKey,
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
import {
  carteraAuthPartition,
  carteraEffectiveScope,
  carteraScopeContractError,
  carteraScopeKey,
  carteraScopePath,
  carteraScopeQuery,
  downloadClientFile,
} from "@/lib/clientes-api";
import { getGlobalAnalytics } from "@/lib/clientes-api";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { formatNumber } from "@workspace/number-format";
import { toast } from "sonner";
import { CREDIT_TERMS, type ClientCreditTerm } from "@/lib/credit-terms";
import { ClientDirectory } from "@/components/client-directory";

export default function Clientes() {
  const [analyticsMonths, setAnalyticsMonths] = useHistoryEntryState("clientes.analytics-months", "12");
  const [activeTab, setActiveTab] = useHistoryEntryState("clientes.tab", "clientes");
  const [carteraLocationIds, setCarteraLocationIds] = useState<number[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const userQuery = useGetCurrentUser({
    query: {
      queryKey: getGetCurrentUserQueryKey(),
      refetchOnMount: "always",
    },
  });
  const user = userQuery.data;
  const authReady = userQuery.isFetched && !userQuery.isFetching && Boolean(user);
  const canFinances = hasPermission(user, Modules.CLIENTES_FINANZAS, "ver") && user?.rol !== "SUPERVISOR";
  const canCredit = hasPermission(user, Modules.CLIENTES_CREDITO, "ver") && user?.rol !== "SUPERVISOR";
  const canCreate = hasPermission(user, Modules.CLIENTES, "crear");
  const effectiveCarteraScope = carteraEffectiveScope(user);
  const canSelectCarteraScope = effectiveCarteraScope.kind === "UNRESTRICTED";
  const authPartition = carteraAuthPartition(user);
  const locationsQuery = useListLocations(undefined, {
    query: {
      enabled: authReady && canFinances && effectiveCarteraScope.kind !== "INVALID" && canSelectCarteraScope && activeTab === "cartera",
      queryKey: [...getListLocationsQueryKey(), authPartition],
    },
  });
  const invalidCarteraSelection = canSelectCarteraScope && carteraLocationIds.length > 0 &&
    (!locationsQuery.data || locationsQuery.isFetching ||
      carteraLocationIds.some((id) => !locationsQuery.data?.some((site) => site.id === id && site.tipo === LocationType.TIENDA)));
  const carteraScope = useMemo(
    () => (canSelectCarteraScope ? { ubicacionIds: carteraLocationIds } : {}),
    [canSelectCarteraScope, carteraLocationIds],
  );
  const carteraParams = useMemo(() => carteraScopeQuery(carteraScope), [carteraScope]);
  const carteraQuery = useGetClientesCartera(carteraParams, {
    query: {
      enabled: authReady && canFinances && effectiveCarteraScope.kind !== "INVALID" && activeTab === "cartera" && !invalidCarteraSelection,
      queryKey: [...getGetClientesCarteraQueryKey(carteraParams), carteraScopeKey(carteraScope), authPartition],
    },
  });
  const carteraData = carteraQuery.data;
  const carteraScopeError = authReady ? carteraScopeContractError(carteraData, user, carteraScope) : null;
  const carteraReady = Boolean(authReady && !invalidCarteraSelection && carteraData && !carteraQuery.isLoading && !carteraQuery.isError && !carteraScopeError);
  const carteraDisplayData = carteraReady ? carteraData : undefined;
  const carteraError = carteraScopeError
    ?? (invalidCarteraSelection ? "La tienda seleccionada ya no está disponible para Cartera. Elige otra tienda o Global." : null)
    ?? (carteraQuery.isError ? carteraQuery.error : null)
    ?? (userQuery.isError ? userQuery.error : null);
  const carteraLoading = !authReady || userQuery.isFetching || (carteraQuery.isLoading && !invalidCarteraSelection);
  const [exportingCartera, setExportingCartera] = useState(false);
  const exportCartera = async (extension: "xlsx" | "pdf") => {
    if (!carteraReady || exportingCartera) return;
    setExportingCartera(true);
    try {
      await downloadClientFile(
        carteraScopePath(`/clientes/cartera.${extension}`, carteraScope),
        `cartera-clientes.${extension}`,
      );
    } catch (error) {
      toast.error("No se pudo descargar la cartera.", { description: getApiErrorMessage(error) });
    } finally {
      setExportingCartera(false);
    }
  };
  const analyticsPeriod = useMemo(() => { const now = new Date(); const start = new Date(); start.setMonth(start.getMonth() - Number(analyticsMonths)); return { desde: start.toISOString().slice(0, 10), hasta: now.toISOString().slice(0, 10) }; }, [analyticsMonths]);
  const analyticsQuery = useQuery({ queryKey: ["clientes-global-analytics", analyticsPeriod], queryFn: () => getGlobalAnalytics(analyticsPeriod), enabled: canFinances && activeTab === "analisis" });
  const behaviorQuery = useListarComportamientoPagoClientes({
    query: { enabled: canCredit && activeTab === "comportamiento", queryKey: getListarComportamientoPagoClientesQueryKey() },
  });
  const [behaviorColor, setBehaviorColor] = useState("ALL");
  const [behaviorSort, setBehaviorSort] = useState("PERCENTAGE");
  const behaviorRows = useMemo(() => [...(behaviorQuery.data ?? [])]
    .filter((row) => behaviorColor === "ALL" || row.color === behaviorColor)
    .sort((a, b) => behaviorSort === "NAME"
      ? a.clienteNombre.localeCompare(b.clienteNombre, "es")
      : b.percentage - a.percentage), [behaviorColor, behaviorQuery.data, behaviorSort]);

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
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="flex w-full flex-wrap sm:w-auto">
            <TabsTrigger value="clientes" data-testid="tab-clientes">Clientes</TabsTrigger>
            {canFinances && <TabsTrigger value="cartera" data-testid="tab-cartera">Cartera</TabsTrigger>}
            {canFinances && <TabsTrigger value="analisis" data-testid="tab-analysis">Análisis</TabsTrigger>}
            {canCredit && <TabsTrigger value="comportamiento">Comportamiento de pago</TabsTrigger>}
            {user?.rol === "ADMIN" && <TabsTrigger value="incobrables" data-testid="tab-incobrables">Incobrables</TabsTrigger>}
          </TabsList>
          <TabsContent value="clientes" className="space-y-4">
            <ClientDirectory enabled={authReady && activeTab === "clientes"} canFinances={canFinances} isAdmin={user?.rol === "ADMIN"} authPartition={authPartition} />
          </TabsContent>
          <TabsContent value="cartera" className="space-y-4">
            {canSelectCarteraScope && (
              <CarteraScopeSelector
                locations={locationsQuery.data ?? []}
                selectedIds={carteraLocationIds}
                onChange={setCarteraLocationIds}
                loading={locationsQuery.isLoading}
                error={locationsQuery.isError ? locationsQuery.error : null}
              />
            )}
            {carteraScopeError && (
              <p className="text-sm text-destructive" role="alert" data-testid="cartera-scope-error">{carteraScopeError}</p>
            )}
            {carteraDisplayData?.alcance && (
              <p className="text-sm text-muted-foreground" data-testid="cartera-scope-label">
                Alcance: <span className="font-medium text-foreground">{formatCarteraScopeLabel(carteraDisplayData.alcance)}</span>
                {" · "}Generado {new Date(carteraDisplayData.alcance.generadoEn).toLocaleString("es-MX")}
              </p>
            )}
            <SummaryPanel
              loading={carteraLoading}
              error={carteraError}
              values={[
                ["Cartera total", formatNumber(carteraDisplayData?.resumen.totalCartera, { kind: "money" })],
                ["Saldo vencido", formatNumber(carteraDisplayData?.resumen.totalVencido, { kind: "money" })],
                ["Clientes con saldo", String(carteraDisplayData?.resumen.clientesConSaldo ?? 0)],
                [
                  carteraDisplayData?.alcance.tipo === "SITIOS" ? "Clientes con notas en este alcance" : "Clientes activos",
                  String(carteraDisplayData?.resumen.totalClientes ?? 0),
                ],
              ]}
            />
            <Card>
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle>Antigüedad de cartera</CardTitle>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => void exportCartera("xlsx")} disabled={!carteraReady || exportingCartera} data-testid="button-export-client-analytics">
                    <DownloadIcon />Excel
                  </Button>
                </div>
              </CardHeader>
              <CardContent>{carteraLoading ? <Skeleton className="h-24 w-full" /> : carteraError ? <p className="text-destructive" role="alert">{getApiErrorMessage(carteraError, "No se pudo cargar la cartera.")}</p> : <div className="grid gap-3 sm:grid-cols-5">{["POR_VENCER", "1_30", "31_60", "61_90", "MAS_90"].map((bucket) => { const total = (carteraDisplayData?.clientes ?? []).filter((item) => item.antiguedad === bucket).reduce((sum, item) => sum + Number(item.saldoActual), 0); return <div key={bucket} className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">{bucket.replace("_", "–").replace("POR_VENCER", "Por vencer").replace("MAS_90", "+90 días")}</p><p className="mt-1 font-bold">{formatNumber(total, { kind: "money" })}</p></div>; })}</div>}<p className="mt-3 text-sm text-muted-foreground">Agrupa el saldo monetario pendiente por días desde su vencimiento al corte actual. Un cliente se muestra en la categoría de su nota más antigua.</p></CardContent>
            </Card>
            <Card><CardHeader><CardTitle>Clientes con saldo</CardTitle></CardHeader><CardContent>{carteraLoading ? <Skeleton className="h-32 w-full" /> : carteraError ? <p className="text-destructive" role="alert">{getApiErrorMessage(carteraError, "No se pudo cargar la cartera.")}</p> : <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Cliente</TableHead><TableHead>Antigüedad</TableHead><TableHead>Días vencido</TableHead><TableHead className="text-right">Saldo</TableHead></TableRow></TableHeader><TableBody>{(carteraDisplayData?.clientes ?? []).map((item) => <TableRow key={item.id} className={item.diasVencido > 0 ? "bg-amber-50" : ""}><TableCell><Link className="font-medium hover:underline" href={`/clientes/${item.id}`}>{item.nombre}</Link></TableCell><TableCell>{item.antiguedad}</TableCell><TableCell>{item.diasVencido}</TableCell><TableCell className="text-right font-mono">{formatNumber(item.saldoActual, { kind: "money" })}</TableCell></TableRow>)}</TableBody></Table></div>}<p className="mt-3 text-sm text-muted-foreground">Lista el saldo monetario y la antigüedad vigente de cada cliente en el alcance del servidor, sin depender del periodo de análisis.</p></CardContent></Card>
          </TabsContent>
          <TabsContent value="analisis">
            <div className="mb-4 flex justify-end"><Select value={analyticsMonths} onValueChange={setAnalyticsMonths}><SelectTrigger className="w-52"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="3">Últimos 3 meses</SelectItem><SelectItem value="6">Últimos 6 meses</SelectItem><SelectItem value="12">Últimos 12 meses</SelectItem><SelectItem value="24">Últimos 24 meses</SelectItem></SelectContent></Select></div>
            {analyticsQuery.isLoading ? <Skeleton className="h-64 w-full" /> : analyticsQuery.isError ? <p className="text-destructive">No se pudo cargar la analítica.</p> : <div className="space-y-4"><SummaryPanel loading={false} error={null} values={[["Ventas", formatNumber(analyticsQuery.data?.ventas, { kind: "money" })], ["Utilidad", analyticsQuery.data?.margen == null ? "Pendiente" : formatNumber(analyticsQuery.data.margen, { kind: "money" })], ["Tickets", formatNumber(analyticsQuery.data?.tickets, { kind: "count" })], ["ROLLOS · METRO", formatNumber(analyticsQuery.data?.rollosMetros, { kind: "quantity" })], ["ROLLOS · KILO", formatNumber(analyticsQuery.data?.rollosKilos, { kind: "quantity" })], ["METRAJE · METRO", formatNumber(analyticsQuery.data?.metrajeMetros, { kind: "quantity" })]]} /><div className="grid gap-4 lg:grid-cols-2"><AnalyticsTable title="Top por ventas" rows={(analyticsQuery.data?.topVentas ?? []).map((item) => [item.nombre, formatNumber(item.ventas, { kind: "money" }), item.margen == null ? "Pendiente" : formatNumber(item.margen, { kind: "money" })])} /><AnalyticsTable title="Top por utilidad" rows={(analyticsQuery.data?.topMargen ?? []).map((item) => [item.nombre, formatNumber(item.ventas, { kind: "money" }), item.margen == null ? "Pendiente" : formatNumber(item.margen, { kind: "money" })])} /><AnalyticsTable title="Pareto de clientes" rows={(analyticsQuery.data?.pareto ?? []).map((item) => [item.nombre, formatNumber(item.ventas, { kind: "money" }), formatNumber(item.acumulado, { kind: "percentage", percentageInput: "ratio" })])} /><AnalyticsTable title="Público vs registrado" rows={(analyticsQuery.data?.publicoVsRegistrado ?? []).map((item) => [item.segmento, formatNumber(item.ventas, { kind: "money" }), `${formatNumber(item.tickets, { kind: "count" })} tickets`])} /></div><AnalyticsTable title="Evolución mensual" rows={(analyticsQuery.data?.mensual ?? []).map((item) => [item.mes, formatNumber(item.ventas, { kind: "money" }), item.margen == null ? "Pendiente" : formatNumber(item.margen, { kind: "money" })])} />{(analyticsQuery.data?.lineasSinCosto ?? 0) > 0 && <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-900">Costo y utilidad pendientes por {formatNumber(analyticsQuery.data?.lineasSinCosto, { kind: "count" })} línea(s) sin costo congelado.</p>}<Button variant="outline" onClick={() => downloadClientFile(`/clientes/analitica.xlsx?desde=${analyticsPeriod.desde}&hasta=${analyticsPeriod.hasta}`, "analitica-clientes.xlsx")}>Exportar analítica Excel</Button></div>}
          </TabsContent>
          <TabsContent value="comportamiento" className="space-y-4">
            <Card>
              <CardHeader><CardTitle>Comportamiento de pago por cliente</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-3">
                  <Select value={behaviorColor} onValueChange={setBehaviorColor}>
                    <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">Todos los colores</SelectItem>
                      <SelectItem value="GREEN">Verde</SelectItem>
                      <SelectItem value="YELLOW">Amarillo</SelectItem>
                      <SelectItem value="RED">Rojo</SelectItem>
                      <SelectItem value="INSUFFICIENT">Historial insuficiente</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={behaviorSort} onValueChange={setBehaviorSort}>
                    <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="PERCENTAGE">Mayor porcentaje</SelectItem><SelectItem value="NAME">Nombre A–Z</SelectItem></SelectContent>
                  </Select>
                </div>
                {behaviorQuery.isLoading ? <Skeleton className="h-48 w-full" /> : (
                  <div className="overflow-x-auto"><Table>
                    <TableHeader><TableRow><TableHead>Cliente</TableHead><TableHead>Semáforo</TableHead><TableHead>A tiempo / muestra</TableHead><TableHead>Abiertas vigentes</TableHead><TableHead>Vencidas impagas</TableHead><TableHead>Uso límite</TableHead><TableHead>Sugerencia</TableHead></TableRow></TableHeader>
                    <TableBody>{behaviorRows.map((row) => <TableRow key={row.clienteId}>
                      <TableCell><Link href={`/clientes/${row.clienteId}`} className="font-medium text-primary hover:underline">{row.clienteNombre}</Link></TableCell>
                      <TableCell><Badge className={row.color === "GREEN" ? "bg-emerald-600" : row.color === "YELLOW" ? "bg-amber-500" : row.color === "RED" ? "bg-red-600" : "bg-slate-500"}>
                        {row.color === "INSUFFICIENT" ? "Historial insuficiente" : row.color}
                      </Badge></TableCell>
                      <TableCell>{row.percentage}% · {row.onTimeNotes}/{row.evaluatedNotes} notas ({row.settledNotes} liquidadas)</TableCell>
                      <TableCell>{row.openNotDueNotes}</TableCell><TableCell>{row.overdueOpenNotes}</TableCell>
                      <TableCell>{row.utilizationPercent}%</TableCell>
                      <TableCell>{row.suggestCreditIncrease ? row.suggestionReason : "—"}</TableCell>
                    </TableRow>)}</TableBody>
                  </Table></div>
                )}
                <p className="text-sm text-muted-foreground">{behaviorRows[0]?.period ?? "Todo el historial autorizado hasta hoy"}. {behaviorRows[0]?.explanation ?? "Las notas abiertas aún no vencidas se excluyen del porcentaje."}</p>
              </CardContent>
            </Card>
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
        ...(canCredit
          ? {
              limiteCredito: form.limiteCredito.trim() || "0",
              diasCredito: Number(form.diasCredito || 0) as ClientCreditTerm,
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
              <div className="space-y-2">
                <Label>Plazo habitual de crédito</Label>
                <Select value={form.diasCredito || "0"} onValueChange={(value) => set("diasCredito", value)}>
                  <SelectTrigger data-testid="select-create-client-credit-days">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">Sin plazo habitual</SelectItem>
                    {CREDIT_TERMS.map((term) => (
                      <SelectItem key={term} value={String(term)}>{term} días</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
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
function formatCarteraScopeLabel(alcance: { tipo: "GLOBAL" | "SITIOS"; ubicaciones: Array<{ id: number; nombre: string }> }) {
  if (alcance.tipo === "GLOBAL") return "Global";
  const names = alcance.ubicaciones.map((ubicacion) => ubicacion.nombre);
  return names.length === 1 ? `Sitio: ${names[0]}` : `Sitios: ${names.join(", ")}`;
}

function CarteraScopeSelector({
  locations,
  selectedIds,
  onChange,
  loading,
  error,
}: {
  locations: Location[];
  selectedIds: number[];
  onChange: (ids: number[]) => void;
  loading: boolean;
  error: unknown;
}) {
  // The endpoint supplies active sites; type, not the site's name or its active
  // status, determines whether it is a credit store.
  const creditStores = locations.filter((location) => location.tipo === LocationType.TIENDA);
  const toggleLocation = (id: number) => {
    onChange(selectedIds.includes(id) ? selectedIds.filter((current) => current !== id) : [...selectedIds, id].sort((a, b) => a - b));
  };
  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div>
          <p className="text-sm font-medium">Alcance de cartera</p>
          <p className="text-xs text-muted-foreground">Global o uno o más sitios. El servidor valida y aplica el alcance final.</p>
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Seleccionar alcance de cartera">
          <Button type="button" size="sm" variant={selectedIds.length === 0 ? "default" : "outline"} onClick={() => onChange([])} aria-pressed={selectedIds.length === 0} data-testid="cartera-scope-global">
            Global
          </Button>
          {loading ? <Skeleton className="h-9 w-32" /> : creditStores.map((location) => (
            <Button
              key={location.id}
              type="button"
              size="sm"
              variant={selectedIds.includes(location.id) ? "default" : "outline"}
              onClick={() => toggleLocation(location.id)}
              aria-pressed={selectedIds.includes(location.id)}
              data-testid={`cartera-scope-${location.id}`}
            >
              {location.nombre}
            </Button>
          ))}
        </div>
        {Boolean(error) && <p className="text-sm text-destructive" role="alert">{getApiErrorMessage(error, "No se pudieron cargar los sitios.")}</p>}
      </CardContent>
    </Card>
  );
}

function AnalyticsTable({ title, rows }: { title: string; rows: string[][] }) {
  const explanations: Record<string, string> = {
    "Top por ventas": "Ordena clientes por ventas monetarias del periodo elegido; las líneas sin costo siguen contando en ventas.",
    "Top por utilidad": "Ordena clientes por utilidad monetaria del periodo elegido; queda pendiente si alguna línea no tiene costo congelado.",
    "Pareto de clientes": "Ordena ventas monetarias del periodo elegido y calcula el porcentaje acumulado por cliente.",
    "Público vs registrado": "Agrupa tickets y ventas monetarias del periodo elegido entre público y clientes registrados.",
    "Evolución mensual": "Agrupa tickets, ventas y utilidad monetaria por mes dentro del periodo elegido; la utilidad requiere costo congelado.",
  };
  return <Card><CardHeader><CardTitle>{title}</CardTitle></CardHeader><CardContent>{rows.length ? <div className="space-y-2">{rows.map((row, index) => <div key={`${row[0]}-${index}`} className="grid grid-cols-3 gap-2 border-b py-2 text-sm"><span className="font-medium">{row[0]}</span><span className="text-right">{row[1]}</span><span className="text-right text-muted-foreground">{row[2]}</span></div>)}</div> : <p className="text-muted-foreground">Sin datos para el periodo.</p>}<p className="mt-3 text-sm text-muted-foreground">{explanations[title]}</p></CardContent></Card>;
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