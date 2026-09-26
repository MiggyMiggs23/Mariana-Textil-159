import { useEffect, useMemo, useState } from "react";
import { AlertCircle, Loader2 } from "lucide-react";
import {
  getGetCreditRefundOptionsQueryKey,
  useDevolverCreditoFisico,
  useGetCreditRefundOptions,
} from "@workspace/api-client-react";
import type { CreditRefundCandidate, CreditRefundRequest } from "@workspace/api-client-react";
import { formatNumber } from "@workspace/number-format";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { getApiErrorMessage } from "@/lib/api-error";

/** Activation requires a separate owner decision. It is deliberately not configurable at runtime. */
const CREDIT_REFUND_CLIENT_ENABLED = false;

function candidateKey(candidate: CreditRefundCandidate): string {
  return candidate.origen === "ABONO"
    ? `ABONO:${candidate.abonoId}`
    : `COBRO_RETENIDO:${candidate.cobroClave}`;
}

function candidateLabel(candidate: CreditRefundCandidate): string {
  if (candidate.origen === "ABONO") {
    return `Abono${candidate.folio != null ? ` · F-${candidate.folio}` : ""}${candidate.referencia ? ` · ${candidate.referencia}` : ""}`;
  }
  return `Cobro retenido${candidate.referencia ? ` · ${candidate.referencia}` : ""}`;
}

