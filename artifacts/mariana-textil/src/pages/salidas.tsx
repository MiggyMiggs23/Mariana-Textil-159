import { useState, useEffect } from "react";
import { useLocation, Link } from "wouter";
import { 
  useListSalidas, 
  getListSalidasQueryKey,
  useGetCurrentUser,
  useListLocations,
  useGetSalidasPendientesCount,
  getGetCurrentUserQueryKey,
  getListLocationsQueryKey,
  getGetSalidasPendientesCountQueryKey
} from "@workspace/api-client-react";
import { keepPreviousData } from "@tanstack/react-query";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  FileText,
  Search,
  Plus,
  Loader2,
  ArrowRight,
  Package,
  Clock,
  ArrowUpFromLine
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { hasPermission, Modules } from "@/lib/permisos";
import { getApiErrorMessage } from "@/lib/api-error";
import { useLocationScope } from "@/lib/location-scope";
import { SalidaCreateDialog } from "@/components/salidas/salida-create-dialog";

import { AppLayout } from "@/components/layout/app-layout";

type TabConfig = {
  id: string;
  label: string;
  estados?: string;
  enforcedSide?: "origen" | "destino";
};

const TABS: TabConfig[] = [
  { id: "por-aceptar", label: "Por aceptar", estados: "SOLICITADA", enforcedSide: "origen" },
  { id: "por-preparar", label: "Por preparar", estados: "ACEPTADA", enforcedSide: "origen" },
  { id: "por-enviar", label: "Por enviar", estados: "PREPARADA", enforcedSide: "origen" },
  { id: "en-transito", label: "En tránsito", estados: "ENVIADA", enforcedSide: "origen" },
  { id: "por-recibir", label: "Por recibir", estados: "ENVIADA,RECIBIDA", enforcedSide: "destino" },
  { id: "por-cerrar", label: "Por cerrar", estados: "RECIBIDA", enforcedSide: "destino" },
  { id: "historial", label: "Historial", estados: "CERRADA,RECHAZADA,CANCELADA" },
];

