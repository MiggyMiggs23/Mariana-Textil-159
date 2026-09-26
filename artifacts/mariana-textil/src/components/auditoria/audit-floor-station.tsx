import { useEffect, useRef, useState } from "react";
import { compareFloorLevels, lowestActiveFloor } from "../../../../../lib/floor-order.mjs";
import type { AuditFloor } from "./use-audit-floors";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// Match isDesktopAuditScanner in api-server/lib/auditoria-inventario.ts.
// Viewport width is intentionally NOT used: resizing/rotation cannot unlock floors.
export function isMobileAuditDevice(userAgent: string): boolean {
  return /Android|iPhone|iPad|iPod|Mobile|Tablet/i.test(userAgent);
}

export function AuditFloorStation({
  floors, ready, error, mobile, joined, selectedId, onSelect,
}: {
  floors: AuditFloor[];
  ready: boolean;
  error: boolean;
  mobile: boolean;
  joined: boolean;
  selectedId: number | null;
  onSelect: (id: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [confirming, setConfirming] = useState(false);
  const prompted = useRef(false);
  floors = floors.filter((floor) => floor.activo).sort(compareFloorLevels);
  const current = mobile ? floors.find((floor) => floor.id === selectedId) : lowestActiveFloor(floors);
  const candidate = floors.find((floor) => String(floor.id) === draft);

  useEffect(() => {
    if (current) prompted.current = false;
    if (joined && mobile && ready && floors.length > 0 && !current && !prompted.current) {
      prompted.current = true;
      setOpen(true);
    }
  }, [joined, mobile, ready, floors.length, current]);

  const close = () => {
    setOpen(false);
    setDraft("");
    setConfirming(false);
  };

  return (
    <>
      <div className="rounded-xl border-2 border-primary/40 bg-primary/5 px-4 py-4 mb-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
        data-testid="audit-floor-banner">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Piso real de escaneo</p>
          <p className="text-2xl sm:text-3xl font-black text-foreground break-words" data-testid="audit-floor-name">
            {error ? "No se pudieron cargar los pisos" : !ready ? "Cargando pisos..." :
              floors.length === 0 ? "Faltan pisos configurados" :
                !mobile && !current ? "Falta configurar el nivel numérico de los pisos" :
                current?.nombre ?? "Selecciona un piso"}
          </p>
          {ready && floors.length === 0 && (
            <p className="text-sm text-destructive">Configura al menos un piso activo del sitio antes de escanear.</p>
          )}
          {ready && floors.length > 0 && !mobile && (
            <p className="text-xs text-muted-foreground">Computadora: piso activo de menor nivel numérico. Todos los pisos activos deben tener nivel configurado.</p>
          )}
        </div>
        {joined && mobile && ready && floors.length > 0 && (
          <Button type="button" variant="outline" size="lg" className="w-full sm:w-auto min-h-12 font-bold"
            data-testid="button-change-audit-floor" onClick={() => {
              setDraft(current ? String(current.id) : "");
              setConfirming(false);
              setOpen(true);
            }}>
            Cambiar piso
          </Button>
        )}
      </div>
      <Dialog open={open && joined && mobile && ready && floors.length > 0} onOpenChange={(next) => { if (!next) close(); }}>
        <DialogContent data-testid="dialog-audit-floor">
          <DialogHeader>
            <DialogTitle>{confirming ? "Confirmar piso real" : "Elegir piso de escaneo"}</DialogTitle>
            <DialogDescription>Solo puedes elegir un piso activo configurado para este sitio.</DialogDescription>
          </DialogHeader>
          {confirming ? (
            <p className="text-lg font-bold" data-testid="audit-floor-confirmation">
              Vas a registrar en {candidate?.nombre}. ¿Correcto?
            </p>
          ) : (
            <Select value={draft} onValueChange={setDraft}>
              <SelectTrigger className="w-full h-12" data-testid="select-audit-floor">
                <SelectValue placeholder="Selecciona un piso" />
              </SelectTrigger>
              <SelectContent>
                {floors.map((floor) => <SelectItem key={floor.id} value={String(floor.id)}>{floor.nombre}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={close}>Cancelar</Button>
            {confirming ? (
              <Button type="button" disabled={!candidate} data-testid="button-confirm-audit-floor"
                onClick={() => { if (candidate) onSelect(candidate.id); close(); }}>
                Confirmar piso
              </Button>
            ) : (
              <Button type="button" disabled={!candidate} data-testid="button-continue-audit-floor"
                onClick={() => setConfirming(true)}>Continuar</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}