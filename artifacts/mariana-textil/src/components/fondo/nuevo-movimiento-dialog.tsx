import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useCreateFondoMovimiento, type CategoriaFondo } from "@/hooks/fondo";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

const formSchema = z.object({
  categoria: z.string().min(1, "Selecciona una categoría"),
  importe: z.string().regex(/^(0|[1-9][0-9]*)\.[0-9]{2}$/, "Debe ser un importe válido (ej. 1500.00)"),
  motivo: z.string().min(1, "El motivo es requerido").max(500, "Máximo 500 caracteres"),
  evidencia: z.string().optional(),
  declaracion: z.boolean().optional(),
});

interface NuevoMovimientoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tipo: "INGRESO" | "RETIRO";
  isInitial: boolean;
}

export function NuevoMovimientoDialog({ open, onOpenChange, tipo, isInitial }: NuevoMovimientoDialogProps) {
  const { toast } = useToast();
  const createMutation = useCreateFondoMovimiento();
  const [idempotencyKey, setIdempotencyKey] = useState<string>("");
  
  useEffect(() => {
    if (open) {
      setIdempotencyKey(crypto.randomUUID());
    }
  }, [open]);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      categoria: isInitial ? "SALDO_INICIAL" : (tipo === "INGRESO" ? "OTRO_INGRESO" : "RETIRO"),
      importe: "0.00",
      motivo: isInitial ? "saldo inicial" : "",
      evidencia: "",
      declaracion: false,
    },
  });

  // Reset form when dialog opens/closes or type changes
  useEffect(() => {
    if (open) {
      form.reset({
        categoria: isInitial ? "SALDO_INICIAL" : (tipo === "INGRESO" ? "OTRO_INGRESO" : "RETIRO"),
        importe: "0.00",
        motivo: isInitial ? "saldo inicial" : "",
        evidencia: "",
        declaracion: false,
      });
    }
  }, [open, isInitial, tipo, form]);

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    if (isInitial && !values.declaracion) {
      form.setError("declaracion", { type: "manual", message: "Debes confirmar la conciliación física" });
      return;
    }
    if (isInitial && !values.evidencia) {
      form.setError("evidencia", { type: "manual", message: "La evidencia es requerida para el saldo inicial" });
      return;
    }

    createMutation.mutate({
      data: {
        idempotencyKey,
        categoria: values.categoria as CategoriaFondo,
        importe: values.importe,
        motivo: values.motivo,
        ...(isInitial ? {
          conciliacionInicial: {
            efectivoFisicoContado: values.importe,
            declaracionSinDuplicacion: true,
            evidencia: values.evidencia || "N/A",
          }
        } : {})
      }
    }, {
      onSuccess: () => {
        toast({ title: "Movimiento registrado exitosamente" });
        onOpenChange(false);
      },
      onError: (err: any) => {
        toast({ 
          title: "Error al registrar", 
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
          <DialogTitle>
            {isInitial ? "Registrar Saldo Inicial" : `Registrar ${tipo === "INGRESO" ? "Ingreso" : "Retiro"}`}
          </DialogTitle>
          <DialogDescription>
            {isInitial 
              ? "Reconoce el dinero físico existente. Este será el saldo inicial del fondo." 
              : `Registra un nuevo ${tipo.toLowerCase()} en el fondo. El importe debe tener 2 decimales.`}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="categoria"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Categoría</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value} disabled={isInitial || tipo === "RETIRO"}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona una categoría" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {isInitial && <SelectItem value="SALDO_INICIAL">Saldo Inicial</SelectItem>}
                      {!isInitial && tipo === "INGRESO" && (
                        <>
                          <SelectItem value="CAPITAL">Capital</SelectItem>
                          <SelectItem value="OTRO_INGRESO">Otro Ingreso</SelectItem>
                        </>
                      )}
                      {!isInitial && tipo === "RETIRO" && (
                        <SelectItem value="RETIRO">Retiro</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="importe"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Importe Exacto (ej. 1500.00)</FormLabel>
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
                  <FormLabel>Motivo</FormLabel>
                  <FormControl>
                    <Textarea 
                      {...field} 
                      placeholder="Describe el motivo de la operación" 
                      disabled={isInitial}
                      className="resize-none h-20"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {isInitial && (
              <>
                <FormField
                  control={form.control}
                  name="evidencia"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Evidencia / Comentarios</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Referencia de la evidencia física" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="declaracion"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>
                          Declaro que este conteo es físico y no duplica saldos previos.
                        </FormLabel>
                        <FormMessage />
                      </div>
                    </FormItem>
                  )}
                />
              </>
            )}

            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={createMutation.isPending}>
                Cancelar
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Registrar
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}