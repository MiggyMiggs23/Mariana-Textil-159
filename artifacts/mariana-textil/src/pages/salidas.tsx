import { useState, useEffect } from "react";
import { useLocation, Link } from "wouter";
import {
  useListSalidas,
  getListSalidasQueryKey,
  useGetCurrentUser,
  useListLocations,
  useListUsers,
  useListProductos,
  exportarSalidas,
  getGetCurrentUserQueryKey,
  getListLocationsQueryKey,
  getListUsersQueryKey,
  getListProductosQueryKey,
  EstadoSalida,
} from "@workspace/api-client-react";
import { keepPreviousData } from "@tanstack/react-query";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  Search,
  Plus,
  Loader2,
  ArrowRight,
  Package,
  Clock,
  ArrowUpFromLine,
  Filter,
  Download,
  Calendar as CalendarIcon,
  X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { hasPermission, Modules } from "@/lib/permisos";
import { getApiErrorMessage } from "@/lib/api-error";
import { useLocationScope } from "@/lib/location-scope";
import { AppLayout } from "@/components/layout/app-layout";
import { useToast } from "@/hooks/use-toast";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";

function EstadoBadge({ estado }: { estado: string }) {
  const map: Record<string, { label: string; class: string }> = {
    SOLICITADA: { label: "Solicitada", class: "bg-blue-100 text-blue-800 border-blue-200" },
    ACEPTADA: { label: "Aceptada", class: "bg-indigo-100 text-indigo-800 border-indigo-200" },
    RECHAZADA: { label: "Rechazada", class: "bg-red-100 text-red-800 border-red-200" },
    PREPARADA: { label: "Preparada", class: "bg-purple-100 text-purple-800 border-purple-200" },
    ENVIADA: { label: "Enviada", class: "bg-amber-100 text-amber-800 border-amber-200" },
    RECIBIDA: { label: "Recibida", class: "bg-cyan-100 text-cyan-800 border-cyan-200" },
    CERRADA: { label: "Cerrada", class: "bg-green-100 text-green-800 border-green-200" },
    CANCELADA: { label: "Cancelada", class: "bg-slate-200 text-slate-800 border-slate-300" },
  };
  const config = map[estado] || { label: estado, class: "bg-slate-100 text-slate-800 border-slate-200" };
  return (
    <Badge variant="outline" className={`font-medium ${config.class}`}>
      {config.label}
    </Badge>
  );
}

