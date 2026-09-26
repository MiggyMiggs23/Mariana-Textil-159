import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useE3RecapturasPreview, useE3RecapturasConfirm } from "@/hooks/use-e3";
import { getApiErrorMessage } from "@/lib/api-error";
import { Loader2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatNumber } from "@workspace/number-format";
import { useGetCurrentUser, type E3CollectionPreview, type E3CollectionInput } from "@workspace/api-client-react";
import { E3_ENABLED } from "@/lib/e3-feature-flags";
import { Link } from "wouter";
import { hasPermission, Modules } from "@/lib/permisos";

const recapturaSchema = z.object({
  importeCentavos: z.coerce.number().int().min(1, "El importe debe ser mayor a 0"),
  formaPago: z.enum(["EFECTIVO", "TRANSFERENCIA"]),
  cuentaDestino: z.enum(["CAJA_FISICA", "CUENTA_FISCAL", "CUENTA_NO_FISCAL"]),
  sitioId: z.coerce.number().min(1, "Selecciona un sitio"),
  motivo: z.string().trim().min(1, "El motivo es obligatorio para recapturas históricas"),
  fechaRecepcion: z.string().min(1, "La fecha de recepción original es obligatoria"),
});

type RecapturaFormValues = z.infer<typeof recapturaSchema>;

interface ClienteE3RecapturaDialogProps {
  clienteId: number;
  sitios: { id: number; nombre: string }[];
}

