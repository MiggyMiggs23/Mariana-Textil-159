import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { AppLayout } from "@/components/layout/app-layout";
import {
  useAjustarRollo,
  useListAjustesPendientes,
  useRevisarAjuste,
  useRevertirMovimiento,
  useListRollos,
  useGetCurrentUser,
  Role,
  getListAjustesPendientesQueryKey,
  getListRollosQueryKey,
  MovimientoRow
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useDebounce } from "@/hooks/use-debounce";
import { Search, AlertTriangle, Check, X, FileEdit, Box, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { getApiErrorMessage } from "@/lib/api-error";
import { formatNumber } from "@workspace/number-format";
import { CampoEscaneo } from "@/components/campo-escaneo";
import { ConfirmacionTextoExacto } from "@/components/confirmacion-texto-exacto";
import { requiereConfirmacionAjuste } from "@/lib/ajuste-confirmacion";
import {
  advertenciaSkuEscaneado,
  type CodigoEscaneadoInterpretado,
} from "@workspace/scanned-code";

export default function Ajustes() {
  const queryClient = useQueryClient();
  const { data: user } = useGetCurrentUser();
  const isAdmin = user?.rol === Role.ADMIN;

  const [activeTab, setActiveTab] = useState("nuevo");

  // State for search rollos
  const [searchSerie, setSearchSerie] = useState("");
  const debouncedSearch = useDebounce(searchSerie, 500);
  const [lastScannedCode, setLastScannedCode] =
    useState<CodigoEscaneadoInterpretado | null>(null);
  const [skuWarning, setSkuWarning] = useState<string | null>(null);

  const {
    data: rollosRes,
    isLoading: loadingRollos,
    isError: rollosFailed,
    error: rollosError,
    refetch: retryRollos,
  } = useListRollos({
    serie: debouncedSearch,
    page: 1,
    pageSize: 5
  }, {
    query: {
      enabled: debouncedSearch.length >= 3,
      queryKey: getListRollosQueryKey({ serie: debouncedSearch, page: 1, pageSize: 5 })
    }
  });

  useEffect(() => {
    if (
      loadingRollos ||
      !lastScannedCode?.serie ||
      lastScannedCode.serie !== debouncedSearch ||
      !rollosRes
    ) {
      return;
    }
    const rollo = rollosRes.items.find(
      (item) => item.serie === lastScannedCode.serie,
    );
    setSkuWarning(
      rollo
        ? advertenciaSkuEscaneado(lastScannedCode, rollo.skuProducto)
        : null,
    );
    setLastScannedCode(null);
  }, [debouncedSearch, lastScannedCode, loadingRollos, rollosRes]);

  const handleSearchChange = (value: string) => {
    setSearchSerie(value);
    setLastScannedCode(null);
    setSkuWarning(null);
  };

  const handleScan = (
    value: string,
    codigo: CodigoEscaneadoInterpretado,
  ) => {
    setSearchSerie(value);
    setLastScannedCode(codigo.sku ? codigo : null);
    setSkuWarning(null);
  };

  const [selectedRollo, setSelectedRollo] = useState<any | null>(null);

  // State for Adjustment form
  const [cantidadNueva, setCantidadNueva] = useState("");
  const [justificacion, setJustificacion] = useState("");
  const [isBaja, setIsBaja] = useState(false);
  const [confirmacionAjusteAbierta, setConfirmacionAjusteAbierta] = useState(false);

  const ajustarRollo = useAjustarRollo();
  const revisarAjuste = useRevisarAjuste();
  const revertirMovimiento = useRevertirMovimiento();

  const {
    data: pendientesRes,
    isLoading: loadingPendientes,
    isError: pendientesFailed,
    error: pendientesError,
    refetch: retryPendientes,
  } = useListAjustesPendientes({
    query: {
      enabled: isAdmin,
      queryKey: getListAjustesPendientesQueryKey()
    }
  });

  const handleSelectRollo = (rollo: any) => {
    setSelectedRollo(rollo);
    setSearchSerie("");
    setCantidadNueva(rollo.cantidadActual);
    setIsBaja(false);
  };

  const isFormValid = selectedRollo && justificacion.length >= 10 && (isBaja || (cantidadNueva && parseFloat(cantidadNueva) >= 0));

  const enviarAjuste = () => {
    if (!selectedRollo) return;

    ajustarRollo.mutate({
      id: selectedRollo.id,
      data: {
        cantidadNueva: isBaja ? null : cantidadNueva,
        justificacion
      }
    }, {
      onSuccess: () => {
        toast.success(isBaja ? "Rollo dado de baja correctamente" : "Ajuste aplicado y enviado a revisión");
        setConfirmacionAjusteAbierta(false);
        setSelectedRollo(null);
        setCantidadNueva("");
        setJustificacion("");
        setIsBaja(false);
        queryClient.invalidateQueries({ queryKey: getListRollosQueryKey() });
        queryClient.invalidateQueries({ queryKey: getListAjustesPendientesQueryKey() });
      },
      onError: (err: unknown) => {
        const msg = getApiErrorMessage(err, "Error al aplicar el ajuste");
        toast.error("Error", { description: msg });
      }
    });
  };

  const handleSubmitAjuste = () => {
    if (!isFormValid || !selectedRollo) {
      toast.error("El ajuste está incompleto", {
        description: "Selecciona un rollo, captura una cantidad válida y explica el motivo.",
      });
      return;
    }

    if (requiereConfirmacionAjuste({
      cantidadActual: selectedRollo.cantidadActual,
      cantidadNueva,
      isBaja,
    })) {
      setConfirmacionAjusteAbierta(true);
      return;
    }

    enviarAjuste();
  };

  const handleRevisar = (rolloId: number, movimientoId: number, aprobado: boolean) => {
    if (aprobado) {
      revisarAjuste.mutate({
        id: movimientoId
      }, {
        onSuccess: () => {
          toast.success("Ajuste aprobado");
          queryClient.invalidateQueries({ queryKey: getListAjustesPendientesQueryKey() });
          queryClient.invalidateQueries({ queryKey: getListRollosQueryKey() });
        },
        onError: (err: unknown) => {
          const msg = getApiErrorMessage(err, "Error al procesar la revisión");
          toast.error("Error", { description: msg });
        }
      });
    } else {
      revertirMovimiento.mutate({
        id: rolloId,
        data: { movimientoOrigenId: movimientoId, justificacion: "Rechazado por administrador" }
      }, {
        onSuccess: () => {
          toast.success("Ajuste rechazado y revertido");
          queryClient.invalidateQueries({ queryKey: getListAjustesPendientesQueryKey() });
          queryClient.invalidateQueries({ queryKey: getListRollosQueryKey() });
        },
        onError: (err: unknown) => {
          const msg = getApiErrorMessage(err, "Error al rechazar");
          toast.error("Error", { description: msg });
        }
      });
    }
  };

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-sidebar">Ajustes de Inventario</h1>
          <p className="text-muted-foreground mt-1">Registra mermas, diferencias o da de baja rollos defectuosos.</p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="bg-muted/50 p-1">
            <TabsTrigger value="nuevo" className="h-10 px-6">Nuevo Ajuste</TabsTrigger>
            {isAdmin && (
              <TabsTrigger value="pendientes" className="h-10 px-6 flex items-center gap-2">
                Revisión Pendiente
                {pendientesRes && pendientesRes.length > 0 && (
                  <Badge variant="destructive" className="h-5 px-1.5 ml-1">{pendientesRes.length}</Badge>
                )}
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="nuevo" className="m-0">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Search className="w-5 h-5" /> Buscar Rollo
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {!selectedRollo ? (
                    <div className="space-y-4">
                      <CampoEscaneo
                        placeholder="Escanea o escribe la serie (min 3 chars)..."
                        value={searchSerie}
                        onChange={handleSearchChange}
                        onScan={handleScan}
                        clearOnScan={false}
                        className="text-lg py-6"
                        data-testid="input-search-serie"
                        autoFocus
                      />
                      {skuWarning && (
                        <div
                          className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900"
                          role="alert"
                        >
                          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                          <span>{skuWarning}</span>
                        </div>
                      )}

                      {debouncedSearch.length >= 3 && (
                        <div className="border rounded-md divide-y bg-background">
                          {loadingRollos ? (
                            <div className="p-4 text-center text-muted-foreground">Buscando...</div>
                          ) : rollosFailed ? (
                            <div className="space-y-3 p-4 text-center text-destructive" role="alert">
                              <p>{getApiErrorMessage(rollosError, "No se pudo buscar el rollo.")}</p>
                              <Button type="button" variant="outline" size="sm" onClick={() => retryRollos()}>
                                Intentar de nuevo
                              </Button>
                            </div>
                          ) : rollosRes?.items.length === 0 ? (
                            <div className="p-4 text-center text-muted-foreground">No se encontró ningún rollo con esa serie.</div>
                          ) : (
                            rollosRes?.items.map(rollo => (
                              <div
                                key={rollo.id}
                                className="p-3 flex items-center justify-between hover:bg-muted/30 cursor-pointer transition-colors"
                                onClick={() => handleSelectRollo(rollo)}
                                data-testid={`select-rollo-${rollo.serie}`}
                              >
                                <div>
                                  <div className="font-mono font-bold">{rollo.serie}</div>
                                  <div className="text-xs text-muted-foreground">{rollo.telaProducto} / {rollo.colorProducto}</div>
                                </div>
                                <div className="text-right">
                                  <div className="font-medium">{formatNumber(rollo.cantidadActual, { kind: "quantity" })}</div>
                                  <Badge variant="outline" className="text-[10px]">{rollo.estado}</Badge>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="p-6 bg-sidebar/5 border-sidebar-border border rounded-xl relative overflow-hidden">
                      <div className="absolute right-0 top-0 p-4">
                        <Button variant="ghost" size="sm" onClick={() => setSelectedRollo(null)} className="h-8">Cambiar</Button>
                      </div>
                      <div className="flex items-center gap-3 mb-4">
                        <Box className="w-8 h-8 text-sidebar-primary" />
                        <div>
                          <h3 className="font-mono font-bold text-xl tracking-tight text-sidebar">{selectedRollo.serie}</h3>
                          <p className="text-sm text-muted-foreground">{selectedRollo.telaProducto} / {selectedRollo.colorProducto}</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4 mt-6">
                        <div>
                          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">CANTIDAD ACTUAL</p>
                          <p className="text-2xl font-bold">{formatNumber(selectedRollo.cantidadActual, { kind: "quantity" })}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">ESTADO</p>
                          <Badge variant="outline">{selectedRollo.estado}</Badge>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className={!selectedRollo ? "opacity-50 pointer-events-none grayscale-[0.5]" : ""}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <FileEdit className="w-5 h-5" /> Detalles del Ajuste
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex gap-4">
                    <Button
                      type="button"
                      variant={!isBaja ? "default" : "outline"}
                      className="flex-1"
                      onClick={() => setIsBaja(false)}
                    >
                      Ajuste de Cantidad
                    </Button>
                    <Button
                      type="button"
                      variant={isBaja ? "destructive" : "outline"}
                      className="flex-1"
                      onClick={() => setIsBaja(true)}
                    >
                      Dar de Baja
                    </Button>
                  </div>

                  {!isBaja && (
                    <div className="space-y-2">
                      <Label>Nueva Cantidad Real</Label>
                      <div className="relative">
                        <Input
                          type="number"
                          step="0.01"
                          value={cantidadNueva}
                          onChange={(e) => setCantidadNueva(e.target.value)}
                          className="font-bold text-lg"
                          data-testid="input-cantidad-nueva"
                        />
                        {selectedRollo && cantidadNueva && (
                          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-sm">
                            <span className="text-muted-foreground">Diferencia: </span>
                            <span className={parseFloat(cantidadNueva) < parseFloat(selectedRollo.cantidadActual) ? "text-destructive font-bold" : parseFloat(cantidadNueva) > parseFloat(selectedRollo.cantidadActual) ? "text-emerald-600 font-bold" : "text-muted-foreground"}>
                              {formatNumber(parseFloat(cantidadNueva) - parseFloat(selectedRollo.cantidadActual), { kind: "quantity" })}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      Justificación
                      <span className="text-xs font-normal text-muted-foreground">(Mínimo 10 caracteres)</span>
                    </Label>
                    <Textarea
                      placeholder="Explica el motivo del ajuste o la baja detalladamente..."
                      className="resize-none h-24"
                      value={justificacion}
                      onChange={(e) => setJustificacion(e.target.value)}
                      data-testid="input-justificacion"
                    />
                    <div className="text-right text-xs text-muted-foreground">
                      {justificacion.length}/10 caracteres
                    </div>
                  </div>

                  {isBaja && (
                    <div className="bg-destructive/10 text-destructive text-sm p-4 rounded-md flex items-start gap-3 border border-destructive/20">
                      <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                      <div>
                        <strong>Atención:</strong> Dar de baja un rollo es irreversible. La cantidad pasará a 0 y el rollo cambiará a estado BAJA, enviándose para revisión a la administración.
                      </div>
                    </div>
                  )}
                </CardContent>
                <CardFooter>
                  <Button
                    className="w-full"
                    variant={isBaja ? "destructive" : "default"}
                    disabled={!isFormValid || ajustarRollo.isPending}
                    onClick={handleSubmitAjuste}
                    data-testid="button-submit-ajuste"
                  >
                    {isBaja ? "Dar de Baja Rollo" : "Aplicar Ajuste"}
                  </Button>
                </CardFooter>
              </Card>
            </div>
          </TabsContent>

          {isAdmin && (
            <TabsContent value="pendientes" className="m-0">
              <Card>
                <CardHeader>
                  <CardTitle>Ajustes Pendientes de Revisión</CardTitle>
                  <CardDescription>
                    Aprueba o rechaza los ajustes de inventario realizados por los operadores.
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Fecha</TableHead>
                        <TableHead>Rollo</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead className="text-right">Diferencia</TableHead>
                        <TableHead>Justificación</TableHead>
                        <TableHead className="text-right">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loadingPendientes ? (
                        <TableRow>
                          <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                            Cargando pendientes...
                          </TableCell>
                        </TableRow>
                      ) : pendientesFailed ? (
                        <TableRow>
                          <TableCell colSpan={6} className="h-32 text-center text-destructive" role="alert">
                            <div className="space-y-3">
                              <p>{getApiErrorMessage(pendientesError, "No se pudieron cargar los ajustes pendientes.")}</p>
                              <Button type="button" variant="outline" size="sm" onClick={() => retryPendientes()}>
                                Intentar de nuevo
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : pendientesRes?.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                            No hay ajustes pendientes de revisión.
                          </TableCell>
                        </TableRow>
                      ) : (
                        pendientesRes?.map((mov: MovimientoRow) => (
                          <TableRow key={mov.id}>
                            <TableCell className="text-sm">
                              {format(new Date(mov.createdAt), "dd/MM/yy HH:mm")}
                            </TableCell>
                            <TableCell>
                              <div className="font-mono font-medium">{mov.serie}</div>
                              <div className="text-xs text-muted-foreground truncate w-32" title={mov.skuProducto}>{mov.skuProducto}</div>
                            </TableCell>
                            <TableCell>
                              <Badge variant={mov.tipo === 'AJUSTE_NEGATIVO' ? "destructive" : "secondary"}>
                                {mov.tipo}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <span className={parseFloat(mov.cantidad) < 0 ? "text-destructive font-bold" : "text-emerald-600 font-bold"}>
                                {parseFloat(mov.cantidad) > 0 ? '+' : ''}{formatNumber(Math.abs(parseFloat(mov.cantidad)), { kind: "quantity" })}
                              </span>
                            </TableCell>
                            <TableCell className="max-w-[300px]">
                              <div className="text-sm truncate" title={mov.justificacion || ""}>
                                {mov.justificacion}
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                  onClick={() => handleRevisar(mov.rolloId, mov.id, false)}
                                  disabled={revisarAjuste.isPending || revertirMovimiento.isPending}
                                >
                                  <X className="w-4 h-4 mr-1" /> Rechazar
                                </Button>
                                <Button
                                  variant="default"
                                  size="sm"
                                  className="bg-emerald-600 hover:bg-emerald-700"
                                  onClick={() => handleRevisar(mov.rolloId, mov.id, true)}
                                  disabled={revisarAjuste.isPending || revertirMovimiento.isPending}
                                >
                                  <Check className="w-4 h-4 mr-1" /> Aprobar
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>
          )}
        </Tabs>
      </div>
      <ConfirmacionTextoExacto
        open={confirmacionAjusteAbierta}
        onOpenChange={setConfirmacionAjusteAbierta}
        titulo="Confirmar ajuste de inventario"
        descripcion="Este ajuste modifica más de 10 unidades. Para continuar, confirma la operación."
        textoRequerido="AJUSTE"
        etiqueta="Escribe AJUSTE para aplicar el cambio"
        textoConfirmar="Aplicar ajuste"
        pendiente={ajustarRollo.isPending}
        onConfirm={enviarAjuste}
      />
    </AppLayout>
  );
}
