import { useState, useMemo } from "react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChevronDown, ChevronUp, ChevronsUpDown, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

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

export function HistorialCompras() {
  const [proveedorId, setProveedorId] = useState<string>("ALL");
  const [ubicacionId, setUbicacionId] = useState<string>("ALL");
  const [desde, setDesde] = useState<string>("");
  const [hasta, setHasta] = useState<string>("");
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
    ...(proveedorId !== "ALL" && { proveedorId: Number(proveedorId) }),
    ...(ubicacionId !== "ALL" && { ubicacionId: Number(ubicacionId) }),
    ...(desde && { desde }),
    ...(hasta && { hasta }),
    sort,
    direction,
    page,
    pageSize
  }), [proveedorId, ubicacionId, desde, hasta, sort, direction, page, pageSize]);

  const { data: historialData, isLoading, isFetching } = useListHistorialComprasProveedores(listParams, {
    query: {
      queryKey: getListHistorialComprasProveedoresQueryKey(listParams)
    }
  });

  const ubicacionesOptions = useMemo(() => {
    return [...(historialData?.sitios ?? [])]
      .sort((a, b) => a.nombre.localeCompare(b.nombre, "es", { sensitivity: "base" }));
  }, [historialData?.sitios]);

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

  const handleFilterChange = (setter: (v: string) => void) => (val: string) => {
    setter(val);
    setPage(1);
  };

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
      <div className="p-4 border-b flex flex-col sm:flex-row gap-4 sm:items-center bg-muted/20">
        <div className="flex-1 flex flex-col sm:flex-row gap-4">
          <Select value={proveedorId} onValueChange={handleFilterChange(setProveedorId)}>
            <SelectTrigger className="w-full sm:w-[220px] bg-background">
              <SelectValue placeholder="Todos los proveedores" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todos los proveedores</SelectItem>
              {proveedoresOptions.map(p => (
                <SelectItem key={p.id} value={p.id.toString()}>{p.nombre}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={ubicacionId} onValueChange={handleFilterChange(setUbicacionId)}>
            <SelectTrigger className="w-full sm:w-[200px] bg-background">
              <SelectValue placeholder="Todas las ubicaciones" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todas las ubicaciones</SelectItem>
              {ubicacionesOptions.map(u => (
                <SelectItem key={u.id} value={u.id.toString()}>{u.nombre}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <Input
            type="date"
            value={desde}
            onChange={(e) => handleFilterChange(setDesde)(e.target.value)}
            className="w-[140px] bg-background text-sm h-9"
          />
          <span className="text-muted-foreground text-sm">a</span>
          <Input
            type="date"
            value={hasta}
            onChange={(e) => handleFilterChange(setHasta)(e.target.value)}
            className="w-[140px] bg-background text-sm h-9"
          />
        </div>
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
                  <TableCell colSpan={6} className="h-48 text-center text-muted-foreground">
                    No se encontraron registros de compras para estos filtros.
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
