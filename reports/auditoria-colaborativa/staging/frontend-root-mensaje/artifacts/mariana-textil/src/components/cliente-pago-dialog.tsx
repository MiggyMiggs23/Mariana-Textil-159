import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/money-input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Wallet, ArrowRight, CheckCircle2, ChevronLeft } from "lucide-react";
import {
  useCreateClientePago,
  useCreateSolicitudPagoDirigido,
  usePreviewClientePago,
  type ClientePago,
  type ClientePagoPreview,
  type E3CollectionPreview,
  type E3Receipt,
  type E3CollectionInput,
  useGetCajaAbonoE3Context,
  getGetCajaAbonoE3ContextQueryKey,
  useGetCurrentUser,
  getGetCurrentUserQueryKey,
} from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { requestAppSound } from "@/components/notification-audio-controller";
import { getApiErrorMessage } from "@/lib/api-error";
import { formatAccountDestination, formatNumber } from "@workspace/number-format";
import {
  buildMexicoCityEffectiveDate,
  todayInMexicoCity,
} from "@/lib/fecha-efectiva";
import { format } from "date-fns";
import { CreditEvidenceFields, useCreditEvidenceDraft } from "@/components/credit-evidence-fields";
import { useQueryClient } from "@tanstack/react-query";
import { E3_ENABLED } from "@/lib/e3-feature-flags";
import { useE3AbonosPreview, useE3AbonosConfirm } from "@/hooks/use-e3";
import { Link } from "wouter";
import { hasPermission, Modules } from "@/lib/permisos";
import { useLocationScope } from "@/lib/location-scope";
import { useObtenerSesionCajaActual, getObtenerSesionCajaActualQueryKey } from "@workspace/api-client-react";

type Step = "form" | "preview" | "success";

// Temporal en E1: revisar este default al liberar efectivo en E2 + E3.
// No restaurar efectivo automáticamente sin revisar la captura habilitada.
const DEFAULT_CREDIT_PAYMENT_METHOD = "TRANSFERENCIA" as const;

export interface ClientePagoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clienteId: number;
  saldoActual?: string;
  defaultAmount?: string;
  onSuccess?: () => void;
  origen?: "CAJA" | "CLIENTE";
}

