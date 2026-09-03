import { useState } from "react";
import { useParams, Link } from "wouter";
import { AppBackLink } from "@/lib/internal-navigation";
import { AppLayout } from "@/components/layout/app-layout";
import { useGetRollo, getGetRolloQueryKey, useListPisosLocation, useUpdateRolloPiso, getListRollosQueryKey, getGetProductoQueryKey, useRevertSalidaExtraordinaria, getListSalidasExtraordinariasQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Box, Calendar, DollarSign, MapPin, Hash, User, Activity, Printer, Layers, RotateCcw } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { QRCodeSVG } from "qrcode.react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { useGetCurrentUser, getGetCurrentUserQueryKey, Role } from "@workspace/api-client-react";
import { formatNumber, formatUnit } from "@workspace/number-format";
import { etiquetasApi } from "@/lib/etiquetas-api";
import { hasPermission, Modules } from "@/lib/permisos";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { useRef } from "react";
import { getApiErrorMessage } from "@/lib/api-error";

export default function RolloDetail() {
  const { id } = useParams();
  const { data: user } = useGetCurrentUser({ query: { queryKey: getGetCurrentUserQueryKey() } });
  const isAdmin = user?.rol === Role.ADMIN;
  const canEdit = hasPermission(user, Modules.INVENTARIO, "editar");
  const canViewLabels = hasPermission(user, Modules.ETIQUETAS, "ver");
  const queryClient = useQueryClient();

  const { data: rollo, isLoading } = useGetRollo(Number(id), {
    query: { enabled: !!id, queryKey: getGetRolloQueryKey(Number(id)) }
  });

  const { data: pisos } = useListPisosLocation(rollo?.ubicacionId ?? 0, {
    query: { enabled: !!rollo?.ubicacionId, queryKey: ['pisosLocation', rollo?.ubicacionId ?? 0] }
  });
  const pisosActivos = pisos?.filter(p => p.activo) || [];

  const updatePiso = useUpdateRolloPiso();

  const [isEditingPiso, setIsEditingPiso] = useState(false);
  const [selectedPiso, setSelectedPiso] = useState<string>("none");

  const handleUpdatePiso = () => {
    updatePiso.mutate({ id: Number(id), data: { pisoId: selectedPiso === "none" ? null : Number(selectedPiso) } }, {
      onSuccess: () => {
        toast.success("Piso actualizado");
        setIsEditingPiso(false);
        queryClient.invalidateQueries({ queryKey: getGetRolloQueryKey(Number(id)) });
        queryClient.invalidateQueries({ queryKey: getListRollosQueryKey() });
        if (rollo?.productoId) {
          queryClient.invalidateQueries({ queryKey: getGetProductoQueryKey(rollo.productoId) });
        }
      },
      onError: (err: any) => {
        toast.error("Error al actualizar piso", { description: err.data?.error || err.message });
      }
    });
  };

  const { data: reimpresiones } = useQuery({
    queryKey: ["etiquetas", "rollo", Number(id), "resumen"],
    queryFn: () => etiquetasApi.resumenRollo(Number(id)),
    enabled: Boolean(id) && canViewLabels,
    retry: false,
  });

  const revertMutation = useRevertSalidaExtraordinaria();
  const [revertingMovimientoId, setRevertingMovimientoId] = useState<number | null>(null);
  const [revertJustificacion, setRevertJustificacion] = useState("");
  const [revertConfirmText, setRevertConfirmText] = useState("");
  const uuidClienteRef = useRef<string>(crypto.randomUUID());

  const handleRevert = (movimientoId: number, justificacion: string) => {
    revertMutation.mutate({
      movimientoId,
      data: {
        justificacion,
        uuidCliente: uuidClienteRef.current,
      }
    }, {
      onSuccess: () => {
        toast.success("Salida extraordinaria reversada exitosamente");
        setRevertingMovimientoId(null);
        setRevertJustificacion("");
        setRevertConfirmText("");
        uuidClienteRef.current = crypto.randomUUID();
        queryClient.invalidateQueries({ queryKey: getGetRolloQueryKey(Number(id)) });
        queryClient.invalidateQueries({ queryKey: getListRollosQueryKey() });
        queryClient.invalidateQueries({ queryKey: getListSalidasExtraordinariasQueryKey() });
      },
      onError: (err: any) => {
        toast.error("Error al reversar", { description: getApiErrorMessage(err) });
      }
    });
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="max-w-5xl mx-auto animate-pulse space-y-6">
          <div className="h-8 bg-muted rounded w-32"></div>
          <div className="h-64 bg-muted rounded-xl"></div>
          <div className="h-96 bg-muted rounded-xl"></div>
        </div>
      </AppLayout>
    );
  }

  if (!rollo) {
    return (
      <AppLayout>
        <div className="max-w-5xl mx-auto p-12 text-center text-muted-foreground flex flex-col items-center">
          <Box className="w-12 h-12 mb-4 opacity-20" />
          <h2 className="text-xl font-bold mb-2">Rollo no encontrado</h2>
          <AppBackLink fallbackHref="/inventario" className="text-primary hover:underline">Volver a inventario</AppBackLink>
        </div>
      </AppLayout>
    );
  }

  const cantidadActual = parseFloat(rollo.cantidadActual);
  const cantidadInicial = parseFloat(rollo.cantidadInicial);
  const isDeducted = cantidadActual < cantidadInicial;

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <AppBackLink fallbackHref="/inventario" className="flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Volver a inventario
          </AppBackLink>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2 border-t-4 border-t-primary">
            <CardHeader className="pb-4">
              <div className="flex flex-col items-start gap-3 sm:flex-row sm:justify-between">
                <div className="min-w-0">
                  <CardTitle className="mb-2 flex flex-wrap items-center gap-2 text-3xl font-bold text-sidebar">
                    {rollo.telaProducto} <span className="text-muted-foreground font-normal">/</span> {rollo.colorProducto}
                  </CardTitle>
                  <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                    <span className="font-mono bg-muted/50 px-2 py-0.5 rounded border">SKU: {rollo.skuProducto}</span>
                    <span className="flex items-center"><MapPin className="w-4 h-4 mr-1" /> {rollo.nombreUbicacion}</span>
                    {((rollo as any).nombrePiso || canEdit) && (
                      <div className="flex items-center gap-2">
                        <Layers className="w-4 h-4 text-muted-foreground" />
                        {isEditingPiso ? (
                          <div className="flex items-center gap-2">
                            <Select value={selectedPiso} onValueChange={setSelectedPiso}>
                              <SelectTrigger className="h-7 w-[140px] text-xs">
                                <SelectValue placeholder="Sin piso" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">Sin piso</SelectItem>
                                {pisosActivos.map(p => (
                                  <SelectItem key={p.id} value={p.id.toString()}>{p.nombre}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Button size="sm" className="h-7 px-2" disabled={updatePiso.isPending} onClick={handleUpdatePiso}>Guardar</Button>
                            <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => setIsEditingPiso(false)}>Cancelar</Button>
                          </div>
                        ) : (
                          <>
                            <span>{(rollo as any).nombrePiso || "Sin piso"}</span>
                            {canEdit && (
                              <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => {
                                setSelectedPiso((rollo as any).pisoId ? (rollo as any).pisoId.toString() : "none");
                                setIsEditingPiso(true);
                              }}>
                                Cambiar
                              </Button>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                <Badge variant="outline" className="shrink-0 text-sm bg-background">
                  {rollo.estado}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-8">
              <div className="grid grid-cols-1 gap-6 border-y py-6 sm:grid-cols-2 md:grid-cols-4">
                <div>
                  <div className="text-sm text-muted-foreground mb-1">Cantidad Actual</div>
                  <div className="text-3xl font-bold tracking-tight text-foreground">
                    {formatNumber(rollo.cantidadActual, { kind: "quantity" })} <span className="text-base font-normal text-muted-foreground">{formatUnit(rollo.unidadProducto)}</span>
                  </div>
                  {isDeducted && (
                    <div className="text-xs text-muted-foreground mt-1">
                      De {formatNumber(rollo.cantidadInicial, { kind: "quantity" })} originales
                    </div>
                  )}
                </div>
                {isAdmin && (
                  <div>
                    <div className="text-sm text-muted-foreground mb-1">Costo Total</div>
                    <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-500">
                      {rollo.costoTotal != null ? formatNumber(rollo.costoTotal, { kind: "money" }) : 'Pendiente'}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {rollo.costoUnitario != null ? `${formatNumber(rollo.costoUnitario, { kind: "money" })} / ${formatUnit(rollo.unidadProducto)}` : 'Pendiente'}
                    </div>
                  </div>
                )}
                <div>
                  <div className="text-sm text-muted-foreground mb-1">Fecha de Ingreso</div>
                  <div className="text-sm font-medium">
                    {format(new Date(rollo.createdAt), "dd MMM yyyy", { locale: es })}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground mb-1">Notas</div>
                  <div className="text-sm font-medium italic">
                    {rollo.notas || "Sin notas"}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card className="flex flex-col items-center bg-white p-6 shadow-sm">
              <div className="bg-white border rounded-xl overflow-hidden p-2 shadow-sm mb-4">
                <QRCodeSVG
                  value={`${rollo.skuProducto}-${rollo.serie}`}
                  size={140}
                  level="Q"
                  includeMargin={true}
                  fgColor="#000000"
                  bgColor="#ffffff"
                />
              </div>
              <div className="font-mono text-xl tracking-widest font-bold text-black mb-4">
                {rollo.serie}
              </div>
              {canViewLabels && <Button asChild className="w-full" variant="outline">
                <Link href={`/inventario/rollos/${rollo.id}/etiqueta`}>
                  <Printer className="w-4 h-4 mr-2" />
                  Reimprimir Etiqueta
                </Link>
              </Button>}
              {reimpresiones && reimpresiones.count > 0 && (
                <div className="mt-4 w-full rounded-md border border-amber-200 bg-amber-50 p-3 text-center text-sm text-amber-900">
                  <p className="font-semibold">Etiqueta reimpresa {reimpresiones.count} {reimpresiones.count === 1 ? "vez" : "veces"}</p>
                  <p className="mt-0.5 text-xs">Última: {reimpresiones.ultimaReimpresion ? format(new Date(reimpresiones.ultimaReimpresion), "dd/MM/yyyy HH:mm") : "—"}</p>
                  {isAdmin && <Link href={`/etiquetas?tab=historial`} className="mt-1 inline-block text-xs font-semibold text-primary hover:underline">Ver historial</Link>}
                </div>
              )}
            </Card>

            <Card className="bg-muted/10 border-dashed">
              <CardContent className="p-6 text-center space-y-2">
                <Box className="w-8 h-8 mx-auto text-muted-foreground opacity-50" />
                <h3 className="font-semibold text-foreground">Estado Operativo</h3>
                <p className="text-sm text-muted-foreground">
                  El rollo está marcado como <strong>{rollo.estado}</strong> y {isDeducted ? "ha tenido salidas parciales" : "está intacto"}.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-primary" />
              Historial de Movimientos
            </CardTitle>
            <CardDescription>
              Trazabilidad completa desde el alta hasta el estado actual.
            </CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto p-0">
            {rollo.historial.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">No hay movimientos registrados.</div>
            ) : (
              <Table className="min-w-[700px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Sitio</TableHead>
                    <TableHead className="text-right">Cantidad</TableHead>
                    <TableHead className="text-right">Saldo Posterior</TableHead>
                    <TableHead>Referencia</TableHead>
                    {isAdmin && <TableHead className="w-[100px]"></TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rollo.historial.map((mov) => {
                    const isPositive = ['ALTA', 'RECEPCION', 'TRANSFERENCIA_ENTRADA', 'AJUSTE_POSITIVO'].includes(mov.tipo);
                    const isNegative = ['VENTA', 'TRANSFERENCIA_SALIDA', 'SALIDA_MOSTRADOR', 'AJUSTE_NEGATIVO', 'CANCELACION'].includes(mov.tipo);

                    const isExtraordinariaUnreversed = mov.tipo === 'AJUSTE_NEGATIVO' &&
                                                       mov.motivoSalidaExtraordinaria != null &&
                                                       !rollo.historial.some(m => m.movimientoOrigenId === mov.id);

                    return (
                      <TableRow key={mov.id}>
                        <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                          {format(new Date(mov.createdAt), "dd/MM/yyyy HH:mm")}
                        </TableCell>
                        <TableCell>
                          <Badge variant={isPositive ? "default" : isNegative ? "destructive" : "secondary"} className="text-[10px]">
                            {mov.tipo.replace('_', ' ')}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">{mov.nombreUbicacion}</TableCell>
                        <TableCell className={`text-right font-medium tabular-nums ${isPositive ? 'text-emerald-600 dark:text-emerald-400' : isNegative ? 'text-red-600 dark:text-red-400' : ''}`}>
                           {isPositive ? '+' : isNegative ? '-' : ''}{formatNumber(Math.abs(Number(mov.cantidad)), { kind: "quantity" })}
                        </TableCell>
                        <TableCell className="text-right font-bold tabular-nums">
                          {formatNumber(mov.saldoPosterior, { kind: "quantity" })}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate" title={mov.justificacion || mov.documentoId || ''}>
                          {mov.documentoTipo && `${mov.documentoTipo} ${mov.documentoId || ''} `}
                          {mov.justificacion}
                        </TableCell>
                        {isAdmin && (
                          <TableCell className="text-right">
                            {isExtraordinariaUnreversed && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                                onClick={() => setRevertingMovimientoId(mov.id)}
                              >
                                <RotateCcw className="w-3 h-3 mr-1" />
                                Reversar
                              </Button>
                            )}
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={revertingMovimientoId !== null} onOpenChange={(open) => {
        if (!open) {
          setRevertingMovimientoId(null);
          setRevertJustificacion("");
          setRevertConfirmText("");
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-destructive">Reversar Salida Extraordinaria</DialogTitle>
            <DialogDescription>
              Esto regresará la cantidad al inventario y registrará un ajuste positivo. Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <Label htmlFor="revert-justificacion">Justificación <span className="text-destructive">*</span></Label>
                <span className={`text-xs ${revertJustificacion.length < 10 ? 'text-destructive font-medium' : 'text-emerald-600 font-medium'}`}>
                  {revertJustificacion.length}/10 min
                </span>
              </div>
              <Textarea
                id="revert-justificacion"
                value={revertJustificacion}
                onChange={(e) => setRevertJustificacion(e.target.value)}
                placeholder="Explica detalladamente la razón de este reverso..."
                className="resize-none"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="revert-confirm">Confirmación</Label>
              <p className="text-sm text-muted-foreground">Escribe exactamente <strong className="font-mono text-foreground">REVERSAR</strong>.</p>
              <Input
                id="revert-confirm"
                value={revertConfirmText}
                onChange={(e) => setRevertConfirmText(e.target.value)}
                autoComplete="off"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setRevertingMovimientoId(null);
              setRevertJustificacion("");
              setRevertConfirmText("");
            }}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={revertJustificacion.length < 10 || revertConfirmText !== "REVERSAR" || revertMutation.isPending}
              onClick={() => {
                if (revertingMovimientoId && revertConfirmText === "REVERSAR" && revertJustificacion.length >= 10) {
                  handleRevert(revertingMovimientoId, revertJustificacion);
                }
              }}
            >
              {revertMutation.isPending ? "Procesando..." : "Reversar Movimiento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
