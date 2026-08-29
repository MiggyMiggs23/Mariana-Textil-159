import { useState, useRef, useEffect, useMemo } from "react";
import { useParams, Link, useLocation, useSearch } from "wouter";
import { AppLayout } from "@/components/layout/app-layout";
import {
  useGetPrecio,
  useChangePrecio,
  getGetPrecioQueryKey,
  getListPreciosQueryKey,
  SemaforoPrecio,
  PrecioHistorialItem,
  ModoPrecio,
  UnidadProducto
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { formatNumber, formatUnit } from "@workspace/number-format";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import {
  ArrowLeft, CheckCircle2, AlertTriangle, AlertOctagon, HelpCircle, Lock,
  TrendingUp, TrendingDown, DollarSign, History, LineChart, FileText
} from "lucide-react";
import { format } from "date-fns";
import {
  ResponsiveContainer,
  LineChart as RechartsLineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend
} from "recharts";

function getSemaforoBadge(s: SemaforoPrecio, size: "sm" | "md" = "sm") {
  const cn = size === "md" ? "px-3 py-1 text-sm" : "text-xs";
  const iconCn = size === "md" ? "w-4 h-4 mr-2" : "w-3 h-3 mr-1";

  switch (s) {
    case SemaforoPrecio.VERDE:
      return <Badge variant="outline" className={`bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800 ${cn}`}><CheckCircle2 className={iconCn} /> Saludable</Badge>;
    case SemaforoPrecio.AMBAR:
      return <Badge variant="outline" className={`bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800 ${cn}`}><AlertTriangle className={iconCn} /> Precaución</Badge>;
    case SemaforoPrecio.ROJO:
      return <Badge variant="outline" className={`bg-red-100 text-red-800 border-red-300 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800 ${cn}`}><AlertOctagon className={iconCn} /> Crítico</Badge>;
    case SemaforoPrecio.SIN_COSTO:
      return <Badge variant="outline" className={`bg-slate-100 text-slate-800 border-slate-300 dark:bg-slate-900/30 dark:text-slate-400 dark:border-slate-800 ${cn}`}><HelpCircle className={iconCn} /> Sin costo</Badge>;
  }
}

export default function PrecioDetail() {
  const { id } = useParams();
  const searchString = useSearch();
  const searchParams = new URLSearchParams(searchString);
  const initialMode = (searchParams.get("mode") as ModoPrecio) || ModoPrecio.ROLLO;

  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const { data: producto, isLoading, error } = useGetPrecio(Number(id), {
    query: { enabled: !!id, queryKey: getGetPrecioQueryKey(Number(id)) }
  });

  const changePrecio = useChangePrecio();

  // Workflow State
  const [activeMode, setActiveMode] = useState<ModoPrecio>(initialMode);
  const [step, setStep] = useState<1 | 2>(1);
  const [precioNuevo, setPrecioNuevo] = useState("");
  const [motivo, setMotivo] = useState("");

  useEffect(() => {
    setActiveMode(initialMode);
  }, [initialMode]);

  const initializedForId = useRef<string | null>(null);

  // We need to re-initialize when the product or active mode changes
  useEffect(() => {
    if (producto) {
      const modeKey = `${producto.id}-${activeMode}`;
      if (initializedForId.current !== modeKey) {
        initializedForId.current = modeKey;
        const currentModePrice = producto.preciosPorModo[activeMode]?.precioLista;
        setPrecioNuevo(currentModePrice || "");
        setMotivo("");
        setStep(1);
      }
    }
  }, [producto, activeMode]);

  const modeData = producto?.preciosPorModo[activeMode];
  const isLocked = producto && activeMode !== ModoPrecio.ROLLO && (!producto.seVendePorMetro || producto.unidad === UnidadProducto.KILO);

  const liveMetrics = useMemo(() => {
    if (!producto || !modeData || !precioNuevo) return null;
    const priceNum = Number(precioNuevo);
    if (!Number.isFinite(priceNum) || priceNum <= 0) return null;

    if (!modeData.costoUnitarioBase) {
      return {
        margenPesos: null,
        margenPct: null,
        semaforo: SemaforoPrecio.SIN_COSTO,
        advertenciaBajoCosto: false
      };
    }

    const costNum = Number(modeData.costoUnitarioBase);
    const margin = priceNum - costNum;
    const pct = (margin / priceNum) * 100;

    let semaforo: typeof SemaforoPrecio[keyof typeof SemaforoPrecio] = SemaforoPrecio.ROJO;
    if (pct >= 30) semaforo = SemaforoPrecio.VERDE;
    else if (pct >= 15) semaforo = SemaforoPrecio.AMBAR;

    return {
      margenPesos: margin.toFixed(2),
      margenPct: pct.toFixed(4),
      semaforo,
      advertenciaBajoCosto: margin < 0
    };
  }, [producto, modeData, precioNuevo]);

  if (isLoading) {
    return (
      <AppLayout>
        <div className="max-w-6xl mx-auto animate-pulse space-y-6">
          <div className="h-8 bg-muted rounded w-32"></div>
          <div className="h-40 bg-muted rounded-xl"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="h-96 bg-muted rounded-xl"></div>
            <div className="h-96 bg-muted rounded-xl"></div>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (error || !producto) {
    return (
      <AppLayout>
        <div className="max-w-6xl mx-auto p-12 text-center flex flex-col items-center">
          <AlertOctagon className="w-12 h-12 mb-4 text-destructive opacity-80" />
          <h2 className="text-2xl font-bold mb-2">Error al cargar precio</h2>
          <p className="text-muted-foreground mb-6">No se encontró el producto o no tienes acceso.</p>
          <Button onClick={() => setLocation('/precios')}>Volver a Precios</Button>
        </div>
      </AppLayout>
    );
  }

  const handleNextStep = () => {
    if (Number(precioNuevo) <= 0) {
      toast.error("El precio debe ser mayor a 0");
      return;
    }
    if (motivo.trim().length < 5) {
      toast.error("El motivo debe tener al menos 5 caracteres");
      return;
    }
    setStep(2);
  };

  const handleConfirm = () => {
    changePrecio.mutate({
      id: producto.id,
      data: {
        modoPrecio: activeMode,
        precioListaNuevo: parseFloat(Number(precioNuevo).toFixed(2)).toString(),
        motivo: motivo.trim()
      }
    }, {
      onSuccess: () => {
        toast.success("Precio actualizado correctamente");
        queryClient.invalidateQueries({ queryKey: getGetPrecioQueryKey(producto.id) });
        queryClient.invalidateQueries({ queryKey: getListPreciosQueryKey() });
        setStep(1);
        setMotivo("");
      },
      onError: (err: any) => {
        const msg = err?.data?.error || err.message || "Error desconocido";
        toast.error("Error al actualizar precio", { description: msg });
      }
    });
  };

  // Format data for chart
  const modePuntosGrafica = producto.puntosGrafica.filter(pt => pt.modoPrecio === activeMode);
  const chartData = [...modePuntosGrafica].map(pt => ({
    date: format(new Date(pt.createdAt), "MMM dd, yyyy"),
    rawDate: new Date(pt.createdAt).getTime(),
    precio: Number(pt.precioListaNuevo),
    costo: pt.costoUnitarioBase ? Number(pt.costoUnitarioBase) : null,
  })).sort((a, b) => a.rawDate - b.rawDate);

  // Fallback if no history yet
  if (chartData.length === 0 && modeData?.precioLista) {
    chartData.push({
      date: "Actual",
      rawDate: Date.now(),
      precio: Number(modeData.precioLista),
      costo: modeData.costoUnitarioBase ? Number(modeData.costoUnitarioBase) : null
    });
  }

  const currentPriceForMode = modeData?.precioLista || "0";
  const diffPct = Number(currentPriceForMode) > 0
    ? ((Number(precioNuevo) - Number(currentPriceForMode)) / Number(currentPriceForMode)) * 100
    : 0;

  const modeHistorial = producto.historial.filter(h => h.modoPrecio === activeMode);

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <Link href="/precios" className="flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors" data-testid="link-back-precios">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Volver al catálogo
          </Link>
          <Link href={`/productos/${producto.id}`} className="text-sm font-medium text-primary hover:underline" data-testid="link-product-detail">
            Ver detalle del producto
          </Link>
        </div>

        <div className="flex border-b border-border mb-6">
          {(["ROLLO", "MAYOREO", "MENUDEO"] as ModoPrecio[]).map((mode) => (
            <button
              key={mode}
              className={`px-6 py-3 font-medium text-sm border-b-2 transition-colors ${
                activeMode === mode
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
              }`}
              onClick={() => setActiveMode(mode)}
              data-testid={`tab-mode-${mode}`}
            >
              {mode === "ROLLO" ? "Precio por Rollo" : mode === "MAYOREO" ? "Mayoreo (≥ 10m)" : "Menudeo (< 10m)"}
            </button>
          ))}
        </div>

        {isLocked ? (
          <Card className="border-dashed border-2 border-muted bg-muted/10 p-12 text-center flex flex-col items-center">
            <Lock className="w-12 h-12 mb-4 text-muted-foreground opacity-50" />
            <h2 className="text-xl font-bold mb-2">Modo Bloqueado</h2>
            <p className="text-muted-foreground">
              Este producto {producto.unidad === UnidadProducto.KILO ? 'se vende por KILO y no soporta ventas metreadas' : 'tiene la venta por metro deshabilitada'}.
              Para modificar los precios de mayoreo o menudeo, primero debes habilitar la venta por metro desde el catálogo.
            </p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Header & Current Metrics */}
            <Card className="lg:col-span-3 bg-gradient-to-br from-sidebar to-sidebar-accent text-white shadow-lg overflow-hidden relative">
              <div className="absolute top-0 right-0 w-64 h-64 bg-sidebar-primary rounded-full blur-[80px] opacity-20 -mr-20 -mt-20 pointer-events-none"></div>
              <CardContent className="p-8">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <span className="font-mono text-sidebar-primary-foreground/70 bg-sidebar-accent/50 px-2 py-1 rounded text-sm font-bold border border-white/10" data-testid="text-sku">
                        {producto.sku}
                      </span>
                      <Badge variant="outline" className="text-white border-white/20 bg-white/5 text-xs">{formatUnit(producto.unidad)}</Badge>
                      <Badge variant="outline" className="text-white border-white/20 bg-white/5 font-medium">{activeMode}</Badge>
                      {!producto.activo && <Badge variant="destructive">Inactivo</Badge>}
                    </div>
                    <h1 className="text-3xl font-bold tracking-tight mb-1">{producto.tela}</h1>
                    <p className="text-lg text-sidebar-foreground/80 font-medium">{producto.color}</p>
                  </div>

                  <div className="flex flex-col md:flex-row items-start md:items-center gap-6 md:gap-12 bg-black/20 p-6 rounded-xl border border-white/10 backdrop-blur-sm">
                    <div>
                      <p className="text-sm text-sidebar-foreground/60 font-medium uppercase tracking-wider">
                        Costo base
                      </p>
                      <p className="mb-2 max-w-sm text-xs leading-snug text-sidebar-foreground/75">
                        {activeMode === ModoPrecio.ROLLO
                          ? "Promedio ponderado de rollos con existencia actual"
                          : "Promedio simple por rollo recibido en los últimos 12 meses, sin ponderar por cantidad"}
                      </p>
                      <div className="text-2xl font-semibold text-sidebar-primary-foreground/90">
                        {activeMode !== ModoPrecio.ROLLO && producto.costoReferenciaMetreado.estado === 'NO_COST' ? (
                          <span className="text-lg font-semibold bg-white/10 px-3 py-1 rounded">Sin costo</span>
                        ) : (
                          <>
                            {modeData?.costoUnitarioBase && Number(modeData.costoUnitarioBase) > 0 ? formatNumber(modeData.costoUnitarioBase, { kind: "money" }) : "Sin costo"}
                            {activeMode !== ModoPrecio.ROLLO && producto.costoReferenciaMetreado.esMayorA12Meses && (
                              <div className="text-xs text-amber-300 font-medium flex items-center gap-1 mt-1 bg-amber-500/10 px-2 py-1 rounded border border-amber-500/20">
                                <AlertTriangle className="w-4 h-4" /> Costo obsoleto (&gt;12m). Última vez: {producto.costoReferenciaMetreado.fechaUltimaRecepcion ? format(new Date(producto.costoReferenciaMetreado.fechaUltimaRecepcion), "dd/MM/yyyy") : "N/A"}
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                    <div className="hidden md:block w-px h-12 bg-white/10"></div>
                    <div>
                      <p className="text-sm text-sidebar-foreground/60 font-medium mb-1 uppercase tracking-wider flex items-center justify-between">
                        Precio de Lista ({activeMode})
                      </p>
                      <div className="text-4xl font-bold text-white tracking-tighter" data-testid="text-current-price">
                        {modeData?.precioLista && Number(modeData.precioLista) > 0 ? formatNumber(modeData.precioLista, { kind: "money" }) : "—"}
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

          {/* Left Column: Chart */}
          <div className="lg:col-span-2 space-y-6">
            <Card className="h-[450px] flex flex-col shadow-sm">
              <CardHeader className="pb-2 border-b">
                <CardTitle className="text-lg flex items-center gap-2">
                  <LineChart className="w-5 h-5 text-primary" />
                  Evolución Precio vs Costo
                </CardTitle>
                <CardDescription>
                  Historial cronológico de cambios de precio y su costo al momento del cambio.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-1 p-6">
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsLineChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--report-stripe))" strokeWidth={2} opacity={0.5} />
                    <XAxis
                      dataKey="date"
                      tickLine={false}
                      axisLine={{ stroke: 'hsl(var(--report-text-muted)/0.3)' }}
                      tick={{ fontSize: 11, fill: "hsl(var(--report-text-muted))", fontWeight: 500 }}
                      tickMargin={12}
                    />
                    <YAxis
                      tickFormatter={(value) => `$${value}`}
                      tickLine={false}
                      axisLine={false}
                      tick={{ fontSize: 11, fill: "hsl(var(--report-text-muted))", fontWeight: 500 }}
                      width={60}
                    />
                    <RechartsTooltip
                      formatter={(value: number) => formatNumber(value, { kind: "money" })}
                      contentStyle={{ borderRadius: '6px', fontSize: '13px', border: '1px solid hsl(var(--border))', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                      labelStyle={{ fontWeight: 'bold', color: 'hsl(var(--report-header))', marginBottom: '4px' }}
                    />
                    <Legend wrapperStyle={{ fontSize: '13px', paddingTop: '15px', fontWeight: 500 }} iconType="circle" />
                    <Line
                      type="stepAfter"
                      dataKey="precio"
                      name={`Precio Lista (${activeMode})`}
                      stroke="hsl(var(--report-modality-metraje))"
                      strokeWidth={3}
                      dot={{ r: 4, strokeWidth: 2, fill: 'var(--background)' }}
                      activeDot={{ r: 6, strokeWidth: 0 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="costo"
                      name="Costo Base"
                      stroke="hsl(var(--report-modality-rollos))"
                      strokeWidth={2}
                      strokeDasharray="4 4"
                      dot={{ r: 4, strokeWidth: 2, fill: 'var(--background)' }}
                      activeDot={{ r: 6, strokeWidth: 0 }}
                    />
                  </RechartsLineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardHeader className="border-b bg-muted/20">
                <CardTitle className="text-lg flex items-center gap-2">
                  <History className="w-5 h-5 text-primary" />
                  Historial de Cambios
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30">
                      <TableHead>Fecha</TableHead>
                      <TableHead className="text-right">Precio Ant.</TableHead>
                      <TableHead className="text-right">Precio Nvo.</TableHead>
                      <TableHead className="text-right">Margen Nvo.</TableHead>
                      <TableHead>Motivo</TableHead>
                      <TableHead className="text-right">Usuario</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {modeHistorial.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                          No hay historial de cambios registrado.
                        </TableCell>
                      </TableRow>
                    ) : (
                      modeHistorial.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="whitespace-nowrap text-xs text-muted-foreground font-medium">
                            {format(new Date(item.createdAt), "dd/MM/yy HH:mm")}
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground line-through decoration-muted-foreground/40">
                            {item.precioListaAnterior && Number(item.precioListaAnterior) > 0 ? formatNumber(item.precioListaAnterior, { kind: "money" }) : "—"}
                          </TableCell>
                          <TableCell className="text-right font-bold text-foreground">
                            {item.precioListaNuevo && Number(item.precioListaNuevo) > 0 ? formatNumber(item.precioListaNuevo, { kind: "money" }) : "—"}
                          </TableCell>
                          <TableCell className="text-right">
                            {item.margenPorcentajeSubtotal && Number(item.margenPorcentajeSubtotal) !== 0 ? (
                              <Badge variant="outline" className={`font-mono font-medium ${
                                Number(item.margenPorcentajeSubtotal) >= 30 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                Number(item.margenPorcentajeSubtotal) >= 15 ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                'bg-red-50 text-red-700 border-red-200'
                              }`}>
                                {formatNumber(item.margenPorcentajeSubtotal, { kind: "percentage", percentageInput: "percent" })}
                              </Badge>
                            ) : "—"}
                            {item.advertenciaBajoCosto && (
                              <span title="Debajo del costo">
                                <AlertOctagon className="w-3 h-3 text-destructive inline-block ml-1" />
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-sm max-w-[200px] truncate" title={item.motivo}>
                            {item.motivo}
                          </TableCell>
                          <TableCell className="text-right text-xs text-muted-foreground">
                            UID: {item.usuarioId}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>

          {/* Right Column: Workflow */}
          <div className="lg:col-span-1">
            <Card className={`border-2 shadow-md transition-colors ${step === 2 ? 'border-primary' : 'border-border'}`}>
              <CardHeader className="bg-muted/30 border-b">
                <CardTitle className="text-lg flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-primary" />
                  Cambiar Precio
                </CardTitle>
                <div className="flex gap-2 mt-4">
                  <div className={`h-2 flex-1 rounded-full ${step >= 1 ? 'bg-primary' : 'bg-muted'}`}></div>
                  <div className={`h-2 flex-1 rounded-full ${step >= 2 ? 'bg-primary' : 'bg-muted'}`}></div>
                </div>
              </CardHeader>

              {step === 1 && (
                <CardContent className="p-6 space-y-6">
                  <div className="space-y-2">
                    <Label className="text-muted-foreground uppercase text-xs font-bold tracking-wider">Precio Actual</Label>
                    <div className="text-2xl font-bold bg-muted/50 p-3 rounded-lg border border-border/50 text-muted-foreground">
                      {modeData?.precioLista && Number(modeData.precioLista) > 0 ? formatNumber(modeData.precioLista, { kind: "money" }) : "—"}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="precioNuevo" className="uppercase text-xs font-bold tracking-wider text-foreground">
                      Nuevo Precio de Lista
                    </Label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                      <Input
                        id="precioNuevo"
                        type="number"
                        step="0.01"
                        value={precioNuevo}
                        onChange={(e) => setPrecioNuevo(e.target.value)}
                        className="pl-10 h-12 text-lg font-bold"
                        placeholder="0.00"
                        data-testid="input-precio-nuevo"
                      />
                    </div>
                  </div>

                  <div className="bg-card border rounded-xl p-4 shadow-sm space-y-4">
                    <h4 className="text-sm font-semibold flex items-center gap-2 text-foreground/80 border-b pb-2">
                      <TrendingUp className="w-4 h-4" /> Proyección de Margen
                    </h4>

                    {!liveMetrics ? (
                      <p className="text-sm text-muted-foreground py-2 text-center">Ingresa un precio válido</p>
                    ) : (
                      <>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-muted-foreground">Margen en $</span>
                          <span className={`font-bold ${liveMetrics.advertenciaBajoCosto ? 'text-destructive' : ''}`}>
                            {liveMetrics.margenPesos ? formatNumber(liveMetrics.margenPesos, { kind: "money" }) : "—"}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-muted-foreground">Margen en %</span>
                          <span className={`font-bold ${liveMetrics.advertenciaBajoCosto ? 'text-destructive' : ''}`}>
                            {liveMetrics.margenPct ? formatNumber(liveMetrics.margenPct, { kind: "percentage", percentageInput: "percent" }) : "—"}
                          </span>
                        </div>
                        <div className="flex justify-between items-center pt-2 border-t border-dashed">
                          <span className="text-sm text-muted-foreground">Estado</span>
                          {getSemaforoBadge(liveMetrics.semaforo, "md")}
                        </div>
                        {liveMetrics.advertenciaBajoCosto && (
                          <div className="mt-2 p-2 bg-destructive/10 text-destructive text-xs rounded-md border border-destructive/20 flex items-start gap-2">
                            <AlertOctagon className="w-4 h-4 shrink-0 mt-0.5" />
                            <p>El precio ingresado está por debajo del costo unitario base ({modeData?.costoUnitarioBase && Number(modeData.costoUnitarioBase) > 0 ? formatNumber(modeData.costoUnitarioBase, { kind: "money" }) : "—"}).</p>
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="motivo" className="uppercase text-xs font-bold tracking-wider text-foreground">
                      Motivo del Cambio
                    </Label>
                    <Input
                      id="motivo"
                      value={motivo}
                      onChange={(e) => setMotivo(e.target.value)}
                      placeholder="Ej. Ajuste por inflación..."
                      data-testid="input-motivo"
                    />
                    <p className="text-[10px] text-muted-foreground">Mínimo 5 caracteres. Obligatorio.</p>
                  </div>
                </CardContent>
              )}

              {step === 2 && (
                <CardContent className="p-6 space-y-6">
                  <div className="p-4 bg-primary/5 rounded-xl border border-primary/20 space-y-4">
                    <h3 className="font-bold text-primary flex items-center gap-2 border-b border-primary/10 pb-2">
                      <FileText className="w-4 h-4" /> Resumen del Cambio
                    </h3>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wider font-semibold">Anterior</p>
                        <p className="text-lg font-medium text-muted-foreground line-through decoration-muted-foreground/40">{modeData?.precioLista && Number(modeData.precioLista) > 0 ? formatNumber(modeData.precioLista, { kind: "money" }) : "—"}</p>
                        {modeData?.margenPorcentajeSubtotal && (
                          <p className="text-xs text-muted-foreground mt-1">Margen: {formatNumber(modeData.margenPorcentajeSubtotal, { kind: "percentage", percentageInput: "percent" })}</p>
                        )}
                      </div>
                      <div>
                        <p className="text-xs text-primary mb-1 uppercase tracking-wider font-bold">Nuevo</p>
                        <p className="text-2xl font-bold text-foreground">{formatNumber(precioNuevo, { kind: "money" })}</p>
                        {liveMetrics?.margenPct && (
                          <p className="text-xs font-medium mt-1 text-primary">Margen: {formatNumber(liveMetrics.margenPct, { kind: "percentage", percentageInput: "percent" })}</p>
                        )}
                      </div>
                    </div>

                    <div className="pt-2 border-t border-primary/10 flex items-center gap-2">
                      <span className="text-sm font-medium">Diferencia:</span>
                      <span className={`text-sm font-bold ${diffPct > 0 ? 'text-emerald-600' : diffPct < 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
                        {diffPct > 0 ? '+' : ''}{formatNumber(diffPct, { kind: "percentage", percentageInput: "percent" })}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Motivo</p>
                    <p className="text-sm p-3 bg-muted/30 border rounded-lg italic">"{motivo}"</p>
                  </div>

                  {liveMetrics?.advertenciaBajoCosto && (
                    <div className="p-4 bg-destructive/10 text-destructive text-sm font-medium rounded-lg border border-destructive/20 flex gap-3 shadow-sm">
                      <AlertOctagon className="w-5 h-5 shrink-0" />
                      <div>
                        <p className="font-bold mb-1">¡Advertencia Crítica!</p>
                        <p className="text-xs">Estás autorizando un precio por debajo del costo. Esta operación quedará registrada en la auditoría del sistema.</p>
                      </div>
                    </div>
                  )}
                </CardContent>
              )}

              <CardFooter className="p-6 pt-0 bg-muted/10 border-t flex gap-3">
                {step === 1 ? (
                  <Button className="w-full h-11 text-base font-bold shadow-sm" onClick={handleNextStep} data-testid="button-next-step">
                    Previsualizar Cambio
                  </Button>
                ) : (
                  <>
                    <Button variant="outline" className="flex-1 h-11" onClick={() => setStep(1)} disabled={changePrecio.isPending}>
                      Volver
                    </Button>
                    <Button
                      className={`flex-1 h-11 font-bold shadow-md ${liveMetrics?.advertenciaBajoCosto ? 'bg-destructive hover:bg-destructive/90 text-destructive-foreground' : ''}`}
                      onClick={handleConfirm}
                      disabled={changePrecio.isPending}
                      data-testid="button-confirm-price"
                    >
                      {liveMetrics?.advertenciaBajoCosto ? 'Autorizar y Confirmar' : 'Confirmar Cambio'}
                    </Button>
                  </>
                )}
              </CardFooter>
            </Card>
          </div>
        </div>
        )}
      </div>
    </AppLayout>
  );
}