import { useState, useMemo } from "react";
import { useRoute, Link } from "wouter";
import { AppLayout } from "@/components/layout/app-layout";
import { 
  useGetSalida,
  useAceptarSalida,
  useRechazarSalida,
  useCancelarSalida,
  useCerrarSalida,
  useEnviarSalida,
  getGetSalidaQueryKey,
  useGetCurrentUser,
  getGetCurrentUserQueryKey,
  Role,
  getListSalidasQueryKey,
  getGetSalidasPendientesCountQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  ArrowLeft,
  ArrowRight,
  Clock,
  Printer,
  CheckCircle2,
  XCircle,
  XSquare,
  Package,
  Truck,
  Download,
  AlertCircle,
  Loader2,
  Lock
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/api-error";
import { hasPermission, Modules } from "@/lib/permisos";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

import { SalidaPrepareDialog } from "@/components/salidas/salida-prepare-dialog";
import { SalidaReceiveDialog } from "@/components/salidas/salida-receive-dialog";

function EstadoBadge({ estado }: { estado: string }) {
  const map: Record<string, { label: string; class: string }> = {
    SOLICITADA: { label: "Solicitada", class: "bg-blue-100 text-blue-800 border-blue-200" },
    ACEPTADA: { label: "Aceptada", class: "bg-indigo-100 text-indigo-800 border-indigo-200" },
    PREPARADA: { label: "Preparada", class: "bg-purple-100 text-purple-800 border-purple-200" },
    ENVIADA: { label: "Enviada", class: "bg-amber-100 text-amber-800 border-amber-200" },
    RECIBIDA: { label: "Recibida", class: "bg-cyan-100 text-cyan-800 border-cyan-200" },
    CERRADA: { label: "Cerrada", class: "bg-green-100 text-green-800 border-green-200" },
    CANCELADA: { label: "Cancelada", class: "bg-red-100 text-red-800 border-red-200" },
  };
  const config = map[estado] || { label: estado, class: "bg-slate-100 text-slate-800 border-slate-200" };
  return (
    <Badge variant="outline" className={`font-medium ${config.class}`}>
      {config.label}
    </Badge>
  );
}

export default function SalidaDetail() {
  const [, params] = useRoute("/salidas/:id");
  const id = Number(params?.id);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: user } = useGetCurrentUser({ query: { queryKey: getGetCurrentUserQueryKey() } });
  const { data: salida, isLoading, error } = useGetSalida(id, {
    query: {
      enabled: !isNaN(id),
      queryKey: getGetSalidaQueryKey(id)
    }
  });

  const acceptMutation = useAceptarSalida();
  const rejectMutation = useRechazarSalida();
  const cancelMutation = useCancelarSalida();
  const closeMutation = useCerrarSalida();
  const sendMutation = useEnviarSalida();

  const [dialogState, setDialogState] = useState<{
    type: 'reject' | 'cancel' | 'send' | 'prepare' | 'receive' | null;
  }>({ type: null });

  const [motivo, setMotivo] = useState("");
  const [transportista, setTransportista] = useState("");
  const [notaEnvio, setNotaEnvio] = useState("");

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center min-h-[50vh] text-slate-400">
          <Loader2 className="w-8 h-8 animate-spin mb-4" />
          <p>Cargando detalle...</p>
        </div>
      </AppLayout>
    );
  }

  if (error || !salida) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center min-h-[50vh] text-red-500">
          <AlertCircle className="w-12 h-12 mb-4" />
          <p className="font-medium">Error al cargar la salida</p>
          <p className="text-sm mt-1">{getApiErrorMessage(error)}</p>
          <Link href="/salidas" className="mt-4 text-blue-600 hover:underline">Volver a Salidas</Link>
        </div>
      </AppLayout>
    );
  }

  const isAdmin = user?.rol === Role.ADMIN;
  const canEdit = hasPermission(user, Modules.SALIDAS, 'editar');
  const canAuthorize = hasPermission(user, Modules.SALIDAS, 'autorizar');

  const atOrigin = isAdmin || user?.ubicacion?.id === salida.origenId;
  const atDestination = isAdmin || user?.ubicacion?.id === salida.destinoId;

  const hasPendingRolls = salida.rollos.some(r => r.recibido !== true);
  
  const canAccept = salida.estado === 'SOLICITADA' && (isAdmin || (canEdit && atOrigin));
  const canReject = salida.estado === 'SOLICITADA' && (isAdmin || (canEdit && atOrigin));
  const canCancel = ['SOLICITADA', 'ACEPTADA', 'PREPARADA'].includes(salida.estado) && (isAdmin || (canAuthorize && (atOrigin || atDestination)));
  const canPrepare = salida.estado === 'ACEPTADA' && (isAdmin || (canEdit && atOrigin));
  const canSend = salida.estado === 'PREPARADA' && (isAdmin || (canEdit && atOrigin));
  const canReceive = (salida.estado === 'ENVIADA' || (salida.estado === 'RECIBIDA' && hasPendingRolls)) && (isAdmin || (canEdit && atDestination));
  const canClose = salida.estado === 'RECIBIDA' && !hasPendingRolls && (isAdmin || (canAuthorize && atDestination));

  const canPrintSalida = ['ENVIADA', 'RECIBIDA', 'CERRADA'].includes(salida.estado);
  const canPrintRecepcion = ['RECIBIDA', 'CERRADA'].includes(salida.estado);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getGetSalidaQueryKey(id) });
    queryClient.invalidateQueries({ queryKey: getListSalidasQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetSalidasPendientesCountQueryKey() });
  };

  const onAccept = () => {
    acceptMutation.mutate({ id }, {
      onSuccess: () => {
        toast({ title: "Salida aceptada" });
        invalidate();
      },
      onError: (err) => toast({ title: "Error", description: getApiErrorMessage(err), variant: "destructive" })
    });
  };

  const onReject = () => {
    if (motivo.trim().length < 10) {
      toast({ title: "Atención", description: "El motivo debe tener al menos 10 caracteres", variant: "destructive" });
      return;
    }
    rejectMutation.mutate({ id, data: { motivo } }, {
      onSuccess: () => {
        toast({ title: "Salida rechazada" });
        setDialogState({ type: null });
        invalidate();
      },
      onError: (err) => toast({ title: "Error", description: getApiErrorMessage(err), variant: "destructive" })
    });
  };

  const onCancel = () => {
    if (motivo.trim().length < 10) {
      toast({ title: "Atención", description: "El motivo debe tener al menos 10 caracteres", variant: "destructive" });
      return;
    }
    cancelMutation.mutate({ id, data: { motivo } }, {
      onSuccess: () => {
        toast({ title: "Salida cancelada" });
        setDialogState({ type: null });
        invalidate();
      },
      onError: (err) => toast({ title: "Error", description: getApiErrorMessage(err), variant: "destructive" })
    });
  };

  const onSend = () => {
    if (!transportista.trim()) {
      toast({ title: "Atención", description: "El transportista es requerido", variant: "destructive" });
      return;
    }
    sendMutation.mutate({ id, data: { transportista, notaEnvio: notaEnvio || null } }, {
      onSuccess: () => {
        toast({ title: "Salida enviada" });
        setDialogState({ type: null });
        invalidate();
      },
      onError: (err) => toast({ title: "Error", description: getApiErrorMessage(err), variant: "destructive" })
    });
  };

  const onClose = () => {
    closeMutation.mutate({ id }, {
      onSuccess: () => {
        toast({ title: "Salida cerrada" });
        invalidate();
      },
      onError: (err) => toast({ title: "Error", description: getApiErrorMessage(err), variant: "destructive" })
    });
  };

  const showPrepare = dialogState.type === 'prepare';
  const showReceive = dialogState.type === 'receive';

  return (
    <AppLayout>
    <div className="space-y-6 max-w-5xl mx-auto pb-12 animate-in fade-in duration-300">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <div className="flex min-w-0 items-start gap-3">
          <Link href="/salidas">
            <Button variant="ghost" size="icon" data-testid="btn-back" aria-label="Volver" className="shrink-0 text-slate-500 hover:text-slate-900">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 data-testid="salida-folio" className="text-3xl font-bold text-slate-900 tracking-tight">
              Folio {String(salida.folio).padStart(5, '0')}
            </h1>
            <span data-testid={`status-${salida.estado.toLowerCase()}`}><EstadoBadge estado={salida.estado} /></span>
            {salida.diferenciasPendientes && (
              <Badge data-testid="badge-diferencias" variant="destructive" className="ml-2">Con Diferencias</Badge>
            )}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-500">
            <span className="flex items-center gap-1">
              <Clock className="w-4 h-4" />
              {format(new Date(salida.createdAt), "dd MMM yyyy, HH:mm", { locale: es })}
            </span>
            <span>•</span>
            <span>Solicitado por: <span className="font-medium text-slate-700">{salida.nombreSolicitadoPor}</span></span>
          </div>
        </div>
        </div>
        
        <div className="flex w-full flex-wrap items-center gap-2 sm:ml-auto sm:w-auto sm:justify-end">
          {canPrintSalida && (
            <Link href={`/salidas/${salida.id}/documento/salida`}>
              <Button data-testid="btn-print-salida" variant="outline" className="gap-2 bg-white">
                <Printer className="w-4 h-4" /> Doc. Salida
              </Button>
            </Link>
          )}
          {canPrintRecepcion && (
            <Link href={`/salidas/${salida.id}/documento/recepcion`}>
              <Button data-testid="btn-print-recepcion" variant="outline" className="gap-2 bg-white">
                <Printer className="w-4 h-4" /> Doc. Recepción
              </Button>
            </Link>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          <Card className="shadow-sm border-slate-200">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg flex items-center gap-2">
                <Package className="w-5 h-5 text-primary" />
                Líneas de Producto
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-y border-slate-100 text-slate-500">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium">SKU / Producto</th>
                      <th className="px-4 py-3 text-right font-medium">Solicitada</th>
                      <th className="px-4 py-3 text-right font-medium">Enviada</th>
                      <th className="px-4 py-3 text-right font-medium">Recibida</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {salida.lineas.map(linea => (
                      <tr key={linea.id} className="hover:bg-slate-50/50">
                        <td className="px-4 py-3">
                          <p className="font-semibold text-slate-900">{linea.skuProducto}</p>
                          <p className="text-xs text-slate-500 mt-0.5">{linea.telaProducto} • {linea.colorProducto}</p>
                          {linea.nota && <p className="text-xs text-amber-600 mt-1 italic">Nota: {linea.nota}</p>}
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-slate-700">
                          {linea.cantidadSolicitada}
                          {linea.rollosSolicitados && <span className="text-xs text-slate-400 block font-normal">({linea.rollosSolicitados} rollos)</span>}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className={Number(linea.cantidadEnviada) > 0 ? "font-medium text-amber-700" : "text-slate-400"}>
                            {linea.cantidadEnviada}
                          </span>
                          {linea.rollosEnviados > 0 && <span className="text-xs text-amber-600 block font-normal">({linea.rollosEnviados} rollos)</span>}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className={Number(linea.cantidadRecibida) > 0 ? "font-medium text-green-700" : "text-slate-400"}>
                            {linea.cantidadRecibida}
                          </span>
                          {linea.rollosRecibidos > 0 && <span className="text-xs text-green-600 block font-normal">({linea.rollosRecibidos} rollos)</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {salida.rollos.length > 0 && (
            <Card className="shadow-sm border-slate-200">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg">Rollos enviados</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto custom-scrollbar">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 border-y border-slate-100 text-slate-500">
                      <tr>
                        <th className="px-4 py-3 text-left font-medium">Serie</th>
                        <th className="px-4 py-3 text-right font-medium">Cant. Enviada</th>
                        <th className="px-4 py-3 text-right font-medium">Cant. Recibida</th>
                        <th className="px-4 py-3 text-center font-medium">Diferencia</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {salida.rollos.map(rollo => (
                        <tr key={rollo.id} className="hover:bg-slate-50/50">
                          <td className="px-4 py-3 font-mono font-medium text-slate-900">{rollo.serie}</td>
                          <td className="px-4 py-3 text-right text-slate-700">{rollo.cantidadEnviada}</td>
                          <td className="px-4 py-3 text-right text-slate-700">
                            {rollo.recibido === false ? <span className="text-red-500 font-medium">No recibido</span> : rollo.cantidadRecibida || "-"}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {Number(rollo.diferencia) > 0 ? (
                              <Badge variant="destructive">
                                {rollo.diferencia} {rollo.notaDiferencia ? `(${rollo.notaDiferencia})` : ""}
                              </Badge>
                            ) : rollo.recibido === false ? (
                              <Badge variant="destructive">{rollo.notaDiferencia}</Badge>
                            ) : (
                              <span className="text-slate-300">-</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card className="shadow-sm border-slate-200 bg-slate-50/50">
            <CardContent className="p-5 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
                  OR
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-500 tracking-wider">ORIGEN</p>
                  <p className="font-bold text-slate-900">{salida.nombreOrigen}</p>
                </div>
              </div>
              <div className="pl-5 border-l-2 border-slate-200 h-4 my-1 mx-2.5"></div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
                  DE
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-500 tracking-wider">DESTINO</p>
                  <p className="font-bold text-slate-900">{salida.nombreDestino}</p>
                </div>
              </div>

              {salida.notaSolicitud && (
                <div className="mt-4 p-3 bg-white rounded-md border border-slate-100 text-sm">
                  <span className="font-semibold block mb-1">Nota Solicitud:</span>
                  <span className="text-slate-600">{salida.notaSolicitud}</span>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-sm border-slate-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Acciones</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pb-5">
              {salida.estado === 'RECIBIDA' && hasPendingRolls && (
                <div className="text-sm p-3 mb-2 bg-amber-50 text-amber-800 rounded-md border border-amber-200">
                  <AlertCircle className="w-4 h-4 inline mr-1 -mt-0.5" />
                  Quedan rollos pendientes por recibir. No se puede cerrar hasta confirmar todos.
                </div>
              )}
              {canAccept && (
                <Button data-testid="btn-action-accept" onClick={onAccept} disabled={acceptMutation.isPending} className="w-full justify-start bg-indigo-600 hover:bg-indigo-700 text-white">
                  <CheckCircle2 className="w-4 h-4 mr-2" /> Aceptar Solicitud
                </Button>
              )}
              {canReject && (
                <Button data-testid="btn-action-reject" onClick={() => { setMotivo(""); setDialogState({ type: 'reject' }); }} variant="outline" className="w-full justify-start text-red-600 border-red-200 hover:bg-red-50">
                  <XCircle className="w-4 h-4 mr-2" /> Rechazar Solicitud
                </Button>
              )}
              {canPrepare && (
                <Button data-testid="btn-action-prepare" onClick={() => setDialogState({ type: 'prepare' })} className="w-full justify-start bg-purple-600 hover:bg-purple-700 text-white">
                  <Package className="w-4 h-4 mr-2" /> Preparar Mercancía
                </Button>
              )}
              {canSend && (
                <Button data-testid="btn-action-send" onClick={() => { setTransportista(""); setNotaEnvio(""); setDialogState({ type: 'send' }); }} className="w-full justify-start bg-amber-600 hover:bg-amber-700 text-white">
                  <Truck className="w-4 h-4 mr-2" /> Enviar
                </Button>
              )}
              {canReceive && (
                <Button data-testid="btn-action-receive" onClick={() => setDialogState({ type: 'receive' })} className="w-full justify-start bg-cyan-600 hover:bg-cyan-700 text-white">
                  <Download className="w-4 h-4 mr-2" /> Recibir
                </Button>
              )}
              {canClose && (
                <Button data-testid="btn-action-close" onClick={onClose} disabled={closeMutation.isPending} className="w-full justify-start bg-green-600 hover:bg-green-700 text-white">
                  <CheckCircle2 className="w-4 h-4 mr-2" /> Cerrar Salida
                </Button>
              )}
              {canCancel && (
                <Button data-testid="btn-action-cancel" onClick={() => { setMotivo(""); setDialogState({ type: 'cancel' }); }} variant="outline" className="w-full justify-start text-red-600 border-red-200 hover:bg-red-50">
                  <XSquare className="w-4 h-4 mr-2" /> Cancelar Movimiento
                </Button>
              )}
              
              {!canAccept && !canReject && !canPrepare && !canSend && !canReceive && !canClose && !canCancel && (
                <p className="text-sm text-slate-500 italic text-center py-2">
                  <Lock className="w-4 h-4 mx-auto mb-1 opacity-50" />
                  No hay acciones disponibles para tu rol o el estado actual de la salida.
                </p>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-sm border-slate-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Línea de Tiempo</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative pl-4 space-y-4 border-l-2 border-slate-100 ml-2">
                <TimelineItem 
                  label="Solicitada" 
                  date={salida.fechaSolicitud} 
                  user={salida.nombreSolicitadoPor} 
                  active={true}
                  color="blue"
                />
                
                {(salida.fechaAceptacion || salida.estado === 'ACEPTADA' || salida.fechaPreparacion) && (
                  <TimelineItem 
                    label="Aceptada" 
                    date={salida.fechaAceptacion} 
                    user={salida.nombreAceptadoPor} 
                    active={!!salida.fechaAceptacion}
                    color="indigo"
                  />
                )}

                {(salida.fechaRechazo) && (
                  <TimelineItem 
                    label="Rechazada" 
                    date={salida.fechaRechazo} 
                    user={salida.nombreRechazadoPor} 
                    note={salida.motivoRechazo}
                    active={true}
                    color="red"
                  />
                )}

                {(salida.fechaPreparacion || salida.estado === 'PREPARADA' || salida.fechaEnvio) && (
                  <TimelineItem 
                    label="Preparada" 
                    date={salida.fechaPreparacion} 
                    user={salida.nombrePreparadoPor} 
                    active={!!salida.fechaPreparacion}
                    color="purple"
                  />
                )}

                {(salida.fechaEnvio || salida.estado === 'ENVIADA' || salida.fechaRecepcion) && (
                  <TimelineItem 
                    label="Enviada" 
                    date={salida.fechaEnvio} 
                    user={salida.nombreEnviadoPor} 
                    note={salida.transportista ? `Transporte: ${salida.transportista}` : undefined}
                    active={!!salida.fechaEnvio}
                    color="amber"
                  />
                )}

                {(salida.fechaRecepcion || salida.estado === 'RECIBIDA' || salida.fechaCierre) && (
                  <TimelineItem 
                    label="Recibida" 
                    date={salida.fechaRecepcion} 
                    user={salida.nombreRecibidoPor} 
                    note={salida.notaRecepcion}
                    active={!!salida.fechaRecepcion}
                    color="cyan"
                  />
                )}

                {(salida.fechaCierre || salida.estado === 'CERRADA') && (
                  <TimelineItem 
                    label="Cerrada" 
                    date={salida.fechaCierre} 
                    user={salida.nombreCerradoPor} 
                    active={!!salida.fechaCierre}
                    color="green"
                  />
                )}

                {(salida.fechaCancelacion) && (
                  <TimelineItem 
                    label="Cancelada" 
                    date={salida.fechaCancelacion} 
                    user={salida.nombreCanceladoPor} 
                    note={salida.motivoCancelacion}
                    active={true}
                    color="red"
                  />
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={dialogState.type === 'reject'} onOpenChange={(o) => !o && setDialogState({ type: null })}>
        <DialogContent>
          <DialogHeader><DialogTitle>Rechazar Solicitud</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-4">
            <p className="text-sm text-slate-500">Por favor indica el motivo por el cual rechazas esta solicitud. (Mínimo 10 caracteres)</p>
            <Textarea data-testid="input-reject-motivo" placeholder="Ej. No hay existencia suficiente en bodega..." value={motivo} onChange={e => setMotivo(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogState({ type: null })}>Cancelar</Button>
            <Button data-testid="btn-submit-reject" variant="destructive" onClick={onReject} disabled={rejectMutation.isPending || motivo.length < 10}>
              {rejectMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Rechazar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dialogState.type === 'cancel'} onOpenChange={(o) => !o && setDialogState({ type: null })}>
        <DialogContent>
          <DialogHeader><DialogTitle>Cancelar Movimiento</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-4">
            <p className="text-sm text-slate-500">¿Estás seguro de cancelar esta salida? Esta acción es irreversible.</p>
            <Textarea data-testid="input-cancel-motivo" placeholder="Motivo de la cancelación..." value={motivo} onChange={e => setMotivo(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogState({ type: null })}>Cerrar</Button>
            <Button data-testid="btn-submit-cancel" variant="destructive" onClick={onCancel} disabled={cancelMutation.isPending || motivo.length < 10}>
              {cancelMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Confirmar Cancelación
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dialogState.type === 'send'} onOpenChange={(o) => !o && setDialogState({ type: null })}>
        <DialogContent>
          <DialogHeader><DialogTitle>Enviar Mercancía</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-4">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Transportista (Requerido)</label>
              <Input data-testid="input-send-transportista" placeholder="Nombre de la fletera o chofer..." value={transportista} onChange={e => setTransportista(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Nota de Envío (Opcional)</label>
              <Textarea data-testid="input-send-nota" placeholder="Número de guía, observaciones..." value={notaEnvio} onChange={e => setNotaEnvio(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogState({ type: null })}>Cancelar</Button>
            <Button data-testid="btn-submit-send" onClick={onSend} disabled={sendMutation.isPending || !transportista.trim()}>
              {sendMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Registrar Envío
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {showPrepare && (
        <SalidaPrepareDialog 
          salida={salida} 
          open={showPrepare} 
          onOpenChange={(o) => !o && setDialogState({ type: null })}
          onSuccess={() => { setDialogState({ type: null }); invalidate(); }}
        />
      )}

      {showReceive && (
        <SalidaReceiveDialog 
          salida={salida} 
          open={showReceive} 
          onOpenChange={(o) => !o && setDialogState({ type: null })}
          onSuccess={() => { setDialogState({ type: null }); invalidate(); }}
        />
      )}
    </div>
    </AppLayout>
  );
}

function TimelineItem({ label, date, user, note, active, color }: { label: string, date?: string | null, user?: string | null, note?: string | null, active: boolean, color: string }) {
  return (
    <div className="relative">
      <div className={`absolute -left-[23px] top-1 w-3 h-3 rounded-full border-2 border-white ${active ? `bg-${color}-500` : 'bg-slate-200'}`}></div>
      <div>
        <p className={`font-semibold text-sm ${active ? 'text-slate-900' : 'text-slate-400'}`}>{label}</p>
        {active && date && (
          <div className="mt-1 text-xs text-slate-500 space-y-0.5">
            <p>{format(new Date(date), "dd MMM, HH:mm", { locale: es })}</p>
            {user && <p>Por: <span className="font-medium">{user}</span></p>}
            {note && <p className="text-amber-600 mt-1 italic">{note}</p>}
          </div>
        )}
        {!date && <p className="text-xs text-slate-400 mt-1">Pendiente</p>}
      </div>
    </div>
  );
}
