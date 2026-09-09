import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { 
  Equipo, 
  Location, 
  TipoEquipo, 
  useCreateEquipo, 
  useUpdateEquipo, 
  getListEquiposQueryKey 
} from "@workspace/api-client-react";

const equipoSchema = z.object({
  ubicacionId: z.coerce.number().min(1, "Debe seleccionar una ubicación"),
  tipo: z.nativeEnum(TipoEquipo, { required_error: "Debe seleccionar un tipo de equipo" }),
  identificador: z.string().min(1, "El identificador es requerido").max(160, "Máximo 160 caracteres"),
  marca: z.string().min(1, "La marca es requerida").max(100, "Máximo 100 caracteres"),
  modelo: z.string().min(1, "El modelo es requerido").max(100, "Máximo 100 caracteres"),
  numeroSerie: z.string().max(160, "Máximo 160 caracteres").optional(),
  notas: z.string().max(2000, "Máximo 2000 caracteres").optional(),
});

type EquipoFormValues = z.infer<typeof equipoSchema>;

interface EquipoFormDialogProps {
  open: boolean;
  onClose: () => void;
  equipo: Equipo | null;
  locations: Location[];
  defaultLocationId: number | null;
}

export function EquipoFormDialog({ open, onClose, equipo, locations, defaultLocationId }: EquipoFormDialogProps) {
  const queryClient = useQueryClient();
  const createMutation = useCreateEquipo();
  const updateMutation = useUpdateEquipo();

  const form = useForm<EquipoFormValues>({
    resolver: zodResolver(equipoSchema),
    defaultValues: {
      ubicacionId: defaultLocationId ?? undefined,
      tipo: undefined,
      identificador: "",
      marca: "",
      modelo: "",
      numeroSerie: "",
      notas: "",
    }
  });

  useEffect(() => {
    if (open) {
      if (equipo) {
        form.reset({
          ubicacionId: equipo.ubicacionId,
          tipo: equipo.tipo,
          identificador: equipo.identificador,
          marca: equipo.marca,
          modelo: equipo.modelo,
          numeroSerie: equipo.numeroSerie ?? "",
          notas: equipo.notas ?? "",
        });
      } else {
        form.reset({
          ubicacionId: defaultLocationId ?? undefined,
          tipo: undefined,
          identificador: "",
          marca: "",
          modelo: "",
          numeroSerie: "",
          notas: "",
        });
      }
    }
  }, [open, equipo, defaultLocationId, form]);

  const onSubmit = (values: EquipoFormValues) => {
    const payload = {
      ...values,
      numeroSerie: values.numeroSerie ? values.numeroSerie : null,
      notas: values.notas ? values.notas : null,
    };

    if (equipo) {
      updateMutation.mutate(
        { id: equipo.id, data: payload },
        {
          onSuccess: () => {
            toast.success("Equipo actualizado exitosamente");
            queryClient.invalidateQueries({ queryKey: getListEquiposQueryKey() });
            onClose();
          },
          onError: (err: any) => {
            toast.error("Error al actualizar equipo", { 
              description: err.data?.error || err.message || "Ocurrió un error inesperado" 
            });
          }
        }
      );
    } else {
      createMutation.mutate(
        { data: payload },
        {
          onSuccess: () => {
            toast.success("Equipo registrado exitosamente");
            queryClient.invalidateQueries({ queryKey: getListEquiposQueryKey() });
            onClose();
          },
          onError: (err: any) => {
            toast.error("Error al registrar equipo", { 
              description: err.data?.error || err.message || "Ocurrió un error inesperado" 
            });
          }
        }
      );
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={(val) => !val && onClose()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{equipo ? "Editar Equipo" : "Nuevo Equipo"}</DialogTitle>
          <DialogDescription>
            {equipo ? "Modifica los datos del equipo." : "Registra un nuevo equipo en el sistema."}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="ubicacionId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Ubicación *</FormLabel>
                    <Select 
                      onValueChange={(val) => field.onChange(Number(val))} 
                      value={field.value ? String(field.value) : undefined}
                      disabled={!!equipo} // Generally we don't change locations of physical equipment, but if we do, remove this
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccione sitio" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {locations.filter(l => l.activa).map(loc => (
                          <SelectItem key={loc.id} value={String(loc.id)}>
                            {loc.nombre}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="tipo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo *</FormLabel>
                    <Select 
                      onValueChange={field.onChange} 
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccione tipo" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="COMPUTADORA_POS">Computadora POS</SelectItem>
                        <SelectItem value="IMPRESORA_TICKETS">Impresora de Tickets</SelectItem>
                        <SelectItem value="IMPRESORA_ETIQUETAS">Impresora de Etiquetas</SelectItem>
                        <SelectItem value="PISTOLA_ESCANER">Pistola Escáner</SelectItem>
                        <SelectItem value="SMARTPHONE_ESCANER">Smartphone Escáner</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="identificador"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Identificador / Nombre *</FormLabel>
                  <FormControl>
                    <Input placeholder="Ej. Caja 1" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="marca"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Marca *</FormLabel>
                    <FormControl>
                      <Input placeholder="Ej. Zebra" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="modelo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Modelo *</FormLabel>
                    <FormControl>
                      <Input placeholder="Ej. ZD421" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="numeroSerie"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Número de Serie (Opcional)</FormLabel>
                  <FormControl>
                    <Input placeholder="S/N" {...field} className="font-mono" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notas"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notas (Opcional)</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Detalles adicionales..." 
                      className="resize-none" 
                      rows={3}
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose} disabled={isPending} data-testid="button-cancel-equipo">
                Cancelar
              </Button>
              <Button type="submit" disabled={isPending} data-testid="button-submit-equipo">
                {isPending ? "Guardando..." : "Guardar"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}