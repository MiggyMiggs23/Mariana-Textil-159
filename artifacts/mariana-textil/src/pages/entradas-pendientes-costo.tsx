import React, { useState, useMemo } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import {
  useListEntradasPendientesCosto,
  getListEntradasPendientesCostoQueryKey,
  useGetEntrada,
  getGetEntradaQueryKey,
  useCapturarCostosEntrada,
  useCountEntradasPendientesCosto,
  getCountEntradasPendientesCostoQueryKey,
  useGetCurrentUser,
  getGetCurrentUserQueryKey,
  Role,
  EntradaDetail,
  EntradaPendienteCosto
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { getApiErrorMessage } from "@/lib/api-error";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, AlertTriangle, Save, DollarSign, ChevronRight, ChevronDown } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Link, useLocation } from "wouter";
import { formatNumber } from "@workspace/number-format";

function CaptureCostDialog({
  entradaId,
  onClose
}: {
  entradaId: number | null,
  onClose: () => void
}) {
  const queryClient = useQueryClient();
  const { data: entrada, isLoading } = useGetEntrada(entradaId!, {
    query: { enabled: entradaId !== null, queryKey: getGetEntradaQueryKey(entradaId!) }
  });
  const captureMutation = useCapturarCostosEntrada();

  const [costosProductos, setCostosProductos] = useState<Record<number, string>>({});
  const [costosRollos, setCostosRollos] = useState<Record<number, string>>({});
  const [expandedProducts, setExpandedProducts] = useState<Set<number>>(new Set());

  // Initialize state when entrada loads
  React.useEffect(() => {
    if (entrada) {
      setCostosProductos({});
      setCostosRollos({});
      setExpandedProducts(new Set());
    }
  }, [entrada]);

  const toggleExpand = (productoId: number) => {
    setExpandedProducts(prev => {
      const next = new Set(prev);
      if (next.has(productoId)) next.delete(productoId);
      else next.add(productoId);
      return next;
    });
  };

  const totals = useMemo(() => {
    if (!entrada) return { cost: 0 };
    let total = 0;
    entrada.rollos.forEach(rollo => {
      if (rollo.costoUnitario != null && rollo.costoTotal != null) {
        total += parseFloat(rollo.costoTotal);
      } else {
        const unitCost = parseFloat(costosRollos[rollo.id] || costosProductos[rollo.productoId] || "0");
        if (!isNaN(unitCost) && unitCost > 0) {
          total += unitCost * parseFloat(rollo.cantidadInicial);
        }
      }
    });
    return { cost: total };
  }, [entrada, costosProductos, costosRollos]);

  const handleSave = () => {
    if (!entrada) return;

    // Validation: for every pending roll, accept either a positive explicit roll override OR a positive product default.
    const missing = entrada.rollos.some(r => {
      if (r.costoUnitario !== null) return false; // already costed
      const hasOverride = parseFloat(costosRollos[r.id] || "0") > 0;
      const hasDefault = parseFloat(costosProductos[r.productoId] || "0") > 0;
      return !hasOverride && !hasDefault;
    });

    if (missing) {
      toast.error("Cada rollo pendiente necesita un costo de producto o un costo individual.");
      return;
    }

    const pendingProductIds = new Set(
      entrada.rollos.filter(r => r.costoUnitario === null).map(r => r.productoId)
    );

    const validProductCosts = Object.entries(costosProductos)
      .filter(([id, cost]) => parseFloat(cost || "0") > 0 && pendingProductIds.has(Number(id)))
      .map(([id, cost]) => ({ productoId: Number(id), costoUnitario: cost }));

    const pendingRollIds = new Set(
      entrada.rollos.filter(r => r.costoUnitario === null).map(r => r.id)
    );

    const overrides = Object.entries(costosRollos).filter(([id, cost]) => cost && parseFloat(cost) > 0 && pendingRollIds.has(Number(id)));

    captureMutation.mutate({
      id: entradaId!,
      data: {
        costosProductos: validProductCosts,
        costosRollos: overrides.length > 0 ? overrides.map(([id, cost]) => ({ rolloId: Number(id), costoUnitario: cost })) : undefined
      }
    }, {
      onSuccess: () => {
        toast.success("Costos capturados correctamente");
        queryClient.invalidateQueries({ queryKey: getListEntradasPendientesCostoQueryKey() });
        queryClient.invalidateQueries({ queryKey: getCountEntradasPendientesCostoQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetEntradaQueryKey(entradaId!) });
        onClose();
      },
      onError: (err: unknown) => {
        const msg = getApiErrorMessage(err, "Error al capturar los costos");
        toast.error("Error", { description: msg });
      }
    });
  };

  if (!entradaId) return null;

  return (
    <Dialog open={entradaId !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-primary" />
            Captura de Costos - Folio #{entrada?.folio.toString().padStart(6, '0') ?? "..."}
          </DialogTitle>
          <DialogDescription>
            {entrada && `Proveedor: ${entrada.nombreProveedor || "Sin proveedor"} · ${format(new Date(entrada.fecha), "dd MMM yyyy", { locale: es })}`}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
          {isLoading ? (
            <div className="py-12 flex justify-center text-muted-foreground animate-pulse">Cargando detalles...</div>
          ) : entrada ? (
            <div className="space-y-4">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-muted/50 sticky top-0 z-10">
                    <TableRow>
                      <TableHead className="w-8"></TableHead>
                      <TableHead>Producto</TableHead>
                      <TableHead className="text-right">Cantidad Total</TableHead>
                      <TableHead className="w-48 text-right">Costo Unitario ($)</TableHead>
                      <TableHead className="text-right">Total ($)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {entrada.lineas.map(linea => {
                      const isExpanded = expandedProducts.has(linea.productoId);
                      const pendingRolls = entrada.rollos.filter(r => r.productoId === linea.productoId && r.costoUnitario === null);
                      const hasPending = pendingRolls.length > 0;
                      const hasOverrides = entrada.rollos.filter(r => r.productoId === linea.productoId && costosRollos[r.id]).length > 0;

                      let lineTotal = 0;
                      entrada.rollos.filter(r => r.productoId === linea.productoId).forEach(r => {
                        if (r.costoUnitario != null && r.costoTotal != null) {
                           lineTotal += parseFloat(r.costoTotal);
                        } else {
                           const unit = parseFloat(costosRollos[r.id] || costosProductos[linea.productoId] || "0");
                           if (!isNaN(unit) && unit > 0) lineTotal += unit * parseFloat(r.cantidadInicial);
                        }
                      });

                      return (
                        <React.Fragment key={linea.productoId}>
                          <TableRow className="bg-secondary/10">
                            <TableCell>
                              <Button variant="ghost" size="icon" className="w-6 h-6 p-0" onClick={() => toggleExpand(linea.productoId)}>
                                {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                              </Button>
                            </TableCell>
                            <TableCell className="font-bold">
                              <div>{linea.telaProducto} / {linea.colorProducto}</div>
                              <div className="text-xs text-muted-foreground font-mono">{linea.skuProducto}</div>
                              {hasOverrides && <Badge variant="outline" className="mt-1 text-[10px] bg-amber-50 text-amber-700 border-amber-200">Sobrescrito parcialmente</Badge>}
                            </TableCell>
                            <TableCell className="text-right">
                               {formatNumber(linea.cantidadTotal, { kind: "quantity" })} <span className="text-xs text-muted-foreground">{linea.unidadProducto}</span>
                            </TableCell>
                            <TableCell>
                              {hasPending ? (
                                <Input
                                  type="number"
                                  min="0.01"
                                  step="0.01"
                                  placeholder="0.00"
                                  className="text-right h-8"
                                  value={costosProductos[linea.productoId] || ""}
                                  onChange={e => setCostosProductos(prev => ({...prev, [linea.productoId]: e.target.value}))}
                                  data-testid={`input-cost-product-${linea.productoId}`}
                                />
                              ) : (
                                <div className="text-right text-muted-foreground italic text-sm mt-1">Ya costeado</div>
                              )}
                            </TableCell>
                            <TableCell className="text-right font-bold text-emerald-600">
                               {formatNumber(lineTotal, { kind: "money" })}
                            </TableCell>
                          </TableRow>
                          {isExpanded && entrada.rollos.filter(r => r.productoId === linea.productoId).map(rollo => {
                            const isPending = rollo.costoUnitario === null;
                            const isOverridden = !!costosRollos[rollo.id];
                            const effectiveCost = isPending
                              ? parseFloat(costosRollos[rollo.id] || costosProductos[linea.productoId] || "0")
                              : parseFloat(rollo.costoUnitario!);

                            const rowTotal = isPending
                              ? ((!isNaN(effectiveCost) && effectiveCost > 0) ? (effectiveCost * parseFloat(rollo.cantidadInicial)) : 0)
                              : parseFloat(rollo.costoTotal!);

                            return (
                              <TableRow key={rollo.id} className="bg-background">
                                <TableCell></TableCell>
                                <TableCell className="pl-8">
                                  <div className="flex items-center gap-2">
                                    <div className="w-1 h-1 rounded-full bg-primary/40"></div>
                                    <span className="font-mono text-sm">{rollo.serie}</span>
                                  </div>
                                </TableCell>
                                <TableCell className="text-right text-muted-foreground">
                                   {formatNumber(rollo.cantidadInicial, { kind: "quantity" })} <span className="text-[10px]">{linea.unidadProducto}</span>
                                </TableCell>
                                <TableCell>
                                  {isPending ? (
                                    <div className="flex items-center gap-2 justify-end">
                                      <Input
                                        type="number"
                                        min="0.01"
                                        step="0.01"
                                        placeholder={costosProductos[linea.productoId] || "0.00"}
                                        className={`text-right h-7 text-sm w-24 ${isOverridden ? 'border-amber-400 bg-amber-50' : 'opacity-70'}`}
                                        value={costosRollos[rollo.id] || ""}
                                        onChange={e => setCostosRollos(prev => ({...prev, [rollo.id]: e.target.value}))}
                                        data-testid={`input-cost-roll-${rollo.id}`}
                                      />
                                      {isOverridden && (
                                        <Button variant="ghost" size="icon" className="w-6 h-6 h-7 w-7 text-muted-foreground" onClick={() => {
                                          const next = {...costosRollos};
                                          delete next[rollo.id];
                                          setCostosRollos(next);
                                        }} title="Restaurar a costo de producto">
                                          <ArrowLeft className="w-3 h-3" />
                                        </Button>
                                      )}
                                    </div>
                                  ) : (
                                    <div className="text-right text-sm text-muted-foreground">
                                       {formatNumber(rollo.costoUnitario, { kind: "money" })}
                                    </div>
                                  )}
                                </TableCell>
                                <TableCell className="text-right text-emerald-600 opacity-80 text-sm">
                                   {formatNumber(rowTotal, { kind: "money" })}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </React.Fragment>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>
          ) : (
            <div className="py-12 flex justify-center text-destructive">Error al cargar la entrada</div>
          )}
        </div>

        <DialogFooter className="bg-muted/30 -mx-6 -mb-6 p-4 border-t flex sm:justify-between items-center mt-4">
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium text-muted-foreground">Gran Total:</span>
             <span className="text-2xl font-bold text-emerald-700" data-testid="text-grand-total">{formatNumber(totals.cost, { kind: "money" })}</span>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} disabled={captureMutation.isPending}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={captureMutation.isPending || isLoading} data-testid="btn-save-costs">
              <Save className="w-4 h-4 mr-2" />
              Guardar Costos
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function EntradasPendientesCosto() {
  const [, setLocation] = useLocation();
  const { data: user, isLoading: userLoading } = useGetCurrentUser({ query: { queryKey: getGetCurrentUserQueryKey() } });

  const [selectedEntradaId, setSelectedEntradaId] = useState<number | null>(null);

  const { data: pendientesRes, isLoading: listLoading } = useListEntradasPendientesCosto({ page: 1, pageSize: 100 }, {
    query: {
      enabled: user?.rol === Role.ADMIN,
      queryKey: getListEntradasPendientesCostoQueryKey({ page: 1, pageSize: 100 })
    }
  });

  // Protect route
  if (!userLoading && user?.rol !== Role.ADMIN) {
    return (
      <AppLayout>
        <div className="max-w-3xl mx-auto py-12 text-center">
          <AlertTriangle className="w-12 h-12 text-destructive mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">Acceso Denegado</h2>
          <p className="text-muted-foreground mb-6">Solo los administradores pueden capturar costos pendientes.</p>
          <Button asChild>
            <Link href="/entradas">Volver a Entradas</Link>
          </Button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-sidebar">Costos Pendientes</h1>
            <p className="text-muted-foreground mt-1">
              Entradas registradas que requieren captura de costo para valorizar el inventario.
            </p>
          </div>
          <Button variant="outline" asChild>
            <Link href="/entradas">
              <ArrowLeft className="w-4 h-4 mr-2" /> Volver
            </Link>
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Entradas sin costeo</CardTitle>
            <CardDescription>
              Se muestran ordenadas desde la más antigua. Las entradas con más de 48 horas sin costo aparecen marcadas.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Folio</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Sitio</TableHead>
                    <TableHead>Proveedor</TableHead>
                    <TableHead className="text-right">Rollos</TableHead>
                    <TableHead className="text-right">Metros</TableHead>
                    <TableHead className="text-right">Kilos</TableHead>
                    <TableHead>Registrado por</TableHead>
                    <TableHead className="text-center">Acción</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {listLoading ? (
                    <TableRow>
                      <TableCell colSpan={9} className="h-32 text-center text-muted-foreground">
                        Cargando pendientes...
                      </TableCell>
                    </TableRow>
                  ) : !pendientesRes || pendientesRes.items.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="h-48 text-center">
                        <div className="flex flex-col items-center justify-center text-muted-foreground">
                          <DollarSign className="w-12 h-12 opacity-20 mb-2" />
                          <p>No hay entradas pendientes de costo.</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    pendientesRes.items.map((item) => (
                      <TableRow key={item.id} className={item.overdue48h ? "bg-red-50/50 dark:bg-red-950/10" : ""} data-testid={`row-pendiente-${item.id}`}>
                        <TableCell className="font-bold flex items-center gap-2">
                          {item.overdue48h && (
                            <span title="Más de 48 hrs pendiente">
                              <AlertTriangle className="w-4 h-4 text-destructive" data-testid={`icon-overdue-${item.id}`} />
                            </span>
                          )}
                          #{item.folio.toString().padStart(6, '0')}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {format(new Date(item.fecha), "dd/MM/yyyy")}
                        </TableCell>
                        <TableCell>{item.nombreUbicacion}</TableCell>
                        <TableCell>{item.nombreProveedor || <span className="text-muted-foreground italic">Sin proveedor</span>}</TableCell>
                         <TableCell className="text-right font-medium">{formatNumber(item.rollosPendientes, { kind: "count" })}</TableCell>
                         <TableCell className="text-right tabular-nums">{parseFloat(item.totalMetros) > 0 ? formatNumber(item.totalMetros, { kind: "quantity" }) : "-"}</TableCell>
                         <TableCell className="text-right tabular-nums">{parseFloat(item.totalKilos) > 0 ? formatNumber(item.totalKilos, { kind: "quantity" }) : "-"}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{item.nombreUsuario}</TableCell>
                        <TableCell className="text-center">
                          <Button size="sm" onClick={() => setSelectedEntradaId(item.id)} data-testid={`btn-capture-${item.id}`}>
                            Capturar
                          </Button>
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

      <CaptureCostDialog
        entradaId={selectedEntradaId}
        onClose={() => setSelectedEntradaId(null)}
      />
    </AppLayout>
  );
}
