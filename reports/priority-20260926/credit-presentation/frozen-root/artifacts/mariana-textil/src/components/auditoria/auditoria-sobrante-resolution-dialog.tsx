import { useState, useRef } from "react";
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
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { AlertTriangle, Info, Send } from "lucide-react";
import {
  getGetAuditoriaInventarioQueryKey,
  getGetNotificationFeedQueryKey,
  getListNotificacionesQueryKey,
  getListRollosQueryKey,
  type AuditoriaSobranteContexto,
  type AuditoriaSobranteResolucionInputDecision,
  useListPisosLocation,
  useResolverSobranteAuditoriaInventario,
} from "@workspace/api-client-react";

interface AuditoriaSobranteResolutionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  auditoriaId: number;
  ubicacionId: number;
  serie: string;
  contexto: AuditoriaSobranteContexto;
  onSuccess: () => void;
}

function mutationErrorMessage(error: unknown): string {
  if (error && typeof error === "object" && "data" in error) {
    const data = (error as { data?: { error?: string } }).data;
    if (data?.error) return data.error;
  }
  return error instanceof Error ? error.message : "No se pudo completar la resolución.";
}

export function AuditoriaSobranteResolutionDialog({
  open,
  onOpenChange,
  auditoriaId,
  ubicacionId,
  serie,
  contexto,
  onSuccess,
}: AuditoriaSobranteResolutionDialogProps) {
  const queryClient = useQueryClient();
  const [decision, setDecision] = useState<AuditoriaSobranteResolucionInputDecision>(
    contexto.bloqueo ? "INVESTIGAR" : "DEJAR",
  );
  const [motivo, setMotivo] = useState("");
  const [transportista, setTransportista] = useState("");
  const [pisoId, setPisoId] = useState<string>("none");
  const uuidClienteRef = useRef<string>(crypto.randomUUID());

  const { data: pisos } = useListPisosLocation(ubicacionId, {
    query: { enabled: open && ubicacionId > 0, queryKey: ['pisosLocation', ubicacionId] }
  });
  const pisosActivos = pisos?.filter(p => p.activo) || [];

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setDecision(contexto.bloqueo ? "INVESTIGAR" : "DEJAR");
      setMotivo("");
      setTransportista("");
      setPisoId("none");
      uuidClienteRef.current = crypto.randomUUID();
    }
    onOpenChange(newOpen);
  };

  const resolverSobrante = useResolverSobranteAuditoriaInventario();

  const handleResolve = () => {
    const trimmedMotivo = motivo.trim();
    if (trimmedMotivo.length < 10) return;
    if (decision === "REGRESAR" && !transportista.trim()) return;

    resolverSobrante.mutate({
      id: auditoriaId,
      data: {
        serie,
         decision,
        motivo: trimmedMotivo,
        uuidCliente: uuidClienteRef.current,
        transportista: decision === "REGRESAR" ? transportista.trim() : undefined,
        pisoId: pisoId === "none" ? null : Number(pisoId),
      },
    }, {
      onSuccess: () => {
        toast.success("Resolución aplicada exitosamente");
        queryClient.invalidateQueries({ queryKey: getGetAuditoriaInventarioQueryKey(auditoriaId) });
        queryClient.invalidateQueries({ queryKey: getListRollosQueryKey() });
        queryClient.invalidateQueries({ queryKey: getListNotificacionesQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetNotificationFeedQueryKey() });
        onSuccess();
        handleOpenChange(false);
      },
      onError: (error) => {
        toast.error("Error al resolver", { description: mutationErrorMessage(error) });
      },
    });
  };

  const requiresTransportista = decision === "REGRESAR";

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Resolver Sobrante
            <span className="font-mono bg-muted px-2 py-0.5 rounded text-sm">{serie}</span>
          </DialogTitle>
          <DialogDescription>
            Toma una acción sobre este rollo encontrado físicamente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {contexto.caso === "VENDIDO_FISICAMENTE_AQUI" && (
            <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-md flex gap-2">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <div>
                <strong>Advertencia Financiera Severa:</strong> Este rollo ya fue vendido, pero sigue físicamente en este sitio. 
                Dejarlo puede causar dobles ventas o entregas erróneas.
              </div>
            </div>
          )}

          {contexto.caso === "SIN_REGISTRO_PREVIO" && (
            <div className="bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 text-sm p-3 rounded-md flex gap-2">
              <Info className="w-5 h-5 shrink-0" />
              <div>
                Serie desconocida. No hay información de producto, origen o cantidades.
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label>Decisión</Label>
            <Select value={decision} onValueChange={(value) => setDecision(value as AuditoriaSobranteResolucionInputDecision)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="DEJAR" disabled={contexto.bloqueo != null}>Dejar en este sitio</SelectItem>
                <SelectItem value="REGRESAR" disabled={contexto.bloqueo != null}>Regresar a su sitio registrado (Traslado)</SelectItem>
                <SelectItem value="INVESTIGAR">Marcar para investigación</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {requiresTransportista && (
            <div className="space-y-2">
              <Label>Transportista (Requerido para traslado)</Label>
              <Input
                value={transportista}
                onChange={(e) => setTransportista(e.target.value)}
                placeholder="Nombre del chofer o servicio"
              />
            </div>
          )}

          {(decision === "DEJAR" || decision === "INVESTIGAR") && pisosActivos.length > 0 && (
            <div className="space-y-2">
              <Label>Asignar a piso (Opcional)</Label>
              <Select value={pisoId} onValueChange={setPisoId}>
                <SelectTrigger>
                  <SelectValue placeholder="Sin piso" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin piso</SelectItem>
                  {pisosActivos.map(p => (
                    <SelectItem key={p.id} value={p.id.toString()}>{p.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Explica la decisión tomada..."
              className="resize-none h-24"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => handleOpenChange(false)}>Cancelar</Button>
          <Button
            disabled={resolverSobrante.isPending || motivo.trim().length < 10 || (requiresTransportista && !transportista.trim())}
            onClick={handleResolve}
            className={decision === "REGRESAR" ? "bg-amber-600 hover:bg-amber-700 text-white" : ""}
          >
            {resolverSobrante.isPending ? "Aplicando..." : "Confirmar Resolución"}
            {!resolverSobrante.isPending && <Send className="w-4 h-4 ml-2" />}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
