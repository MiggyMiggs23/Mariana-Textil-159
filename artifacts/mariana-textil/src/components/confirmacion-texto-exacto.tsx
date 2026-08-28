import { useId, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  coincideTextoExacto,
  ejecutarSiTextoCoincide,
} from "@/lib/confirmacion-texto-exacto";

export { coincideTextoExacto, ejecutarSiTextoCoincide };

export type ConfirmacionTextoExactoProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  titulo: string;
  descripcion: string;
  textoRequerido: string;
  etiqueta?: string;
  textoConfirmar?: string;
  pendiente?: boolean;
  onConfirm: (texto: string) => void;
};

/**
 * Protección reutilizable para acciones destructivas. La coincidencia es
 * deliberadamente literal: no elimina espacios ni ignora mayúsculas.
 */
export function ConfirmacionTextoExacto({
  open,
  onOpenChange,
  titulo,
  descripcion,
  textoRequerido,
  etiqueta = "Escribe el texto solicitado para continuar",
  textoConfirmar = "Confirmar acción",
  pendiente = false,
  onConfirm,
}: ConfirmacionTextoExactoProps) {
  const [texto, setTexto] = useState("");
  const inputId = useId();
  const puedeConfirmar = coincideTextoExacto(texto, textoRequerido);

  const handleOpenChange = (siguiente: boolean) => {
    if (!siguiente) setTexto("");
    onOpenChange(siguiente);
  };

  const handleConfirm = () => {
    if (!pendiente)
      ejecutarSiTextoCoincide(texto, textoRequerido, () => onConfirm(texto));
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-destructive">{titulo}</DialogTitle>
          <DialogDescription>
            {descripcion} Esta acción no se puede deshacer.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2 py-2">
          <Label htmlFor={inputId}>{etiqueta}</Label>
          <p className="text-sm text-muted-foreground">
            Escribe exactamente <strong className="font-mono text-foreground">{textoRequerido}</strong>.
          </p>
          <Input
            id={inputId}
            value={texto}
            onChange={(event) => setTexto(event.target.value)}
            aria-describedby={`${inputId}-instruccion`}
            autoComplete="off"
          />
          <p id={`${inputId}-instruccion`} className="sr-only">
            El botón de confirmación se habilita únicamente cuando el texto coincide exactamente.
          </p>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={!puedeConfirmar || pendiente}
            onClick={handleConfirm}
          >
            {pendiente ? "Procesando..." : textoConfirmar}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}