import React, { useState, useRef } from "react";
import { formatAccountDestination, formatNumber } from "@workspace/number-format";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import {
  useRevisarSalidaDineroCaja,
  SalidaDineroRevision,
  Role,
  type E12DesbloqueoCaja,
  getListarSalidasDineroCajaQueryKey,
  getObtenerCorteCajaQueryKey,
  getObtenerSesionCajaActualQueryKey,
  getListarSesionesCajaQueryKey,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, MessageSquare, Check, X, Eye } from "lucide-react";
import { getApiErrorMessage } from "@/lib/api-error";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { E12_ENABLED } from "@/lib/e12-feature-flags";

type SalidaBase = {
  id: number;
  monto: string;
  motivo: string;
  proveedorId?: number | null;
  cuentaOrigen: string;
  createdAt: string;
  e4?: SalidaDineroRevision;
  pagoProveedorIdE12?: number;
  e12DesbloqueoCaja?: E12DesbloqueoCaja;
};

export function SalidaDineroE4Item({
  salida,
  nombreProveedor,
  sesionId,
  userRole,
  userUbicacionId,
  tiendaId, // Location of the session
}: {
  salida: SalidaBase;
  nombreProveedor?: string;
  sesionId: number;
  userRole?: string;
  userUbicacionId?: number;
  tiendaId?: number;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const revisar = useRevisarSalidaDineroCaja();

  const [dialogState, setDialogState] = useState<{
    open: boolean;
    accion: "ACEPTAR" | "RECLAMAR" | "RESPONDER" | "HISTORIAL" | null;
  }>({ open: false, accion: null });

  const [explicacion, setExplicacion] = useState("");
  const [comprobanteUrl, setComprobanteUrl] = useState("");
  const isSubmitting = useRef(false);
  const lastIntention = useRef({ snapshot: "", uuid: crypto.randomUUID() });

  const isE4 = !!salida.e4;
  const e4 = salida.e4;

  const isSupervisorOfStore =
    userRole === Role.SUPERVISOR &&
    tiendaId !== undefined &&
    userUbicacionId === tiendaId;

  const isAdmin = userRole === Role.ADMIN;

  const canAccept =
    isAdmin && e4 && (e4.estado === "PENDIENTE" || e4.estado === "RESPONDIDA");
  const canReclamar =
    isAdmin && e4 && (e4.estado === "PENDIENTE" || e4.estado === "RESPONDIDA");
  const canResponder =
    isSupervisorOfStore && e4 && e4.estado === "RECLAMADA";

  const handleAction = (accion: "ACEPTAR" | "RECLAMAR" | "RESPONDER") => {
    setDialogState({ open: true, accion });
    setExplicacion("");
    setComprobanteUrl("");
  };

  const submitRevision = () => {
    if (!e4 || !dialogState.accion || dialogState.accion === "HISTORIAL") return;
    if (isSubmitting.current) return;

    if (dialogState.accion === "RECLAMAR" && !explicacion.trim()) {
      toast({ title: "La explicación es obligatoria para reclamar.", variant: "destructive" });
      return;
    }
    if (dialogState.accion === "RESPONDER" && !explicacion.trim()) {
      toast({ title: "La explicación es obligatoria para responder.", variant: "destructive" });
      return;
    }

    const currentSnapshot = JSON.stringify({
      salidaId: salida.id,
      version: e4.version,
      accion: dialogState.accion,
      explicacion: explicacion.trim() || undefined,
      comprobanteUrl: comprobanteUrl.trim() || null
    });

    if (lastIntention.current.snapshot !== currentSnapshot) {
      lastIntention.current = { snapshot: currentSnapshot, uuid: crypto.randomUUID() };
    }

    isSubmitting.current = true;
    revisar.mutate(
      {
        id: sesionId,
        salidaId: salida.id,
        data: {
          accion: dialogState.accion,
          version: e4.version,
          claveOperacion: lastIntention.current.uuid,
          explicacion: explicacion.trim() || undefined,
          comprobanteUrl: comprobanteUrl.trim() || null,
        },
      },
      {
        onSuccess: () => {
          lastIntention.current = { snapshot: "", uuid: crypto.randomUUID() };
          queryClient.invalidateQueries({ queryKey: getListarSalidasDineroCajaQueryKey(sesionId) });
          queryClient.invalidateQueries({ queryKey: getObtenerCorteCajaQueryKey(sesionId) });
          queryClient.invalidateQueries({ queryKey: getObtenerSesionCajaActualQueryKey() });
          queryClient.invalidateQueries({ queryKey: getListarSesionesCajaQueryKey() });
          queryClient.invalidateQueries({ predicate: ({ queryKey }) => {
            const url = queryKey[0];
            return typeof url === "string" && /^\/api\/(salidas-dinero-caja|caja|sesiones-caja|cortes)(\/|$|\?)/.test(url);
          } });
          if (dialogState.accion) {
            toast({ title: `Salida ${dialogState.accion.toLowerCase()} exitosamente.` });
          }
          setDialogState({ open: false, accion: null });
        },
        onError: (err) => {
          toast({
            title: "Error al revisar salida",
            description: getApiErrorMessage(err),
            variant: "destructive",
          });
        },
        onSettled: () => {
          isSubmitting.current = false;
        }
      }
    );
  };

  const getEstadoBadge = (estado: string) => {
    switch (estado) {
      case "PENDIENTE":
        return <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-300">Pendiente</Badge>;
      case "RECLAMADA":
        return <Badge variant="outline" className="bg-red-100 text-red-800 border-red-300">Reclamada</Badge>;
      case "RESPONDIDA":
        return <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-300">Respondida</Badge>;
      case "ACEPTADA":
        return <Badge variant="outline" className="bg-green-100 text-green-800 border-green-300">Aceptada</Badge>;
      case "NO_APLICA":
        return <Badge variant="secondary">No Aplica</Badge>;
      default:
        return <Badge variant="outline">{estado}</Badge>;
    }
  };

  return (
    <div className="flex flex-col gap-2 border-t pt-3 text-sm">
      <div className="flex flex-wrap justify-between items-start gap-2">
        <div className="flex flex-col gap-1">
          <div className="font-medium text-sidebar">
            {salida.motivo}
            {nombreProveedor ? <span className="text-muted-foreground font-normal"> · {nombreProveedor}</span> : ""}
          </div>
          <div className="text-xs text-muted-foreground flex items-center gap-2">
            <span>{formatAccountDestination(salida.cuentaOrigen as any)}</span>
            <span>·</span>
            <span>{format(new Date(salida.createdAt), "HH:mm")}</span>
            {isE4 && e4 && (
              <>
                <span>·</span>
                <span className="font-semibold">{e4.tipo}</span>
              </>
            )}
          </div>
        </div>
        <div className="text-right flex flex-col items-end gap-1">
          <span className="font-mono font-bold">{formatNumber(salida.monto, { kind: "money" })}</span>
          {isE4 && e4 && getEstadoBadge(e4.estado)}
        </div>
      </div>


      {E12_ENABLED && isAdmin && salida.pagoProveedorIdE12 && (
        <div className="mt-1 text-[10px] text-muted-foreground bg-muted/40 p-1.5 rounded">
          <span className="font-semibold text-primary">E12 Pago: #{salida.pagoProveedorIdE12}</span>
          {salida.e12DesbloqueoCaja && (
             <span className="ml-2 text-amber-700">· Desbloqueo Caja: {salida.e12DesbloqueoCaja.motivo}</span>
          )}
        </div>
      )}

      {isE4 && e4?.desbloqueoCaja && (
        <div className="mt-1 rounded border border-amber-200 bg-amber-50 p-2 text-xs text-amber-950">
          <p className="font-semibold">Desbloqueo extraordinario de Caja</p>
          <p>{e4.desbloqueoCaja.motivo}</p>
          <p className="text-amber-800">
            Usuario #{e4.desbloqueoCaja.usuarioId} · saldo {formatNumber(e4.desbloqueoCaja.saldoAntes, { kind: "money" })} · egreso {formatNumber(e4.desbloqueoCaja.egreso, { kind: "money" })} · {format(new Date(e4.desbloqueoCaja.createdAt), "dd MMM yyyy, HH:mm", { locale: es })}
          </p>
        </div>
      )}

      {isE4 && e4 && e4.historial && e4.historial.length > 0 && (
        <div className="bg-muted/30 p-2 rounded text-xs">
          <div className="flex justify-between items-center mb-1">
             <span className="font-semibold text-muted-foreground">Última actualización:</span>
             <Button variant="link" size="sm" className="h-auto p-0 text-xs" onClick={() => setDialogState({ open: true, accion: "HISTORIAL" })}>
               Ver historial completo
             </Button>
          </div>
          <div className="text-muted-foreground truncate">
             {e4.historial[e4.historial.length - 1].accion} · {format(new Date(e4.historial[e4.historial.length - 1].createdAt), "dd MMM HH:mm")}
          </div>
        </div>
      )}

      {isE4 && (canAccept || canReclamar || canResponder) && (
        <div className="flex gap-2 justify-end mt-1">
          {canAccept && (
            <Button size="sm" variant="outline" className="h-7 text-xs bg-green-50 text-green-700 border-green-200 hover:bg-green-100" onClick={() => handleAction("ACEPTAR")}>
              <Check className="w-3 h-3 mr-1" /> Aceptar
            </Button>
          )}
          {canReclamar && (
            <Button size="sm" variant="outline" className="h-7 text-xs bg-red-50 text-red-700 border-red-200 hover:bg-red-100" onClick={() => handleAction("RECLAMAR")}>
              <X className="w-3 h-3 mr-1" /> Reclamar
            </Button>
          )}
          {canResponder && (
            <Button size="sm" variant="outline" className="h-7 text-xs bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100" onClick={() => handleAction("RESPONDER")}>
              <MessageSquare className="w-3 h-3 mr-1" /> Responder
            </Button>
          )}
        </div>
      )}

      <Dialog open={dialogState.open} onOpenChange={(open) => !open && setDialogState({ open: false, accion: null })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {dialogState.accion === "HISTORIAL" ? "Historial de Revisión" : `Confirmar ${dialogState.accion?.toLowerCase()}`}
            </DialogTitle>
            {dialogState.accion !== "HISTORIAL" && (
              <DialogDescription>
                Salida por {formatNumber(salida.monto, { kind: "money" })} - {salida.motivo}
              </DialogDescription>
            )}
          </DialogHeader>

          {dialogState.accion === "HISTORIAL" ? (
            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
              {e4?.historial.map((evt, idx) => (
                <div key={idx} className="bg-muted/30 p-3 rounded-lg border text-sm">
                  <div className="flex justify-between items-start mb-2">
                    <span className="font-bold">{evt.accion}</span>
                    <span className="text-xs text-muted-foreground">{format(new Date(evt.createdAt), "dd MMM yyyy, HH:mm", { locale: es })}</span>
                  </div>
                   <p className="text-xs text-muted-foreground">Usuario #{evt.usuarioId} · versión {evt.version}</p>
                  {evt.explicacion && <p className="mt-1 text-muted-foreground">{evt.explicacion}</p>}
                  {evt.comprobanteUrl && (
                    <a href={evt.comprobanteUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline mt-2 inline-flex items-center text-xs">
                      <Eye className="w-3 h-3 mr-1" /> Ver comprobante
                    </a>
                  )}
                </div>
              ))}
              {!e4?.historial.length && <p className="text-muted-foreground text-center py-4">No hay historial de revisión.</p>}
            </div>
          ) : (
            <div className="space-y-4 py-2">
              {(dialogState.accion === "RECLAMAR" || dialogState.accion === "RESPONDER") && (
                <div className="space-y-2">
                  <Label>Explicación (obligatoria)</Label>
                  <Textarea
                    placeholder="Detalla el motivo..."
                    value={explicacion}
                    onChange={(e) => setExplicacion(e.target.value)}
                    maxLength={2000}
                    className="min-h-[100px]"
                    disabled={revisar.isPending}
                  />
                </div>
              )}
              {dialogState.accion === "RESPONDER" && (
                <div className="space-y-2">
                  <Label>Enlace a Comprobante (opcional)</Label>
                  <Input
                    type="url"
                    placeholder="https://..."
                    value={comprobanteUrl}
                    onChange={(e) => setComprobanteUrl(e.target.value)}
                    disabled={revisar.isPending}
                  />
                  <p className="text-xs text-muted-foreground">URL del documento de evidencia (drive, imagen, etc).</p>
                </div>
              )}
              {dialogState.accion === "ACEPTAR" && (
                <p className="text-muted-foreground text-sm">¿Estás seguro de que deseas aceptar esta salida de dinero? Esta acción no requiere explicación adicional.</p>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogState({ open: false, accion: null })}>
              {dialogState.accion === "HISTORIAL" ? "Cerrar" : "Cancelar"}
            </Button>
            {dialogState.accion !== "HISTORIAL" && (
              <Button onClick={submitRevision} disabled={revisar.isPending} variant={dialogState.accion === "RECLAMAR" ? "destructive" : "default"}>
                {revisar.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Confirmar {dialogState.accion?.toLowerCase()}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
