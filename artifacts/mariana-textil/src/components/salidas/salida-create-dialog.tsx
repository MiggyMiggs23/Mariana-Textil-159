import { useState, useEffect, useRef } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { 
  useCrearSalida,
  useListLocations,
  getListLocationsQueryKey,
  useGetCurrentUser,
  getGetCurrentUserQueryKey,
  Role,
  getListSalidasQueryKey,
  getGetSalidasPendientesCountQueryKey,
  useListProductos,
  getListProductosQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { getApiErrorMessage } from "@/lib/api-error";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, Loader2 } from "lucide-react";
import { ProductCombobox } from "@/components/product-combobox";

const lineSchema = z.object({
  productoId: z.number().min(1, "Selecciona un producto"),
  cantidadSolicitada: z.string().min(1, "Requerido").regex(/^(?:0\.(?:0*[1-9]\d*)|[1-9]\d*(?:\.\d+)?)$/, "Debe ser un número mayor a 0"),
  rollosSolicitados: z.string().optional().refine(v => !v || /^[1-9]\d*$/.test(v), "Si se especifica, debe ser un entero > 0"),
  nota: z.string().optional()
});

const schema = z.object({
  origenId: z.number({ required_error: "Requerido" }),
  destinoId: z.number({ required_error: "Requerido" }),
  notaSolicitud: z.string().optional(),
  lineas: z.array(lineSchema).min(1, "Debes agregar al menos un producto")
}).refine(data => data.origenId !== data.destinoId, {
  message: "El origen y el destino deben ser diferentes",
  path: ["destinoId"]
});

type FormValues = z.infer<typeof schema>;

