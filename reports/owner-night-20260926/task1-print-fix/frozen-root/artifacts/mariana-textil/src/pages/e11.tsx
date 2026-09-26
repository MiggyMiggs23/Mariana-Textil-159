import { useEffect, useState, type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import * as api from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { E11Error, E11SessionProvider, e11On, useE11Session, type E11Session } from "@/lib/e11-session";
import { E11_PROFILE_ASSIGNMENT_ENABLED, E11_RECONCILIATION_ENABLED, E11_E5_PREPARATION_ENABLED } from "@/lib/e11-feature-flags";
import { E5_ENABLED } from "@/lib/e5-feature-flags";
import { useE11Intention, useE11Write } from "@/hooks/use-e11-write";
import { e5Cents, e5Decimal } from "@/hooks/use-e5-actions";
import { todayInMexicoCity } from "@/lib/fecha-efectiva";
import { formatNumber } from "@workspace/number-format";

const panel = "space-y-3 rounded-xl border bg-card p-4";
const select = "w-full rounded-md border bg-background p-2";
const money = (n: string) => formatNumber(n, { kind: "money" });
const timestamp = (n: string) => new Date(n).toLocaleString("es-MX", { timeZone: "America/Mexico_City" });
const q = (s: E11Session, path: string, params?: unknown) => ({ queryKey: [path, params, s.key], staleTime: 0, refetchOnMount: "always" as const, retry: false as const });
const can = (s: E11Session, cap: api.E11IdentidadCapacidadesItem) => s.identity.capacidades.includes(cap);
const fiscal = (s: E11Session) => s.identity.rolBase === "CONTADOR" && s.identity.perfil === "F" && can(s, "FISCAL_LEER");
const financial = (s: E11Session) => s.identity.rolBase === "CONTADOR" && s.identity.perfil === "A" && can(s, "FINANZAS_LIMITADAS_LEER");
const preparation = (s: E11Session) => financial(s) && can(s, "E5_PREPARAR") && E5_ENABLED && E11_E5_PREPARATION_ENABLED && s.flags.preparacionE5;
const reconciling = (s: E11Session) => fiscal(s) && can(s, "FISCAL_CONCILIAR") && E11_RECONCILIATION_ENABLED && s.flags.conciliacion;
const admin = (s: E11Session) => s.identity.rolBase === "ADMIN" && s.identity.perfil === null;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const day = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) === value;
function initialRange() {
  const today = todayInMexicoCity();
  const [year, month] = today.split("-").map(Number);
  return { desde: new Date(Date.UTC(year, month - 2, 1)).toISOString().slice(0, 10), hastaExclusivo: today };
}
function Pager({ cursor, next, setCursor }: { cursor?: string; next?: string | null; setCursor: (s: string | undefined) => void }) {
  return <div className="flex gap-2"><Button variant="outline" disabled={!cursor} onClick={() => setCursor(undefined)}>Primera página / reiniciar cursor</Button><Button disabled={!next} onClick={() => setCursor(next ?? undefined)}>Siguiente</Button></div>;
}
function ReadResult({ query, children, restart }: { query: { isLoading: boolean; error: unknown; data: unknown; refetch: () => unknown }; children: ReactNode; restart?: () => void }) {
  return <>{query.error ? <><E11Error error={query.error} /><Button variant="outline" onClick={() => void query.refetch()}>Actualizar fuente</Button>{restart && <Button variant="outline" onClick={restart}>Descartar cursor y volver al inicio</Button>}</> : query.isLoading || !query.data ? <p>Cargando fuente autorizada…</p> : children}</>;
}
function WriteStatus({ action }: { action: { busy: boolean; pending: unknown; error: string; retry: () => unknown } }) {
  return <>{action.error && <E11Error error={action.error} />}{action.busy && <p role="status">Comprobando identidad y registrando…</p>}{action.pending && <Button disabled={action.busy} onClick={() => void action.retry()}>Reintentar exactamente la intención incierta</Button>}</>;
}
function Range({ value, onChange }: { value: ReturnType<typeof initialRange>; onChange: (v: ReturnType<typeof initialRange>) => void }) {
  const [draft, setDraft] = useState(value), [error, setError] = useState("");
  return <fieldset className="flex flex-wrap items-end gap-3">
    <label>Desde (día CDMX)<Input type="date" value={draft.desde} onChange={e => setDraft({ ...draft, desde: e.target.value })} /></label>
    <label>Hasta, exclusivo (día CDMX)<Input type="date" value={draft.hastaExclusivo} onChange={e => setDraft({ ...draft, hastaExclusivo: e.target.value })} /></label>
    <Button onClick={() => {
      try { if (!day(draft.desde) || !day(draft.hastaExclusivo) || draft.desde >= draft.hastaExclusivo) throw new Error("Intervalo de días inválido."); setError(""); onChange(draft); }
      catch { setError("Selecciona días calendario válidos, con fin exclusivo posterior al inicio."); }
    }}>Consultar intervalo</Button>
    {error && <E11Error error={error} />}
  </fieldset>;
}

