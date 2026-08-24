import { useState, useEffect } from "react";
import { Link } from "wouter";
import { AppLayout } from "@/components/layout/app-layout";
import {
  useGetKardex,
  getGetKardexQueryKey,
  useListKardexFilters,
  getListKardexFiltersQueryKey,
  exportKardexXlsx,
  TipoMovimiento,
  useGetCurrentUser
} from "@workspace/api-client-react";
import { keepPreviousData } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import {
  Search, Download, FileText, ChevronDown, Filter, History, Loader2, AlertCircle
} from "lucide-react";

const TIMEZONE = "America/Mexico_City";
const LOCALE = "es-MX";

const desktopDateFormatter = new Intl.DateTimeFormat(LOCALE, {
  timeZone: TIMEZONE,
  day: "2-digit",
  month: "short",
  year: "numeric"
});

const timeFormatter = new Intl.DateTimeFormat(LOCALE, {
  timeZone: TIMEZONE,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false
});

const formatDesktopDate = (dateStr: string) => {
  return desktopDateFormatter.format(new Date(dateStr)).replace(/ /g, "/");
};

const formatTime = (dateStr: string) => {
  return timeFormatter.format(new Date(dateStr));
};

const formatMobileDateTime = (dateStr: string) => {
  return `${desktopDateFormatter.format(new Date(dateStr))} \u00B7 ${timeFormatter.format(new Date(dateStr))}`;
};

const TipoMovimientoLabels: Record<string, string> = {
  ALTA: "Alta manual",
  RECEPCION: "Entrada de proveedor",
  VENTA: "Venta",
  DEVOLUCION: "Devolución",
  TRANSFERENCIA_SALIDA: "Salida enviada",
  TRANSFERENCIA_ENTRADA: "Recepción de salida",
  SALIDA_MOSTRADOR: "Salida de mostrador",
  AJUSTE_POSITIVO: "Ajuste Positivo",
  AJUSTE_NEGATIVO: "Ajuste Negativo",
  CANCELACION: "Cancelación"
};

const TipoMovimientoColors: Record<string, string> = {
  ALTA: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 border-blue-200 dark:border-blue-800",
  RECEPCION: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800",
  VENTA: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300 border-purple-200 dark:border-purple-800",
  DEVOLUCION: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300 border-orange-200 dark:border-orange-800",
  TRANSFERENCIA_SALIDA: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border-amber-200 dark:border-amber-800",
  TRANSFERENCIA_ENTRADA: "bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300 border-teal-200 dark:border-teal-800",
  SALIDA_MOSTRADOR: "bg-pink-100 text-pink-800 dark:bg-pink-900/40 dark:text-pink-300 border-pink-200 dark:border-pink-800",
  AJUSTE_POSITIVO: "bg-lime-100 text-lime-800 dark:bg-lime-900/40 dark:text-lime-300 border-lime-200 dark:border-lime-800",
  AJUSTE_NEGATIVO: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300 border-red-200 dark:border-red-800",
  CANCELACION: "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700"
};

