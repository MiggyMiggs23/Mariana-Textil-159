import { useState, useRef } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Equipo, useToggleEquipoChecklist, getListEquiposQueryKey } from "@workspace/api-client-react";
import { AlertCircle, CheckCircle2, User, Clock } from "lucide-react";

interface EquipoChecklistDialogProps {
  open: boolean;
  onClose: () => void;
  equipo: Equipo;
  canEdit: boolean;
}

export function EquipoChecklistDialog({ open, onClose, equipo, canEdit }: EquipoChecklistDialogProps) {
  const queryClient = useQueryClient();
  const toggleMutation = useToggleEquipoChecklist();
  
  // We maintain local optimistic state for immediate feedback
  const [optimisticChecklist, setOptimisticChecklist] = useState(equipo.checklist);
  const pendingRequests = useRef(new Set<string>());

  const handleToggle = (itemKey: string, currentChecked: boolean) => {
    if (!canEdit) return;
    
    // Prevent double rapid clicks
    if (pendingRequests.current.has(itemKey)) return;
    pendingRequests.current.add(itemKey);

    const newChecked = !currentChecked;

    // Optimistic update
    setOptimisticChecklist(prev => 
      prev.map(item => 
        item.key === itemKey 
          ? { ...item, checked: newChecked } 
          : item
      )
    );

    toggleMutation.mutate(
      { 
        id: equipo.id, 
        itemKey, 
        data: { checked: newChecked } 
      },
      {
        onSuccess: (data) => {
          pendingRequests.current.delete(itemKey);
          // Sync with server state
          setOptimisticChecklist(data.checklist);
          
          // Invalidate lists in the background
          queryClient.invalidateQueries({ queryKey: getListEquiposQueryKey() });
        },
        onError: (err: any) => {
          pendingRequests.current.delete(itemKey);
          
          // Revert on error
          setOptimisticChecklist(equipo.checklist);
          
          toast.error("Error al actualizar checklist", {
            description: err.data?.error || err.message || "Ocurrió un error inesperado"
          });
        }
      }
    );
  };

  const isComplete = optimisticChecklist.every(item => item.checked);
  const checkedCount = optimisticChecklist.filter(item => item.checked).length;
  const totalCount = optimisticChecklist.length;

  return (
    <Dialog open={open} onOpenChange={(val) => !val && onClose()}>
      <DialogContent className="flex w-[calc(100%-2rem)] max-h-[calc(100dvh-2rem)] flex-col overflow-hidden sm:max-w-[500px]">
        <DialogHeader>
          <div className="flex items-center justify-between pr-4">
            <DialogTitle className="text-xl">{equipo.identificador}</DialogTitle>
          </div>
          <DialogDescription>
            Validación de configuración para {equipo.tipoLabel.toLowerCase()}
          </DialogDescription>
        </DialogHeader>

        <div className="py-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isComplete ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            ) : (
              <AlertCircle className="w-5 h-5 text-muted-foreground" />
            )}
            <span className="font-medium text-sm">
              {checkedCount} de {totalCount} validaciones
            </span>
          </div>
          {!canEdit && (
            <span className="text-xs text-muted-foreground italic">Modo lectura</span>
          )}
        </div>

        <ScrollArea className="-mx-6 min-h-0 flex-1 px-6">
          <div className="space-y-3 pb-4">
            {optimisticChecklist.map((item) => (
              <div 
                key={item.key}
                className={`relative flex items-start space-x-3 border rounded-lg p-3 transition-colors ${
                  item.checked 
                    ? "bg-emerald-50/50 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-900" 
                    : "bg-background border-border"
                } ${canEdit ? "hover:border-primary/50 cursor-pointer" : ""}`}
                onClick={() => canEdit && handleToggle(item.key, item.checked)}
              >
                <div className="mt-0.5" onClick={e => e.stopPropagation()}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div>
                        <Checkbox 
                          checked={item.checked}
                          onCheckedChange={() => handleToggle(item.key, item.checked)}
                          disabled={!canEdit || pendingRequests.current.has(item.key)}
                          className={item.checked ? "data-[state=checked]:bg-emerald-600 data-[state=checked]:border-emerald-600" : ""}
                          data-testid={`checkbox-checklist-${item.key}`}
                        />
                      </div>
                    </TooltipTrigger>
                    {!canEdit && (
                      <TooltipContent>No tienes permisos para editar equipos</TooltipContent>
                    )}
                  </Tooltip>
                </div>
                
                <div className="flex-1 space-y-1">
                  <p className={`text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 ${
                    item.checked ? "text-foreground" : "text-foreground/80"
                  }`}>
                    {item.label}
                  </p>
                  
                  {item.checked && item.actorNombre && item.checkedAt && (
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-1.5">
                      <div className="flex items-center text-xs text-muted-foreground">
                        <User className="w-3 h-3 mr-1" />
                        {item.actorNombre}
                      </div>
                      <div className="flex items-center text-xs text-muted-foreground">
                        <Clock className="w-3 h-3 mr-1" />
                        {format(new Date(item.checkedAt), "dd MMM yyyy HH:mm", { locale: es })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>

        <div className="pt-4 border-t mt-auto flex justify-end">
          <Button variant="outline" onClick={onClose}>
            Cerrar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}