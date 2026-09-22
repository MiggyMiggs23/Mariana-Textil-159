import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { Link, useParams } from "wouter";
import {
  useGetCurrentUser, useGetE5Disponibilidad, useGetE5Contexto, useListE5Cobros,
  useGetE5Cobro, usePreviewE5Cobro, useGetE5DevolucionOpciones, useListE5Avisos,
  getGetE5DisponibilidadQueryKey, getGetE5ContextoQueryKey, getListE5CobrosQueryKey,
  getGetE5CobroQueryKey, getGetE5DevolucionOpcionesQueryKey, getListE5AvisosQueryKey,
  useGetCajaAbonoE3Context, getGetCajaAbonoE3ContextQueryKey,
  type E5Cobro, type E5Contexto, type E5Capacidades, type E5RecepcionInput,
  type E5VistaPrevia, type E5Asignacion, type E5Nota, type E5Estado,
  type CurrentUser,
} from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useLocationScope } from "@/lib/location-scope";
import { E5_ENABLED } from "@/lib/e5-feature-flags";
import { E3_ENABLED } from "@/lib/e3-feature-flags";
import { e5Cents, e5Decimal, e5Error, useE5Actions, useE5Identity, type E5Command } from "@/hooks/use-e5-actions";
import { formatNumber } from "@workspace/number-format";
import { e5AuthorizationContext, e5CanRead, e5CanReceive, e5CanPrepare, assertE5Context, assertE5Detail } from "@/lib/e5-authorization";

export const e5Money = (value: string) => formatNumber(value, { kind: "money" });
export const e5Date = (value: string) => new Date(value).toLocaleString("es-MX", { timeZone: "America/Mexico_City" });
const panel = "space-y-4 rounded-xl border bg-card p-4";
const select = "rounded-md border bg-background p-2 w-full";
type Scope = { site: number; actor: number; admin: boolean; user: CurrentUser; capabilities: E5Capacidades; scope: string };
const queryOptions = { staleTime: 0, refetchOnMount: "always" as const };

export function E5Problem({ error }: { error: unknown }) {
  return <p role="alert" className="text-destructive">{typeof error === "string" ? error : e5Error(error)}</p>;
}

/** Wrapper prevents even mounting E5 hooks while construction gate is OFF. */
export function E5Boundary({ children }: { children: (scope: Scope) => ReactNode }) {
  return E5_ENABLED ? <E5ActorBoundary>{children}</E5ActorBoundary> : null;
}
function E5ActorBoundary({ children }: { children: (scope: Scope) => ReactNode }) {
  const user = useGetCurrentUser();
  const { selectedLocationId } = useLocationScope();
  if (user.error) return <E5Problem error={user.error} />;
  if (!user.data) return <p>Cargando identidad…</p>;
  if (!selectedLocationId) return <E5Problem error="Selecciona un sitio para consultar cobros retenidos." />;
  if (user.data.rol !== "CONTADOR" && !e5CanRead(user.data)) return <E5Problem error="Sin permiso efectivo de consulta E5. Intenciones previas conservadas para revisión ADMIN; no se reenviarán." />;
  return <E5Availability key={`${user.data.id}:${selectedLocationId}:${e5AuthorizationContext(user.data)}`} user={user.data} actor={user.data.id} site={selectedLocationId} admin={user.data.rol === "ADMIN"}>{children}</E5Availability>;
}
function E5Availability({ actor, site, admin, user, children }: Omit<Scope, "scope" | "capabilities"> & { children: (scope: Scope) => ReactNode }) {
  const scope = `${actor}:${site}:${e5AuthorizationContext(user)}`;
  const available = useGetE5Disponibilidad({ ubicacionId: site }, { query: { ...queryOptions, queryKey: [...getGetE5DisponibilidadQueryKey({ ubicacionId: site }), scope] } });
  if (available.error) return <E5Problem error={available.error} />;
  if (!available.data) return <p>Comprobando disponibilidad E5…</p>;
  if (!available.data.enabled) return <E5Problem error="E5 está cerrado en el servidor. No se puede recibir ni consultar por esta vía." />;
  if (!e5CanRead(user, available.data.capacidades)) return <E5Problem error="Sin permiso de lectura o capacidad futura A explícita; no se habilita CONTADOR genérico." />;
  return <>{children({ site, actor, admin, user, scope, capabilities: available.data.capacidades })}</>;
}

