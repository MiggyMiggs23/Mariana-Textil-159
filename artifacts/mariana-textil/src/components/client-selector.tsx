import { useMemo, useState } from "react";
import { Check, ChevronsUpDown, Loader2, Plus } from "lucide-react";
import {
  getListClientesQueryKey,
  useCreateCliente,
  useListClientes,
  type Cliente,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/api-error";
import { cn } from "@/lib/utils";

const quickClientSchema = z.object({
  nombre: z.string().trim().min(1, "El nombre es obligatorio.").max(200),
  telefono: z.string().trim().max(40).optional(),
});

type QuickClientValues = z.infer<typeof quickClientSchema>;

export function ClientSelector({
  value,
  onChange,
  required = false,
  disabled = false,
  className,
}: {
  value: number | null;
  onChange: (client: Cliente) => void;
  required?: boolean;
  disabled?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: clients, isLoading, isError } = useListClientes({
    query: { queryKey: getListClientesQueryKey(), staleTime: 30_000 },
  });
  const createClient = useCreateCliente();
  const form = useForm<QuickClientValues>({
    resolver: zodResolver(quickClientSchema),
    defaultValues: { nombre: "", telefono: "" },
  });
  const selected = useMemo(
    () =>
      clients?.find((client) => client.id === value) ??
      (value === 1
        ? ({
            id: 1,
            nombre: "Venta a Público",
            activo: true,
            esSistema: true,
            diasCredito: 0,
            createdAt: "",
            updatedAt: "",
          } as Cliente)
        : undefined),
    [clients, value],
  );

  const submit = (values: QuickClientValues) => {
    createClient.mutate(
      { data: { nombre: values.nombre, telefono: values.telefono || null } },
      {
        onSuccess: (client) => {
          queryClient.invalidateQueries({ queryKey: getListClientesQueryKey() });
          onChange(client);
          setCreateOpen(false);
          form.reset();
          toast({ title: "Cliente creado", description: client.nombre });
        },
        onError: (error) =>
          toast({
            title: "No se pudo crear el cliente",
            description: getApiErrorMessage(error, "Intenta de nuevo."),
            variant: "destructive",
          }),
      },
    );
  };

  return (
    <div className={cn("flex gap-2", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            aria-label={required ? "Seleccionar cliente requerido" : "Seleccionar cliente"}
            className="h-10 min-w-0 flex-1 justify-between bg-background font-normal"
            disabled={disabled}
            data-testid="button-select-client"
          >
            <span className="truncate">
              {selected ? `${selected.nombre}${selected.telefono ? ` · ${selected.telefono}` : ""}` : "Buscar cliente por nombre o teléfono"}
            </span>
            {isLoading ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[min(92vw,420px)] p-0" align="start">
          <Command filter={(item, search) => item.toLowerCase().includes(search.toLowerCase()) ? 1 : 0}>
            <CommandInput placeholder="Nombre o teléfono..." data-testid="input-search-client" />
            <CommandList>
              <CommandEmpty>{isError ? "No se pudieron cargar los clientes." : "Sin coincidencias."}</CommandEmpty>
              <CommandGroup heading="Clientes">
                {(clients ?? []).filter((client) => client.activo).sort((a, b) => Number(b.esSistema || b.id === 1) - Number(a.esSistema || a.id === 1) || a.nombre.localeCompare(b.nombre, "es")).map((client) => (
                  <CommandItem
                    key={client.id}
                    value={`${client.nombre} ${client.telefono ?? ""} ${client.id}`}
                    onSelect={() => {
                      onChange(client);
                      setOpen(false);
                    }}
                    data-testid={`option-client-${client.id}`}
                  >
                    <Check className={cn("mr-2 h-4 w-4", value === client.id ? "opacity-100" : "opacity-0")} />
                    <span className="min-w-0 flex-1 truncate">{client.esSistema || client.id === 1 ? "VENTA AL PÚBLICO" : client.nombre}</span>
                    <span className="ml-2 text-xs text-muted-foreground">{client.telefono ?? `#${client.id}`}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={() => setCreateOpen(true)}
        aria-label="Crear cliente rápido"
        disabled={disabled}
        data-testid="button-quick-create-client"
      >
        <Plus className="h-4 w-4" />
      </Button>
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nuevo cliente</DialogTitle>
            <DialogDescription>Captura los datos mínimos sin salir de la venta.</DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(submit)} className="space-y-4">
              <FormField control={form.control} name="nombre" render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre</FormLabel>
                  <FormControl><Input {...field} autoFocus data-testid="input-quick-client-name" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="telefono" render={({ field }) => (
                <FormItem>
                  <FormLabel>Teléfono</FormLabel>
                  <FormControl><Input {...field} type="tel" data-testid="input-quick-client-phone" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setCreateOpen(false)} data-testid="button-cancel-quick-client">Cancelar</Button>
                <Button type="submit" disabled={createClient.isPending} data-testid="button-save-quick-client">
                  {createClient.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Guardar
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}