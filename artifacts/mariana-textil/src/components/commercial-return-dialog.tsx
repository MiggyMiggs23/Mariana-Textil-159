import { useRef, useState } from "react";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { useListLocations, useObtenerSesionCajaActual, getListLocationsQueryKey, getObtenerSesionCajaActualQueryKey, type TicketDetalle } from "@workspace/api-client-react";
import { RotateCcw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  COMMERCIAL_RETURN_UI_ENABLED, commercialReturnMessage, commercialReturnRequestSchema,
  commercialReturnResultSchema, requestCommercialReturn, returnJournalKey,
  type CommercialReturnRequest, type CommercialReturnPreview, type CommercialReturnResult,
} from "@/lib/commercial-return";

type Props = { ticket: TicketDetalle; actorId: number; isAdmin: boolean };
export function CommercialReturnAction(props: Props) {
  if (!COMMERCIAL_RETURN_UI_ENABLED || !props.isAdmin ||
      props.ticket.documentoTipo !== "NOTA" || props.ticket.estado !== "VENDIDO" ||
      props.ticket.autorizacionEstado !== "AUTORIZADA") return null;
  return <CommercialReturnDialog key={`${props.actorId}:${props.ticket.id}`} {...props} />;
}
function CommercialReturnDialog({ ticket, actorId }: Props) {
  const [open, setOpen] = useState(false);
  const [lineId, setLineId] = useState("");
  const [siteId, setSiteId] = useState(String(ticket.ubicacionId));
  const [reason, setReason] = useState("");
  const [preview, setPreview] = useState<CommercialReturnPreview | null>(null);
  const [result, setResult] = useState<CommercialReturnResult | null>(null);
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const journal = returnJournalKey(actorId, ticket.id);
  const [initialJournal] = useState(() => {
    try {
      const saved = sessionStorage.getItem(journal);
      const request = saved ? commercialReturnRequestSchema.parse(JSON.parse(saved)) : null;
      if (request && request.ticketId !== ticket.id) throw new Error("Nota incompatible.");
      return { request, blocked: false, error: "" };
    } catch {
      return { request: null, blocked: true,
        error: "No se pudo verificar la solicitud guardada. No captures otra devolución; solicita revisión de la operación pendiente." };
    }
  });
  const [pending, setPending] = useState<CommercialReturnRequest | null>(initialJournal.request);
  const [error, setError] = useState(initialJournal.error);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const locations = useListLocations(undefined, { query: { enabled: open, queryKey: [...getListLocationsQueryKey(), actorId] } });
  const session = useObtenerSesionCajaActual({ ubicacionId: Number(siteId) }, {
    query: { enabled: open && !!Number(siteId), queryKey: [...getObtenerSesionCajaActualQueryKey({ ubicacionId: Number(siteId) }), actorId] },
  });
  const line = ticket.lineas.find(row => row.id === Number(lineId));
  const activeSession = session.data?.sesion;
  const resetPreview = () => { setPreview(null); if (!initialJournal.blocked) setError(""); };
  async function review() {
    if (initialJournal.blocked || inFlight.current || !line || !activeSession) return;
    inFlight.current = true; setBusy(true); setError("");
    try {
      const input = commercialReturnRequestSchema.parse({
        uuidCliente: crypto.randomUUID(), ticketId: ticket.id, lineaId: line.id,
        ubicacionRecepcionId: Number(siteId), sesionCajaId: activeSession.id,
        cantidad: line.cantidad, motivo: reason,
      });
      const response = await requestCommercialReturn(input, true);
      setPreview(response);
    } catch (failure) { setError(commercialReturnMessage(failure)); }
    finally { inFlight.current = false; setBusy(false); }
  }
  async function confirm() {
    if (initialJournal.blocked || inFlight.current || (!pending && (!preview || !line || !activeSession))) return;
    inFlight.current = true; setBusy(true); setError("");
    const retry = pending !== null;
    try {
      const input: CommercialReturnRequest = pending ?? {
        uuidCliente: crypto.randomUUID(), ticketId: ticket.id, lineaId: line!.id,
        ubicacionRecepcionId: preview!.ubicacionRecepcionId, sesionCajaId: preview!.sesionCajaId,
        cantidad: preview!.cantidad, motivo: reason.trim(),
        revision: { importeRollo: preview!.importeRollo, deudaCancelada: preview!.deudaCancelada, efectivoDevuelto: preview!.efectivoDevuelto },
      };
      // Persist before sending. If storage fails, do not risk an unrecoverable request.
      sessionStorage.setItem(journal, JSON.stringify(input));
      setPending(input);
      const saved = commercialReturnResultSchema.parse(await requestCommercialReturn(input, false));
      setResult(saved); setPending(null); setPreview(null);
      sessionStorage.removeItem(journal);
      toast({ title: "Devolución comercial registrada", description: `Serie ${saved.serie}. Deuda cancelada $${saved.deudaCancelada}; efectivo devuelto $${saved.efectivoDevuelto}.` });
      // Covers Caja/cuts, statement/credit, note details, inventory and dashboards.
      await queryClient.invalidateQueries();
    } catch (failure) {
      const status = (failure as { status?: number })?.status;
      const code = (failure as { data?: { error?: { code?: string } } })?.data?.error?.code;
      // A definite rejection of the FIRST send permits correction. After any
      // uncertain result, retain the exact request/key even if a retry is denied.
      if (!retry && (status === 400 || status === 409) && code !== "IDEMPOTENCIA_CONFLICTO") {
        sessionStorage.removeItem(journal); setPending(null); setPreview(null);
      }
      setError(commercialReturnMessage(failure));
    } finally { inFlight.current = false; setBusy(false); }
  }
  const selectable = ticket.lineas.filter(row => row.tipo === "NORMAL" && row.rolloId != null);
  const inputClass = "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm";
  return <>
    <Button variant="outline" className="w-full sm:w-auto" onClick={() => setOpen(true)}>
      <RotateCcw className="mr-2 h-4 w-4" /> Devolver rollo completo
    </Button>
    <Dialog open={open} onOpenChange={value => { if (!inFlight.current) setOpen(value); }}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Devolución comercial · Nota #{ticket.folio}</DialogTitle>
          <DialogDescription>Movimiento nuevo, sin editar la venta ni su corte. Solo el rollo completo, con la misma serie y cantidad. Nunca genera saldo a favor.</DialogDescription>
        </DialogHeader>
        {result ? <div className="space-y-3" role="status">
          <p className="font-semibold">Devolución registrada · Serie {result.serie}</p>
          <dl className="grid grid-cols-2 gap-2 text-sm">
            <dt>Deuda cancelada</dt><dd>${result.deudaCancelada}</dd>
            <dt>Efectivo devuelto</dt><dd>${result.efectivoDevuelto}</dd>
            <dt>Cantidad recibida</dt><dd>{result.cantidad}</dd>
          </dl>
          <p className="break-all text-xs text-muted-foreground">Documento: {result.id}</p>
          <p className="text-sm">{result.motivo}</p>
          <Link className="text-sm underline" href={`/inventario/rollos/${result.rolloId}`}>Ver rollo recibido</Link>
          <Button className="w-full" variant="outline" onClick={() => { setResult(null); setLineId(""); setReason(""); }}>Devolver otro rollo de esta nota</Button>
        </div> : pending ? <div className="space-y-3 text-sm">
          <p className="font-semibold">Confirmación pendiente de recuperar</p>
          <p>Se conservaron la solicitud y su clave. No captures otra devolución para este rollo. Reintentar consulta o completa exactamente la misma operación, sin duplicarla.</p>
          <p>Cantidad: {pending.cantidad} · Motivo: {pending.motivo}</p>
        </div> : <div className="space-y-4">
          <div className="space-y-2"><Label htmlFor="commercial-roll">Rollo original</Label>
            <select id="commercial-roll" className={inputClass} value={lineId} disabled={busy} onChange={event => { setLineId(event.target.value); resetPreview(); }}>
              <option value="">Selecciona un rollo</option>
              {selectable.map(row => <option key={row.id} value={row.id}>Serie {row.serieRollo} · {row.telaProducto} · {row.colorProducto} · {row.cantidad} {row.unidadProducto}</option>)}
            </select>
            {line && <p className="text-sm text-muted-foreground">Cantidad íntegra: {line.cantidad} {line.unidadProducto}. No se admiten cantidades parciales.</p>}
          </div>
          <div className="space-y-2"><Label htmlFor="commercial-site">Tienda que recibe el rollo</Label>
            <select id="commercial-site" className={inputClass} value={siteId} disabled={busy || locations.isLoading} onChange={event => { setSiteId(event.target.value); resetPreview(); }}>
              <option value="">Selecciona una tienda</option>
              {locations.data?.filter(site => site.activa && site.tipo === "TIENDA").map(site => <option key={site.id} value={site.id}>{site.nombre}</option>)}
            </select>
            {locations.isError && <p role="alert" className="text-sm text-destructive">No se pudieron consultar las tiendas.</p>}
            {session.isError ? <p role="alert" className="text-sm text-destructive">No se pudo consultar la caja.</p>
              : <p className="text-sm text-muted-foreground">{session.isLoading ? "Consultando caja…" : activeSession?.estado === "ABIERTA" ? `Caja abierta: ${activeSession.nombreUbicacion}. El servidor verificará que corresponda al día de hoy.` : "Se requiere una caja abierta del día en esta tienda."}</p>}
          </div>
          <div className="space-y-2"><Label htmlFor="commercial-reason">Motivo obligatorio</Label>
            <Textarea id="commercial-reason" maxLength={400} value={reason} disabled={busy} onChange={event => { setReason(event.target.value); resetPreview(); }} />
          </div>
          {preview && <div className="rounded-md border bg-muted/30 p-4 text-sm space-y-2">
            <p className="font-semibold">Revisión del servidor · Serie {preview.serie}</p>
            <p>Importe del rollo: ${preview.importeRollo}</p><p>Cancelar deuda: ${preview.deudaCancelada}</p>
            <p>Devolver de la caja del día: ${preview.efectivoDevuelto}</p>
            <p className="text-muted-foreground">Se verificará nuevamente al confirmar. Si cambian los importes, deberás revisar otra vez.</p>
          </div>}
        </div>}
        {error && <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</p>}
        <DialogFooter>
          <Button variant="outline" disabled={busy} onClick={() => setOpen(false)}>Cerrar</Button>
          {!result && (pending || preview ? <Button disabled={busy || initialJournal.blocked} onClick={confirm}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{pending ? "Reintentar misma solicitud" : "Confirmar devolución"}
          </Button> : <Button disabled={initialJournal.blocked || busy || !line || !reason.trim() || !activeSession || activeSession.estado !== "ABIERTA"} onClick={review}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Revisar devolución
          </Button>)}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </>;
}