export function ClientePagoDialog({
  open,
  onOpenChange,
  clienteId,
  saldoActual,
  defaultAmount,
  onSuccess,
  origen = "CLIENTE"
}: ClientePagoDialogProps) {
  const evidence = useCreditEvidenceDraft();
  const queryClient = useQueryClient();
  const [step, setStep] = useState<Step>("form");
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"EFECTIVO" | "TRANSFERENCIA" | "FACTURADO">(DEFAULT_CREDIT_PAYMENT_METHOD);
  const [destinationAccount, setDestinationAccount] = useState<"CAJA_FISICA" | "CUENTA_FISCAL" | "CUENTA_NO_FISCAL" | "">("");
  const [reference, setReference] = useState("");
  const [paymentNotes, setPaymentNotes] = useState("");
  const [effectiveDate, setEffectiveDate] = useState("");
  const [mode, setMode] = useState<"FIFO" | "DIRIGIDO">("FIFO");
  const [selectedMovementId, setSelectedMovementId] = useState<number | null>(null);
  const [motivo, setMotivo] = useState("");

  const [e3OperacionClave, setE3OperacionClave] = useState<string>(() => crypto.randomUUID());

  const [previewData, setPreviewData] = useState<ClientePagoPreview | null>(null);
  const [realResult, setRealResult] = useState<ClientePago | null>(null);
  const previewExceso = previewData?.saldoAFavor ?? "0.00";
  const resultWithFavor = realResult as (ClientePago & {
    saldoAFavorGenerado?: string;
  }) | null;
  const excedenteGenerado = resultWithFavor?.saldoAFavorGenerado ?? resultWithFavor?.saldoAFavor ?? "0.00";
  const saldoAFavorResultante = resultWithFavor?.saldoAFavor ?? "0.00";

  const { toast } = useToast();
  const previewPayment = usePreviewClientePago();
  const createPayment = useCreateClientePago();
  const createDirectedPayment = useCreateSolicitudPagoDirigido();

  const e3PreviewMutation = useE3AbonosPreview();
  const e3ConfirmMutation = useE3AbonosConfirm();
  const [e3PreviewToken, setE3PreviewToken] = useState<string | null>(null);
  const [e3PreviewResult, setE3PreviewResult] = useState<E3CollectionPreview | null>(null);
  const [e3Receipt, setE3Receipt] = useState<E3Receipt | null>(null);
  const [e3Uncertain, setE3Uncertain] = useState(false);
  const [e3Intent, setE3Intent] = useState<E3CollectionInput | null>(null);

  const { selectedLocationId } = useLocationScope();
  const { data: e3Context, error: e3ContextError } = useGetCajaAbonoE3Context(
    { sitioId: selectedLocationId ?? undefined },
    { query: { queryKey: getGetCajaAbonoE3ContextQueryKey({ sitioId: selectedLocationId ?? undefined }), enabled: E3_ENABLED && origen === "CAJA" && open, staleTime: 0, refetchOnMount: "always", refetchInterval: 15000 } }
  );
  const e3Site = e3Context?.sitios.find(site => site.id === selectedLocationId) ?? (e3Context?.sitios.length === 1 ? e3Context.sitios[0] : undefined);
  const e3Session = e3Site?.sesiones.length === 1 ? e3Site.sesiones[0] : undefined;

  const isE3Flow = E3_ENABLED && origen === "CAJA";
  const { data: e3User } = useGetCurrentUser({ query: { queryKey: getGetCurrentUserQueryKey(), enabled: isE3Flow } });
  const recoveryKey = `e3-pending-caja:${e3User?.id ?? "unknown"}:${clienteId}`;

  // Reset form when modal opens/closes
  useEffect(() => {
    if (open) {
      evidence.reset();
      setStep("form");
      setAmount(defaultAmount || "");
      setPaymentMethod(DEFAULT_CREDIT_PAYMENT_METHOD);
      setDestinationAccount("");
      setReference("");
      setPaymentNotes("");
      setMode("FIFO");
      setSelectedMovementId(null);
      setMotivo("");
      setPreviewData(null);
      setRealResult(null);

      setEffectiveDate(todayInMexicoCity());
      setE3PreviewToken(null);
      setE3PreviewResult(null);
      setE3Receipt(null);
      setE3Uncertain(false);
      setE3Intent(null);
      setE3OperacionClave(crypto.randomUUID());
      if (isE3Flow && e3User?.id) {
        try {
          const saved = sessionStorage.getItem(recoveryKey);
          if (saved) {
            const pending = JSON.parse(saved) as { input: E3CollectionInput; preview: E3CollectionPreview };
            if (pending.input.clienteId !== clienteId || !pending.preview.previewToken || !pending.input.operacionClave) throw new Error("Registro de recuperación inválido");
            setE3Intent(pending.input);
            setE3PreviewResult(pending.preview);
            setE3PreviewToken(pending.preview.previewToken);
            setE3OperacionClave(pending.input.operacionClave);
            setAmount(String(pending.input.importeCentavos / 100));
            setPaymentMethod(pending.input.formaPago);
            setDestinationAccount(pending.input.cuentaDestino);
            setStep("preview");
            setE3Uncertain(true);
          }
        } catch (error) {
          toast({ title: "No se pudo recuperar la operación", description: getApiErrorMessage(error), variant: "destructive" });
        }
      }
    }
  }, [open, defaultAmount, clienteId, e3User?.id]);

  // Effect to reset destination account when payment method changes
  useEffect(() => {
    if (paymentMethod === "EFECTIVO") {
      setDestinationAccount("CAJA_FISICA");
    } else if (paymentMethod === "FACTURADO") {
      setDestinationAccount("CUENTA_FISCAL");
    } else if (paymentMethod === "TRANSFERENCIA") {
      if (destinationAccount === "CAJA_FISICA") {
        setDestinationAccount(""); // Force user to choose
      }
    }
    // Invalidate preview if any field changes while we are on preview step (actually handled by input onChange, but this is a safeguard)
  }, [paymentMethod]);

  const handleInputChange = () => {
    if (isE3Flow) {
      setE3PreviewResult(null);
      setE3PreviewToken(null);
      setE3OperacionClave(crypto.randomUUID());
    }
    if (step === "preview") {
      setStep("form");
      setPreviewData(null);
      setE3PreviewResult(null);
      setE3PreviewToken(null);
      setE3OperacionClave(crypto.randomUUID());
    }
  };

  const handlePreview = () => {
    if (!isE3Flow && evidence.problem(paymentMethod)) {
      toast({ title: "Origen requerido", description: evidence.problem(paymentMethod)!, variant: "destructive" });
      return;
    }
    if (!amount || Number(amount) <= 0) {
      toast({ title: "Importe inválido", description: "El importe debe ser mayor a cero.", variant: "destructive" });
      return;
    }
    if (!destinationAccount) {
      toast({ title: "Cuenta destino requerida", description: "Selecciona una cuenta destino.", variant: "destructive" });
      return;
    }

    if (isE3Flow) {
      if (mode === "DIRIGIDO") {
        toast({ title: "No disponible", description: "Pago dirigido está deshabilitado en E3.", variant: "destructive" });
        return;
      }
      if (!e3Site || !e3Session || e3ContextError) {
        toast({ title: "Caja abierta requerida", description: "Selecciona un sitio con una única sesión abierta; actualiza si no aparece.", variant: "destructive" });
        return;
      }
      const isTransfer = paymentMethod === "TRANSFERENCIA";

      e3PreviewMutation.mutate({
        data: {
          clienteId,
          importeCentavos: Math.round(Number(amount) * 100),
          formaPago: isTransfer ? "TRANSFERENCIA" : "EFECTIVO",
           cuentaDestino: isTransfer && destinationAccount !== "CAJA_FISICA" ? destinationAccount : "CAJA_FISICA",
           sitioId: e3Site.id,
           sesionCajaId: e3Session.id,
          operacionClave: e3OperacionClave,
           motivo: [reference.trim(), paymentNotes.trim()].filter(Boolean).join(" · ") || undefined,
        }
      }, {
        onSuccess: (data, variables) => {
          setE3Intent(variables.data);
          setE3PreviewResult(data);
          setE3PreviewToken(data.previewToken);
          setStep("preview");
        },
        onError: (error) => {
          toast({
            title: "Error al previsualizar",
            description: getApiErrorMessage(error, "Verifica el importe e intenta de nuevo."),
            variant: "destructive"
          });
        }
      });
      return;
    }

    const fechaEfectiva = buildMexicoCityEffectiveDate(effectiveDate);
    previewPayment.mutate(
      { id: clienteId, data: { importe: Number(amount), fechaEfectiva } },
      {
        onSuccess: (data) => {
          setPreviewData(data);
          setStep("preview");
        },
        onError: (error) => {
          toast({
            title: "Error al previsualizar",
            description: getApiErrorMessage(error, "Verifica el importe e intenta de nuevo."),
            variant: "destructive"
          });
        }
      }
    );
  };

  const submitPayment = () => {
    if (isE3Flow) {
       if (!e3PreviewToken || !e3Intent || e3ConfirmMutation.isPending) return;
       if (!e3User?.id) return;
       try {
         sessionStorage.setItem(recoveryKey, JSON.stringify({ input: e3Intent, preview: e3PreviewResult }));
       } catch {
         toast({ title: "No se puede conservar la operación", description: "Habilita el almacenamiento de sesión antes de cobrar; no se ha enviado la confirmación.", variant: "destructive" });
         return;
       }
       setE3Uncertain(true);
      const isTransfer = paymentMethod === "TRANSFERENCIA";
      e3ConfirmMutation.mutate({
        data: {
          ...e3Intent,
          previewToken: e3PreviewToken,
        }
      }, {
        onSuccess: (data) => {
          sessionStorage.removeItem(recoveryKey);
           setE3Uncertain(false);
          setE3Receipt(data.recibo);
          setStep("success");
           requestAppSound("PAGO", `payment:e3:${data.recibo.movimientoId}`);
          queryClient.invalidateQueries({ predicate: query => typeof query.queryKey[0] === "string" && query.queryKey[0].startsWith("/api/clientes") });
          onSuccess?.();
        },
        onError: (error) => {
           if ((error as { status?: number; response?: { status?: number } })?.status === 409 || (error as { response?: { status?: number } })?.response?.status === 409) {
              setE3Uncertain(false);
              sessionStorage.removeItem(recoveryKey);
              setE3PreviewToken(null);
              setE3PreviewResult(null);
              setStep("form");
          }
          toast({ title: "Error al confirmar", description: getApiErrorMessage(error, "Intenta de nuevo"), variant: "destructive" });
        }
      });
      return;
    }

    if (!destinationAccount || evidence.problem(paymentMethod)) return;
    const fechaEfectiva = buildMexicoCityEffectiveDate(effectiveDate);
    const metadata = evidence.build(mode === "DIRIGIDO" ? "ABONO_DIRIGIDO" : "ABONO_ORDINARIO",
      { clienteId, amount, paymentMethod, destinationAccount, reference, paymentNotes, fechaEfectiva, selectedMovementId, motivo }, paymentMethod);
    const accepted = () => {
      evidence.accepted();
      queryClient.invalidateQueries({ predicate: query => typeof query.queryKey[0] === "string" && (query.queryKey[0].startsWith("/api/clientes") || query.queryKey[0].startsWith("/api/pagos-dirigidos")) });
      onSuccess?.();
    };
    if (mode === "DIRIGIDO") {
      if (!selectedMovementId || motivo.trim().length < 10) return;
      createDirectedPayment.mutate({
        data: {
          ...metadata,
          tipo: "CLIENTE", entidadId: clienteId, documentoMovimientoId: selectedMovementId,
          importe: Number(amount), formaPago: paymentMethod, cuentaDestino: destinationAccount,
          referencia: reference || undefined, notas: paymentNotes || undefined,
          fechaEfectiva: fechaEfectiva ?? undefined,
          motivo: motivo.trim(),
        },
      }, {
        onSuccess: (data) => { setRealResult(data as unknown as ClientePago); setStep("success"); accepted(); },
        onError: (error) => toast({ title: "Error al solicitar pago dirigido", description: getApiErrorMessage(error, "Intenta de nuevo"), variant: "destructive" }),
      });
      return;
    }

    createPayment.mutate(
      {
        id: clienteId,
        data: {
          ...metadata,
          importe: Number(amount),
          formaPago: paymentMethod,
          cuentaDestino: destinationAccount as "CAJA_FISICA" | "CUENTA_FISCAL" | "CUENTA_NO_FISCAL",
          referencia: reference || null,
          notas: paymentNotes || null,
          fechaEfectiva,
        }
      },
      {
        onSuccess: (data) => {
          setRealResult(data);
          setStep("success");
           requestAppSound("PAGO", `payment:customer:${data.id}`);
          accepted();
        },
        onError: (error) => {
          toast({
            title: "Error al registrar pago",
            description: getApiErrorMessage(error, "Intenta de nuevo"),
            variant: "destructive"
          });
        }
      }
    );
  };

  const isFormValid = isE3Flow
    ? Number(amount) > 0 && !!e3Session && destinationAccount !== ""
    : Number(amount) > 0 && destinationAccount !== "" && !evidence.problem(paymentMethod);
  const isSubmitting = createPayment.isPending || createDirectedPayment.isPending || e3ConfirmMutation.isPending;

  if (E3_ENABLED && origen === "CLIENTE") return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent><DialogHeader><DialogTitle>Captura de abonos</DialogTitle><DialogDescription>
      El dinero recibido ahora se registra desde Caja con una sesión abierta. Para pagos recibidos antes, usa Recaptura Histórica en este cliente con el permiso correspondiente.
    </DialogDescription></DialogHeader><Button onClick={() => onOpenChange(false)}>Entendido</Button></DialogContent>
  </Dialog>;

  return (
    <Dialog open={open} onOpenChange={(val) => {
      if (isSubmitting || e3Uncertain) return;
      if (step === "success" || !val) {
        onOpenChange(val);
      }
    }}>
      <DialogContent className="sm:max-w-xl p-0 overflow-hidden">
        {/* Green identifies a confirmed abono; form and preview headers remain neutral. */}
        <DialogHeader className={`p-6 pb-6 ${step === "success" ? "bg-emerald-600 text-white" : "bg-muted text-foreground"}`}>
          <DialogTitle className="text-xl flex items-center gap-2">
            {step === "success" ? <CheckCircle2 className="h-5 w-5" /> : <Wallet className="h-5 w-5" />}
            {step === "form" ? "Registrar Abono" : step === "preview" ? "Vista Previa de Aplicación" : "Abono Registrado"}
          </DialogTitle>
          <DialogDescription className={`mt-2 ${step === "success" ? "text-white/80" : "text-muted-foreground"}`}>
            {step === "form"
              ? (saldoActual ? `El abono se descontará del saldo total de ${formatNumber(saldoActual, { kind: "money" })} aplicando primero a las notas más antiguas.` : "El abono se aplicará a las notas más antiguas de manera automática (FIFO).")
              : step === "preview"
              ? "Revisa cómo se repartirá el importe antes de confirmar."
              : "El abono se registró exitosamente."
            }
          </DialogDescription>
        </DialogHeader>

        {step === "form" && (
          <div className="space-y-5 p-6 bg-secondary/10">
            {!isE3Flow && <CreditEvidenceFields draft={evidence} kind="payment" medium={paymentMethod} />}
            {!isE3Flow && (
              <div className="space-y-2">
                <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Aplicación</Label>
                <Select value={mode} onValueChange={(value: "FIFO" | "DIRIGIDO") => { setMode(value); setSelectedMovementId(null); }}>
                  <SelectTrigger className="h-12 bg-white border-2" data-testid="select-cliente-payment-mode"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="FIFO">Normal (FIFO)</SelectItem><SelectItem value="DIRIGIDO">Pago dirigido</SelectItem></SelectContent>
                </Select>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2 col-span-2">
                <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Importe a abonar</Label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-bold text-xl">$</span>
                  <MoneyInput
                    value={amount}
                    onValueChange={(value) => { setAmount(value); handleInputChange(); }}
                    className="pl-9 h-14 text-2xl font-black bg-white border-2 focus-visible:ring-0 focus-visible:border-primary"
                    autoFocus
                    data-testid="cliente-payment-amount"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Forma de Pago</Label>
                <Select
                  value={paymentMethod}
                  onValueChange={(value) => {
                    if (value === "EFECTIVO" || value === "TRANSFERENCIA" || value === "FACTURADO") {
                      setPaymentMethod(value);
                      handleInputChange();
                    }
                  }}
                >
                  <SelectTrigger className="h-12 bg-white border-2" data-testid="e3-payment-method">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {!isE3Flow && <SelectItem value="EFECTIVO" disabled={evidence.nature !== "CORRECCION_CONTABLE"} className="font-medium py-3">Efectivo (captura física deshabilitada)</SelectItem>}
                    {isE3Flow && <SelectItem value="EFECTIVO" className="font-medium py-3">Efectivo</SelectItem>}
                    <SelectItem value="TRANSFERENCIA" className="font-medium py-3">Transferencia</SelectItem>
                    {!isE3Flow && <SelectItem value="FACTURADO" className="font-medium py-3">Facturado</SelectItem>}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Cuenta Destino</Label>
                {paymentMethod === "EFECTIVO" || paymentMethod === "FACTURADO" ? (
                  <div className="h-12 flex items-center px-3 bg-muted/50 border-2 rounded-md text-muted-foreground font-medium">
                    {formatAccountDestination(paymentMethod === "EFECTIVO" ? "CAJA_FISICA" : "CUENTA_FISCAL")}
                  </div>
                ) : (
                  <Select
                    value={destinationAccount}
                    onValueChange={(value) => {
                      if (value === "CUENTA_FISCAL" || value === "CUENTA_NO_FISCAL") {
                        setDestinationAccount(value);
                        handleInputChange();
                      }
                    }}
                  >
                    <SelectTrigger className="h-12 bg-white border-2" data-testid="e3-payment-account">
                      <SelectValue placeholder="Selecciona..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CUENTA_NO_FISCAL" className="font-medium py-3">{formatAccountDestination("CUENTA_NO_FISCAL")}</SelectItem>
                      <SelectItem value="CUENTA_FISCAL" className="font-medium py-3">{formatAccountDestination("CUENTA_FISCAL")}</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Referencia (Opcional)</Label>
                <Input
                  value={reference}
                  onChange={(e) => { setReference(e.target.value); handleInputChange(); }}
                  placeholder={paymentMethod === "TRANSFERENCIA" ? "Ej. Terminación 4567" : "Ej. Recibo manual 123"}
                  className="h-12 bg-white border-2"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Fecha Efectiva</Label>
                <div className="relative">
                  <Input
                    type="date"
                    value={effectiveDate}
                    onChange={(e) => { setEffectiveDate(e.target.value); handleInputChange(); }}
                    className="h-12 bg-white border-2 block w-full text-left font-medium text-sidebar"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Notas (Opcional)</Label>
              <Textarea
                value={paymentNotes}
                onChange={(e) => { setPaymentNotes(e.target.value); handleInputChange(); }}
                placeholder="Observaciones sobre el pago..."
                rows={2}
                className="bg-white border-2 resize-none"
              />
            </div>
          </div>
        )}

        {step === "preview" && ((!isE3Flow && previewData) || (isE3Flow && e3PreviewResult)) && (
          <div className="p-6 bg-secondary/10 space-y-6 animate-in fade-in slide-in-from-right-2 max-h-[60vh] overflow-y-auto">
            <div className="bg-white border rounded-xl shadow-sm p-4 text-center">
              <p className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-1">Importe a Aplicar</p>
              <p className="text-3xl font-black text-sidebar tabular-nums">
                {isE3Flow && e3PreviewResult ? formatNumber(e3PreviewResult.importeCentavos / 100, { kind: "money" }) : formatNumber(previewData!.monto, { kind: "money" })}
              </p>
            </div>

            {isE3Flow && e3PreviewResult ? (
              <div className="space-y-4">
                {/* Amber means this is pending preview information, not recorded money. */}
                <div className="bg-amber-50 p-4 border border-amber-200 rounded-lg text-center">
                  <h4 className="font-bold text-amber-800">Vista previa de abono ordinario</h4>
                  <p className="text-xs text-amber-700 font-medium">Aún no se ha registrado dinero. Al confirmar se aplicará FIFO y el remanente quedará a favor.</p>
                </div>
                {e3PreviewResult.asignaciones.length > 0 && (
                  <div className="space-y-3">
                    <h4 className="font-bold text-sidebar border-b pb-2">Reparto de abono (FIFO) proyectado</h4>
                    <div className="space-y-2">
                      {e3PreviewResult.asignaciones.map((asig) => (
                        <div key={asig.movimientoVentaId} className="w-full text-left bg-white p-3 rounded-lg border shadow-sm flex items-center justify-between">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                               {/* Primary plus underline identifies a navigable folio, never a payment state. */}
                               {asig.ticketId && asig.folio && (["ADMIN", "CONTADOR", "SISTEMAS"].includes(e3User?.rol ?? "") || [Modules.COBROS_PAGOS, Modules.POS, Modules.SALIDAS].some(module => hasPermission(e3User, module, "ver"))) ? <Link className="font-black text-sm text-primary underline" href={`/tickets/${asig.ticketId}`}>#{asig.folio}</Link> : <span className="font-black text-sm text-sidebar">#{asig.folio || asig.ticketId || "Nota"}</span>}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              Saldo original: <span className="font-medium line-through decoration-muted-foreground/50">{formatNumber(asig.saldoAntesCentavos / 100, { kind: "money" })}</span> → <span className="font-bold text-sidebar">{formatNumber(asig.saldoDespuesCentavos / 100, { kind: "money" })}</span>
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-0.5">Proyectado</span>
                             <span className="font-black text-foreground tabular-nums">+{formatNumber(asig.aplicadoCentavos / 100, { kind: "money" })}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {e3PreviewResult.remanenteCentavos > 0 && (
                  /* Green identifies a positive balance in favor; the copy distinguishes projection from confirmation. */
                  <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <h4 className="font-bold text-emerald-800">A favor proyectado</h4>
                        <p className="text-xs text-emerald-600 font-medium">Quedará disponible al confirmar este abono ordinario.</p>
                      </div>
                      <div className="font-black text-emerald-700 tabular-nums text-xl">
                        {formatNumber(e3PreviewResult.remanenteCentavos / 100, { kind: "money" })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              // Original non-E3 preview code
              <>
                {previewData!.asignaciones.length > 0 ? (
                  <div className="space-y-3">
                    <h4 className="font-bold text-sidebar border-b pb-2">{mode === "FIFO" ? "Reparto de abono (FIFO)" : "Selecciona exactamente una nota"}</h4>
                    <div className="space-y-2">
                      {previewData!.asignaciones.map((asig) => (
                        <button type="button" key={asig.movimientoVentaId} disabled={mode === "FIFO"} onClick={() => setSelectedMovementId(asig.movimientoVentaId)} className={`w-full text-left bg-white p-3 rounded-lg border shadow-sm flex items-center justify-between ${mode === "DIRIGIDO" && selectedMovementId === asig.movimientoVentaId ? "ring-2 ring-primary" : ""}`}>
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-black text-sm text-sidebar">#{asig.folio || asig.ticketId || "Nota"}</span>
                              {/* Green means settled; amber means payment remains pending. */}
                              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${asig.resultado === "SALDADA" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                                {asig.resultado}
                              </span>
                            </div>
                            <div className="text-xs text-muted-foreground">
                              Saldo original: <span className="font-medium line-through decoration-muted-foreground/50">{formatNumber(asig.saldoAntes, { kind: "money" })}</span> → <span className="font-bold text-sidebar">{formatNumber(asig.saldoDespues, { kind: "money" })}</span>
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-0.5">Aplicado</span>
                            <span className="font-black text-foreground tabular-nums">+{formatNumber(asig.aplicado, { kind: "money" })}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  /* Amber means there is no currently applicable note, not a technical error. */
                  <div className="text-center py-6 bg-amber-50 rounded-lg border border-amber-200">
                    <p className="font-medium text-amber-700">No hay notas pendientes para aplicar saldo.</p>
                  </div>
                )}
                {mode === "DIRIGIDO" && (
                  <div className="space-y-2">
                    <Label>Motivo del pago dirigido (mínimo 10 caracteres)</Label>
                    <Textarea value={motivo} onChange={(event) => setMotivo(event.target.value)} data-testid="input-cliente-directed-reason" />
                  </div>
                )}

                {Number(previewExceso) > 0 && (
                  /* Green identifies a positive excess that becomes balance in favor. */
                  <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 space-y-3" data-testid="receipt-preview-excess">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <h4 className="font-bold text-emerald-800">Excedente recibido</h4>
                        <p className="text-xs text-emerald-600 font-medium">La parte que no se aplicó a una nota no se pierde.</p>
                      </div>
                      <div className="font-black text-emerald-700 tabular-nums text-xl" data-testid="text-preview-excess">
                        {formatNumber(previewExceso, { kind: "money" })}
                      </div>
                    </div>
                    <div className="flex items-center justify-between border-t border-emerald-200 pt-3 text-sm">
                      <span className="font-semibold text-emerald-800">Saldo a favor resultante</span>
                      <span className="font-black text-emerald-700 tabular-nums" data-testid="text-preview-resulting-favor">
                        {formatNumber(previewExceso, { kind: "money" })}
                      </span>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {step === "success" && ((!isE3Flow && realResult) || (isE3Flow && e3Receipt)) && (
          <div className="p-6 bg-secondary/10 space-y-6 animate-in zoom-in-95 max-h-[60vh] overflow-y-auto">
             {/* Green identifies a successfully recorded operation and its resulting receipt. */}
             <div className="bg-white border-2 border-emerald-500/20 rounded-xl shadow-sm p-6 text-center space-y-2">
                <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto mb-2" />
                  <h3 className="font-black text-xl text-sidebar">
                    {isE3Flow ? "Abono registrado exitosamente" : (mode === "DIRIGIDO" ? "Solicitud de pago dirigido registrada" : "Abono registrado exitosamente")}
                  </h3>
                  {isE3Flow && e3Receipt && <p className="text-emerald-700 text-sm font-bold mb-2">Folio Recibo: {e3User?.rol === "ADMIN" ? <Link className="underline" href={`/recibos-e3/${e3Receipt.folio}`}>{e3Receipt.folio}</Link> : e3Receipt.folio}</p>}
                 <p className="text-muted-foreground text-sm font-medium">Se registró {isE3Flow && e3Receipt ? formatNumber(e3Receipt.importeCentavos / 100, { kind: "money" }) : formatNumber(amount, { kind: "money" })} en la cuenta del cliente.</p>
                 {isE3Flow && <p className="text-xs text-muted-foreground mt-2">El recibo debe imprimirse desde la computadora conectada a la impresora de recibos.</p>}
             </div>

             {/* Non-E3 Success Resumen */}
             {!isE3Flow && realResult && realResult.asignaciones && realResult.asignaciones.length > 0 && (
               <div className="space-y-3">
                 <h4 className="font-bold text-sidebar text-sm uppercase tracking-wider">Resumen de aplicación</h4>
                 <div className="bg-white rounded-lg border shadow-sm divide-y">
                    {realResult.asignaciones.map((asig) => (
                       <div key={asig.movimientoVentaId} className="p-3 flex justify-between items-center text-sm">
                        <span className="font-bold text-sidebar">Nota #{asig.folio || asig.ticketId || ""}</span>
                        <div className="text-right">
                          <span className="font-medium text-muted-foreground mr-3 text-xs">{asig.resultado}</span>
                          <span className="font-black tabular-nums">{formatNumber(asig.aplicado, { kind: "money" })}</span>
                        </div>
                      </div>
                   ))}
                 </div>
               </div>
             )}

              {!isE3Flow && realResult && Number(excedenteGenerado) > 0 && (
                /* Green identifies confirmed positive excess and balance in favor. */
               <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 space-y-2 text-sm" data-testid="receipt-payment-excess">
                 <div className="flex justify-between items-center gap-3">
                   <span className="font-bold text-emerald-800">Excedente recibido</span>
                   <span className="font-black text-emerald-700 tabular-nums" data-testid="text-payment-excess">{formatNumber(excedenteGenerado, { kind: "money" })}</span>
                 </div>
                 <div className="flex justify-between items-center gap-3 border-t border-emerald-200 pt-2">
                   <span className="font-bold text-emerald-800">Saldo a favor resultante</span>
                   <span className="font-black text-emerald-700 tabular-nums" data-testid="text-payment-resulting-favor">{formatNumber(saldoAFavorResultante, { kind: "money" })}</span>
                 </div>
              </div>
            )}
          </div>
        )}

        <DialogFooter className="p-4 border-t bg-white flex flex-row items-center justify-between sm:justify-between w-full">
          {step === "form" && (
            <>
              <Button variant="ghost" onClick={() => onOpenChange(false)} className="font-bold text-muted-foreground">Cancelar</Button>
              <Button
                onClick={handlePreview}
                disabled={!isFormValid || previewPayment.isPending || e3PreviewMutation.isPending}
                data-testid="e3-preview"
                className="font-bold h-10 px-6"
              >
                {(previewPayment.isPending || e3PreviewMutation.isPending) ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                Vista Previa <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </>
          )}

          {step === "preview" && (
            <>
              {e3Uncertain && <p role="status">Confirmación sin respuesta definitiva: reintenta con esta misma operación antes de salir. No captures otro abono.</p>}
              <Button variant="ghost" disabled={isSubmitting || e3Uncertain} onClick={() => setStep("form")} className="font-bold text-muted-foreground">
                <ChevronLeft className="h-4 w-4 mr-2" /> Atrás
              </Button>
              <Button
                onClick={submitPayment}
                data-testid="e3-confirm"
                 disabled={isSubmitting || !isFormValid || (mode === "DIRIGIDO" && (!selectedMovementId || motivo.trim().length < 10))}
                className="font-bold h-10 px-8"
              >
                 {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                 {mode === "DIRIGIDO" ? "Enviar solicitud" : "Confirmar Abono"}
              </Button>
            </>
          )}

          {step === "success" && (
             <Button onClick={() => onOpenChange(false)} className="w-full font-bold h-12 text-md" variant="default">
               Cerrar
             </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
