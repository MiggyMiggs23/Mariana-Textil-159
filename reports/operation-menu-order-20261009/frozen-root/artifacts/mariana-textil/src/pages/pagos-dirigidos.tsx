import { useState } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import {
  useListSolicitudesPagoDirigido,
  useAprobarSolicitudPagoDirigido,
  useRechazarSolicitudPagoDirigido,
  useGetCurrentUser,
  SolicitudPagoDirigidoEstado,
  Role,
  getListSolicitudesPagoDirigidoQueryKey,
  SolicitudPagoDirigido,
} from "@workspace/api-client-react";
import { formatAccountDestination, formatNumber } from "@workspace/number-format";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/api-error";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription
} from "@/components/ui/dialog";
import { Loader2, Check, X, RefreshCw, Activity, ArrowRight, HandCoins } from "lucide-react";
import { Link } from "wouter";
import { E12_ENABLED } from "@/lib/e12-feature-flags";
import { useRef } from "react";
import { pickCreditEvidence } from "@/lib/credit-evidence";
import { invalidateE12, cents, E12Evidence, cajaOverrideProblem } from "@/components/proveedor-efectivo-e12";
import { useGetOpcionesPagoEfectivoProveedor, getGetOpcionesPagoEfectivoProveedorQueryKey, type CreditDirectedApprovalInput, type E12AprobacionProveedorInput, type E12PagoEfectivoDetalle } from "@workspace/api-client-react";

