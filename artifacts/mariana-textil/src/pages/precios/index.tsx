import { useState } from "react";
import { Link } from "wouter";
import { AppLayout } from "@/components/layout/app-layout";
import { 
  useListPrecios, 
  useUpdatePrecioVentaPorMetro,
  getListPreciosQueryKey,
  UnidadProducto,
  SemaforoPrecio,
  PrecioProducto
} from "@workspace/api-client-react";
import { formatNumber } from "@workspace/number-format";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, MapPin, Tag, Filter, CheckCircle2, AlertCircle, AlertTriangle, AlertOctagon, HelpCircle } from "lucide-react";
import { format } from "date-fns";
import { Switch } from "@/components/ui/switch";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export default function PreciosList() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [unidad, setUnidad] = useState<string>("all");
  const [semaforo, setSemaforo] = useState<string>("all");

  const queryParams = {
    search: debouncedSearch || undefined,
    unidad: unidad !== "all" ? (unidad as UnidadProducto) : undefined,
    semaforo: semaforo !== "all" ? (semaforo as SemaforoPrecio) : undefined,
  };

  const { data: precios, isLoading } = useListPrecios(queryParams, {
    query: {
      queryKey: getListPreciosQueryKey(queryParams)
    }
  });
  const updateVentaPorMetro = useUpdatePrecioVentaPorMetro();

  const setVentaPorMetro = (product: PrecioProducto, checked: boolean) => {
    updateVentaPorMetro.mutate(
      { id: product.id, data: { seVendePorMetro: checked } },
      {
        onSuccess: () => {
          toast.success(
            checked
              ? "Venta por metro habilitada"
              : "Venta por metro deshabilitada",
          );
          queryClient.invalidateQueries({ queryKey: getListPreciosQueryKey() });
        },
        onError: (error: any) => {
          toast.error("No se pudo actualizar el interruptor", {
            description: error?.data?.error ?? error?.message,
          });
        },
      },
    );
  };

  const getSemaforoBadge = (s: SemaforoPrecio) => {
    switch (s) {
      case SemaforoPrecio.VERDE:
        return <Badge variant="outline" className="bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800"><CheckCircle2 className="w-3 h-3 mr-1" /> Saludable</Badge>;
      case SemaforoPrecio.AMBAR:
        return <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800"><AlertTriangle className="w-3 h-3 mr-1" /> Precaución</Badge>;
      case SemaforoPrecio.ROJO:
        return <Badge variant="outline" className="bg-red-100 text-red-800 border-red-300 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800"><AlertOctagon className="w-3 h-3 mr-1" /> Crítico</Badge>;
      case SemaforoPrecio.SIN_COSTO:
        return <Badge variant="outline" className="bg-slate-100 text-slate-800 border-slate-300 dark:bg-slate-900/30 dark:text-slate-400 dark:border-slate-800"><HelpCircle className="w-3 h-3 mr-1" /> Sin costo</Badge>;
    }
  };

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-sidebar">Gobernanza de Precios</h1>
            <p className="text-muted-foreground mt-1">
              Catálogo central de precios de lista y análisis de márgenes.
            </p>
          </div>
        </div>

        <Card>
          <CardHeader className="pb-4">
            <div className="flex flex-wrap items-center gap-4">
              <div className="relative flex-1 min-w-[250px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Buscar por SKU, tela o color..." 
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && setDebouncedSearch(search)}
                  onBlur={() => setDebouncedSearch(search)}
                  className="pl-9 h-10"
                  data-testid="input-search-precios"
                />
              </div>
              <div className="w-40">
                <Select value={unidad} onValueChange={setUnidad}>
                  <SelectTrigger className="h-10" data-testid="select-unidad">
                    <SelectValue placeholder="Unidad" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas las uds.</SelectItem>
                    <SelectItem value={UnidadProducto.METRO}>Metros</SelectItem>
                    <SelectItem value={UnidadProducto.KILO}>Kilos</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="w-48">
                <Select value={semaforo} onValueChange={setSemaforo}>
                  <SelectTrigger className="h-10" data-testid="select-semaforo">
                    <SelectValue placeholder="Estado de Margen" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los estados</SelectItem>
                    <SelectItem value={SemaforoPrecio.VERDE}>Saludable (Verde)</SelectItem>
                    <SelectItem value={SemaforoPrecio.AMBAR}>Precaución (Ámbar)</SelectItem>
                    <SelectItem value={SemaforoPrecio.ROJO}>Crítico (Rojo)</SelectItem>
                    <SelectItem value={SemaforoPrecio.SIN_COSTO}>Sin costo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto rounded-b-lg border-t">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead className="w-[120px]">SKU</TableHead>
                    <TableHead>Producto</TableHead>
                    <TableHead className="w-[80px] text-center">Unidad</TableHead>
                    <TableHead className="w-[190px]">Venta por metro</TableHead>
                    <TableHead className="text-right">Costo Pond.</TableHead>
                    <TableHead className="text-right">Precio Lista</TableHead>
                    <TableHead className="text-right">Margen $</TableHead>
                    <TableHead className="text-right">Margen %</TableHead>
                    <TableHead className="text-center">Estado</TableHead>
                    <TableHead className="text-right">Último Cambio</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={10} className="h-24 text-center text-muted-foreground">
                        Cargando precios...
                      </TableCell>
                    </TableRow>
                  ) : !precios || precios.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={10} className="h-24 text-center text-muted-foreground">
                        No se encontraron productos con precios para los filtros seleccionados.
                      </TableCell>
                    </TableRow>
                  ) : (
                    precios.map((precio) => (
                      <TableRow key={precio.id} className={!precio.activo ? "opacity-60" : ""}>
                        <TableCell className="font-mono text-sm">
                          <Link href={`/precios/${precio.id}`} className="text-primary hover:underline font-semibold" data-testid={`link-precio-${precio.sku}`}>
                            {precio.sku}
                          </Link>
                        </TableCell>
                        <TableCell>
                          <div className="font-medium text-foreground">{precio.tela}</div>
                          <div className="text-xs text-muted-foreground">{precio.color}</div>
                        </TableCell>
                        <TableCell className="text-center text-xs text-muted-foreground font-medium uppercase">
                          {precio.unidad}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={precio.seVendePorMetro}
                              disabled={
                                precio.unidad === UnidadProducto.KILO ||
                                (updateVentaPorMetro.isPending &&
                                  updateVentaPorMetro.variables?.id === precio.id)
                              }
                              onCheckedChange={(checked) =>
                                setVentaPorMetro(precio, checked)
                              }
                              aria-label={`Venta por metro de ${precio.tela} ${precio.color}`}
                              data-testid={`switch-venta-metro-${precio.sku}`}
                            />
                            <span className="text-xs text-muted-foreground">
                              {precio.unidad === UnidadProducto.KILO
                                ? "No disponible: los kilos solo se venden por rollo."
                                : precio.seVendePorMetro
                                  ? "Habilitada"
                                  : "Mayoreo y menudeo bloqueados"}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {precio.costoUnitarioPonderado ? formatNumber(precio.costoUnitarioPonderado, { kind: "money" }) : "—"}
                        </TableCell>
                        <TableCell className="text-right font-bold text-foreground">
                          {formatNumber(precio.precioLista, { kind: "money" })}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {precio.margenPesosUnidad ? formatNumber(precio.margenPesosUnidad, { kind: "money" }) : "—"}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {precio.margenPorcentajeSubtotal ? formatNumber(precio.margenPorcentajeSubtotal, { kind: "percentage" }) : "—"}
                        </TableCell>
                        <TableCell className="text-center">
                          {getSemaforoBadge(precio.semaforo)}
                        </TableCell>
                        <TableCell className="text-right text-xs text-muted-foreground whitespace-nowrap">
                          {precio.ultimoCambioPrecio ? format(new Date(precio.ultimoCambioPrecio), "dd/MM/yyyy HH:mm") : "Sin historial"}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
