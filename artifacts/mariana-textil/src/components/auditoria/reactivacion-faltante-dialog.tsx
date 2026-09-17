import { useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Send, ExternalLink } from "lucide-react";
import { Link } from "wouter";
import {
  getGetAuditoriaInventarioQueryKey,
  getGetExistenciasAgrupadasQueryKey,
  getGetNotificationFeedQueryKey,
  getGetReactivacionFaltanteQueryKey,
  getGetRolloQueryKey,
  getListNotificacionesQueryKey,
  getListRollosQueryKey,
  getListSitiosAuditoriaInventarioQueryKey,
  type ReactivacionFaltanteContexto,
  type ReactivacionFaltanteInput,
  useListPisosLocation,
  useListSitiosAuditoriaInventario,
  useReactivarFaltante,
} from "@workspace/api-client-react";
import { formatNumber, formatUnit } from "@workspace/number-format";
import { ApiErrorDetails } from "@/lib/api-error";

interface ReactivacionFaltanteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rolloId: number;
  origen: "AUDITORIA" | "ROLLO";
  contexto: ReactivacionFaltanteContexto;
  onSuccess: () => void;
}

export function buildReactivacionFaltanteInput(input: {
  auditoriaOrigenId: number;
  origen: "AUDITORIA" | "ROLLO";
  ubicacionId: number;
  pisoId: number | null;
  motivo: string;
  uuidCliente: string;
}): ReactivacionFaltanteInput {
  return {
    auditoriaOrigenId: input.auditoriaOrigenId,
    origen: input.origen,
    ubicacionId: input.ubicacionId,
    pisoId: input.pisoId,
    motivo: input.motivo.trim(),
    uuidCliente: input.uuidCliente,
  };
}

