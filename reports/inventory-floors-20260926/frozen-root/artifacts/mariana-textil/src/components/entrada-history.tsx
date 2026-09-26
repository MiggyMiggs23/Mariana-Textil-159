import { useEffect, useState } from "react";
import { keepPreviousData } from "@tanstack/react-query";
import {
  getListEntradasQueryKey,
  type CatalogosEntrada,
  type ListEntradasParams,
  type Location,
  useListEntradas,
} from "@workspace/api-client-react";
import { format } from "date-fns";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Filter,
  Package,
  Search,
  X,
} from "lucide-react";
import { Link } from "wouter";
import { formatNumber } from "@workspace/number-format";
import { useHistoryEntryState } from "@/lib/internal-navigation";
import { getApiErrorMessage } from "@/lib/api-error";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

type EntradaHistoryProps = {
  catalogos?: CatalogosEntrada;
  ubicaciones?: Location[];
};

const PAGE_SIZE = 10;

function dateFromInput(value: string) {
  return value ? new Date(`${value}T00:00:00`) : undefined;
}

function dateInputValue(value: Date | undefined) {
  return value ? format(value, "yyyy-MM-dd") : "";
}

export function EntradaHistory({ catalogos, ubicaciones }: EntradaHistoryProps) {
  const [page, setPage] = useHistoryEntryState("entradas.page", 1);
  const [folio, setFolio] = useHistoryEntryState("entradas.folio", "");
  const [proveedorId, setProveedorId] = useHistoryEntryState("entradas.proveedor", "all");
  const [ubicacionId, setUbicacionId] = useHistoryEntryState("entradas.ubicacion", "all");
  const [fechaDesde, setFechaDesde] = useHistoryEntryState<Date | undefined>(
    "entradas.fecha-desde",
    undefined,
  );
  const [fechaHasta, setFechaHasta] = useHistoryEntryState<Date | undefined>(
    "entradas.fecha-hasta",
    undefined,
  );
  const [debouncedFolio, setDebouncedFolio] = useState(folio);
  const [showFilters, setShowFilters] = useHistoryEntryState(
    "entradas.filtros-abiertos",
    false,
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedFolio(folio);
    }, 350);
    return () => clearTimeout(timer);
  }, [folio]);

  const queryParams: ListEntradasParams = {
    folio: debouncedFolio.trim() || undefined,
    proveedorId: proveedorId !== "all" ? Number(proveedorId) : undefined,
    ubicacionId: ubicacionId !== "all" ? Number(ubicacionId) : undefined,
    fechaDesde: fechaDesde ? format(fechaDesde, "yyyy-MM-dd") : undefined,
    fechaHasta: fechaHasta ? format(fechaHasta, "yyyy-MM-dd") : undefined,
    page,
    pageSize: PAGE_SIZE,
  };
  // The server remains authoritative for history ordering (folio descending);
  // this presentation deliberately does not sort or re-page the returned rows.
  const {
    data: entradasResult,
    isLoading,
    isError,
    error,
  } = useListEntradas(queryParams, {
    query: {
      placeholderData: keepPreviousData,
      queryKey: getListEntradasQueryKey(queryParams),
      refetchOnWindowFocus: true,
    },
  });

  const totalPages = entradasResult
    ? Math.max(1, Math.ceil(entradasResult.total / entradasResult.pageSize))
    : 1;
  const activeFilterCount = [
    debouncedFolio.trim() !== "",
    proveedorId !== "all",
    ubicacionId !== "all",
    fechaDesde,
    fechaHasta,
  ].filter(Boolean).length;

  const resetFilters = () => {
    setFolio("");
    setProveedorId("all");
    setUbicacionId("all");
    setFechaDesde(undefined);
    setFechaHasta(undefined);
    setPage(1);
  };

  return (
    <Card data-testid="entrada-history">
      <CardHeader className="border-b">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="text-lg">Historial de entradas</CardTitle>
            <CardDescription>
              Consulta, imprime o guarda nuevamente el documento de cada entrada.
            </CardDescription>
          </div>
          <Button
            type="button"
            variant={showFilters || activeFilterCount > 0 ? "secondary" : "outline"}
            onClick={() => setShowFilters((open) => !open)}
            className="w-full gap-2 sm:w-auto"
            data-testid="btn-entrada-history-filters"
          >
            <Filter className="h-4 w-4" />
            Filtros
            {activeFilterCount > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 px-1.5">
                {activeFilterCount}
              </Badge>
            )}
          </Button>
        </div>
      </CardHeader>

      {showFilters && (
        <div className="grid grid-cols-1 gap-4 border-b bg-slate-50/70 p-4 sm:grid-cols-2 lg:grid-cols-5">
          <div className="space-y-1.5 lg:col-span-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-500" htmlFor="entrada-history-folio">
              Folio
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                id="entrada-history-folio"
                data-testid="filter-entrada-folio"
                placeholder="Folio numérico o DN-000503"
                value={folio}
                onChange={(event) => {
                  setFolio(event.target.value);
                  setPage(1);
                }}
                className="bg-white pl-9"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Proveedor
            </label>
            <Select value={proveedorId} onValueChange={(value) => { setProveedorId(value); setPage(1); }}>
              <SelectTrigger className="bg-white">
                <SelectValue placeholder="Proveedor (Todos)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los proveedores</SelectItem>
                {catalogos?.proveedores?.filter((proveedor) => proveedor.activo).map((proveedor) => (
                  <SelectItem key={proveedor.id} value={String(proveedor.id)}>
                    {proveedor.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {ubicaciones && (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Sitio
              </label>
              <Select value={ubicacionId} onValueChange={(value) => { setUbicacionId(value); setPage(1); }}>
                <SelectTrigger className="bg-white">
                  <SelectValue placeholder="Sitio (Todos)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los sitios</SelectItem>
                  {ubicaciones.filter((ubicacion) => ubicacion.activa).map((ubicacion) => (
                    <SelectItem key={ubicacion.id} value={String(ubicacion.id)}>
                      {ubicacion.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-500" htmlFor="entrada-history-desde">
              Desde
            </label>
            <div className="relative">
              <CalendarIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                id="entrada-history-desde"
                data-testid="filter-entrada-desde"
                type="date"
                value={dateInputValue(fechaDesde)}
                onChange={(event) => { setFechaDesde(dateFromInput(event.target.value)); setPage(1); }}
                className="bg-white pl-9"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-500" htmlFor="entrada-history-hasta">
              Hasta
            </label>
            <div className="relative">
              <CalendarIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                id="entrada-history-hasta"
                data-testid="filter-entrada-hasta"
                type="date"
                value={dateInputValue(fechaHasta)}
                onChange={(event) => { setFechaHasta(dateFromInput(event.target.value)); setPage(1); }}
                className="bg-white pl-9"
              />
            </div>
          </div>

          <div className="flex items-end sm:col-span-2 lg:col-span-5">
            <Button type="button" variant="ghost" onClick={resetFilters} className="w-full text-slate-500 hover:text-slate-900 sm:w-auto">
              <X className="mr-2 h-4 w-4" />
              Limpiar filtros
            </Button>
          </div>
        </div>
      )}

      <CardContent className="p-0">
        {isLoading ? (
          <div className="flex h-[320px] flex-col items-center justify-center text-slate-400">
            <Package className="mb-4 h-12 w-12 animate-pulse opacity-30" />
            <p>Cargando historial...</p>
          </div>
        ) : isError ? (
          <div className="flex h-[320px] flex-col items-center justify-center gap-2 p-4 text-center text-destructive" role="alert">
            <p className="font-semibold">No se pudo cargar el historial de entradas.</p>
            <p className="text-sm">{getApiErrorMessage(error, "Recarga la página e intenta nuevamente.")}</p>
          </div>
        ) : entradasResult?.items.length === 0 ? (
          <div className="flex h-[320px] flex-col items-center justify-center p-4 text-center text-slate-400">
            <Package className="mb-4 h-12 w-12 opacity-20" />
            <p className="text-lg font-medium text-slate-600">No hay resultados</p>
            <p className="text-sm">Ajusta los filtros para ver más entradas.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full caption-bottom text-sm">
              <thead>
                <tr className="border-b bg-slate-50 text-left">
                  <th className="h-12 px-4 align-middle font-medium text-muted-foreground">Folio</th>
                  <th className="h-12 px-4 align-middle font-medium text-muted-foreground">Fecha</th>
                  <th className="h-12 px-4 align-middle font-medium text-muted-foreground">Sitio</th>
                  <th className="h-12 px-4 align-middle font-medium text-muted-foreground">Proveedor</th>
                  <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground">Rollos</th>
                </tr>
              </thead>
              <tbody>
                {(entradasResult?.items ?? []).map((entrada) => (
                  <tr key={entrada.id} className="border-b transition-colors hover:bg-slate-50/80">
                    <td className="p-4 align-middle">
                      <Link
                        href={`/entradas/${entrada.id}/documento`}
                        className="inline-flex items-center gap-1 font-semibold text-blue-700 underline underline-offset-2 hover:text-blue-900"
                        data-testid={`entrada-document-link-${entrada.id}`}
                      >
                        {entrada.folioFormateado}
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Link>
                    </td>
                    <td className="p-4 align-middle">
                      {new Date(entrada.createdAt).toLocaleString("es-MX", {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </td>
                    <td className="p-4 align-middle">{entrada.nombreUbicacion}</td>
                    <td className="p-4 align-middle">{entrada.nombreProveedor ?? "Sin proveedor"}</td>
                    <td className="p-4 text-right align-middle">
                      {formatNumber(entrada.totalRollos, { kind: "count" })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {entradasResult && totalPages > 1 && (
          <div className="flex flex-col gap-3 border-t bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-slate-500">
              Mostrando página {formatNumber(page, { kind: "count" })} de{" "}
              {formatNumber(totalPages, { kind: "count" })} (
              {formatNumber(entradasResult.total, { kind: "count" })} resultados)
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                data-testid="btn-entrada-page-previous"
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={page === 1}
              >
                <ChevronLeft className="mr-1 h-4 w-4" />
                Anterior
              </Button>
              <Button
                variant="outline"
                size="sm"
                data-testid="btn-entrada-page-next"
                onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                disabled={page === totalPages}
              >
                Siguiente
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}