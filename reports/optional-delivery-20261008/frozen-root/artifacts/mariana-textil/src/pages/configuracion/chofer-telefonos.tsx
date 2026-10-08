import { ArrowUp, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface TelefonoChofer {
  numero: string;
  etiqueta?: string;
}

// Keep legacy records editable while the directory receives the ordered list.
export function getTelefonosChofer(chofer: {
  telefono: string;
  telefonos?: TelefonoChofer[];
}): TelefonoChofer[] {
  return chofer.telefonos?.length
    ? chofer.telefonos
    : [{ numero: chofer.telefono }];
}

export function ChoferTelefonosEditor({
  telefonos,
  onChange,
  disabled,
}: {
  telefonos: TelefonoChofer[];
  onChange: (telefonos: TelefonoChofer[]) => void;
  disabled: boolean;
}) {
  const update = (index: number, change: Partial<TelefonoChofer>) =>
    onChange(telefonos.map((telefono, position) =>
      position === index ? { ...telefono, ...change } : telefono,
    ));

  return (
    <fieldset className="space-y-3" disabled={disabled}>
      <legend className="text-sm font-medium">Teléfonos *</legend>
      <p className="text-sm text-muted-foreground">
        El primero es el principal y se muestra en las demás pantallas.
      </p>
      {telefonos.map((telefono, index) => (
        <div key={index} className="space-y-2 rounded-md border p-3">
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor={`chofer-telefono-${index}`}>Teléfono {index + 1} *</Label>
            {index === 0 && <Badge variant="secondary" data-testid="text-chofer-telefono-principal">Principal</Badge>}
            <div className="flex gap-1">
              {index > 0 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Subir teléfono ${index + 1}`}
                  data-testid={`button-subir-chofer-telefono-${index}`}
                  onClick={() => {
                    const reordered = [...telefonos];
                    [reordered[index - 1], reordered[index]] = [reordered[index], reordered[index - 1]];
                    onChange(reordered);
                  }}
                >
                  <ArrowUp className="h-4 w-4" />
                </Button>
              )}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                disabled={telefonos.length === 1}
                aria-label={`Quitar teléfono ${index + 1}`}
                data-testid={`button-quitar-chofer-telefono-${index}`}
                onClick={() => onChange(telefonos.filter((_, position) => position !== index))}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <Input
            id={`chofer-telefono-${index}`}
            data-testid={`input-chofer-telefono-${index}`}
            type="tel"
            maxLength={32}
            value={telefono.numero}
            onChange={(event) => update(index, { numero: event.target.value })}
          />
          <Label htmlFor={`chofer-etiqueta-${index}`}>Etiqueta {index + 1} (opcional)</Label>
          <Input
            id={`chofer-etiqueta-${index}`}
            data-testid={`input-chofer-etiqueta-${index}`}
            placeholder="Ej. Personal, trabajo"
            maxLength={40}
            value={telefono.etiqueta ?? ""}
            onChange={(event) => update(index, { etiqueta: event.target.value })}
          />
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        data-testid="button-agregar-chofer-telefono"
        onClick={() => onChange([...telefonos, { numero: "" }])}
      >
        <Plus className="mr-2 h-4 w-4" />
        Agregar teléfono
      </Button>
    </fieldset>
  );
}