import { useEffect, useRef, useState } from "react";
import { useRoute, Link } from "wouter";
import {
  useObtenerTicket,
  getObtenerTicketQueryKey,
  useCancelarTicket,
  EstadoTicket,
  Role,
  useGetCurrentUser,
  getGetCurrentUserQueryKey,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardFooter,
  CardDescription,
} from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, ArrowLeft, Printer, Ban, ShieldAlert } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { hasPermission, Modules } from "@/lib/permisos";
import { getApiErrorMessage } from "@/lib/api-error";
import { PasswordInput } from "@/components/ui/password-input";
import { formatNumber } from "@workspace/number-format";
import { groupTicketLinesByModality } from "@/lib/ticket-lines";
import { MonochromeBrandLogo } from "@/components/monochrome-brand-logo";
import { ConfirmacionTextoExacto } from "@/components/confirmacion-texto-exacto";

export default function TicketDetailPage() {
  const [, params] = useRoute("/tickets/:id");
  const ticketId = Number(params?.id);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelConfirmationOpen, setCancelConfirmationOpen] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [adminUser, setAdminUser] = useState("");
  const [adminPass, setAdminPass] = useState("");
  const [showRolls, setShowRolls] = useState(false);
  const [passwordVisibilityResetKey, setPasswordVisibilityResetKey] = useState(0);

  const { data: user } = useGetCurrentUser({
    query: { queryKey: getGetCurrentUserQueryKey() },
  });

  const {
    data: ticket,
    isLoading,
    isError: ticketFailed,
    error: ticketError,
    refetch: retryTicket,
  } = useObtenerTicket(ticketId, {
    query: {
      enabled: !isNaN(ticketId),
      queryKey: getObtenerTicketQueryKey(ticketId),
    },
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
    )
      return;
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
    document.body.classList.add("print-80mm");
    window.print();
    setTimeout(() => {
      document.body.classList.remove("print-80mm");
    }, 1000);
  };

  const handlePrintCarta = () => {
    document.body.classList.add("print-carta");
    window.print();
    setTimeout(() => {
      document.body.classList.remove("print-carta");
    }, 1000);
  };

  const handleCancelar = () => {
    setPasswordVisibilityResetKey((current) => current + 1);
    if (!motivo.trim()) {
      toast({ title: "Debes ingresar un motivo", variant: "destructive" });
      return;
    }

    if (user?.rol !== Role.ADMIN) {
      if (!adminUser || !adminPass) {
        toast({
          title: "Se requieren credenciales de administrador",
          variant: "destructive",
        });
        return;
      }
    }

    setCancelConfirmationOpen(true);
  };

  const executeCancelar = () => {
    const credencialesAdmin =
      user?.rol === Role.ADMIN
        ? null
        : { usuario: adminUser, password: adminPass };
    cancelarTicket.mutate(
      { id: ticketId, data: { motivo, credencialesAdmin } },
      {
        onSuccess: () => {
          toast({ title: "Ticket cancelado correctamente" });
          setCancelOpen(false);
          setCancelConfirmationOpen(false);
          setAdminPass("");
          queryClient.invalidateQueries({
            queryKey: getObtenerTicketQueryKey(ticketId),
          });
        },
        onError: (err: unknown) => {
          toast({
            title: "Error al cancelar",
            description: getApiErrorMessage(
              err,
              "No se pudo cancelar el ticket.",
            ),
            variant: "destructive",
          });
        },
      },
    );
  };

  if (isLoading) {
    return (
      <div className="flex h-[calc(100dvh-8rem)] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (ticketFailed) {
    return (
      <div className="p-8 text-center" role="alert">
        <h2 className="text-xl font-semibold text-destructive">
          No se pudo cargar el ticket
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {getApiErrorMessage(
            ticketError,
            "Intenta consultar el ticket nuevamente.",
          )}
        </p>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => retryTicket()}
        >
          Intentar de nuevo
        </Button>
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="p-8 text-center">
        <h2 className="text-xl font-semibold text-destructive">
          Ticket no encontrado
        </h2>
        <Link href={returnPath}>
          <Button variant="link" className="mt-4">
            Volver al POS
          </Button>
        </Link>
      </div>
    );
  }

  const { rollos: uiRollos, metraje: uiMetraje } = groupTicketLinesByModality(ticket.lineas, showRolls);
  const { rollos: printRollos, metraje: printMetraje } = groupTicketLinesByModality(ticket.lineas, false);
  const customerName =
    ticket.clienteId === 1 || !ticket.clienteId
      ? "VENTA AL PÚBLICO"
      : ticket.nombreCliente || `Cliente #${ticket.clienteId}`;
  const createdAt = new Date(ticket.createdAt);
  const formattedDate = createdAt.toLocaleDateString("es-MX");
  const formattedTime = createdAt.toLocaleTimeString("es-MX", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="max-w-4xl mx-auto h-full flex flex-col gap-6 print:m-0 print:max-w-none print:w-full">
      <div className="flex flex-col gap-4 no-print sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Link href={returnPath}>
            <Button variant="outline" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-sidebar">
              Ticket #{ticket.folio}
            </h1>
            <p className="text-muted-foreground text-sm">
              {ticket.nombreUbicacion}
            </p>
          </div>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          {canCancel && ticket.estado !== EstadoTicket.CANCELADO && (
            <Button className="w-full sm:w-auto" variant="destructive" onClick={() => {
              setMotivo("");
              setAdminUser("");
              setAdminPass("");
              setPasswordVisibilityResetKey((current) => current + 1);
              setCancelOpen(true);
            }}>
              <Ban className="h-4 w-4 mr-2" /> Cancelar Ticket
            </Button>
          )}
          <Button className="w-full sm:w-auto" variant="outline" onClick={handlePrintCarta}>
            <Printer className="h-4 w-4 mr-2" /> Imprimir Media Carta
          </Button>
          <Button className="w-full sm:w-auto" onClick={handlePrint80mm}>
            <Printer className="h-4 w-4 mr-2" /> Imprimir Ticket (80mm)
          </Button>
        </div>
      </div>

      {/* Visor de Ticket (Pantalla / Carta) */}
      <Card className="no-print shadow-md">
        <CardHeader className="flex flex-col items-start justify-between gap-4 border-b bg-sidebar/5 sm:flex-row">
          <div>
            <CardTitle>Detalle de Operación</CardTitle>
            <CardDescription>
              Emitido por {ticket.nombreUsuarioTerminal}
            </CardDescription>
            <Button
              type="button"
              variant="link"
              className="h-auto px-0 pt-2 text-sm"
              onClick={() => setShowRolls((current) => !current)}
            >
              {showRolls ? "Ver agrupado" : "Ver rollos"}
            </Button>
          </div>
          <div className="text-left sm:text-right">
            <div
              className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${
                ticket.estado === EstadoTicket.CANCELADO
                  ? "bg-destructive/20 text-destructive"
                  : ticket.cobrado === true
                    ? "bg-emerald-100 text-emerald-700"
                    : ticket.cobrado === false
                      ? "bg-amber-100 text-amber-700"
                      : "bg-primary/10 text-primary"
              }`}
            >
              {ticket.estado === EstadoTicket.CANCELADO
                ? "CANCELADO"
                : ticket.cobrado === true
                  ? "PAGADO"
                  : ticket.cobrado === false
                    ? "PENDIENTE"
                    : "REGISTRADO"}
            </div>
            {ticket.clienteId && (
              <div className="mt-2 text-sm text-muted-foreground">
                Cliente: {ticket.clienteId === 1 ? "VENTA AL PÚBLICO" : ticket.nombreCliente || `Cliente #${ticket.clienteId}`}
              </div>
            )}
            {ticket.direccionEntregaEfectiva && (
              <div className="mt-1 text-sm text-muted-foreground max-w-[300px] truncate" title={ticket.direccionEntregaEfectiva}>
                Entrega: {ticket.direccionEntregaEfectiva}
              </div>
            )}
            {ticket.facturado && (
              <div className="mt-2 text-xs font-bold tracking-wider text-primary">
                FACTURADO
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <table className="min-w-[700px] w-full text-left text-sm">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-semibold">Producto</th>
                <th className="px-4 py-3 font-semibold text-right">Rollos</th>
                <th className="px-4 py-3 font-semibold text-right">Cantidad</th>
                <th className="px-4 py-3 font-semibold text-right">
                  Precio Unit.
                </th>
                <th className="px-4 py-3 font-semibold text-right">Importe</th>
                {(user?.rol === Role.CAJA || user?.rol === Role.ADMIN) && (
                  <>
                    <th className="px-4 py-3 font-semibold text-right">
                      Costo
                    </th>
                    <th className="px-4 py-3 font-semibold text-right">
                      Margen
                    </th>
                  </>
                )}
              </tr>
            </thead>
            {uiRollos.lines.length > 0 && (
              <tbody className="divide-y border-b">
                <tr>
                  <td colSpan={(user?.rol === Role.CAJA || user?.rol === Role.ADMIN) ? 7 : 5} className="bg-muted/20 px-4 py-2 font-bold text-foreground">
                    ROLLOS
                  </td>
                </tr>
                {uiRollos.lines.map((linea) => (
                  <tr key={linea.key} className="hover:bg-muted/10">
                    <td className="px-4 py-3">
                      <div className="font-medium text-foreground">
                        {linea.telaProducto} - {linea.colorProducto}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-muted-foreground">
                          {linea.skuProducto}
                        </span>
                        {linea.serieRollo && (
                          <span className="text-[10px] bg-primary/10 text-primary px-1.5 rounded uppercase font-mono">
                            {linea.serieRollo}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {linea.rollos}
                    </td>
                    <td className="px-4 py-3 text-right font-mono">
                      {formatNumber(linea.cantidad, { kind: "quantity" })} {linea.unidadProducto}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {formatNumber(linea.precioUnitario, { kind: "money" })}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold">
                      {formatNumber(linea.importe, { kind: "money" })}
                    </td>
                    {(user?.rol === Role.CAJA || user?.rol === Role.ADMIN) && (
                      <>
                        <td className="px-4 py-3 text-right">
                          {linea.costoTotalCongelado == null
                            ? "—"
                            : formatNumber(linea.costoTotalCongelado, { kind: "money" })}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {linea.margen == null
                            ? "—"
                            : formatNumber(linea.margen, { kind: "money" })}
                        </td>
                      </>
                    )}
                  </tr>
                ))}
                <tr className="bg-muted/5">
                  <td colSpan={4} className="px-4 py-3 text-right font-semibold text-muted-foreground">
                    Subtotal Rollos
                  </td>
                  <td className="px-4 py-3 text-right font-bold">
                    {formatNumber(uiRollos.subtotal, { kind: "money" })}
                  </td>
                  {(user?.rol === Role.CAJA || user?.rol === Role.ADMIN) && (
                    <>
                      <td></td>
                      <td></td>
                    </>
                  )}
                </tr>
              </tbody>
            )}
            {uiMetraje.lines.length > 0 && (
              <tbody className="divide-y border-b">
                <tr>
                  <td colSpan={(user?.rol === Role.CAJA || user?.rol === Role.ADMIN) ? 7 : 5} className="bg-muted/20 px-4 py-2 font-bold text-foreground">
                    METRAJE
                  </td>
                </tr>
                {uiMetraje.lines.map((linea) => (
                  <tr key={linea.key} className="hover:bg-muted/10">
                    <td className="px-4 py-3">
                      <div className="font-medium text-foreground">
                        {linea.telaProducto} - {linea.colorProducto}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-muted-foreground">
                          {linea.skuProducto}
                        </span>
                        {linea.serieRollo && (
                          <span className="text-[10px] bg-primary/10 text-primary px-1.5 rounded uppercase font-mono">
                            {linea.serieRollo}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {linea.rollos}
                    </td>
                    <td className="px-4 py-3 text-right font-mono">
                      {formatNumber(linea.cantidad, { kind: "quantity" })} {linea.unidadProducto}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {formatNumber(linea.precioUnitario, { kind: "money" })}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold">
                      {formatNumber(linea.importe, { kind: "money" })}
                    </td>
                    {(user?.rol === Role.CAJA || user?.rol === Role.ADMIN) && (
                      <>
                        <td className="px-4 py-3 text-right">
                          {linea.costoTotalCongelado == null
                            ? "—"
                            : formatNumber(linea.costoTotalCongelado, { kind: "money" })}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {linea.margen == null
                            ? "—"
                            : formatNumber(linea.margen, { kind: "money" })}
                        </td>
                      </>
                    )}
                  </tr>
                ))}
                <tr className="bg-muted/5">
                  <td colSpan={4} className="px-4 py-3 text-right font-semibold text-muted-foreground">
                    Subtotal Metraje
                  </td>
                  <td className="px-4 py-3 text-right font-bold">
                    {formatNumber(uiMetraje.subtotal, { kind: "money" })}
                  </td>
                  {(user?.rol === Role.CAJA || user?.rol === Role.ADMIN) && (
                    <>
                      <td></td>
                      <td></td>
                    </>
                  )}
                </tr>
              </tbody>
            )}
          </table>
        </CardContent>
        <CardFooter className="bg-muted/20 border-t p-6 flex-col items-end gap-2">
          <div className="flex justify-between w-64 text-muted-foreground">
            <span>Subtotal:</span>
            <span>
              {formatNumber(ticket.subtotal, { kind: "money" })}
            </span>
          </div>
          {ticket.facturado && (
            <div className="flex justify-between w-64 text-muted-foreground">
              <span>IVA ({formatNumber(ticket.tasaIva, { kind: "percentage", percentageInput: "ratio" })}):</span>
              <span>
                {formatNumber(ticket.iva, { kind: "money" })}
              </span>
            </div>
          )}
          <div className="flex justify-between w-64 text-xl font-bold text-foreground mt-2 border-t pt-2">
            <span>Total:</span>
            <span>
              {formatNumber(ticket.total, { kind: "money" })}
            </span>
          </div>
        </CardFooter>
      </Card>

      {/* --- ESTRUCTURAS DE IMPRESIÓN --- */}

      {/* 80mm Ticket */}
      <div className="hidden print-80mm-only print-ticket-container">
        <div className="text-center mb-4">
          <MonochromeBrandLogo className="mx-auto mb-1 h-[43mm] w-[38mm] max-w-full" />
          <p className="text-sm font-bold">Mariana Textil S.A. de C.V.</p>
          <p className="text-xs font-semibold">{ticket.nombreUbicacion}</p>
          <div className="my-2 border-t border-black" />
          <div className="text-left text-[10px] leading-relaxed">
            <div><span className="font-semibold">Folio:</span> {ticket.folio}</div>
            <div><span className="font-semibold">Fecha:</span> {formattedDate} · {formattedTime}</div>
            <div><span className="font-semibold">Atendió:</span> {ticket.nombreUsuarioTerminal}</div>
            <div><span className="font-semibold">Cliente:</span> {customerName}</div>
          </div>
          {ticket.facturado && <p className="text-xs font-bold">FACTURADO</p>}
          {ticket.direccionEntregaEfectiva && (
            <div className="text-left text-[10px] mt-1">
              <span className="font-semibold">Entrega:</span> {ticket.direccionEntregaEfectiva}
            </div>
          )}
        </div>

        <div className="border-t border-b border-black py-2 mb-2">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-black/20">
                <th className="text-left font-normal pb-1">Producto</th>
                <th className="text-right font-normal pb-1">Rollos</th>
                <th className="text-right font-normal pb-1">Imp</th>
              </tr>
            </thead>
            {printRollos.lines.length > 0 && (
              <tbody className="border-b border-black/10">
                <tr>
                  <td colSpan={3} className="py-1 font-bold">ROLLOS</td>
                </tr>
                {printRollos.lines.map((linea) => (
                  <tr key={linea.key}>
                    <td className="py-1">
                      <div className="font-semibold">
                        {linea.telaProducto} {linea.colorProducto}
                      </div>
                      <div className="text-[9px]">
                        {formatNumber(linea.cantidad, { kind: "quantity" })} {linea.unidadProducto}
                        {" · "}
                        {formatNumber(linea.precioUnitario, { kind: "money" })}/{linea.unidadProducto === "KILO" ? "kg" : "m"}
                      </div>
                    </td>
                    <td className="text-right align-top py-1 font-mono">
                      {linea.rollos}
                    </td>
                    <td className="text-right align-top py-1">
                      {formatNumber(linea.importe, { kind: "money" })}
                    </td>
                  </tr>
                ))}
                <tr>
                  <td colSpan={2} className="py-1 text-right font-semibold">Subtotal Rollos</td>
                  <td className="py-1 text-right font-semibold">{formatNumber(printRollos.subtotal, { kind: "money" })}</td>
                </tr>
              </tbody>
            )}
            {printMetraje.lines.length > 0 && (
              <tbody className="border-b border-black/10">
                <tr>
                  <td colSpan={3} className="py-1 font-bold">METRAJE</td>
                </tr>
                {printMetraje.lines.map((linea) => (
                  <tr key={linea.key}>
                    <td className="py-1">
                      <div className="font-semibold">
                        {linea.telaProducto} {linea.colorProducto}
                      </div>
                      <div className="text-[9px]">
                        {formatNumber(linea.cantidad, { kind: "quantity" })} {linea.unidadProducto}
                        {" · "}
                        {formatNumber(linea.precioUnitario, { kind: "money" })}/{linea.unidadProducto === "KILO" ? "kg" : "m"}
                      </div>
                    </td>
                    <td className="text-right align-top py-1 font-mono">
                      {linea.rollos}
                    </td>
                    <td className="text-right align-top py-1">
                      {formatNumber(linea.importe, { kind: "money" })}
                    </td>
                  </tr>
                ))}
                <tr>
                  <td colSpan={2} className="py-1 text-right font-semibold">Subtotal Metraje</td>
                  <td className="py-1 text-right font-semibold">{formatNumber(printMetraje.subtotal, { kind: "money" })}</td>
                </tr>
              </tbody>
            )}
          </table>
        </div>

        <div className="text-right text-sm">
          {ticket.facturado && (
            <>
              <div>
                SUBTOTAL:{" "}
                {formatNumber(ticket.subtotal, { kind: "money" })}
              </div>
              <div>
                IVA ({formatNumber(ticket.tasaIva, { kind: "percentage", percentageInput: "ratio" })}):{" "}
                {formatNumber(ticket.iva, { kind: "money" })}
              </div>
            </>
          )}
          <div className="font-bold">
            TOTAL:{" "}
            {formatNumber(ticket.total, { kind: "money" })}
          </div>
        </div>

        {ticket.estado === EstadoTicket.CANCELADO && (
          <div className="text-center mt-4 border border-black p-1 text-xs font-bold uppercase">
            *** TICKET CANCELADO ***
          </div>
        )}

        <div className="text-center mt-6 text-[10px] italic">
          ¡Gracias por su compra!
          <br />
          Revise su mercancía, no hay devoluciones.
        </div>
      </div>

      {/* Media Carta */}
      <div className="hidden print-carta-only print-document-container">
        <div className="mb-5 text-center">
          <MonochromeBrandLogo className="mx-auto h-[43mm] w-[38mm]" />
          <p className="text-lg font-bold">Mariana Textil S.A. de C.V.</p>
          <p className="text-sm font-semibold">{ticket.nombreUbicacion}</p>
          <div className="my-3 border-t-2 border-black" />
          <div className="grid grid-cols-2 gap-x-6 text-left text-sm">
            <div><span className="font-bold">Folio:</span> {ticket.folio}</div>
            <div><span className="font-bold">Fecha:</span> {formattedDate} · {formattedTime}</div>
            <div><span className="font-bold">Atendió:</span> {ticket.nombreUsuarioTerminal}</div>
            <div><span className="font-bold">Cliente:</span> {customerName}</div>
          </div>
        </div>

        <div className="mb-4 flex justify-between gap-4 text-xs">
          <div>
            {ticket.direccionEntregaEfectiva && (
              <><span className="font-bold">Dirección de entrega:</span> {ticket.direccionEntregaEfectiva}</>
            )}
          </div>
          <div className="shrink-0 text-right font-bold">
            {ticket.estado === EstadoTicket.CANCELADO
              ? "CANCELADO"
              : ticket.cobrado === true
                ? "PAGADO"
                : ticket.cobrado === false
                  ? "PENDIENTE"
                  : "REGISTRADO"}
            {ticket.facturado && <div>FACTURADO</div>}
          </div>
        </div>

        <table className="w-full text-xs border-collapse mb-6">
          <thead>
            <tr className="bg-gray-100">
              <th className="border border-gray-300 p-2 text-left">SKU</th>
              <th className="border border-gray-300 p-2 text-left">
                Descripción
              </th>
              <th className="border border-gray-300 p-2 text-right">Rollos</th>
              <th className="border border-gray-300 p-2 text-right">Cantidad</th>
              <th className="border border-gray-300 p-2 text-right">Precio unit.</th>
              <th className="border border-gray-300 p-2 text-right">Importe</th>
            </tr>
          </thead>
          {printRollos.lines.length > 0 && (
            <tbody>
              <tr>
                <td colSpan={6} className="border border-gray-300 bg-gray-50 p-2 font-bold text-center">ROLLOS</td>
              </tr>
              {printRollos.lines.map((linea) => (
                <tr key={linea.key}>
                  <td className="border border-gray-300 p-2 font-mono text-xs">
                    {linea.skuProducto}
                  </td>
                  <td className="border border-gray-300 p-2">
                    {linea.telaProducto} - {linea.colorProducto}
                  </td>
                  <td className="border border-gray-300 p-2 text-right">
                    {linea.rollos}
                  </td>
                  <td className="border border-gray-300 p-2 text-right font-mono">
                    {formatNumber(linea.cantidad, { kind: "quantity" })} {linea.unidadProducto}
                  </td>
                  <td className="border border-gray-300 p-2 text-right">
                    {formatNumber(linea.precioUnitario, { kind: "money" })}
                  </td>
                  <td className="border border-gray-300 p-2 text-right font-bold">
                    {formatNumber(linea.importe, { kind: "money" })}
                  </td>
                </tr>
              ))}
              <tr>
                <td colSpan={5} className="border border-gray-300 p-2 text-right font-semibold">Subtotal Rollos</td>
                <td className="border border-gray-300 p-2 text-right font-bold">{formatNumber(printRollos.subtotal, { kind: "money" })}</td>
              </tr>
            </tbody>
          )}
          {printMetraje.lines.length > 0 && (
            <tbody>
              <tr>
                <td colSpan={6} className="border border-gray-300 bg-gray-50 p-2 font-bold text-center">METRAJE</td>
              </tr>
              {printMetraje.lines.map((linea) => (
                <tr key={linea.key}>
                  <td className="border border-gray-300 p-2 font-mono text-xs">
                    {linea.skuProducto}
                  </td>
                  <td className="border border-gray-300 p-2">
                    {linea.telaProducto} - {linea.colorProducto}
                  </td>
                  <td className="border border-gray-300 p-2 text-right">
                    {linea.rollos}
                  </td>
                  <td className="border border-gray-300 p-2 text-right font-mono">
                    {formatNumber(linea.cantidad, { kind: "quantity" })} {linea.unidadProducto}
                  </td>
                  <td className="border border-gray-300 p-2 text-right">
                    {formatNumber(linea.precioUnitario, { kind: "money" })}
                  </td>
                  <td className="border border-gray-300 p-2 text-right font-bold">
                    {formatNumber(linea.importe, { kind: "money" })}
                  </td>
                </tr>
              ))}
              <tr>
                <td colSpan={5} className="border border-gray-300 p-2 text-right font-semibold">Subtotal Metraje</td>
                <td className="border border-gray-300 p-2 text-right font-bold">{formatNumber(printMetraje.subtotal, { kind: "money" })}</td>
              </tr>
            </tbody>
          )}
        </table>

        <div className="flex justify-end">
          <div className="w-64">
            <div className="flex justify-between border-b border-gray-200 py-1">
              <span>Subtotal:</span>
              <span>
                {formatNumber(ticket.subtotal, { kind: "money" })}
              </span>
            </div>
            {ticket.facturado && (
              <div className="flex justify-between border-b border-gray-200 py-1">
                <span>IVA ({formatNumber(ticket.tasaIva, { kind: "percentage", percentageInput: "ratio" })}):</span>
                <span>
                  {formatNumber(ticket.iva, { kind: "money" })}
                </span>
              </div>
            )}
            <div className="flex justify-between py-2 text-xl font-bold">
              <span>Total:</span>
              <span>
                {formatNumber(ticket.total, { kind: "money" })}
              </span>
            </div>
          </div>
        </div>
      </div>

      <Dialog open={cancelOpen} onOpenChange={(open) => {
        setCancelOpen(open);
        if (!open) {
          setAdminPass("");
          setPasswordVisibilityResetKey((current) => current + 1);
        }
      }}>
        <DialogContent className="sm:max-w-md no-print">
          <DialogHeader>
            <DialogTitle className="text-destructive flex items-center gap-2">
              <ShieldAlert className="h-5 w-5" /> Confirmar Cancelación
            </DialogTitle>
            <DialogDescription>
              Esta acción revertirá los movimientos de inventario de este
              ticket. Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Motivo de cancelación</Label>
              <Textarea
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder="Explica el motivo (mínimo 10 caracteres)"
              />
            </div>
            {user?.rol !== Role.ADMIN && (
              <div className="bg-destructive/5 p-4 rounded-md border border-destructive/20 space-y-4">
                <p className="text-sm font-semibold text-destructive">
                  Se requiere autorización de administrador
                </p>
                <div className="space-y-2">
                  <Label>Usuario ADMIN</Label>
                  <Input
                    value={adminUser}
                    onChange={(e) => setAdminUser(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ticket-admin-password">Contraseña ADMIN</Label>
                  <PasswordInput
                    id="ticket-admin-password"
                    value={adminPass}
                    onChange={(e) => setAdminPass(e.target.value)}
                    autoComplete="current-password"
                    visibilityResetKey={`${cancelOpen}:${passwordVisibilityResetKey}`}
                    toggleTestId="toggle-ticket-admin-password"
                  />
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setCancelOpen(false);
              setAdminPass("");
              setPasswordVisibilityResetKey((current) => current + 1);
            }}>
              Atrás
            </Button>
            <Button
              variant="destructive"
              onClick={handleCancelar}
              disabled={cancelarTicket.isPending}
            >
              {cancelarTicket.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Continuar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ConfirmacionTextoExacto
        open={cancelConfirmationOpen}
        onOpenChange={setCancelConfirmationOpen}
        titulo="Cancelar ticket cobrado"
        descripcion="Se cancelará el ticket con folio indicado y se revertirán sus movimientos de inventario."
        textoRequerido={String(ticket.folio)}
        etiqueta="Confirmación del folio"
        textoConfirmar="Cancelar definitivamente"
        pendiente={cancelarTicket.isPending}
        onConfirm={executeCancelar}
      />
    </div>
  );
}
