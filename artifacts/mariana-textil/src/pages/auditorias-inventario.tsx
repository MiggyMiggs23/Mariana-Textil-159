import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useSearch } from "wouter";
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
  getGetReactivacionFaltanteQueryOptions,
  useCreateProducto,
  useListProductos,
  type AuditoriaSobranteContexto,
  type ReactivacionFaltanteContexto,
} from "@workspace/api-client-react";
import { PrintableDocumentHeader } from "@/components/printable-document-header";
import { absoluteAppUrl, printWhenReady } from "@/lib/print";
import { AlertTriangle, CheckCircle2, Loader2, Printer, ScanLine, XCircle, Play, Shuffle, Plus, Settings, Info } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { hasPermission, Modules } from "@/lib/permisos";
import { formatNumber, formatUnit } from "@workspace/number-format";
import { AuditoriaSobranteResolutionDialog } from "@/components/auditoria/auditoria-sobrante-resolution-dialog";
import { ReactivacionFaltanteDialog } from "@/components/auditoria/reactivacion-faltante-dialog";
import { AuditoriaInventarioPrint } from "@/components/auditoria-inventario-print";
import { ApiErrorDetails } from "@/lib/api-error";

function message(error: unknown): string {
  if (error && typeof error === "object" && "data" in error) {
    const data = (error as { data?: { error?: string } }).data;
    if (data?.error) return data.error;
  }
  if (error instanceof Error) return error.message;
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
  const search = useSearch();
  const sites = useListSitiosAuditoriaInventario();
  const audits = useListAuditoriasInventario();
  const [siteId, setSiteId] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(() => {
    const requested = Number(
      new URLSearchParams(window.location.search).get("auditoriaId"),
    );
    return Number.isInteger(requested) && requested > 0 ? requested : null;
  });
  const [scan, setScan] = useState("");
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [selectedPiso, setSelectedPiso] = useState<string>("none");
  const [addColorOpen, setAddColorOpen] = useState(false);
  const [addColorTela, setAddColorTela] = useState("");
  const [addColor, setAddColor] = useState("");
  const scanRef = useRef<HTMLInputElement>(null);
  const canCreateProduct = hasPermission(user, Modules.PRODUCTOS, "crear");
  const products = useListProductos({}, {
    query: {
      enabled: canCreateProduct,
      queryKey: getListProductosQueryKey(),
    },
  });
  const createProduct = useCreateProducto();
  const [resolvingSobrante, setResolvingSobrante] = useState<{ serie: string; contexto: AuditoriaSobranteContexto } | null>(null);
  const [reactivacionContexto, setReactivacionContexto] = useState<{
    rolloId: number;
    contexto: ReactivacionFaltanteContexto;
  } | null>(null);
  const [isFetchingReactivacion, setIsFetchingReactivacion] = useState<number | null>(null);

  const handleFetchReactivacion = async (rolloId: number, auditoriaOrigenId: number) => {
    setIsFetchingReactivacion(rolloId);
    try {
      const result = await queryClient.fetchQuery(
        getGetReactivacionFaltanteQueryOptions(rolloId),
      );
      if (result.elegible && result.auditoriaOrigenId === auditoriaOrigenId) {
        setReactivacionContexto({ rolloId, contexto: result });
      } else {
        toast({
          title: "Rollo no elegible para reactivación",
          description:
            result.bloqueo ||
            "La baja verificable no pertenece a esta auditoría.",
          variant: "destructive",
        });
      }
    } catch (err: unknown) {
      toast({
        title: "No se pudo verificar la reactivación",
        description: <ApiErrorDetails error={err} />,
        variant: "destructive",
      });
    } finally {
      setIsFetchingReactivacion(null);
    }
  };

  useEffect(() => {
    if (!siteId && sites.data?.length === 1) setSiteId(String(sites.data[0]!.id));
  }, [siteId, sites.data]);

  useEffect(() => {
    const requested = Number(new URLSearchParams(search).get("auditoriaId"));
    if (Number.isInteger(requested) && requested > 0 && requested !== selectedId) {
      setSelectedId(requested);
    }
  }, [search, selectedId]);

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

  useEffect(() => {
    if (detail.data && siteId !== String(detail.data.ubicacionId)) {
      setSiteId(String(detail.data.ubicacionId));
    }
  }, [detail.data, siteId]);

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
    void printWhenReady("print-auditoria-inventario");
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
                        {canCreateProduct && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            data-testid="button-audit-add-product-color"
                            onClick={() => setAddColorOpen(true)}
                          >
                            <Plus className="mr-2 h-4 w-4" /> Alta de color
                          </Button>
                        )}
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

                    const ordinaryItems = isSobrante ? items.filter((row: any) => row.sobrante?.caso !== "VENDIDO_FISICAMENTE_AQUI" && row.sobrante?.caso !== "SIN_REGISTRO_PREVIO") : items;
                    const soldItems = isSobrante ? items.filter((row: any) => row.sobrante?.caso === "VENDIDO_FISICAMENTE_AQUI") : [];
                    const unknownItems = isSobrante ? items.filter((row: any) => row.sobrante?.caso === "SIN_REGISTRO_PREVIO") : [];

                    return (
                      <div key={kind} className="flex flex-col gap-3">
                        <div className="flex items-center justify-between border-b pb-2">
                          <h3 className={`flex items-center gap-2 text-sm font-bold uppercase tracking-widest ${isFaltante ? "text-rose-600 dark:text-rose-400" : isSobrante ? "text-amber-600 dark:text-amber-400" : isMalAcomodado ? "text-blue-600 dark:text-blue-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                            {isFaltante ? <XCircle className="h-4 w-4" /> : isSobrante ? <AlertTriangle className="h-4 w-4" /> : isMalAcomodado ? <Shuffle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                            {kind.replace('_', ' ')}
                          </h3>
                          <Badge variant="secondary" className="font-mono text-xs px-2">{items.length}</Badge>
                        </div>

                        {soldItems.length > 0 && (
                          <div className="border border-destructive/30 bg-destructive/5 rounded-2xl overflow-hidden shadow-sm mb-4">
                            <div className="bg-destructive/10 px-4 py-3 border-b border-destructive/20 flex items-center gap-3">
                              <AlertTriangle className="text-destructive w-5 h-5 shrink-0" />
                              <div className="flex-1">
                                <h4 className="text-destructive font-bold text-sm">Riesgo Financiero: Vendidos Físicamente Aquí</h4>
                                <p className="text-xs text-destructive/80 font-medium">Rollos facturados a clientes pero aún en el almacén. Riesgo de doble entrega.</p>
                              </div>
                            </div>
                            <div className="p-0">
                              <Table>
                                <TableHeader className="bg-transparent">
                                  <TableRow className="hover:bg-transparent border-b-border/60">
                                    <TableHead className="w-[140px] font-semibold">Serie</TableHead>
                                    <TableHead className="font-semibold">Producto</TableHead>
                                    <TableHead className="w-[120px] text-right font-semibold">Cantidad</TableHead>
                                    <TableHead className="w-[200px] font-semibold">Documentos</TableHead>
                                    <TableHead className="w-[160px] font-semibold">Resolución</TableHead>
                                    {user?.rol === "ADMIN" && <TableHead className="w-[110px] text-right"></TableHead>}
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {soldItems.map((r) => {
                                    const row = r;
                                    const sobrante = row.sobrante!;
                                    return (
                                      <TableRow key={row.serie} data-testid={`row-audit-result-sold-${row.serie}`} className="border-b-border/40 last:border-0 hover:bg-transparent">
                                        <TableCell className="font-mono font-bold text-[13px]">{row.serie}</TableCell>
                                        <TableCell className="text-[13px]">{row.producto}</TableCell>
                                        <TableCell className="font-mono text-right text-[13px]">{row.cantidad != null ? formatNumber(row.cantidad, { kind: "quantity" }) : '-'} <span className="text-[10px] text-muted-foreground ml-1">{row.unidad ? formatUnit(row.unidad) : ""}</span></TableCell>
                                        <TableCell className="text-xs">
                                          {sobrante.documentos?.length > 0 ? (
                                            <div className="flex flex-col gap-1">
                                              {sobrante.documentos.map((doc, idx) => (
                                                <a key={idx} href={doc.href} target="_blank" rel="noreferrer" className="text-primary hover:underline font-medium truncate max-w-[180px]">
                                                  {doc.tipo}: {doc.folio}
                                                </a>
                                              ))}
                                            </div>
                                          ) : (
                                            <span className="text-muted-foreground italic">Sin documentos</span>
                                          )}
                                        </TableCell>
                                        <TableCell className="text-[13px] font-medium text-muted-foreground">
                                          <div className="flex flex-col gap-0.5">
                                            <span className={sobrante.estadoResolucion === 'PENDIENTE' ? 'text-amber-600' : 'text-emerald-600'}>{sobrante.estadoResolucion.replaceAll("_", " ")}</span>
                                            {sobrante.historial?.length > 0 && <span className="text-[10px] text-muted-foreground truncate max-w-[120px]" title={sobrante.historial[0].decision}>{sobrante.historial[0].decision}</span>}
                                          </div>
                                        </TableCell>
                                        {user?.rol === "ADMIN" && (
                                          <TableCell className="text-right">
                                            {sobrante.estadoResolucion !== "RESUELTO" && (
                                              <Button
                                                variant="outline"
                                                size="sm"
                                                className="h-7 text-xs font-semibold border-destructive text-destructive hover:bg-destructive hover:text-white"
                                                onClick={() => setResolvingSobrante({ serie: row.serie, contexto: sobrante })}
                                                disabled={detail.data?.estado !== "CONFIRMADA"}
                                              >
                                                Resolver
                                              </Button>
                                            )}
                                          </TableCell>
                                        )}
                                      </TableRow>
                                    );
                                  })}
                                </TableBody>
                              </Table>
                            </div>
                          </div>
                        )}

                        {unknownItems.length > 0 && (
                          <div className="border border-amber-200 dark:border-amber-900/40 bg-amber-50 dark:bg-amber-950/20 rounded-2xl overflow-hidden shadow-sm mb-4">
                            <div className="bg-amber-100/50 dark:bg-amber-900/30 px-4 py-3 border-b border-amber-200 dark:border-amber-900/40 flex items-center gap-3">
                              <Info className="text-amber-600 dark:text-amber-400 w-5 h-5 shrink-0" />
                              <div className="flex-1">
                                <h4 className="text-amber-800 dark:text-amber-300 font-bold text-sm">Series Sin Registro</h4>
                                <p className="text-xs text-amber-700/80 dark:text-amber-400/80 font-medium">Sólo se conserva la serie escaneada; no se inventan producto, cantidad, origen ni alta.</p>
                              </div>
                            </div>
                            <div className="p-0">
                              <Table>
                                <TableHeader className="bg-transparent">
                                  <TableRow className="hover:bg-transparent border-b-amber-200 dark:border-b-amber-900/40">
                                    <TableHead className="w-[140px] font-semibold text-amber-900 dark:text-amber-300">Serie</TableHead>
                                    <TableHead className="w-[160px] font-semibold text-amber-900 dark:text-amber-300">Resolución</TableHead>
                                    {user?.rol === "ADMIN" && <TableHead className="w-[110px] text-right"></TableHead>}
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {unknownItems.map((r) => {
                                    const row = r;
                                    const sobrante = row.sobrante!;
                                    return (
                                      <TableRow key={row.serie} data-testid={`row-audit-result-unknown-${row.serie}`} className="border-b-amber-200 dark:border-b-amber-900/40 last:border-0 hover:bg-transparent">
                                        <TableCell className="font-mono font-bold text-[13px] text-amber-900 dark:text-amber-200">{row.serie}</TableCell>
                                        <TableCell className="text-[13px] font-medium text-amber-700 dark:text-amber-400">
                                          <div className="flex flex-col gap-0.5">
                                            <span className={sobrante.estadoResolucion === 'PENDIENTE' ? 'font-bold' : ''}>{sobrante.estadoResolucion.replaceAll("_", " ")}</span>
                                            {sobrante.historial?.length > 0 && <span className="text-[10px] opacity-80 truncate max-w-[120px]" title={sobrante.historial[0].decision}>{sobrante.historial[0].decision}</span>}
                                          </div>
                                        </TableCell>
                                        {user?.rol === "ADMIN" && (
                                          <TableCell className="text-right">
                                            {sobrante.estadoResolucion !== "RESUELTO" && (
                                              <Button
                                                variant="outline"
                                                size="sm"
                                                className="h-7 text-xs font-semibold border-amber-300 text-amber-700 hover:bg-amber-100"
                                                onClick={() => setResolvingSobrante({ serie: row.serie, contexto: sobrante })}
                                                disabled={detail.data?.estado !== "CONFIRMADA"}
                                              >
                                                Resolver
                                              </Button>
                                            )}
                                          </TableCell>
                                        )}
                                      </TableRow>
                                    );
                                  })}
                                </TableBody>
                              </Table>
                            </div>
                          </div>
                        )}

                        {ordinaryItems.length === 0 ? (
                          soldItems.length === 0 && unknownItems.length === 0 ? (
                          <div className="p-8 text-center rounded-2xl border border-dashed text-sm font-medium text-muted-foreground bg-muted/10" data-testid={`status-${kind.toLowerCase()}-empty`}>
                            No hay registros en esta categoría.
                          </div>
                          ) : null
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
                                    {(isSobrante || isFaltante) && user?.rol === "ADMIN" && (
                                      <TableHead className="w-[110px] text-right"></TableHead>
                                    )}
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {ordinaryItems.map((r) => {
                                    const row = r;
                                    const sobrante = row.sobrante;

                                    return (
                                      <TableRow key={row.serie} data-testid={`row-audit-result-${row.serie}`} className="group border-b-border/40 last:border-0">
                                        <TableCell className="py-2">
                                          <div className="font-mono font-bold text-[13px]">{row.serie}</div>
                                        </TableCell>
                                        <TableCell className="text-[13px]">{row.producto ?? <span className="text-muted-foreground italic">Sin registro</span>}</TableCell>
                                        <TableCell className="font-mono text-right text-[13px]">{row.cantidad != null ? formatNumber(row.cantidad, { kind: "quantity" }) : '-'} <span className="text-[10px] text-muted-foreground ml-1">{row.unidad ? formatUnit(row.unidad) : ""}</span></TableCell>
                                        {isMalAcomodado && (
                                          <TableCell className="text-[13px]">{row.pisoEsperado ?? <span className="text-muted-foreground italic">Sin piso</span>}</TableCell>
                                        )}
                                        <TableCell className="text-[13px]">{isMalAcomodado ? (row.pisoReal ?? <span className="text-muted-foreground italic">Desconocido</span>) : (row.ubicacionActual ?? <span className="text-muted-foreground italic">Desconocida</span>)}</TableCell>
                                        <TableCell>
                                          <Badge variant="outline" className="bg-background text-[10px] uppercase tracking-wider">{row.estadoActual}</Badge>
                                        </TableCell>
                                        <TableCell className="text-[13px] font-medium text-muted-foreground">
                                        {sobrante ? (
                                          <div className="flex flex-col gap-0.5">
                                            <span className={sobrante.estadoResolucion === 'PENDIENTE' ? 'text-amber-600' : 'text-emerald-600'}>{sobrante.estadoResolucion.replaceAll("_", " ")}</span>
                                            {sobrante.historial?.length > 0 && <span className="text-[10px] text-muted-foreground truncate max-w-[120px]" title={sobrante.historial[0].decision}>{sobrante.historial[0].decision}</span>}
                                          </div>
                                        ) : (
                                          row.resolucion?.replaceAll("_", " ") ?? "PENDIENTE"
                                        )}
                                      </TableCell>
                                      {(isSobrante || isFaltante) && user?.rol === "ADMIN" && (
                                        <TableCell className="text-right">
                                          {isSobrante && sobrante && sobrante.estadoResolucion !== "RESUELTO" && (
                                            <Button
                                              variant="outline"
                                              size="sm"
                                              className="h-7 text-xs font-semibold"
                                              onClick={() => setResolvingSobrante({ serie: row.serie, contexto: sobrante })}
                                              disabled={detail.data?.estado !== "CONFIRMADA"}
                                              title={detail.data?.estado !== "CONFIRMADA" ? "Primero confirma y aplica la auditoría" : ""}
                                            >
                                              <Settings className="w-3 h-3 mr-1" />
                                              Resolver
                                            </Button>
                                          )}
                                          {isFaltante && row.rolloId && detail.data?.estado === "CONFIRMADA" && (
                                            <Button
                                              data-testid={`button-reactivate-audit-missing-${row.serie}`}
                                              variant="outline"
                                              size="sm"
                                              className="h-7 text-xs font-semibold text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 border-emerald-200"
                                              disabled={isFetchingReactivacion === row.rolloId}
                                              onClick={() => handleFetchReactivacion(row.rolloId!, detail.data!.id)}
                                            >
                                              {isFetchingReactivacion === row.rolloId ? "..." : "Reactivar"}
                                            </Button>
                                          )}
                                        </TableCell>
                                      )}
                                    </TableRow>
                                  )})}
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
      {detail.data && <AuditoriaInventarioPrint detail={detail.data} />}

      <Dialog
        open={addColorOpen}
        onOpenChange={(open) => {
          setAddColorOpen(open);
          if (!open) window.setTimeout(() => scanRef.current?.focus(), 0);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Alta rápida de color</DialogTitle>
            <DialogDescription>
              Crea una variante del catálogo. No registra ni asocia ninguna serie a esta auditoría.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="audit-product-tela">Tela existente</Label>
              <Select value={addColorTela} onValueChange={setAddColorTela}>
                <SelectTrigger id="audit-product-tela" data-testid="select-audit-product-tela">
                  <SelectValue placeholder="Selecciona una tela" />
                </SelectTrigger>
                <SelectContent>
                  {[...new Set(products.data?.map((product) => product.tela) ?? [])].map((tela) => (
                    <SelectItem key={tela} value={tela}>{tela}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="audit-product-color">Nuevo color</Label>
              <Input
                id="audit-product-color"
                value={addColor}
                onChange={(event) => setAddColor(event.target.value)}
                data-testid="input-audit-product-color"
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setAddColorOpen(false);
                window.setTimeout(() => scanRef.current?.focus(), 0);
              }}
            >
              Cancelar
            </Button>
            <Button
              disabled={!addColorTela || !addColor.trim() || createProduct.isPending}
              data-testid="button-confirm-audit-product-color"
              onClick={() => {
                const inherited = products.data?.find((product) => product.tela === addColorTela);
                if (!inherited) return;
                createProduct.mutate({
                  data: {
                    tela: inherited.tela,
                    color: addColor.trim(),
                    unidad: inherited.unidad,
                    precioSugerido: inherited.precioSugerido ?? null,
                    anchoCm: inherited.anchoCm,
                    composicion: inherited.composicion,
                    gramajeGm2: inherited.gramajeGm2,
                    notas: null,
                  },
                }, {
                  onSuccess: () => {
                    void queryClient.invalidateQueries({ queryKey: getListProductosQueryKey() });
                    setAddColor("");
                    setAddColorOpen(false);
                    window.setTimeout(() => scanRef.current?.focus(), 0);
                    toast({ title: "Color creado", description: "La variante quedó disponible en el catálogo." });
                  },
                  onError: (error) => toast({ title: "No se pudo crear el color", description: message(error), variant: "destructive" }),
                });
              }}
            >
              {createProduct.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Crear color
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
      {/* Resolucion Sobrantes Dialog */}
      {resolvingSobrante && detail.data && (
        <AuditoriaSobranteResolutionDialog
          open={!!resolvingSobrante}
          onOpenChange={(open) => !open && setResolvingSobrante(null)}
          auditoriaId={detail.data.id}
          ubicacionId={detail.data.ubicacionId}
          serie={resolvingSobrante.serie}
          contexto={resolvingSobrante.contexto}
          onSuccess={() => setResolvingSobrante(null)}
        />
      )}
      {reactivacionContexto && (
        <ReactivacionFaltanteDialog
          open
          onOpenChange={(open) => {
            if (!open) setReactivacionContexto(null);
          }}
          rolloId={reactivacionContexto.rolloId}
          origen="AUDITORIA"
          contexto={reactivacionContexto.contexto}
          onSuccess={() => setReactivacionContexto(null)}
        />
      )}
    </AppLayout>
  );
}
