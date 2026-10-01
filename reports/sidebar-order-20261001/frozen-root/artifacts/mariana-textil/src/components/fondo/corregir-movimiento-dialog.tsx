import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useCreateFondoMovimientoInverso, useGetFondo } from "@/hooks/fondo";
import { useToast } from "@/hooks/use-toast";
import { Loader2, AlertTriangle } from "lucide-react";
import { formatFondoCurrency } from "@/lib/fondo-utils";

const formSchema = z.object({
  motivo: z.string().min(1, "El motivo es requerido").max(500, "Máximo 500 caracteres"),
});

interface CorregirMovimientoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  movimientoId: string;
  importe: string;
  naturaleza: string;
}

export function CorregirMovimientoDialog({ open, onOpenChange, movimientoId, importe, naturaleza }: CorregirMovimientoDialogProps) {
  const { toast } = useToast();
  const createMutation = useCreateFondoMovimientoInverso();
  const { data: resumen } = useGetFondo();
  const [idempotencyKey, setIdempotencyKey] = useState<string>("");
  
  useEffect(() => {
    if (open) {
      setIdempotencyKey(crypto.randomUUID());
    }
  }, [open]);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      motivo: "",
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({ motivo: "" });
    }
  }, [open, form]);

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    createMutation.mutate({
      id: movimientoId,
      data: {
        idempotencyKey,
        motivo: values.motivo,
      }
    }, {
      onSuccess: () => {
        toast({ title: "Corrección registrada exitosamente" });
        onOpenChange(false);
      },
      onError: (err: any) => {
        toast({ 
          title: "Error al corregir", 
          description: err?.cause?.error || err.message || "Error desconocido", 
          variant: "destructive" 
        });
      }
    });
  };

  const willLeaveNegativeBalance = resumen && naturaleza === "INGRESO" && Number(resumen.saldo) - Number(importe) < 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="text-destructive">Anular Movimiento (Corrección Inversa)</DialogTitle>
          <DialogDescription>
            Se generará un movimiento inverso por el monto de {formatFondoCurrency(importe)} para anular el movimiento original. 
            Esta es una corrección contable, no un movimiento físico de efectivo.
          </DialogDescription>
        </DialogHeader>

        {willLeaveNegativeBalance && (
          <div className="bg-destructive/10 text-destructive p-3 rounded-md flex gap-2 items-start text-sm">
            <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Advertencia de Saldo Negativo</p>
              <p>Al anular este ingreso, el saldo contable del fondo quedará negativo. Verifica que sea la corrección correcta.</p>
            </div>
          </div>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            
            <FormField
              control={form.control}
              name="motivo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Motivo de la corrección</FormLabel>
                  <FormControl>
                    <Textarea 
                      {...field} 
                      placeholder="Explica detalladamente por qué se anula este movimiento..." 
                      className="resize-none h-24"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={createMutation.isPending}>
                Cancelar
              </Button>
              <Button type="submit" variant="destructive" disabled={createMutation.isPending}>
                {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Confirmar Corrección
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}