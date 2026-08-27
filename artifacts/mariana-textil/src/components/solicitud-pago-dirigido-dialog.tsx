import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, CheckCircle2, AlertCircle, Info, HandCoins } from "lucide-react";
import {
  Role,
  SolicitudPagoDirigidoInputTipo,
  useCreateSolicitudPagoDirigido,
  useGetCurrentUser,
} from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/api-error";
import { formatNumber } from "@workspace/number-format";

export interface SolicitudPagoDirigidoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tipo: SolicitudPagoDirigidoInputTipo;
  entidadId: number;
  documentoMovimientoId: number;
  folio: number | string;
  saldoPendiente: string | number;
  onSuccess?: () => void;
}

export function SolicitudPagoDirigidoDialog({
  open,
  onOpenChange,
  tipo,
  entidadId,
  documentoMovimientoId,
  folio,
  saldoPendiente,
  onSuccess
}: SolicitudPagoDirigidoDialogProps) {
  const [step, setStep] = useState<"form" | "success">("form");
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("TRANSFERENCIA");
  const [destinationAccount, setDestinationAccount] = useState("");
  const [effectiveDate, setEffectiveDate] = useState("");
  const [reference, setReference] = useState("");
  const [paymentNotes, setPaymentNotes] = useState("");
  const [motivo, setMotivo] = useState("");
  const [resultState, setResultState] = useState("");

  const { toast } = useToast();
  const { data: currentUser } = useGetCurrentUser();
  const createSolicitud = useCreateSolicitudPagoDirigido();

  useEffect(() => {
    if (open) {
      setStep("form");
      setAmount(String(saldoPendiente));
      setPaymentMethod("TRANSFERENCIA");
      setDestinationAccount(tipo === SolicitudPagoDirigidoInputTipo.CLIENTE ? "CUENTA_FISCAL" : "");
      setReference("");
      setPaymentNotes("");
      setMotivo("");
      setResultState("");
      const today = new Date();
      setEffectiveDate(`${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`);
    }
  }, [open, saldoPendiente, tipo]);

  useEffect(() => {
    if (tipo !== SolicitudPagoDirigidoInputTipo.CLIENTE) return;
    setDestinationAccount(paymentMethod === "EFECTIVO" ? "CAJA_FISICA" : "CUENTA_FISCAL");
  }, [paymentMethod, tipo]);

  const handleSubmit = () => {
    if (motivo.trim().length < 10) {
      toast({ title: "Motivo insuficiente", description: "El motivo debe tener al menos 10 caracteres.", variant: "destructive" });
      return;
    }
    if (!amount || Number(amount) <= 0 || Number(amount) > Number(saldoPendiente)) {
      toast({ title: "Importe inválido", description: "El importe debe ser mayor a 0 y menor o igual al saldo pendiente.", variant: "destructive" });
      return;
    }
    if (tipo === SolicitudPagoDirigidoInputTipo.CLIENTE && paymentMethod === "TRANSFERENCIA" && !reference.trim()) {
      toast({ title: "Referencia requerida", description: "Captura la referencia de la transferencia.", variant: "destructive" });
      return;
    }

    createSolicitud.mutate(
      {
        data: {
          tipo,
          entidadId,
          documentoMovimientoId,
          importe: Number(amount),
          formaPago: paymentMethod,
          cuentaDestino: destinationAccount || undefined,
          fechaEfectiva: effectiveDate || undefined,
          referencia: reference || undefined,
          notas: paymentNotes || undefined,
          motivo: motivo.trim()
        }
      },
      {
        onSuccess: (data) => {
          setResultState(data.estado);
          setStep("success");
          if (onSuccess) onSuccess();
        },
        onError: (err) => {
          toast({
            title: "Error al registrar solicitud",
            description: getApiErrorMessage(err, "Revisa los datos e intenta de nuevo."),
            variant: "destructive"
          });
        }
      }
    );
  };

  const isFormValid =
    Number(amount) > 0 &&
    Number(amount) <= Number(saldoPendiente) &&
    motivo.trim().length >= 10 &&
    Boolean(paymentMethod) &&
    !(tipo === SolicitudPagoDirigidoInputTipo.CLIENTE && paymentMethod === "TRANSFERENCIA" && !reference.trim());

  return (
    <Dialog open={open} onOpenChange={(val) => {
      if (step === "success" || !val) {
        onOpenChange(val);
      }
    }}>
      <DialogContent className="sm:max-w-xl p-0 overflow-hidden">
        <DialogHeader className={`p-6 text-white pb-6 ${step === "success" ? (resultState === 'APROBADA' ? 'bg-emerald-600' : 'bg-blue-600') : "bg-sidebar"}`}>
          <DialogTitle className="text-xl flex items-center gap-2">
            {step === "success" ? <CheckCircle2 className="h-5 w-5" /> : <HandCoins className="h-5 w-5" />}
            {step === "form" ? "Pago Dirigido (Excepción FIFO)" : "Resultado de Solicitud"}
          </DialogTitle>
          <DialogDescription className="text-white/70 mt-2">
            {step === "form" 
              ? `Aplicar pago directamente al documento #${folio}, ignorando antigüedad.` 
              : "La operación se completó correctamente."}
          </DialogDescription>
        </DialogHeader>

        {step === "form" && (
          <div className="space-y-5 p-6 bg-secondary/10 max-h-[60vh] overflow-y-auto">
            <div className="bg-amber-50 border border-amber-200 text-amber-800 text-sm p-4 rounded-lg flex gap-3 items-start shadow-sm">
              <Info className="w-5 h-5 shrink-0 mt-0.5 text-amber-600" />
              <p>
                <strong>Excepción FIFO:</strong> Esta operación no sigue la regla de pagar las deudas más antiguas primero. 
                Requiere un motivo justificado para aplicarse específicamente a este documento.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2 col-span-2">
                <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  Importe a aplicar <span className="text-destructive">*</span>
                </Label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-bold text-xl">$</span>
                  <Input 
                    type="number" 
                    min="0.01" 
                    max={Number(saldoPendiente)}
                    step="0.01" 
                    value={amount} 
                    onChange={(e) => setAmount(e.target.value)} 
                    className="pl-9 h-12 text-xl font-black bg-white border-2 focus-visible:ring-0 focus-visible:border-primary"
                    autoFocus
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-medium">
                    Máx: {formatNumber(saldoPendiente, { kind: "money" })}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  Forma de Pago <span className="text-destructive">*</span>
                </Label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger className="h-12 bg-white border-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="EFECTIVO" className="font-medium py-3">Efectivo</SelectItem>
                    <SelectItem value="TRANSFERENCIA" className="font-medium py-3">Transferencia</SelectItem>
                    {tipo === SolicitudPagoDirigidoInputTipo.PROVEEDOR && (
                      <>
                        <SelectItem value="CHEQUE" className="font-medium py-3">Cheque</SelectItem>
                        <SelectItem value="OTRO" className="font-medium py-3">Otro</SelectItem>
                      </>
                    )}
                  </SelectContent>
                </Select>
              </div>

              {tipo === SolicitudPagoDirigidoInputTipo.CLIENTE && paymentMethod !== "EFECTIVO" ? (
                <div className="space-y-2">
                  <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Cuenta Destino</Label>
                  <Select value={destinationAccount} onValueChange={setDestinationAccount}>
                    <SelectTrigger className="h-12 bg-white border-2">
                      <SelectValue placeholder="Selecciona..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CUENTA_FISCAL" className="font-medium py-3">Cuenta Fiscal</SelectItem>
                      <SelectItem value="CUENTA_NO_FISCAL" className="font-medium py-3">Cuenta No Fiscal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              ) : tipo === SolicitudPagoDirigidoInputTipo.CLIENTE && paymentMethod === "EFECTIVO" ? (
                <div className="space-y-2">
                  <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Cuenta Destino</Label>
                  <div className="h-12 flex items-center px-3 bg-muted/50 border-2 rounded-md text-muted-foreground font-medium">
                    CAJA FISICA
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Fecha Efectiva</Label>
                  <Input 
                    type="date" 
                    value={effectiveDate} 
                    onChange={(e) => setEffectiveDate(e.target.value)} 
                    className="h-12 bg-white border-2 block w-full"
                  />
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  Referencia
                  {tipo === SolicitudPagoDirigidoInputTipo.CLIENTE && paymentMethod === "TRANSFERENCIA" ? " *" : ""}
                </Label>
                <Input 
                  value={reference} 
                  onChange={(e) => setReference(e.target.value)} 
                  placeholder="Ej. Terminación 4567"
                  className="h-12 bg-white border-2"
                />
              </div>

              {tipo === SolicitudPagoDirigidoInputTipo.CLIENTE && (
                <div className="space-y-2">
                  <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Fecha Efectiva</Label>
                  <Input 
                    type="date" 
                    value={effectiveDate} 
                    onChange={(e) => setEffectiveDate(e.target.value)} 
                    className="h-12 bg-white border-2 block w-full"
                  />
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Notas Adicionales</Label>
              <Textarea 
                value={paymentNotes} 
                onChange={(e) => setPaymentNotes(e.target.value)} 
                placeholder="Opcional..."
                rows={2}
                className="bg-white border-2 resize-none"
              />
            </div>

            <div className="space-y-2 pt-2 border-t">
              <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                Motivo de Excepción FIFO <span className="text-destructive">*</span>
              </Label>
              <Textarea 
                value={motivo} 
                onChange={(e) => setMotivo(e.target.value)} 
                placeholder="Explique detalladamente por qué este pago no debe seguir el orden FIFO (min. 10 caracteres)..."
                rows={3}
                className={`bg-white border-2 resize-none ${motivo.length > 0 && motivo.trim().length < 10 ? 'border-destructive focus-visible:ring-destructive' : ''}`}
              />
              {motivo.length > 0 && motivo.trim().length < 10 && (
                <p className="text-[10px] text-destructive font-bold">El motivo debe tener al menos 10 caracteres.</p>
              )}
            </div>
          </div>
        )}

        {step === "success" && (
          <div className="p-6 bg-secondary/10 space-y-6 text-center animate-in zoom-in-95">
            <div className="bg-white border rounded-xl shadow-sm p-8 text-center space-y-4">
              <div className={`mx-auto w-16 h-16 rounded-full flex items-center justify-center ${resultState === 'APROBADA' ? 'bg-emerald-100 text-emerald-600' : 'bg-blue-100 text-blue-600'}`}>
                {resultState === 'APROBADA' ? <CheckCircle2 className="h-8 w-8" /> : <AlertCircle className="h-8 w-8" />}
              </div>
              <h3 className="font-black text-2xl text-sidebar">
                {resultState === 'APROBADA' ? 'Pago Aplicado' : 'Solicitud Enviada'}
              </h3>
              <p className="text-muted-foreground font-medium max-w-sm mx-auto">
                {resultState === 'APROBADA' 
                  ? `El pago dirigido por ${formatNumber(amount, { kind: "money" })} ha sido aprobado y aplicado a la nota #${folio}.`
                  : `Tu solicitud de pago dirigido ha sido enviada y está pendiente de aprobación por un administrador.`}
              </p>
            </div>
          </div>
        )}

        <DialogFooter className="p-4 border-t bg-white flex flex-row items-center justify-between sm:justify-between w-full">
          {step === "form" && (
            <>
              <Button variant="ghost" onClick={() => onOpenChange(false)} className="font-bold text-muted-foreground">Cancelar</Button>
              <Button 
                onClick={handleSubmit} 
                disabled={!isFormValid || createSolicitud.isPending}
                className="font-bold h-10 px-6"
              >
                {createSolicitud.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                 {currentUser?.rol === Role.ADMIN ? "Aplicar pago dirigido" : "Enviar solicitud"}
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