export function SalidaCreateDialog({ open, onOpenChange }: { open: boolean, onOpenChange: (o: boolean) => void }) {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { data: user } = useGetCurrentUser({ query: { queryKey: getGetCurrentUserQueryKey() } });
  const { data: locations } = useListLocations({ query: { queryKey: getListLocationsQueryKey() } });
  const { data: productosResult } = useListProductos({ query: { queryKey: getListProductosQueryKey() } });
  
  const createMutation = useCrearSalida();
  
  const uuidRef = useRef<string>("");

  const isAdmin = user?.rol === Role.ADMIN;
  
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      origenId: undefined,
      destinoId: isAdmin ? undefined : user?.ubicacion?.id,
      notaSolicitud: "",
      lineas: [{ productoId: 0, cantidadSolicitada: "", rollosSolicitados: "", nota: "" }]
    }
  });

  // Re-initialize form when dialog opens
  useEffect(() => {
    if (open && user) {
      if (!uuidRef.current) {
        uuidRef.current = crypto.randomUUID();
      }
      const isAdmin = user.rol === Role.ADMIN;
      form.reset({
        origenId: undefined,
        destinoId: isAdmin ? undefined : user.ubicacion?.id,
        notaSolicitud: "",
        lineas: [{ productoId: 0, cantidadSolicitada: "", rollosSolicitados: "", nota: "" }]
      });
    } else if (!open) {
      // Clear uuid when closed explicitly, so next time we generate a new one
      uuidRef.current = "";
    }
  }, [open, user, form]);

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "lineas"
  });

  const onSubmit = (data: FormValues) => {
    createMutation.mutate({
      data: {
        uuidCliente: uuidRef.current || crypto.randomUUID(),
        origenId: data.origenId,
        destinoId: data.destinoId,
        notaSolicitud: data.notaSolicitud || null,
        lineas: data.lineas.map(l => ({
          productoId: l.productoId,
          cantidadSolicitada: l.cantidadSolicitada,
          rollosSolicitados: l.rollosSolicitados ? Number(l.rollosSolicitados) : null,
          nota: l.nota || null
        }))
      }
    }, {
      onSuccess: (res) => {
        toast({ title: "Salida creada", description: `Folio ${res.folio}` });
        queryClient.invalidateQueries({ queryKey: getListSalidasQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetSalidasPendientesCountQueryKey() });
        uuidRef.current = ""; // Reset uuid so next open gets a fresh one
        onOpenChange(false);
        setLocation(`/salidas/${res.id}`);
      },
      onError: (err) => {
        toast({
          title: "Error al crear",
          description: getApiErrorMessage(err),
          variant: "destructive"
        });
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto custom-scrollbar">
        <DialogHeader>
          <DialogTitle>Nueva Solicitud de Salida</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="origenId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Ubicación Origen</FormLabel>
                    <Select
                      value={field.value ? String(field.value) : ""}
                      onValueChange={(val) => field.onChange(Number(val))}
                    >
                      <FormControl>
                        <SelectTrigger data-testid="select-origen">
                          <SelectValue placeholder="Selecciona origen" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {locations?.filter(l => l.id !== form.watch("destinoId")).map(l => (
                          <SelectItem key={l.id} value={String(l.id)}>{l.nombre}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="destinoId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Ubicación Destino</FormLabel>
                    <Select
                      disabled={!isAdmin}
                      value={field.value ? String(field.value) : ""}
                      onValueChange={(val) => field.onChange(Number(val))}
                    >
                      <FormControl>
                        <SelectTrigger data-testid="select-destino">
                          <SelectValue placeholder="Selecciona destino" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {locations?.filter(l => l.id !== form.watch("origenId")).map(l => (
                          <SelectItem key={l.id} value={String(l.id)}>{l.nombre}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="notaSolicitud"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nota General (opcional)</FormLabel>
                  <FormControl>
                    <Textarea data-testid="input-nota-general" placeholder="Ej. Urgente para cliente VIP" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div>
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-semibold text-sm">Productos solicitados</h4>
                <Button data-testid="btn-add-linea" type="button" variant="outline" size="sm" onClick={() => append({ productoId: 0, cantidadSolicitada: "", rollosSolicitados: "", nota: "" })}>
                  <Plus className="w-4 h-4 mr-2" /> Agregar producto
                </Button>
              </div>

              {form.formState.errors.lineas?.root && (
                <p className="text-sm font-medium text-destructive mb-2">{form.formState.errors.lineas.root.message}</p>
              )}

              <div className="space-y-4">
                {fields.map((field, index) => (
                  <div key={field.id} data-testid={`linea-${index}`} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-[1fr_100px_100px_1fr_auto] gap-3 items-start border p-3 rounded-lg bg-slate-50/50">
                    <FormField
                      control={form.control}
                      name={`lineas.${index}.productoId`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className={index === 0 ? "" : "sr-only"}>Producto</FormLabel>
                          <FormControl>
                            <ProductCombobox 
                              products={productosResult || []}
                              value={field.value ? String(field.value) : ""} 
                              onValueChange={(v) => field.onChange(Number(v))} 
                              testId={`input-producto-${index}`}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name={`lineas.${index}.cantidadSolicitada`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className={index === 0 ? "" : "sr-only"}>Cant. Total</FormLabel>
                          <FormControl>
                            <Input data-testid={`input-cant-${index}`} placeholder="0.0" {...field} className="bg-white" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name={`lineas.${index}.rollosSolicitados`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className={index === 0 ? "" : "sr-only"}>Rollos</FormLabel>
                          <FormControl>
                            <Input data-testid={`input-rollos-${index}`} placeholder="Ej: 2" {...field} className="bg-white" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name={`lineas.${index}.nota`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className={index === 0 ? "" : "sr-only"}>Nota línea (opcional)</FormLabel>
                          <FormControl>
                            <Input data-testid={`input-nota-linea-${index}`} placeholder="Color específico..." {...field} className="bg-white" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className={`flex items-center ${index === 0 ? "pt-8" : "pt-0"}`}>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        data-testid={`btn-remove-linea-${index}`}
                        aria-label="Eliminar línea"
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => remove(index)}
                        disabled={fields.length === 1}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={createMutation.isPending}>
                Cancelar
              </Button>
              <Button data-testid="btn-submit-salida" type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Crear Solicitud
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
