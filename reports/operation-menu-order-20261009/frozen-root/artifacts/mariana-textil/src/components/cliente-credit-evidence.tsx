import { useRef, useState } from "react";
import {
  useGetClienteEvidenciaCredito, useAtribuirClienteCredito, useGetCurrentUser, useListLocations,
  getGetClienteEvidenciaCreditoQueryKey, getListLocationsQueryKey,
  type CreditMovementEvidence,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { CREDIT_ATTRIBUTION_ENABLED, creditNatureLabels, createCreditOperationDraft, prepareCreditAttribution } from "@/lib/credit-evidence";
import { hasPermission, Modules } from "@/lib/permisos";
import { getApiErrorMessage } from "@/lib/api-error";
import { useToast } from "@/hooks/use-toast";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export function ClienteCreditEvidence({ clienteId }: { clienteId: number }) {
  const { data: user } = useGetCurrentUser();
  const privileged = user?.rol === "ADMIN" || user?.rol === "SUPERVISOR";
  const canPrepare = privileged && hasPermission(user, Modules.CLIENTES_FINANZAS, "autorizar");
  const evidence = useGetClienteEvidenciaCredito(clienteId, { prepararAtribucion: privileged }, {
    query: { queryKey: getGetClienteEvidenciaCreditoQueryKey(clienteId, { prepararAtribucion: privileged }), enabled: !!user, staleTime: 0, refetchInterval: 30_000 },
  });
  const { data: locations } = useListLocations(undefined, { query: { queryKey: getListLocationsQueryKey(), enabled: canPrepare && user?.rol === "ADMIN" } });
  const mutation = useAtribuirClienteCredito();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [movement, setMovement] = useState<CreditMovementEvidence | null>(null);
  const [site, setSite] = useState("");
  const [proof, setProof] = useState("");
  const [reason, setReason] = useState("");
  const operation = useRef(createCreditOperationDraft());
  const enabled = CREDIT_ATTRIBUTION_ENABLED && evidence.data?.atribucionHabilitada === true && canPrepare;
  const sites = user?.rol === "ADMIN" ? (locations ?? []).filter(item => item.activa && item.tipo === "TIENDA") : user?.ubicacion ? [user.ubicacion] : [];
  const submit = () => {
    if (!enabled || !movement || !site || !proof.trim() || !reason.trim()) return;
    const intent = prepareCreditAttribution(movement, "", Number(site), proof, reason);
    const data = { ...intent, id: operation.current.keyFor("ATRIBUCION_HISTORICA", intent) };
    mutation.mutate({ clienteId, data }, {
      onSuccess: () => {
        operation.current.accepted();
        setMovement(null);
        queryClient.invalidateQueries({ predicate: query => typeof query.queryKey[0] === "string" && query.queryKey[0].startsWith("/api/clientes") });
      },
      onError: error => toast({ title: "No se pudo atribuir", description: getApiErrorMessage(error), variant: "destructive" }),
    });
  };
  return <Card className="mt-4">
    <CardHeader><CardTitle>Origen y evidencia de crédito</CardTitle></CardHeader>
    <CardContent className="space-y-3">
      {evidence.isLoading ? <p>Cargando evidencia…</p> : evidence.isError ? <p role="alert" className="text-destructive">{getApiErrorMessage(evidence.error, "No se pudo consultar la evidencia.")}</p> : <>
        {!evidence.data?.movimientos.length && <p className="text-sm text-muted-foreground">No hay evidencia visible en tu alcance.</p>}
        {evidence.data?.movimientos.map(item => <div key={`${item.movimientoId}:${item.movimientoCreatedAt}`} className="flex flex-wrap items-center justify-between gap-3 border-b pb-3 text-sm">
          <div>
            <p className="font-medium">Movimiento #{item.movimientoId} · {item.sitioEtiqueta}</p>
            <p>{item.naturalezaOriginal ? creditNatureLabels[item.naturalezaOriginal] : "Naturaleza histórica no determinada"}</p>
            <p className="text-xs text-muted-foreground">{item.movimientoCreatedAt}</p>
            {item.ultimaAtribucion && <p>Atribución separada: {item.ultimaAtribucion.evidencia} · {item.ultimaAtribucion.motivo}</p>}
          </div>
          {canPrepare && item.sitioOrigenOriginalId === null && <Button variant="outline" size="sm" onClick={() => {
            setMovement(item); setSite(""); setProof(""); setReason(""); operation.current.accepted();
          }}>Preparar atribución</Button>}
        </div>)}
      </>}
      <Dialog open={!!movement} onOpenChange={open => { if (!open) setMovement(null); }}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Preparación de atribución histórica</DialogTitle></DialogHeader>
          <p className="text-sm text-amber-800">Deshabilitada: requiere autorización futura del propietario. Esta preparación no guarda ni modifica el movimiento.</p>
          <Label>Identidad del movimiento</Label><Input readOnly value={movement?.movimientoId ?? ""} />
          <Label>Fecha exacta (incluye microsegundos)</Label><Input readOnly value={movement?.movimientoCreatedAt ?? ""} />
          <Label>Snapshot de identidad original</Label><Textarea readOnly value={movement ? JSON.stringify(movement.identidadSnapshot, null, 2) : ""} rows={5} />
          <Label>Atribución anterior</Label><Input readOnly value={movement?.ultimaAtribucion?.id ?? "Sin predecesor (raíz)"} />
          <Label>Sitio acreditado por la evidencia</Label>
          <Select value={site} onValueChange={setSite}><SelectTrigger><SelectValue placeholder="Selecciona…" /></SelectTrigger><SelectContent>{sites.map(item => <SelectItem key={item.id} value={String(item.id)}>{item.nombre}</SelectItem>)}</SelectContent></Select>
          <Label>Evidencia obligatoria</Label><Textarea value={proof} onChange={event => setProof(event.target.value)} />
          <Label>Motivo obligatorio</Label><Textarea value={reason} onChange={event => setReason(event.target.value)} />
          <Button disabled={!enabled || !site || !proof.trim() || !reason.trim() || mutation.isPending} onClick={submit}>Guardar atribución (deshabilitado)</Button>
        </DialogContent>
      </Dialog>
    </CardContent>
  </Card>;
}