function EstadoBadge({ estado }: { estado: string }) {
  const map: Record<string, { label: string; class: string }> = {
    SOLICITADA: { label: "Solicitada", class: "bg-blue-100 text-blue-800 border-blue-200" },
    ACEPTADA: { label: "Aceptada", class: "bg-indigo-100 text-indigo-800 border-indigo-200" },
    RECHAZADA: { label: "Rechazada", class: "bg-red-100 text-red-800 border-red-200" },
    PREPARADA: { label: "Preparada", class: "bg-purple-100 text-purple-800 border-purple-200" },
    ENVIADA: { label: "Enviada", class: "bg-amber-100 text-amber-800 border-amber-200" },
    RECIBIDA: { label: "Recibida", class: "bg-cyan-100 text-cyan-800 border-cyan-200" },
    CERRADA: { label: "Cerrada", class: "bg-green-100 text-green-800 border-green-200" },
    CANCELADA: { label: "Cancelada", class: "bg-red-100 text-red-800 border-red-200" },
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
  const { selectedLocationId } = useLocationScope();
  const { data: user } = useGetCurrentUser({ query: { queryKey: getGetCurrentUserQueryKey() } });
  const { data: locations } = useListLocations({ query: { queryKey: getListLocationsQueryKey() } });
  const { data: pendientes } = useGetSalidasPendientesCount({
    query: {
      enabled: !!user,
      queryKey: getGetSalidasPendientesCountQueryKey(),
    },
  });

  const [activeTab, setActiveTab] = useState<string>("por-aceptar");
  const [page, setPage] = useState(1);
  const [folio, setFolio] = useState("");
  const [debouncedFolio, setDebouncedFolio] = useState("");
  const [origenId, setOrigenId] = useState<string>("all");
  const [destinoId, setDestinoId] = useState<string>("all");
  
  const [createOpen, setCreateOpen] = useState(false);

  // Debounce folio
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedFolio(folio);
      setPage(1);
    }, 500);
    return () => clearTimeout(timer);
  }, [folio]);

  const activeTabConfig = TABS.find(t => t.id === activeTab);

  let queryOrigen = origenId !== "all" ? Number(origenId) : undefined;
  let queryDestino = destinoId !== "all" ? Number(destinoId) : undefined;

  if (selectedLocationId !== null) {
    if (activeTabConfig?.enforcedSide === "origen") {
      queryOrigen = selectedLocationId;
    } else if (activeTabConfig?.enforcedSide === "destino") {
      queryDestino = selectedLocationId;
    }
  }

  const queryParams = {
    estados: activeTabConfig?.estados,
    folio: debouncedFolio ? Number(debouncedFolio) : undefined,
    origenId: queryOrigen,
    destinoId: queryDestino,
    page,
    pageSize: activeTab === "por-recibir" || activeTab === "por-cerrar" ? 100 : 20
  };

  const { data: salidasResult, isLoading, error } = useListSalidas(queryParams, {
    query: {
      placeholderData: keepPreviousData,
      queryKey: getListSalidasQueryKey(queryParams)
    }
  });

  const canCreate = user ? hasPermission(user, Modules.SALIDAS, 'crear') : false;
  const rawItems = salidasResult?.items ?? [];
  const displayItems = activeTab === "por-recibir"
    ? rawItems.filter(
        (salida) =>
          salida.estado === "ENVIADA" ||
          (salida.estado === "RECIBIDA" && salida.diferenciasPendientes),
      )
    : activeTab === "por-cerrar"
      ? rawItems.filter((salida) => !salida.diferenciasPendientes)
      : rawItems;
  const trayScopeLabel =
    activeTabConfig?.enforcedSide === "origen"
      ? "Operación de origen"
      : activeTabConfig?.enforcedSide === "destino"
        ? "Operación de destino"
        : "Consulta histórica";

  return (
    <AppLayout>
      <div className="space-y-6 max-w-7xl mx-auto pb-12 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-2">
            <ArrowUpFromLine className="w-8 h-8 text-primary" />
            Salidas
          </h1>
          <p className="text-muted-foreground mt-1">Gestiona los movimientos de mercancía entre sucursales.</p>
        </div>
        <div className="flex w-full items-center gap-3 sm:w-auto">
          <div
            className="rounded-lg border bg-card px-3 py-2 text-sm shadow-sm"
            data-testid="salidas-pending-count"
          >
            <span className="text-muted-foreground">Pendientes </span>
            <span className="font-bold text-foreground">{pendientes?.count ?? 0}</span>
          </div>
          {canCreate && (
            <Button data-testid="btn-create-salida" onClick={() => setCreateOpen(true)} className="ml-auto gap-2 shadow-sm h-10 px-5 sm:ml-0">
              <Plus className="w-4 h-4" />
              Nueva Solicitud
            </Button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row gap-4 items-center">
          <div className="relative flex-1 w-full max-w-sm">
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
          <Select
            value={origenId}
            onValueChange={(val) => { setOrigenId(val); setPage(1); }}
            disabled={activeTabConfig?.enforcedSide === "origen" && selectedLocationId !== null}
          >
            <SelectTrigger data-testid="filter-origen" className="w-full sm:w-[200px] bg-white">
              <SelectValue placeholder="Origen (Todos)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Origen (Todos)</SelectItem>
              {locations?.map(l => (
                <SelectItem key={l.id} value={String(l.id)}>{l.nombre}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={destinoId}
            onValueChange={(val) => { setDestinoId(val); setPage(1); }}
            disabled={activeTabConfig?.enforcedSide === "destino" && selectedLocationId !== null}
          >
            <SelectTrigger data-testid="filter-destino" className="w-full sm:w-[200px] bg-white">
              <SelectValue placeholder="Destino (Todos)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Destino (Todos)</SelectItem>
              {locations?.map(l => (
                <SelectItem key={l.id} value={String(l.id)}>{l.nombre}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); setPage(1); }}>
          <div className="border-b border-slate-100 px-4 py-2 text-xs font-medium text-muted-foreground" data-testid="tray-scope">
            {trayScopeLabel}
          </div>
          <div className="px-4 pt-4 border-b border-slate-200 w-full overflow-x-auto custom-scrollbar">
            <TabsList className="bg-transparent p-0 h-auto gap-6 justify-start w-max">
              {TABS.map(tab => (
                <TabsTrigger
                  key={tab.id}
                  value={tab.id}
                  data-testid={`tab-${tab.id}`}
                  className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-1 pb-3 pt-2 text-sm font-medium text-slate-500 data-[state=active]:text-primary transition-none"
                >
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
          
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
                <p className="text-lg font-medium text-slate-600">No hay salidas</p>
                <p className="text-sm">No se encontraron salidas en esta bandeja.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {displayItems.map((salida) => (
                  <Link 
                    key={salida.id} 
                    href={`/salidas/${salida.id}`}
                    data-testid={`row-salida-${salida.id}`}
                    className="flex flex-col sm:flex-row sm:items-center p-4 hover:bg-slate-50 transition-colors gap-4 group"
                  >
                    <div className="w-20 shrink-0">
                      <p className="text-xs font-semibold text-slate-500 mb-1">FOLIO</p>
                      <p className="text-lg font-bold text-slate-900 group-hover:text-primary transition-colors">
                        {String(salida.folio).padStart(5, '0')}
                      </p>
                    </div>
                    
                    <div className="flex-1 min-w-0 grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
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
            <div className="p-4 border-t border-slate-100 flex items-center justify-between bg-slate-50/50">
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
        </Tabs>
      </div>

      <SalidaCreateDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
    </AppLayout>
  );
}
