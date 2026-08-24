import { useState } from "react";
import { useRoute, Link } from "wouter";
import { AppLayout } from "@/components/layout/app-layout";
import {
  useGetSalida,
  useCancelarSalida,
  getGetSalidaQueryKey,
  useGetCurrentUser,
  getGetCurrentUserQueryKey,
  Role,
  getListSalidasQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  ArrowLeft,
  Clock,
  Printer,
  XSquare,
  Package,
  AlertCircle,
  Loader2,
  Lock,
  User,
  Truck,
  FileText
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

function EstadoBadge({ estado }: { estado: string }) {
  const map: Record<string, { label: string; class: string }> = {
    SOLICITADA: { label: "Solicitada", class: "bg-blue-100 text-blue-800 border-blue-200" },
    ACEPTADA: { label: "Aceptada", class: "bg-indigo-100 text-indigo-800 border-indigo-200" },
    RECHAZADA: { label: "Rechazada", class: "bg-red-100 text-red-800 border-red-200" },
    PREPARADA: { label: "Preparada", class: "bg-purple-100 text-purple-800 border-purple-200" },
    ENVIADA: { label: "Enviada", class: "bg-amber-100 text-amber-800 border-amber-200" },
    RECIBIDA: { label: "Recibida", class: "bg-cyan-100 text-cyan-800 border-cyan-200" },
    CERRADA: { label: "Cerrada", class: "bg-green-100 text-green-800 border-green-200" },
    CANCELADA: { label: "Cancelada", class: "bg-slate-200 text-slate-800 border-slate-300" },
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

  const cancelMutation = useCancelarSalida();

  const [dialogState, setDialogState] = useState<{
    type: 'cancel' | null;
  }>({ type: null });

  const [motivo, setMotivo] = useState("");
  const [adminUsername, setAdminUsername] = useState("");
  const [adminPassword, setAdminPassword] = useState("");

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
  const canAuthorize = hasPermission(user, Modules.SALIDAS, 'autorizar');

  const atOrigin = isAdmin || user?.ubicacion?.id === salida.origenId;
  const atDestination = isAdmin || user?.ubicacion?.id === salida.destinoId;

  // New exits created via one-step capture will go straight to ENVIADA or CERRADA (if completed) or might use a different state flow.
  // We allow cancellation if authorized and state is not already canceled.
  const canCancel = salida.estado !== 'CANCELADA' && (isAdmin || (canAuthorize && (atOrigin || atDestination)));

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getGetSalidaQueryKey(id) });
    queryClient.invalidateQueries({ queryKey: getListSalidasQueryKey() });
  };

  const onCancel = () => {
    if (motivo.trim().length < 10) {
      toast({ title: "Atención", description: "El motivo debe tener al menos 10 caracteres", variant: "destructive" });
      return;
    }
    cancelMutation.mutate({
      id,
      data: {
        motivo,
        ...( !isAdmin ? { adminUsuario: adminUsername, adminPassword } : {} )
      }
    }, {
      onSuccess: () => {
        toast({ title: "Salida cancelada" });
        setDialogState({ type: null });
        invalidate();
      },
      onError: (err) => toast({ title: "Error", description: getApiErrorMessage(err), variant: "destructive" })
    });
  };

  return (
    <AppLayout>
    <div className="space-y-6 max-w-6xl mx-auto pb-12 animate-in fade-in duration-300">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <div className="flex min-w-0 items-start gap-3">
          <Link href="/salidas">
            <Button variant="ghost" size="icon" data-testid="btn-back" aria-label="Volver" className="shrink-0 text-slate-500 hover:text-slate-900">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 data-testid="salida-folio" className={`text-3xl font-bold tracking-tight ${salida.estado === 'CANCELADA' ? 'line-through text-slate-500' : 'text-slate-900'}`}>
              Folio {String(salida.folio).padStart(5, '0')}
            </h1>
            <span data-testid={`status-${salida.estado.toLowerCase()}`}><EstadoBadge estado={salida.estado} /></span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-500">
            <span className="flex items-center gap-1">
              <Clock className="w-4 h-4" />
              {format(new Date(salida.createdAt), "dd MMM yyyy, HH:mm", { locale: es })}
            </span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <User className="w-4 h-4" />
              {salida.nombreSolicitadoPor}
            </span>
          </div>
        </div>
        </div>

        <div className="flex w-full flex-wrap items-center gap-2 sm:ml-auto sm:w-auto sm:justify-end">
          {salida.estado !== 'CANCELADA' && (
            <Link href={`/salidas/${salida.id}/documento/salida`}>
              <Button data-testid="btn-print-salida" variant="outline" className="gap-2 bg-white">
                <Printer className="w-4 h-4" /> Imprimir Documento
              </Button>
            </Link>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">

          <Card className="shadow-sm border-slate-200">
            <CardHeader className="pb-4 border-b border-slate-100 bg-slate-50">
              <CardTitle className="text-base flex items-center gap-2">
                <Package className="w-4 h-4 text-primary" />
                Rollos Incluidos ({salida.rollos.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-y border-slate-100 text-slate-500">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium">#</th>
                      <th className="px-4 py-3 text-left font-medium">Serie</th>
                      <th className="px-4 py-3 text-left font-medium">Producto</th>
                      <th className="px-4 py-3 text-right font-medium">Cantidad</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {salida.rollos.map((rollo, index) => {
                      const linea = salida.lineas.find(l => l.id === rollo.lineaId);
                      return (
                        <tr key={rollo.id} className={`hover:bg-slate-50/50 ${salida.estado === 'CANCELADA' ? 'opacity-60' : ''}`}>
                          <td className="px-4 py-3 text-slate-500 w-10">{index + 1}</td>
                          <td className="px-4 py-3 font-mono font-bold text-slate-900">{rollo.serie}</td>
                          <td className="px-4 py-3">
                            <p className="font-semibold text-slate-800 truncate max-w-[200px]">{linea?.skuProducto}</p>
                            <p className="text-xs text-slate-500 mt-0.5 truncate max-w-[200px]">{linea?.telaProducto} {linea?.colorProducto}</p>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className="font-medium text-slate-900">{rollo.cantidadEnviada}</span>
                            <span className="text-[10px] ml-1 uppercase text-slate-400 font-bold tracking-wider">{linea?.unidadProducto}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="shadow-sm border-slate-200">
            <CardHeader className="pb-3 border-b border-slate-100 bg-slate-50">
              <CardTitle className="text-base font-semibold">Resumen</CardTitle>
            </CardHeader>
            <CardContent className="p-5 space-y-4">
              <div className="flex justify-between items-end border-b border-slate-100 pb-3">
                <span className="text-sm font-semibold text-slate-500">Total Rollos</span>
                <span className="text-2xl font-black text-slate-900">{salida.totalRollos ?? salida.rollos.length}</span>
              </div>
              {salida.totalMetros && Number(salida.totalMetros) > 0 && (
                <div className="flex justify-between items-end border-b border-slate-100 pb-3">
                  <span className="text-sm font-semibold text-slate-500">Metros</span>
                  <span className="text-lg font-bold text-slate-700">{salida.totalMetros}</span>
                </div>
              )}
              {salida.totalKilos && Number(salida.totalKilos) > 0 && (
                <div className="flex justify-between items-end pb-2">
                  <span className="text-sm font-semibold text-slate-500">Kilos</span>
                  <span className="text-lg font-bold text-slate-700">{salida.totalKilos}</span>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-sm border-slate-200">
            <CardHeader className="pb-3 border-b border-slate-100 bg-slate-50">
              <CardTitle className="text-base font-semibold">Detalles del Envío</CardTitle>
            </CardHeader>
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

              {(salida.transportista || salida.observaciones || salida.notaSolicitud) && (
                <div className="mt-4 pt-4 border-t border-slate-100 space-y-3">
                  {salida.transportista && (
                    <div className="flex items-start gap-2 text-sm">
                      <Truck className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-semibold block text-slate-700">Transportista:</span>
                        <span className="text-slate-600">{salida.transportista}</span>
                      </div>
                    </div>
                  )}
                  {(salida.observaciones || salida.notaSolicitud) && (
                    <div className="flex items-start gap-2 text-sm">
                      <FileText className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-semibold block text-slate-700">Observaciones:</span>
                        <span className="text-slate-600 italic">{salida.observaciones || salida.notaSolicitud}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {canCancel && (
            <Card className="shadow-sm border-red-200 bg-red-50/50">
              <CardContent className="p-4 space-y-3">
                <p className="text-sm text-red-600 font-medium">
                  Si hubo un error y esta salida no debe proceder, puedes cancelarla.
                </p>
                <Button data-testid="btn-action-cancel" onClick={() => { setMotivo(""); setAdminUsername(""); setAdminPassword(""); setDialogState({ type: 'cancel' }); }} variant="outline" className="w-full justify-start text-red-600 border-red-200 hover:bg-red-50 bg-white">
                  <XSquare className="w-4 h-4 mr-2" /> Cancelar Salida
                </Button>
              </CardContent>
            </Card>
          )}

          {salida.estado === 'CANCELADA' && (
            <Card className="shadow-sm border-red-200 bg-red-50/50">
              <CardContent className="p-4">
                <div className="flex gap-2">
                  <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
                  <div>
                    <h4 className="font-bold text-red-800 text-sm">Salida Cancelada</h4>
                    <p className="text-sm text-red-600 mt-1">{salida.motivoCancelacion || "Sin motivo registrado"}</p>
                    {salida.nombreCanceladoPor && (
                      <p className="text-xs text-red-500 mt-2 font-medium">Por: {salida.nombreCanceladoPor}</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <Dialog open={dialogState.type === 'cancel'} onOpenChange={(o) => !o && setDialogState({ type: null })}>
        <DialogContent>
          <DialogHeader><DialogTitle>Cancelar Salida</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-4">
            <p className="text-sm text-slate-500">¿Estás seguro de cancelar esta salida? Los rollos regresarán a estar disponibles en el origen.</p>
            <Textarea data-testid="input-cancel-motivo" placeholder="Motivo de la cancelación (Mínimo 10 caracteres)..." value={motivo} onChange={e => setMotivo(e.target.value)} />

            {!isAdmin && (
              <div className="pt-4 border-t border-slate-100 space-y-3">
                <p className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                  <Lock className="w-4 h-4" /> Autorización Requerida
                </p>
                <Input
                  data-testid="input-cancel-username"
                  placeholder="Usuario Admin"
                  value={adminUsername}
                  onChange={e => setAdminUsername(e.target.value)}
                />
                <Input
                  data-testid="input-cancel-password"
                  type="password"
                  placeholder="Contraseña Admin"
                  value={adminPassword}
                  onChange={e => setAdminPassword(e.target.value)}
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogState({ type: null })}>Cerrar</Button>
            <Button data-testid="btn-submit-cancel" variant="destructive" onClick={onCancel} disabled={cancelMutation.isPending || motivo.length < 10 || (!isAdmin && (!adminUsername || !adminPassword))}>
              {cancelMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Confirmar Cancelación
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
    </AppLayout>
  );
}
