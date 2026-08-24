import { useState } from "react";
import { useLocation } from "wouter";
import { AppLayout } from "@/components/layout/app-layout";
import { 
  useGetExistencias, 
  useListRollos,
  useGetCurrentUser,
  Role,
  ListRollosEstado
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useLocationScope } from "@/lib/location-scope";
import { Search, Boxes, Filter, ArrowRight } from "lucide-react";
import { useDebounce } from "@/hooks/use-debounce";

export default function Inventario() {
  const [, setLocation] = useLocation();
  const { data: user } = useGetCurrentUser();
  const isAdmin = user?.rol === Role.ADMIN;
  
  const { selectedLocationId } = useLocationScope();

  // "consolidado" solo si es ADMIN y eligió Vista Global
  const consolidado = isAdmin && selectedLocationId === null;
  const effectiveUbicacionId = consolidado ? undefined : (selectedLocationId ?? user?.ubicacion?.id);

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 500);

  const [estadoFilter, setEstadoFilter] = useState<string>("TODOS");

  const { data: existencias, isLoading: loadingExistencias } = useGetExistencias({
    ubicacionId: effectiveUbicacionId,
    consolidado
  });

  const { data: rollosRes, isLoading: loadingRollos } = useListRollos({
    ubicacionId: effectiveUbicacionId,
    serie: debouncedSearch ? debouncedSearch : undefined,
    estado: estadoFilter !== "TODOS" && estadoFilter !== "ABIERTO" ? estadoFilter as ListRollosEstado : undefined,
    soloAbiertos: estadoFilter === "ABIERTO" ? true : undefined,
    page: 1,
    pageSize: 100
  });

  // Local filter for existencias (search applied to tela/color/sku)
  const filteredExistencias = existencias?.filter(e => {
    if (!debouncedSearch) return true;
    const term = debouncedSearch.toLowerCase();
    return (
      (e.skuProducto || "").toLowerCase().includes(term) ||
      (e.telaProducto || "").toLowerCase().includes(term) ||
      (e.colorProducto || "").toLowerCase().includes(term)
    );
  }) ?? [];

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-sidebar">Control de Inventario</h1>
            <p className="text-muted-foreground mt-1">
              {consolidado ? "Vista Consolidada (Todos los sitios)" : "Inventario Local"}
            </p>
          </div>
        </div>

        <Tabs defaultValue="existencias" className="space-y-6">
          <div className="flex flex-col sm:flex-row justify-between gap-4">
            <TabsList className="bg-muted/50 p-1 w-full sm:w-auto h-12">
              <TabsTrigger value="existencias" className="h-10 px-6">Agrupado por Producto</TabsTrigger>
              <TabsTrigger value="rollos" className="h-10 px-6">Detalle de Rollos</TabsTrigger>
            </TabsList>

            <div className="flex gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input 
                  placeholder="Buscar SKU, tela, color, serie..." 
                  className="pl-9 bg-background"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
          </div>

          <TabsContent value="existencias" className="m-0">
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader className="bg-muted/30">
                    <TableRow>
                      <TableHead>Producto</TableHead>
                      <TableHead>SKU</TableHead>
                      {consolidado && <TableHead>Sitio</TableHead>}
                      <TableHead className="text-right">Rollos</TableHead>
                      <TableHead className="text-right">Cantidad</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loadingExistencias ? (
                      <TableRow>
                        <TableCell colSpan={consolidado ? 5 : 4} className="h-32 text-center text-muted-foreground">
                          Cargando inventario...
                        </TableCell>
                      </TableRow>
                    ) : filteredExistencias.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={consolidado ? 5 : 4} className="h-32 text-center text-muted-foreground">
                          <Boxes className="w-8 h-8 mx-auto mb-2 opacity-20" />
                          No se encontraron existencias
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredExistencias.map((item, idx) => (
                        <TableRow key={`${item.productoId}-${item.ubicacionId}-${idx}`}>
                          <TableCell className="font-medium">
                            {item.telaProducto} <span className="text-muted-foreground">/</span> {item.colorProducto}
                          </TableCell>
                          <TableCell><span className="font-mono text-sm bg-muted/50 px-1.5 py-0.5 rounded">{item.skuProducto}</span></TableCell>
                          {consolidado && <TableCell>{item.nombreUbicacion}</TableCell>}
                          <TableCell className="text-right font-bold">{item.rollosCount}</TableCell>
                          <TableCell className="text-right tabular-nums">
                            {parseFloat(item.cantidadTotal).toFixed(2)} <span className="text-xs text-muted-foreground">{item.unidadProducto}</span>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="rollos" className="m-0 space-y-4">
            <div className="flex gap-2 items-center text-sm">
              <Filter className="w-4 h-4 text-muted-foreground" />
              <Select value={estadoFilter} onValueChange={setEstadoFilter}>
                <SelectTrigger className="w-[180px] h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TODOS">Todos los estados</SelectItem>
                  <SelectItem value="DISPONIBLE">Disponibles</SelectItem>
                  <SelectItem value="ABIERTO">Abiertos</SelectItem>
                  <SelectItem value="EN_TRANSITO">En Tránsito</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {loadingRollos ? (
                <div className="col-span-full h-32 flex items-center justify-center text-muted-foreground">Cargando rollos...</div>
              ) : rollosRes?.items.length === 0 ? (
                <div className="col-span-full h-48 flex flex-col items-center justify-center text-muted-foreground bg-muted/10 rounded-xl border border-dashed">
                  <Boxes className="w-8 h-8 mb-2 opacity-20" />
                  No se encontraron rollos con estos filtros
                </div>
              ) : (
                rollosRes?.items.map(rollo => (
                  <Card 
                    key={rollo.id} 
                    className="hover:border-primary/50 hover:shadow-md transition-all cursor-pointer group flex flex-col"
                    onClick={() => setLocation(`/inventario/rollos/${rollo.id}`)}
                  >
                    <CardHeader className="p-4 pb-2 border-b bg-muted/10">
                      <div className="flex justify-between items-start">
                        <span className="font-mono font-bold text-lg tracking-tight group-hover:text-primary transition-colors">
                          {rollo.serie}
                        </span>
                        <Badge variant={rollo.estado === 'DISPONIBLE' ? 'default' : rollo.estado === 'ABIERTO' ? 'secondary' : 'outline'}>
                          {rollo.estado}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="p-4 flex-1 flex flex-col justify-between">
                      <div className="mb-4">
                        <div className="font-semibold text-foreground truncate" title={`${rollo.telaProducto} / ${rollo.colorProducto}`}>
                          {rollo.telaProducto} <span className="text-muted-foreground font-normal">/</span> {rollo.colorProducto}
                        </div>
                        {consolidado && <div className="text-xs text-muted-foreground mt-1">{rollo.nombreUbicacion}</div>}
                      </div>
                      
                      <div className="flex items-end justify-between mt-auto">
                        <div>
                          <div className="text-2xl font-bold tracking-tight">
                            {parseFloat(rollo.cantidadActual).toFixed(2)}
                          </div>
                          {parseFloat(rollo.cantidadActual) !== parseFloat(rollo.cantidadInicial) && (
                            <div className="text-xs text-muted-foreground line-through">
                              {parseFloat(rollo.cantidadInicial).toFixed(2)} original
                            </div>
                          )}
                        </div>
                        <ArrowRight className="w-5 h-5 text-muted-foreground opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
            
            {rollosRes && rollosRes.total > rollosRes.pageSize && (
              <div className="text-center text-sm text-muted-foreground p-4 bg-muted/20 rounded-lg">
                Mostrando los primeros {rollosRes.items.length} rollos. Utilice la búsqueda para encontrar rollos específicos.
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
