import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Wallet, ArrowRight, CheckCircle2, ChevronLeft } from "lucide-react";
import {
  useCreateClientePago,
  usePreviewClientePago,
  type ClientePago,
  type ClientePagoPreview,
} from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/api-error";
import { formatNumber } from "@workspace/number-format";
import { format } from "date-fns";

type Step = "form" | "preview" | "success";

interface ClientePagoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clienteId: number;
  saldoActual?: string;
  onSuccess?: () => void;
}

export function ClientePagoDialog({
  open,
  onOpenChange,
  clienteId,
  saldoActual,
  onSuccess
}: ClientePagoDialogProps) {
  const [step, setStep] = useState<Step>("form");
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"EFECTIVO" | "TRANSFERENCIA">("EFECTIVO");
  const [destinationAccount, setDestinationAccount] = useState<"CAJA_FISICA" | "CUENTA_FISCAL" | "CUENTA_NO_FISCAL" | "">("CAJA_FISICA");
  const [reference, setReference] = useState("");
  const [paymentNotes, setPaymentNotes] = useState("");
  const [effectiveDate, setEffectiveDate] = useState("");

  const [previewData, setPreviewData] = useState<ClientePagoPreview | null>(null);
  const [realResult, setRealResult] = useState<ClientePago | null>(null);

  const { toast } = useToast();
  const previewPayment = usePreviewClientePago();
  const createPayment = useCreateClientePago();

  // Reset form when modal opens/closes
  useEffect(() => {
    if (open) {
      setStep("form");
      setAmount("");
      setPaymentMethod("EFECTIVO");
      setDestinationAccount("CAJA_FISICA");
      setReference("");
      setPaymentNotes("");
      setPreviewData(null);
      setRealResult(null);

      const today = new Date();
      const formatted = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      setEffectiveDate(formatted);
    }
  }, [open]);

  // Effect to reset destination account when payment method changes
  useEffect(() => {
    if (paymentMethod === "EFECTIVO") {
      setDestinationAccount("CAJA_FISICA");
    } else if (paymentMethod === "TRANSFERENCIA") {
      if (destinationAccount === "CAJA_FISICA") {
        setDestinationAccount(""); // Force user to choose
      }
    }
    // Invalidate preview if any field changes while we are on preview step (actually handled by input onChange, but this is a safeguard)
  }, [paymentMethod]);

  const handleInputChange = () => {
    if (step === "preview") {
      setStep("form");
      setPreviewData(null);
    }
  };

  const handlePreview = () => {
    if (!amount || Number(amount) <= 0) {
      toast({ title: "Importe inválido", description: "El importe debe ser mayor a cero.", variant: "destructive" });
      return;
    }
    if (!destinationAccount) {
      toast({ title: "Cuenta destino requerida", description: "Selecciona una cuenta destino.", variant: "destructive" });
      return;
    }

    previewPayment.mutate(
      { id: clienteId, data: { importe: Number(amount) } },
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
    if (!destinationAccount) return;

    createPayment.mutate(
      {
        id: clienteId,
        data: {
          importe: Number(amount),
          formaPago: paymentMethod,
          cuentaDestino: destinationAccount as "CAJA_FISICA" | "CUENTA_FISCAL" | "CUENTA_NO_FISCAL",
          referencia: reference || null,
          notas: paymentNotes || null,
          fechaEfectiva: effectiveDate || null,
        }
      },
      {
        onSuccess: (data) => {
          setRealResult(data);
          setStep("success");
          if (onSuccess) onSuccess();
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

  const isFormValid = Number(amount) > 0 && destinationAccount !== "";

  return (
    <Dialog open={open} onOpenChange={(val) => {
      if (step === "success" || !val) {
        onOpenChange(val);
      }
    }}>
      <DialogContent className="sm:max-w-xl p-0 overflow-hidden">
        <DialogHeader className={`p-6 text-white pb-6 ${step === "success" ? "bg-emerald-600" : "bg-sidebar"}`}>
          <DialogTitle className="text-xl flex items-center gap-2">
            {step === "success" ? <CheckCircle2 className="h-5 w-5" /> : <Wallet className="h-5 w-5" />}
            {step === "form" ? "Registrar Abono Global" : step === "preview" ? "Vista Previa de Aplicación (FIFO)" : "Abono Registrado"}
          </DialogTitle>
          <DialogDescription className="text-white/70 mt-2">
            {step === "form"
              ? (saldoActual ? `El abono se descontará del saldo total de ${formatNumber(saldoActual, { kind: "money" })} aplicando primero a las notas más antiguas.` : "El abono se aplicará a las notas más antiguas de manera automática (FIFO).")
              : step === "preview"
              ? "Revisa cómo se repartirá el importe antes de confirmar."
              : "El abono se aplicó exitosamente."
            }
          </DialogDescription>
        </DialogHeader>

        {step === "form" && (
          <div className="space-y-5 p-6 bg-secondary/10">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2 col-span-2">
                <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Importe a abonar</Label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-bold text-xl">$</span>
                  <Input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={amount}
                    onChange={(e) => { setAmount(e.target.value); handleInputChange(); }}
                    className="pl-9 h-14 text-2xl font-black bg-white border-2 focus-visible:ring-0 focus-visible:border-primary"
                    autoFocus
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Forma de Pago</Label>
                <Select
                  value={paymentMethod}
                  onValueChange={(value) => {
                    if (value === "EFECTIVO" || value === "TRANSFERENCIA") {
                      setPaymentMethod(value);
                      handleInputChange();
                    }
                  }}
                >
                  <SelectTrigger className="h-12 bg-white border-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="EFECTIVO" className="font-medium py-3">Efectivo</SelectItem>
                    <SelectItem value="TRANSFERENCIA" className="font-medium py-3">Transferencia</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Cuenta Destino</Label>
                {paymentMethod === "EFECTIVO" ? (
                  <div className="h-12 flex items-center px-3 bg-muted/50 border-2 rounded-md text-muted-foreground font-medium">
                    CAJA FISICA
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
                    <SelectTrigger className="h-12 bg-white border-2">
                      <SelectValue placeholder="Selecciona..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CUENTA_FISCAL" className="font-medium py-3">Cuenta Fiscal</SelectItem>
                      <SelectItem value="CUENTA_NO_FISCAL" className="font-medium py-3">Cuenta No Fiscal</SelectItem>
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

        {step === "preview" && previewData && (
          <div className="p-6 bg-secondary/10 space-y-6 animate-in fade-in slide-in-from-right-2 max-h-[60vh] overflow-y-auto">
            <div className="bg-white border rounded-xl shadow-sm p-4 text-center">
              <p className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-1">Importe a Aplicar</p>
              <p className="text-3xl font-black text-sidebar tabular-nums">{formatNumber(previewData.monto, { kind: "money" })}</p>
            </div>

            {previewData.asignaciones.length > 0 ? (
              <div className="space-y-3">
                <h4 className="font-bold text-sidebar border-b pb-2">Reparto de abono (FIFO)</h4>
                <div className="space-y-2">
                  {previewData.asignaciones.map((asig) => (
                    <div key={asig.movimientoVentaId} className="bg-white p-3 rounded-lg border shadow-sm flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-black text-sm text-sidebar">#{asig.folio || asig.ticketId || "Nota"}</span>
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
                        <span className="font-black text-primary tabular-nums">+{formatNumber(asig.aplicado, { kind: "money" })}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-6 bg-amber-50 rounded-lg border border-amber-200">
                <p className="font-medium text-amber-700">No hay notas pendientes para aplicar saldo.</p>
              </div>
            )}

            {Number(previewData.saldoAFavor) > 0 && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-emerald-800">Saldo a Favor Generado</h4>
                  <p className="text-xs text-emerald-600 font-medium">Este excedente quedará disponible en la cuenta del cliente.</p>
                </div>
                <div className="font-black text-emerald-700 tabular-nums text-xl">
                  {formatNumber(previewData.saldoAFavor, { kind: "money" })}
                </div>
              </div>
            )}
          </div>
        )}

        {step === "success" && realResult && (
          <div className="p-6 bg-secondary/10 space-y-6 animate-in zoom-in-95 max-h-[60vh] overflow-y-auto">
             <div className="bg-white border-2 border-emerald-500/20 rounded-xl shadow-sm p-6 text-center space-y-2">
                <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto mb-2" />
                 <h3 className="font-black text-xl text-sidebar">Abono registrado exitosamente</h3>
                <p className="text-muted-foreground text-sm font-medium">Se aplicó {formatNumber(amount, { kind: "money" })} a la cuenta del cliente.</p>
             </div>

             {realResult.asignaciones && realResult.asignaciones.length > 0 && (
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

             {Number(realResult.saldoAFavor) > 0 && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 flex justify-between items-center text-sm">
                <span className="font-bold text-emerald-800">Saldo a Favor Generado</span>
                 <span className="font-black text-emerald-700">{formatNumber(realResult.saldoAFavor, { kind: "money" })}</span>
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
                disabled={!isFormValid || previewPayment.isPending}
                className="font-bold h-10 px-6"
              >
                {previewPayment.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                Vista Previa <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </>
          )}

          {step === "preview" && (
            <>
              <Button variant="ghost" onClick={() => setStep("form")} className="font-bold text-muted-foreground">
                <ChevronLeft className="h-4 w-4 mr-2" /> Atrás
              </Button>
              <Button
                onClick={submitPayment}
                disabled={createPayment.isPending}
                className="font-bold h-10 px-8"
              >
                {createPayment.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Confirmar Abono
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
