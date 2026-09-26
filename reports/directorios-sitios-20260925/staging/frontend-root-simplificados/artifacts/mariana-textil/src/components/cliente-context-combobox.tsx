import * as React from "react";
import { Check, ChevronsUpDown, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useGetCajaAbonoE3Context, getGetCajaAbonoE3ContextQueryKey } from "@workspace/api-client-react";
import { useLocationScope } from "@/lib/location-scope";
import { E3_ENABLED } from "@/lib/e3-feature-flags";

interface ClienteContextComboboxProps {
  value: number | null;
  onChange: (clienteId: number | null) => void;
  disabled?: boolean;
}

export function ClienteContextCombobox({ value, onChange, disabled }: ClienteContextComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const [debouncedSearch, setDebouncedSearch] = React.useState("");
  const { selectedLocationId } = useLocationScope();

  React.useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
    }, 400);
    return () => clearTimeout(handler);
  }, [search]);

  const { data: context, isFetching } = useGetCajaAbonoE3Context(
    { buscar: debouncedSearch.length >= 2 ? debouncedSearch : undefined, sitioId: selectedLocationId || undefined },
    {
      query: {
        queryKey: getGetCajaAbonoE3ContextQueryKey({ buscar: debouncedSearch.length >= 2 ? debouncedSearch : undefined, sitioId: selectedLocationId || undefined }),
        enabled: E3_ENABLED && open,
      }
    }
  );

  const activeClients = context?.clientes || [];

  const selectedClient = React.useMemo(() => {
    return activeClients.find((c) => c.id === value);
  }, [activeClients, value]);

  // Keep a selected client visible even if it's not in the current search results
  const displayLabel = selectedClient?.nombre || (value ? "Cliente seleccionado" : "Selecciona un cliente...");

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
          data-testid="button-cliente-context-combobox"
          disabled={disabled}
        >
          {displayLabel}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput 
            placeholder="Buscar cliente (mín. 2 letras)..." 
            value={search}
            onValueChange={setSearch}
            data-testid="input-cliente-context-search"
          />
          <CommandList>
            {isFetching && (
              <div className="p-4 flex items-center justify-center text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin mr-2" /> Buscando...
              </div>
            )}
            {!isFetching && search.length > 0 && search.length < 2 && (
              <CommandEmpty>Ingresa al menos 2 caracteres.</CommandEmpty>
            )}
            {!isFetching && search.length >= 2 && activeClients.length === 0 && (
              <CommandEmpty>No se encontró ningún cliente.</CommandEmpty>
            )}
            <CommandGroup>
              {activeClients.map((cliente) => (
                <CommandItem
                  key={cliente.id}
                  value={cliente.nombre}
                  onSelect={() => {
                    onChange(cliente.id);
                    setOpen(false);
                  }}
                  data-testid={`option-cliente-${cliente.id}`}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === cliente.id ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <div className="flex flex-col">
                    <span>{cliente.nombre}</span>
                    {cliente.telefono && <span className="text-xs text-muted-foreground">{cliente.telefono}</span>}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
