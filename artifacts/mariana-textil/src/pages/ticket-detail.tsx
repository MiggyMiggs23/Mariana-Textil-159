import { useEffect, useRef, useState } from "react";
import { useRoute, Link } from "wouter";
import {
  useObtenerTicket,
  getObtenerTicketQueryKey,
  useCancelarTicket,
  EstadoTicket,
  Role,
  useGetCurrentUser,
  getGetCurrentUserQueryKey
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardFooter, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, ArrowLeft, Printer, Ban, ShieldAlert } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { hasPermission, Modules } from "@/lib/permisos";

export default function TicketDetailPage() {
  const [, params] = useRoute("/tickets/:id");
  const ticketId = Number(params?.id);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [cancelOpen, setCancelOpen] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [adminUser, setAdminUser] = useState("");
  const [adminPass, setAdminPass] = useState("");

  const { data: user } = useGetCurrentUser({
    query: { queryKey: getGetCurrentUserQueryKey() }
  });

  const { data: ticket, isLoading } = useObtenerTicket(ticketId, {
    query: {
      enabled: !isNaN(ticketId),
      queryKey: getObtenerTicketQueryKey(ticketId)
    }
  });

  const cancelarTicket = useCancelarTicket();
  const autoPrintStarted = useRef(false);
  const returnPath = user?.rol === Role.CAJA ? "/cobros" : "/pos";
  const canCancel =
    user?.rol === Role.ADMIN ||
    (user != null && hasPermission(user, Modules.POS, "crear"));

  useEffect(() => {
    if (
      !ticket ||
      autoPrintStarted.current ||
      new URLSearchParams(window.location.search).get("print") !== "3"
    ) return;
    autoPrintStarted.current = true;
    document.body.classList.add("print-80mm");
    const timers = [250, 900, 1550].map((delay) =>
      window.setTimeout(() => window.print(), delay),
    );
    timers.push(
      window.setTimeout(() => {
        document.body.classList.remove("print-80mm");
        window.history.replaceState({}, "", `/tickets/${ticket.id}`);
      }, 2200),
    );
    return () => timers.forEach(window.clearTimeout);
  }, [ticket]);

  const handlePrint80mm = () => {
    // Usamos window.print() pero con una clase especial en el body si se requiere.
    // CSS en index.css debería ocultar layout y mostrar solo el área de impresión
    document.body.classList.add('print-80mm');
    window.print();
    setTimeout(() => {
      document.body.classList.remove('print-80mm');
    }, 1000);
  };

  const handlePrintCarta = () => {
    document.body.classList.add('print-carta');
    window.print();
    setTimeout(() => {
      document.body.classList.remove('print-carta');
    }, 1000);
  };

  const handleCancelar = () => {
    if (!motivo.trim()) {
      toast({ title: "Debes ingresar un motivo", variant: "destructive" });
      return;
    }
    
    let credencialesAdmin = null;
    if (user?.rol !== Role.ADMIN) {
      if (!adminUser || !adminPass) {
        toast({ title: "Se requieren credenciales de administrador", variant: "destructive" });
        return;
      }
      credencialesAdmin = { usuario: adminUser, password: adminPass };
    }

    cancelarTicket.mutate({ id: ticketId, data: { motivo, credencialesAdmin } }, {
      onSuccess: () => {
        toast({ title: "Ticket cancelado correctamente" });
        setCancelOpen(false);
        queryClient.invalidateQueries({ queryKey: getObtenerTicketQueryKey(ticketId) });
      },
      onError: (err: any) => {
        toast({ title: "Error al cancelar", description: err.message || err.error, variant: "destructive" });
      }
    });
  };

  if (isLoading) {
    return <div className="flex h-[calc(100dvh-8rem)] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  if (!ticket) {
    return (
      <div className="p-8 text-center">
        <h2 className="text-xl font-semibold text-destructive">Ticket no encontrado</h2>
        <Link href={returnPath}>
          <Button variant="link" className="mt-4">Volver al POS</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto h-full flex flex-col gap-6 print:m-0 print:max-w-none print:w-full">
      <div className="flex items-center justify-between no-print">
        <div className="flex items-center gap-4">
          <Link href={returnPath}>
            <Button variant="outline" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-sidebar">Ticket #{ticket.folio}</h1>
            <p className="text-muted-foreground text-sm">{ticket.tipo} - {ticket.nombreUbicacion}</p>
          </div>
        </div>
        <div className="flex gap-3">
          {canCancel && ticket.estado !== EstadoTicket.CANCELADO && (
            <Button variant="destructive" onClick={() => setCancelOpen(true)}>
              <Ban className="h-4 w-4 mr-2" /> Cancelar Ticket
            </Button>
          )}
          <Button variant="outline" onClick={handlePrintCarta}>
            <Printer className="h-4 w-4 mr-2" /> Imprimir Carta
          </Button>
          <Button onClick={handlePrint80mm}>
            <Printer className="h-4 w-4 mr-2" /> Imprimir Ticket (80mm)
          </Button>
        </div>
      </div>

      {/* Visor de Ticket (Pantalla / Carta) */}
      <Card className="no-print shadow-md">
        <CardHeader className="bg-sidebar/5 border-b flex flex-row items-start justify-between">
          <div>
            <CardTitle>Detalle de Operación</CardTitle>
            <CardDescription>Emitido por {ticket.nombreUsuarioTerminal}</CardDescription>
          </div>
          <div className="text-right">
            <div className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${
              ticket.estado === EstadoTicket.CANCELADO ? 'bg-destructive/20 text-destructive' :
              ticket.cobrado === true ? 'bg-emerald-100 text-emerald-700' : 
              ticket.cobrado === false ? 'bg-amber-100 text-amber-700' : 'bg-primary/10 text-primary'
            }`}>
              {ticket.estado === EstadoTicket.CANCELADO ? 'CANCELADO' : 
               ticket.cobrado === true ? 'PAGADO' : 
               ticket.cobrado === false ? 'PENDIENTE' : 'REGISTRADO'}
            </div>
            {ticket.clienteId && (
              <div className="mt-2 text-sm text-muted-foreground">Cliente: {ticket.nombreCliente}</div>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm text-left">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-semibold">Producto</th>
                <th className="px-4 py-3 font-semibold text-right">Cant.</th>
                <th className="px-4 py-3 font-semibold text-right">Precio Unit.</th>
                <th className="px-4 py-3 font-semibold text-right">Importe</th>
                {(user?.rol === Role.CAJA || user?.rol === Role.ADMIN) && (
                  <>
                    <th className="px-4 py-3 font-semibold text-right">Costo</th>
                    <th className="px-4 py-3 font-semibold text-right">Margen</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody className="divide-y">
              {ticket.lineas.map(linea => (
                <tr key={linea.id} className="hover:bg-muted/10">
                  <td className="px-4 py-3">
                    <div className="font-medium text-foreground">{linea.telaProducto} - {linea.colorProducto}</div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-muted-foreground">{linea.skuProducto}</span>
                      {linea.serieRollo && (
                        <span className="text-[10px] bg-primary/10 text-primary px-1.5 rounded uppercase font-mono">
                          {linea.serieRollo}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right font-mono">{Number(linea.cantidad)} {linea.unidadProducto}</td>
                  <td className="px-4 py-3 text-right">{Number(linea.precioUnitario).toLocaleString("es-MX", { style: "currency", currency: "MXN" })}</td>
                  <td className="px-4 py-3 text-right font-semibold">{Number(linea.importe).toLocaleString("es-MX", { style: "currency", currency: "MXN" })}</td>
                  {(user?.rol === Role.CAJA || user?.rol === Role.ADMIN) && (
                    <>
                      <td className="px-4 py-3 text-right">{linea.costoTotalCongelado == null ? "—" : Number(linea.costoTotalCongelado).toLocaleString("es-MX", { style: "currency", currency: "MXN" })}</td>
                      <td className="px-4 py-3 text-right">{linea.margen == null ? "—" : Number(linea.margen).toLocaleString("es-MX", { style: "currency", currency: "MXN" })}</td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
        <CardFooter className="bg-muted/20 border-t p-6 flex-col items-end gap-2">
          <div className="flex justify-between w-64 text-muted-foreground">
            <span>Subtotal:</span>
            <span>{Number(ticket.subtotal).toLocaleString("es-MX", { style: "currency", currency: "MXN" })}</span>
          </div>
          <div className="flex justify-between w-64 text-xl font-bold text-foreground mt-2 border-t pt-2">
            <span>Total:</span>
            <span>{Number(ticket.total).toLocaleString("es-MX", { style: "currency", currency: "MXN" })}</span>
          </div>
        </CardFooter>
      </Card>

      {/* --- ESTRUCTURAS DE IMPRESIÓN --- */}
      
      {/* 80mm Ticket */}
      <div className="hidden print-80mm-only print-ticket-container">
        <div className="text-center mb-4">
          <h2 className="text-lg font-bold">MARIANA TEXTIL</h2>
          <p className="text-xs">{ticket.nombreUbicacion}</p>
          <p className="text-xs">Folio: {ticket.folio}</p>
          <p className="text-xs">Tipo: {ticket.tipo}</p>
          <p className="text-xs">{new Date(ticket.createdAt).toLocaleString('es-MX')}</p>
        </div>
        
        <div className="border-t border-b border-black py-2 mb-2">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-black/20">
                <th className="text-left font-normal pb-1">Art.</th>
                <th className="text-right font-normal pb-1">Cant</th>
                <th className="text-right font-normal pb-1">Imp</th>
              </tr>
            </thead>
            <tbody>
              {ticket.lineas.map(linea => (
                <tr key={linea.id}>
                  <td className="py-1">
                    <div className="line-clamp-2">{linea.telaProducto} {linea.colorProducto}</div>
                    {linea.serieRollo && <div className="text-[10px] uppercase font-mono">{linea.serieRollo}</div>}
                  </td>
                  <td className="text-right align-top py-1 font-mono">{Number(linea.cantidad)}</td>
                  <td className="text-right align-top py-1">{Number(linea.importe).toLocaleString("es-MX", { style: "currency", currency: "MXN" })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        <div className="text-right font-bold text-sm">
          TOTAL: {Number(ticket.total).toLocaleString("es-MX", { style: "currency", currency: "MXN" })}
        </div>

        {ticket.estado === EstadoTicket.CANCELADO && (
          <div className="text-center mt-4 border border-black p-1 text-xs font-bold uppercase">
            *** TICKET CANCELADO ***
          </div>
        )}
        
        <div className="text-center mt-6 text-[10px] italic">
          ¡Gracias por su compra!
          <br/>Revise su mercancía, no hay devoluciones.
        </div>
      </div>
      
      {/* Carta Formato */}
      <div className="hidden print-carta-only print-document-container">
        <div className="flex justify-between items-start border-b-2 border-black pb-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold">MARIANA TEXTIL</h1>
            <p className="text-sm mt-1">{ticket.nombreUbicacion}</p>
          </div>
          <div className="text-right">
            <h2 className="text-2xl font-bold text-gray-500">TICKET DE VENTA</h2>
            <p className="text-lg">Folio: <span className="font-bold text-black">{ticket.folio}</span></p>
            <p className="text-sm">Fecha: {new Date(ticket.createdAt).toLocaleString('es-MX')}</p>
          </div>
        </div>

        <div className="mb-6 grid grid-cols-2 gap-4 text-sm">
          <div>
            <div className="font-bold">Cliente:</div>
            <div>{ticket.clienteId ? ticket.nombreCliente : 'Mostrador'}</div>
          </div>
          <div>
            <div className="font-bold">Atendió:</div>
            <div>{ticket.nombreUsuarioTerminal}</div>
            <div className="font-bold mt-2">Estado:</div>
            <div>
              {ticket.estado === EstadoTicket.CANCELADO ? 'CANCELADO' : 
               ticket.cobrado === true ? 'PAGADO' : 
               ticket.cobrado === false ? 'PENDIENTE' : 'REGISTRADO'}
            </div>
          </div>
        </div>

        <table className="w-full text-sm border-collapse mb-6">
          <thead>
            <tr className="bg-gray-100">
              <th className="border border-gray-300 p-2 text-left">SKU</th>
              <th className="border border-gray-300 p-2 text-left">Descripción</th>
              <th className="border border-gray-300 p-2 text-left">Serie</th>
              <th className="border border-gray-300 p-2 text-right">Cant.</th>
              <th className="border border-gray-300 p-2 text-right">Precio</th>
              <th className="border border-gray-300 p-2 text-right">Importe</th>
            </tr>
          </thead>
          <tbody>
            {ticket.lineas.map(linea => (
              <tr key={linea.id}>
                <td className="border border-gray-300 p-2 font-mono text-xs">{linea.skuProducto}</td>
                <td className="border border-gray-300 p-2">{linea.telaProducto} - {linea.colorProducto}</td>
                <td className="border border-gray-300 p-2 font-mono text-xs">{linea.serieRollo || '-'}</td>
                <td className="border border-gray-300 p-2 text-right font-mono">{Number(linea.cantidad)} {linea.unidadProducto}</td>
                <td className="border border-gray-300 p-2 text-right">{Number(linea.precioUnitario).toLocaleString("es-MX", { style: "currency", currency: "MXN" })}</td>
                <td className="border border-gray-300 p-2 text-right font-bold">{Number(linea.importe).toLocaleString("es-MX", { style: "currency", currency: "MXN" })}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="flex justify-end">
          <div className="w-64">
            <div className="flex justify-between border-b border-gray-200 py-1">
              <span>Subtotal:</span>
              <span>{Number(ticket.subtotal).toLocaleString("es-MX", { style: "currency", currency: "MXN" })}</span>
            </div>
            <div className="flex justify-between py-2 text-xl font-bold">
              <span>Total:</span>
              <span>{Number(ticket.total).toLocaleString("es-MX", { style: "currency", currency: "MXN" })}</span>
            </div>
          </div>
        </div>
      </div>

      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent className="sm:max-w-md no-print">
          <DialogHeader>
            <DialogTitle className="text-destructive flex items-center gap-2">
              <ShieldAlert className="h-5 w-5" /> Confirmar Cancelación
            </DialogTitle>
            <DialogDescription>
              Esta acción revertirá los movimientos de inventario de este ticket. Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Motivo de cancelación</Label>
              <Textarea 
                value={motivo} 
                onChange={e => setMotivo(e.target.value)} 
                placeholder="Explica el motivo (mínimo 10 caracteres)"
              />
            </div>
            {user?.rol !== Role.ADMIN && (
              <div className="bg-destructive/5 p-4 rounded-md border border-destructive/20 space-y-4">
                <p className="text-sm font-semibold text-destructive">Se requiere autorización de administrador</p>
                <div className="space-y-2">
                  <Label>Usuario ADMIN</Label>
                  <Input value={adminUser} onChange={e => setAdminUser(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Contraseña ADMIN</Label>
                  <Input type="password" value={adminPass} onChange={e => setAdminPass(e.target.value)} />
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelOpen(false)}>Atrás</Button>
            <Button variant="destructive" onClick={handleCancelar} disabled={cancelarTicket.isPending}>
              {cancelarTicket.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Cancelar Definitivamente
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}