export function E5Entry({ clienteId, entrada }: { clienteId?: number; entrada: "CAJA" | "CLIENTE" }) {
  return <E5Boundary>{scope => <E5EntryBody key={`${scope.scope}:${clienteId ?? "selector"}`} {...scope} clienteId={clienteId} entrada={entrada} />}</E5Boundary>;
}
function E5EntryBody(props: Scope & { clienteId?: number; entrada: "CAJA" | "CLIENTE" }) {
  const [open, setOpen] = useState(false);
  const [captureLocked, setCaptureLocked] = useState(false);
  const [client, setClient] = useState<number | null>(props.clienteId ?? null);
  return <section className={panel} aria-label="Cobros pendientes de aplicación">
    <h2 className="font-bold">Dinero recibido pendiente de aplicación</h2>
    <p>No disminuye deuda ni aumenta disponible o saldo a favor mientras espera autorización.</p>
    <Link className="underline" href="/cobros/pendientes">Abrir bandeja de pendientes</Link>
    {props.entrada === "CAJA" && props.admin && props.capabilities.puedeVerAvisos && <AdminNotice {...props} />}
    {props.capabilities.puedeRecibir && e5CanReceive(props.user, props.entrada) && <Button className="ml-3" disabled={captureLocked} onClick={() => setOpen(!open)}>{open ? "Ocultar captura" : "Recibir dirigido"}</Button>}
    {open && <div className={panel}>
      {!props.clienteId && <E5ClientSelector {...props} value={client} onChange={setClient} disabled={captureLocked} />}
      {client && <Reception key={`${props.scope}:${client}:${props.entrada}`} {...props} clienteId={client} onLockChange={setCaptureLocked} />}
    </div>}
    {props.clienteId && <CobrosList {...props} />}
  </section>;
}
/** Existing E3 authorized selector context, but explicit dependency/error states. */
function E5ClientSelector(props: Scope & { value: number | null; onChange: (id: number | null) => void; disabled: boolean }) {
  const [search, setSearch] = useState("");
  const [requested, setRequested] = useState("");
  const params = { sitioId: props.site, buscar: requested };
  const clients = useGetCajaAbonoE3Context(params, { query: {
    queryKey: [...getGetCajaAbonoE3ContextQueryKey(params), props.scope],
    enabled: E3_ENABLED && requested.length >= 2, staleTime: 0,
  } });
  if (!E3_ENABLED) return <E5Problem error="Selector autorizado de clientes: dependencia E3 cerrada. No se inventará una lista vacía. Usa un cliente ya identificado en ficha o por nota de Caja, o espera habilitación coordinada." />;
  return <fieldset disabled={props.disabled} className="space-y-2">
    <label>Buscar cliente autorizado<Input value={search} onChange={e => setSearch(e.target.value)} /></label>
    <Button variant="outline" disabled={search.trim().length < 2} onClick={() => { setRequested(search.trim()); if (requested === search.trim()) void clients.refetch(); }}>Buscar cliente</Button>
    {clients.error ? <E5Problem error={clients.error} /> : clients.isFetching ? <p>Buscando clientes…</p> : requested.length >= 2 && clients.data ? <>
      {!clients.data.clientes.length ? <p>No hay coincidencias en tu alcance.</p> : <select className={select} aria-label="Cliente receptor" value={props.value ?? ""} onChange={e => props.onChange(e.target.value ? Number(e.target.value) : null)}>
        <option value="">Selecciona cliente…</option>{clients.data.clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
      </select>}
    </> : <p>Busca por al menos dos caracteres.</p>}
  </fieldset>;
}
function AdminNotice(props: Scope) {
  const params = { ubicacionId: props.site, limit: 5 };
  const alerts = useListE5Avisos(params, { query: { ...queryOptions, queryKey: [...getListE5AvisosQueryKey(params), props.scope], refetchInterval: 60000 } });
  if (alerts.error) return <E5Problem error={alerts.error} />;
  if (!alerts.data) return <p>Consultando avisos ADMIN…</p>;
  if (alerts.data.items.some(c => c.ubicacionId !== props.site)) return <E5Problem error="Avisos ajenos al sitio solicitado. No se mostrarán." />;
  return alerts.data.items.length ? <aside className="space-y-2 rounded border border-amber-400 bg-amber-50 p-3 text-amber-950">
    <strong>ADMIN: dinero pendiente desde hace tres días o más</strong>
    {alerts.data.items.map(c => <p key={c.id}><Link className="underline" href={`/cobros/pendientes/${c.id}`}>{c.clienteNombre} · {e5Money(c.importePendiente)} · {c.antiguedadDias} días</Link></p>)}
    <Link className="underline" href="/cobros/pendientes">Revisar todos los avisos del sitio</Link>
  </aside> : null;
}

function Evidence({ description, setDescription, references, setReferences }: {
  description: string; setDescription: (s: string) => void; references: string; setReferences: (s: string) => void;
}) {
  return <div className="space-y-2">
    <label className="block">Motivo / evidencia obligatoria<Textarea maxLength={2000} value={description} onChange={e => setDescription(e.target.value)} /></label>
    <label className="block">Referencias documentales (texto, una por línea; máximo 20)<Textarea value={references} onChange={e => setReferences(e.target.value)} /></label>
  </div>;
}
function evidence(description: string, references: string) {
  const descripcion = description.trim();
  const referencias = references.split("\n").map(s => s.trim()).filter(Boolean);
  if (!descripcion || descripcion.length > 2000) throw new Error("Escribe motivo/evidencia (máximo 2000 caracteres).");
  if (referencias.length > 20 || referencias.some(s => s.length > 500)) throw new Error("Referencias fuera del límite contractual.");
  return { descripcion, referencias };
}
function allocationInputs(notes: E5Nota[], amounts: Record<number, string>, setAmounts: (a: Record<number, string>) => void) {
  return <div className="space-y-2">{notes.map(note => <label key={note.movimientoVentaId} className="grid gap-2 border-b pb-2 sm:grid-cols-2">
    <span>Nota {note.folio} · cargo #{note.movimientoVentaId} · {note.facturada ? "Facturada" : "No facturada"} · saldo {e5Money(note.saldoPendiente)}</span>
    <Input aria-label={`Importe nota ${note.folio} cargo ${note.movimientoVentaId}`} inputMode="decimal" placeholder="Sin asignar" value={amounts[note.movimientoVentaId] ?? ""} onChange={e => setAmounts({ ...amounts, [note.movimientoVentaId]: e.target.value })} />
  </label>)}</div>;
}
function allocations(notes: E5Nota[], amounts: Record<number, string>, limit: string, ceilings?: E5Asignacion[], favor = 0): E5Asignacion[] {
  const result = notes.filter(n => (amounts[n.movimientoVentaId] ?? "").trim()).map(n => {
    const cents = e5Cents(amounts[n.movimientoVentaId]);
    if (!cents || cents > e5Cents(n.saldoPendiente)) throw new Error(`Revisa saldo vigente de nota ${n.folio}.`);
    if (ceilings && cents > e5Cents(ceilings.find(a => a.notaId === n.notaId && a.movimientoVentaId === n.movimientoVentaId)?.importe ?? "0")) throw new Error("No se puede ampliar una propuesta al autorizar.");
    return { notaId: n.notaId, movimientoVentaId: n.movimientoVentaId, importe: e5Decimal(cents) };
  }).sort((a, b) => a.movimientoVentaId - b.movimientoVentaId);
  if ((!result.length && !favor) || result.length > 100 || new Set(result.map(a => a.movimientoVentaId)).size !== result.length || result.reduce((sum, a) => sum + e5Cents(a.importe), favor) > e5Cents(limit)) throw new Error("El reparto explícito y favor autorizado deben ser positivos y no exceder el dinero retenido.");
  return result;
}
function Documents({ cobro, admin }: { cobro: E5Cobro; admin: boolean }) {
  if (!admin || !cobro.capacidades.puedeImprimir) return <p>Comprobante de recepción emitido. La impresión del documento completo corresponde a ADMIN.</p>;
  const base = `/cobros/pendientes/${cobro.id}/documentos/`;
  return <div className="flex flex-wrap gap-4">
    <Link className="underline" href={`${base}${cobro.reciboId}`}>Recibo inmediato</Link>
    {cobro.aplicaciones.map(a => <Link key={a.id} className="underline" href={`${base}${a.constanciaId}`}>Constancia · {e5Date(a.fechaAplicacion)}</Link>)}
  </div>;
}
function Result({ cobro, admin }: { cobro: E5Cobro; admin: boolean }) {
  return <div role="status" className="space-y-2 rounded border border-green-600 p-3">
    <p>Operación confirmada · {cobro.estado}. Retenido: {e5Money(cobro.importePendiente)}.</p>
    <Link className="underline" href={`/cobros/pendientes/${cobro.id}`}>Ver recepción y cronología</Link>
    <Documents cobro={cobro} admin={admin} />
  </div>;
}
function ActionStatus({ actions, admin }: { actions: ReturnType<typeof useE5Actions>; admin: boolean }) {
  return <>
    {actions.error && <E5Problem error={actions.error} />}
    {actions.pending && <Button disabled={actions.busy} onClick={() => void actions.retry()}>Reintentar misma operación pendiente ({actions.pending.kind})</Button>}
    {actions.busy && <p role="status">Comprobando y registrando… No repitas la operación.</p>}
    {actions.result && <Result cobro={actions.result} admin={admin} />}
  </>;
}
function Reception(props: Scope & { clienteId: number; entrada: "CAJA" | "CLIENTE"; onLockChange: (locked: boolean) => void }) {
  const contextParams = { clienteId: props.clienteId, ubicacionId: props.site };
  const context = useGetE5Contexto(contextParams, { query: { ...queryOptions, queryKey: [...getGetE5ContextoQueryKey(contextParams), props.scope] } });
  const preview = usePreviewE5Cobro();
  const actions = useE5Actions(`${props.scope}:recepcion:${props.clienteId}:${props.entrada}`, { site: props.site, client: props.clienteId });
  const identity = useE5Identity();
  const previewLock = useRef(false);
  const [reviewing, setReviewing] = useState(false);
  const [notes, setNotes] = useState<number[]>([]);
  const [amount, setAmount] = useState("");
  const [medium, setMedium] = useState<"EFECTIVO" | "TRANSFERENCIA">("EFECTIVO");
  const [account, setAccount] = useState<"CUENTA_FISCAL" | "CUENTA_NO_FISCAL" | "">("");
  const [session, setSession] = useState("");
  const [description, setDescription] = useState("");
  const [references, setReferences] = useState("");
  const [applyNow, setApplyNow] = useState(false);
  const [amounts, setAmounts] = useState<Record<number, string>>({});
  const [error, setError] = useState("");
  const [review, setReview] = useState<{ input: E5RecepcionInput; preview: E5VistaPrevia } | null>(null);
  useLayoutEffect(() => {
    props.onLockChange(actions.blocked || reviewing);
    return () => props.onLockChange(false);
  }, [actions.blocked, reviewing, props.onLockChange]);
  if (context.error) return <><E5Problem error={context.error} /><Button onClick={() => void context.refetch()}>Recargar contexto</Button><ActionStatus actions={actions} admin={props.admin} /></>;
  if (!context.data) return <p>Cargando notas, saldos y sesiones autorizadas…</p>;
  const ctx = context.data;
  if (ctx.clienteId !== props.clienteId || ctx.ubicacionId !== props.site) return <E5Problem error="Contexto ajeno al cliente/sitio solicitado. Captura bloqueada." />;
  const canReceive = e5CanReceive(props.user, props.entrada) && props.capabilities.puedeRecibir && ctx.capacidades.puedeRecibir;
  const canApply = props.admin && props.capabilities.puedeAutorizar && ctx.capacidades.puedeAutorizar;
  const needsSession = props.entrada === "CAJA" || medium === "EFECTIVO";
  const build = (): E5RecepcionInput => {
    if (!canReceive) throw new Error("Sin capacidad para recibir.");
    if (needsSession && !ctx.sesiones.some(s => s.id === Number(session) && s.ubicacionId === props.site)) throw new Error("Selecciona una sesión abierta autorizada.");
    const selected = ctx.notas.filter(n => notes.includes(n.notaId));
    if (!selected.length || new Set(selected.map(n => n.notaId)).size !== notes.length || notes.length > 100 || new Set(selected.map(n => n.movimientoVentaId)).size !== selected.length) throw new Error("Selecciona notas vigentes del mismo cliente sin duplicar cargos.");
    const exact = selected.reduce((sum, n) => sum + e5Cents(n.saldoPendiente), 0);
    const cents = props.admin ? e5Cents(amount) : exact;
    if (!cents) throw new Error("El importe debe ser positivo.");
    if (medium === "TRANSFERENCIA" && !account) throw new Error("Selecciona la cuenta bancaria receptora.");
    const body: Omit<E5RecepcionInput, "claveOperacion"> = {
      clienteId: props.clienteId, ubicacionId: props.site, entrada: props.entrada,
      versionContexto: ctx.versionContexto, importe: e5Decimal(cents), formaPago: medium,
      cuentaDestino: medium === "EFECTIVO" ? "CAJA_FISICA" : account as "CUENTA_FISCAL" | "CUENTA_NO_FISCAL",
      ...(props.entrada === "CAJA" ? { sesionOperativaId: Number(session) } : {}),
      ...(medium === "EFECTIVO" ? { sesionCajaId: Number(session) } : {}),
      notasIndicadas: [...notes].sort((a, b) => a - b), evidencia: evidence(description, references),
      ...(applyNow && canApply ? { aplicarAhora: allocations(selected, amounts, e5Decimal(cents)) } : {}),
    };
    return { ...body, claveOperacion: identity(body) };
  };
  const reviewReceipt = async () => {
    if (previewLock.current || actions.blocked) return;
    previewLock.current = true; setReviewing(true); setError(""); setReview(null);
    try {
      const input = build();
      const fresh = await context.refetch();
      if (fresh.error || !fresh.data) throw fresh.error || new Error("Contexto no disponible.");
      assertE5Context(fresh.data, props.clienteId, props.site);
      if (fresh.data.versionContexto !== input.versionContexto) throw new Error("Los saldos o sesiones cambiaron. Revisa las notas e importe; no se recibió dinero.");
      const data = await preview.mutateAsync({ data: input });
      if (data.versionContexto !== input.versionContexto) throw new Error("La vista previa no coincide con el contexto. Recarga antes de confirmar.");
      setReview({ input, preview: data });
    } catch (err) { setError(e5Error(err)); }
    finally { previewLock.current = false; setReviewing(false); }
  };
  return <div className="space-y-4">
    <h3 className="font-semibold">Recepción real · {ctx.clienteNombre} · Entrada {props.entrada}</h3>
    <p>No es recaptura. Recibido sin aplicar no constituye saldo a favor. Contexto: {e5Date(ctx.consultadoAt)}.</p>
    <ActionStatus actions={actions} admin={props.admin} />
    {error && <E5Problem error={error} />}
    {!actions.result && <fieldset className="space-y-3" disabled={actions.blocked || reviewing || !canReceive}>
      {!review ? <>
        {ctx.notas.filter((n, index, all) => all.findIndex(other => other.notaId === n.notaId) === index).map(note => <label key={note.notaId} className="flex gap-2">
          <input type="checkbox" checked={notes.includes(note.notaId)} onChange={e => setNotes(e.target.checked ? [...new Set([...notes, note.notaId])] : notes.filter(id => id !== note.notaId))} />
          Nota {note.folio} · saldo de todos sus cargos {e5Money(e5Decimal(ctx.notas.filter(n => n.notaId === note.notaId).reduce((sum, n) => sum + e5Cents(n.saldoPendiente), 0)))} · {note.facturada ? "Facturada" : "No facturada"}
        </label>)}
        {!ctx.notas.length && <p>No hay notas autorizadas para recibir un dirigido.</p>}
        {props.admin ? <label className="block">Importe recibido<Input inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} /></label>
          : <p>Importe exacto de notas indicadas: {e5Money(e5Decimal(ctx.notas.filter(n => notes.includes(n.notaId)).reduce((s, n) => s + e5Cents(n.saldoPendiente), 0)))}</p>}
        <label className="block">Medio<select className={select} value={medium} onChange={e => { setMedium(e.target.value as typeof medium); setSession(""); }}><option>EFECTIVO</option><option>TRANSFERENCIA</option></select></label>
        {medium === "TRANSFERENCIA" && <label className="block">Cuenta receptora<select className={select} value={account} onChange={e => setAccount(e.target.value as typeof account)}><option value="">Selecciona…</option><option value="CUENTA_FISCAL">Cuenta fiscal</option><option value="CUENTA_NO_FISCAL">Cuenta no fiscal</option></select></label>}
        {needsSession && <label className="block">Sesión {medium === "EFECTIVO" ? "física" : "operativa (sin imputación física)"}<select className={select} value={session} onChange={e => setSession(e.target.value)}><option value="">Selecciona sesión abierta…</option>{ctx.sesiones.filter(s => s.ubicacionId === props.site).map(s => <option key={s.id} value={s.id}>{s.ubicacionNombre} · {s.fechaOperativa} · #{s.id}</option>)}</select></label>}
        <Evidence {...{ description, setDescription, references, setReferences }} />
        {canApply && <label className="flex gap-2"><input type="checkbox" checked={applyNow} onChange={e => setApplyNow(e.target.checked)} />ADMIN: autorizar aplicación al recibir (atómica)</label>}
        {canApply && applyNow && allocationInputs(ctx.notas.filter(n => notes.includes(n.notaId)), amounts, setAmounts)}
        <Button onClick={() => void reviewReceipt()}>Revisar recepción</Button>
      </> : <>
        <h4 className="font-bold">Confirmar recepción real</h4>
        <p>{review.preview.mensaje}</p>
        <p>Recibir {e5Money(review.preview.importeRecibido)} · aplicar {e5Money(review.preview.importeAplicar)} · retenido {e5Money(review.preview.pendienteResultante)}</p>
        <p>{review.input.formaPago} · {review.input.cuentaDestino} · {review.input.evidencia.descripcion}</p>
        {review.preview.notas.map(n => <p key={n.movimientoVentaId}>Nota {n.folio} · cargo #{n.movimientoVentaId} · saldo {e5Money(n.saldoPendiente)}</p>)}
        {review.input.aplicarAhora?.map(a => <p key={a.movimientoVentaId}>Aplicar a nota #{a.notaId}, cargo #{a.movimientoVentaId}: {e5Money(a.importe)}</p>)}
        <p>Sin otra cobranza al aplicar posteriormente. Una aplicación parcial hace no devolvible todo remanente.</p>
        <Button variant="outline" onClick={() => setReview(null)}>Volver y modificar</Button>
        <Button onClick={() => void actions.execute({ kind: "recibir", data: review.input }, async () => {
          const fresh = await context.refetch();
          if (fresh.error || !fresh.data) throw fresh.error || new Error("Contexto no disponible.");
          assertE5Context(fresh.data, props.clienteId, props.site);
          if (fresh.data.versionContexto !== review.input.versionContexto || !fresh.data.capacidades.puedeRecibir || (review.input.aplicarAhora && !fresh.data.capacidades.puedeAutorizar)) {
            setReview(null); throw new Error("Contexto o facultades cambiaron. Revisa y confirma de nuevo.");
          }
        })}>Confirmar dinero recibido</Button>
      </>}
    </fieldset>}
  </div>;
}

function CobrosList(props: Scope & { clienteId?: number; alerts?: boolean }) {
  const [state, setState] = useState<E5Estado | "">("");
  const [cursor, setCursor] = useState<string | undefined>();
  const params = { ubicacionId: props.site, clienteId: props.clienteId, estado: state || undefined, cursor, limit: 20 };
  const list = useListE5Cobros(params, { query: { ...queryOptions, queryKey: [...getListE5CobrosQueryKey(params), props.scope], enabled: !props.alerts } });
  const alertParams = { ubicacionId: props.site, cursor, limit: 20 };
  const alerts = useListE5Avisos(alertParams, { query: { ...queryOptions, queryKey: [...getListE5AvisosQueryKey(alertParams), props.scope], enabled: !!props.alerts && props.admin && props.capabilities.puedeVerAvisos } });
  const query = props.alerts ? alerts : list;
  return <section className={panel}>
    <h3 className="font-bold">{props.alerts ? "Avisos ADMIN: desde tres días de recepción" : "Recepciones · importe y antigüedad"}</h3>
    {!props.alerts && <label>Estado<select className={select} value={state} onChange={e => { setState(e.target.value as E5Estado | ""); setCursor(undefined); }}>
      <option value="">Todos</option>{["PENDIENTE", "PARCIAL", "APLICADO", "DEVUELTO"].map(s => <option key={s}>{s}</option>)}
    </select></label>}
    <Button variant="outline" onClick={() => void query.refetch()}>Actualizar lista</Button>
    {query.error ? <E5Problem error={query.error} /> : !query.data ? <p>Cargando recepciones…</p> : query.data.items.some(c => c.ubicacionId !== props.site || (props.clienteId !== undefined && c.clienteId !== props.clienteId)) ? <E5Problem error="Lista ajena al sitio/cliente solicitado. No se mostrarán esas recepciones." /> : <>
      {!query.data.items.length && <p>No hay recepciones en este alcance/filtro.</p>}
      {query.data.items.map(cobro => <article key={cobro.id} className={`space-y-1 border-b p-3 ${props.admin && cobro.avisoAdmin ? "bg-amber-50 text-amber-950" : ""}`}>
        <Link className="font-bold underline" href={`/cobros/pendientes/${cobro.id}`}>{cobro.clienteNombre} · {cobro.estado}</Link>
        <p>Recibido {e5Money(cobro.importeRecibido)} · aplicado {e5Money(cobro.importeAplicado)} · pendiente {e5Money(cobro.importePendiente)}</p>
        <p>{e5Date(cobro.fechaRecepcion)} · {cobro.antiguedadDias} días desde recepción · {cobro.ubicacionNombre}</p>
        {props.admin && cobro.avisoAdmin && <strong>Requiere atención ADMIN</strong>}
        <Documents cobro={cobro} admin={props.admin} />
      </article>)}
      <div className="flex gap-2"><Button variant="outline" disabled={!cursor} onClick={() => setCursor(undefined)}>Primera página</Button><Button disabled={!query.data.nextCursor} onClick={() => setCursor(query.data?.nextCursor)}>Siguiente</Button></div>
    </>}
  </section>;
}
export function E5PendientesPage() {
  return <AppLayout><E5Boundary>{scope => <div className="mx-auto max-w-5xl space-y-6">
    <h1 className="text-2xl font-bold">Cobros pendientes de aplicación</h1>
    <E5EntryBody {...scope} entrada="CAJA" />
    {scope.admin && scope.capabilities.puedeVerAvisos && <CobrosList {...scope} alerts />}
    <CobrosList {...scope} />
  </div>}</E5Boundary></AppLayout>;
}

export function E5DetallePage() {
  const { id } = useParams();
  return <AppLayout><E5Boundary>{scope => id ? <Detail key={`${scope.scope}:${id}`} {...scope} id={id} /> : <E5Problem error="Recepción no indicada." />}</E5Boundary></AppLayout>;
}
function Detail(props: Scope & { id: string }) {
  const detail = useGetE5Cobro(props.id, { query: { ...queryOptions, queryKey: [...getGetE5CobroQueryKey(props.id), props.scope] } });
  if (detail.error) return <><E5Problem error={detail.error} /><Button onClick={() => void detail.refetch()}>Actualizar</Button></>;
  if (!detail.data) return <p>Cargando recepción…</p>;
  if (detail.data.id !== props.id || detail.data.ubicacionId !== props.site) return <E5Problem error="Respuesta ajena al ID/sitio solicitado. No se mostrará ni operará." />;
  return <DetailBody {...props} cobro={detail.data} refresh={detail.refetch} />;
}
function DetailBody(props: Scope & { id: string; cobro: E5Cobro; refresh: () => Promise<{ data?: E5Cobro; error: unknown }> }) {
  const { cobro } = props;
  const contextParams = { clienteId: cobro.clienteId, ubicacionId: props.site };
  const context = useGetE5Contexto(contextParams, { query: { ...queryOptions, queryKey: [...getGetE5ContextoQueryKey(contextParams), props.scope] } });
  const mayRefund = props.admin && cobro.capacidades.puedeDevolver;
  const sources = useGetE5DevolucionOpciones(cobro.id, { query: { ...queryOptions, queryKey: [...getGetE5DevolucionOpcionesQueryKey(cobro.id), props.scope], enabled: mayRefund && !cobro.algunaVezAplicado } });
  const actions = useE5Actions(`${props.scope}:detalle:${cobro.id}`, { site: props.site, client: cobro.clienteId, id: props.id });
  const identity = useE5Identity();
  const [mode, setMode] = useState<"preparar" | "autorizar" | "rechazar" | "devolver">("preparar");
  const [amounts, setAmounts] = useState<Record<number, string>>({});
  const [description, setDescription] = useState("");
  const [references, setReferences] = useState("");
  const [request, setRequest] = useState("");
  const [source, setSource] = useState("");
  const [favor, setFavor] = useState("");
  const [review, setReview] = useState<E5Command | null>(null);
  const [error, setError] = useState("");
  const proposal = cobro.propuestas.find(p => p.id === cobro.propuestaVigenteId);
  const contextMatches = context.data?.clienteId === cobro.clienteId && context.data?.ubicacionId === props.site;
  const ctx = contextMatches ? context.data : undefined;
  const proposalStale = !!proposal && !!ctx && proposal.asignaciones.some(a => {
    const current = ctx.notas.find(n => n.notaId === a.notaId && n.movimientoVentaId === a.movimientoVentaId);
    const recorded = proposal.notas.find(n => n.notaId === a.notaId && n.movimientoVentaId === a.movimientoVentaId);
    return !current || !recorded || e5Cents(current.saldoPendiente) === 0 || e5Cents(current.saldoPendiente) !== e5Cents(recorded.saldoPendiente);
  });
  const capabilities = cobro.capacidades;
  const canPrepare = !!ctx && e5CanPrepare(props.user, ctx.capacidades) && e5CanPrepare(props.user, capabilities) && e5CanPrepare(props.user, props.capabilities);
  const canAuthorize = props.admin && capabilities.puedeAutorizar && !!ctx && !proposalStale;
  const canReject = props.admin && capabilities.puedeRechazar;
  const unresolved = Number(cobro.importePendiente) > 0;
  const allowed = unresolved && (mode === "preparar" ? canPrepare : mode === "autorizar" ? canAuthorize && !!proposal : mode === "rechazar" ? canReject && !!proposal : mayRefund && !cobro.algunaVezAplicado && !!sources.data?.elegible);
  const selectable = mode === "autorizar" ? ctx?.notas.filter(n => proposal?.asignaciones.some(a => a.notaId === n.notaId && a.movimientoVentaId === n.movimientoVentaId)) ?? [] : ctx?.notas ?? [];
  const makeReview = () => {
    setError("");
    try {
      if (!allowed) throw new Error("Acción no autorizada o estado no elegible.");
      const common = { revisionEsperada: cobro.revision };
      let command: E5Command;
      if (mode === "rechazar") {
        const body = { ...common, propuestaId: proposal!.id, motivo: evidence(description, references).descripcion };
        command = { kind: mode, id: cobro.id, data: { ...body, claveOperacion: identity({ kind: mode, ...body }) } };
      } else if (mode === "devolver") {
        const selected = sources.data?.fuentes.find(f => JSON.stringify(f) === source);
        if (!selected || !request.trim()) throw new Error("Selecciona fuente comprobada y registra petición expresa del cliente.");
        if (!sources.data || e5Cents(sources.data.importe) !== e5Cents(cobro.importeRecibido)) throw new Error("El importe comprobado no coincide con el total íntegro original.");
        const body = { ...common, peticionCliente: request.trim(), evidencia: evidence(description, references), fuente: selected };
        command = { kind: mode, id: cobro.id, data: { ...body, claveOperacion: identity({ kind: mode, ...body }) } };
      } else {
        if (!ctx || context.error) throw new Error("Se requiere contexto vigente de notas.");
        const favorCents = props.admin && favor.trim() ? e5Cents(favor) : 0;
        if (mode === "autorizar" && favorCents > e5Cents(proposal?.importeFavorPropuesto ?? "0")) throw new Error("No se puede autorizar más favor que el propuesto.");
        const body = { ...common, versionContexto: ctx.versionContexto, asignaciones: allocations(selectable, amounts, cobro.importePendiente, mode === "autorizar" ? proposal!.asignaciones : undefined, favorCents), evidencia: evidence(description, references) };
        if (mode === "autorizar") {
          const data = { ...body, propuestaId: proposal!.id, ...(favorCents ? { importeFavorAutorizado: e5Decimal(favorCents) } : {}) };
          command = { kind: mode, id: cobro.id, data: { ...data, claveOperacion: identity({ kind: mode, ...data }) } };
        } else {
          const data = { ...body, ...(favorCents ? { importeFavorPropuesto: e5Decimal(favorCents) } : {}) };
          command = { kind: mode, id: cobro.id, data: { ...data, claveOperacion: identity({ kind: mode, ...data }) } };
        }
      }
      setReview(command);
    } catch (err) { setError(e5Error(err)); }
  };
  const verify = async (command: E5Command) => {
    const fresh = await props.refresh();
    if (fresh.error || !fresh.data) throw fresh.error || new Error("No se pudo verificar recepción.");
    assertE5Detail(fresh.data, props.id, props.site, cobro.clienteId);
    if (!("revisionEsperada" in command.data) || fresh.data.revision !== command.data.revisionEsperada) { setReview(null); throw new Error("La recepción cambió: revisa otra vez."); }
    const cap = command.kind === "preparar" ? "puedePreparar" : command.kind === "autorizar" ? "puedeAutorizar" : command.kind === "rechazar" ? "puedeRechazar" : "puedeDevolver";
    if (!fresh.data.capacidades[cap]) throw new Error("La capacidad ya no está disponible.");
    if ("versionContexto" in command.data) {
      const current = await context.refetch();
      if (current.error || !current.data) throw current.error || new Error("No se pudo verificar notas.");
      assertE5Context(current.data, cobro.clienteId, props.site);
      if (current.data.versionContexto !== command.data.versionContexto || (command.kind === "preparar" && !current.data.capacidades.puedePreparar)) { setReview(null); throw new Error("Saldos o facultades cambiaron: no se aplicó ni se sustituyó ninguna nota."); }
    }
    if (command.kind === "devolver") {
      const current = await sources.refetch();
      if (current.error || !current.data) throw current.error || new Error("No se pudo verificar fuente.");
      if (fresh.data.algunaVezAplicado || !current.data.elegible || e5Cents(current.data.importe) !== e5Cents(fresh.data.importeRecibido) || !current.data.fuentes.some(f => JSON.stringify(f) === JSON.stringify(command.data.fuente))) { setReview(null); throw new Error("La devolución o su fuente ya no está disponible."); }
    }
  };
  return <div className="mx-auto max-w-5xl space-y-5">
    <Link className="underline" href="/cobros/pendientes">Volver a pendientes</Link>
    <section className={panel}>
      <h1 className="text-2xl font-bold">{cobro.clienteNombre} · {cobro.estado}</h1>
      <p>Recibió {cobro.receptor.nombre} · {cobro.ubicacionNombre} · {e5Date(cobro.fechaRecepcion)}</p>
      <p>{cobro.antiguedadDias} días desde recepción{props.admin && cobro.avisoAdmin ? " · Atención ADMIN: tres días o más" : ""}</p>
      <p>Recibido {e5Money(cobro.importeRecibido)} · aplicado {e5Money(cobro.importeAplicado)} · pendiente {e5Money(cobro.importePendiente)} · devuelto {e5Money(cobro.importeDevuelto)}</p>
      <p>{cobro.formaPago} · {cobro.cuentaDestino} · {cobro.evidenciaRecepcion.descripcion}</p>
      {cobro.evidenciaRecepcion.referencias.map((r, i) => <p key={i}>Referencia: {r}</p>)}
      <p>El retenido no baja deuda ni aumenta disponible/favor. Aplicar no registra otro cobro.</p>
      {cobro.algunaVezAplicado && <strong>Hubo aplicación: el remanente nunca es devolvible.</strong>}
      <Documents cobro={cobro} admin={props.admin} />
      <Button variant="outline" onClick={() => { setReview(null); void props.refresh(); void context.refetch(); if (mayRefund) void sources.refetch(); }}>Actualizar recepción y contexto</Button>
    </section>
    <ActionStatus actions={actions} admin={props.admin} />
    <section className={panel}><h2 className="font-bold">Notas indicadas al recibir</h2>{cobro.notasIndicadas.map(n => <p key={n.movimientoVentaId}>Nota {n.folio} · cargo #{n.movimientoVentaId} · saldo al recibir {e5Money(n.saldoPendiente)}</p>)}</section>
    <section className={panel}>
      <h2 className="font-bold">Preparar / resolver</h2>
      {context.error && <E5Problem error={context.error} />}
      {context.data && !contextMatches && <E5Problem error="Contexto ajeno al cliente/sitio solicitado. No se utilizará para operar." />}
      {proposalStale && <E5Problem error="Una nota de la propuesta cambió o se pagó durante la espera. Autorización detenida: prepara una nueva propuesta o rechaza la vigente; no se sustituye su destino." />}
      {error && <E5Problem error={error} />}
      <fieldset disabled={actions.blocked} className="space-y-3">
        {!review ? <>
          <label>Acción<select className={select} value={mode} onChange={e => { setMode(e.target.value as typeof mode); setAmounts({}); setSource(""); setFavor(""); }}>
            <option value="preparar" disabled={!canPrepare}>Preparar propuesta (sin efecto financiero)</option>
            <option value="autorizar" disabled={!canAuthorize || !proposal}>ADMIN: autorizar parte o total</option>
            <option value="rechazar" disabled={!canReject || !proposal}>ADMIN: rechazar propuesta</option>
            <option value="devolver" disabled={!mayRefund || cobro.algunaVezAplicado}>ADMIN: devolver total nunca aplicado</option>
          </select></label>
          {(mode === "preparar" || mode === "autorizar") && <>
            <p>Varias notas del mismo cliente. Importe vacío excluye la nota. Autorizar sólo permite subconjunto/importes de la propuesta vigente.</p>
            {mode === "autorizar" && proposal && <div>{proposal.asignaciones.map(a => <p key={a.movimientoVentaId}>Propuesto · nota {proposal.notas.find(n => n.movimientoVentaId === a.movimientoVentaId)?.folio ?? a.notaId}, cargo #{a.movimientoVentaId}: {e5Money(a.importe)}</p>)}<p>Favor explícito propuesto: {e5Money(proposal.importeFavorPropuesto ?? "0")}</p></div>}
            {!ctx ? <p>Esperando contexto autorizado…</p> : allocationInputs(selectable, amounts, setAmounts)}
            {props.admin && <label className="block">Favor explícito {mode === "autorizar" ? "a autorizar (no mayor al propuesto)" : "a proponer"} — opcional, cero al omitir
              <Input inputMode="decimal" value={favor} onChange={e => setFavor(e.target.value)} />
              <span>El servidor sólo permite favor si no queda deuda global después del reparto explícito. No se consulta ni se presume deuda fuera de tu alcance; no hay favor automático del sobrante.</span>
            </label>}
          </>}
          {mode === "rechazar" && <p>El dinero seguirá esperando otra propuesta; no se devuelve ni se transforma en FIFO.</p>}
          {mode === "devolver" && props.admin && <div className="space-y-2">
            {sources.error ? <E5Problem error={sources.error} /> : !sources.data ? <p>No hay opciones de devolución verificadas.</p> : <>
              <p>Total no editable: {e5Money(sources.data.importe)}. {sources.data.motivo}</p>
              {!sources.data.fuentes.length && <E5Problem error="No existe una fuente actual comprobada; no se puede devolver." />}
              <label>Fuente actual<select className={select} value={source} onChange={e => setSource(e.target.value)}><option value="">Selecciona…</option>{sources.data.fuentes.map((f, index) => <option key={index} value={JSON.stringify(f)}>{f.tipo} · sitio {f.ubicacionId}{f.cuentaOrigen ? ` · ${f.cuentaOrigen}` : ""}{f.sesionCajaId ? ` · sesión física ${f.sesionCajaId}` : ""}{f.sesionOperativaId ? ` · sesión operativa ${f.sesionOperativaId}` : ""}</option>)}</select></label>
              <label>Petición expresa del cliente<Textarea maxLength={2000} value={request} onChange={e => setRequest(e.target.value)} /></label>
            </>}
          </div>}
          <Evidence {...{ description, setDescription, references, setReferences }} />
          <Button disabled={!allowed} onClick={makeReview}>Revisar {mode}</Button>
        </> : <>
          <h3 className="font-bold">Confirmar {review.kind}</h3>
          {"asignaciones" in review.data && review.data.asignaciones.map(a => <p key={a.movimientoVentaId}>Nota {ctx?.notas.find(n => n.movimientoVentaId === a.movimientoVentaId)?.folio ?? a.notaId} · cargo #{a.movimientoVentaId} · {e5Money(a.importe)}</p>)}
          {review.kind === "preparar" && review.data.importeFavorPropuesto && <p>Favor explícito propuesto: {e5Money(review.data.importeFavorPropuesto)}</p>}
          {review.kind === "autorizar" && review.data.importeFavorAutorizado && <p>Favor explícito a autorizar: {e5Money(review.data.importeFavorAutorizado)}</p>}
          {"evidencia" in review.data && <p>{review.data.evidencia.descripcion}</p>}
          {review.kind === "rechazar" && <p>{review.data.motivo} · El dinero permanece retenido.</p>}
          {review.kind === "devolver" && <p>Total {e5Money(cobro.importeRecibido)} desde {review.data.fuente.tipo} · petición: {review.data.peticionCliente}</p>}
          {review.kind === "autorizar" && <p>No se recibe dinero otra vez. Tras aplicar cualquier parte, el residual nunca será devolvible.</p>}
          <Button variant="outline" onClick={() => setReview(null)}>Volver</Button>
          <Button onClick={() => void actions.execute(review, () => verify(review)).then(() => { setReview(null); setAmounts({}); setFavor(""); })}>Confirmar {review.kind}</Button>
        </>}
      </fieldset>
    </section>
    <section className={panel}><h2 className="font-bold">Historial inmutable de propuestas y resoluciones</h2>
      {cobro.propuestas.map(p => <article key={p.id} className="border-b py-2"><strong>Propuesta v{p.version}{p.id === cobro.propuestaVigenteId ? " · vigente" : ""}</strong><p>{e5Date(p.createdAt)} · {p.actor.nombre} · {p.evidencia.descripcion}</p>{p.asignaciones.map(a => <p key={a.movimientoVentaId}>Nota {p.notas.find(n => n.movimientoVentaId === a.movimientoVentaId)?.folio ?? a.notaId}, cargo #{a.movimientoVentaId}: {e5Money(a.importe)}</p>)}{p.importeFavorPropuesto && <p>Favor propuesto: {e5Money(p.importeFavorPropuesto)}</p>}</article>)}
      {cobro.aplicaciones.map(a => <article key={a.id}><strong>Aplicación {e5Money(a.importe)}</strong><p>{e5Date(a.fechaAplicacion)} · {a.actor.nombre} · {a.evidencia.descripcion}</p>{a.importeFavorGenerado && <p>Favor autorizado generado: {e5Money(a.importeFavorGenerado)}</p>}</article>)}
      {cobro.rechazos.map((r, i) => <p key={i}>Rechazo · {e5Date(r.createdAt)} · {r.actor.nombre} · {r.motivo}</p>)}
      {cobro.devolucion && <p>Devuelto {e5Money(cobro.devolucion.importe)} · {e5Date(cobro.devolucion.fecha)} · {cobro.devolucion.evidencia.descripcion}</p>}
    </section>
  </div>;
}