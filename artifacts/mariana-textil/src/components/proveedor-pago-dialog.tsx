import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Wallet, ArrowRight, CheckCircle2, ChevronLeft } from "lucide-react";
import { usePreviewPagoProveedor, useRegistrarPagoProveedor, PreviewPagoProveedor, FormaPagoProveedor } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/api-error";
import { formatNumber } from "@workspace/number-format";

type Step = "form" | "preview" | "success";

interface ProveedorPagoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  proveedorId: number;
  saldoActual?: string;
  onSuccess?: () => void;
}

export function ProveedorPagoDialog({
  open,
  onOpenChange,
  proveedorId,
  saldoActual,
  onSuccess
}: ProveedorPagoDialogProps) {
  const [step, setStep] = useState<Step>("form");
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<FormaPagoProveedor>(FormaPagoProveedor.TRANSFERENCIA);
  const [reference, setReference] = useState("");
  const [paymentNotes, setPaymentNotes] = useState("");
  const [effectiveDate, setEffectiveDate] = useState("");

  const [previewData, setPreviewData] = useState<PreviewPagoProveedor | null>(null);
  const [realResult, setRealResult] = useState<any>(null);

  const { toast } = useToast();
  const previewPayment = usePreviewPagoProveedor();
  const createPayment = useRegistrarPagoProveedor();

  useEffect(() => {
    if (open) {
      setStep("form");
      setAmount("");
      setPaymentMethod(FormaPagoProveedor.TRANSFERENCIA);
      setReference("");
      setPaymentNotes("");
      setPreviewData(null);
      setRealResult(null);
      
      const today = new Date();
      const formatted = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      setEffectiveDate(formatted);
    }
  }, [open]);

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

    previewPayment.mutate(
      { id: proveedorId, data: { importe: Number(amount), formaPago: paymentMethod } },
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
    createPayment.mutate(
      {
        id: proveedorId,
        data: {
          importe: Number(amount),
          formaPago: paymentMethod,
          referencia: reference || null,
          notas: paymentNotes || null,
          fecha: effectiveDate ? `${effectiveDate}T12:00:00` : undefined,
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

  const isFormValid = Number(amount) > 0;

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
            {step === "form" ? "Registrar Pago Global a Proveedor" : step === "preview" ? "Vista Previa de Aplicación (FIFO)" : "Pago Registrado"}
          </DialogTitle>
          <DialogDescription className="text-white/70 mt-2">
            {step === "form" 
              ? (saldoActual ? `El pago se descontará de la deuda total de ${formatNumber(saldoActual, { kind: "money" })} aplicando primero a las compras más antiguas.` : "El pago se aplicará a las compras más antiguas de manera automática (FIFO).")
              : step === "preview"
              ? "Revisa cómo se repartirá el importe antes de confirmar."
              : "El pago al proveedor se aplicó exitosamente."
            }
          </DialogDescription>
        </DialogHeader>

        {step === "form" && (
          <div className="space-y-5 p-6 bg-secondary/10">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2 col-span-2">
                <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Importe a pagar</Label>
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
                <Select value={paymentMethod} onValueChange={(val: FormaPagoProveedor) => { setPaymentMethod(val); handleInputChange(); }}>
                  <SelectTrigger className="h-12 bg-white border-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={FormaPagoProveedor.EFECTIVO} className="font-medium py-3">Efectivo</SelectItem>
                    <SelectItem value={FormaPagoProveedor.TRANSFERENCIA} className="font-medium py-3">Transferencia</SelectItem>
                    <SelectItem value={FormaPagoProveedor.CHEQUE} className="font-medium py-3">Cheque</SelectItem>
                    <SelectItem value={FormaPagoProveedor.OTRO} className="font-medium py-3">Otro</SelectItem>
                  </SelectContent>
                </Select>
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

            <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
              <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Referencia (Opcional)</Label>
              <Input 
                value={reference} 
                onChange={(e) => { setReference(e.target.value); handleInputChange(); }} 
                placeholder="Ej. Terminación 4567, Banco..."
                className="h-12 bg-white border-2"
              />
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
              <p className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-1">Importe a Pagar</p>
              <p className="text-3xl font-black text-sidebar tabular-nums">{formatNumber(amount, { kind: "money" })}</p>
            </div>

            {previewData.asignaciones.length > 0 ? (
              <div className="space-y-3">
                <h4 className="font-bold text-sidebar border-b pb-2">Reparto de pago (FIFO)</h4>
                <div className="space-y-2">
                  {previewData.asignaciones.map((asig, idx) => (
                    <div key={idx} className="bg-white p-3 rounded-lg border shadow-sm flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-black text-sm text-sidebar">#{asig.folio || asig.entradaId || "Compra"}</span>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${asig.resultado === "SALDADA" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                            {asig.resultado}
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Deuda: <span className="font-medium line-through decoration-muted-foreground/50">{formatNumber(Math.abs(Number(asig.saldoAntes)), { kind: "money" })}</span> → <span className="font-bold text-sidebar">{formatNumber(Math.abs(Number(asig.saldoDespues)), { kind: "money" })}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-0.5">Aplicado</span>
                        <span className="font-black text-primary tabular-nums">+{formatNumber(asig.importe, { kind: "money" })}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-6 bg-amber-50 rounded-lg border border-amber-200">
                <p className="font-medium text-amber-700">No hay compras pendientes para aplicar este pago.</p>
              </div>
            )}

            {Number(previewData.saldoAFavor) > 0 && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-emerald-800">Saldo a Favor Generado</h4>
                  <p className="text-xs text-emerald-600 font-medium">Este pago excede la deuda actual del proveedor.</p>
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
                <h3 className="font-black text-xl text-sidebar">¡Pago registrado exitosamente!</h3>
                <p className="text-muted-foreground text-sm font-medium">Se aplicó {formatNumber(amount, { kind: "money" })} a la cuenta del proveedor.</p>
             </div>
             
             {realResult.aplicaciones && realResult.aplicaciones.length > 0 && (
               <div className="space-y-3">
                 <h4 className="font-bold text-sidebar text-sm uppercase tracking-wider">Resumen de aplicación</h4>
                 <div className="bg-white rounded-lg border shadow-sm divide-y">
                   {realResult.aplicaciones.map((asig: any, idx: number) => (
                      <div key={idx} className="p-3 flex justify-between items-center text-sm">
                        <span className="font-bold text-sidebar">Compra #{asig.folio || asig.entradaId || ""}</span>
                        <div className="text-right">
                          <span className="font-medium text-muted-foreground mr-3 text-xs">{asig.resultado}</span>
                          <span className="font-black tabular-nums">{formatNumber(asig.importe, { kind: "money" })}</span>
                        </div>
                      </div>
                   ))}
                 </div>
               </div>
             )}

            {Number(realResult.saldoDisponible) > 0 && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 flex justify-between items-center text-sm">
                <span className="font-bold text-emerald-800">Saldo a Favor Generado</span>
                <span className="font-black text-emerald-700">{formatNumber(realResult.saldoDisponible, { kind: "money" })}</span>
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
                Confirmar Pago
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