export function ReactivacionFaltanteDialog({
  open,
  onOpenChange,
  rolloId,
  origen,
  contexto,
  onSuccess,
}: ReactivacionFaltanteDialogProps) {
  const queryClient = useQueryClient();
  const reactivarFaltante = useReactivarFaltante();
  const [ubicacionId, setUbicacionId] = useState<string>("none");
  const [pisoId, setPisoId] = useState<string>("none");
  const [motivo, setMotivo] = useState("");
  const uuidClienteRef = useRef<string>(crypto.randomUUID());
  const submitLockRef = useRef(false);

  const { data: sitios } = useListSitiosAuditoriaInventario({
    query: { enabled: open, queryKey: getListSitiosAuditoriaInventarioQueryKey() }
  });

  const selectedUbicacion = Number(ubicacionId) > 0 ? Number(ubicacionId) : contexto.ubicacionBajaId ?? 0;
  const { data: pisos } = useListPisosLocation(selectedUbicacion, {
    query: { enabled: open && selectedUbicacion > 0, queryKey: ['pisosLocation', selectedUbicacion] }
  });
  const pisosActivos = pisos?.filter(p => p.activo) || [];
  const auditoriasPosterioresDelSitio = useMemo(
    () =>
      ubicacionId === "none"
        ? []
        : contexto.auditoriasPosteriores.filter(
            (auditoria) => auditoria.ubicacionId === Number(ubicacionId),
          ),
    [contexto.auditoriasPosteriores, ubicacionId],
  );

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setUbicacionId("none");
      setPisoId("none");
      setMotivo("");
      uuidClienteRef.current = crypto.randomUUID();
      submitLockRef.current = false;
    }
    onOpenChange(newOpen);
  };

  const handleResolve = () => {
    const trimmedMotivo = motivo.trim();
    if (trimmedMotivo.length < 10) return;
    if (ubicacionId === "none") return;
    if (contexto.auditoriaOrigenId == null) return;
    if (pisosActivos.length > 0 && pisoId === "none") return;
    if (submitLockRef.current) return;
    submitLockRef.current = true;

    reactivarFaltante.mutate({
      id: rolloId,
      data: buildReactivacionFaltanteInput({
        origen,
        auditoriaOrigenId: contexto.auditoriaOrigenId,
        ubicacionId: Number(ubicacionId),
        pisoId: pisoId === "none" ? null : Number(pisoId),
        motivo: trimmedMotivo,
        uuidCliente: uuidClienteRef.current,
      }),
    }, {
      onSuccess: () => {
        toast.success("Rollo reactivado exitosamente");
        queryClient.invalidateQueries({ queryKey: getGetRolloQueryKey(rolloId) });
        queryClient.invalidateQueries({ queryKey: getListRollosQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetReactivacionFaltanteQueryKey(rolloId) });
        queryClient.invalidateQueries({ queryKey: getGetExistenciasAgrupadasQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetAuditoriaInventarioQueryKey(contexto.auditoriaOrigenId!) });
        queryClient.invalidateQueries({ queryKey: getListNotificacionesQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetNotificationFeedQueryKey() });
        onSuccess();
        handleOpenChange(false);
      },
      onError: (error) => {
        submitLockRef.current = false;
        toast.error("Error al reactivar", {
          description: (
            <ApiErrorDetails
              error={error}
              fallback="No se pudo completar la reactivación."
            />
          ),
        });
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle className="text-emerald-700 flex items-center gap-2">
            Reactivar Rollo Faltante
            <span className="font-mono bg-muted px-2 py-0.5 rounded text-sm text-foreground">{contexto.serie}</span>
          </DialogTitle>
          <DialogDescription>
            Devolver un rollo dado de baja al inventario activo.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Read-only Context */}
          <div className="bg-muted/30 border rounded-lg p-3 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Producto:</span>
              <span className="font-medium">{contexto.producto}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Cantidad previa:</span>
              <span className="font-mono font-medium" data-testid="reactivation-previous-quantity">
                {contexto.cantidadAnterior != null
                  ? `${formatNumber(contexto.cantidadAnterior, { kind: "quantity" })} ${formatUnit(contexto.unidad)}`
                  : "Desconocida"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Costo unitario:</span>
              {contexto.costoUnitario != null ? (
                <span className="font-mono text-emerald-600 dark:text-emerald-400 font-medium">
                  {formatNumber(contexto.costoUnitario, { kind: "money" })}
                </span>
              ) : (
                <span className="font-medium text-muted-foreground">Pendiente</span>
              )}
            </div>
            {contexto.recepcionId != null && (
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Entrada de proveedor:</span>
                <span className="flex items-center gap-2">
                  <span className="text-xs">{contexto.proveedorNombre ?? 'Desconocido'}</span>
                  <Link href={`/entradas/${contexto.recepcionId}/documento`} className="text-primary hover:underline flex items-center gap-1 font-medium">
                    {contexto.entradaFolio ?? "Ver documento"} <ExternalLink className="w-3 h-3" />
                  </Link>
                </span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Ubicación física actual</Label>
              <Select value={ubicacionId} onValueChange={(value) => {
                setUbicacionId(value);
                setPisoId("none");
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona un sitio" />
                </SelectTrigger>
                <SelectContent>
                  {sitios?.map((s) => (
                    <SelectItem key={s.id} value={s.id.toString()}>{s.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label>Asignar a piso{pisosActivos.length > 0 ? " *" : ""}</Label>
              <Select value={pisoId} onValueChange={setPisoId} disabled={ubicacionId === "none" || pisosActivos.length === 0}>
                <SelectTrigger>
                  <SelectValue placeholder="Sin piso" />
                </SelectTrigger>
                <SelectContent>
                  {pisosActivos.length === 0 && <SelectItem value="none">Sin piso</SelectItem>}
                  {pisosActivos.map(p => (
                    <SelectItem key={p.id} value={p.id.toString()}>{p.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {auditoriasPosterioresDelSitio.length > 0 && (
            <div className="text-sm text-amber-700 bg-amber-50 dark:bg-amber-950/30 p-3 rounded border border-amber-200" data-testid="reactivation-later-audits">
              <strong>Aviso:</strong> Este sitio tuvo auditorías cerradas después de la baja:
              <ul className="mt-1 list-disc pl-5">
                {auditoriasPosterioresDelSitio.map((auditoria) => (
                  <li key={auditoria.id}>
                    <Link className="font-medium underline" href={`/inventario/auditorias?auditoriaId=${auditoria.id}`}>
                      Auditoría {auditoria.folio}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <Label>Motivo detallado</Label>
              <span className={`text-xs ${motivo.trim().length < 10 ? 'text-destructive font-medium' : 'text-emerald-600 font-medium'}`}>
                {motivo.trim().length}/10 min
              </span>
            </div>
            <Textarea
              data-testid="input-reactivation-reason"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Explica dónde se encontró y por qué no estaba..."
              className="resize-none h-20"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => handleOpenChange(false)}>Cancelar</Button>
          <Button
            data-testid="button-confirm-reactivation"
            disabled={
              reactivarFaltante.isPending ||
              motivo.trim().length < 10 ||
              ubicacionId === "none" ||
              contexto.auditoriaOrigenId == null ||
              (pisosActivos.length > 0 && pisoId === "none")
            }
            onClick={handleResolve}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {reactivarFaltante.isPending ? "Reactivando..." : "Reactivar Rollo"}
            {!reactivarFaltante.isPending && <Send className="w-4 h-4 ml-2" />}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