export function ClienteE3RecapturaDialog({ clienteId, sitios }: ClienteE3RecapturaDialogProps) {
  const [open, setOpen] = useState(false);
  const [previewData, setPreviewData] = useState<(E3CollectionPreview & { payload: E3CollectionInput }) | null>(null);
  const { data: user } = useGetCurrentUser();
  const { toast } = useToast();

  const [operacionClave, setOperacionClave] = useState<string>(() => crypto.randomUUID());
  const [uncertain, setUncertain] = useState(false);
  const recoveryKey = `e3-pending-recapture:${user?.id ?? "unknown"}:${clienteId}`;

  const previewMutation = useE3RecapturasPreview(clienteId);
  const confirmMutation = useE3RecapturasConfirm(clienteId);

  const form = useForm<RecapturaFormValues>({
    resolver: zodResolver(recapturaSchema),
    defaultValues: {
      importeCentavos: 0,
      formaPago: "EFECTIVO",
      cuentaDestino: "CAJA_FISICA",
      sitioId: sitios?.[0]?.id || 0,
      motivo: "",
      fechaRecepcion: "",
    },
  });

  const onSubmit = (data: RecapturaFormValues) => {
    if (previewMutation.isPending || confirmMutation.isPending) return;
    const payload: E3CollectionInput = {
      ...data, clienteId, sesionCajaId: null, operacionClave,
      fechaRecepcion: new Date(`${data.fechaRecepcion}-06:00`).toISOString(),
    };
    previewMutation.mutate(
      payload,
      {
        onSuccess: (res) => {
          setPreviewData({ ...res, payload });
        },
        onError: (err) => {
          if ((err as any)?.response?.status === 409) {
            setOperacionClave(crypto.randomUUID());
          }
          toast({
            title: "Error",
            description: getApiErrorMessage(err),
            variant: "destructive",
          });
        },
      }
    );
  };

  const handleConfirm = () => {
    if (!previewData || confirmMutation.isPending) return;
    try { sessionStorage.setItem(recoveryKey, JSON.stringify(previewData)); }
    catch {
      toast({ title: "No se puede conservar la operación", description: "No se ha enviado la recaptura; habilita el almacenamiento de sesión.", variant: "destructive" });
      return;
    }
    setUncertain(true);
    confirmMutation.mutate(
      {
        ...previewData.payload,
        clienteId,
        sesionCajaId: null,
        operacionClave: operacionClave,
        previewToken: previewData.previewToken,
      },
      {
        onSuccess: ({ recibo }) => {
          sessionStorage.removeItem(recoveryKey);
          setUncertain(false);
          toast({
            title: "Recaptura registrada",
            description: `Constancia ${recibo.folio}. SIN DINERO NUEVO; no entra a Caja.`,
          });
          setOpen(false);
          setPreviewData(null);
          setOperacionClave(crypto.randomUUID());
          form.reset();
        },
        onError: (err) => {
           if ((err as { status?: number })?.status === 409 || (err as { response?: { status?: number } })?.response?.status === 409) {
             setUncertain(false);
             sessionStorage.removeItem(recoveryKey);
             setPreviewData(null);
          }
          toast({
            title: "Error",
            description: getApiErrorMessage(err),
            variant: "destructive",
          });
        },
      }
    );
  };

  const formaPago = form.watch("formaPago");
  if (!E3_ENABLED || !hasPermission(user, "clientes_recapturas", "crear")) return null;

  return (
    <Dialog open={open} onOpenChange={(val) => {
       if (confirmMutation.isPending || uncertain) return;
       setOpen(val);
       if (val) {
         try {
           const saved = sessionStorage.getItem(recoveryKey);
           if (saved) {
             const pending = JSON.parse(saved) as E3CollectionPreview & { payload: E3CollectionInput };
             if (pending.payload.clienteId !== clienteId || !pending.previewToken || !pending.payload.operacionClave) throw new Error("Recaptura pendiente inválida");
             setPreviewData(pending);
             setOperacionClave(pending.payload.operacionClave);
             setUncertain(true);
           }
         } catch (error) {
           toast({ title: "No se pudo recuperar la recaptura", description: getApiErrorMessage(error), variant: "destructive" });
         }
       }
      if (!val) {
        setPreviewData(null);
        setOperacionClave(crypto.randomUUID());
        form.reset();
      }
    }}>
      <DialogTrigger asChild>
        <Button variant="outline" data-testid="button-recaptura-historica">
          Recaptura Histórica
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Recaptura Histórica (E3)</DialogTitle>
          <DialogDescription>
            Solo para reconstruir historial de crédito. No registra entrada de dinero físico en caja actual.
          </DialogDescription>
        </DialogHeader>

        {!previewData ? (
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Destructive red is reserved for field validation errors in this form. */}
            <div className="space-y-2">
              <Label>Importe (centavos)</Label>
              <Input
                type="number"
                {...form.register("importeCentavos")}
                onChange={(e) => {
                  form.setValue("importeCentavos", Number(e.target.value));
                  if (previewData) { setPreviewData(null); setOperacionClave(crypto.randomUUID()); }
                }}
                data-testid="input-recaptura-importe"
              />
              {form.formState.errors.importeCentavos && (
                <p className="text-sm text-destructive">{form.formState.errors.importeCentavos.message}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Forma de Pago</Label>
                <Select
                  value={formaPago}
                  onValueChange={(val) => {
                    form.setValue("formaPago", val as "EFECTIVO" | "TRANSFERENCIA");
                    if (val === "EFECTIVO") form.setValue("cuentaDestino", "CAJA_FISICA");
                    if (previewData) { setPreviewData(null); setOperacionClave(crypto.randomUUID()); }
                  }}
                >
                  <SelectTrigger data-testid="select-recaptura-forma-pago">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="EFECTIVO">Efectivo</SelectItem>
                    <SelectItem value="TRANSFERENCIA">Transferencia</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {formaPago === "TRANSFERENCIA" && (
                <div className="space-y-2">
                  <Label>Cuenta Destino</Label>
                  <Select
                    value={form.watch("cuentaDestino")}
                    onValueChange={(val) => {
                      form.setValue("cuentaDestino", val as "CUENTA_FISCAL" | "CUENTA_NO_FISCAL");
                      if (previewData) { setPreviewData(null); setOperacionClave(crypto.randomUUID()); }
                    }}
                  >
                    <SelectTrigger data-testid="select-recaptura-cuenta">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CUENTA_NO_FISCAL">Cuenta No Fiscal</SelectItem>
                      <SelectItem value="CUENTA_FISCAL">Cuenta Fiscal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label>Sitio Original de Recepción</Label>
              <Select
                value={form.watch("sitioId").toString()}
                onValueChange={(val) => {
                  form.setValue("sitioId", Number(val));
                  if (previewData) { setPreviewData(null); setOperacionClave(crypto.randomUUID()); }
                }}
              >
                <SelectTrigger data-testid="select-recaptura-sitio">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {sitios.map(s => (
                    <SelectItem key={s.id} value={s.id.toString()}>{s.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.formState.errors.sitioId && (
                <p className="text-sm text-destructive">{form.formState.errors.sitioId.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Fecha Original de Recepción (hora de Ciudad de México)</Label>
              <Input
                type="datetime-local"
                {...form.register("fechaRecepcion")}
                onChange={(e) => {
                  form.setValue("fechaRecepcion", e.target.value);
                  if (previewData) { setPreviewData(null); setOperacionClave(crypto.randomUUID()); }
                }}
                data-testid="input-recaptura-fecha"
              />
              {form.formState.errors.fechaRecepcion && (
                <p className="text-sm text-destructive">{form.formState.errors.fechaRecepcion.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Motivo de la Recaptura</Label>
              <Textarea
                {...form.register("motivo")}
                placeholder="Explique la falta de evidencia y por qué se recaptura"
                data-testid="input-recaptura-motivo"
              />
              {form.formState.errors.motivo && (
                <p className="text-sm text-destructive">{form.formState.errors.motivo.message}</p>
              )}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={previewMutation.isPending} data-testid="button-recaptura-preview">
                {previewMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Generar Vista Previa"}
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <div className="space-y-4">
            <div className="bg-muted p-4 rounded-md space-y-2 text-sm">
              <p><strong>Origen:</strong> {previewData.origen}</p>
              <p><strong>Importe Registrado:</strong> {formatNumber(previewData.importeCentavos / 100, { kind: "money" })}</p>
              <p><strong>A favor generado:</strong> {formatNumber(previewData.saldoAFavorCentavos / 100, { kind: "money" })}</p>
              <p><strong>Remanente a favor:</strong> {formatNumber(previewData.remanenteCentavos / 100, { kind: "money" })}</p>
              
              {previewData.asignaciones.length > 0 && (
                <div className="mt-4">
                  <strong>Notas que se pagarán:</strong>
                  <ul className="list-disc pl-4 mt-2">
                    {previewData.asignaciones.map((asig, i) => (
                      <li key={i}>
                        {/* Primary plus underline identifies a navigable folio, never recapture status. */}
                        {asig.ticketId && asig.folio && (["ADMIN", "CONTADOR", "SISTEMAS"].includes(user?.rol ?? "") || [Modules.COBROS_PAGOS, Modules.POS, Modules.SALIDAS].some(module => hasPermission(user, module, "ver"))) ? <Link className="text-primary underline" href={`/tickets/${asig.ticketId}`}>Folio {asig.folio}</Link> : <>Folio {asig.folio ?? "sin documento identificable"}</>} - Aplica {formatNumber(asig.aplicadoCentavos / 100, { kind: "money" })}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            
            {/* Amber means caution before creating historical evidence; it is not a validation error. */}
            <p className="text-sm text-amber-800 font-medium">
              Al confirmar se generará una constancia histórica (SIN DINERO NUEVO).
            </p>

            <DialogFooter>
              {uncertain && <p role="status">Respuesta incierta: reintenta esta misma operación antes de salir; no registres otra recaptura.</p>}
              <Button variant="outline" disabled={confirmMutation.isPending || uncertain} onClick={() => { setPreviewData(null); setOperacionClave(crypto.randomUUID()); }}>Volver</Button>
              <Button onClick={handleConfirm} disabled={confirmMutation.isPending} data-testid="button-recaptura-confirm">
                {confirmMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirmar Recaptura"}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
