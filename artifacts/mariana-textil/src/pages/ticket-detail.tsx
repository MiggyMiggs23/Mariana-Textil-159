import { Fragment, useEffect, useRef, useState } from "react";
import { useRoute, Link } from "wouter";
import { AppBackLink, appHref } from "@/lib/internal-navigation";
import {
  useObtenerTicket,
  getObtenerTicketQueryKey,
  useCancelarTicket,
  EstadoTicket,
  UnidadProducto,
  Role,
  useGetCurrentUser,
  getGetCurrentUserQueryKey,
  TicketDetalle,
  useObtenerDocumentoImpresionTicket,
  getObtenerDocumentoImpresionTicketQueryKey,
  getGetSalidaQueryKey,
  getListSalidasQueryKey,
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
import { Loader2, ArrowLeft, Printer, Ban, ShieldAlert, FileText, Phone, MapPin, Hash, Calendar, Clock, User } from "lucide-react";
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
import { formatNumber, formatUnit } from "@workspace/number-format";
import {
  countNormalRollItems,
  groupIdentifiedNormalRollsByColor,
  groupTicketLinesByModality,
  groupPrintLinesByModality,
} from "@/lib/ticket-lines";
import { MonochromeBrandLogo } from "@/components/monochrome-brand-logo";
import { PrintableDocumentHeader } from "@/components/printable-document-header";
import { absoluteAppUrl, printThermalTicket, printWhenReady } from "@/lib/print";
import { ConfirmacionTextoExacto } from "@/components/confirmacion-texto-exacto";
import { ClienteNotaCredito } from "@/components/cliente-nota-credito";
import { useReimprimirClienteNota } from "@workspace/api-client-react";
import { formatDateOnlyMx } from "@/lib/date-only";

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
  const printTabulares =
    new URLSearchParams(window.location.search).get("tabulares") === "1";

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

  const isNota = ticket ? (ticket as TicketDetalle).documentoTipo === "NOTA" : false;

  const { data: printInterna, isLoading: printInternaLoading, isError: printInternaError } = useObtenerDocumentoImpresionTicket(
    ticketId,
    { copia: 'INTERNA' },
    { query: { enabled: !!ticket && isNota, staleTime: Infinity, queryKey: getObtenerDocumentoImpresionTicketQueryKey(ticketId, { copia: 'INTERNA' }) } }
  );

  const { data: printCliente, isLoading: printClienteLoading, isError: printClienteError } = useObtenerDocumentoImpresionTicket(
    ticketId,
    { copia: 'CLIENTE' },
    { query: { enabled: !!ticket && isNota, staleTime: Infinity, queryKey: getObtenerDocumentoImpresionTicketQueryKey(ticketId, { copia: 'CLIENTE' }) } }
  );

  const isPrintReady = !isNota || (!!printInterna && !!printCliente);

  const cancelarTicket = useCancelarTicket();
  const autoPrintStarted = useRef(false);
  const thermalPrintRoot = useRef<HTMLDivElement>(null);
  const reimprimirNota = useReimprimirClienteNota();
  const requestedReturnPath =
    typeof window === "undefined"
      ? null
      : new URLSearchParams(window.location.search).get("returnTo");
  const returnPath = requestedReturnPath?.startsWith("/movimientos")
    ? requestedReturnPath
    : user?.rol === Role.CAJA ? "/cobros" : "/pos";
  const canCancel =
    user?.rol === Role.ADMIN ||
    (user != null && hasPermission(user, Modules.POS, "crear"));

  useEffect(() => {
    const isSaleLinked = (ticket?.salidas?.length ?? 0) > 0;
    const salePrintAuthorized = ticket?.estado !== EstadoTicket.CANCELADO && (
      ticket?.documentoTipo === "TICKET"
        ? ticket.cobrado === true
        : ticket?.autorizadoPor != null
    );
    if (
      !ticket ||
      !isPrintReady ||
      (isSaleLinked && !salePrintAuthorized) ||
      autoPrintStarted.current ||
      new URLSearchParams(window.location.search).get("print") !== "3"
    )
      return;
    autoPrintStarted.current = true;

    let cancelled = false;
    const printPromise = isNota
      ? printWhenReady("print-credito")
      : thermalPrintRoot.current
        ? printThermalTicket(thermalPrintRoot.current)
        : Promise.reject(new Error("No se encontró el ticket térmico."));
    void printPromise.then(() => {
      if (cancelled) return;
      window.history.replaceState(
        window.history.state,
        "",
        appHref(`/tickets/${ticket.id}`),
      );
    });
    return () => {
      cancelled = true;
    };
  }, [ticket, isPrintReady, isNota, printTabulares]);

  const handlePrint80mm = () => {
    if (isSaleLinked && !ventaAutorizada) return;
    if (thermalPrintRoot.current) {
      void printThermalTicket(thermalPrintRoot.current);
    }
  };

  const handlePrintNota = () => {
    if (!isPrintReady || (isSaleLinked && !ventaAutorizada)) return;
    if (ticket?.clienteId && (ticket as TicketDetalle).esCredito) {
      reimprimirNota.mutate({ id: ticket.clienteId, ticketId }, {
        onSuccess: () => {
          void printWhenReady("print-credito");
        },
        onError: (err) => {
          toast({ title: "No se pudo auditar reimpresión", description: getApiErrorMessage(err), variant: "destructive" });
        }
      });
    } else {
      void printWhenReady("print-credito");
    }
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
          queryClient.invalidateQueries({ queryKey: getListSalidasQueryKey() });
          for (const salida of ticket?.salidas ?? []) {
            queryClient.invalidateQueries({ queryKey: getGetSalidaQueryKey(salida.id) });
          }
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
        <Button variant="link" className="mt-4" asChild>
          <AppBackLink fallbackHref={returnPath}>
            Volver
          </AppBackLink>
        </Button>
      </div>
    );
  }

  const { rollos: uiRollos, metraje: uiMetraje } = groupTicketLinesByModality(ticket.lineas, showRolls);
  const { rollos: printRollos, metraje: printMetraje } = groupTicketLinesByModality(ticket.lineas, false);
  const printProductBlocks = [
    ...printRollos.lines.map((line) => ({ line, modality: "POR ROLLO" as const })),
    ...printMetraje.lines.map((line) => ({ line, modality: "METREADA" as const })),
  ];
  const customerName =
    ticket.clienteId === 1 || !ticket.clienteId
      ? "VENTA AL PÚBLICO"
      : ticket.nombreCliente || `Cliente #${ticket.clienteId}`;
  const isSaleLinked = (ticket.salidas?.length ?? 0) > 0;
  const ventaAutorizada = isSaleLinked && ticket.estado !== EstadoTicket.CANCELADO && (
    ticket.documentoTipo === "TICKET"
      ? ticket.cobrado === true
      : ticket.autorizadoPor != null
  );
  const createdAt = new Date(ticket.createdAt);
  const formattedDate = createdAt.toLocaleDateString("es-MX");
  const formattedTime = createdAt.toLocaleTimeString("es-MX", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const ticketDocumentUrl = absoluteAppUrl(`/tickets/${ticket.id}`);
  const tabularGroups = groupIdentifiedNormalRollsByColor(ticket.lineas);
  const totalNormalRolls = countNormalRollItems(ticket.lineas);

  return (
    <div className="max-w-4xl mx-auto h-full flex flex-col gap-6 print:m-0 print:max-w-none print:w-full">
      {ticket.estado === EstadoTicket.CANCELADO && (
        <div className="no-print w-full bg-destructive text-destructive-foreground px-6 py-4 shadow-md">
          <div className="font-black text-xl tracking-tight mb-1 uppercase">CANCELADO</div>
          <div className="text-sm opacity-90 flex flex-col gap-0.5">
            <span>Por: {ticket.nombreUsuarioCancelacion || "Sistema"} el {ticket.canceladoAt ? new Date(ticket.canceladoAt).toLocaleString("es-MX") : "N/A"}</span>
            {ticket.motivoCancelacion && <span>Motivo: {ticket.motivoCancelacion}</span>}
          </div>
        </div>
      )}
      <div className="flex flex-col gap-4 no-print sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" asChild>
            <AppBackLink fallbackHref={returnPath} aria-label="Volver">
              <ArrowLeft className="h-4 w-4" />
            </AppBackLink>
          </Button>
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
          {isNota ? (
            <Button className="w-full sm:w-auto" onClick={handlePrintNota} disabled={!isPrintReady || printInternaLoading || printClienteLoading || (isSaleLinked && !ventaAutorizada)}>
              <FileText className="h-4 w-4 mr-2" /> Imprimir Nota
            </Button>
          ) : (
            <Button className="w-full sm:w-auto" onClick={handlePrint80mm} disabled={isSaleLinked && !ventaAutorizada}>
              <Printer className="h-4 w-4 mr-2" /> Imprimir Ticket (80mm)
            </Button>
          )}
        </div>
        {isSaleLinked && !ventaAutorizada && ticket.estado !== EstadoTicket.CANCELADO && (
          <p className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm font-medium text-amber-900 no-print" role="status">
            Impresión pendiente de autorización: {isNota ? "la nota debe estar AUTORIZADA" : "el ticket debe estar cobrado"} antes de imprimir la salida para entrega.
          </p>
        )}
      </div>

      {/* Visor de Ticket (Pantalla / Carta) */}
      <Card className="no-print shadow-md overflow-hidden">
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
            {ticket.estado !== EstadoTicket.CANCELADO && (
              <div
                className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${
                  ticket.cobrado === true
                    ? "bg-emerald-100 text-emerald-700"
                    : ticket.cobrado === false
                      ? "bg-amber-100 text-amber-700"
                      : "bg-primary/10 text-primary"
                }`}
              >
                {ticket.cobrado === true
                  ? "PAGADO"
                  : ticket.cobrado === false
                    ? "PENDIENTE"
                    : "REGISTRADO"}
              </div>
            )}
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
            {(ticket as TicketDetalle & { viaje?: { id: number; folio: number } | null }).viaje && (
              <Link className="mt-1 block text-sm text-primary underline" href={`/viajes/${(ticket as TicketDetalle & { viaje: { id: number } }).viaje.id}`}>
                En viaje #{(ticket as TicketDetalle & { viaje: { folio: number } }).viaje.folio}
              </Link>
            )}
            {ticket.salidas?.map((salida) => (
              <Link key={salida.id} className="mt-1 block text-sm text-primary underline" href={salida.href.startsWith("/api") ? `/salidas/${salida.id}` : salida.href}>
                Salida {salida.folioFormateado} · Origen: {salida.nombreOrigen}
              </Link>
            ))}
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
                      {formatNumber(linea.cantidad, { kind: "quantity" })} {formatUnit(linea.unidadProducto)}
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
                      {formatNumber(linea.cantidad, { kind: "quantity" })} {formatUnit(linea.unidadProducto)}
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

      {ticket.clienteId && (ticket as TicketDetalle).esCredito && (
        <ClienteNotaCredito clienteId={ticket.clienteId} ticketId={ticket.id} />
      )}

      {/* --- ESTRUCTURAS DE IMPRESIÓN --- */}

      {/* 80mm Ticket */}
      <div ref={thermalPrintRoot} className="hidden print-80mm-only print-ticket-container">
        {(["CLIENTE", "CAJA", "ADMINISTRACIÓN"] as const).map((copyLabel) => (
          <section key={copyLabel} className="ticket-copy" data-thermal-page={copyLabel}>
            {ticket.estado === EstadoTicket.CANCELADO && (
              <div className="mb-4 border-y-4 border-black py-2 text-center text-black">
                <div className="text-xl font-black uppercase">CANCELADO</div>
                <div className="mt-1 text-[10px] font-bold leading-tight">
                  {ticket.nombreUsuarioCancelacion || "Sistema"}
                  <br />
                  {ticket.canceladoAt ? new Date(ticket.canceladoAt).toLocaleString("es-MX") : ""}
                </div>
              </div>
            )}
            <div className="relative mb-4 text-center">
              <div className="mb-2 border-2 border-black bg-black px-2 py-1 text-sm font-black tracking-[0.18em] text-white">
                {copyLabel}
              </div>
              <MonochromeBrandLogo className="mx-auto mb-1 h-auto w-[25mm]" />
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
              {ventaAutorizada && <div className="mt-2 border-2 border-black py-1 text-center text-base font-black tracking-widest">AUTORIZADA</div>}
              {ticket.direccionEntregaEfectiva && (
                <div className="text-left text-[10px] mt-1">
                  <span className="font-semibold">Entrega:</span> {ticket.direccionEntregaEfectiva}
                </div>
              )}
            </div>

            <div className="border-t border-black">
              {printProductBlocks.map(({ line, modality }) => (
                <div key={`${modality}-${line.key}`} className="ticket-product-block border-b border-dashed border-black py-2 text-xs">
                  <h2 className="text-sm font-black">{line.telaProducto} {line.colorProducto}</h2>
                  <div className="my-1 bg-black px-2 py-1 text-center font-black text-white">
                    VENTA: {modality}
                  </div>
                  {modality === "POR ROLLO" && (
                    <div className="flex justify-between gap-3"><span>Rollos:</span><span className="font-semibold">{line.rollos}</span></div>
                  )}
                  <div className="flex justify-between gap-3">
                    <span>{formatUnit(line.unidadProducto)}:</span>
                    <span className="font-semibold">{formatNumber(line.cantidad, { kind: "quantity" })} {formatUnit(line.unidadProducto)}</span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span>Precio:</span>
                    <span>{formatNumber(line.precioUnitario, { kind: "money" })} / {formatUnit(line.unidadProducto)}</span>
                  </div>
                  <div className="mt-1 flex justify-between gap-3 border-t border-black pt-1 font-black">
                    <span>Importe:</span>
                    <span>{formatNumber(line.importe, { kind: "money" })}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="ticket-summary mt-2 border-2 border-black bg-black p-2 text-sm font-black text-white">
              <div className="flex justify-between gap-3">
                <span>Total de rollos:</span>
                <span>{totalNormalRolls}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span>Total a pagar:</span>
                <span>{formatNumber(ticket.total, { kind: "money" })}</span>
              </div>
            </div>

            {ticket.estado === EstadoTicket.CANCELADO ? (
              <div className="mt-4 border-y-4 border-black py-2 text-center text-black">
                <div className="text-xl font-black uppercase">CANCELADO</div>
                <div className="mt-1 text-[10px] font-bold leading-tight">
                  {ticket.nombreUsuarioCancelacion || "Sistema"}
                  <br />
                  {ticket.canceladoAt ? new Date(ticket.canceladoAt).toLocaleString("es-MX") : ""}
                </div>
              </div>
            ) : (
              <div className="text-center mt-6 text-[10px] italic">
                ¡Gracias por su compra!
                <br />
                Revise su mercancía, no hay devoluciones.
              </div>
            )}
          </section>
        ))}

        {printTabulares &&
          tabularGroups.map((group) => (
            <section
              key={group.color}
              className="tabular-strip-page mt-4 border border-black p-3 text-xs"
              data-thermal-page={`TABULAR-${group.color}`}
              aria-label={`Tabular color ${group.color}`}
            >
              <h2 className="text-center text-sm font-bold uppercase">
                TABULAR
              </h2>
              <div className="mt-2 flex justify-between border-b border-black pb-1">
                <span className="font-semibold">Folio:</span>
                <span>{ticket.folio}</span>
              </div>
              <div className="mt-1 flex justify-between">
                <span className="font-semibold">Color:</span>
                <span>{group.color}</span>
              </div>
              <div className="my-2 border-t border-black" />
              <ul className="space-y-1">
                {group.rollos.map((rollo) => (
                  <li key={rollo.id} className="flex justify-between gap-2">
                    <span className="font-mono">{rollo.serie}</span>
                    <span>
                      {formatNumber(rollo.cantidad, { kind: "quantity" })}{" "}
                      {formatUnit(rollo.unidad)}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="mt-2 border-t border-black pt-2 font-bold">
                {Object.values(UnidadProducto).map((unidad) =>
                  group.totales[unidad] == null ? null : (
                    <div key={unidad} className="flex justify-between">
                      <span>TOTAL {formatUnit(unidad)}:</span>
                      <span>
                        {formatNumber(group.totales[unidad], { kind: "quantity" })}
                      </span>
                    </div>
                  ),
                )}
              </div>
            </section>
          ))}
      </div>

      {/* Nota Print Pages */}
      <div className="hidden print-credito-only w-full max-w-none">
        {isPrintReady && [printInterna, printCliente].map((printData, idx) => {
          if (!printData) return null;

          const isInternal = printData.copia === "INTERNA";
          const qrUrl = ticketDocumentUrl;
          const isPriceless = !isInternal && printData.notaSinPrecios;
          const pageTitle = isPriceless ? "NOTA DE PRODUCTOS" : "NOTA";
          const printedRecipient = printData.nombreDestinatario?.trim();
          const printedContact =
            printData.telefonoCliente?.trim() || printData.correoCliente?.trim();
          const printedCustomerAddress =
            printData.direccionEntregaEfectiva?.trim() ||
            printData.direccionFiscalEfectiva?.trim();
          const paymentDate = printData.fechaVencimiento;
          const termDays = printData.diasPlazo;

          // Chromium PDF raster at 120dpi: header, credit data and table header end
          // at ~375px; the totals/footer reserve begins at ~635px.  Eight complete
          // bordered rows occupy ~225px and end at ~600px.  Row nine crosses the
          // reserve and is clipped, so the safe credit capacity is eight.
          const NOTE_PRODUCT_ROWS_PER_PAGE = 8;

          // Group lines according to the print data
          const { rollos: projRollos, metraje: projMetraje } = groupPrintLinesByModality(printData.lineas);
          const noteLines = [...projRollos.lines, ...projMetraje.lines];
          const noteRowsPerPage = NOTE_PRODUCT_ROWS_PER_PAGE;
          const notePageCount = Math.max(1, Math.ceil(noteLines.length / noteRowsPerPage));
          const notePages = Array.from({ length: notePageCount }, (_, pageIndex) =>
            noteLines.slice(pageIndex * noteRowsPerPage, (pageIndex + 1) * noteRowsPerPage),
          );

          return (
            <Fragment key={idx}>
            {notePages.map((pageLines, pageIndex) => (
            <div
              key={`${idx}-${pageIndex}`}
              className="credito-page-print bg-white print:shadow-none w-[148mm] h-[210mm] relative box-border flex flex-col overflow-hidden shrink-0"
            >
              {printData.estado === EstadoTicket.CANCELADO && (
                <div className="absolute inset-0 z-0 flex items-center justify-center pointer-events-none opacity-10">
                  <span className="text-9xl font-black text-red-600 rotate-[-30deg] tracking-widest border-8 border-red-600 p-8 rounded-3xl">
                    CANCELADO
                  </span>
                </div>
              )}
              {/* Header */}
              <PrintableDocumentHeader
                className="shrink-0 p-4"
                qrUrl={isInternal ? qrUrl : undefined}
                qrLabel={isInternal ? `QR para abrir nota ${printData.folio}` : undefined}
                logoClassName="h-[72px] w-[72px]"
              >
                <div className="flex items-center gap-4">
                  <div className="w-2 h-12 bg-[#1e3a8a] mr-2"></div>
                  <div className="flex flex-col">
                    <h1 className="text-2xl font-black text-[#1e3a8a] tracking-tighter uppercase leading-none">
                      {pageTitle}
                    </h1>
                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mt-0.5">
                      {isInternal ? "COPIA INTERNA" : "COPIA CLIENTE"}
                      {" · "}Pág. {pageIndex + 1}/{notePageCount}
                    </span>
                  </div>
                  <div className="ml-4 text-[#1e3a8a] font-bold text-lg leading-tight border-l-2 pl-4 border-gray-300">
                    MARIANA<br />TEXTIL
                  </div>
                </div>
              </PrintableDocumentHeader>
              {ventaAutorizada && (
                <div className="mx-6 mt-2 border-4 border-black py-2 text-center text-xl font-black tracking-[0.3em]">AUTORIZADA</div>
              )}

              {/* Info section */}
              <div className="px-6 py-2 shrink-0 bg-gray-50/50">
                <div className="grid grid-cols-2 auto-rows-min gap-x-12 gap-y-1.5">
                  <div className="flex min-w-0 items-center border-b border-gray-200 pb-0.5">
                    <User className="w-3 h-3 text-gray-400 mr-2 shrink-0" />
                    <span className="font-bold w-24 text-[10px] uppercase text-gray-500 tracking-wider">Cliente</span>
                    <span className="font-medium text-xs text-black truncate">{printData.clienteId === 1 ? "VENTA AL PÚBLICO" : printData.nombreCliente || `Cliente #${printData.clienteId}`}</span>
                  </div>
                  <div className="flex min-w-0 items-center border-b border-gray-200 pb-0.5">
                    <Hash className="w-3 h-3 text-gray-400 mr-2 shrink-0" />
                    <span className="font-bold w-24 text-[10px] uppercase text-gray-500 tracking-wider">Folio Venta</span>
                    <span className="font-bold text-xs text-red-600">{printData.folio}</span>
                  </div>
                  <div className="flex min-w-0 items-center border-b border-gray-200 pb-0.5">
                    <Calendar className="w-3 h-3 text-gray-400 mr-2 shrink-0" />
                    <span className="font-bold w-24 text-[10px] uppercase text-gray-500 tracking-wider">Fecha Venta</span>
                    <span className="font-medium text-xs text-black">{new Date(printData.createdAt).toLocaleDateString("es-MX")} {new Date(printData.createdAt).toLocaleTimeString("es-MX", {hour: "2-digit", minute: "2-digit"})}</span>
                  </div>
                  {paymentDate && (
                    <div className="flex min-w-0 items-center border-b border-gray-200 bg-red-50 pb-0.5">
                      <Clock className="w-3 h-3 text-red-400 mr-2 shrink-0" />
                      <span className="font-bold w-24 text-[10px] uppercase text-red-600 tracking-wider">Fecha de pago</span>
                      <span className="font-bold text-xs text-red-700">
                        {formatDateOnlyMx(paymentDate)}
                      </span>
                    </div>
                  )}
                  {termDays && (
                    <div className="flex min-w-0 items-center border-b border-gray-200 bg-red-50 pb-0.5">
                      <Clock className="w-3 h-3 text-red-400 mr-2 shrink-0" />
                      <span className="font-bold w-24 text-[10px] uppercase text-red-600 tracking-wider">Plazo</span>
                      <span className="font-bold text-xs text-red-700">{termDays} días</span>
                    </div>
                  )}
                  {printedContact && (
                    <div className="flex min-w-0 items-center border-b border-gray-200 pb-0.5">
                      <Phone className="w-3 h-3 text-gray-400 mr-2 shrink-0" />
                      <span className="font-bold w-24 text-[10px] uppercase text-gray-500 tracking-wider">Contacto</span>
                      <span className="font-medium text-[10px] text-black truncate">{printedContact}</span>
                    </div>
                  )}
                  {printedRecipient && (
                    <div className="flex min-w-0 items-center border-b border-gray-200 pb-0.5">
                      <User className="w-3 h-3 text-gray-400 mr-2 shrink-0" />
                      <span className="font-bold w-24 text-[10px] uppercase text-gray-500 tracking-wider">Destinatario</span>
                      <span className="font-medium text-[10px] text-black truncate">{printedRecipient}</span>
                    </div>
                  )}
                  {printedCustomerAddress && (
                    <div className="flex min-w-0 items-start border-b border-gray-200 pb-0.5">
                      <MapPin className="w-3 h-3 text-gray-400 mr-2 mt-0.5 shrink-0" />
                      <span className="font-bold w-24 shrink-0 text-[10px] uppercase text-gray-500 tracking-wider">Dirección</span>
                      <span className="font-medium min-w-0 text-[10px] leading-tight text-black break-words">{printedCustomerAddress}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Items Table */}
              <div className="px-6 mt-1 flex-1 relative z-10 flex flex-col min-h-0">
                <div className="flex-1 overflow-hidden border border-gray-200 flex flex-col">
                    <table className="document-product-grid w-full table-fixed text-left border-collapse">
                    <thead className="sticky top-0 bg-[#1e3a8a] text-white">
                      <tr>
                        <th className="py-1 px-2 text-[9px] font-bold uppercase tracking-wider">Descripción</th>
                        <th className="py-1 px-2 text-[9px] font-bold uppercase tracking-wider text-right w-16">Rollos</th>
                        <th className="py-1 px-2 text-[9px] font-bold uppercase tracking-wider text-right w-20">Cant.</th>
                        {!isPriceless && (
                          <>
                            <th className="py-1 px-2 text-[9px] font-bold uppercase tracking-wider text-right w-20">P. Unit</th>
                            <th className="py-1 px-2 text-[9px] font-bold uppercase tracking-wider text-right w-24">Importe</th>
                          </>
                        )}
                      </tr>
                    </thead>
                    <tbody className="overflow-y-auto block h-full w-full bg-white" style={{ display: "table-row-group" }}>
                      {pageLines.map((linea, lineIndex) => (
                        <tr key={linea.key} className="h-[24px]">
                          <td className="py-0.5 px-2 text-[10px] text-gray-800 truncate">
                            <span className="mr-1 text-gray-500">{pageIndex * noteRowsPerPage + lineIndex + 1}.</span>
                            {linea.telaProducto} {linea.colorProducto}
                            <span className="text-gray-500 ml-1">({linea.skuProducto})</span>
                          </td>
                          <td className="py-0.5 px-2 text-[10px] text-right font-mono">{linea.rollos}</td>
                          <td className="py-0.5 px-2 text-[10px] text-right font-mono">{formatNumber(linea.cantidad, { kind: "quantity" })} {formatUnit(linea.unidadProducto)}</td>
                          {!isPriceless && <><td className="py-0.5 px-2 text-[10px] text-right">{formatNumber(linea.precioUnitario, { kind: "money" })}</td><td className="py-0.5 px-2 text-[10px] text-right font-medium">{formatNumber(linea.importe, { kind: "money" })}</td></>}
                        </tr>
                      ))}
                      {Array.from({ length: Math.max(0, noteRowsPerPage - pageLines.length) }, (_, blankIndex) => (
                        <tr key={`blank-${blankIndex}`} className="h-[24px]">
                          {Array.from({ length: isPriceless ? 3 : 5 }, (_, cellIndex) => <td key={cellIndex}></td>)}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Totals & Signatures */}
              <div className="px-4 mt-1 mb-0 relative z-10 shrink-0 flex h-[280px] gap-2">
                <div className="flex-1 flex flex-col">
                  <div
                    className="text-[10px] leading-[12px] text-gray-500 mb-2 pr-2 text-justify"
                    data-testid="note-legal-block"
                  >
                    {pageIndex === notePageCount - 1 ? (
                      <>
                        <p className="font-bold">RECIBO DE MERCANCÍA Y PAGARÉ</p>
                        <p>Recibo a mi entera satisfacción la mercancía aquí detallada.</p>
                        <p>Por este pagaré, reconozco deber y me obligo incondicionalmente a pagar a la orden de MARIANA TEXTIL, en la fecha de pago señalada en esta nota, el monto de esta nota, por concepto de mercancía recibida.</p>
                        <p>El presente pagaré se rige por los artículos 170, fracciones I, II, III, IV, V y VI; 171; y 174, primer párrafo, de la LGTOC, y demás disposiciones aplicables.</p>
                      </>
                    ) : (
                      <p>Recibo a mi entera satisfacción la mercancía aquí detallada.</p>
                    )}
                  </div>
                  <div className="mt-auto" data-testid="note-signature-block">
                    <div className="border-t border-black w-48 mx-auto mt-3 mb-1 h-0"></div>
                    <div className="text-[8px] font-bold uppercase text-gray-700 tracking-wider text-center">Firma de Conformidad</div>
                    <div className="text-[7px] text-gray-500 text-center truncate px-4">{printData.nombreDestinatario || customerName}</div>
                  </div>
                </div>

                {!isPriceless && "total" in printData && (
                  <div className="w-[35%] shrink-0 self-start" data-testid="note-totals-block">
                    <table className="w-full text-xs border-collapse border border-gray-300 bg-white shadow-sm">
                      <tbody>
                        {"subtotal" in printData && (
                          <>
                            <tr>
                              <td className="py-0.5 px-2 border-b border-gray-200 text-gray-600 text-[10px] uppercase bg-gray-50">Subtotal</td>
                              <td className="py-0.5 px-2 border-b border-gray-200 font-medium text-right text-[11px]">{formatNumber(printData.subtotal, { kind: "money" })}</td>
                            </tr>
                            {printData.facturado && (
                              <tr>
                                <td className="py-0.5 px-2 border-b border-gray-200 text-gray-600 text-[10px] uppercase bg-gray-50">IVA ({formatNumber(printData.tasaIva, { kind: "percentage", percentageInput: "ratio" })})</td>
                                <td className="py-0.5 px-2 border-b border-gray-200 font-medium text-right text-[11px]">{formatNumber(printData.iva, { kind: "money" })}</td>
                              </tr>
                            )}
                          </>
                        )}
                        <tr>
                          <td className="py-1 px-2 border-b border-gray-300 font-bold text-[#1e3a8a] text-[11px] uppercase bg-blue-50/50">Total Documento</td>
                          <td className="py-1 px-2 border-b border-gray-300 font-bold text-right text-[12px] text-[#1e3a8a] bg-blue-50/50">{formatNumber(printData.total, { kind: "money" })}</td>
                        </tr>
                        {"esCredito" in printData && printData.esCredito && (
                          <tr>
                            <td className="py-1 px-2 border-b border-gray-200 font-bold text-red-700 text-[10px] uppercase bg-red-50">Saldo Pendiente</td>
                            <td className="py-1 px-2 border-b border-gray-200 font-bold text-right text-[12px] text-red-700 bg-red-50">{formatNumber(printData.saldoPendiente, { kind: "money" })}</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="h-1.5 bg-[#1e3a8a] w-full shrink-0 mt-auto"></div>
            </div>
            ))}
            </Fragment>
          );
        })}
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
