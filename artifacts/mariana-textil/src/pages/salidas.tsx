import { useState, useEffect } from "react";
import { useLocation, Link } from "wouter";
import { useHistoryEntryState } from "@/lib/internal-navigation";
import {
  useListSalidas,
  getListSalidasQueryKey,
  useGetCurrentUser,
  useGetUbicacionesSalida,
  useListUsers,
  useListProductos,
  exportarSalidas,
  getGetCurrentUserQueryKey,
  getGetUbicacionesSalidaQueryKey,
  getListUsersQueryKey,
  getListProductosQueryKey,
  EstadoSalida,
} from "@workspace/api-client-react";
import { keepPreviousData } from "@tanstack/react-query";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { formatNumber, formatUnit } from "@workspace/number-format";
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
import { RecepcionSalidas } from "@/components/recepcion-salidas";
import { SalidaMostrador } from "@/components/salida-mostrador";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { SalidasExtraordinarias } from "@/components/salidas-extraordinarias";

function EstadoBadge({ estado }: { estado: string }) {
  const map: Record<string, { label: string; class: string }> = {
    ARMANDO: { label: "Armando", class: "bg-blue-100 text-blue-800 border-blue-200" },
    EN_TRANSITO: { label: "En tránsito", class: "bg-amber-100 text-amber-800 border-amber-200" },
    RECIBIDA: { label: "Recibida", class: "bg-cyan-100 text-cyan-800 border-cyan-200" },
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
  const requestedTab = new URLSearchParams(window.location.search).get("tab");
  const initialTab = requestedTab === "recepcion" || requestedTab === "mostrador"
    ? requestedTab
    : "historial";
  const [activeTab, setActiveTab] = useHistoryEntryState("salidas.tab", initialTab);

  const { data: user } = useGetCurrentUser({ query: { queryKey: getGetCurrentUserQueryKey() } });
  const isCaja = user?.rol === "CAJA";
  const { data: locations } = useGetUbicacionesSalida({ query: { queryKey: getGetUbicacionesSalidaQueryKey() } });
  const { data: users } = useListUsers({ query: { enabled: !isCaja, queryKey: getListUsersQueryKey() } });
  const { data: products } = useListProductos(undefined, { query: { enabled: !isCaja, queryKey: getListProductosQueryKey() } });

  const [page, setPage] = useHistoryEntryState("salidas.page", 1);
  const [search, setSearch] = useHistoryEntryState("salidas.search", "");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [origenId, setOrigenId] = useHistoryEntryState<string>("salidas.origen", "all");
  const [destinoId, setDestinoId] = useHistoryEntryState<string>("salidas.destino", "all");
  const [estado, setEstado] = useHistoryEntryState<string>("salidas.estado", "all");
  const [usuarioId, setUsuarioId] = useHistoryEntryState<string>("salidas.usuario", "all");
  const [productoId, setProductoId] = useHistoryEntryState<string>("salidas.producto", "all");
  const [fechaDesde, setFechaDesde] = useHistoryEntryState<Date | undefined>("salidas.desde", undefined);
  const [fechaHasta, setFechaHasta] = useHistoryEntryState<Date | undefined>("salidas.hasta", undefined);

  const [isExporting, setIsExporting] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 500);
    return () => clearTimeout(timer);
  }, [search]);

  let queryOrigen = origenId !== "all" ? Number(origenId) : undefined;
  if (!isCaja && selectedLocationId !== null && origenId === "all") {
    // If scope is limited to a location, default queryOrigen to it, unless they are filtering by it specifically
    queryOrigen = selectedLocationId;
  }

  const queryParams = {
    search: debouncedSearch || undefined,
    origenId: queryOrigen,
    destinoId: !isCaja && destinoId !== "all" ? Number(destinoId) : undefined,
    usuarioId: !isCaja && usuarioId !== "all" ? Number(usuarioId) : undefined,
    productoId: !isCaja && productoId !== "all" ? Number(productoId) : undefined,
    estados: !isCaja && estado !== "all" ? estado : undefined,
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

  const canCreate = !isCaja && user ? hasPermission(user, Modules.SALIDAS, 'crear') : false;
  const displayItems = salidasResult?.items ?? [];

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const exportParams = {
        search: debouncedSearch || undefined,
        origenId: queryOrigen,
        destinoId: destinoId !== "all" ? Number(destinoId) : undefined,
        usuarioId: usuarioId !== "all" ? Number(usuarioId) : undefined,
        productoId: productoId !== "all" ? Number(productoId) : undefined,
        estados: estado !== "all" ? estado : undefined,
        fechaDesde: fechaDesde ? format(fechaDesde, 'yyyy-MM-dd') : undefined,
        fechaHasta: fechaHasta ? format(fechaHasta, 'yyyy-MM-dd') : undefined,
      };
      const blob = await exportarSalidas(exportParams);
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
    setSearch("");
    setPage(1);
  };

  const activeFilterCount = [
    origenId !== "all",
    !isCaja && destinoId !== "all",
    !isCaja && estado !== "all",
    !isCaja && usuarioId !== "all",
    !isCaja && productoId !== "all",
    !!fechaDesde,
    !!fechaHasta,
    !!search
  ].filter(Boolean).length;

  return (
    <AppLayout>
      <div className="space-y-6 max-w-7xl mx-auto pb-12 animate-in fade-in duration-300">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-2">
              <ArrowUpFromLine className="w-8 h-8 text-primary" />
              {isCaja ? "Salidas recibidas" : "Salidas"}
            </h1>
            <p className="text-muted-foreground mt-1">
              {isCaja
                ? `Mercancía enviada a ${user?.ubicacion?.nombre ?? "tu sitio"} para verificar contra la hoja foliada.`
                : "Historial completo de salidas y movimientos entre almacenes."}
            </p>
          </div>
          <div className="flex w-full items-center gap-3 sm:w-auto">
            {!isCaja && <Button
              variant="outline"
              onClick={handleExport}
              disabled={isExporting}
              className="gap-2 shadow-sm h-10 bg-white"
            >
              {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              Excel
            </Button>}
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

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="historial">Historial</TabsTrigger>
            <TabsTrigger value="recepcion">Recepción</TabsTrigger>
            {canCreate && <TabsTrigger value="mostrador">A mostrador</TabsTrigger>}
            {user?.rol === "ADMIN" && <TabsTrigger value="extraordinarias">Extraordinarias</TabsTrigger>}
          </TabsList>
        </Tabs>

        {activeTab === "recepcion" ? <RecepcionSalidas /> : activeTab === "mostrador" && canCreate ? <SalidaMostrador /> : activeTab === "extraordinarias" && user?.rol === "ADMIN" ? <SalidasExtraordinarias /> : (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-4 border-b border-slate-100 bg-slate-50 flex flex-wrap gap-4 items-center justify-between">
            <div className="flex items-center gap-4 flex-1">
              <div className="relative w-full max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  data-testid="filter-search"
                  placeholder="Buscar por folio (prefijo o número) o serie..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 bg-white border-slate-200"
                  type="text"
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
              {!isCaja && <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Estado</label>
                <Select value={estado} onValueChange={(val) => { setEstado(val); setPage(1); }}>
                  <SelectTrigger className="w-full bg-white"><SelectValue placeholder="Estado (Todos)" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los estados</SelectItem>
                    {Object.values(EstadoSalida).map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>}
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
              {!isCaja && <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Destino</label>
                <Select value={destinoId} onValueChange={(val) => { setDestinoId(val); setPage(1); }}>
                  <SelectTrigger className="w-full bg-white"><SelectValue placeholder="Destino (Todos)" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los destinos</SelectItem>
                    {locations?.map(l => <SelectItem key={l.id} value={String(l.id)}>{l.nombre}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>}
              {!isCaja && <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Usuario que armó</label>
                <Select value={usuarioId} onValueChange={(val) => { setUsuarioId(val); setPage(1); }}>
                  <SelectTrigger className="w-full bg-white"><SelectValue placeholder="Usuario (Todos)" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los usuarios</SelectItem>
                    {users?.map(u => <SelectItem key={u.id} value={String(u.id)}>{u.nombre}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>}
              {!isCaja && <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Producto</label>
                <Select value={productoId} onValueChange={(val) => { setProductoId(val); setPage(1); }}>
                  <SelectTrigger className="w-full bg-white"><SelectValue placeholder="Producto (Todos)" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los productos</SelectItem>
                    {products?.map(p => <SelectItem key={p.id} value={String(p.id)}>{p.sku} - {p.tela}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>}

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
              isCaja ? (
                <div className="overflow-x-auto">
                  <div className="grid min-w-[1150px] grid-cols-[80px_150px_160px_80px_100px_100px_100px_1fr_120px] gap-4 border-b border-slate-200 bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <span>Folio</span>
                    <span>Fecha y hora</span>
                    <span>Origen</span>
                    <span className="text-right">Rollos</span>
                    <span className="text-right">{formatUnit("METRO")}</span>
                    <span className="text-right">{formatUnit("KILO")}</span>
                    <span className="text-right">{formatUnit("BOLSA")}</span>
                    <span>Transportista</span>
                    <span>Estado</span>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {displayItems.map((salida) => {
                      const cancelled = salida.estado === "CANCELADA";
                      return (
                        <div
                          key={salida.id}
                          data-testid={`row-salida-${salida.id}`}
                          className={`grid min-w-[1150px] grid-cols-[80px_150px_160px_80px_100px_100px_100px_1fr_120px] items-center gap-4 px-4 py-4 transition-colors hover:bg-slate-50 ${cancelled ? "text-slate-500 opacity-70 line-through" : "text-slate-900"}`}
                        >
                          <Link href={`/salidas/${salida.id}`} className="font-bold text-primary underline underline-offset-4 hover:text-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2" data-testid={`link-salida-${salida.id}`}>{salida.folioFormateado}</Link>
                          <span className="text-sm">{format(new Date(salida.createdAt), "dd/MM/yyyy HH:mm", { locale: es })}</span>
                          <span className="truncate font-medium">{salida.nombreOrigen}</span>
                          <span className="text-right font-semibold tabular-nums">{formatNumber(salida.totalRollos ?? 0, { kind: "count" })}</span>
                          <span className="text-right tabular-nums">{formatNumber(salida.totalMetros, { kind: "quantity" })}</span>
                          <span className="text-right tabular-nums">{formatNumber(salida.totalKilos, { kind: "quantity" })}</span>
                           <span className="text-right tabular-nums">{formatNumber(salida.totalBolsas, { kind: "quantity" })}</span>
                          <span className="truncate">{salida.transportista || "—"}</span>
                          <span className={cancelled ? "no-underline" : ""}><EstadoBadge estado={salida.estado} /></span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
              <div className="divide-y divide-slate-100">
                {displayItems.map((salida) => (
                  <div
                    key={salida.id}
                    data-testid={`row-salida-${salida.id}`}
                    className={`flex flex-col sm:flex-row sm:items-center p-4 hover:bg-slate-50 transition-colors gap-4 group ${salida.estado === 'CANCELADA' ? 'opacity-60' : ''}`}
                  >
                    <div className="w-20 shrink-0">
                      <p className="text-xs font-semibold text-slate-500 mb-1">FOLIO</p>
                      <Link href={`/salidas/${salida.id}`} className={`text-lg font-bold text-primary underline underline-offset-4 hover:text-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${salida.estado === 'CANCELADA' ? 'line-through' : ''}`} data-testid={`mobile-link-salida-${salida.id}`}>{salida.folioFormateado}</Link>
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
                          <span className="truncate">{salida.nombreArmadoPor}</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-start sm:justify-end gap-6">
                        <div className="text-left sm:text-right">
                          <p className="text-xs font-semibold text-slate-500 mb-1">CANTIDAD</p>
                          <p className="text-sm font-medium text-slate-900">
                             {formatNumber(salida.totalCantidadSolicitada, { kind: "quantity" })} <span className="text-slate-400 font-normal">solicitada</span>
                          </p>
                          {Number(salida.totalCantidadEnviada) > 0 && (
                             <p className="text-xs text-amber-600 mt-0.5">{formatNumber(salida.totalCantidadEnviada, { kind: "quantity" })} enviada</p>
                          )}
                        </div>
                        <div className="w-[100px] flex justify-end">
                          <EstadoBadge estado={salida.estado} />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              )
            )}
          </div>

          {salidasResult && Math.ceil(salidasResult.total / salidasResult.pageSize) > 1 && (
            <div className="p-4 border-t border-slate-100 flex items-center justify-between bg-slate-50">
              <p className="text-sm text-slate-500">
                 Mostrando página {formatNumber(page, { kind: "count" })} de {formatNumber(Math.ceil(salidasResult.total / salidasResult.pageSize), { kind: "count" })} ({formatNumber(salidasResult.total, { kind: "count" })} resultados)
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
        )}
      </div>
    </AppLayout>
  );
}