/** Router-level ceiling: counters never mount legacy pages/layout business hooks. */
export function E11ApplicationBoundary({ children }: { children: ReactNode }) {
  return e11On() ? <ActorApplication>{children}</ActorApplication> : <>{children}</>;
}
function ActorApplication({ children }: { children: ReactNode }) {
  const [path, navigate] = useLocation();
  const user = api.useGetCurrentUser();
  const unauthenticated = user.error?.status === 401;
  useEffect(() => {
    if (path === "/login" || !unauthenticated) return;
    const returnTo = path.startsWith("/") && !path.startsWith("//") && !path.includes("\\") ? path : "/";
    navigate(`/login?returnTo=${encodeURIComponent(returnTo)}`, { replace: true });
  }, [path, navigate, unauthenticated]);
  if (path === "/login") return <>{children}</>;
  if (unauthenticated) return <p role="status">Abriendo inicio de sesión…</p>;
  if (user.error) return <><E11Error error={user.error} /><Button variant="outline" onClick={() => void user.refetch()}>Reintentar sesión</Button><Link href="/login">Iniciar sesión</Link></>;
  if (!user.data) return <p>Comprobando sesión…</p>;
  if (!["ADMIN", "CONTADOR"].includes(user.data.rol)) return <>{children}</>;
  return <E11SessionProvider key={`${user.data.id}:${user.data.rol}`} user={user.data}>
    {user.data.rol === "CONTADOR" ? <CounterRoutes /> : children}
  </E11SessionProvider>;
}
function Redirect({ to }: { to: string }) {
  const [, navigate] = useLocation();
  useEffect(() => { navigate(to, { replace: true }); }, [to, navigate]);
  return <p>Abriendo proyección contable autorizada…</p>;
}
function CounterRoutes() {
  const s = useE11Session()!;
  const [path] = useLocation();
  const match = /^\/clientes\/(\d+)$/.exec(path);
  if (path === "/" || path === "/clientes" || match) return <Redirect to={s.identity.perfil === "A" ? match ? `/contabilidad/finanzas/clientes/${match[1]}` : "/contabilidad/finanzas" : "/contabilidad/fiscal"} />;
  const retained = /^\/cobros\/pendientes(?:\/([0-9a-f-]+))?$/i.exec(path);
  if (path === "/pagos-dirigidos" && preparation(s)) return <Redirect to="/contabilidad/preparaciones" />;
  if (retained) return preparation(s) ? <Redirect to={`/contabilidad/preparaciones${retained[1] ? `/${retained[1]}` : ""}`} /> : <E11Shell><E11Error error="Este perfil no puede acceder a cobros E5. No se montará su lector legacy." /></E11Shell>;
  return <E11RoutePage />;
}
function E11Shell({ children }: { children: ReactNode }) {
  const s = useE11Session()!;
  const [, navigate] = useLocation();
  const client = useQueryClient();
  const logout = api.useLogout();
  return <main className="mx-auto max-w-6xl space-y-6 p-4 md:p-8">
    <header className="flex flex-wrap items-center justify-between gap-3 border-b pb-4">
      <div><h1 className="text-2xl font-bold">Contabilidad · {s.identity.perfil ?? s.identity.rolBase}</h1><p>Perfil v{s.identity.perfilVersion} · proyección autorizada, sin documentos operativos privados.</p></div>
      <Button variant="outline" disabled={logout.isPending} onClick={() => logout.mutate(undefined, { onSuccess: () => { client.clear(); navigate("/login"); } })}>Cerrar sesión</Button>
    </header>
    <E11Navigation operational />
    {children}
    <E11AdminNavGroup />
  </main>;
}
/**
 * `operational` omits the administrative links (Conciliaciones documentales,
 * Administrar perfiles A/F); those render in the sidebar via E11AdminNavLinks
 * with exactly the same session/profile/flag predicates.
 */
export function E11Navigation({ operational = false }: { operational?: boolean }) {
  const s = useE11Session();
  if (!e11On() || !s) return null;
  const links = [
    fiscal(s) && <Link key="f" className="underline" href="/contabilidad/fiscal">Ventas y clientes facturados</Link>,
    financial(s) && <Link key="a" className="underline" href="/contabilidad/finanzas">Finanzas saneadas</Link>,
    !operational && (fiscal(s) || admin(s)) && s.flags.conciliacion && E11_RECONCILIATION_ENABLED && <Link key="c" className="underline" href="/contabilidad/conciliaciones">Conciliaciones documentales</Link>,
    preparation(s) && <Link key="p" className="underline" href="/contabilidad/preparaciones">Preparaciones E5 (sin aplicar)</Link>,
    !operational && admin(s) && <Link key="u" className="underline" href="/usuarios">Administrar perfiles A/F</Link>,
  ].filter(Boolean);
  if (!links.length) return null;
  return <nav aria-label="Contabilidad" className="flex flex-wrap gap-4 py-2">{links}</nav>;
}
/** Administration/settings group of the accounting shell; outside the header, same predicates. */
function E11AdminNavGroup() {
  const links = useE11AdminNavLinks();
  if (!links.length) return null;
  return <nav aria-label="Administración contable" data-testid="e11-admin-nav" className="mt-8 rounded-lg border border-dashed p-4">
    <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Administración y ajustes</h2>
    <ul className="flex flex-wrap gap-4">{links.map(l => <li key={l.path}><Link className="underline" href={l.path}>{l.name}</Link></li>)}</ul>
  </nav>;
}
export type E11AdminNavLink = { name: string; path: string };
/** Administrative E11 destinations for the sidebar; same predicates as the former header links. */
export function useE11AdminNavLinks(): E11AdminNavLink[] {
  const s = useE11Session();
  if (!e11On() || !s) return [];
  return [
    ...((fiscal(s) || admin(s)) && s.flags.conciliacion && E11_RECONCILIATION_ENABLED ? [{ name: "Conciliaciones documentales", path: "/contabilidad/conciliaciones" }] : []),
    ...(admin(s) ? [{ name: "Administrar perfiles A/F", path: "/usuarios" }] : []),
  ];
}
export function E11RoutePage() {
  const s = useE11Session();
  const [path] = useLocation();
  if (!e11On() || !s) return <E11Error error="Contabilidad E11 cerrada o sin identidad autorizada." />;
  let content: ReactNode = <E11Error error="Ruta no autorizada para este perfil. Usa las proyecciones contables, sin acceso legacy." />;
  const invoice = /^\/contabilidad\/fiscal\/facturas\/(\d+)$/.exec(path);
  const account = /^\/contabilidad\/finanzas\/clientes\/(\d+)$/.exec(path);
  const snapshot = /^\/contabilidad\/conciliaciones\/([0-9a-f-]+)$/i.exec(path);
  const prepare = /^\/contabilidad\/preparaciones\/([0-9a-f-]+)$/i.exec(path);
  if (path === "/contabilidad/fiscal" && fiscal(s)) content = <FiscalHome s={s} />;
  else if (invoice && fiscal(s) && Number.isSafeInteger(Number(invoice[1])) && Number(invoice[1]) > 0) content = <FiscalDocument key={invoice[1]} s={s} id={Number(invoice[1])} />;
  else if (path === "/contabilidad/finanzas" && financial(s)) content = <FinanceClients s={s} />;
  else if (account && financial(s) && Number.isSafeInteger(Number(account[1])) && Number(account[1]) > 0) content = <FinanceAccount key={account[1]} s={s} id={Number(account[1])} />;
  else if ((fiscal(s) || admin(s)) && E11_RECONCILIATION_ENABLED && s.flags.conciliacion) {
    if (path === "/contabilidad/conciliaciones") content = <Periods s={s} />;
    else if (snapshot && uuidPattern.test(snapshot[1])) content = <Snapshot key={snapshot[1]} s={s} id={snapshot[1]} />;
  }
  if (preparation(s)) {
    if (path === "/contabilidad/preparaciones") content = <Preparations s={s} />;
    else if (prepare && uuidPattern.test(prepare[1])) content = <Preparation key={prepare[1]} s={s} id={prepare[1]} />;
  }
  return <E11Shell>{content}</E11Shell>;
}

