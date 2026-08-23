import { useState, useEffect } from "react";
import { 
  useRecibirSalida,
  SalidaDetail
} from "@workspace/api-client-react";
import { getApiErrorMessage } from "@/lib/api-error";
import { useToast } from "@/hooks/use-toast";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Loader2, AlertCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export function SalidaReceiveDialog({ 
  salida, 
  open, 
  onOpenChange, 
  onSuccess 
}: { 
  salida: SalidaDetail; 
  open: boolean; 
  onOpenChange: (o: boolean) => void;
  onSuccess: () => void;
}) {
  const { toast } = useToast();
  const receiveMutation = useRecibirSalida();

  const [globalNota, setGlobalNota] = useState("");
  const [rollosState, setRollosState] = useState<Record<number, {
    recibido: boolean;
    cantidadRecibida: string;
    notaDiferencia: string;
  }>>({});

  const pendingRollos = salida.rollos.filter(r => r.recibido !== true);
  const quantitiesDiffer = (received: string, sent: string) =>
    Number(received) !== Number(sent);

  // Initialize state
  useEffect(() => {
    if (open) {
      const init: typeof rollosState = {};
      pendingRollos.forEach(r => {
        init[r.id] = {
          recibido: salida.estado === 'ENVIADA' ? true : false,
          cantidadRecibida: r.cantidadEnviada,
          notaDiferencia: ""
        };
      });
      setRollosState(init);
      setGlobalNota("");
    }
  }, [open, salida, pendingRollos.length]);

  const handleRecibidoChange = (rolloId: number, val: boolean) => {
    setRollosState(prev => ({
      ...prev,
      [rolloId]: {
        ...prev[rolloId],
        recibido: val,
        cantidadRecibida: val ? salida.rollos.find(x => x.id === rolloId)?.cantidadEnviada || "" : ""
      }
    }));
  };

  const handleCantidadChange = (rolloId: number, val: string) => {
    setRollosState(prev => ({
      ...prev,
      [rolloId]: {
        ...prev[rolloId],
        cantidadRecibida: val
      }
    }));
  };

  const handleNotaChange = (rolloId: number, val: string) => {
    setRollosState(prev => ({
      ...prev,
      [rolloId]: {
        ...prev[rolloId],
        notaDiferencia: val
      }
    }));
  };

  const onSubmit = () => {
    // Determine which rollos to send.
    // If ENVIADA (initial), we MUST send all pending rollos.
    // If RECIBIDA (continuation), we only send the ones the user marked as recibido now,
    // or if they modified notes on ones that remain unreceived? 
    // Actually, backend requires we send exactly what we are updating.
    let payloadRollos = pendingRollos.map(r => {
      const state = rollosState[r.id];
      return {
        rolloId: r.id,
        recibido: state.recibido,
        cantidadRecibida: state.recibido && quantitiesDiffer(state.cantidadRecibida, r.cantidadEnviada) ? state.cantidadRecibida : null,
        notaDiferencia: state.notaDiferencia || null
      };
    });

    if (salida.estado === 'RECIBIDA') {
      // Only submit the ones the user actually toggled to true, or modified notes?
      // "The receive dialog must only render and submit rollos that backend considers pending, never already received ones."
      // If the user leaves a pending rollo unchecked, we don't submit it, because it's already recorded as not received in initial receipt.
      // Wait, if they mark it as not received again, it's redundant unless they change the note.
      // Better to only submit rollos they checked as received.
      payloadRollos = payloadRollos.filter(r => r.recibido);
    }

    if (payloadRollos.length === 0) {
      toast({
        title: "Atención",
        description: "Selecciona al menos un rollo pendiente para recibir.",
        variant: "destructive",
      });
      return;
    }

    // Validate notes for differences
    for (const item of payloadRollos) {
      const r = pendingRollos.find(x => x.id === item.rolloId)!;
      const state = rollosState[r.id];
      if (
        state.recibido &&
        (!Number.isFinite(Number(state.cantidadRecibida)) || Number(state.cantidadRecibida) <= 0)
      ) {
        toast({
          title: "Atención",
          description: `La cantidad recibida del rollo ${r.serie} debe ser mayor que cero.`,
          variant: "destructive",
        });
        return;
      }
      const hasDiff =
        !state.recibido ||
        (state.recibido && quantitiesDiffer(state.cantidadRecibida, r.cantidadEnviada));
      if (hasDiff && (!state.notaDiferencia || state.notaDiferencia.trim().length < 10)) {
        toast({
          title: "Atención",
          description: `El rollo ${r.serie} tiene diferencias. Debes agregar una nota de al menos 10 caracteres.`,
          variant: "destructive"
        });
        return;
      }
    }

    receiveMutation.mutate({
      id: salida.id,
      data: {
        notaRecepcion: globalNota || null,
        rollos: payloadRollos
      }
    }, {
      onSuccess: () => {
        toast({ title: "Recepción registrada" });
        onSuccess();
      },
      onError: (err) => {
        toast({ title: "Error", description: getApiErrorMessage(err), variant: "destructive" });
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="px-6 py-4 border-b border-slate-100 flex-shrink-0">
          <DialogTitle>Recibir Mercancía</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-6 bg-slate-50/30 custom-scrollbar">
          <div className="space-y-6">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
              <label className="text-sm font-medium">Nota de recepción general (Opcional)</label>
              <Textarea 
                data-testid="input-receive-global-nota"
                placeholder="Observaciones generales sobre la recepción..." 
                value={globalNota}
                onChange={e => setGlobalNota(e.target.value)}
              />
            </div>

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium w-12">Recibido</th>
                      <th className="px-4 py-3 text-left font-medium">Serie Rollo</th>
                      <th className="px-4 py-3 text-right font-medium">Cant. Enviada</th>
                      <th className="px-4 py-3 text-left font-medium w-[150px]">Cant. Recibida</th>
                      <th className="px-4 py-3 text-left font-medium w-[250px]">Nota Diferencia</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {pendingRollos.map(rollo => {
                      const state = rollosState[rollo.id] || { recibido: salida.estado === 'ENVIADA', cantidadRecibida: rollo.cantidadEnviada, notaDiferencia: "" };
                      const hasDiff =
                        salida.estado === "ENVIADA"
                          ? !state.recibido ||
                            (state.recibido && quantitiesDiffer(state.cantidadRecibida, rollo.cantidadEnviada))
                          : state.recibido &&
                            quantitiesDiffer(state.cantidadRecibida, rollo.cantidadEnviada);
                      
                      return (
                        <tr key={rollo.id} className={`hover:bg-slate-50/50 ${hasDiff ? 'bg-red-50/30' : ''}`}>
                          <td className="px-4 py-3">
                            <Checkbox 
                              data-testid={`checkbox-receive-rollo-${rollo.id}`}
                              checked={state.recibido}
                              onCheckedChange={(val) => handleRecibidoChange(rollo.id, !!val)}
                            />
                          </td>
                          <td className="px-4 py-3">
                            <p className="font-mono font-bold text-slate-900">{rollo.serie}</p>
                            {hasDiff && (
                              <Badge variant="destructive" className="mt-1 text-[10px] px-1 py-0 h-4">Diferencia</Badge>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right font-medium text-slate-500">
                            {rollo.cantidadEnviada}
                          </td>
                          <td className="px-4 py-3">
                            <Input 
                              data-testid={`input-receive-cant-${rollo.id}`}
                              type="number"
                              min="0.001"
                              step="0.001"
                              disabled={!state.recibido}
                              value={state.cantidadRecibida}
                              onChange={e => handleCantidadChange(rollo.id, e.target.value)}
                              className={`h-8 ${hasDiff && state.recibido ? 'border-red-300 focus-visible:ring-red-500' : ''}`}
                            />
                          </td>
                          <td className="px-4 py-3">
                            <Input 
                              data-testid={`input-receive-nota-${rollo.id}`}
                              placeholder={hasDiff ? "Obligatorio (>10 chars)" : "Opcional"}
                              value={state.notaDiferencia}
                              onChange={e => handleNotaChange(rollo.id, e.target.value)}
                              className={`h-8 ${hasDiff && state.notaDiferencia.trim().length < 10 ? 'border-red-300 focus-visible:ring-red-500' : ''}`}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="px-6 py-4 border-t border-slate-100 flex-shrink-0 bg-slate-50/50">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={receiveMutation.isPending}>
            Cancelar
          </Button>
          <Button data-testid="btn-submit-receive" onClick={onSubmit} disabled={receiveMutation.isPending}>
            {receiveMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Confirmar Recepción
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