export default function Movimientos() {
  const { data: user } = useGetCurrentUser();
  const { toast } = useToast();
  const baseUrl = import.meta.env.BASE_URL.replace(/\/$/, "");

  const [searchInput, setSearchInput] = useState("");
  const [filters, setFilters] = useState<{
    buscar: string;
    desde: string;
    hasta: string;
    ubicacionId: string;
    productoId: string;
    usuarioId: string;
    tipos: TipoMovimiento[];
    incluirUbicacionesInactivas: boolean;
  }>({
    buscar: "",
    desde: "",
    hasta: "",
    ubicacionId: "all",
    productoId: "all",
    usuarioId: "all",
    tipos: [],
    incluirUbicacionesInactivas: false
  });

  const [page, setPage] = useState(1);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => {
      if (filters.buscar !== searchInput) {
        setFilters(f => ({ ...f, buscar: searchInput }));
        setPage(1);
      }
    }, 400);
    return () => clearTimeout(t);
  }, [searchInput, filters.buscar]);

  const showLocationFilter = user?.rol === "ADMIN" || user?.alcanceConsulta === "TODAS";

  const filterParamsList = {
    incluirUbicacionesInactivas: filters.incluirUbicacionesInactivas || undefined,
  };

  const { data: filtersData } = useListKardexFilters(
    filterParamsList,
    { query: { queryKey: getListKardexFiltersQueryKey(filterParamsList) } }
  );

  const filterParams = {
    ubicacionId: filters.ubicacionId !== "all" ? Number(filters.ubicacionId) : undefined,
    productoId: filters.productoId !== "all" ? Number(filters.productoId) : undefined,
    usuarioId: filters.usuarioId !== "all" ? Number(filters.usuarioId) : undefined,
    tipos: filters.tipos.length > 0 ? filters.tipos : undefined,
    buscar: filters.buscar || undefined,
    desde: filters.desde || undefined,
    hasta: filters.hasta || undefined,
    incluirUbicacionesInactivas: filters.incluirUbicacionesInactivas || undefined,
  };

  const queryParams = { ...filterParams, page, pageSize: 100 };

  const { data, isLoading, isError, isFetching } = useGetKardex(
    queryParams,
    { query: { queryKey: getGetKardexQueryKey(queryParams), placeholderData: keepPreviousData } }
  );

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const blob = await exportKardexXlsx(filterParams);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `movimientos_${format(new Date(), "yyyyMMdd_HHmm")}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: "Exportación exitosa",
        description: "El reporte ha sido descargado correctamente.",
      });
    } catch (error) {
      toast({
        title: "Error al exportar",
        description: "Hubo un problema al generar el archivo Excel.",
        variant: "destructive"
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleClearFilters = () => {
    setSearchInput("");
    setFilters({
      buscar: "",
      desde: "",
      hasta: "",
      ubicacionId: "all",
      productoId: "all",
      usuarioId: "all",
      tipos: [],
      incluirUbicacionesInactivas: false
    });
    setPage(1);
  };

  return (
    <AppLayout>
      <div className="max-w-[1400px] mx-auto space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-sidebar">Movimientos</h1>
            <p className="text-muted-foreground mt-1 text-sm md:text-base">
              Registro inmutable de todos los movimientos de inventario en el sistema.
            </p>
          </div>
        </div>

        <Card>
          <CardHeader className="pb-3 border-b">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <Filter className="w-5 h-5 text-primary" /> Filtros
              </CardTitle>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={handleClearFilters} data-testid="button-clear-filters">
                  Limpiar
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  className="gap-2"
                  onClick={handleExport}
                  disabled={isExporting || isLoading}
                  data-testid="button-export-kardex"
                >
                  {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                  <span className="hidden sm:inline">Exportar</span>
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              <div className="space-y-1.5 xl:col-span-2">
                <Label>Buscar</Label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    className="pl-8"
                    placeholder="Buscar por serie, SKU, documento o justificación..."
                    value={searchInput}
                    onChange={e => setSearchInput(e.target.value)}
                    data-testid="input-search-kardex"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Desde</Label>
                <Input
                  type="date"
                  value={filters.desde}
                  onChange={e => { setFilters(f => ({ ...f, desde: e.target.value })); setPage(1); }}
                  data-testid="input-date-desde"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Hasta</Label>
                <Input
                  type="date"
                  value={filters.hasta}
                  onChange={e => { setFilters(f => ({ ...f, hasta: e.target.value })); setPage(1); }}
                  data-testid="input-date-hasta"
                />
              </div>

              <div className="space-y-1.5">
                <Label>Tipo de Movimiento</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-between font-normal" data-testid="button-select-tipos">
                      {filters.tipos.length === 0 ? "Todos los tipos" : `${filters.tipos.length} seleccionados`}
                      <ChevronDown className="h-4 w-4 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[280px] p-0" align="start">
                    <div className="max-h-[300px] overflow-y-auto p-1">
                      {filtersData?.tipos?.map((val) => (
                        <div
                          key={val}
                          className="flex items-center space-x-2.5 p-2 hover:bg-muted rounded-md cursor-pointer transition-colors"
                          onClick={() => {
                            const t = val as TipoMovimiento;
                            setFilters(f => ({
                              ...f,
                              tipos: f.tipos.includes(t) ? f.tipos.filter(x => x !== t) : [...f.tipos, t]
                            }));
                            setPage(1);
                          }}
                          data-testid={`checkbox-tipo-${val}`}
                        >
                          <Checkbox
                            checked={filters.tipos.includes(val as TipoMovimiento)}
                            className="pointer-events-none"
                          />
                          <Label className="cursor-pointer font-medium text-sm leading-none flex-1 text-foreground">
                            {TipoMovimientoLabels[val] || val}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>

              {showLocationFilter && (
                <div className="space-y-1.5">
                  <Label>Sitio</Label>
                  <Select value={filters.ubicacionId} onValueChange={v => { setFilters(f => ({ ...f, ubicacionId: v })); setPage(1); }}>
                    <SelectTrigger data-testid="select-ubicacion">
                      <SelectValue placeholder="Todos los sitios" />
                    </SelectTrigger>
                    <SelectContent className="max-h-[300px]">
                      <SelectItem value="all">Todos los sitios</SelectItem>
                      {filtersData?.ubicaciones?.map(u => (
                        <SelectItem key={u.id} value={u.id.toString()}>
                          {u.nombre} {!u.activa && "(Inactiva)"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-1.5">
                <Label>Producto</Label>
                <Select value={filters.productoId} onValueChange={v => { setFilters(f => ({ ...f, productoId: v })); setPage(1); }}>
                  <SelectTrigger data-testid="select-producto">
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px]">
                    <SelectItem value="all">Todos</SelectItem>
                    {filtersData?.productos?.map(p => (
                      <SelectItem key={p.id} value={p.id.toString()}>
                        {p.tela} - {p.color} ({p.sku})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Usuario</Label>
                <Select value={filters.usuarioId} onValueChange={v => { setFilters(f => ({ ...f, usuarioId: v })); setPage(1); }}>
                  <SelectTrigger data-testid="select-usuario">
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px]">
                    <SelectItem value="all">Todos</SelectItem>
                    {filtersData?.usuarios?.map(u => (
                      <SelectItem key={u.id} value={u.id.toString()}>
                        {u.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {user?.rol === "ADMIN" && (
                <div className="flex flex-col justify-end pb-1.5 xl:col-start-4">
                  <div className="flex items-center space-x-2 h-9 border border-border rounded-md px-3 bg-muted/20 hover:bg-muted/40 transition-colors">
                    <Switch
                      id="include-inactive"
                      checked={filters.incluirUbicacionesInactivas}
                      onCheckedChange={c => {
                        setFilters(f => {
                          let nextUbi = f.ubicacionId;
                          if (!c && nextUbi !== "all") {
                            const loc = filtersData?.ubicaciones?.find(u => u.id.toString() === nextUbi);
                            if (loc && !loc.activa) {
                              nextUbi = "all";
                            }
                          }
                          return { ...f, incluirUbicacionesInactivas: c, ubicacionId: nextUbi };
                        });
                        setPage(1);
                      }}
                      data-testid="switch-incluir-inactivas"
                    />
                    <Label htmlFor="include-inactive" className="cursor-pointer font-medium text-sm flex-1">
                      Incluir sitios inactivos
                    </Label>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4 relative">
          {isFetching && !isLoading && (
            <div className="absolute -top-3 right-0 rounded-md bg-primary/10 text-primary text-xs px-2 py-1 flex items-center gap-1.5 animate-pulse z-10 font-medium">
              <Loader2 className="w-3 h-3 animate-spin" /> Actualizando...
            </div>
          )}

          {isError ? (
            <div className="py-16 text-center flex flex-col items-center justify-center border border-destructive/20 rounded-lg bg-destructive/5">
              <AlertCircle className="w-12 h-12 mb-4 text-destructive/40" />
              <h3 className="text-lg font-medium text-foreground mb-1">Error al cargar</h3>
              <p className="text-sm text-muted-foreground max-w-sm">
                Ocurrió un problema al obtener el historial de movimientos. Por favor, intenta nuevamente.
              </p>
            </div>
          ) : isLoading && !data ? (
            <div className="py-24 text-center flex flex-col items-center justify-center border border-border rounded-lg bg-card/40">
              <Loader2 className="w-10 h-10 animate-spin mb-4 text-primary/30" />
              <p className="text-sm text-muted-foreground font-medium">Cargando historial de movimientos...</p>
            </div>
          ) : !data?.movimientos || data.movimientos.length === 0 ? (
            <div className="py-16 text-center flex flex-col items-center justify-center border border-dashed rounded-lg bg-card/40">
              <History className="w-12 h-12 mb-4 text-muted-foreground/30" />
              <h3 className="text-lg font-medium text-foreground mb-1">Sin resultados</h3>
              <p className="text-sm text-muted-foreground max-w-sm">
                No se encontraron movimientos que coincidan con los filtros seleccionados. Intenta ajustar tu búsqueda.
              </p>
              {(filters.buscar || filters.tipos.length > 0 || filters.productoId !== 'all' || filters.ubicacionId !== 'all' || filters.usuarioId !== 'all' || filters.desde || filters.hasta) && (
                <Button variant="outline" size="sm" className="mt-4" onClick={handleClearFilters} data-testid="button-clear-filters-empty">
                  Limpiar filtros
                </Button>
              )}
            </div>
          ) : (
            <>
              {/* Desktop Table Layout */}
              <Card className="hidden md:block overflow-hidden border-border">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30 hover:bg-muted/30">
                        <TableHead className="w-[140px] whitespace-nowrap">Fecha</TableHead>
                        <TableHead className="whitespace-nowrap">Tipo</TableHead>
                        <TableHead className="min-w-[180px]">Producto</TableHead>
                        <TableHead className="whitespace-nowrap">Rollo / Serie</TableHead>
                        <TableHead className="whitespace-nowrap">Sitio</TableHead>
                        <TableHead className="text-right whitespace-nowrap">Cantidad</TableHead>
                        <TableHead className="whitespace-nowrap">Usuario</TableHead>
                        <TableHead className="whitespace-nowrap">Documento</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.movimientos.map((row) => {
                        const cant = parseFloat(row.cantidad);
                        const cantColor = cant > 0 ? "text-emerald-600 dark:text-emerald-400" : cant < 0 ? "text-red-600 dark:text-red-400" : "text-foreground";
                        const sign = cant > 0 ? "+" : "";

                        return (
                          <TableRow key={row.id} data-testid={`row-movimiento-${row.id}`} className="hover:bg-muted/40 transition-colors">
                            <TableCell className="align-top py-3">
                              <div className="font-medium text-foreground">{formatDesktopDate(row.createdAt)}</div>
                              <div className="text-xs text-muted-foreground mt-0.5">{formatTime(row.createdAt)}</div>
                            </TableCell>
                            <TableCell className="align-top py-3">
                              <Badge className={`font-medium shadow-none ${TipoMovimientoColors[row.tipo]}`} variant="outline">
                                {TipoMovimientoLabels[row.tipo] || row.tipo}
                              </Badge>
                            </TableCell>
                            <TableCell className="align-top py-3 max-w-[220px] truncate" title={`${row.telaProducto} - ${row.colorProducto} (${row.skuProducto})`}>
                              <div className="font-semibold text-foreground truncate">{row.telaProducto}</div>
                              <div className="text-xs text-muted-foreground mt-0.5 truncate">{row.colorProducto} &middot; {row.skuProducto}</div>
                            </TableCell>
                            <TableCell className="align-top py-3">
                              <Link href={row.referenciaRolloRuta} className="text-primary hover:text-primary/80 hover:underline font-mono text-sm tracking-tight" data-testid={`link-rollo-${row.rolloId}`}>
                                {row.serie}
                              </Link>
                            </TableCell>
                            <TableCell className="align-top py-3">
                              <div className="flex flex-col items-start gap-1">
                                <span className="font-medium text-sm text-foreground">{row.nombreUbicacion}</span>
                                {!row.ubicacionActiva && <Badge variant="secondary" className="text-[10px] h-4 px-1.5 font-medium py-0 border-transparent bg-muted text-muted-foreground">Inactiva</Badge>}
                              </div>
                            </TableCell>
                            <TableCell className="align-top py-3 text-right">
                              <div className={`font-bold text-sm tracking-tight ${cantColor}`}>
                                {sign}{cant} <span className="text-xs font-normal opacity-70 ml-0.5">{row.unidadProducto.toLowerCase()}</span>
                              </div>
                              <div className="text-[11px] text-muted-foreground font-medium mt-1">Saldo: {row.saldoPosterior}</div>
                            </TableCell>
                            <TableCell className="align-top py-3">
                              <div className="text-sm font-medium text-foreground truncate max-w-[120px]" title={row.nombreUsuario}>{row.nombreUsuario}</div>
                              <div className="text-[11px] text-muted-foreground mt-0.5 truncate max-w-[120px]">@{row.username}</div>
                            </TableCell>
                            <TableCell className="align-top py-3">
                              {row.documentoRuta ? (
                                <a
                                  href={`${baseUrl}${row.documentoRuta}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:text-primary/80 hover:underline bg-primary/5 hover:bg-primary/10 px-2 py-1 rounded-md transition-colors"
                                  title="Abrir documento"
                                  data-testid={`link-doc-${row.id}`}
                                >
                                  <FileText className="w-3.5 h-3.5" />
                                  <span>{row.documentoEtiqueta || `${row.documentoTipo} ${row.documentoId}`}</span>
                                </a>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground/70 bg-muted/30 px-2 py-1 rounded-md">
                                  <span className="w-3.5 h-3.5 flex items-center justify-center border border-dashed rounded-sm border-current opacity-70">
                                    <span className="w-1.5 h-[1px] bg-current"></span>
                                  </span>
                                  Sin documento
                                </span>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </Card>

              {/* Mobile Cards Layout */}
              <div className="grid grid-cols-1 gap-4 md:hidden">
                {data.movimientos.map((row) => {
                  const cant = parseFloat(row.cantidad);
                  const cantColor = cant > 0 ? "text-emerald-600 dark:text-emerald-400" : cant < 0 ? "text-red-600 dark:text-red-400" : "text-foreground";
                  const sign = cant > 0 ? "+" : "";

                  return (
                    <div key={row.id} className="border border-border/80 rounded-xl p-4 space-y-3.5 bg-card shadow-sm" data-testid={`card-movimiento-${row.id}`}>
                      <div className="flex justify-between items-start gap-3">
                        <div className="space-y-1.5">
                          <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">{formatMobileDateTime(row.createdAt)}</div>
                          <Badge className={`font-medium shadow-none ${TipoMovimientoColors[row.tipo]}`} variant="outline">
                            {TipoMovimientoLabels[row.tipo] || row.tipo}
                          </Badge>
                        </div>
                        <div className="text-right">
                          <div className={`font-bold tracking-tight ${cantColor}`}>
                            {sign}{cant} <span className="text-xs font-normal opacity-70 ml-0.5">{row.unidadProducto.toLowerCase()}</span>
                          </div>
                          <div className="text-[11px] font-medium text-muted-foreground mt-1">Saldo: {row.saldoPosterior}</div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-x-3 gap-y-3 text-sm pt-3 border-t border-border/50">
                        <div className="col-span-2 bg-muted/20 p-2.5 rounded-lg border border-border/40">
                          <span className="text-[10px] uppercase font-semibold tracking-wider text-muted-foreground block mb-0.5">Producto</span>
                          <div className="font-semibold text-foreground truncate">{row.telaProducto} - {row.colorProducto}</div>
                          <div className="text-xs font-medium text-muted-foreground mt-0.5">{row.skuProducto}</div>
                        </div>

                        <div>
                          <span className="text-[10px] uppercase font-semibold tracking-wider text-muted-foreground block mb-1">Rollo</span>
                          <Link href={row.referenciaRolloRuta} className="text-primary hover:underline font-mono font-medium tracking-tight" data-testid={`mobile-link-rollo-${row.rolloId}`}>
                            {row.serie}
                          </Link>
                        </div>

                        <div>
                          <span className="text-[10px] uppercase font-semibold tracking-wider text-muted-foreground block mb-1">Sitio</span>
                          <div className="flex items-center gap-1.5 flex-wrap font-medium">
                            <span>{row.nombreUbicacion}</span>
                            {!row.ubicacionActiva && <Badge variant="secondary" className="text-[9px] h-3.5 px-1 py-0 uppercase">Inactiva</Badge>}
                          </div>
                        </div>

                        <div>
                          <span className="text-[10px] uppercase font-semibold tracking-wider text-muted-foreground block mb-1">Usuario</span>
                          <div className="font-medium text-foreground truncate">{row.nombreUsuario}</div>
                        </div>

                        <div>
                          <span className="text-[10px] uppercase font-semibold tracking-wider text-muted-foreground block mb-1">Documento</span>
                          {row.documentoRuta ? (
                            <a
                              href={`${baseUrl}${row.documentoRuta}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline truncate"
                              data-testid={`mobile-link-doc-${row.id}`}
                            >
                              <FileText className="w-3.5 h-3.5 flex-shrink-0" />
                              <span className="truncate">{row.documentoEtiqueta || `${row.documentoTipo} ${row.documentoId}`}</span>
                            </a>
                          ) : (
                            <span className="text-[11px] font-medium text-muted-foreground italic flex items-center gap-1">
                              <span className="w-3 h-3 flex items-center justify-center border border-dashed rounded-[2px] border-current opacity-70">
                                <span className="w-1 h-[1px] bg-current"></span>
                              </span>
                              Sin doc
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Pagination */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2 pb-6">
                <div className="text-sm font-medium text-muted-foreground order-2 sm:order-1">
                  Mostrando <span className="text-foreground">{data.movimientos.length}</span> de <span className="text-foreground">{data.total}</span> movimientos
                  {data.totalPages > 1 && <span className="ml-1 opacity-80">(Página {data.page} de {data.totalPages})</span>}
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto order-1 sm:order-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1 || isLoading}
                    onClick={() => setPage(p => p - 1)}
                    data-testid="button-prev-page"
                    className="flex-1 sm:flex-none font-medium"
                  >
                    Anterior
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= data.totalPages || isLoading}
                    onClick={() => setPage(p => p + 1)}
                    data-testid="button-next-page"
                    className="flex-1 sm:flex-none font-medium"
                  >
                    Siguiente
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