export default function PagosDirigidos() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: user } = useGetCurrentUser();
  const isAdmin = user?.rol === Role.ADMIN;

  const { data, isLoading, refetch } = useListSolicitudesPagoDirigido(undefined, {
    query: {
      queryKey: E12_ENABLED ? [...getListSolicitudesPagoDirigidoQueryKey(), JSON.stringify(user)] : getListSolicitudesPagoDirigidoQueryKey(),
      refetchInterval: 15000,
    }
  });

  const aprobar = useAprobarSolicitudPagoDirigido();
  const rechazar = useRechazarSolicitudPagoDirigido();

  const [rechazarDialog, setRechazarDialog] = useState<{ open: boolean, solicitud: SolicitudPagoDirigido | null }>({ open: false, solicitud: null });
  const [aprobarDialog, setAprobarDialog] = useState<{ open: boolean, solicitud: SolicitudPagoDirigido | null }>({ open: false, solicitud: null });
  const [motivoDesbloqueo, setMotivoDesbloqueo] = useState("");
  const isSubmitting = useRef(false);
  const lastIntention = useRef({ snapshot: "", uuid: crypto.randomUUID() });
  const [checkingApproval, setCheckingApproval] = useState(false);
  const [appliedEvidence, setAppliedEvidence] = useState<{ identity: string; detail: E12PagoEfectivoDetalle } | null>(null);
  const proposal = isAdmin ? aprobarDialog.solicitud?.efectivoE12 : undefined;
  const approvalOptions = useGetOpcionesPagoEfectivoProveedor(aprobarDialog.solicitud?.entidadId || 0, { query: {
    enabled: E12_ENABLED && isAdmin && aprobarDialog.open,
    queryKey: [...getGetOpcionesPagoEfectivoProveedorQueryKey(aprobarDialog.solicitud?.entidadId || 0), JSON.stringify(user)],
    staleTime: 0, refetchOnMount: "always", refetchOnWindowFocus: true, refetchInterval: E12_ENABLED && aprobarDialog.open ? 15000 : false,
  } });

  const [motivoRechazo, setMotivoRechazo] = useState("");

  const handleAprobar = (id: number) => {
    const solicitud = data?.solicitudes.find(item => item.id === id);
    if (!solicitud) return;
    if (E12_ENABLED && solicitud.tipo === "PROVEEDOR" && solicitud.formaPago === "EFECTIVO") {
      setAprobarDialog({ open: true, solicitud });
      setMotivoDesbloqueo("");
      return;
    }
    ejecutarAprobar(solicitud);
  };

  const ejecutarAprobar = async (solicitud: SolicitudPagoDirigido, aprobacionE12?: E12AprobacionProveedorInput) => {
    if (isSubmitting.current) return;

    let metadata: CreditDirectedApprovalInput = {};
    try {
      if (solicitud.tipo === "CLIENTE") metadata = pickCreditEvidence(solicitud);
    } catch (error) {
      toast({ title: "Solicitud sin origen E1", description: getApiErrorMessage(error), variant: "destructive" });
      return;
    }
    if (aprobacionE12) {
      metadata.aprobacionE12 = aprobacionE12;
    }
    isSubmitting.current = true;
    if (aprobacionE12) {
      setCheckingApproval(true);
      try {
        if (!isAdmin || !proposal) throw new Error("No está disponible la propuesta autorizada de efectivo.");
        const fresh = await approvalOptions.refetch();
        if (fresh.error) throw fresh.error;
        if (!fresh.data?.enabled) throw new Error("E12 no está disponible.");
        const caja = cents(proposal.caja);
        const fondo = cents(proposal.fondo ?? "0");
        if (caja === null || fondo === null) throw new Error("Propuesta inválida.");
        if (caja > 0 && (!fresh.data.sesionCajaId || fresh.data.sesionCajaId !== proposal.sesionCajaId)) throw new Error("La sesión propuesta cerró. Resuelve la solicitud y prepara otra intención en la sesión vigente.");
        if (fondo > 0 && fondo > (cents(fresh.data.fondo?.saldo ?? "") ?? -1)) throw new Error("Fondo insuficiente; no admite sobregiro.");
        const problem = cajaOverrideProblem(E12_ENABLED, caja, fresh.data.saldoCaja, isAdmin && !!fresh.data.puedeDesbloquearCaja, aprobacionE12.desbloqueoCaja?.motivo ?? "");
        if (problem) throw new Error(problem);
      } catch (error) {
        toast({ title: "No se pudo aprobar", description: getApiErrorMessage(error), variant: "destructive" });
        isSubmitting.current = false;
        setCheckingApproval(false);
        return;
      }
      setCheckingApproval(false);
    }

    aprobar.mutate({ id: solicitud.id, data: metadata }, {
      onSuccess: (result) => {
        if (E12_ENABLED && isAdmin && result.efectivoE12) setAppliedEvidence({ identity: JSON.stringify(user), detail: result.efectivoE12 });
        toast({ title: "Solicitud aprobada exitosamente." });
        queryClient.invalidateQueries({ queryKey: ["/api/pagos-dirigidos"] });
        queryClient.invalidateQueries({ queryKey: ["/api/clientes"] });
        queryClient.invalidateQueries({ queryKey: ["/api/proveedores"] });
        queryClient.invalidateQueries({ predicate: query => typeof query.queryKey[0] === "string" && query.queryKey[0].startsWith("/api/clientes/") });
        if (aprobacionE12) {
           void invalidateE12(queryClient, isAdmin);
           lastIntention.current = { snapshot: "", uuid: crypto.randomUUID() };
           setAprobarDialog({ open: false, solicitud: null });
        }
      },
      onError: (err) => {
        toast({ title: "Error al aprobar", description: getApiErrorMessage(err), variant: "destructive" });
      },
      onSettled: () => {
        isSubmitting.current = false;
      }
    });
  };

  const handleRechazar = () => {
    if (!rechazarDialog.solicitud) return;
    if (motivoRechazo.trim().length < 10) {
      toast({ title: "Motivo insuficiente", description: "Debe ingresar al menos 10 caracteres.", variant: "destructive" });
      return;
    }

    rechazar.mutate({ id: rechazarDialog.solicitud.id, data: { motivoRechazo: motivoRechazo.trim() } }, {
      onSuccess: () => {
        toast({ title: "Solicitud rechazada." });
        setRechazarDialog({ open: false, solicitud: null });
        setMotivoRechazo("");
        queryClient.invalidateQueries({ queryKey: ["/api/pagos-dirigidos"] });
      },
      onError: (err) => {
        toast({ title: "Error al rechazar", description: getApiErrorMessage(err), variant: "destructive" });
      }
    });
  };

  return (
    <AppLayout>
      <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-sidebar flex items-center gap-3">
              <HandCoins className="w-8 h-8 text-primary" />
              Solicitudes de Pago Dirigido
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Excepciones al orden FIFO para clientes y proveedores.
            </p>
          </div>
          <Button variant="outline" onClick={() => refetch()} disabled={isLoading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            Actualizar
          </Button>
        </div>

        <Card className="shadow-md border-sidebar-border/10 overflow-hidden">
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex flex-col h-64 items-center justify-center text-muted-foreground gap-4">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p>Cargando solicitudes...</p>
              </div>
            ) : !data?.solicitudes.length ? (
              <div className="flex flex-col h-64 items-center justify-center text-muted-foreground gap-4 bg-muted/20">
                <Activity className="h-12 w-12 text-muted-foreground/30" />
                <p className="font-medium text-lg">No hay solicitudes de pago dirigido.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse text-left">
                  <thead>
                    <tr className="border-b bg-muted/50 text-sidebar font-bold uppercase tracking-wider text-[10px]">
                      <th className="p-4">Fecha / Solicitante</th>
                      <th className="p-4">Contraparte</th>
                      <th className="p-4">Doc / Ref</th>
                      <th className="p-4 text-right">Importe</th>
                      <th className="p-4 w-[250px]">Motivo</th>
                      <th className="p-4 text-center">Estado</th>
                      <th className="p-4 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y border-b">
                    {data.solicitudes.map(sol => (
                      <tr key={sol.id} className="hover:bg-muted/30 transition-colors">
                        <td className="p-4">
                          <div className="font-bold text-sidebar">{format(new Date(sol.createdAt), "dd/MM/yyyy HH:mm")}</div>
                          <div className="text-xs text-muted-foreground">{sol.solicitanteNombre}</div>
                        </td>
                        <td className="p-4">
                          <Badge variant="outline" className={`mb-1 text-[9px] ${sol.tipo === 'CLIENTE' ? 'border-primary text-primary' : 'border-emerald-600 text-emerald-600'}`}>
                            {sol.tipo}
                          </Badge>
                          <div className="font-bold text-sm truncate max-w-[200px]" title={sol.contraparteNombre}>
                            {sol.contraparteNombre}
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="font-black text-sidebar">#{sol.documentoFolio}</div>
                          <div className="text-xs text-muted-foreground truncate max-w-[150px]">{sol.formaPago} {sol.cuentaDestino ? `· ${formatAccountDestination(sol.cuentaDestino)}` : ''}</div>
                          {E12_ENABLED && isAdmin && sol.efectivoE12 && <div className="text-xs mt-1">Propuesta: Caja {sol.efectivoE12.caja} · Fondo {sol.efectivoE12.fondo ?? "0.00"} · Sesión {sol.efectivoE12.sesionCajaId ?? "No requerida"}</div>}
                        </td>
                        <td className="p-4 text-right font-black text-sidebar text-base tabular-nums">
                          {formatNumber(sol.importe, { kind: "money" })}
                        </td>
                        <td className="p-4 text-xs">
                          <p className="line-clamp-2" title={sol.motivo}>{sol.motivo}</p>
                          {sol.motivoRechazo && (
                            <p className="text-destructive font-semibold mt-1">Rechazo: {sol.motivoRechazo}</p>
                          )}
                        </td>
                        <td className="p-4 text-center">
                          <Badge variant={
                            sol.estado === "APROBADA" ? "default" :
                            sol.estado === "RECHAZADA" ? "destructive" : "secondary"
                          } className={sol.estado === "APROBADA" ? "bg-emerald-500 hover:bg-emerald-600" : ""}>
                            {sol.estado}
                          </Badge>
                        </td>
                        <td className="p-4 text-right">
                          {sol.estado === "PENDIENTE" && isAdmin ? (
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-8 border-emerald-500 text-emerald-700 hover:bg-emerald-50"
                                onClick={() => handleAprobar(sol.id)}
                                disabled={aprobar.isPending}
                              >
                                <Check className="w-4 h-4 mr-1" /> Aprobar
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-8 border-destructive text-destructive hover:bg-destructive/10"
                                onClick={() => setRechazarDialog({ open: true, solicitud: sol })}
                              >
                                <X className="w-4 h-4 mr-1" /> Rechazar
                              </Button>
                            </div>
                          ) : sol.estado === "RECHAZADA" ? (
                            <Link href={sol.tipo === 'CLIENTE' ? `/clientes/${sol.entidadId}?tab=estado&importe=${sol.importe}` : `/proveedores/${sol.entidadId}?tab=pagos&importe=${sol.importe}`}>
                              <Button variant="outline" size="sm" className="h-8 text-xs font-bold w-full bg-sidebar/5">
                                Registrar vía FIFO <ArrowRight className="w-3 h-3 ml-1" />
                              </Button>
                            </Link>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <Dialog open={rechazarDialog.open} onOpenChange={(val) => !val && setRechazarDialog({ open: false, solicitud: null })}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="text-destructive flex items-center gap-2">
                <X className="w-5 h-5" /> Rechazar Solicitud
              </DialogTitle>
              <DialogDescription>
                Indique el motivo por el cual esta excepción no procede. El solicitante podrá registrar el abono vía FIFO.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label className="text-xs font-bold text-muted-foreground uppercase">Motivo del rechazo</Label>
                <Textarea
                  value={motivoRechazo}
                  onChange={(e) => setMotivoRechazo(e.target.value)}
                  placeholder="Escriba el motivo (mínimo 10 caracteres)..."
                  className="resize-none h-24 border-2"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setRechazarDialog({ open: false, solicitud: null })}>Cancelar</Button>
              <Button
                variant="destructive"
                onClick={handleRechazar}
                disabled={rechazar.isPending || motivoRechazo.trim().length < 10}
              >
                {rechazar.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Rechazar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

        {appliedEvidence?.identity === JSON.stringify(user) && <E12Evidence detail={appliedEvidence?.detail} admin={isAdmin} />}
        <Dialog open={aprobarDialog.open} onOpenChange={(val) => !val && !isSubmitting.current && setAprobarDialog({ open: false, solicitud: null })}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Check className="w-5 h-5 text-emerald-600" /> Aprobar Pago en Efectivo (E12)
              </DialogTitle>
              <DialogDescription>
                Confirmar la aplicación de {formatNumber(aprobarDialog.solicitud?.importe || "0", { kind: "money" })} para el proveedor.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {proposal ? <div className="rounded border p-3 text-sm"><p>Propuesta persistida: Caja {proposal.caja} · Fondo {proposal.fondo ?? "0.00"}</p><p>Sesión propuesta: {proposal.sesionCajaId ?? "No requerida (Fondo puro)"}</p><p>No se modifica el reparto al aprobar.</p><p>Disponibilidad actual: Caja {approvalOptions.data?.saldoCaja ?? "Sin sesión"} · Fondo {approvalOptions.data?.fondo?.saldo ?? "No disponible"}</p></div> : <p role="alert">No está disponible la propuesta de efectivo.</p>}
              {approvalOptions.error && <p role="alert" className="text-destructive">{getApiErrorMessage(approvalOptions.error)}</p>}
              <div className="space-y-2">
                <Label className="text-xs font-bold text-muted-foreground uppercase">Motivo Desbloqueo Caja (Solo si es necesario)</Label>
                <Input
                  value={motivoDesbloqueo}
                  maxLength={1000}
                  onChange={(e) => setMotivoDesbloqueo(e.target.value)}
                  placeholder="Justificación si no hay saldo..."
                  disabled={aprobar.isPending || checkingApproval || !isAdmin || !approvalOptions.data?.puedeDesbloquearCaja}
                />
              </div>
            </div>
            <DialogFooter>
              <Button disabled={aprobar.isPending || checkingApproval} variant="ghost" onClick={() => setAprobarDialog({ open: false, solicitud: null })}>Cancelar</Button>
              <Button
                variant="default"
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
                onClick={() => {
                   const snapshot = JSON.stringify({ solicitud: aprobarDialog.solicitud, motivoDesbloqueo });
                   if (lastIntention.current.snapshot !== snapshot) {
                     lastIntention.current = { snapshot, uuid: crypto.randomUUID() };
                   }
                   const aprobacionE12: E12AprobacionProveedorInput = { claveOperacion: lastIntention.current.uuid };
                   if (motivoDesbloqueo.trim()) {
                     aprobacionE12.desbloqueoCaja = { motivo: motivoDesbloqueo.trim() };
                   }
                   ejecutarAprobar(aprobarDialog.solicitud!, aprobacionE12);
                }}
                disabled={!proposal || !isAdmin || aprobar.isPending || checkingApproval || isSubmitting.current}
              >
                {(aprobar.isPending || isSubmitting.current) && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Confirmar Aprobación
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

    </AppLayout>
  );
}
