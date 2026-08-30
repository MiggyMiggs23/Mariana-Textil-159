import { useState, useRef, useEffect, useMemo } from "react";
import { Link } from "wouter";
import {
  useListSalidasExtraordinarias,
  getListSalidasExtraordinariasQueryKey,
  useCreateSalidaExtraordinaria,
  useGetUbicacionesSalida,
  useListRollos,
  MotivoSalidaExtraordinaria,
  getGetUbicacionesSalidaQueryKey,
  getListRollosQueryKey,
  getGetRolloQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { formatNumber, formatUnit } from "@workspace/number-format";
import {
  Barcode,
  Loader2,
  MapPin,
  Calendar as CalendarIcon,
  Filter,
  X,
  AlertTriangle,
  Info
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { useToast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/api-error";
import { CampoEscaneo } from "@/components/campo-escaneo";
import { interpretarCodigoEscaneado, type CodigoEscaneadoInterpretado, advertenciaSkuEscaneado } from "@workspace/scanned-code";
import { ConfirmacionTextoExacto } from "@/components/confirmacion-texto-exacto";

export function SalidasExtraordinarias() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [scannedSerie, setScannedSerie] = useState("");
  const [scannedCode, setScannedCode] = useState<CodigoEscaneadoInterpretado | null>(null);
  const [serieInput, setSerieInput] = useState("");

  const [motivo, setMotivo] = useState<MotivoSalidaExtraordinaria | "">("");
  const [justificacion, setJustificacion] = useState("");
  const [confirmationOpen, setConfirmationOpen] = useState(false);

  const uuidClienteRef = useRef<string>(crypto.randomUUID());
  const scannerInputRef = useRef<HTMLInputElement>(null);

  const { data: rollosData, isFetching: isFetchingRollos } = useListRollos(
    { serie: scannedSerie, estado: 'DISPONIBLE' as any },
    { query: { enabled: !!scannedSerie, retry: false, queryKey: getListRollosQueryKey({ serie: scannedSerie, estado: 'DISPONIBLE' as any }) } }
  );

  const rollo = rollosData?.items?.[0];

  const createMutation = useCreateSalidaExtraordinaria();

  const handleScan = (rawValue: string, codigoEntregado?: CodigoEscaneadoInterpretado) => {
    const codigo = codigoEntregado ?? interpretarCodigoEscaneado(rawValue);
    const serie = (codigo.serie ?? rawValue).trim().toUpperCase();
    if (!serie) return;

    if (serie === scannedSerie && rollo) {
      toast({
        title: "Rollo ya escaneado",
        description: `El rollo ${serie} ya está cargado.`,
      });
      setSerieInput("");
      return;
    }

    setScannedSerie(serie);
    setScannedCode(codigo);
    setSerieInput("");
    setMotivo("");
    setJustificacion("");
  };

  useEffect(() => {
    if (scannedSerie && !isFetchingRollos && rollosData?.items) {
      if (rollosData.items.length === 0) {
        toast({
          title: "Rollo no encontrado o no disponible",
          description: `No se encontró un rollo DISPONIBLE con serie ${scannedSerie}.`,
          variant: "destructive"
        });
        setScannedSerie("");
      } else {
        const found = rollosData.items[0];
        if (scannedCode) {
          const warning = advertenciaSkuEscaneado(scannedCode, found.skuProducto ?? "");
          if (warning) {
            toast({
              title: "Verifica la etiqueta",
              description: warning,
            });
          }
          setScannedCode(null);
        }
      }
    }
  }, [scannedSerie, isFetchingRollos, rollosData, toast, scannedCode]);

  const handleConfirm = () => {
    if (!rollo) return;
    if (!motivo) return;
    if (justificacion.length < 10) return;

    createMutation.mutate({
      data: {
        rolloId: rollo.id,
        motivo: motivo as MotivoSalidaExtraordinaria,
        justificacion: justificacion.trim(),
        uuidCliente: uuidClienteRef.current,
      }
    }, {
      onSuccess: () => {
        toast({
          title: "Salida extraordinaria registrada",
          description: `El rollo ${rollo.serie} ha sido dado de baja por ${motivo}.`
        });
        setScannedSerie("");
        setMotivo("");
        setJustificacion("");
        setConfirmationOpen(false);
        uuidClienteRef.current = crypto.randomUUID();

        queryClient.invalidateQueries({ queryKey: getListSalidasExtraordinariasQueryKey() });
        queryClient.invalidateQueries({ queryKey: getListRollosQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetRolloQueryKey(rollo.id) });
      },
      onError: (err: any) => {
        toast({
          title: "Error al registrar",
          description: getApiErrorMessage(err),
          variant: "destructive"
        });
        setConfirmationOpen(false);
      }
    });
  };

  // History state
  const { data: locations } = useGetUbicacionesSalida({ query: { queryKey: getGetUbicacionesSalidaQueryKey() } });
  const [page, setPage] = useState(1);
  const [filterUbicacion, setFilterUbicacion] = useState<string>("all");
  const [filterMotivo, setFilterMotivo] = useState<string>("all");
  const [fechaDesde, setFechaDesde] = useState<Date | undefined>();
  const [fechaHasta, setFechaHasta] = useState<Date | undefined>();
  const [showFilters, setShowFilters] = useState(false);

  const queryParams = {
    ubicacionId: filterUbicacion !== "all" ? Number(filterUbicacion) : undefined,
    motivo: filterMotivo !== "all" ? filterMotivo as MotivoSalidaExtraordinaria : undefined,
    fechaDesde: fechaDesde ? format(fechaDesde, 'yyyy-MM-dd') : undefined,
    fechaHasta: fechaHasta ? format(fechaHasta, 'yyyy-MM-dd') : undefined,
    page,
    pageSize: 50,
  };

  const { data: historyData, isLoading: isLoadingHistory } = useListSalidasExtraordinarias(queryParams, {
    query: {
      placeholderData: keepPreviousData,
      queryKey: getListSalidasExtraordinariasQueryKey(queryParams)
    }
  });

  const activeFilterCount = [
    filterUbicacion !== "all",
    filterMotivo !== "all",
    !!fechaDesde,
    !!fechaHasta,
  ].filter(Boolean).length;

  const resetFilters = () => {
    setFilterUbicacion("all");
    setFilterMotivo("all");
    setFechaDesde(undefined);
    setFechaHasta(undefined);
    setPage(1);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">

      <Card className="border-destructive/20 shadow-sm border-2">
        <CardHeader className="bg-destructive/5 pb-4 border-b border-destructive/10">
          <CardTitle className="text-base text-destructive flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" />
            Nueva Salida Extraordinaria (Ajuste Negativo Total)
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Utiliza esta herramienta únicamente para dar de baja inventario por merma, robo o muestra.
            El rollo completo será removido del inventario DISPONIBLE permanentemente.
          </p>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-6">
            <div className="space-y-4">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Escanear Rollo
              </label>
              <CampoEscaneo
                ref={scannerInputRef}
                value={serieInput}
                onChange={setSerieInput}
                onScan={handleScan}
                placeholder="Escanea la serie..."
                className="h-12 pl-12 text-lg font-bold"
                disabled={isFetchingRollos || createMutation.isPending}
                autoFocus
              />
              <Barcode className="pointer-events-none absolute ml-3 -mt-[42px] h-5 w-5 text-primary" />

              {isFetchingRollos && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" /> Buscando rollo...
                </div>
              )}
            </div>

            {rollo && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div className="space-y-4">
                  <div>
                    <h3 className="text-xl font-bold text-slate-900 mb-1">
                      {rollo.serie}
                    </h3>
                    <p className="text-sm font-medium text-slate-700">
                      {rollo.telaProducto} / {rollo.colorProducto}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      SKU: {rollo.skuProducto}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-slate-600 bg-white px-3 py-2 rounded-md border border-slate-100 shadow-sm inline-flex">
                    <MapPin className="w-4 h-4 text-primary" />
                    {rollo.nombreUbicacion}
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 uppercase font-semibold mb-1">Cantidad a dar de baja</p>
                    <p className="text-2xl font-black text-destructive">
                      {formatNumber(rollo.cantidadActual, { kind: "quantity" })}
                    </p>
                  </div>
                </div>

                <div className="space-y-4 flex flex-col justify-between">
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Motivo <span className="text-destructive">*</span></label>
                      <Select value={motivo} onValueChange={(val: any) => setMotivo(val)}>
                        <SelectTrigger className="bg-white">
                          <SelectValue placeholder="Seleccione un motivo" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="MERMA">Merma (Daño, defecto, etc.)</SelectItem>
                          <SelectItem value="ROBO">Robo / Extravío</SelectItem>
                          <SelectItem value="MUESTRA">Muestra Comercial</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center">
                        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Justificación <span className="text-destructive">*</span></label>
                        <span className={`text-xs ${justificacion.length < 10 ? 'text-destructive font-medium' : 'text-emerald-600 font-medium'}`}>
                          {justificacion.length}/10 min
                        </span>
                      </div>
                      <Textarea
                        placeholder="Explica detalladamente la razón de la salida..."
                        className="bg-white resize-none h-24"
                        value={justificacion}
                        onChange={(e) => setJustificacion(e.target.value)}
                      />
                    </div>
                  </div>

                  <Button
                    variant="destructive"
                    className="w-full h-12 text-base font-bold shadow-sm"
                    disabled={!motivo || justificacion.length < 10 || createMutation.isPending}
                    onClick={() => setConfirmationOpen(true)}
                  >
                    Confirmar Salida Extraordinaria
                  </Button>
                </div>
              </div>
            )}
            {!rollo && !isFetchingRollos && (
              <div className="bg-slate-50 rounded-xl border border-dashed border-slate-300 flex flex-col items-center justify-center p-8 text-center text-slate-400">
                <Info className="w-10 h-10 mb-3 opacity-20" />
                <p className="font-medium text-slate-500">Escanea un rollo para continuar</p>
                <p className="text-sm mt-1 max-w-sm">Solo se pueden ajustar rollos que estén actualmente DISPONIBLES en el sistema.</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-sm border-slate-200">
        <CardHeader className="bg-slate-50 border-b border-slate-100 flex flex-row items-center justify-between pb-4">
          <CardTitle className="text-base flex items-center gap-2">
            Historial de Salidas Extraordinarias
          </CardTitle>
          <Button
            variant={showFilters || activeFilterCount > 0 ? "secondary" : "outline"}
            onClick={() => setShowFilters(!showFilters)}
            className="gap-2 bg-white h-9"
            size="sm"
          >
            <Filter className="w-4 h-4" />
            Filtros
            {activeFilterCount > 0 && (
              <Badge variant="secondary" className="ml-1 px-1.5 h-5">{activeFilterCount}</Badge>
            )}
          </Button>
        </CardHeader>

        {showFilters && (
          <div className="p-4 border-b border-slate-100 bg-white grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Sitio</label>
              <Select value={filterUbicacion} onValueChange={(val) => { setFilterUbicacion(val); setPage(1); }}>
                <SelectTrigger className="bg-white"><SelectValue placeholder="Sitio (Todos)" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los sitios</SelectItem>
                  {locations?.map(l => <SelectItem key={l.id} value={String(l.id)}>{l.nombre}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Motivo</label>
              <Select value={filterMotivo} onValueChange={(val) => { setFilterMotivo(val); setPage(1); }}>
                <SelectTrigger className="bg-white"><SelectValue placeholder="Motivo (Todos)" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los motivos</SelectItem>
                  {Object.values(MotivoSalidaExtraordinaria).map(m => (
                    <SelectItem key={m} value={m}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Desde</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal bg-white">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {fechaDesde ? format(fechaDesde, 'dd/MM/yyyy') : <span>Seleccionar</span>}
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
                    {fechaHasta ? format(fechaHasta, 'dd/MM/yyyy') : <span>Seleccionar</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar mode="single" selected={fechaHasta} onSelect={(d) => { setFechaHasta(d); setPage(1); }} initialFocus />
                </PopoverContent>
              </Popover>
            </div>
            <div className="col-span-full flex justify-end pt-2">
              <Button variant="ghost" onClick={resetFilters} className="text-slate-500 hover:text-slate-900" size="sm">
                <X className="w-4 h-4 mr-2" />
                Limpiar Filtros
              </Button>
            </div>
          </div>
        )}

        <CardContent className="p-0">
          <div className="overflow-x-auto min-h-[300px]">
            {isLoadingHistory ? (
              <div className="flex justify-center items-center h-48 text-slate-400">
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
            ) : historyData?.items.length === 0 ? (
              <div className="flex flex-col justify-center items-center h-48 text-slate-400">
                <p className="font-medium text-slate-500">No hay registros</p>
              </div>
            ) : (
              <div className="min-w-[1000px] w-full">
                <div className="grid grid-cols-[140px_120px_160px_150px_1fr_120px_140px] gap-4 bg-slate-50 px-4 py-3 border-b border-slate-100 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  <span>Fecha</span>
                  <span>Rollo</span>
                  <span>Producto</span>
                  <span>Sitio</span>
                  <span>Justificación</span>
                  <span className="text-right">Cantidad</span>
                  <span className="text-right">Usuario</span>
                </div>
                <div className="divide-y divide-slate-100">
                  {historyData?.items.map(item => (
                    <div key={item.movimientoId} className="grid grid-cols-[140px_120px_160px_150px_1fr_120px_140px] gap-4 px-4 py-3 items-center hover:bg-slate-50/50 transition-colors">
                      <span className="text-sm text-slate-500">
                        {format(new Date(item.createdAt), "dd/MM/yyyy HH:mm", { locale: es })}
                      </span>
                      <Link href={`/inventario/rollos/${item.rolloId}`} className="font-mono font-bold text-primary hover:underline underline-offset-2">
                        {item.serie}
                      </Link>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-900 truncate" title={`${item.telaProducto} / ${item.colorProducto}`}>
                          {item.telaProducto}
                        </p>
                        <p className="text-xs text-slate-500 truncate">{item.colorProducto}</p>
                      </div>
                      <span className="text-sm truncate">{item.nombreUbicacion}</span>
                      <div className="min-w-0">
                        <Badge variant="outline" className="mb-1 bg-white">{item.motivo}</Badge>
                        <p className="text-xs text-slate-500 truncate" title={item.justificacion}>{item.justificacion}</p>
                      </div>
                      <div className="text-right">
                        <span className="font-medium text-destructive tabular-nums">-{formatNumber(Math.abs(Number(item.cantidad)), { kind: "quantity" })}</span>
                        <span className="text-[10px] text-slate-400 ml-1">{formatUnit(item.unidadProducto as any)}</span>
                      </div>
                      <span className="text-xs text-slate-500 text-right truncate" title={item.nombreUsuario}>{item.nombreUsuario}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </CardContent>
        {historyData && Math.ceil(historyData.total / historyData.pageSize) > 1 && (
          <div className="p-4 border-t border-slate-100 flex items-center justify-between bg-slate-50">
            <p className="text-sm text-slate-500">
                Mostrando {formatNumber(historyData.items.length, { kind: "count" })} de {formatNumber(historyData.total, { kind: "count" })}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                Anterior
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.min(Math.ceil(historyData.total / historyData.pageSize), p + 1))}
                disabled={page === Math.ceil(historyData.total / historyData.pageSize)}
              >
                Siguiente
              </Button>
            </div>
          </div>
        )}
      </Card>

      <ConfirmacionTextoExacto
        open={confirmationOpen}
        onOpenChange={setConfirmationOpen}
        titulo={`Confirmar baja por ${motivo}`}
        descripcion={`Se removerá completamente el rollo ${rollo?.serie} del inventario. Esta acción registrará un ajuste negativo.`}
        textoRequerido="EXTRAORDINARIA"
        etiqueta="Escribe EXTRAORDINARIA para confirmar"
        textoConfirmar="Registrar Salida"
        pendiente={createMutation.isPending}
        onConfirm={handleConfirm}
      />
    </div>
  );
}
