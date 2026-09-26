import { useState, useMemo, useEffect } from "react";
import { 
  useListHistorialComprasProveedores, 
  useListProveedores, 
  getListProveedoresQueryKey, 
  getListHistorialComprasProveedoresQueryKey 
} from "@workspace/api-client-react";
import { formatNumber, formatUnit } from "@workspace/number-format";
import { Link } from "wouter";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp, ChevronsUpDown, Loader2, PackageOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { CombinedFilterBar, MultiSelectConfig } from "@/components/shared/combined-filter-bar";
import {
  readCombinedFilterCriteria,
  sanitizeCombinedFilterCriteria,
  writeCombinedFilterCriteriaFromUserAction,
} from "@/components/shared/combined-filter-url";
import { toast } from "sonner";

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "-";
  try {
    return new Intl.DateTimeFormat("es-MX", {
      timeZone: "America/Mexico_City",
      year: "numeric",
      month: "short",
      day: "2-digit"
    }).format(new Date(dateStr));
  } catch (e) {
    return "-";
  }
}

type SortColumn = "fecha" | "producto" | "proveedor" | "color" | "sitio" | "cantidad";

function arraysEqual<T>(left: T[], right: T[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

export function HistorialCompras() {
  const initialCriteria = useMemo(() => readCombinedFilterCriteria(new URLSearchParams(window.location.search)), []);
  const [proveedorIds, setProveedorIds] = useState<number[]>(initialCriteria.proveedorIds);
  const [ubicacionIds, setUbicacionIds] = useState<number[]>(initialCriteria.ubicacionIds);
  const [telas, setTelas] = useState<string[]>(initialCriteria.telas);
  const [colores, setColores] = useState<string[]>(initialCriteria.colores);
  const [desde, setDesde] = useState<string>(initialCriteria.desde ?? "");
  const [hasta, setHasta] = useState<string>(initialCriteria.hasta ?? "");

  const [sort, setSort] = useState<SortColumn>("fecha");
  const [direction, setDirection] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const pageSize = 50;

  const [fechaClicked, setFechaClicked] = useState(false);

  const { data: proveedoresData } = useListProveedores({
    query: { queryKey: getListProveedoresQueryKey() }
  });

  const proveedoresOptions = useMemo(() => {
    if (!proveedoresData?.items) return [];
    return [...proveedoresData.items].sort((a, b) => a.nombre.localeCompare(b.nombre, "es", { sensitivity: "base" }));
  }, [proveedoresData]);

  const listParams = useMemo(() => ({
    ...(proveedorIds.length > 0 && { proveedorIds }),
    ...(ubicacionIds.length > 0 && { ubicacionIds }),
    ...(telas.length > 0 && { telas }),
    ...(colores.length > 0 && { colores }),
    ...(desde && { desde }),
    ...(hasta && { hasta }),
    sort,
    direction,
    page,
    pageSize
  }), [proveedorIds, ubicacionIds, telas, colores, desde, hasta, sort, direction, page, pageSize]);

  const { data: historialData, isLoading, isFetching } = useListHistorialComprasProveedores(listParams, {
    query: {
      queryKey: getListHistorialComprasProveedoresQueryKey(listParams)
    }
  });

  const ubicacionesOptions = useMemo(() => {
    return [...(historialData?.sitios ?? [])]
      .sort((a, b) => a.nombre.localeCompare(b.nombre, "es", { sensitivity: "base" }));
  }, [historialData?.sitios]);

  const telasOptions = useMemo(() => {
    return (historialData?.telas ?? []).map(t => ({ id: t, nombre: t }));
  }, [historialData?.telas]);

  const coloresOptions = useMemo(() => {
    return (historialData?.colores ?? []).map(c => ({ id: c, nombre: c }));
  }, [historialData?.colores]);

  useEffect(() => {
    if (!historialData || !proveedoresData?.items) return;
    const sanitized = sanitizeCombinedFilterCriteria(
      { proveedorIds, ubicacionIds, telas, colores, desde: desde || undefined, hasta: hasta || undefined },
      {
        proveedorIds: proveedoresData.items.map((item) => item.id),
        ubicacionIds: historialData.sitios.map((item) => item.id),
        telas: historialData.telas,
        colores: historialData.colores,
      },
    );
    const proveedoresChanged = !arraysEqual(proveedorIds, sanitized.proveedorIds);
    const ubicacionesChanged = !arraysEqual(ubicacionIds, sanitized.ubicacionIds);
    const telasChanged = !arraysEqual(telas, sanitized.telas);
    const coloresChanged = !arraysEqual(colores, sanitized.colores);
    if (!proveedoresChanged && !ubicacionesChanged && !telasChanged && !coloresChanged) return;
    toast.info("Se ignoraron filtros que ya no existen", {
      description: "La vista conserva únicamente los filtros válidos.",
    });
    if (proveedoresChanged) setProveedorIds(sanitized.proveedorIds);
    if (ubicacionesChanged) setUbicacionIds(sanitized.ubicacionIds);
    if (telasChanged) setTelas(sanitized.telas);
    if (coloresChanged) setColores(sanitized.colores);
  }, [historialData?.sitios, historialData?.telas, historialData?.colores, proveedoresData?.items]);

  const handleSort = (column: SortColumn) => {
    if (column === "fecha" && !fechaClicked) {
      setFechaClicked(true);
      setSort("fecha");
      setDirection("desc");
      setPage(1);
      return;
    }

    if (sort === column) {
      setDirection(prev => prev === "asc" ? "desc" : "asc");
    } else {
      setSort(column);
      setDirection(column === "fecha" ? "desc" : "asc");
    }
    setPage(1);
  };

  const handleClearAll = () => {
    writeCombinedFilterCriteriaFromUserAction({
      proveedorIds: [],
      ubicacionIds: [],
      telas: [],
      colores: [],
    });
    setProveedorIds([]);
    setUbicacionIds([]);
    setTelas([]);
    setColores([]);
    setDesde("");
    setHasta("");
    setPage(1);
  };

  const handleMultiSelectChange = (key: string, selected: string[]) => {
    const nextProveedorIds = key === "proveedorIds" ? selected.map(Number) : proveedorIds;
    const nextUbicacionIds = key === "ubicacionIds" ? selected.map(Number) : ubicacionIds;
    const nextTelas = key === "telas" ? selected : telas;
    const nextColores = key === "colores" ? selected : colores;
    writeCombinedFilterCriteriaFromUserAction({
      proveedorIds: nextProveedorIds,
      ubicacionIds: nextUbicacionIds,
      telas: nextTelas,
      colores: nextColores,
      desde: desde || undefined,
      hasta: hasta || undefined,
    });
    if (key === "proveedorIds") setProveedorIds(nextProveedorIds);
    if (key === "ubicacionIds") setUbicacionIds(nextUbicacionIds);
    if (key === "telas") setTelas(nextTelas);
    if (key === "colores") setColores(nextColores);
    setPage(1);
  };

  const handleDateRangeChange = (nextDesde?: string, nextHasta?: string) => {
    writeCombinedFilterCriteriaFromUserAction({
      proveedorIds,
      ubicacionIds,
      telas,
      colores,
      desde: nextDesde || undefined,
      hasta: nextHasta || undefined,
    });
    setDesde(nextDesde || "");
    setHasta(nextHasta || "");
    setPage(1);
  };

  const multiSelects: MultiSelectConfig[] = [
    {
      key: "proveedorIds",
      label: "Proveedores",
      options: proveedoresOptions.map(p => ({ id: p.id, nombre: p.nombre })),
      selected: proveedorIds.map(String),
    },
    {
      key: "ubicacionIds",
      label: "Sitios",
      options: ubicacionesOptions.map(u => ({ id: u.id, nombre: u.nombre })),
      selected: ubicacionIds.map(String),
    },
    {
      key: "telas",
      label: "Telas",
      options: telasOptions,
      selected: telas,
    },
    {
      key: "colores",
      label: "Colores",
      options: coloresOptions,
      selected: colores,
    }
  ];
  const emptyCombination = [
    telas.length ? `Tela: ${telas.join(" o ")}` : "",
    colores.length ? `Color: ${colores.join(" o ")}` : "",
    proveedorIds.length ? `Proveedor: ${proveedorIds.length} seleccionado(s)` : "",
    ubicacionIds.length ? `Sitio: ${ubicacionIds.length} seleccionado(s)` : "",
    desde || hasta ? `Fechas: ${desde || "inicio"} a ${hasta || "fin"}` : "",
  ].filter(Boolean).join("; ");

  const headers: { key: SortColumn; label: string; align?: "right" }[] = [
    { key: "fecha", label: "Fecha" },
    { key: "proveedor", label: "Proveedor" },
    { key: "producto", label: "Producto" },
    { key: "color", label: "Color" },
    { key: "sitio", label: "Sitio" },
    { key: "cantidad", label: "Cantidad", align: "right" }
  ];

  return (
    <Card className="flex flex-col border-border shadow-sm">
      <div className="p-4 border-b bg-muted/20">
        <CombinedFilterBar
          multiSelects={multiSelects}
          onMultiSelectChange={handleMultiSelectChange}
          showDateRange={true}
          desde={desde}
          hasta={hasta}
          onDateRangeChange={handleDateRangeChange}
          onClearAll={handleClearAll}
        />
      </div>

      <CardContent className="p-0 flex-1 relative">
        <div className="overflow-auto max-h-[600px]">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-background shadow-[0_1px_0_0_hsl(var(--border))]">
              <TableRow className="hover:bg-transparent">
                {headers.map(h => {
                  const isActive = sort === h.key;
                  return (
                    <TableHead
                      key={h.key}
                      className={cn(
                        "cursor-pointer select-none whitespace-nowrap transition-colors hover:bg-muted/40 group h-10",
                        isActive && "bg-muted/20 font-semibold text-foreground",
                        h.align === "right" && "text-right"
                      )}
                      onClick={() => handleSort(h.key)}
                    >
                      <div className={cn("flex items-center gap-1.5", h.align === "right" && "justify-end")}>
                        {h.label}
                        <span className={cn("flex-shrink-0", !isActive && "opacity-40")}>
                          {!isActive ? (
                            <ChevronsUpDown className="w-3.5 h-3.5" />
                          ) : direction === "asc" ? (
                            <ChevronUp className="w-3.5 h-3.5" />
                          ) : (
                            <ChevronDown className="w-3.5 h-3.5" />
                          )}
                        </span>
                      </div>
                    </TableHead>
                  );
                })}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && !historialData ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-48 text-center text-muted-foreground">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Loader2 className="h-6 w-6 animate-spin text-primary" />
                      <span>Cargando historial...</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : !historialData?.items || historialData.items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-64 text-center text-muted-foreground">
                    <div className="flex flex-col items-center justify-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center">
                        <PackageOpen className="w-6 h-6 text-muted-foreground/50" />
                      </div>
                      <div className="space-y-1">
                        <p className="font-medium text-foreground">La combinación no arrojó compras</p>
                        <p className="text-sm">{emptyCombination || "No hay compras registradas en el alcance disponible."}</p>
                      </div>
                      <Button variant="outline" size="sm" onClick={handleClearAll} className="mt-2">
                        Limpiar filtros
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                historialData.items.map((row, i) => (
                  <TableRow key={`${row.entradaId}-${row.productoId}-${i}`} className="hover:bg-muted/20 transition-colors">
                    <TableCell className="whitespace-nowrap text-muted-foreground py-2.5">
                      {formatDate(row.fecha)}
                    </TableCell>
                    <TableCell className="max-w-[180px] truncate py-2.5" title={row.proveedor}>
                      {row.proveedor}
                    </TableCell>
                    <TableCell className="py-2.5">
                       <Link
                         href={`/entradas/${row.entradaId}`}
                         className="text-primary hover:text-primary/80 hover:underline font-medium block max-w-[220px] truncate focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring rounded-sm"
                         title={row.producto}
                       >
                         {row.producto}
                       </Link>
                    </TableCell>
                    <TableCell className="max-w-[120px] truncate py-2.5" title={row.color || ""}>
                      {row.color || <span className="text-muted-foreground/50">-</span>}
                    </TableCell>
                    <TableCell className="max-w-[140px] truncate py-2.5" title={row.sitio}>
                      {row.sitio}
                    </TableCell>
                    <TableCell className="text-right font-medium whitespace-nowrap py-2.5">
                      {formatNumber(row.cantidad, { kind: "quantity" })} {formatUnit(row.unidad)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>

      <div className="flex flex-col sm:flex-row items-center justify-between px-4 py-3 border-t bg-muted/10 gap-4 rounded-b-md">
        <div className="text-sm text-muted-foreground flex items-center gap-2">
          Mostrando {historialData?.items?.length || 0} de {historialData?.total || 0} resultados
          {isFetching && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page === 1 || isLoading}
            onClick={() => setPage(p => p - 1)}
            className="h-8"
          >
            Anterior
          </Button>
          <div className="text-sm font-medium px-2 min-w-[5rem] text-center">
            Pág {page}
          </div>
          <Button
            variant="outline"
            size="sm"
            disabled={!historialData || page * pageSize >= historialData.total || isLoading}
            onClick={() => setPage(p => p + 1)}
            className="h-8"
          >
            Siguiente
          </Button>
        </div>
      </div>
    </Card>
  );
}
