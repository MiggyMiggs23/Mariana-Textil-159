import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useCreateFondoArqueo } from "@/hooks/fondo";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { formatFondoCurrency } from "@/lib/fondo-utils";

const formSchema = z.object({
  efectivoContado: z.string().regex(/^(0|[1-9][0-9]*)\.[0-9]{2}$/, "Debe ser un importe válido (ej. 1500.00)"),
  motivo: z.string().min(1, "El motivo es requerido").max(500, "Máximo 500 caracteres"),
});

interface NuevoArqueoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentBalance: string;
  versionSaldo: string | null;
}

export function NuevoArqueoDialog({ open, onOpenChange, currentBalance, versionSaldo }: NuevoArqueoDialogProps) {
  const { toast } = useToast();
  const createMutation = useCreateFondoArqueo();
  const [idempotencyKey, setIdempotencyKey] = useState<string>("");
  
  useEffect(() => {
    if (open) {
      setIdempotencyKey(crypto.randomUUID());
    }
  }, [open]);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      efectivoContado: "0.00",
      motivo: "",
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        efectivoContado: "0.00",
        motivo: "",
      });
    }
  }, [open, form]);

  const contado = parseFloat(form.watch("efectivoContado") || "0");
  const saldo = parseFloat(currentBalance);
  const diferencia = isNaN(contado) ? 0 : contado - saldo;

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    createMutation.mutate({
      data: {
        idempotencyKey,
        efectivoContado: values.efectivoContado,
        expectedVersionSaldo: versionSaldo,
        motivo: values.motivo,
      }
    }, {
      onSuccess: () => {
        toast({ title: "Arqueo registrado exitosamente" });
        onOpenChange(false);
      },
      onError: (err: any) => {
        toast({ 
          title: "Error al registrar arqueo", 
          description: err?.cause?.error || err.message || "Error desconocido", 
          variant: "destructive" 
        });
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Realizar Arqueo</DialogTitle>
          <DialogDescription>
            Ingresa el monto físico contado en el fondo. El saldo en sistema es de {formatFondoCurrency(currentBalance)}.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="bg-muted p-4 rounded-md flex justify-between items-center mb-4">
              <div>
                <p className="text-sm text-muted-foreground">Saldo en sistema</p>
                <p className="font-semibold">{formatFondoCurrency(currentBalance)}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Diferencia proyectada</p>
                <p className={`font-semibold ${diferencia < 0 ? "text-destructive" : diferencia > 0 ? "text-emerald-600" : "text-muted-foreground"}`}>
                  {formatFondoCurrency(diferencia)}
                </p>
              </div>
            </div>

            <FormField
              control={form.control}
              name="efectivoContado"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Efectivo Contado Exacto (ej. 1500.00)</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="0.00" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="motivo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Comentarios / Motivo</FormLabel>
                  <FormControl>
                    <Textarea 
                      {...field} 
                      placeholder="Observaciones sobre el arqueo y la diferencia si la hubiera" 
                      className="resize-none h-20"
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
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Guardar Arqueo
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}