function FiscalRows({ rows }: { rows: api.E11FiscalVenta[] }) {
  return <div className="space-y-3">{!rows.length && <p>Sin documentos facturados en esta consulta.</p>}{rows.map(v => <article className="border-b pb-2" key={v.facturaId}>
    <Link className="font-semibold underline" href={`/contabilidad/fiscal/facturas/${v.facturaId}`}>Documento interno {v.folioFactura}</Link>
    <p>{v.cliente.nombre} · {timestamp(v.fechaFacturacion)} · {v.estado} · {money(v.totalFacturado)} {v.moneda}</p>
  </article>)}</div>;
}
function FiscalHome({ s }: { s: E11Session }) {
  const [range, setRange] = useState(initialRange);
  const [cursor, setCursor] = useState<string>();
  const [client, setClient] = useState<number | undefined>();
  const clients = api.useListE11FiscalClientes({ cursor, limit: 20 }, { query: q(s, "/api/e11/fiscal/clientes", { cursor, limit: 20 }) });
  return <div className="space-y-5">
    <h2 className="text-xl font-bold">Ventas facturadas y clientes facturados</h2>
    <p>“Factura” identifica el ticket interno marcado facturado. No es un CFDI ni certifica timbrado externo.</p>
    <section className={panel}><h3 className="font-semibold">Clientes con documentos facturados</h3>
      <ReadResult query={clients} restart={() => setCursor(undefined)}>{clients.data && <><Button variant="outline" onClick={() => setClient(undefined)}>Todos los clientes facturados</Button>{clients.data.items.map(c => <Button variant="outline" key={c.clienteId} onClick={() => setClient(c.clienteId)}>{c.nombre}</Button>)}{!clients.data.items.length && <p>Sin clientes facturados en esta página.</p>}<Pager cursor={cursor} next={clients.data.nextCursor} setCursor={setCursor} /></>}</ReadResult>
    </section>
    <Range value={range} onChange={setRange} />
    <FiscalSales key={JSON.stringify([range, client])} s={s} range={range} client={client} />
  </div>;
}
function FiscalSales({ s, range, client }: { s: E11Session; range: ReturnType<typeof initialRange>; client?: number }) {
  const [cursor, setCursor] = useState<string>();
  const params = { ...range, clienteId: client, cursor, limit: 20 };
  const rows = api.useListE11FiscalVentas(params, { query: q(s, "/api/e11/fiscal/ventas", params) });
  return <section className={panel}><h3 className="font-bold">Documentos facturados del intervalo</h3><ReadResult query={rows} restart={() => setCursor(undefined)}>{rows.data && (client && rows.data.items.some(v => v.cliente.clienteId !== client) ? <E11Error error="Respuesta fiscal ajena al cliente solicitado." /> : <>
    <p>Total facturado del intervalo: {money(rows.data.totalFacturado)}</p><FiscalRows rows={rows.data.items} /><Pager cursor={cursor} next={rows.data.nextCursor} setCursor={setCursor} />
  </>)}</ReadResult></section>;
}
function FiscalDocument({ s, id }: { s: E11Session; id: number }) {
  const document = api.useGetE11FiscalFactura(id, { query: q(s, `/api/e11/fiscal/facturas/${id}`) });
  return <section className={panel}><h2 className="text-xl font-bold">Documento interno facturado, no CFDI</h2><ReadResult query={document}>{document.data && (document.data.facturaId !== id || document.data.ventaId !== id ? <E11Error error="Documento ajeno al solicitado." /> : <FiscalRows rows={[document.data]} />)}</ReadResult><Link className="underline" href="/contabilidad/fiscal">Volver a lectura fiscal</Link></section>;
}
function FinanceClients({ s }: { s: E11Session }) {
  const [cursor, setCursor] = useState<string>();
  const params = { cursor, limit: 20 };
  const clients = api.useListE11FinanzasClientes(params, { query: q(s, "/api/e11/finanzas/clientes", params) });
  return <section className={panel}><h2 className="text-xl font-bold">Clientes · finanzas saneadas A</h2><ReadResult query={clients} restart={() => setCursor(undefined)}>{clients.data && <>
    {!clients.data.items.length && <p>Sin clientes en esta página autorizada.</p>}{clients.data.items.map(c => <article key={c.clienteId} className="border-b py-2"><Link className="font-semibold underline" href={`/contabilidad/finanzas/clientes/${c.clienteId}`}>{c.nombre}</Link><p>{c.contacto} · límite {money(c.limiteCredito)} · saldo {money(c.saldo)}</p></article>)}
    <Pager cursor={cursor} next={clients.data.nextCursor} setCursor={setCursor} />
  </>}</ReadResult></section>;
}
function FinanceAccount({ s, id }: { s: E11Session; id: number }) {
  const [noteCursor, setNoteCursor] = useState<string>();
  const [movementCursor, setMovementCursor] = useState<string>();
  const notes = api.useListE11FinanzasNotas(id, { cursor: noteCursor, limit: 20 }, { query: q(s, `/api/e11/finanzas/clientes/${id}/notas`, noteCursor) });
  const account = api.useGetE11FinanzasEstadoCuenta(id, { cursor: movementCursor, limit: 20 }, { query: q(s, `/api/e11/finanzas/clientes/${id}/estado-cuenta`, movementCursor) });
  return <div className="space-y-5"><h2 className="text-xl font-bold">Estado de cuenta autorizado</h2>
    <section className={panel}><ReadResult query={account} restart={() => setMovementCursor(undefined)}>{account.data && (account.data.cliente.clienteId !== id ? <E11Error error="Estado de cuenta ajeno al cliente solicitado." /> : <>
      <h3 className="font-bold">{account.data.cliente.nombre}</h3><p>{account.data.cliente.contacto} · límite {money(account.data.cliente.limiteCredito)} · saldo canónico {money(account.data.cliente.saldo)}</p>
      {!account.data.items.length && <p>Sin movimientos contables en esta página.</p>}
      {account.data.items.map(m => <p key={m.id}>{m.fechaEfectiva} · {m.tipo} · {money(m.importe)}{m.notaId ? ` · nota #${m.notaId}` : ""}</p>)}
      <p>ABONO/REVERSO son proyección contable; no conceden acceso a recibos ni medios/cuentas de pago.</p>
      <Pager cursor={movementCursor} next={account.data.nextCursor} setCursor={setMovementCursor} />
    </>)}</ReadResult></section>
    <section className={panel}><h3 className="font-bold">Notas facturadas y no facturadas</h3><ReadResult query={notes} restart={() => setNoteCursor(undefined)}>{notes.data && (notes.data.items.some(n => n.clienteId !== id) ? <E11Error error="Notas ajenas al cliente solicitado." /> : <>
      {!notes.data.items.length && <p>Sin notas en esta página.</p>}{notes.data.items.map(n => <p key={n.movimientoVentaId}>Nota {n.folio} · cargo #{n.movimientoVentaId} · {timestamp(n.fecha)} · {n.facturada ? "Facturada" : "No facturada"} · total {money(n.total)} · saldo {money(n.saldo)}</p>)}
      <Pager cursor={noteCursor} next={notes.data.nextCursor} setCursor={setNoteCursor} />
    </>)}</ReadResult></section>
    {preparation(s) && <Link className="underline" href={`/contabilidad/preparaciones?clienteId=${id}`}>Preparar aplicación de dinero retenido existente</Link>}
  </div>;
}

export function E11ProfileControl({ usuarioId, active }: { usuarioId: number; active: boolean }) {
  const s = useE11Session();
  const [open, setOpen] = useState(false);
  if (!e11On() || !s || !admin(s) || !can(s, "PERFILES_ADMINISTRAR") || !E11_PROFILE_ASSIGNMENT_ENABLED || !s.flags.perfiles) return null;
  return <><Button variant="outline" size="sm" disabled={!active} onClick={() => setOpen(true)}>Perfil contable A/F</Button>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-h-[85vh] overflow-y-auto"><DialogHeader><DialogTitle>Asignación manual ADMIN · usuario #{usuarioId}</DialogTitle></DialogHeader>
      {open && <ProfileEditor key={`${s.key}:${usuarioId}`} s={s} id={usuarioId} />}
    </DialogContent></Dialog></>;
}
function ProfileEditor({ s, id }: { s: E11Session; id: number }) {
  const profile = api.useGetE11Perfil(id, { query: q(s, `/api/e11/usuarios/${id}/perfil`) });
  const [cursor, setCursor] = useState<string>();
  const history = api.useListE11PerfilHistorial(id, { cursor, limit: 10 }, { query: q(s, `/api/e11/usuarios/${id}/perfil/historial`, cursor) });
  const mutation = api.useAssignE11Perfil({ mutation: { retry: false, networkMode: "always" } });
  const intention = useE11Intention();
  const [choice, setChoice] = useState<"A" | "F">("F");
  const [reason, setReason] = useState("");
  const [review, setReview] = useState<api.E11PerfilInput | null>(null);
  const action = useE11Write<api.E11PerfilInput, api.E11PerfilEvento>(`perfil:${id}`, "PERFILES_ADMINISTRAR",
    data => mutation.mutateAsync({ usuarioId: id, data }),
    async (command, retry) => {
      const identity = await s.check();
      if (identity.rolBase !== "ADMIN" || !s.flags.perfiles || !E11_PROFILE_ASSIGNMENT_ENABLED) throw new Error("Asignación exclusiva de ADMIN vigente.");
      const fresh = await profile.refetch();
      if (fresh.error || !fresh.data || fresh.data.usuarioId !== id || fresh.data.rolBase !== "CONTADOR") throw new Error("Destinatario no es CONTADOR vigente o respuesta ajena.");
      if (!retry && fresh.data.perfilVersion !== command.revisionEsperada) throw new Error("Revisión del perfil cambió. Actualiza antes de confirmar.");
    },
    (r, command) => r.usuarioId === id && r.actorId === s.identity.usuarioId && r.uuid === command.uuid && r.posterior === command.perfil && r.revision === command.revisionEsperada + 1);
  useEffect(() => { setReview(null); intention.reset(); }, [action.rejected]);
  return <div className="space-y-4">
    <ReadResult query={profile}>{profile.data && (profile.data.usuarioId !== id || profile.data.rolBase !== "CONTADOR" ? <E11Error error="Perfil ajeno o usuario no CONTADOR." /> : <>
      <p>Perfil efectivo {profile.data.perfil} · versión {profile.data.perfilVersion}. F es el defecto; A sólo se asigna manualmente. No se cambia el rol base.</p>
      <fieldset disabled={action.blocked} className="space-y-3">
        {!review ? <><label>Perfil<select className={select} value={choice} onChange={e => setChoice(e.target.value as "A" | "F")}><option value="F">F · sólo facturado</option><option value="A">A · lectura financiera limitada; preparación E5 cerrada</option></select></label>
          <label>Motivo obligatorio<Textarea maxLength={1000} value={reason} onChange={e => setReason(e.target.value)} /></label>
          <Button disabled={!reason.trim()} onClick={() => { const body = { revisionEsperada: profile.data!.perfilVersion, perfil: choice, motivo: reason.trim() }; setReview({ ...body, uuid: intention.uuid(body) }); }}>Revisar cambio de perfil</Button>
        </> : <><p>Confirmar {profile.data.perfil} → {review.perfil} para usuario #{id}. Motivo: {review.motivo}. A→F revoca datos, capacidades e intenciones A.</p>
          <Button variant="outline" onClick={() => setReview(null)}>Volver</Button><Button onClick={() => void action.run(review)}>Confirmar asignación ADMIN</Button></>}
      </fieldset>
    </>)}</ReadResult>
    <WriteStatus action={action} />{action.result && <p role="status">Perfil {action.result.posterior} confirmado · revisión {action.result.revision} · {timestamp(action.result.creadoEn)}</p>}
    <h3 className="font-bold">Historial de perfiles (append-only)</h3>
    <ReadResult query={history} restart={() => setCursor(undefined)}>{history.data && (history.data.items.some(e => e.usuarioId !== id) ? <E11Error error="Historial ajeno al destinatario." /> : <>{!history.data.items.length && <p>Sin eventos materializados; no se inventa un ADMIN para el defecto F.</p>}{history.data.items.map(e => <p key={e.id}>{timestamp(e.creadoEn)} · {e.anterior ?? "Sin perfil"} → {e.posterior ?? "Revocado"} · actor #{e.actorId} · v{e.revision} · {e.motivo}</p>)}<Pager cursor={cursor} next={history.data.nextCursor} setCursor={setCursor} /></>)}</ReadResult>
  </div>;
}

function samePeriod(a: api.E11Periodo, b: api.E11Periodo) {
  return a.tipo === b.tipo && a.inicio === b.inicio && a.finExclusivo === b.finExclusivo && a.zona === b.zona;
}
function closedPeriod(p: api.E11Periodo) {
  if (p.obligatorio !== (p.tipo !== "DIA")) return false;
  if (!day(p.inicio) || !day(p.finExclusivo) || p.zona !== "America/Mexico_City" || p.estado === "ABIERTO" || p.finExclusivo > todayInMexicoCity()) return false;
  // Civil calendar arithmetic only, not fixed UTC instant intervals.
  const date = new Date(`${p.inicio}T12:00:00Z`);
  if (p.tipo === "SEMANA" && date.getUTCDay() !== 1) return false;
  if (p.tipo === "MES" && date.getUTCDate() !== 1) return false;
  if (p.tipo === "MES") date.setUTCMonth(date.getUTCMonth() + 1);
  else date.setUTCDate(date.getUTCDate() + (p.tipo === "SEMANA" ? 7 : 1));
  return date.toISOString().slice(0, 10) === p.finExclusivo;
}
function Periods({ s, noticesOnly = false }: { s: E11Session; noticesOnly?: boolean }) {
  const [range, setRange] = useState(initialRange);
  return <section className={panel}>
    <h2 className="text-xl font-bold">{noticesOnly ? "ADMIN · discrepancias documentales NO CUADRA" : "Conciliaciones de ventas facturadas"}</h2>
    <p>Día opcional; semana calendario (lunes a lunes) y mes obligatorios, independientemente de días aceptados. Sin vencimientos ni efectos monetarios.</p>
    {noticesOnly && <p>Avisos en el intervalo consultado. El enlace abre evidencia para revisión ADMIN; no crea un movimiento ni una investigación monetaria.</p>}
    <Range value={range} onChange={setRange} />
    <PeriodList key={JSON.stringify(range)} s={s} range={range} noticesOnly={noticesOnly} />
  </section>;
}
function PeriodList({ s, range, noticesOnly }: { s: E11Session; range: ReturnType<typeof initialRange>; noticesOnly: boolean }) {
  const [cursor, setCursor] = useState<string>();
  const [selected, setSelected] = useState<api.E11Periodo | null>(null);
  const params = { ...range, cursor, limit: 20 };
  const periods = api.useListE11Conciliaciones(params, { query: q(s, "/api/e11/conciliaciones", params) });
  return <ReadResult query={periods} restart={() => { setSelected(null); setCursor(undefined); }}>{periods.data && <>
    {!periods.data.items.filter(p => !noticesOnly || p.estado === "NO_CUADRA").length && <p>Sin {noticesOnly ? "discrepancias" : "periodos"} en esta página del intervalo. No se presume aceptación.</p>}
    {periods.data.items.filter(p => !noticesOnly || p.estado === "NO_CUADRA").map(p => <article className="space-y-2 border-b py-3" key={`${p.tipo}:${p.inicio}`}>
      <h3 className="font-semibold">{p.tipo} · {p.inicio} a {p.finExclusivo} (exclusivo)</h3>
      <p>{p.obligatorio ? "Aceptación obligatoria" : "Aceptación opcional"} · {p.estado} · {p.zona}</p>
      {p.ultimaConciliacionId && <Link className="mr-4 underline" href={`/contabilidad/conciliaciones/${p.ultimaConciliacionId}`}>Ver snapshot y decisión</Link>}
      {reconciling(s) && <Button variant="outline" disabled={!closedPeriod(p) || p.estado === "ACEPTADA"} onClick={() => setSelected(p)}>{p.ultimaConciliacionId ? "Revisar nueva versión vinculada" : "Revisar y congelar periodo"}</Button>}
      {!closedPeriod(p) && <p>No se congela un periodo abierto o de calendario inconsistente.</p>}
    </article>)}
    <Pager cursor={cursor} next={periods.data.nextCursor} setCursor={value => { setSelected(null); setCursor(value); }} />
    {selected && reconciling(s) && <SnapshotPreparation key={`${selected.tipo}:${selected.inicio}:${selected.ultimaConciliacionId}`} s={s} period={selected} verifyPeriod={async () => {
      const fresh = await periods.refetch();
      if (fresh.error || !fresh.data) throw fresh.error || new Error("No se pudieron verificar periodos.");
      const current = fresh.data.items.find(p => samePeriod(p, selected));
      if (!current || !closedPeriod(current) || current.ultimaConciliacionId !== selected.ultimaConciliacionId) throw new Error("El periodo o su revisión cambió. Vuelve a seleccionarlo.");
    }} />}
  </>}</ReadResult>;
}
function SnapshotPreparation({ s, period, verifyPeriod }: { s: E11Session; period: api.E11Periodo; verifyPeriod: () => Promise<void> }) {
  const params = { desde: period.inicio, hastaExclusivo: period.finExclusivo, limit: 20 };
  const source = api.useListE11FiscalVentas(params, { query: q(s, "/api/e11/fiscal/ventas", params) });
  const mutation = api.useCreateE11Conciliacion({ mutation: { retry: false, networkMode: "always" } });
  const intention = useE11Intention();
  const [review, setReview] = useState<{ body: api.E11SnapshotInput; total: string } | null>(null);
  const action = useE11Write<api.E11SnapshotInput & { totalRevisado: string }, api.E11Conciliacion>(`snapshot:${period.tipo}:${period.inicio}`, "FISCAL_CONCILIAR",
    ({ totalRevisado: _localOnly, ...data }) => mutation.mutateAsync({ data }),
    async (command, retry) => {
      if (!reconciling(s) || command.perfilVersion !== s.identity.perfilVersion || command.tipo !== period.tipo || command.inicio !== period.inicio || command.revisionAnteriorId !== period.ultimaConciliacionId) throw new Error("Intención ajena al perfil/periodo/revisión.");
      if (!closedPeriod(period)) throw new Error("No se congela un periodo abierto.");
      if (!retry) {
        await verifyPeriod();
        const fresh = await source.refetch();
        if (fresh.error || !fresh.data || fresh.data.fuenteRevision !== command.fuenteRevision || fresh.data.totalFacturado !== command.totalRevisado) throw new Error("FUENTE_CAMBIADA: actualiza y revisa el total antes de congelar.");
      }
    },
    (r, command) => uuidPattern.test(r.id) && r.uuid === command.uuid && r.actorId === s.identity.usuarioId && samePeriod(r.periodo, period)
      && r.anteriorId === command.revisionAnteriorId && r.fuenteRevision === command.fuenteRevision && r.totalFacturado === command.totalRevisado);
  useEffect(() => { setReview(null); intention.reset(); }, [action.rejected]);
  return <section className={panel}><h3 className="font-bold">Congelar evidencia de {period.tipo} {period.inicio}</h3>
    <ReadResult query={source}>{source.data && <>
      <p>Total canónico de todo el periodo: {money(source.data.totalFacturado)}. Se congela todo el conjunto, no sólo esta página. Cero sólo si la fuente devuelve cero.</p>
      <fieldset disabled={action.blocked} className="space-y-3">{!review ? <Button onClick={() => {
        const body = { perfilVersion: s.identity.perfilVersion, tipo: period.tipo, inicio: period.inicio, fuenteRevision: source.data!.fuenteRevision, revisionAnteriorId: period.ultimaConciliacionId };
        setReview({ body: { ...body, uuid: intention.uuid(body) }, total: source.data!.totalFacturado });
      }}>Revisar snapshot</Button> : <>
        <p>Confirmar total {money(review.total)} · intervalo [{period.inicio}, {period.finExclusivo}) CDMX. {period.ultimaConciliacionId ? "Nueva revisión conserva y enlaza la evidencia anterior." : "No implica aceptar ni registrar dinero."}</p>
        <Button variant="outline" onClick={() => setReview(null)}>Volver</Button><Button onClick={() => void action.run({ ...review.body, totalRevisado: review.total })}>Confirmar snapshot inmutable</Button>
      </>}</fieldset>
    </>}</ReadResult>
    <WriteStatus action={action} />
    {action.result && <p role="status">Snapshot confirmado: <Link className="underline" href={`/contabilidad/conciliaciones/${action.result.id}`}>Abrir cifra congelada y conciliar</Link></p>}
  </section>;
}
function Snapshot({ s, id }: { s: E11Session; id: string }) {
  const snapshot = api.useGetE11Conciliacion(id, { query: q(s, `/api/e11/conciliaciones/${id}`) });
  return <ReadResult query={snapshot}>{snapshot.data && (snapshot.data.id !== id ? <E11Error error="Snapshot ajeno al solicitado." /> : <SnapshotBody s={s} snapshot={snapshot.data} />)}</ReadResult>;
}
function SnapshotBody({ s, snapshot }: { s: E11Session; snapshot: api.E11Conciliacion }) {
  const [cursor, setCursor] = useState<string>();
  const sales = api.useListE11ConciliacionVentas(snapshot.id, { cursor, limit: 20 }, { query: q(s, `/api/e11/conciliaciones/${snapshot.id}/ventas`, cursor) });
  return <div className="space-y-5">
    <section className={panel}><h2 className="text-xl font-bold">Snapshot documental · revisión {snapshot.revision}</h2>
      <p>{snapshot.periodo.tipo} · [{snapshot.periodo.inicio}, {snapshot.periodo.finExclusivo}) · {snapshot.periodo.zona}</p>
      <p>Cifra congelada: <strong>{money(snapshot.totalFacturado)}</strong> · {snapshot.cantidadVentas} documentos · {timestamp(snapshot.congeladoEn)} · actor #{snapshot.actorId}</p>
      <p className="break-all">Hash de evidencia: {snapshot.evidenciaHash}</p><p>{snapshot.vigente ? "Revisión vigente" : "Revisión histórica; no sustituye a la vigente"} · {snapshot.periodo.estado}</p>
      {snapshot.anteriorId && <Link className="underline" href={`/contabilidad/conciliaciones/${snapshot.anteriorId}`}>Revisión anterior inmutable</Link>}
      {snapshot.decisiones.map(d => <article key={d.id} className="border-t pt-2"><strong>{d.resultado}</strong><p>{timestamp(d.creadoEn)} · actor #{d.actorId} · externo {money(d.totalExterno)} · referencia {d.referenciaExterna}</p><p>{d.observacion}</p>{d.resultado === "NO_CUADRA" && <p>Discrepancia documental; no satisface aceptación obligatoria. Aviso ADMIN {d.avisoAdminId ? "registrado" : "sin identificador en esta evidencia"}.</p>}</article>)}
      <Link className="block underline" href="/contabilidad/conciliaciones">Periodos / revisar nueva versión si cambió la fuente</Link>
    </section>
    <section className={panel}><h3 className="font-bold">Ventas congeladas (no se recalculan)</h3><ReadResult query={sales} restart={() => setCursor(undefined)}>{sales.data && (sales.data.fuenteRevision !== snapshot.fuenteRevision || sales.data.totalFacturado !== snapshot.totalFacturado ? <E11Error error="Renglones/total no corresponden al snapshot. No se usarán datos vivos como sustituto." /> : <>
      {!sales.data.items.length && <p>Sin renglones en esta página del snapshot.</p>}{sales.data.items.map(v => <p key={v.facturaId}>Documento interno {v.folioFactura} · {v.cliente.nombre} · {timestamp(v.fechaFacturacion)} · {v.estado} · {money(v.totalFacturado)} {v.moneda}</p>)}
      <Pager cursor={cursor} next={sales.data.nextCursor} setCursor={setCursor} />
    </>)}</ReadResult></section>
    {reconciling(s) && snapshot.vigente && !snapshot.decisiones.length && <Decision s={s} snapshot={snapshot} />}
    {admin(s) && <p>ADMIN consulta la discrepancia y su evidencia; no firma aceptación en nombre de F.</p>}
  </div>;
}
function Decision({ s, snapshot }: { s: E11Session; snapshot: api.E11Conciliacion }) {
  const mutation = api.useDecideE11Conciliacion({ mutation: { retry: false, networkMode: "always" } });
  const intention = useE11Intention();
  const [outcome, setOutcome] = useState<"ACEPTADA" | "NO_CUADRA">("ACEPTADA");
  const [total, setTotal] = useState(""), [reference, setReference] = useState(""), [observation, setObservation] = useState("");
  const [review, setReview] = useState<api.E11DecisionInput | null>(null), [problem, setProblem] = useState("");
  const action = useE11Write<api.E11DecisionInput, api.E11Conciliacion>(`decision:${snapshot.id}`, "FISCAL_CONCILIAR",
    data => mutation.mutateAsync({ id: snapshot.id, data }),
    async (command, retry) => {
      if (!reconciling(s) || command.perfilVersion !== s.identity.perfilVersion) throw new Error("Conciliación no autorizada para el perfil vigente.");
      const fresh = await api.getE11Conciliacion(snapshot.id);
      if (fresh.id !== snapshot.id || !samePeriod(fresh.periodo, snapshot.periodo) || fresh.totalFacturado !== snapshot.totalFacturado) throw new Error("Snapshot ajeno o cifra congelada alterada.");
      if (!retry) {
        if (!fresh.vigente || fresh.decisiones.length || fresh.revision !== command.revisionEsperada || fresh.fuenteRevision !== command.fuenteRevision) throw new Error("La revisión ya no admite esta decisión; recarga la evidencia.");
        const source = await api.listE11FiscalVentas({ desde: snapshot.periodo.inicio, hastaExclusivo: snapshot.periodo.finExclusivo, limit: 1 });
        if (source.fuenteRevision !== command.fuenteRevision) throw new Error("FUENTE_CAMBIADA: crea una revisión vinculada; no se recalcula esta cifra congelada.");
      }
    },
    (r, command) => r.id === snapshot.id && samePeriod(r.periodo, snapshot.periodo) && r.totalFacturado === snapshot.totalFacturado
      && r.decisiones.some(d => d.uuid === command.uuid && d.actorId === s.identity.usuarioId && d.resultado === command.resultado && d.totalExterno === command.totalExterno && d.referenciaExterna === command.referenciaExterna && d.observacion === command.observacion));
  useEffect(() => { setReview(null); intention.reset(); }, [action.rejected]);
  return <section className={panel}><h3 className="font-bold">Conciliar con registro externo F</h3>
    <fieldset disabled={action.blocked} className="space-y-3">{!review ? <>
      <label>Resultado<select className={select} value={outcome} onChange={e => setOutcome(e.target.value as typeof outcome)}><option value="ACEPTADA">Cuadra — aceptar</option><option value="NO_CUADRA">No cuadra — avisar a ADMIN</option></select></label>
      <label>Total del registro externo<Input inputMode="decimal" value={total} onChange={e => setTotal(e.target.value)} /></label>
      <label>Referencia externa obligatoria (texto)<Input maxLength={250} value={reference} onChange={e => setReference(e.target.value)} /></label>
      <label>Observación (obligatoria si no cuadra; sin datos sensibles)<Textarea maxLength={1000} value={observation} onChange={e => setObservation(e.target.value)} /></label>
      <Button onClick={() => {
        try {
          const cents = e5Cents(total);
          if (e5Decimal(cents).length > 13) throw new Error("Importe fuera del rango monetario contractual.");
          if (!reference.trim() || (outcome === "NO_CUADRA" && !observation.trim())) throw new Error("Referencia y observación de discrepancia requeridas.");
          if (outcome === "ACEPTADA" && cents !== e5Cents(snapshot.totalFacturado)) throw new Error("Aceptar requiere igualdad exacta a centavos con la cifra congelada.");
          const body = { perfilVersion: s.identity.perfilVersion, revisionEsperada: snapshot.revision, fuenteRevision: snapshot.fuenteRevision, resultado: outcome, totalExterno: e5Decimal(cents), referenciaExterna: reference.trim(), observacion: observation.trim() };
          setReview({ ...body, uuid: intention.uuid(body) }); setProblem("");
        } catch (e) { setProblem((e as Error).message); }
      }}>Revisar decisión documental</Button>
    </> : <><p>Confirmar {review.resultado} · externo {money(review.totalExterno)} · congelado {money(snapshot.totalFacturado)} · {review.referenciaExterna}</p><p>{review.observacion}</p><p>No autoriza cobros ni pagos. NO CUADRA avisa a ADMIN, incluso con totales iguales si difiere composición.</p>
      <Button variant="outline" onClick={() => setReview(null)}>Volver</Button><Button onClick={() => void action.run(review)}>Confirmar decisión</Button>
    </>}</fieldset>
    {problem && <E11Error error={problem} />}<WriteStatus action={action} />{action.result && <p role="status">Decisión documental registrada en la evidencia. Consulta la revisión actualizada.</p>}
  </section>;
}

function Preparations({ s }: { s: E11Session }) {
  const [cursor, setCursor] = useState<string>();
  const rawClient = new URLSearchParams(window.location.search).get("clienteId");
  const client = rawClient && /^\d+$/.test(rawClient) && Number(rawClient) > 0 ? Number(rawClient) : undefined;
  const params = { clienteId: client, cursor, limit: 20 };
  const rows = api.useListE11Preparaciones(params, { query: q(s, "/api/e11/a/preparaciones", params) });
  return <section className={panel}><h2 className="text-xl font-bold">A · preparar dinero retenido existente</h2><p>Sin recibir, aplicar, aprobar, rechazar, devolver ni convertir sobrante en favor. ADMIN resuelve la propuesta por E5.</p>
    <ReadResult query={rows} restart={() => setCursor(undefined)}>{rows.data && (client && rows.data.items.some(c => c.clienteId !== client) ? <E11Error error="Recepciones ajenas al cliente solicitado." /> : <>
      {!rows.data.items.length && <p>Sin recepciones preparables en esta página.</p>}{rows.data.items.map(c => <article className="border-b py-2" key={c.cobroId}><Link className="underline" href={`/contabilidad/preparaciones/${c.cobroId}`}>Recepción {c.cobroId}</Link><p>Cliente #{c.clienteId} · retenido real {money(c.retenido)} · revisión {c.revision} · {c.propuestaId ? "Con propuesta registrada" : "Sin propuesta"}</p></article>)}
      <Pager cursor={cursor} next={rows.data.nextCursor} setCursor={setCursor} />
    </>)}</ReadResult>
  </section>;
}
function Preparation({ s, id }: { s: E11Session; id: string }) {
  const source = api.useGetE11Preparacion(id, { query: q(s, `/api/e11/a/preparaciones/${id}`) });
  return <ReadResult query={source}>{source.data && (source.data.cobroId !== id || source.data.notas.some(n => n.clienteId !== source.data!.clienteId) ? <E11Error error="Recepción/notas ajenas al ID/cliente solicitado." /> : <PreparationForm key={`${id}:${source.data.clienteId}`} s={s} source={source.data} />)}</ReadResult>;
}
function PreparationForm({ s, source }: { s: E11Session; source: api.E11Preparacion }) {
  const mutation = api.usePrepareE11Aplicacion({ mutation: { retry: false, networkMode: "always" } });
  const intention = useE11Intention();
  const [amounts, setAmounts] = useState<Record<number, string>>({});
  const [review, setReview] = useState<api.E11PreparacionInput | null>(null), [problem, setProblem] = useState("");
  const action = useE11Write<api.E11PreparacionInput, api.E11Preparacion>(`preparacion:${source.cobroId}:${source.clienteId}`, "E5_PREPARAR",
    data => mutation.mutateAsync({ cobroId: source.cobroId, data }),
    async (command, retry) => {
      if (!preparation(s) || command.perfilVersion !== s.identity.perfilVersion) throw new Error("Preparación A revocada o dependencia E5 cerrada.");
      const fresh = await api.getE11Preparacion(source.cobroId);
      if (fresh.cobroId !== source.cobroId || fresh.clienteId !== source.clienteId || fresh.notas.some(n => n.clienteId !== source.clienteId)) throw new Error("Fuente ajena al cobro/cliente.");
      if (!retry && (fresh.revision !== command.revisionEsperada || fresh.fuenteRevision !== command.fuenteRevision)) throw new Error("Fuente/revisión cambió. Actualiza y confirma una nueva propuesta; no se redirige dinero.");
      if (!retry && command.asignaciones.some(a => !fresh.notas.some(n => n.notaId === a.notaId && n.movimientoVentaId === a.movimientoVentaId && e5Cents(n.saldo) >= e5Cents(a.importe)))) throw new Error("NOTA_SIN_SALDO: detén la propuesta y revisa sus destinos.");
    },
    (r, command) => r.cobroId === source.cobroId && r.clienteId === source.clienteId && r.revision > command.revisionEsperada && !!r.propuestaId
      && r.retenido === source.retenido && r.notas.every(n => n.clienteId === source.clienteId));
  useEffect(() => { setReview(null); intention.reset(); }, [action.rejected]);
  return <section className={panel}><h2 className="text-xl font-bold">Preparar aplicación · cliente #{source.clienteId}</h2>
    <p>Cobro {source.cobroId} · retenido real {money(source.retenido)} · revisión {source.revision}</p>
    <p>Importe vacío excluye el cargo. Notas del mismo cliente; propuesta sin efecto financiero. No existe opción de favor para A.</p>
    <fieldset disabled={action.blocked} className="space-y-3">{!review ? <>
      {!source.notas.length && <p>Sin notas con saldo autorizadas para preparar.</p>}
      {source.notas.map(n => <label className="grid gap-2 border-b py-2 sm:grid-cols-2" key={n.movimientoVentaId}><span>Nota {n.folio} · cargo #{n.movimientoVentaId} · {n.facturada ? "Facturada" : "No facturada"} · saldo {money(n.saldo)}</span>
        <Input aria-label={`Importe cargo ${n.movimientoVentaId}`} inputMode="decimal" value={amounts[n.movimientoVentaId] ?? ""} onChange={e => setAmounts({ ...amounts, [n.movimientoVentaId]: e.target.value })} /></label>)}
      <Button onClick={() => {
        try {
          const assignments = source.notas.filter(n => (amounts[n.movimientoVentaId] ?? "").trim()).map(n => {
            const cents = e5Cents(amounts[n.movimientoVentaId]);
            if (e5Decimal(cents).length > 13) throw new Error("Importe fuera del rango monetario contractual.");
            if (!cents || cents > e5Cents(n.saldo)) throw new Error(`Importe inválido para cargo ${n.movimientoVentaId}.`);
            return { notaId: n.notaId, movimientoVentaId: n.movimientoVentaId, importe: e5Decimal(cents) };
          }).sort((a, b) => a.movimientoVentaId - b.movimientoVentaId);
          if (!assignments.length || new Set(assignments.map(a => a.movimientoVentaId)).size !== assignments.length || new Set(assignments.map(a => a.notaId)).size !== assignments.length) throw new Error("Elige notas/cargos únicos con importe positivo.");
          if (assignments.reduce((sum, a) => sum + e5Cents(a.importe), 0) > e5Cents(source.retenido)) throw new Error("La suma excede el dinero retenido real.");
          const body = { perfilVersion: s.identity.perfilVersion, revisionEsperada: source.revision, fuenteRevision: source.fuenteRevision, asignaciones: assignments };
          setReview({ ...body, uuid: intention.uuid(body) }); setProblem("");
        } catch (e) { setProblem((e as Error).message); }
      }}>Revisar propuesta sin aplicación</Button>
    </> : <><h3 className="font-semibold">Confirmar destinos explícitos</h3>{review.asignaciones.map(a => <p key={a.movimientoVentaId}>Nota #{a.notaId} · cargo #{a.movimientoVentaId} · {money(a.importe)}</p>)}<p>Se registra propuesta E5 auténtica. La deuda y el retenido no cambian por preparar.</p>
      <Button variant="outline" onClick={() => setReview(null)}>Volver</Button><Button onClick={() => void action.run(review)}>Confirmar preparación A</Button>
    </>}</fieldset>
    {problem && <E11Error error={problem} />}<WriteStatus action={action} />
    {action.result && <p role="status">Propuesta {action.result.propuestaId} preparada · retenido {money(action.result.retenido)} sin aplicación. ADMIN resolverá por E5.</p>}
    <Link className="underline" href="/contabilidad/preparaciones">Volver a recepciones preparables</Link>
  </section>;
}
export function E11AdminNotices() {
  const s = useE11Session();
  return e11On() && s && admin(s) && E11_RECONCILIATION_ENABLED && s.flags.conciliacion ? <Periods s={s} noticesOnly /> : null;
}
export function E11SnapshotNoticeLink({ entity, id }: { entity: string; id: string }) {
  const s = useE11Session();
  if (!e11On() || !s || !admin(s) || !E11_RECONCILIATION_ENABLED || !s.flags.conciliacion || entity !== "e11_conciliaciones" || !uuidPattern.test(id)) return null;
  return <Link className="text-sm font-medium text-primary underline" href={`/contabilidad/conciliaciones/${id}`}>Revisar snapshot NO CUADRA (sin efecto monetario)</Link>;
}