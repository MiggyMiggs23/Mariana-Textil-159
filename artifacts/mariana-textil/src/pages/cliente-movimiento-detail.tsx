import { useRoute, Link } from "wouter";
import { useGetClientePagoDetalle, getGetClientePagoDetalleQueryKey, type ClientePagoDetalle } from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatNumber } from "@workspace/number-format";
import { ArrowLeft, PlusCircle, Undo2, SlidersHorizontal, User, Calendar, FileText, Activity, Clock, ShieldAlert, FileQuestion } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

// Color semantics:
// emerald: Abonos (ingreso de dinero, reduce deuda)
// rose: Reversos (anulación, re-incrementa deuda, alertas)
// indigo: Ajustes (modificación administrativa neutra o correctiva)
// amber: Saldo a favor (dinero retenido a favor del cliente)
// slate/muted: Evidencia inmutable, metadatos y auditoría

function formatMexicoCityDateTime(isoString: string | null | undefined) {
  if (!isoString) return "—";
  try {
    const d = new Date(isoString.includes("T") ? isoString : `${isoString}T12:00:00`);
    return new Intl.DateTimeFormat("es-MX", {
      timeZone: "America/Mexico_City",
      dateStyle: "medium",
      timeStyle: "short",
      hour12: true,
    }).format(d);
  } catch (e) {
    return isoString;
  }
}