export function DevolucionCreditoInactivaDialog({
  open,
  onOpenChange,
  clienteId,
  clienteNombre,
  isAdmin,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clienteId: number;
  clienteNombre: string;
  isAdmin: boolean;
}) {
  const [candidateKeyValue, setCandidateKeyValue] = useState("");
  const [sessionIdValue, setSessionIdValue] = useState("");
  const [motivo, setMotivo] = useState("");
  const [reviewing, setReviewing] = useState(false);
  const [preparedPayload, setPreparedPayload] = useState<{
    id: number;
    data: CreditRefundRequest;
  } | null>(null);
  const [submitBlockedReason, setSubmitBlockedReason] = useState<string | null>(null);

  const optionsQuery = useGetCreditRefundOptions(clienteId, {
    query: {
      enabled: open && isAdmin && clienteId > 0,
      queryKey: getGetCreditRefundOptionsQueryKey(clienteId),
      retry: false,
    },
  });
  const refundMutation = useDevolverCreditoFisico();
  const selectedCandidate = optionsQuery.data?.candidatas.find(
    (candidate) => candidateKey(candidate) === candidateKeyValue,
  ) ?? null;
  const currentSessions = useMemo(
    () => selectedCandidate ? (optionsQuery.data?.sesiones ?? []) : [],
    [optionsQuery.data?.sesiones, selectedCandidate],
  );
  const selectedSession = currentSessions.find(
    (session) => String(session.id) === sessionIdValue,
  ) ?? null;

  useEffect(() => {
    if (!open) {
      setCandidateKeyValue("");
      setSessionIdValue("");
      setMotivo("");
      setReviewing(false);
      setPreparedPayload(null);
      setSubmitBlockedReason(null);
    }
  }, [open]);

  const resetPreparedAttempt = () => {
    setReviewing(false);
    setPreparedPayload(null);
    setSubmitBlockedReason(null);
  };

  const handleReview = () => {
    if (!selectedCandidate || !selectedSession || !motivo.trim()) return;
    const operacionClave = crypto.randomUUID();
    const payload: CreditRefundRequest = {
      operacionClave,
      origen: selectedCandidate.origen,
      ...(selectedCandidate.origen === "ABONO"
        ? { abonoId: selectedCandidate.abonoId! }
        : { cobroClave: selectedCandidate.cobroClave! }),
      importe: selectedCandidate.importe,
      sitioOrigenId: selectedSession.sitioOrigenId,
      sesionCajaId: selectedSession.id,
      motivo: motivo.trim(),
    };
    setPreparedPayload({ id: clienteId, data: payload });
    setReviewing(true);
  };

  const handleInactiveSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!CREDIT_REFUND_CLIENT_ENABLED) {
      setSubmitBlockedReason("No se envió nada: la activación E2 sigue pendiente.");
      return;
    }
    if (!preparedPayload) return;
    refundMutation.mutate(preparedPayload);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[95dvh] overflow-y-auto sm:max-w-xl">
        <form onSubmit={handleInactiveSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Devolución física de crédito</DialogTitle>
            <DialogDescription>
              Preparación administrativa de una devolución completa. No registra movimientos.
            </DialogDescription>
          </DialogHeader>

          <Alert className="border-amber-300 bg-amber-50 text-amber-950">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Función inactiva</AlertTitle>
            <AlertDescription>
              {optionsQuery.data?.motivoInactivo
                ?? "La API de opciones E2 puede seguir pendiente en este ambiente. No se puede confirmar ni enviar una devolución."}
            </AlertDescription>
          </Alert>

          <div className="rounded-lg border bg-muted/20 p-4 text-sm">
            <p className="text-xs text-muted-foreground">Cliente</p>
            <p className="font-semibold">{clienteNombre}</p>
          </div>

          {optionsQuery.isLoading ? (
            <div className="flex items-center justify-center gap-2 rounded-lg border border-dashed p-8 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Consultando opciones documentales…
            </div>
          ) : optionsQuery.isError ? (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Opciones E2 no disponibles</AlertTitle>
              <AlertDescription>
                {getApiErrorMessage(optionsQuery.error, "La API de opciones E2 sigue pendiente en este ambiente.")}
              </AlertDescription>
            </Alert>
          ) : (
            <>
              {optionsQuery.data?.advertencia && (
                <p className="rounded-lg border p-3 text-xs text-muted-foreground">
                  {optionsQuery.data.advertencia}
                </p>
              )}

              {(optionsQuery.data?.candidatas.length ?? 0) === 0 ? (
                <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                  No hay recepciones físicas documentadas para revisar. Esta lista vacía no declara elegibilidad ni saldo.
                </p>
              ) : (
                <div className="space-y-2">
                  <Label>Recepción documentada</Label>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={candidateKeyValue}
                    onChange={(event) => {
                      const value = event.target.value;
                      setCandidateKeyValue(value);
                      setSessionIdValue("");
                      resetPreparedAttempt();
                    }}
                    data-testid="refund-source-select"
                  >
                    <option value="">Selecciona abono o cobro retenido</option>
                    {optionsQuery.data?.candidatas.map((candidate) => (
                        <option key={candidateKey(candidate)} value={candidateKey(candidate)}>
                          {candidateLabel(candidate)} · {formatNumber(candidate.importe, { kind: "money" })}
                        </option>
                    ))}
                  </select>
                </div>
              )}

              {selectedCandidate && (
                <dl className="grid gap-3 rounded-lg border p-4 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-xs text-muted-foreground">Sitio donde se recibió</dt>
                    <dd className="font-semibold">{selectedCandidate.sitioNombre}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Importe completo</dt>
                    <dd>
                      <Input
                        value={formatNumber(selectedCandidate.importe, { kind: "money" })}
                        readOnly
                        aria-readonly="true"
                        className="mt-1 font-mono font-bold"
                        data-testid="devolucion-importe-readonly"
                      />
                    </dd>
                  </div>
                </dl>
              )}

              {selectedCandidate && (
                <div className="space-y-2">
                  <Label>Caja actual de salida</Label>
                  {currentSessions.length === 0 ? (
                    <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
                      No hay una sesión ABIERTA de hoy en el sitio permitido para la salida.
                    </p>
                  ) : (
                    <select
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={sessionIdValue}
                      onChange={(event) => {
                        const value = event.target.value;
                        setSessionIdValue(value);
                        resetPreparedAttempt();
                      }}
                      data-testid="refund-session-select"
                    >
                      <option value="">Selecciona la sesión ABIERTA de hoy</option>
                      {currentSessions.map((session) => (
                          <option key={session.id} value={String(session.id)}>
                            {session.sitioNombre} · Sesión #{session.id} · ABIERTA hoy
                          </option>
                      ))}
                    </select>
                  )}
                </div>
              )}

              {selectedCandidate && selectedSession && !reviewing && (
                <div className="space-y-2">
                  <Label htmlFor="devolucion-motivo">Motivo obligatorio</Label>
                  <Textarea
                    id="devolucion-motivo"
                    value={motivo}
                    onChange={(event) => {
                      setMotivo(event.target.value);
                      setPreparedPayload(null);
                    }}
                    maxLength={500}
                    placeholder="Explica por qué se devolvería el dinero al cliente"
                  />
                  <p className="text-right text-xs text-muted-foreground">{motivo.trim().length}/500</p>
                </div>
              )}

              {reviewing && preparedPayload && (
                <div
                  className="space-y-3 rounded-lg border p-4"
                  data-testid="devolucion-revision"
                  data-prepared-payload={JSON.stringify(preparedPayload)}
                >
                  <h3 className="font-bold">Revisión final</h3>
                  <dl className="grid gap-2 text-sm">
                    <div><dt className="inline text-muted-foreground">Origen: </dt><dd className="inline">{candidateLabel(selectedCandidate!)} · recibido en {selectedCandidate!.sitioNombre}</dd></div>
                    <div><dt className="inline text-muted-foreground">Caja actual: </dt><dd className="inline">{selectedSession!.sitioNombre} · Sesión #{preparedPayload.data.sesionCajaId}</dd></div>
                    <div><dt className="inline text-muted-foreground">Importe completo: </dt><dd className="inline font-mono">{formatNumber(preparedPayload.data.importe, { kind: "money" })}</dd></div>
                    <div><dt className="inline text-muted-foreground">Motivo: </dt><dd className="inline">{preparedPayload.data.motivo}</dd></div>
                    <div><dt className="inline text-muted-foreground">Clave del intento: </dt><dd className="inline break-all font-mono" data-testid="refund-operation-key">{preparedPayload.data.operacionClave}</dd></div>
                  </dl>
                  <p className="text-xs text-muted-foreground">
                    La recepción es una referencia documental; el servidor deberá validar que siga completamente sin aplicar. El corte original nunca se modifica.
                  </p>
                </div>
              )}
            </>
          )}

          {submitBlockedReason && (
            <p role="alert" className="text-sm font-semibold text-destructive">{submitBlockedReason}</p>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => reviewing ? resetPreparedAttempt() : onOpenChange(false)}>
              {reviewing ? "Volver" : "Cerrar"}
            </Button>
            {!reviewing ? (
              <Button
                type="button"
                onClick={handleReview}
                disabled={!selectedCandidate || !selectedSession || !motivo.trim()}
                data-testid="refund-review-button"
              >
                Revisar devolución
              </Button>
            ) : (
              <Button type="submit" disabled title="Inactiva mientras permanezca la guarda E1">
                Confirmar devolución (inactiva)
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}