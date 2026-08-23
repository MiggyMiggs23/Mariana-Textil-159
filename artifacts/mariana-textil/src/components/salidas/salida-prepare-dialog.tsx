import { useState, useMemo, useEffect } from "react";
import { 
  usePrepararSalida,
  useListRollos,
  getListRollosQueryKey,
  SalidaDetail
} from "@workspace/api-client-react";
import { getApiErrorMessage } from "@/lib/api-error";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Loader2, Search, ArrowRight } from "lucide-react";
import { Input } from "@/components/ui/input";

export function SalidaPrepareDialog({ 
  salida, 
  open, 
  onOpenChange, 
  onSuccess 
}: { 
  salida: SalidaDetail; 
  open: boolean; 
  onOpenChange: (o: boolean) => void;
  onSuccess: () => void;
}) {
  const { toast } = useToast();
  const prepareMutation = usePrepararSalida();

  // State to hold selected rollos per linea
  // Record<lineaId, Set<rolloId>>
  const [selectedRollos, setSelectedRollos] = useState<Record<number, Set<number>>>({});
  
  // To allow selecting rollos, we need to focus on one linea at a time if there are multiple, or just list all products.
  const [activeLineaId, setActiveLineaId] = useState<number>(salida.lineas[0]?.id || 0);
  const [searchSerie, setSearchSerie] = useState("");
  const [debouncedSerie, setDebouncedSerie] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSerie(searchSerie), 300);
    return () => clearTimeout(timer);
  }, [searchSerie]);

  const activeLinea = salida.lineas.find(l => l.id === activeLineaId);

  const { data: rollosResult, isLoading } = useListRollos({
    ubicacionId: salida.origenId,
    productoId: activeLinea?.productoId,
    estado: 'DISPONIBLE',
    serie: debouncedSerie || undefined,
    pageSize: 50
  }, {
    query: {
      enabled: open && !!activeLinea,
      queryKey: getListRollosQueryKey({
        ubicacionId: salida.origenId,
        productoId: activeLinea?.productoId,
        estado: 'DISPONIBLE',
        serie: debouncedSerie || undefined,
        pageSize: 50
      })
    }
  });

  const toggleRollo = (rolloId: number) => {
    setSelectedRollos(prev => {
      const next = { ...prev };
      const set = new Set(next[activeLineaId] || []);
      if (set.has(rolloId)) {
        set.delete(rolloId);
      } else {
        set.add(rolloId);
      }
      next[activeLineaId] = set;
      return next;
    });
  };

  const getSelectedCount = (lineaId: number) => {
    return selectedRollos[lineaId]?.size || 0;
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const exactMatch = rollosResult?.items.find(r => r.serie.toLowerCase() === searchSerie.trim().toLowerCase());
      if (exactMatch) {
        toggleRollo(exactMatch.id);
        setSearchSerie("");
      }
    }
  };

  const onSubmit = () => {
    // validation
    for (const linea of salida.lineas) {
      const count = getSelectedCount(linea.id);
      if (count === 0) {
        toast({ title: "Atención", description: `La línea de ${linea.skuProducto} debe tener al menos un rollo.`, variant: "destructive" });
        return;
      }
      if (linea.rollosSolicitados && count !== linea.rollosSolicitados) {
        toast({ title: "Atención", description: `La línea de ${linea.skuProducto} requiere exactamente ${linea.rollosSolicitados} rollos.`, variant: "destructive" });
        return;
      }
    }

    const lineas = salida.lineas.map(l => ({
      lineaId: l.id,
      rolloIds: Array.from(selectedRollos[l.id] || [])
    })).filter(l => l.rolloIds.length > 0);

    prepareMutation.mutate({
      id: salida.id,
      data: { lineas }
    }, {
      onSuccess: () => {
        toast({ title: "Mercancía preparada" });
        onSuccess();
      },
      onError: (err) => {
        toast({ title: "Error", description: getApiErrorMessage(err), variant: "destructive" });
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="px-6 py-4 border-b border-slate-100 flex-shrink-0">
          <DialogTitle>Preparar Mercancía</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
          {/* Sidebar with lineas */}
          <div className="w-full md:w-1/3 border-r border-slate-100 bg-slate-50/50 flex flex-col">
            <div className="p-3 border-b border-slate-100 font-medium text-sm text-slate-500">
              Líneas solicitadas
            </div>
            <div className="flex-1 overflow-y-auto">
              {salida.lineas.map(linea => {
                const isSelected = activeLineaId === linea.id;
                const count = getSelectedCount(linea.id);
                return (
                  <button
                    key={linea.id}
                    data-testid={`btn-select-linea-${linea.id}`}
                    onClick={() => setActiveLineaId(linea.id)}
                    className={`w-full text-left p-4 border-b border-slate-100 transition-colors ${isSelected ? 'bg-white border-l-2 border-l-primary' : 'hover:bg-slate-100 border-l-2 border-l-transparent'}`}
                  >
                    <p className="font-semibold text-sm text-slate-900">{linea.skuProducto}</p>
                    <p className="text-xs text-slate-500 mt-1 truncate">{linea.telaProducto} - {linea.colorProducto}</p>
                    
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-xs text-slate-500">Cant: {linea.cantidadSolicitada}</span>
                      <Badge variant={count > 0 ? "default" : "secondary"} className="text-[10px]">
                        {count} {linea.rollosSolicitados ? `/ ${linea.rollosSolicitados}` : ''} rollos
                      </Badge>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Rollos content */}
          <div className="flex-1 flex flex-col bg-white">
            <div className="p-4 border-b border-slate-100 flex items-center gap-3 bg-slate-50/30">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  data-testid="input-prepare-search-serie"
                  placeholder="Escanear o buscar serie..."
                  value={searchSerie}
                  onChange={e => setSearchSerie(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="pl-9 h-9"
                  autoFocus
                />
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
              {isLoading ? (
                <div className="flex flex-col items-center justify-center h-full text-slate-400">
                  <Loader2 className="w-6 h-6 animate-spin mb-2" />
                  <p className="text-sm">Buscando rollos disponibles...</p>
                </div>
              ) : !rollosResult?.items.length ? (
                <div className="flex flex-col items-center justify-center h-full text-slate-400">
                  <p className="text-sm">No hay rollos disponibles para este producto</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {rollosResult.items.map(rollo => {
                    const checked = selectedRollos[activeLineaId]?.has(rollo.id) || false;
                    return (
                      <div 
                        key={rollo.id}
                        data-testid={`btn-toggle-rollo-${rollo.id}`}
                        role="button"
                        tabIndex={0}
                        aria-pressed={checked}
                        className={`flex items-start space-x-3 p-3 rounded-lg border cursor-pointer transition-colors ${checked ? 'border-primary bg-primary/5' : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'}`}
                        onClick={(e) => { e.preventDefault(); toggleRollo(rollo.id); }}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            toggleRollo(rollo.id);
                          }
                        }}
                      >
                        <Checkbox 
                          checked={checked} 
                          className="mt-0.5 pointer-events-none"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="font-mono text-sm font-semibold text-slate-900">{rollo.serie}</p>
                          <div className="flex items-center justify-between mt-1">
                            <span className="text-xs text-slate-500">Cantidad:</span>
                            <span className="text-sm font-medium">{rollo.cantidadActual}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="px-6 py-4 border-t border-slate-100 flex-shrink-0 bg-slate-50/50">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={prepareMutation.isPending}>
            Cancelar
          </Button>
          <Button data-testid="btn-submit-prepare" onClick={onSubmit} disabled={prepareMutation.isPending}>
            {prepareMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Confirmar Preparación
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
