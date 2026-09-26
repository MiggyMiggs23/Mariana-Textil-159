import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ClienteContextCombobox } from "@/components/cliente-context-combobox";
import { ClientePagoDialog } from "@/components/cliente-pago-dialog";
import { Wallet } from "lucide-react";
import { E3_ENABLED } from "@/lib/e3-feature-flags";
import { useGetCurrentUser } from "@workspace/api-client-react";
import { hasPermission } from "@/lib/permisos";

export function CajaAbonoE3Dialog() {
  const [open, setOpen] = useState(false);
  const [selectedClienteId, setSelectedClienteId] = useState<number | null>(null);
  const { data: user } = useGetCurrentUser();

  if (!E3_ENABLED || !hasPermission(user, "caja_abonos", "crear")) return null;

  return (
    <>
      <Button 
        onClick={() => setOpen(true)} 
        className="font-bold gap-2"
        data-testid="button-caja-registrar-abono"
      >
        <Wallet className="h-4 w-4" />
        Registrar Abono
      </Button>

      {/* Selector de Cliente */}
      <Dialog open={open && !selectedClienteId} onOpenChange={(val) => {
        if (!val) setOpen(false);
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Registrar Abono de Cliente</DialogTitle>
            <DialogDescription>
              Selecciona el cliente que realiza el pago.
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-6">
            <ClienteContextCombobox 
              value={selectedClienteId} 
              onChange={(id) => {
                if (id) setSelectedClienteId(id);
              }} 
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Reutilización del diálogo de pago original */}
      {selectedClienteId && (
        <ClientePagoDialog
          open={open && selectedClienteId !== null}
          onOpenChange={(val) => {
            if (!val) {
              setOpen(false);
              setSelectedClienteId(null);
            }
          }}
          clienteId={selectedClienteId}
          origen="CAJA"
        />
      )}
    </>
  );
}
