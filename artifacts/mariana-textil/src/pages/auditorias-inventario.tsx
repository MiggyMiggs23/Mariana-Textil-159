import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  getGetAuditoriaInventarioQueryKey,
  getListAuditoriasInventarioQueryKey,
  useCancelAuditoriaInventario,
  useCloseAuditoriaInventario,
  useConfirmAuditoriaInventario,
  useCreateAuditoriaInventario,
  useGetAuditoriaInventario,
  useGetCurrentUser,
  useListAuditoriasInventario,
  useListSitiosAuditoriaInventario,
  useScanAuditoriaInventario,
  useListPisosLocation,
  getListRollosQueryKey,
  getListProductosQueryKey,
  getGetExistenciasAgrupadasQueryKey,
} from "@workspace/api-client-react";
import { AlertTriangle, CheckCircle2, Loader2, Printer, ScanLine, XCircle, Play, Shuffle } from "lucide-react";
import { AppLayout } from "@/components/layout/app-layout";
import { CampoEscaneo } from "@/components/campo-escaneo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

function message(error: unknown): string {
  if (error && typeof error === "object" && "data" in error) {
    const data = (error as { data?: { error?: string } }).data;
    if (data?.error) return data.error;
  }
  return "No se pudo completar la operación.";
}

function duration(start: string, end?: string | null): string {
  if (!end) return "En curso";
  const seconds = Math.max(0, Math.round((new Date(end).getTime() - new Date(start).getTime()) / 1000));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours} h ${minutes} min`;
  return `${minutes} min`;
}

export default function AuditoriasInventario() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: user } = useGetCurrentUser();
  const sites = useListSitiosAuditoriaInventario();
  const audits = useListAuditoriasInventario();
  const [siteId, setSiteId] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [scan, setScan] = useState("");
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [selectedPiso, setSelectedPiso] = useState<string>("none");
  const scanRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!siteId && sites.data?.length === 1) setSiteId(String(sites.data[0]!.id));
  }, [siteId, sites.data]);

  useEffect(() => {
    if (selectedId == null && audits.data?.length) {
      setSelectedId(audits.data.find((item) => item.estado === "ABIERTA")?.id ?? audits.data[0]!.id);
    }
  }, [audits.data, selectedId]);

  useEffect(() => {
    setSelectedPiso("none");
  }, [selectedId, siteId]);

  const detail = useGetAuditoriaInventario(selectedId ?? 0, {
    query: {
      enabled: selectedId != null,
      queryKey: getGetAuditoriaInventarioQueryKey(selectedId ?? 0),
      refetchInterval: (query) =>
        query.state.data?.estado === "ABIERTA" ? 3000 : false,
    },
  });

  const { data: pisos } = useListPisosLocation(detail.data?.ubicacionId ?? 0, {
    query: { enabled: !!detail.data?.ubicacionId, queryKey: ['pisosLocation', detail.data?.ubicacionId ?? 0] }
  });
  const pisosActivos = pisos?.filter(p => p.activo) || [];

  const invalidate = async (id?: number) => {
    await queryClient.invalidateQueries({ queryKey: getListAuditoriasInventarioQueryKey() });
    if (id != null) {
      await queryClient.invalidateQueries({ queryKey: getGetAuditoriaInventarioQueryKey(id) });
    }
  };

  const create = useCreateAuditoriaInventario();
  const scanMutation = useScanAuditoriaInventario();
  const close = useCloseAuditoriaInventario();
  const cancel = useCancelAuditoriaInventario();
  const confirm = useConfirmAuditoriaInventario({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListRollosQueryKey() });
        queryClient.invalidateQueries({ queryKey: getListProductosQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetExistenciasAgrupadasQueryKey() });
      }
    }
  });
  const pending = create.isPending || scanMutation.isPending || close.isPending || cancel.isPending || confirm.isPending;

  const grouped = useMemo(() => ({
    CUADRO: detail.data?.resultados.filter((row) => row.clasificacion === "CUADRO") ?? [],
    FALTANTE: detail.data?.resultados.filter((row) => row.clasificacion === "FALTANTE") ?? [],
    SOBRANTE: detail.data?.resultados.filter((row) => row.clasificacion === "SOBRANTE") ?? [],
    MAL_ACOMODADO: detail.data?.resultados.filter((row) => row.clasificacion === "MAL_ACOMODADO") ?? [],
  }), [detail.data]);

  const run = (
    mutation: { mutate: (variables: never, options: { onSuccess: (data: { id: number }) => void; onError: (error: unknown) => void }) => void },
    variables: never,
  ) => mutation.mutate(variables, {
    onSuccess: (data) => {
      setSelectedId(data.id);
      void invalidate(data.id);
    },
    onError: (error) => toast({ title: "Operación rechazada", description: message(error), variant: "destructive" }),
  });

  const print = () => {
    document.body.classList.add("print-auditoria-inventario");
    window.print();
    window.setTimeout(() => document.body.classList.remove("print-auditoria-inventario"), 0);
  };

  return (
    <AppLayout>
    <div className="max-w-[1600px] mx-auto p-4 md:p-6" data-testid="page-auditorias-inventario">
      <header className="no-print flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between mb-8">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-primary/80 mb-1">Operación de Almacén</p>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground">Auditoría de Inventario</h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-xl">
            Control físico concurrente por presencia. Escanea series para conciliar contra el snapshot. El inventario no se afecta hasta la confirmación de un administrador.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
          <Select value={siteId} onValueChange={setSiteId}>
            <SelectTrigger className="w-full sm:w-[260px] bg-card h-11" data-testid="select-audit-site">
              <SelectValue placeholder="Seleccionar sitio" />
            </SelectTrigger>
            <SelectContent>
              {sites.data?.map((site) => <SelectItem key={site.id} value={String(site.id)}>{site.iniciales} · {site.nombre}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button
            data-testid="button-open-audit"
            disabled={!siteId || pending}
            size="lg"
            className="w-full sm:w-auto font-bold shadow-sm h-11"
            onClick={() => create.mutate({ data: { ubicacionId: Number(siteId) } }, {
              onSuccess: (data) => {
                setSelectedId(data.id);
                void invalidate(data.id);
                toast({ title: "Auditoría abierta", description: `${data.folioFormateado} · ${data.totalSnapshot} rollos en snapshot` });
              },
              onError: (error) => toast({ title: "No se pudo abrir", description: message(error), variant: "destructive" }),
            })}
          >
            {create.isPending ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Play className="mr-2 h-5 w-5 fill-current" />}
            Iniciar auditoría
          </Button>
        </div>
      </header>

      {(sites.isLoading || audits.isLoading) && (
        <div className="flex items-center justify-center p-12 text-sm text-muted-foreground bg-card rounded-2xl border border-dashed" data-testid="status-audits-loading">
          <Loader2 className="mr-3 h-6 w-6 animate-spin text-primary" /> Cargando operación...
        </div>
      )}

      {(sites.isError || audits.isError) && (
        <div className="rounded-2xl border border-destructive/40 bg-destructive/5 p-6 text-sm text-destructive flex items-center gap-3" data-testid="status-audits-error">
          <AlertTriangle className="h-5 w-5" /> No se pudieron cargar las auditorías.
        </div>
      )}

      {!audits.isLoading && !audits.isError && audits.data?.length === 0 && (
        <div className="rounded-2xl border border-dashed p-12 text-center bg-card/50" data-testid="status-audits-empty">
          <ScanLine className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-foreground mb-1">No hay auditorías registradas</h3>
          <p className="text-sm text-muted-foreground">Selecciona un sitio y presiona "Iniciar auditoría" para comenzar.</p>
        </div>
      )}

      {audits.data != null && audits.data.length > 0 && (
        <div className="no-print grid grid-cols-1 xl:grid-cols-[340px_minmax(0,1fr)] gap-6 items-start">

          {/* Historial (Left Column) */}
          <div className="flex flex-col gap-4">
            <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1">Historial del Sitio</h2>
            <div className="flex flex-col gap-2 max-h-[calc(100dvh-12rem)] overflow-y-auto pr-1 pb-4 scrollbar-thin">
              {audits.data.map((item) => {
                const isSelected = selectedId === item.id;
                const isAbierta = item.estado === "ABIERTA";
                return (
                  <button
                    key={item.id}
                    type="button"
                    data-testid={`button-audit-${item.id}`}
                    onClick={() => setSelectedId(item.id)}
                    className={`group relative w-full text-left transition-all duration-200 rounded-xl border p-4 ${
                      isSelected
                        ? "border-primary/60 bg-primary/[0.03] shadow-sm ring-1 ring-primary/20"
                        : "border-border/50 bg-card hover:border-primary/30 hover:bg-muted/50"
                    }`}
                  >
                    {isSelected && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-primary rounded-r-full" />}
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className={`font-mono text-base font-bold ${isSelected ? "text-primary" : "text-foreground group-hover:text-primary transition-colors"}`}>
                        {item.folioFormateado}
                      </span>
                      <Badge variant={isAbierta ? "default" : "secondary"} className={`text-[10px] px-1.5 py-0 uppercase tracking-wider ${isAbierta && !isSelected ? "bg-primary/80" : ""}`}>
                        {item.estado}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground font-medium truncate pr-2">{item.nombreUbicacion}</span>
                      <span className="font-mono font-semibold text-foreground/80 bg-background px-2 py-0.5 rounded-md border shadow-sm">
                        {item.totalEscaneados}/{item.totalSnapshot}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Active Audit (Right Column) */}
          <section className="flex flex-col gap-6 min-w-0">
            {detail.isLoading && (
              <div className="flex items-center justify-center p-12 rounded-2xl bg-card border border-dashed" data-testid="status-audit-detail-loading">
                <Loader2 className="h-6 w-6 animate-spin text-primary mr-3" /> <span className="text-sm font-medium text-muted-foreground">Actualizando conteo...</span>
              </div>
            )}

            {detail.isError && (
              <div className="rounded-2xl border border-destructive/40 bg-destructive/5 p-6 text-destructive flex items-center gap-3" data-testid="status-audit-detail-error">
                <AlertTriangle className="h-5 w-5" /> {message(detail.error)}
              </div>
            )}

            {detail.data && (
              <>
                {/* Header Card */}
                <Card className="overflow-hidden border-border/60 shadow-sm rounded-2xl">
                  <div className="bg-muted/30 p-5 lg:p-6 border-b border-border/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-3 mb-1.5">
                        <h2 className="font-mono text-2xl font-black tracking-tight text-foreground" data-testid="text-audit-folio">{detail.data.folioFormateado}</h2>
                        <Badge variant={detail.data.estado === "ABIERTA" ? "default" : "secondary"} className="text-[11px] font-bold tracking-widest uppercase px-2 py-0.5" data-testid="status-audit-state">
                          {detail.data.estado === "ABIERTA" ? "EN CURSO" : detail.data.estado}
                        </Badge>
                      </div>
                      <p className="text-sm font-medium text-muted-foreground">{detail.data.nombreUbicacion} · Iniciada por {detail.data.creadaPor}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button variant="outline" size="sm" className="h-9 font-medium" data-testid="button-print-audit" onClick={print}>
                        <Printer className="mr-2 h-4 w-4" /> Imprimir
                      </Button>
                      {detail.data.estado === "ABIERTA" && (
                        <>
                          <Button variant="outline" size="sm" className="h-9 font-medium text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/20" data-testid="button-cancel-audit" onClick={() => setCancelOpen(true)}>
                            Cancelar
                          </Button>
                          <Button size="sm" variant="secondary" className="h-9 font-bold bg-foreground text-background hover:bg-foreground/90 shadow-sm" data-testid="button-close-audit" disabled={pending} onClick={() => run(close as never, { id: detail.data!.id } as never)}>
                            Cerrar Conteo
                          </Button>
                        </>
                      )}
                      {detail.data.estado === "CERRADA" && user?.rol === "ADMIN" && (
                        <Button size="sm" className="h-9 font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm" data-testid="button-confirm-audit" disabled={pending} onClick={() => run(confirm as never, { id: detail.data!.id } as never)}>
                          <CheckCircle2 className="mr-2 h-4 w-4" /> Confirmar y aplicar
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Progress & KPIs */}
                  <div className="p-5 lg:p-6 bg-card">
                    <div className="mb-8">
                      <div className="flex justify-between items-end mb-3">
                        <span className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Avance del conteo</span>
                        <div className="text-right">
                          <span className="text-3xl font-mono font-black text-foreground">
                            <span data-testid="metric-escaneados">{detail.data.totalEscaneados}</span>
                          </span>
                          <span className="text-lg font-mono font-medium text-muted-foreground ml-1">
                            / <span data-testid="metric-snapshot">{detail.data.totalSnapshot}</span>
                          </span>
                        </div>
                      </div>
                      <div className="h-4 w-full bg-secondary rounded-full overflow-hidden shadow-inner ring-1 ring-inset ring-border/50">
                        <div className="h-full bg-primary transition-all duration-500 ease-out" style={{ width: `${Math.min(100, (detail.data.totalEscaneados / (detail.data.totalSnapshot || 1)) * 100)}%` }} />
                      </div>
                      <p className="text-[11px] font-medium text-muted-foreground mt-3 flex flex-wrap gap-x-4 gap-y-1" data-testid="text-audit-duration">
                        <span><strong className="text-foreground/70 uppercase">Inicio:</strong> {new Date(detail.data.abiertaAt).toLocaleString("es-MX")}</span>
                        {detail.data.cerradaAt && <span><strong className="text-foreground/70 uppercase">Cierre:</strong> {new Date(detail.data.cerradaAt).toLocaleString("es-MX")}</span>}
                        <span><strong className="text-foreground/70 uppercase">Duración:</strong> <span className="font-mono text-foreground">{duration(detail.data.abiertaAt, detail.data.cerradaAt)}</span></span>
                      </p>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
                      {/* Cuadros */}
                      <div className="flex flex-col p-4 md:p-5 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30">
                        <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 mb-2">
                          <CheckCircle2 className="h-4 w-4 md:h-5 md:w-5" />
                          <span className="text-[11px] md:text-xs font-bold uppercase tracking-widest">Cuadro</span>
                        </div>
                        <span className="text-3xl md:text-4xl font-mono font-black text-emerald-800 dark:text-emerald-300 tracking-tighter" data-testid="metric-cuadro">{detail.data.cuadros}</span>
                      </div>
                      {/* Faltantes */}
                      <div className="flex flex-col p-4 md:p-5 rounded-2xl bg-rose-50/50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/30">
                        <div className="flex items-center gap-2 text-rose-700 dark:text-rose-400 mb-2">
                          <XCircle className="h-4 w-4 md:h-5 md:w-5" />
                          <span className="text-[11px] md:text-xs font-bold uppercase tracking-widest">Faltantes</span>
                        </div>
                        <span className="text-3xl md:text-4xl font-mono font-black text-rose-800 dark:text-rose-300 tracking-tighter" data-testid="metric-faltantes">{detail.data.faltantes}</span>
                      </div>
                      {/* Sobrantes */}
                      <div className="flex flex-col p-4 md:p-5 rounded-2xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/30">
                        <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 mb-2">
                          <AlertTriangle className="h-4 w-4 md:h-5 md:w-5" />
                          <span className="text-[11px] md:text-xs font-bold uppercase tracking-widest">Sobrantes</span>
                        </div>
                        <span className="text-3xl md:text-4xl font-mono font-black text-amber-800 dark:text-amber-300 tracking-tighter" data-testid="metric-sobrantes">{detail.data.sobrantes}</span>
                      </div>
                      {/* Mal Acomodados */}
                      <div className="flex flex-col p-4 md:p-5 rounded-2xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/30">
                        <div className="flex items-center gap-2 text-blue-700 dark:text-blue-400 mb-2">
                          <Shuffle className="h-4 w-4 md:h-5 md:w-5" />
                          <span className="text-[11px] md:text-xs font-bold uppercase tracking-widest">Mal Acomodado</span>
                        </div>
                        <span className="text-3xl md:text-4xl font-mono font-black text-blue-800 dark:text-blue-300 tracking-tighter" data-testid="metric-mal-acomodados">{detail.data.malAcomodados || 0}</span>
                      </div>
                    </div>
                  </div>
                </Card>

                {/* Scanner Area */}
                {detail.data.estado === "ABIERTA" && (
                  <div className="sticky top-4 z-20 rounded-2xl bg-card shadow-lg ring-1 ring-primary/20 overflow-hidden transform transition-all">
                    <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent pointer-events-none" />
                    <div className="relative p-5 md:p-6">
                      <div className="flex flex-col sm:flex-row gap-4 mb-3 items-start sm:items-center justify-between">
                        <label className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-primary" htmlFor="audit-scan">
                          <ScanLine className="h-5 w-5" /> Escanear Serie o QR
                        </label>
                        {pisosActivos.length > 0 && (
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Piso Real:</span>
                            <Select value={selectedPiso} onValueChange={setSelectedPiso}>
                              <SelectTrigger className="h-8 w-[160px] text-xs font-bold bg-background">
                                <SelectValue placeholder="Sin piso" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">Sin piso</SelectItem>
                                {pisosActivos.map(p => (
                                  <SelectItem key={p.id} value={p.id.toString()}>{p.nombre}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                      </div>
                      <CampoEscaneo
                        id="audit-scan"
                        ref={scanRef}
                        value={scan}
                        onChange={setScan}
                        disabled={scanMutation.isPending || (pisosActivos.length > 0 && selectedPiso === "none")}
                        data-testid="input-audit-scan"
                        placeholder={pisosActivos.length > 0 && selectedPiso === "none" ? "Selecciona un piso antes de escanear" : "Serie o SKU-SERIE; Enter para registrar"}
                        className="h-16 font-mono text-2xl shadow-inner bg-background/50 focus-visible:bg-background border-primary/30 focus-visible:border-primary transition-colors"
                        onScan={async (serie) => {
                          await scanMutation.mutateAsync({ id: detail.data!.id, data: { serie, pisoId: selectedPiso === "none" ? null : Number(selectedPiso) } }, {
                            onSuccess: (result) => {
                              void invalidate(detail.data!.id);
                              toast({
                                title: result.duplicado ? "Serie ya registrada" : "Presencia registrada",
                                description: `${result.serie} · ${result.clasificacion} · ${result.estadoActual}`,
                              });
                            },
                            onError: (error) => toast({ title: "Escaneo rechazado", description: message(error), variant: "destructive" }),
                          });
                        }}
                      />
                    </div>
                  </div>
                )}

                {/* Results Tables */}
                <div className="space-y-8 mt-2">
                  {(["FALTANTE", "SOBRANTE", "CUADRO", "MAL_ACOMODADO"] as const).map((kind) => {
                    const isFaltante = kind === "FALTANTE";
                    const isSobrante = kind === "SOBRANTE";
                    const isCuadro = kind === "CUADRO";
                    const isMalAcomodado = kind === "MAL_ACOMODADO";
                    const items = grouped[kind];

                    if (items.length === 0 && (isCuadro || isMalAcomodado)) return null;

                    return (
                      <div key={kind} className="flex flex-col gap-3">
                        <div className="flex items-center justify-between border-b pb-2">
                          <h3 className={`flex items-center gap-2 text-sm font-bold uppercase tracking-widest ${isFaltante ? "text-rose-600 dark:text-rose-400" : isSobrante ? "text-amber-600 dark:text-amber-400" : isMalAcomodado ? "text-blue-600 dark:text-blue-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                            {isFaltante ? <XCircle className="h-4 w-4" /> : isSobrante ? <AlertTriangle className="h-4 w-4" /> : isMalAcomodado ? <Shuffle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                            {kind.replace('_', ' ')}
                          </h3>
                          <Badge variant="secondary" className="font-mono text-xs px-2">{items.length}</Badge>
                        </div>

                        {items.length === 0 ? (
                          <div className="p-8 text-center rounded-2xl border border-dashed text-sm font-medium text-muted-foreground bg-muted/10" data-testid={`status-${kind.toLowerCase()}-empty`}>
                            No hay registros en esta categoría.
                          </div>
                        ) : (
                          <div className="border rounded-2xl overflow-hidden bg-card shadow-sm">
                            <div className="overflow-x-auto">
                              <Table>
                                <TableHeader className="bg-muted/40">
                                  <TableRow className="hover:bg-transparent border-b-border/60">
                                    <TableHead className="w-[140px] font-semibold">Serie</TableHead>
                                    <TableHead className="font-semibold">Producto</TableHead>
                                    <TableHead className="w-[120px] text-right font-semibold">Cantidad</TableHead>
                                    {isMalAcomodado && (
                                      <TableHead className="w-[140px] font-semibold">Piso Esperado</TableHead>
                                    )}
                                    <TableHead className="w-[180px] font-semibold">{isMalAcomodado ? "Piso Real" : "Ubicación actual"}</TableHead>
                                    <TableHead className="w-[140px] font-semibold">Estado</TableHead>
                                    <TableHead className="w-[160px] font-semibold">Resolución</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {items.map((row) => (
                                    <TableRow key={row.serie} data-testid={`row-audit-result-${row.serie}`} className="group border-b-border/40 last:border-0">
                                      <TableCell className="font-mono font-bold text-[13px]">{row.serie}</TableCell>
                                      <TableCell className="text-[13px]">{row.producto ?? <span className="text-muted-foreground italic">Sin registro</span>}</TableCell>
                                      <TableCell className="font-mono text-right text-[13px]">{row.cantidad ?? "—"} <span className="text-[10px] text-muted-foreground ml-1">{row.unidad ?? ""}</span></TableCell>
                                      {isMalAcomodado && (
                                        <TableCell className="text-[13px]">{row.pisoEsperado ?? <span className="text-muted-foreground italic">Sin piso</span>}</TableCell>
                                      )}
                                      <TableCell className="text-[13px]">{isMalAcomodado ? (row.pisoReal ?? <span className="text-muted-foreground italic">Desconocido</span>) : (row.ubicacionActual ?? <span className="text-muted-foreground italic">Desconocida</span>)}</TableCell>
                                      <TableCell>
                                        <Badge variant="outline" className="bg-background text-[10px] uppercase tracking-wider">{row.estadoActual}</Badge>
                                      </TableCell>
                                      <TableCell className="text-[13px] font-medium text-muted-foreground">{row.resolucion.replaceAll("_", " ")}</TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </section>
        </div>
      )}

      {/* Print View */}
      {detail.data && (
        <article className="audit-inventory-print print-only bg-white text-black" data-testid="document-audit-print">
          <header className="border-b-2 border-black pb-3">
            <div className="text-sm font-bold uppercase tracking-widest">Mariana Textil · Auditoría de Inventario</div>
            <h1 className="mt-1 text-2xl font-bold">{detail.data.folioFormateado}</h1>
            <div>{detail.data.nombreUbicacion} · Estado: {detail.data.estado}</div>
            <div className="text-sm">Apertura: {new Date(detail.data.abiertaAt).toLocaleString("es-MX")} · Cierre: {detail.data.cerradaAt ? new Date(detail.data.cerradaAt).toLocaleString("es-MX") : "En curso"} · Duración: {duration(detail.data.abiertaAt, detail.data.cerradaAt)}</div>
          </header>
          <div className="my-3 grid grid-cols-6 gap-2 text-center text-sm">
            <div>Snapshot<br /><b>{detail.data.totalSnapshot}</b></div><div>Escaneados<br /><b>{detail.data.totalEscaneados}</b></div><div>Cuadro<br /><b>{detail.data.cuadros}</b></div><div>Faltante<br /><b>{detail.data.faltantes}</b></div><div>Sobrante<br /><b>{detail.data.sobrantes}</b></div><div>Mal Acomodado<br /><b>{detail.data.malAcomodados || 0}</b></div>
          </div>
          {(["CUADRO", "FALTANTE", "SOBRANTE", "MAL_ACOMODADO"] as const).map((kind) => <section key={kind} className="mb-4"><h2 className="border-b border-black font-bold">{kind.replace('_', ' ')} ({grouped[kind].length})</h2>{grouped[kind].map((row) => <div key={row.serie} className={`grid ${kind === "MAL_ACOMODADO" ? "grid-cols-[100px_1fr_100px_120px_120px_100px]" : "grid-cols-[100px_1fr_100px_130px_100px]"} border-b py-1 text-xs`}><b>{row.serie}</b><span>{row.producto ?? "Sin registro"}</span><span>{row.cantidad ?? "—"} {row.unidad ?? ""}</span>{kind === "MAL_ACOMODADO" ? <><span>Esperado: {row.pisoEsperado ?? "Sin piso"}</span><span>Real: {row.pisoReal ?? "Desconocido"}</span></> : <span>{row.ubicacionActual ?? "Sin ubicación"}</span>}<span>{row.estadoActual}</span></div>)}</section>)}
          <section><h2 className="font-bold">Participantes</h2>{detail.data.participantes.map((person) => <div key={person.usuarioId} className="text-sm">{person.nombre}: {person.escaneos} escaneos</div>)}</section>
          <footer className="mt-14 grid grid-cols-2 gap-16 text-center text-sm"><div className="border-t border-black pt-2">Responsable de conteo</div><div className="border-t border-black pt-2">Autorización ADMIN</div></footer>
        </article>
      )}

      {/* Cancel Dialog */}
      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl text-destructive flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" /> Cancelar auditoría
            </DialogTitle>
            <DialogDescription className="text-base">
              La cancelación detendrá el conteo y <strong>no modificará el inventario</strong>. Registra un motivo verificable.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Textarea
              data-testid="input-audit-cancel-reason"
              value={cancelReason}
              onChange={(event) => setCancelReason(event.target.value)}
              placeholder="Motivo de cancelación (mínimo 10 caracteres)..."
              className="min-h-[100px] resize-none text-base"
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" data-testid="button-dismiss-audit-cancel" onClick={() => setCancelOpen(false)}>Volver</Button>
            <Button variant="destructive" data-testid="button-confirm-audit-cancel" disabled={cancelReason.trim().length < 10 || cancel.isPending} onClick={() => cancel.mutate({ id: detail.data!.id, data: { motivo: cancelReason.trim() } }, {
              onSuccess: (data) => {
                setCancelOpen(false);
                setCancelReason("");
                void invalidate(data.id);
              },
              onError: (error) => toast({ title: "No se pudo cancelar", description: message(error), variant: "destructive" }),
            })}>
              {cancel.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <XCircle className="mr-2 h-4 w-4" />}
              Cancelar auditoría
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </AppLayout>
  );
}