export default function ClienteMovimientoDetail() {
  const [, params] = useRoute("/clientes/:id/movimientos/:movimientoId");
  const clienteId = Number(params?.id);
  const movimientoId = Number(params?.movimientoId);

  const query = useGetClientePagoDetalle(clienteId, movimientoId, {
    query: {
      enabled: !!clienteId && !!movimientoId,
      queryKey: getGetClientePagoDetalleQueryKey(clienteId, movimientoId),
      retry: false,
    }
  });

  if (query.isLoading) {
    return (
      <AppLayout>
        <div className="mx-auto max-w-5xl space-y-6 pt-6">
          <Skeleton className="h-10 w-32" />
          <Skeleton className="h-40 w-full" />
          <div className="grid grid-cols-2 gap-4">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        </div>
      </AppLayout>
    );
  }

  if (query.isError || !query.data) {
    return (
      <AppLayout>
        <div className="mx-auto max-w-3xl pt-12">
          <Card className="border-destructive/30">
            <CardContent className="p-10 text-center">
              <FileQuestion className="mx-auto h-12 w-12 text-destructive/50 mb-4" />
              <h2 className="text-xl font-bold text-destructive">Movimiento no encontrado</h2>
              <p className="mt-3 text-muted-foreground">
                El movimiento que buscas no existe o no tienes permisos para verlo.
              </p>
              <Link
                href={`/clientes/${clienteId}?tab=estado`}
                className="mt-8 inline-flex h-10 items-center justify-center rounded-md bg-primary px-6 text-sm font-bold text-primary-foreground shadow transition-colors hover:bg-primary/90"
              >
                Volver al estado de cuenta
              </Link>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  const detalle = query.data as ClientePagoDetalle;
  const isLegacy = !detalle.tipo || !detalle.importe || !detalle.fechaEfectiva;

  if (isLegacy) {
    return (
      <AppLayout>
        <div className="mx-auto max-w-3xl pt-12">
          <Card className="border-destructive/30 bg-destructive/5">
            <CardContent className="p-10 text-center">
              <FileQuestion className="mx-auto h-12 w-12 text-destructive mb-4" />
              <h2 className="text-xl font-bold text-destructive">Funcionalidad no disponible</h2>
              <p className="mt-3 text-muted-foreground font-medium text-lg">
                El servidor aún no tiene habilitado el detalle completo de movimientos.
              </p>
              <Link
                href={`/clientes/${clienteId}?tab=estado&movimientoId=${movimientoId}`}
                className="mt-8 inline-flex h-10 items-center justify-center rounded-md bg-primary px-6 text-sm font-bold text-primary-foreground shadow transition-colors hover:bg-primary/90"
              >
                Volver al estado de cuenta
              </Link>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  const isAbono = detalle.tipo === "ABONO";
  const isReverso = detalle.tipo === "REVERSO";
  const isAjuste = detalle.tipo === "AJUSTE";

  const typeStyles = {
    ABONO: "text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900/50",
    REVERSO: "text-rose-800 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-900/50",
    AJUSTE: "text-indigo-800 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/30 border-indigo-200 dark:border-indigo-900/50"
  };

  return (
    <AppLayout>
      <div className="mx-auto max-w-5xl space-y-6 pt-4 pb-12">
        <div className="flex items-center gap-3">
          <Link
            href={`/clientes/${clienteId}?tab=estado&movimientoId=${movimientoId}`}
            className="inline-flex h-9 items-center justify-center whitespace-nowrap rounded-md px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Regresar al cliente
          </Link>
        </div>

        <Card className={`border-2 shadow-sm ${typeStyles[detalle.tipo!]}`}>
          <CardContent className="p-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div>
                <div className="flex items-center gap-3 mb-3">
                  {isAbono && <PlusCircle className="h-7 w-7" />}
                  {isReverso && <Undo2 className="h-7 w-7" />}
                  {isAjuste && <SlidersHorizontal className="h-7 w-7" />}
                  <h1 className="text-3xl font-black tracking-tight uppercase">
                    {detalle.tipo}
                  </h1>
                </div>
                <p className="text-base font-bold opacity-80">
                  {detalle.clienteNombre || `Cliente #${formatNumber(clienteId, { kind: "identifier" })}`}
                </p>
                <p className="text-sm font-medium opacity-70 mt-1">
                  Movimiento #{formatNumber(movimientoId, { kind: "identifier" })}
                </p>
              </div>
              <div className="text-left md:text-right">
                <p className="text-xs font-bold uppercase tracking-widest opacity-70 mb-2">Importe del movimiento</p>
                <p className="text-3xl sm:text-5xl font-black tabular-nums tracking-tighter">
                  {formatNumber(detalle.importe!, { kind: "money" })}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Fecha Efectiva
              </CardTitle>
              <CardDescription className="text-xs mt-1">Día y hora en que el movimiento impacta los saldos</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-xl font-bold">{formatMexicoCityDateTime(detalle.fechaEfectiva)}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Capturado
              </CardTitle>
              <CardDescription className="text-xs mt-1">Instante inmutable del registro en sistema</CardDescription>
            </CardHeader>
            <CardContent>
              {detalle.fechaCaptura ? (
                <div>
                  <p className="text-xl font-bold">{formatMexicoCityDateTime(detalle.fechaCaptura)}</p>
                  <p className="text-sm text-muted-foreground font-medium flex items-center gap-1.5 mt-2">
                    <User className="h-4 w-4" />
                    {detalle.usuarioCaptura || detalle.usuarioRegistrador || "Usuario desconocido"}
                  </p>
                </div>
              ) : (
                <div>
                  <p className="text-sm italic font-medium text-muted-foreground mt-2">Sin evidencia histórica de captura</p>
                  {detalle.usuarioRegistrador && (
                    <p className="text-sm text-muted-foreground font-medium flex items-start gap-1.5 mt-2">
                      <User className="h-4 w-4 shrink-0 mt-0.5" />
                      <span>Usuario del movimiento: {detalle.usuarioRegistrador}</span>
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {detalle.formaPago && (
            <Card>
              <CardContent className="p-5">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Forma de pago</p>
                <p className="font-bold text-lg">{detalle.formaPago}</p>
              </CardContent>
            </Card>
          )}
          {detalle.cuentaDestino && (
            <Card>
              <CardContent className="p-5">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Cuenta destino</p>
                <p className="font-bold text-lg">{detalle.cuentaDestino}</p>
              </CardContent>
            </Card>
          )}
          {detalle.referencia && (
            <Card>
              <CardContent className="p-5">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Referencia</p>
                <p className="font-bold text-lg truncate" title={detalle.referencia}>
                  {detalle.referencia}
                </p>
              </CardContent>
            </Card>
          )}
          {detalle.ticketId && detalle.ticketFolio && (
            <Card>
              <CardContent className="p-5">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                  <FileText className="h-4 w-4" /> Nota Origen
                </p>
                <Link
                  href={`/tickets/${detalle.ticketId}`}
                  className="font-bold text-lg text-primary hover:underline"
                >
                  #{formatNumber(detalle.ticketFolio, { kind: "identifier" })}
                </Link>
              </CardContent>
            </Card>
          )}
          {detalle.movimientoOriginalId && (
            <Card>
              <CardContent className="p-5">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                  <Undo2 className="h-4 w-4" /> Revirtió al movimiento
                </p>
                <Link
                  href={`/clientes/${clienteId}/movimientos/${detalle.movimientoOriginalId}`}
                  className="font-bold text-lg text-primary hover:underline"
                >
                  #{formatNumber(detalle.movimientoOriginalId, { kind: "identifier" })}
                </Link>
              </CardContent>
            </Card>
          )}
        </div>

        {detalle.notas && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <FileText className="h-4 w-4" /> Notas del movimiento
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="font-medium text-base whitespace-pre-wrap leading-relaxed">{detalle.notas}</p>
            </CardContent>
          </Card>
        )}

        {detalle.reversoMovimientoId && (
          <Card className="border-rose-200 bg-rose-50/50 dark:bg-rose-950/20 dark:border-rose-900/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-xs font-bold uppercase tracking-wider text-rose-700 dark:text-rose-400 flex items-center gap-2">
                <ShieldAlert className="h-4 w-4" /> Movimiento Revertido
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-base font-medium text-rose-900 dark:text-rose-200 mb-4">
                {detalle.motivoReverso || "Sin motivo registrado"}
              </p>
              <Link
                href={`/clientes/${clienteId}/movimientos/${detalle.reversoMovimientoId}`}
                className="font-bold text-rose-700 dark:text-rose-400 hover:underline inline-flex items-center gap-1"
              >
                Ver movimiento de reverso &rarr;
              </Link>
            </CardContent>
          </Card>
        )}

        {isAbono && detalle.saldoAFavor && detalle.saldoAFavor !== "0.00" && detalle.saldoAFavor !== "0" && (
          <div className="p-6 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-bold text-amber-900 dark:text-amber-400 uppercase tracking-wider mb-1">
                Saldo a favor remanente
              </h3>
              <p className="text-sm text-amber-800/80 dark:text-amber-300/80 font-medium">
                Porción del abono no aplicada a ninguna nota.
              </p>
            </div>
            <div className="text-3xl font-black text-amber-700 dark:text-amber-400 tabular-nums text-right">
              {formatNumber(detalle.saldoAFavor, { kind: "money" })}
            </div>
          </div>
        )}

        {isAbono && (
          <Card>
            <CardHeader className="border-b bg-muted/20">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Activity className="h-5 w-5" /> Reparto a notas
              </CardTitle>
              <CardDescription className="text-sm">
                {detalle.revertido
                  ? "Evidencia histórica de aplicaciones que dejaron de estar activas. No representa el reparto ni los saldos vigentes."
                  : "Aplicación proyectada cronológicamente sobre los saldos del cliente."}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {!detalle.reparto || detalle.reparto.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground font-medium">
                  Movimiento sin aplicaciones
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/10 hover:bg-muted/10">
                        <TableHead className="py-4 font-bold text-muted-foreground w-1/4">Nota</TableHead>
                        <TableHead className="py-4 font-bold text-muted-foreground text-right">Saldo Antes</TableHead>
                        <TableHead className="py-4 font-bold text-muted-foreground text-right text-emerald-700 dark:text-emerald-400">Aplicado</TableHead>
                        <TableHead className="py-4 font-bold text-muted-foreground text-right">Saldo Después</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {detalle.reparto.map((item) => (
                        <TableRow key={item.movimientoVentaId} className={!item.vigente ? "opacity-40 line-through grayscale" : "hover:bg-muted/30"}>
                          <TableCell className="py-4">
                            {item.ticketId && item.folio ? (
                              <Link href={`/tickets/${item.ticketId}`} className="font-bold text-primary hover:underline">
                                #{formatNumber(item.folio, { kind: "identifier" })}
                              </Link>
                            ) : (
                              <span className="font-bold text-muted-foreground italic">Nota histórica</span>
                            )}
                            {!item.vigente && (
                              <span className="ml-2 inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                                Anulado
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="py-4 text-right font-medium tabular-nums text-muted-foreground">
                            {item.saldoAntes === null ? "— (sin evidencia)" : formatNumber(item.saldoAntes, { kind: "money" })}
                          </TableCell>
                          <TableCell className="py-4 text-right font-black tabular-nums text-emerald-600 dark:text-emerald-400">
                            +{formatNumber(item.importeAplicado, { kind: "money" })}
                          </TableCell>
                          <TableCell className="py-4 text-right font-black tabular-nums">
                            {item.saldoDespues === null ? "— (sin evidencia)" : formatNumber(item.saldoDespues, { kind: "money" })}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {isReverso && (
          <Card className="border-rose-200 dark:border-rose-900/50">
            <CardHeader className="border-b border-rose-100 dark:border-rose-900/30 bg-rose-50/50 dark:bg-rose-950/20">
              <CardTitle className="flex items-center gap-2 text-lg text-rose-800 dark:text-rose-400">
                <Activity className="h-5 w-5" /> Aplicaciones Anuladas
              </CardTitle>
              <CardDescription className="text-sm text-rose-700/80 dark:text-rose-300/80">
                Las notas que recobraron este saldo al ejecutarse el reverso.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {!detalle.aplicacionesRevertidas || detalle.aplicacionesRevertidas.length === 0 ? (
                <div className="p-8 text-center text-rose-700/60 dark:text-rose-400/60 font-medium">
                  Movimiento sin aplicaciones revertidas
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-rose-50/30 dark:bg-rose-950/10 hover:bg-rose-50/30">
                        <TableHead className="py-4 font-bold text-rose-700/80 dark:text-rose-400/80 w-1/4">Nota</TableHead>
                        <TableHead className="py-4 font-bold text-rose-700/80 dark:text-rose-400/80 text-right">Saldo Previo</TableHead>
                        <TableHead className="py-4 font-bold text-rose-700 dark:text-rose-400 text-right">Monto Restituido</TableHead>
                        <TableHead className="py-4 font-bold text-rose-700/80 dark:text-rose-400/80 text-right">Nuevo Saldo Deudor</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {detalle.aplicacionesRevertidas.map((item) => (
                        <TableRow key={item.movimientoVentaId} className="hover:bg-rose-50/50 dark:hover:bg-rose-900/20">
                          <TableCell className="py-4">
                            {item.ticketId && item.folio ? (
                              <Link href={`/tickets/${item.ticketId}`} className="font-bold text-primary hover:underline">
                                #{formatNumber(item.folio, { kind: "identifier" })}
                              </Link>
                            ) : (
                              <span className="font-bold text-muted-foreground italic">Nota histórica</span>
                            )}
                          </TableCell>
                          <TableCell className="py-4 text-right font-medium tabular-nums text-muted-foreground">
                            {item.saldoAntes === null ? "— (sin evidencia)" : formatNumber(item.saldoAntes, { kind: "money" })}
                          </TableCell>
                          <TableCell className="py-4 text-right font-black tabular-nums text-rose-600 dark:text-rose-400">
                            +{formatNumber(item.importeAplicado, { kind: "money" })}
                          </TableCell>
                          <TableCell className="py-4 text-right font-black tabular-nums">
                            {item.saldoDespues === null ? "— (sin evidencia)" : formatNumber(item.saldoDespues, { kind: "money" })}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {detalle.auditoria && detalle.auditoria.length > 0 && (
          <Card className="bg-muted/10 border-dashed">
            <CardHeader className="border-b border-dashed pb-3">
              <CardTitle className="flex items-center gap-2 text-sm text-muted-foreground uppercase tracking-wider">
                <ShieldAlert className="h-4 w-4" /> Bitácora de Auditoría
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="py-3 font-bold text-xs uppercase tracking-wider text-muted-foreground">Instante</TableHead>
                      <TableHead className="py-3 font-bold text-xs uppercase tracking-wider text-muted-foreground">Usuario</TableHead>
                      <TableHead className="py-3 font-bold text-xs uppercase tracking-wider text-muted-foreground">Acción</TableHead>
                      <TableHead className="py-3 font-bold text-xs uppercase tracking-wider text-muted-foreground">Evidencia</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {detalle.auditoria.map((log) => (
                      <TableRow key={log.id} className="hover:bg-muted/30 border-dashed">
                        <TableCell className="py-3 whitespace-nowrap text-sm font-medium tabular-nums">
                          {formatMexicoCityDateTime(log.fecha)}
                        </TableCell>
                        <TableCell className="py-3 text-sm font-medium">
                          {log.usuario}
                        </TableCell>
                        <TableCell className="py-3">
                          <Badge variant="outline" className="uppercase text-[10px] font-bold tracking-wider">
                            {log.accion}
                          </Badge>
                        </TableCell>
                        <TableCell className="py-3 text-sm text-muted-foreground break-words max-w-[300px]">
                          {log.motivo}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}