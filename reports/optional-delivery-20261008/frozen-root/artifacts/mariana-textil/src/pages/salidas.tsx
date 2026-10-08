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
  X,
  XSquare
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
import { getSalidaEstadoLabel, SalidaEstadoBadge } from "@/components/salida-estado-badge";
import { SalidaVentaEntrega } from "@/components/salida-venta-entrega";
import { SalidaCancelDialog } from "@/components/salida-cancel-dialog";
import { canCancelSalidaHistory } from "@/lib/salida-cancelacion";

import { SalidasExtraordinarias } from "@/components/salidas-extraordinarias";

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
      queryKey: getListSalidasQueryKey(queryParams),
      refetchInterval: 30_000,
      refetchOnWindowFocus: true,
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
              <div className="flex flex-wrap gap-2">
                <Link href="/salidas/nueva"><Button data-testid="btn-create-salida" className="gap-2 shadow-sm h-10 px-5"><Plus className="w-4 h-4" />Nueva Salida</Button></Link>
                <Link href="/salidas/nueva?modalidad=VENTA_CLIENTE"><Button data-testid="btn-create-salida-venta" className="gap-2 shadow-sm h-10 px-5 bg-sale-action text-sale-action-foreground hover:bg-sale-action/90"><Plus className="w-4 h-4" />Nueva salida para venta a cliente</Button></Link>
              </div>
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
                    {Object.values(EstadoSalida).map(e => <SelectItem key={e} value={e}>{getSalidaEstadoLabel(e)}</SelectItem>)}
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
              <div className="divide-y divide-slate-100">
                {displayItems.map((salida) => {
                  const canCancel = canCancelSalidaHistory(salida, user);
                  const isCancelled = salida.estado === 'CANCELADA';
                  const qtySolicitada = Number(salida.totalCantidadSolicitada);
                  const qtyEnviada = Number(salida.totalCantidadEnviada);
                  const isSameQty = qtySolicitada === qtyEnviada;

                  return (
                    <div
                      key={salida.id}
                      data-testid={`row-salida-${salida.id}`}
                      className={`p-3 sm:p-5 transition-colors hover:bg-slate-50/80 ${
                        isCancelled ? 'bg-slate-100/70 [&_a]:text-slate-600 [&_p]:text-slate-600' : ''
                      }`}
                    >
                      <div className="grid grid-cols-[minmax(0,1fr)_64px_92px] sm:grid-cols-[minmax(0,1fr)_112px_136px] md:grid-cols-[minmax(0,1fr)_160px_180px] gap-2 sm:gap-6 items-start">
                        {/* LEFT: Folio + Date + Origin -> Destination/Client */}
                        <div className="min-w-0 flex flex-col gap-1.5">
                          <div className="flex flex-col items-start gap-1">
                            <Link
                              href={`/salidas/${salida.id}`}
                              className="max-w-full break-words text-sm sm:text-base font-bold text-primary hover:text-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
                              data-testid={`link-salida-${salida.id}`}
                            >
                              {salida.folioFormateado}
                            </Link>
                            <span className="text-[11px] sm:text-xs text-slate-500">
                              {format(new Date(salida.createdAt), "dd MMM yyyy", { locale: es })}
                            </span>
                          </div>
                          <div className="flex flex-col items-start gap-1 sm:flex-row sm:flex-wrap text-xs sm:text-sm text-slate-700">
                            <span className="max-w-full break-words font-medium">{salida.nombreOrigen}</span>
                            <ArrowRight aria-hidden="true" className="w-3 h-3 text-slate-400 shrink-0 rotate-90 sm:rotate-0 sm:mt-1" />
                            <span className="max-w-full break-words font-medium">
                              {salida.modalidad === "VENTA_CLIENTE"
                                ? (salida.nombreCliente || (salida.clienteId ? `Cliente #${salida.clienteId}` : "Cliente de venta"))
                                : salida.nombreDestino}
                            </span>
                          </div>
                        </div>

                        {/* CENTER: Quantity */}
                        <div className="min-w-0 text-left tabular-nums [overflow-wrap:anywhere]">
                          {isSameQty ? (
                            <div className="text-sm font-medium text-slate-900">
                              {formatNumber(qtySolicitada, { kind: "quantity" })}
                            </div>
                          ) : (
                            <div className="flex flex-col gap-1.5">
                              <div className="flex flex-col sm:flex-row sm:items-center gap-0.5 sm:gap-2">
                                <span className="text-[10px] sm:text-xs font-semibold text-slate-400 tracking-wide uppercase sm:w-20">SOLICITADA</span>
                                <span className="text-xs sm:text-sm font-medium text-slate-500">{formatNumber(qtySolicitada, { kind: "quantity" })}</span>
                              </div>
                              <div className="flex flex-col sm:flex-row sm:items-center gap-0.5 sm:gap-2">
                                <span className="text-[10px] sm:text-xs font-bold text-amber-600 tracking-wide uppercase sm:w-20">ENVIADA</span>
                                <span className="text-xs sm:text-sm font-bold text-amber-700 bg-amber-50 px-1 py-0.5 rounded -ml-1 sm:ml-0">{formatNumber(qtyEnviada, { kind: "quantity" })}</span>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* RIGHT: Status + Actions */}
                        <div className="flex flex-col items-end gap-3 text-right">
                          <SalidaEstadoBadge estado={salida.estado} modalidad={salida.modalidad} documentoVenta={salida.documentoVenta} autorizada={salida.autorizada} className="max-w-full whitespace-normal justify-center px-2 py-1 text-center text-xs sm:text-sm !font-bold leading-tight" />
                          <div className="flex flex-col items-end gap-1.5">
                            {salida.modalidad === "VENTA_CLIENTE" && (
                              <SalidaVentaEntrega
                                salidaId={salida.id}
                                estado={salida.estado}
                                historyOnly
                              />
                            )}
                            {canCancel && !isCaja && (
                              <SalidaCancelDialog
                                salida={salida}
                                user={user}
                                canCancel={canCancel}
                                isHistory
                                renderTrigger={({ onClick }) => (
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    data-testid={`btn-history-cancel-${salida.id}`}
                                    aria-label={`Cancelar salida ${salida.folioFormateado}`}
                                    onClick={onClick}
                                    className="h-7 px-2.5 text-xs font-medium text-slate-500 hover:text-red-700 hover:bg-red-50/80 transition-colors"
                                  >
                                    Cancelar
                                  </Button>
                                )}
                              />
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
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
