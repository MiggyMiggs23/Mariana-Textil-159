import { useEffect, useState } from "react";
import { Link } from "wouter";
import { keepPreviousData } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  ChevronDown,
  Download,
  Filter,
  History,
  Loader2,
  Search,
  AlertCircle,
} from "lucide-react";
import {
  getGetKardexGroupedQueryKey,
  useGetCurrentUser,
  useGetKardexGrouped,
  useListKardexFilters,
  exportKardexXlsx,
  TipoMovimiento,
  type KardexGroupedRow,
} from "@workspace/api-client-react";
import { formatNumber, formatUnit } from "@workspace/number-format";
import { AppLayout } from "@/components/layout/app-layout";
import {
  MovimientoDocumento,
  MovimientoDocumentoFallback,
} from "@/components/movimiento-documento-link";
import { useHistoryEntryState } from "@/lib/internal-navigation";
import { hasPermission, Modules } from "@/lib/permisos";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";

const TIMEZONE = "America/Mexico_City";
const LOCALE = "es-MX";

const desktopDateFormatter = new Intl.DateTimeFormat(LOCALE, {
  timeZone: TIMEZONE,
  day: "2-digit",
  month: "short",
  year: "numeric",
});
const timeFormatter = new Intl.DateTimeFormat(LOCALE, {
  timeZone: TIMEZONE,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const formatDesktopDate = (date: string) =>
  desktopDateFormatter.format(new Date(date)).replace(/ /g, "/");
const formatTime = (date: string) => timeFormatter.format(new Date(date));
const formatMobileDateTime = (date: string) =>
  `${desktopDateFormatter.format(new Date(date))} · ${timeFormatter.format(new Date(date))}`;

const TipoMovimientoLabels: Record<string, string> = {
  ALTA: "Alta manual",
  RECEPCION: "Entrada de proveedor",
  VENTA: "Venta",
  DEVOLUCION: "Devolución",
  TRANSFERENCIA_SALIDA: "Salida enviada",
  TRANSFERENCIA_ENTRADA: "Recepción de salida",
  SALIDA_MOSTRADOR: "Salida de mostrador",
  AJUSTE_POSITIVO: "Ajuste positivo",
  AJUSTE_NEGATIVO: "Ajuste negativo",
  CANCELACION: "Cancelación",
  REACTIVACION_FALTANTE: "Reactivación de faltante",
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
  CANCELACION: "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700",
  REACTIVACION_FALTANTE: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/40 dark:text-cyan-300 border-cyan-200 dark:border-cyan-800",
};

function quantityColor(quantity: string) {
  if (quantity.trim().startsWith("-")) return "text-red-600 dark:text-red-400";
  if (quantity.trim() !== "0") return "text-emerald-600 dark:text-emerald-400";
  return "text-foreground";
}

function quantitySign(quantity: string) {
  return quantity.trim().startsWith("-") || quantity.trim() === "0" ? "" : "+";
}

function quantityAbsolute(quantity: string) {
  return quantity.trim().startsWith("-") ? quantity.trim().slice(1) : quantity.trim();
}

function clearable(filters: {
  modo?: "TODO_LO_QUE_SALIO";
  buscar: string;
  tipos: TipoMovimiento[];
  productoId: string;
  ubicacionId: string;
  usuarioId: string;
  desde: string;
  hasta: string;
}) {
  return Boolean(
    filters.modo ||
      filters.buscar ||
      filters.tipos.length ||
      filters.productoId !== "all" ||
      filters.ubicacionId !== "all" ||
      filters.usuarioId !== "all" ||
      filters.desde ||
      filters.hasta,
  );
}

export default function Movimientos() {
  const { data: user } = useGetCurrentUser();
  const { toast } = useToast();
  const [searchInput, setSearchInput] = useHistoryEntryState("movimientos.search-input", "");
  const [filters, setFilters] = useHistoryEntryState<{
    buscar: string;
    desde: string;
    hasta: string;
    ubicacionId: string;
    productoId: string;
    usuarioId: string;
    tipos: TipoMovimiento[];
    modo?: "TODO_LO_QUE_SALIO";
    incluirUbicacionesInactivas: boolean;
  }>("movimientos.filters", {
    buscar: "",
    desde: "",
    hasta: "",
    ubicacionId: "all",
    productoId: "all",
    usuarioId: "all",
    tipos: [],
    modo: undefined,
    incluirUbicacionesInactivas: false,
  });
  const [page, setPage] = useHistoryEntryState("movimientos.page", 1);
  const [expandedGroups, setExpandedGroups] = useHistoryEntryState<string[]>("movimientos.expanded-groups", []);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (![...params.keys()].some((key) => key !== "returnTo")) return;
    const tipos = params.get("tipos")?.split(",").filter(Boolean) as
      | TipoMovimiento[]
      | undefined;
    setSearchInput(params.get("buscar") ?? "");
    setFilters((current) => ({
      ...current,
      buscar: params.get("buscar") ?? "",
      desde: params.get("desde") ?? "",
      hasta: params.get("hasta") ?? "",
      ubicacionId: params.get("ubicacionId") ?? "all",
      productoId: params.get("productoId") ?? "all",
      usuarioId: params.get("usuarioId") ?? "all",
      tipos: tipos ?? [],
      modo:
        params.get("modo") === "TODO_LO_QUE_SALIO"
          ? "TODO_LO_QUE_SALIO"
          : undefined,
      incluirUbicacionesInactivas:
        params.get("incluirUbicacionesInactivas") === "true",
    }));
    const requestedPage = Number(params.get("page"));
    if (Number.isInteger(requestedPage) && requestedPage > 0) {
      setPage(requestedPage);
    }
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (filters.buscar !== searchInput) {
        setFilters((current) => ({ ...current, buscar: searchInput }));
        setPage(1);
      }
    }, 400);
    return () => clearTimeout(timeout);
  }, [filters.buscar, searchInput]);

  const showLocationFilter =
    user?.rol === "ADMIN" || user?.alcanceConsulta === "TODAS";
  const canReadTicket =
    user?.rol === "ADMIN" ||
    user?.rol === "CONTADOR" ||
    user?.rol === "SISTEMAS" ||
    ((hasPermission(user, Modules.COBROS_PAGOS, "ver") ||
      hasPermission(user, Modules.POS, "ver")) &&
      user?.ubicacion?.id != null);
  const canReadTicketAtLocation = (locationId: number) =>
    canReadTicket &&
    (user?.rol === "ADMIN" ||
      user?.rol === "CONTADOR" ||
      user?.rol === "SISTEMAS" ||
      user?.ubicacion?.id === locationId);
  const filterParams = {
    modo: filters.modo,
    ubicacionId:
      filters.ubicacionId !== "all" ? Number(filters.ubicacionId) : undefined,
    productoId:
      filters.productoId !== "all" ? Number(filters.productoId) : undefined,
    usuarioId:
      filters.usuarioId !== "all" ? Number(filters.usuarioId) : undefined,
    tipos: filters.tipos.length ? filters.tipos : undefined,
    buscar: filters.buscar || undefined,
    desde: filters.desde || undefined,
    hasta: filters.hasta || undefined,
    incluirUbicacionesInactivas:
      filters.incluirUbicacionesInactivas || undefined,
  };
  const filterParamsList = {
    incluirUbicacionesInactivas:
      filters.incluirUbicacionesInactivas || undefined,
  };
  const { data: filterOptions } = useListKardexFilters(filterParamsList, {
    query: { queryKey: ["kardex-grouped-filters", filterParamsList] },
  });
  const queryParams = { ...filterParams, page, pageSize: 100 };
  const { data, isLoading, isError, isFetching } = useGetKardexGrouped(
    queryParams,
    {
      query: {
        queryKey: getGetKardexGroupedQueryKey(queryParams),
        placeholderData: keepPreviousData,
      },
    },
  );
  const movimientosReturnUrl = `/movimientos?${new URLSearchParams(
    Object.entries({
      buscar: filters.buscar || undefined,
      desde: filters.desde || undefined,
      hasta: filters.hasta || undefined,
      ubicacionId:
        filters.ubicacionId !== "all" ? filters.ubicacionId : undefined,
      productoId:
        filters.productoId !== "all" ? filters.productoId : undefined,
      usuarioId:
        filters.usuarioId !== "all" ? filters.usuarioId : undefined,
      tipos: filters.tipos.length ? filters.tipos.join(",") : undefined,
      modo: filters.modo,
      incluirUbicacionesInactivas: filters.incluirUbicacionesInactivas
        ? "true"
        : undefined,
      page: String(page),
    }).filter(([, value]) => value != null) as [string, string][],
  ).toString()}`;

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const blob = await exportKardexXlsx(filterParams);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `movimientos_${format(new Date(), "yyyyMMdd_HHmm")}.xlsx`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      toast({
        title: "Exportación exitosa",
        description: "El reporte ha sido descargado correctamente.",
      });
    } catch {
      toast({
        title: "Error al exportar",
        description: "Hubo un problema al generar el archivo Excel.",
        variant: "destructive",
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
      modo: undefined,
      incluirUbicacionesInactivas: false,
    });
    setPage(1);
  };

  const toggleGroup = (groupId: string) => {
    setExpandedGroups((current) =>
      current.includes(groupId)
        ? current.filter((id) => id !== groupId)
        : [...current, groupId],
    );
  };

  const grupos = data?.grupos ?? [];

  return (
    <AppLayout>
      <div className="max-w-[1400px] mx-auto space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-sidebar">
              Movimientos
            </h1>
            <p className="text-muted-foreground mt-1 text-sm md:text-base">
              Historial agrupado por documento, tipo y sitio. El kardex conserva
              cada movimiento por rollo.
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
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClearFilters}
                  data-testid="button-clear-filters"
                >
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
                  {isExporting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4" />
                  )}
                  <span className="hidden sm:inline">Exportar</span>
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              <div className="space-y-1.5">
                <Label>Vista rápida</Label>
                <Button
                  type="button"
                  variant={
                    filters.modo === "TODO_LO_QUE_SALIO"
                      ? "default"
                      : "outline"
                  }
                  className="w-full justify-start gap-2"
                  onClick={() => {
                    setFilters((current) => ({
                      ...current,
                      modo:
                        current.modo === "TODO_LO_QUE_SALIO"
                          ? undefined
                          : "TODO_LO_QUE_SALIO",
                    }));
                    setPage(1);
                  }}
                  data-testid="button-modo-todo-lo-que-salio"
                >
                  <History className="w-4 h-4" />
                  Todo lo que salió
                </Button>
              </div>
              <div className="space-y-1.5 xl:col-span-2">
                <Label>Buscar</Label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    className="pl-8"
                    placeholder="Buscar por serie, SKU, documento o justificación..."
                    value={searchInput}
                    onChange={(event) => setSearchInput(event.target.value)}
                    data-testid="input-search-kardex"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Desde</Label>
                <Input
                  type="date"
                  value={filters.desde}
                  onChange={(event) => {
                    setFilters((current) => ({
                      ...current,
                      desde: event.target.value,
                    }));
                    setPage(1);
                  }}
                  data-testid="input-date-desde"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Hasta</Label>
                <Input
                  type="date"
                  value={filters.hasta}
                  onChange={(event) => {
                    setFilters((current) => ({
                      ...current,
                      hasta: event.target.value,
                    }));
                    setPage(1);
                  }}
                  data-testid="input-date-hasta"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Tipo de movimiento</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-between font-normal"
                      data-testid="button-select-tipos"
                    >
                      {filters.tipos.length === 0
                        ? "Todos los tipos"
                        : `${filters.tipos.length} seleccionados`}
                      <ChevronDown className="h-4 w-4 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[280px] p-0" align="start">
                    <div className="max-h-[300px] overflow-y-auto p-1">
                      {(filterOptions?.tipos ?? []).map((value) => (
                        <div
                          key={value}
                          className="flex items-center space-x-2.5 p-2 hover:bg-muted rounded-md cursor-pointer"
                          onClick={() => {
                            const tipo = value as TipoMovimiento;
                            setFilters((current) => ({
                              ...current,
                              tipos: current.tipos.includes(tipo)
                                ? current.tipos.filter((item) => item !== tipo)
                                : [...current.tipos, tipo],
                            }));
                            setPage(1);
                          }}
                          data-testid={`checkbox-tipo-${value}`}
                        >
                          <Checkbox
                            checked={filters.tipos.includes(value as TipoMovimiento)}
                            className="pointer-events-none"
                          />
                          <Label className="cursor-pointer font-medium text-sm leading-none flex-1 text-foreground">
                            {TipoMovimientoLabels[value] || value}
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
                  <Select
                    value={filters.ubicacionId}
                    onValueChange={(value) => {
                      setFilters((current) => ({
                        ...current,
                        ubicacionId: value,
                      }));
                      setPage(1);
                    }}
                  >
                    <SelectTrigger data-testid="select-ubicacion">
                      <SelectValue placeholder="Todos los sitios" />
                    </SelectTrigger>
                    <SelectContent className="max-h-[300px]">
                      <SelectItem value="all">Todos los sitios</SelectItem>
                      {(filterOptions?.ubicaciones ?? []).map((location) => (
                        <SelectItem key={location.id} value={String(location.id)}>
                          {location.nombre} {!location.activa && "(Inactiva)"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-1.5">
                <Label>Producto</Label>
                <Select
                  value={filters.productoId}
                  onValueChange={(value) => {
                    setFilters((current) => ({ ...current, productoId: value }));
                    setPage(1);
                  }}
                >
                  <SelectTrigger data-testid="select-producto">
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px]">
                    <SelectItem value="all">Todos</SelectItem>
                    {(filterOptions?.productos ?? []).map((product) => (
                      <SelectItem key={product.id} value={String(product.id)}>
                        {product.tela} - {product.color} ({product.sku})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Usuario</Label>
                <Select
                  value={filters.usuarioId}
                  onValueChange={(value) => {
                    setFilters((current) => ({ ...current, usuarioId: value }));
                    setPage(1);
                  }}
                >
                  <SelectTrigger data-testid="select-usuario">
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px]">
                    <SelectItem value="all">Todos</SelectItem>
                    {(filterOptions?.usuarios ?? []).map((operator) => (
                      <SelectItem key={operator.id} value={String(operator.id)}>
                        {operator.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {user?.rol === "ADMIN" && (
                <div className="flex flex-col justify-end pb-1.5 xl:col-start-4">
                  <div className="flex items-center space-x-2 h-9 border border-border rounded-md px-3 bg-muted/20">
                    <Switch
                      id="include-inactive"
                      checked={filters.incluirUbicacionesInactivas}
                      onCheckedChange={(checked) => {
                        setFilters((current) => {
                          let locationId = current.ubicacionId;
                          if (!checked && locationId !== "all") {
                            const location = filterOptions?.ubicaciones?.find(
                              (item) => String(item.id) === locationId,
                            );
                            if (location && !location.activa) locationId = "all";
                          }
                          return {
                            ...current,
                            incluirUbicacionesInactivas: checked,
                            ubicacionId: locationId,
                          };
                        });
                        setPage(1);
                      }}
                      data-testid="switch-incluir-inactivas"
                    />
                    <Label
                      htmlFor="include-inactive"
                      className="cursor-pointer font-medium text-sm flex-1"
                    >
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
              <h3 className="text-lg font-medium text-foreground mb-1">
                Error al cargar
              </h3>
              <p className="text-sm text-muted-foreground max-w-sm">
                Ocurrió un problema al obtener el historial de movimientos.
              </p>
            </div>
          ) : isLoading && !data ? (
            <div className="py-24 text-center flex flex-col items-center justify-center border border-border rounded-lg bg-card/40">
              <Loader2 className="w-10 h-10 animate-spin mb-4 text-primary/30" />
              <p className="text-sm text-muted-foreground font-medium">
                Cargando historial de movimientos...
              </p>
            </div>
          ) : grupos.length === 0 ? (
            <div className="py-16 text-center flex flex-col items-center justify-center border border-dashed rounded-lg bg-card/40">
              <History className="w-12 h-12 mb-4 text-muted-foreground/30" />
              <h3 className="text-lg font-medium text-foreground mb-1">
                Sin resultados
              </h3>
              <p className="text-sm text-muted-foreground max-w-sm">
                No se encontraron movimientos que coincidan con los filtros.
              </p>
              {clearable(filters) && (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4"
                  onClick={handleClearFilters}
                  data-testid="button-clear-filters-empty"
                >
                  Limpiar filtros
                </Button>
              )}
            </div>
          ) : (
            <>
              <Card className="hidden md:block overflow-hidden border-border">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30 hover:bg-muted/30">
                        <TableHead className="w-[150px]">Fecha</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead className="min-w-[220px]">Documento</TableHead>
                        <TableHead className="min-w-[180px]">Producto</TableHead>
                        <TableHead className="whitespace-nowrap">Sitio</TableHead>
                        <TableHead className="text-right">Rollos</TableHead>
                        <TableHead className="min-w-[180px] text-right">
                          Cantidades
                        </TableHead>
                        <TableHead>Usuario</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {grupos.map((group) => {
                        const expanded = expandedGroups.includes(group.groupId);
                        const product = group.productos[0];
                        return (
                          <GroupRows
                            key={group.groupId}
                            group={group}
                            expanded={expanded}
                            onToggle={() => toggleGroup(group.groupId)}
                            product={product}
                            canReadTicketAtLocation={canReadTicketAtLocation}
                            movimientosReturnUrl={movimientosReturnUrl}
                          />
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </Card>

              <div className="grid grid-cols-1 gap-4 md:hidden">
                {grupos.map((group) => {
                  const expanded = expandedGroups.includes(group.groupId);
                  const product = group.productos[0];
                  return (
                    <div
                      key={group.groupId}
                      className="border border-border/80 rounded-xl p-4 space-y-3 bg-card shadow-sm"
                      data-testid={`card-movimiento-${group.groupId}`}
                    >
                      <button
                        type="button"
                        className="w-full text-left"
                        onClick={() => toggleGroup(group.groupId)}
                        aria-expanded={expanded}
                        data-testid={`button-expand-${group.groupId}`}
                      >
                        <div className="flex justify-between items-start gap-3">
                          <div className="space-y-1.5 min-w-0">
                            <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                              {formatMobileDateTime(group.latestDate)}
                            </div>
                            <Badge
                              className={`font-medium shadow-none ${TipoMovimientoColors[group.tipo]}`}
                              variant="outline"
                            >
                              {TipoMovimientoLabels[group.tipo] || group.tipo}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-xs font-semibold text-muted-foreground">
                              {formatNumber(group.distinctRolloCount, { kind: "count" })} rollos
                            </span>
                            <ChevronDown
                              className={`h-4 w-4 transition-transform ${
                                expanded ? "rotate-180" : ""
                              }`}
                            />
                          </div>
                        </div>
                      </button>
                      <div className="grid grid-cols-2 gap-x-3 gap-y-3 text-sm pt-3 border-t border-border/50">
                        <div className="col-span-2 bg-muted/20 p-2.5 rounded-lg border border-border/40">
                          <span className="text-[10px] uppercase font-semibold tracking-wider text-muted-foreground block mb-0.5">
                            Documento
                          </span>
                          {group.ticketId != null ? (
                            <TicketReturnLink
                              row={group}
                              canReadTicketAtLocation={canReadTicketAtLocation}
                              movimientosReturnUrl={movimientosReturnUrl}
                            />
                          ) : (() => {
                            const row = group;
                            return row.documentoRuta ? (
                              <MovimientoDocumento movimiento={row} />
                            ) : (
                              <MovimientoDocumentoFallback
                                movimiento={{
                                  documentoTipo: row.documentoTipo,
                                  documentoId: row.documentoId,
                                  documentoEtiqueta: row.documentoEtiqueta,
                                }}
                                compact
                              />
                            );
                          })()}
                          {group.justificacion && (
                            <p className="text-xs text-muted-foreground mt-1.5">
                              {group.justificacion}
                            </p>
                          )}
                        </div>
                        <div>
                          <span className="text-[10px] uppercase font-semibold tracking-wider text-muted-foreground block mb-1">
                            Producto
                          </span>
                          <div className="font-semibold truncate">
                            {product?.telaProducto ?? "Varios productos"}
                          </div>
                          <div className="text-xs text-muted-foreground truncate">
                            {product?.colorProducto ?? `${group.productos.length} productos`}
                          </div>
                        </div>
                        <div>
                          <span className="text-[10px] uppercase font-semibold tracking-wider text-muted-foreground block mb-1">
                            Sitio
                          </span>
                          <div className="font-medium">
                            {group.nombreUbicacion}
                            {!group.ubicacionActiva && (
                              <Badge variant="secondary" className="ml-1 text-[9px] h-3.5 px-1 py-0">
                                Inactiva
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className="col-span-2">
                          <span className="text-[10px] uppercase font-semibold tracking-wider text-muted-foreground block mb-1">
                            Cantidades
                          </span>
                          <UnitTotals totals={group.totalesPorUnidad} />
                        </div>
                      </div>
                      {expanded && <RollosList group={group} returnUrl={movimientosReturnUrl} />}
                    </div>
                  );
                })}
              </div>

              <div className="flex flex-wrap justify-end gap-3 text-right tabular-nums">
                {[
                  ["METRO", data?.resumen.totalMetros],
                  ["KILO", data?.resumen.totalKilos],
                  ["BOLSA", data?.resumen.totalBolsas],
                  ["PIEZA", data?.resumen.totalPiezas],
                ].map(([unit, value]) => (
                  <Card key={unit} className="min-w-[140px]">
                    <CardContent className="p-3">
                      <div className="text-xs font-medium text-muted-foreground">
                        Total {formatUnit(String(unit))}
                      </div>
                      <div className="font-bold">
                        {formatNumber(String(value ?? "0"), { kind: "quantity" })}{" "}
                        <span className="text-xs font-normal">
                          {formatUnit(String(unit))}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2 pb-6">
                <div className="text-sm font-medium text-muted-foreground order-2 sm:order-1">
                  Mostrando{" "}
                  <span className="text-foreground">
                    {formatNumber(grupos.length, { kind: "count" })}
                  </span>{" "}
                  de{" "}
                  <span className="text-foreground">
                    {formatNumber(data?.total ?? 0, { kind: "count" })}
                  </span>{" "}
                  movimientos agrupados
                  {(data?.totalPages ?? 0) > 1 && (
                    <span className="ml-1 opacity-80">
                      (Página {formatNumber(data?.page ?? page, { kind: "count" })} de{" "}
                      {formatNumber(data?.totalPages ?? 0, { kind: "count" })})
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto order-1 sm:order-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1 || isLoading}
                    onClick={() => setPage((current) => current - 1)}
                    data-testid="button-prev-page"
                    className="flex-1 sm:flex-none font-medium"
                  >
                    Anterior
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= (data?.totalPages ?? 1) || isLoading}
                    onClick={() => setPage((current) => current + 1)}
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

function GroupRows({
  group,
  expanded,
  onToggle,
  product,
  canReadTicketAtLocation,
  movimientosReturnUrl,
}: {
  group: KardexGroupedRow;
  expanded: boolean;
  onToggle: () => void;
  product: KardexGroupedRow["productos"][number] | undefined;
  canReadTicketAtLocation: (locationId: number) => boolean;
  movimientosReturnUrl: string;
}) {
  const row = group;
  return (
    <>
      <TableRow
        className="hover:bg-muted/40 transition-colors cursor-pointer"
        onClick={onToggle}
        aria-expanded={expanded}
        data-testid={`row-movimiento-${group.groupId}`}
      >
        <TableCell className="align-top py-3">
          <div className="font-medium text-foreground">
            {formatDesktopDate(group.latestDate)}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            {formatTime(group.latestDate)}
          </div>
          {group.fechaMin !== group.fechaMax && (
            <div className="text-[10px] text-muted-foreground mt-1">
              Desde {formatDesktopDate(group.fechaMin)}
            </div>
          )}
        </TableCell>
        <TableCell className="align-top py-3">
          <Badge
            className={`font-medium shadow-none ${TipoMovimientoColors[group.tipo]}`}
            variant="outline"
          >
            {TipoMovimientoLabels[group.tipo] || group.tipo}
          </Badge>
        </TableCell>
        <TableCell className="align-top py-3">
          {row.ticketId != null ? (
            <TicketReturnLink
              row={row}
              canReadTicketAtLocation={canReadTicketAtLocation}
              movimientosReturnUrl={movimientosReturnUrl}
            />
          ) : row.documentoRuta ? (
            <MovimientoDocumento movimiento={row} />
          ) : (
            <MovimientoDocumentoFallback
              movimiento={{
                documentoTipo: row.documentoTipo,
                documentoId: row.documentoId,
                documentoEtiqueta: row.documentoEtiqueta,
              }}
            />
          )}
          {group.justificacion && (
            <div className="text-xs text-muted-foreground mt-1 max-w-[220px] truncate">
              {group.justificacion}
            </div>
          )}
        </TableCell>
        <TableCell className="align-top py-3 max-w-[220px]">
          <div className="font-semibold truncate">
            {product?.telaProducto ?? "Varios productos"}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5 truncate">
            {product
              ? `${product.colorProducto} · ${product.skuProducto}`
              : `${group.productos.length} productos`}
          </div>
        </TableCell>
        <TableCell className="align-top py-3">
          <div className="flex flex-col items-start gap-1">
            <span className="font-medium text-sm">{group.nombreUbicacion}</span>
            {!group.ubicacionActiva && (
              <Badge variant="secondary" className="text-[10px] h-4 px-1.5 py-0">
                Inactiva
              </Badge>
            )}
          </div>
        </TableCell>
        <TableCell className="align-top py-3 text-right">
          <button
            type="button"
            className="inline-flex items-center gap-1 font-bold text-primary"
            onClick={(event) => {
              event.stopPropagation();
              onToggle();
            }}
          >
            {formatNumber(group.distinctRolloCount, { kind: "count" })}
            <ChevronDown
              className={`h-4 w-4 transition-transform ${expanded ? "rotate-180" : ""}`}
            />
          </button>
        </TableCell>
        <TableCell className="align-top py-3 text-right">
          <UnitTotals totals={group.totalesPorUnidad} align="right" />
        </TableCell>
        <TableCell className="align-top py-3">
          <div className="text-sm font-medium truncate max-w-[120px]">
            {group.usuarios[0]?.nombreUsuario ?? "—"}
          </div>
          {group.usuarios.length > 1 && (
            <div className="text-[11px] text-muted-foreground mt-0.5">
              {group.usuarios.length} usuarios
            </div>
          )}
        </TableCell>
      </TableRow>
      {expanded && (
        <TableRow className="bg-muted/10">
          <TableCell colSpan={8} className="p-0">
            <RollosList group={group} />
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

function TicketReturnLink({
  row,
  canReadTicketAtLocation,
  movimientosReturnUrl,
}: {
  row: KardexGroupedRow;
  canReadTicketAtLocation: (locationId: number) => boolean;
  movimientosReturnUrl: string;
}) {
  if (!(canReadTicketAtLocation(row.ubicacionId) && row.ticketId != null)) {
    return (
      <MovimientoDocumentoFallback
        movimiento={{
          documentoTipo: row.documentoTipo,
          documentoId: row.documentoId,
          documentoEtiqueta: row.documentoEtiqueta,
        }}
      />
    );
  }
  return (
    <Link
      href={`/tickets/${row.ticketId}?returnTo=${encodeURIComponent(movimientosReturnUrl)}`}
      className="inline-flex items-center gap-1.5 text-primary underline underline-offset-4 hover:text-primary/80"
      data-testid={`link-ticket-${row.ticketId}`}
    >
      Abrir ticket
    </Link>
  );
}

function UnitTotals({
  totals,
  align = "left",
}: {
  totals: Array<{ unidad: string; cantidad: string }>;
  align?: "left" | "right";
}) {
  return (
    <div className={`space-y-1 ${align === "right" ? "text-right" : "text-left"}`}>
      {totals.map((total) => (
        <div
          key={total.unidad}
          className={`font-bold text-sm tracking-tight ${quantityColor(total.cantidad)}`}
        >
          {quantitySign(total.cantidad)}
          {formatNumber(quantityAbsolute(total.cantidad), { kind: "quantity" })}{" "}
          <span className="text-xs font-normal opacity-70">
            {formatUnit(total.unidad)}
          </span>
        </div>
      ))}
    </div>
  );
}

function RollosList({
  group,
}: {
  group: KardexGroupedRow;
  returnUrl?: string;
}) {
  return (
    <div className="p-3 md:p-4 border-t border-border/60 bg-muted/10">
      <div className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-2">
        Rollos y parcialidades ({formatNumber(group.partialitiesMerged, { kind: "count" })})
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {group.rollos.map((rollo) => (
          <div
            key={rollo.movementId}
            className="flex items-center justify-between gap-3 rounded-md border border-border/60 bg-background px-3 py-2 text-sm"
          >
            <Link
              href={rollo.referenciaRolloRuta}
              className="font-mono font-medium text-primary underline underline-offset-4 hover:text-primary/80"
              data-testid={`link-rollo-${group.groupId}-${rollo.rolloId}`}
            >
              {rollo.serie}
            </Link>
            <span className={`font-semibold tabular-nums ${quantityColor(rollo.cantidad)}`}>
              {quantitySign(rollo.cantidad)}
              {formatNumber(quantityAbsolute(rollo.cantidad), { kind: "quantity" })}{" "}
              <span className="text-xs font-normal">{formatUnit(rollo.unidad)}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}