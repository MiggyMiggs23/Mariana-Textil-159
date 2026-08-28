import React, { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { AppLayout } from "@/components/layout/app-layout";
import {
  useGetExistenciasAgrupadas,
  useListRollos,
  useGetCurrentUser,
  getGetExistenciasAgrupadasQueryKey,
  useListPisosLocation,
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
import { Search, Boxes, Filter, ArrowRight, ChevronDown, ChevronRight } from "lucide-react";
import { useDebounce } from "@/hooks/use-debounce";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { formatNumber } from "@workspace/number-format";

export default function Inventario() {
  const [, setLocation] = useLocation();
  const { data: user } = useGetCurrentUser();
  const isTodas = user?.alcanceConsulta === "TODAS";
  const isCaja = user?.rol === Role.CAJA;

  const { selectedLocationId } = useLocationScope();

  // "consolidado" solo si es TODAS y eligió Vista Global
  const consolidado = !isCaja && isTodas && selectedLocationId === null;
  const effectiveUbicacionId = isCaja
    ? user?.ubicacion?.id
    : consolidado
      ? undefined
      : (selectedLocationId ?? user?.ubicacion?.id);

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 500);

  const [estadoFilter, setEstadoFilter] = useState<string>("TODOS");
  const [pisoFilter, setPisoFilter] = useState<string>("TODOS");
  const [showZero, setShowZero] = useState(false);

  useEffect(() => {
    setPisoFilter("TODOS");
  }, [effectiveUbicacionId]);

  const { data: pisos } = useListPisosLocation(effectiveUbicacionId ?? 0, {
    query: { enabled: !!effectiveUbicacionId && !consolidado, queryKey: ['pisosLocation', effectiveUbicacionId ?? 0] }
  });

  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(() => {
    try {
      const stored = sessionStorage.getItem("inv_expanded_groups");
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch {
      return new Set();
    }
  });

  const { data: existenciasAgrupadas, isLoading: loadingExistencias } = useGetExistenciasAgrupadas({
    ubicacionId: effectiveUbicacionId,
    search: debouncedSearch || undefined,
    includeSinExistencia: showZero ? true : undefined
  }, {
    query: {
      queryKey: getGetExistenciasAgrupadasQueryKey({
        ubicacionId: effectiveUbicacionId,
        search: debouncedSearch || undefined,
        includeSinExistencia: showZero ? true : undefined
      })
    }
  });

  useEffect(() => {
    if (debouncedSearch && existenciasAgrupadas) {
      const keys = existenciasAgrupadas.map(g => g.productoKey);
      setExpandedGroups(prev => {
        const next = new Set(prev);
        keys.forEach(k => next.add(k));
        sessionStorage.setItem("inv_expanded_groups", JSON.stringify(Array.from(next)));
        return next;
      });
    }
  }, [debouncedSearch, existenciasAgrupadas]);

  const toggleGroup = (key: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      sessionStorage.setItem("inv_expanded_groups", JSON.stringify(Array.from(next)));
      return next;
    });
  };

  const toggleAllGroups = () => {
    if (!existenciasAgrupadas) return;
    if (expandedGroups.size === existenciasAgrupadas.length) {
      setExpandedGroups(new Set());
      sessionStorage.setItem("inv_expanded_groups", JSON.stringify([]));
    } else {
      const all = new Set(existenciasAgrupadas.map(g => g.productoKey));
      setExpandedGroups(all);
      sessionStorage.setItem("inv_expanded_groups", JSON.stringify(Array.from(all)));
    }
  };

  const { data: rollosRes, isLoading: loadingRollos } = useListRollos({
    ubicacionId: effectiveUbicacionId,
    serie: debouncedSearch ? debouncedSearch : undefined,
    estado: estadoFilter !== "TODOS" ? estadoFilter as ListRollosEstado : undefined,
    pisoId: pisoFilter !== "TODOS" ? Number(pisoFilter) : undefined,
    page: 1,
    pageSize: 100
  });

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
            <div className="flex items-center gap-4 mb-4 mt-2">
              <Button variant="outline" size="sm" onClick={toggleAllGroups} disabled={!existenciasAgrupadas?.length}>
                {existenciasAgrupadas && expandedGroups.size === existenciasAgrupadas.length ? "Contraer todos" : "Expandir todos"}
              </Button>
              <div className="flex items-center gap-2 border bg-card px-3 py-1.5 rounded-md shadow-sm">
                <Switch id="show-zero" checked={showZero} onCheckedChange={setShowZero} data-testid="toggle-show-zero" />
                <Label htmlFor="show-zero" className="text-sm font-medium cursor-pointer">Mostrar sin existencias</Label>
              </div>
            </div>

            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader className="bg-muted/30">
                    <TableRow>
                      <TableHead className="w-8"></TableHead>
                      <TableHead>Tela / Producto</TableHead>
                      {isTodas && <TableHead>Sitio</TableHead>}
                      <TableHead className="text-right">Rollos</TableHead>
                      <TableHead className="text-right">Total Metros</TableHead>
                      <TableHead className="text-right">Total Kilos</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loadingExistencias ? (
                      <TableRow>
                        <TableCell colSpan={isTodas ? 6 : 5} className="h-32 text-center text-muted-foreground">
                          Cargando inventario...
                        </TableCell>
                      </TableRow>
                    ) : existenciasAgrupadas?.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={isTodas ? 6 : 5} className="h-32 text-center text-muted-foreground">
                          <Boxes className="w-8 h-8 mx-auto mb-2 opacity-20" />
                          No se encontraron existencias
                        </TableCell>
                      </TableRow>
                    ) : (
                      existenciasAgrupadas?.map(grupo => (
                        <React.Fragment key={grupo.productoKey}>
                          <TableRow className="bg-secondary/20 hover:bg-secondary/30 cursor-pointer border-b border-border/50" onClick={() => toggleGroup(grupo.productoKey)} data-testid={`group-${grupo.productoKey}`}>
                            <TableCell className="p-3">
                              {expandedGroups.has(grupo.productoKey) ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                            </TableCell>
                            <TableCell className="font-bold py-3">
                              {grupo.telaProducto}
                              <Badge variant="outline" className="ml-2 bg-background font-normal text-xs">{grupo.coloresCount} colores</Badge>
                            </TableCell>
                            {isTodas && <TableCell></TableCell>}
                            <TableCell className="text-right font-bold py-3">{formatNumber(grupo.rollosCount, { kind: "count" })}</TableCell>
                            <TableCell className="text-right tabular-nums py-3">{parseFloat(grupo.totalMetros) > 0 ? formatNumber(grupo.totalMetros, { kind: "quantity" }) : "-"}</TableCell>
                            <TableCell className="text-right tabular-nums py-3">{parseFloat(grupo.totalKilos) > 0 ? formatNumber(grupo.totalKilos, { kind: "quantity" }) : "-"}</TableCell>
                          </TableRow>
                          {expandedGroups.has(grupo.productoKey) && grupo.colores.map((hijo, idx) => (
                            <TableRow key={hijo.productoId} className={idx === grupo.colores.length - 1 ? "border-b-2" : "border-b-0"}>
                              <TableCell></TableCell>
                              <TableCell className="pl-6 py-2">
                                <div className="flex items-center gap-2">
                                  <div className="w-1.5 h-1.5 rounded-full bg-primary/40"></div>
                                  <span className="font-medium text-sm">{hijo.color}</span>
                                  <span className="font-mono text-xs bg-muted/50 px-1.5 py-0.5 rounded text-muted-foreground ml-2 border">{hijo.sku}</span>
                                </div>
                              </TableCell>
                              {isTodas && <TableCell className="py-2"></TableCell>}
                               <TableCell className="text-right py-2">{formatNumber(hijo.rollosCount, { kind: "count" })}</TableCell>
                              <TableCell className="text-right tabular-nums py-2" colSpan={2}>
                                <div className="flex items-center justify-end gap-1">
                                   <span className="font-medium">{formatNumber(hijo.cantidadTotal, { kind: "quantity" })}</span>
                                  <span className="text-xs text-muted-foreground uppercase">{hijo.unidad}</span>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </React.Fragment>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="rollos" className="m-0 space-y-4">
            <div className="flex flex-wrap gap-2 items-center text-sm">
              <div className="flex items-center gap-2 bg-background border rounded-md px-2">
                <Filter className="w-4 h-4 text-muted-foreground" />
                <Select value={estadoFilter} onValueChange={setEstadoFilter}>
                  <SelectTrigger className="w-[180px] h-8 border-0 shadow-none focus:ring-0 px-0">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TODOS">Todos los estados</SelectItem>
                    <SelectItem value="DISPONIBLE">Disponibles</SelectItem>
                    <SelectItem value="MOSTRADOR">Mostrador</SelectItem>
                    <SelectItem value="EN_TRANSITO">En Tránsito</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {!consolidado && pisos && pisos.length > 0 && (
                <div className="flex items-center gap-2 bg-background border rounded-md px-2">
                  <span className="text-muted-foreground font-semibold text-xs ml-1">Piso</span>
                  <Select value={pisoFilter} onValueChange={setPisoFilter}>
                    <SelectTrigger className="w-[150px] h-8 border-0 shadow-none focus:ring-0 px-0">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="TODOS">Todos los pisos</SelectItem>
                      {pisos.map(p => (
                        <SelectItem key={p.id} value={p.id.toString()}>{p.nombre}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
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
                        <Badge variant={rollo.estado === 'DISPONIBLE' ? 'default' : rollo.estado === 'MOSTRADOR' ? 'secondary' : 'outline'}>
                          {rollo.estado}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="p-4 flex-1 flex flex-col justify-between">
                      <div className="mb-4">
                        <div className="font-semibold text-foreground truncate" title={`${rollo.telaProducto} / ${rollo.colorProducto}`}>
                          {rollo.telaProducto} <span className="text-muted-foreground font-normal">/</span> {rollo.colorProducto}
                        </div>
                        {isTodas && <div className="text-xs text-muted-foreground mt-1">{rollo.nombreUbicacion}</div>}
                        {(rollo as any).nombrePiso && (
                          <div className="text-[10px] uppercase font-bold text-muted-foreground mt-1 bg-muted/30 px-1.5 py-0.5 rounded w-fit border border-dashed">
                            Piso: {(rollo as any).nombrePiso}
                          </div>
                        )}
                      </div>

                        <div className="flex items-end justify-between mt-auto gap-3">
                        <div>
                          <div className="text-2xl font-bold tracking-tight">
                             {formatNumber(rollo.cantidadActual, { kind: "quantity" })}
                          </div>
                          {parseFloat(rollo.cantidadActual) !== parseFloat(rollo.cantidadInicial) && (
                            <div className="text-xs text-muted-foreground line-through">
                               {formatNumber(rollo.cantidadInicial, { kind: "quantity" })} original
                            </div>
                          )}
                        </div>
                        {isCaja && (
                          <div className="mt-3 border-t pt-3 text-xs text-muted-foreground">
                            <div className="flex justify-between gap-3">
                              <span>Costo unitario</span>
                              <span className="font-semibold text-foreground">
                                {rollo.costoUnitario == null ? "Pendiente" : formatNumber(rollo.costoUnitario, { kind: "money" })}
                              </span>
                            </div>
                            <div className="mt-1 flex justify-between gap-3">
                              <span>Costo total</span>
                              <span className="font-semibold text-foreground">
                                {rollo.costoTotal == null ? "Pendiente" : formatNumber(rollo.costoTotal, { kind: "money" })}
                              </span>
                            </div>
                          </div>
                        )}
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