export default function Salidas() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { selectedLocationId } = useLocationScope();

  const { data: user } = useGetCurrentUser({ query: { queryKey: getGetCurrentUserQueryKey() } });
  const { data: locations } = useListLocations({ query: { queryKey: getListLocationsQueryKey() } });
  const { data: users } = useListUsers({ query: { queryKey: getListUsersQueryKey() } });
  const { data: products } = useListProductos({ query: { queryKey: getListProductosQueryKey() } });

  const [page, setPage] = useState(1);
  const [folio, setFolio] = useState("");
  const [debouncedFolio, setDebouncedFolio] = useState("");
  const [origenId, setOrigenId] = useState<string>("all");
  const [destinoId, setDestinoId] = useState<string>("all");
  const [estado, setEstado] = useState<string>("all");
  const [usuarioId, setUsuarioId] = useState<string>("all");
  const [productoId, setProductoId] = useState<string>("all");
  const [fechaDesde, setFechaDesde] = useState<Date | undefined>();
  const [fechaHasta, setFechaHasta] = useState<Date | undefined>();

  const [isExporting, setIsExporting] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  // Debounce folio
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedFolio(folio);
      setPage(1);
    }, 500);
    return () => clearTimeout(timer);
  }, [folio]);

  let queryOrigen = origenId !== "all" ? Number(origenId) : undefined;
  if (selectedLocationId !== null && origenId === "all") {
    // If scope is limited to a location, default queryOrigen to it, unless they are filtering by it specifically
    queryOrigen = selectedLocationId;
  }

  const queryParams = {
    folio: debouncedFolio ? Number(debouncedFolio) : undefined,
    origenId: queryOrigen,
    destinoId: destinoId !== "all" ? Number(destinoId) : undefined,
    usuarioId: usuarioId !== "all" ? Number(usuarioId) : undefined,
    productoId: productoId !== "all" ? Number(productoId) : undefined,
    estados: estado !== "all" ? estado : undefined,
    fechaDesde: fechaDesde ? format(fechaDesde, 'yyyy-MM-dd') : undefined,
    fechaHasta: fechaHasta ? format(fechaHasta, 'yyyy-MM-dd') : undefined,
    page,
    pageSize: 100
  };

  const { data: salidasResult, isLoading, error } = useListSalidas(queryParams, {
    query: {
      placeholderData: keepPreviousData,
      queryKey: getListSalidasQueryKey(queryParams)
    }
  });

  const canCreate = user ? hasPermission(user, Modules.SALIDAS, 'crear') : false;
  const displayItems = salidasResult?.items ?? [];

  const handleExport = async () => {
    setIsExporting(true);
    try {
      // Provide custom params directly if the fetch API supports it in the custom fetch, or let the generated hook handle it if no params.
      // The generated hook does not accept ListSalidasParams for export, so it downloads everything or whatever the default is.
      const blob = await exportarSalidas();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `salidas-${format(new Date(), 'yyyy-MM-dd')}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e: any) {
      toast({ title: "Error al exportar", description: getApiErrorMessage(e), variant: "destructive" });
    } finally {
      setIsExporting(false);
    }
  };

  const resetFilters = () => {
    setOrigenId("all");
    setDestinoId("all");
    setEstado("all");
    setUsuarioId("all");
    setProductoId("all");
    setFechaDesde(undefined);
    setFechaHasta(undefined);
    setFolio("");
    setPage(1);
  };

  const activeFilterCount = [
    origenId !== "all",
    destinoId !== "all",
    estado !== "all",
    usuarioId !== "all",
    productoId !== "all",
    !!fechaDesde,
    !!fechaHasta,
    !!folio
  ].filter(Boolean).length;

  return (
    <AppLayout>
      <div className="space-y-6 max-w-7xl mx-auto pb-12 animate-in fade-in duration-300">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-2">
              <ArrowUpFromLine className="w-8 h-8 text-primary" />
              Salidas
            </h1>
            <p className="text-muted-foreground mt-1">Historial completo de salidas y movimientos entre almacenes.</p>
          </div>
          <div className="flex w-full items-center gap-3 sm:w-auto">
            <Button
              variant="outline"
              onClick={handleExport}
              disabled={isExporting}
              className="gap-2 shadow-sm h-10 bg-white"
            >
              {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              Excel
            </Button>
            {canCreate && (
              <Link href="/salidas/nueva">
                <Button data-testid="btn-create-salida" className="gap-2 shadow-sm h-10 px-5">
                  <Plus className="w-4 h-4" />
                  Nueva Salida
                </Button>
              </Link>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-4 border-b border-slate-100 bg-slate-50 flex flex-wrap gap-4 items-center justify-between">
            <div className="flex items-center gap-4 flex-1">
              <div className="relative w-full max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  data-testid="filter-folio"
                  placeholder="Buscar por folio..."
                  value={folio}
                  onChange={(e) => setFolio(e.target.value)}
                  className="pl-9 bg-white border-slate-200"
                  type="number"
                  min="1"
                />
              </div>
              <Button
                variant={showFilters || activeFilterCount > 0 ? "secondary" : "outline"}
                onClick={() => setShowFilters(!showFilters)}
                className="gap-2 bg-white"
              >
                <Filter className="w-4 h-4" />
                Filtros
                {activeFilterCount > 0 && (
                  <Badge variant="secondary" className="ml-1 px-1.5 h-5">{activeFilterCount}</Badge>
                )}
              </Button>
            </div>
          </div>

          {showFilters && (
            <div className="p-4 border-b border-slate-100 bg-white grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 animate-in slide-in-from-top-2">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Estado</label>
                <Select value={estado} onValueChange={(val) => { setEstado(val); setPage(1); }}>
                  <SelectTrigger className="w-full bg-white"><SelectValue placeholder="Estado (Todos)" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los estados</SelectItem>
                    {Object.values(EstadoSalida).map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Origen</label>
                <Select value={origenId} onValueChange={(val) => { setOrigenId(val); setPage(1); }}>
                  <SelectTrigger className="w-full bg-white"><SelectValue placeholder="Origen (Todos)" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los orígenes</SelectItem>
                    {locations?.map(l => <SelectItem key={l.id} value={String(l.id)}>{l.nombre}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Destino</label>
                <Select value={destinoId} onValueChange={(val) => { setDestinoId(val); setPage(1); }}>
                  <SelectTrigger className="w-full bg-white"><SelectValue placeholder="Destino (Todos)" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los destinos</SelectItem>
                    {locations?.map(l => <SelectItem key={l.id} value={String(l.id)}>{l.nombre}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Usuario (Solicitante)</label>
                <Select value={usuarioId} onValueChange={(val) => { setUsuarioId(val); setPage(1); }}>
                  <SelectTrigger className="w-full bg-white"><SelectValue placeholder="Usuario (Todos)" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los usuarios</SelectItem>
                    {users?.map(u => <SelectItem key={u.id} value={String(u.id)}>{u.nombre}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Producto</label>
                <Select value={productoId} onValueChange={(val) => { setProductoId(val); setPage(1); }}>
                  <SelectTrigger className="w-full bg-white"><SelectValue placeholder="Producto (Todos)" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los productos</SelectItem>
                    {products?.map(p => <SelectItem key={p.id} value={String(p.id)}>{p.sku} - {p.tela}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Desde</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left font-normal bg-white">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {fechaDesde ? format(fechaDesde, 'dd/MM/yyyy') : <span>Seleccionar fecha</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar mode="single" selected={fechaDesde} onSelect={(d) => { setFechaDesde(d); setPage(1); }} initialFocus />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Hasta</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left font-normal bg-white">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {fechaHasta ? format(fechaHasta, 'dd/MM/yyyy') : <span>Seleccionar fecha</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar mode="single" selected={fechaHasta} onSelect={(d) => { setFechaHasta(d); setPage(1); }} initialFocus />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-1.5 flex items-end">
                <Button variant="ghost" onClick={resetFilters} className="w-full text-slate-500 hover:text-slate-900">
                  <X className="w-4 h-4 mr-2" />
                  Limpiar Filtros
                </Button>
              </div>
            </div>
          )}

          <div className="p-0 min-h-[400px]">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center h-[400px] text-slate-400">
                <Loader2 className="w-8 h-8 animate-spin mb-4" />
                <p>Cargando salidas...</p>
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center h-[400px] text-red-500">
                <p>{getApiErrorMessage(error)}</p>
              </div>
            ) : displayItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-[400px] text-slate-400">
                <Package className="w-12 h-12 mb-4 opacity-20" />
                <p className="text-lg font-medium text-slate-600">No hay resultados</p>
                <p className="text-sm">Ajusta los filtros para ver más resultados.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {displayItems.map((salida) => (
                  <Link
                    key={salida.id}
                    href={`/salidas/${salida.id}`}
                    data-testid={`row-salida-${salida.id}`}
                    className={`flex flex-col sm:flex-row sm:items-center p-4 hover:bg-slate-50 transition-colors gap-4 group ${salida.estado === 'CANCELADA' ? 'opacity-60' : ''}`}
                  >
                    <div className="w-20 shrink-0">
                      <p className="text-xs font-semibold text-slate-500 mb-1">FOLIO</p>
                      <p className={`text-lg font-bold transition-colors ${salida.estado === 'CANCELADA' ? 'line-through text-slate-500' : 'text-slate-900 group-hover:text-primary'}`}>
                        {String(salida.folio).padStart(5, '0')}
                      </p>
                    </div>

                    <div className="flex-1 min-w-0 grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className={salida.estado === 'CANCELADA' ? 'line-through' : ''}>
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-medium text-slate-900 truncate">{salida.nombreOrigen}</p>
                          <ArrowRight className="w-4 h-4 text-slate-300 shrink-0" />
                          <p className="font-medium text-slate-900 truncate">{salida.nombreDestino}</p>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-slate-500">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {format(new Date(salida.createdAt), "dd MMM yyyy, HH:mm", { locale: es })}
                          </span>
                          <span>•</span>
                          <span className="truncate">{salida.nombreSolicitadoPor}</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-start sm:justify-end gap-6">
                        <div className="text-left sm:text-right">
                          <p className="text-xs font-semibold text-slate-500 mb-1">CANTIDAD</p>
                          <p className="text-sm font-medium text-slate-900">
                            {salida.totalCantidadSolicitada} <span className="text-slate-400 font-normal">solicitada</span>
                          </p>
                          {Number(salida.totalCantidadEnviada) > 0 && (
                            <p className="text-xs text-amber-600 mt-0.5">{salida.totalCantidadEnviada} enviada</p>
                          )}
                        </div>
                        <div className="w-[100px] flex justify-end">
                          <EstadoBadge estado={salida.estado} />
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {salidasResult && Math.ceil(salidasResult.total / salidasResult.pageSize) > 1 && (
            <div className="p-4 border-t border-slate-100 flex items-center justify-between bg-slate-50">
              <p className="text-sm text-slate-500">
                Mostrando página {page} de {Math.ceil(salidasResult.total / salidasResult.pageSize)} ({salidasResult.total} resultados)
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  data-testid="btn-page-previous"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  Anterior
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  data-testid="btn-page-next"
                  onClick={() => setPage(p => Math.min(Math.ceil(salidasResult.total / salidasResult.pageSize), p + 1))}
                  disabled={page === Math.ceil(salidasResult.total / salidasResult.pageSize)}
                >
                  Siguiente
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
