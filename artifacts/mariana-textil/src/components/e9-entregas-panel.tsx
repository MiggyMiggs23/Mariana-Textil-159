import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  useGetCurrentUser, useGetE9Disponibilidad, useListE9Entregas, useGetE9Entrega,
  useCreateE9Conteo, useAuthorizeE9Recepcion, useCloseE9Investigacion,
  getGetE9DisponibilidadQueryKey, getListE9EntregasQueryKey, getGetE9EntregaQueryKey,
  type E9Entrega, type E9Evidencia, type E9Estado, type CurrentUser,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { E9_ENABLED } from "@/lib/e9-feature-flags";
import { e9Cents, e9Money, e9Evidence, e9Error, e9Site, invalidateE9 } from "@/lib/e9-ui";
import { hasPermission, Modules } from "@/lib/permisos";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

export function E9EntregasPanel({ ubicacionId }: { ubicacionId?: number | null }) {
  return E9_ENABLED ? <E9Context ubicacionId={ubicacionId} /> : null;
}

function E9Context({ ubicacionId }: { ubicacionId?: number | null }) {
  const { data: user } = useGetCurrentUser();
  if (!user || !hasPermission(user, Modules.CORTES, "ver")) return null;
  const site = e9Site(user, ubicacionId);
  if (!site) return <p className="text-sm text-muted-foreground">Selecciona una tienda autorizada en el filtro existente para consultar entregas de efectivo.</p>;
  // Remount drafts and mutations when actor, role, permissions or store changes.
  return <E9List key={`${JSON.stringify(user)}:${site}`} user={user} site={site} />;
}

function E9List({ user, site }: { user: CurrentUser; site: number }) {
  const identity = JSON.stringify(user);
  const [estado, setEstado] = useState<E9Estado | "TODOS">("TODOS");
  const [cursors, setCursors] = useState<Array<string | undefined>>([undefined]);
  const [selected, setSelected] = useState<string | null>(null);
  const availability = useGetE9Disponibilidad({ ubicacionId: site }, { query: {
    queryKey: [...getGetE9DisponibilidadQueryKey({ ubicacionId: site }), identity],
    staleTime: 0, refetchOnMount: "always", refetchOnWindowFocus: true, refetchInterval: 15000,
  } });
  const params = { ubicacionId: site, ...(estado !== "TODOS" ? { estado } : {}), cursor: cursors[cursors.length - 1], limit: 25 };
  const list = useListE9Entregas(params, { query: {
    enabled: availability.data?.enabled === true && availability.data.ubicacionId === site && !availability.error,
    queryKey: [...getListE9EntregasQueryKey(params), identity],
    staleTime: 0, refetchOnMount: "always", refetchOnWindowFocus: true, refetchInterval: 15000,
  } });
  return <Card data-testid="e9-entregas-panel">
    <CardHeader><CardTitle>Entregas de efectivo a Mariana</CardTitle></CardHeader>
    <CardContent className="space-y-4">
      <p className="text-sm text-muted-foreground">Custodia y recepción documental del efectivo completo de cortes cerrados. El envío no modifica caja histórica ni ingresa dinero al Fondo. Una investigación se cierra sólo documentalmente.</p>
      {availability.isLoading && <p role="status">Consultando disponibilidad…</p>}
      {availability.error && <p role="alert" className="text-destructive">{e9Error(availability.error)}</p>}
      {availability.error && <Button variant="outline" disabled={availability.isFetching} onClick={() => void availability.refetch()}>Reintentar disponibilidad</Button>}
      {availability.data && !availability.data.enabled && <p>{availability.data.motivoInactivo || "Entregas no disponibles."}</p>}
      {availability.data?.enabled && availability.data.ubicacionId === site && !availability.error && <>
        <div className="flex gap-3">
          <Select value={estado} onValueChange={value => { setEstado(value as E9Estado | "TODOS"); setCursors([undefined]); }}>
            <SelectTrigger className="w-52" aria-label="Estado de recepción" data-testid="select-e9-estado"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="TODOS">Todos los estados</SelectItem><SelectItem value="ENVIADA">Enviada</SelectItem><SelectItem value="CONTADA">Contada</SelectItem><SelectItem value="AUTORIZADA">Autorizada</SelectItem></SelectContent>
          </Select>
          <Button variant="outline" data-testid="button-e9-refrescar" disabled={list.isFetching} onClick={() => void list.refetch()}>Actualizar</Button>
        </div>
        {list.isLoading && <p role="status">Cargando entregas…</p>}
        {list.error && <p role="alert" className="text-destructive">{e9Error(list.error)}</p>}
        {!list.isLoading && !list.error && list.data?.items.length === 0 && <p>No hay entregas en este filtro.</p>}
        {!list.error && list.data?.items.filter(item => item.ubicacionId === site).map(item => <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded border p-3">
          <div><p className="font-semibold">{item.ubicacionNombre} · <button type="button" className="text-primary underline" data-testid={`button-e9-detalle-${item.id}`} onClick={() => setSelected(item.id)}>Corte #{item.corteId}</button></p><p className="text-sm">Enviado <button type="button" className="font-semibold text-primary underline" onClick={() => setSelected(item.id)} aria-label={`Abrir detalle de la entrega del corte ${item.corteId}`}>{item.importeEnviado}</button> · {item.estado} · Investigación: {item.investigacion?.estado ?? "Sin investigación"}</p><p className="text-xs text-muted-foreground">{item.enviadoAt} · {item.enviadoPor.nombre}</p></div>
        </div>)}
        <div className="flex gap-2"><Button variant="outline" disabled={cursors.length === 1 || list.isFetching} onClick={() => setCursors(value => value.slice(0, -1))}>Anterior</Button><Button variant="outline" disabled={!list.data?.nextCursor || list.isFetching} onClick={() => setCursors(value => [...value, list.data!.nextCursor])}>Siguiente</Button></div>
      </>}
      {selected && availability.data?.enabled && !availability.error && <E9Detail key={selected} id={selected} site={site} user={user} onClose={() => setSelected(null)} />}
    </CardContent>
  </Card>;
}

function Evidence({ value }: { value: E9Evidencia }) {
  return <div className="text-sm"><p className="whitespace-pre-wrap">{value.descripcion}</p>{value.referencias.length > 0 && <ul className="list-disc pl-5">{value.referencias.map((ref, index) => <li className="break-all" key={index}>{ref}</li>)}</ul>}</div>;
}

function E9History({ data, corteHref }: { data: E9Entrega; corteHref: string | null }) {
  const events: Array<{ key: string; date: string; content: ReactNode }> = [{
    key: "envio", date: data.enviadoAt,
    content: <><p>Envío · {data.enviadoAt} · {data.enviadoPor.nombre}</p><Evidence value={data.evidenciaEnvio} /></>,
  }];
  for (const item of data.conteos) events.push({ key: item.id, date: item.createdAt,
    content: <><p>Conteo · {item.createdAt} · {item.actor.nombre}{item.id === data.conteoVigenteId ? " · Vigente" : ""}</p><p>Recibido {corteHref ? <a className="text-primary underline" href={corteHref}>{item.importeRecibido}</a> : item.importeRecibido} · Diferencia {corteHref ? <a className="text-primary underline" href={corteHref}>{item.diferencia}</a> : item.diferencia}</p><Evidence value={item.evidencia} /></>,
  });
  if (data.investigacion) {
    const investigation = data.investigacion;
    events.push({ key: "investigacion", date: investigation.abiertaAt, content: <><p>Investigación abierta: {investigation.abiertaAt}</p><p>Conteo de origen: {investigation.conteoOrigenId}</p></> });
    if (investigation.cierre) {
      const closed = investigation.cierre;
      events.push({ key: "cierre", date: closed.createdAt, content: <><p>Cierre documental · {closed.createdAt} · {closed.actor.nombre}</p><p className="whitespace-pre-wrap">{closed.conclusion}</p><Evidence value={closed.evidencia} /><p>No corrige la discrepancia ni ajusta saldos.</p></> });
    }
  }
  if (data.autorizacion) {
    const authorization = data.autorizacion;
    events.push({ key: "autorizacion", date: authorization.createdAt, content: <><p>Recepción autorizada · {authorization.createdAt} · {authorization.actor.nombre}</p><p>Importe recibido {corteHref ? <a className="text-primary underline" href={corteHref}>{authorization.importeRecibido}</a> : authorization.importeRecibido}</p>{authorization.motivo && <p>{authorization.motivo}</p>}</> });
  }
  return <section className="space-y-3"><h3 className="font-semibold">Cronología y evidencia</h3>{events.sort((a, b) => Date.parse(a.date) - Date.parse(b.date)).map(event => <article className="rounded border p-3" key={event.key}>{event.content}</article>)}</section>;
}

export function E9EvidenceFields({ description, setDescription, references, setReferences }: {
  description: string; setDescription: (value: string) => void; references: string; setReferences: (value: string) => void;
}) {
  return <div className="space-y-2">
    <Label>Descripción de evidencia (obligatoria)<Textarea aria-label="Descripción de evidencia" data-testid="input-e9-evidencia" maxLength={2000} value={description} onChange={event => setDescription(event.target.value)} /></Label>
    <Label>Referencias documentales (una por línea, opcional)<Textarea aria-label="Referencias documentales" data-testid="input-e9-referencias" value={references} onChange={event => setReferences(event.target.value)} /></Label>
    <p className="text-xs text-muted-foreground">Hasta 20 referencias de 500 caracteres. No se cargan archivos ni se descargan referencias. Fechas y autor se registran en el servidor.</p>
  </div>;
}

type Action = "conteo" | "autorizar" | "cerrar";

function E9Detail({ id, site, user, onClose }: { id: string; site: number; user: CurrentUser; onClose: () => void }) {
  const identity = JSON.stringify(user);
  const admin = user.rol === "ADMIN";
  const client = useQueryClient();
  const key = [...getGetE9EntregaQueryKey(id), identity, site];
  const detail = useGetE9Entrega(id, { query: { queryKey: key, staleTime: 0, refetchOnMount: "always", refetchOnWindowFocus: true, refetchInterval: 15000 } });
  const count = useCreateE9Conteo();
  const authorize = useAuthorizeE9Recepcion();
  const close = useCloseE9Investigacion();
  const [action, setAction] = useState<Action | null>(null);
  const [authorizationCountId, setAuthorizationCountId] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [references, setReferences] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [pending, setPending] = useState(false);
  const guard = useRef(false);
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
      void client.invalidateQueries({ queryKey: key, refetchType: "none" });
    };
  }, []);
  const intention = useRef({ snapshot: "", uuid: "" });
  const data = !detail.error && detail.data?.ubicacionId === site ? detail.data : undefined;
  const corteHref = data && /^\/caja\/cortes(?:\?|$)/.test(data.corteHref) ? data.corteHref : null;
  const current = data?.conteos.find(item => item.id === data.conteoVigenteId);
  const intendedCount = data?.conteos.find(item => item.id === authorizationCountId);
  const canCount = !detail.error && admin && data?.capacidades.puedeContar && data.estado !== "AUTORIZADA";
  const canAuthorize = !detail.error && admin && data?.capacidades.puedeAutorizar && data.estado !== "AUTORIZADA" && current && (e9Cents(current.importeRecibido) ?? 0n) > 0n;
  const canClose = !detail.error && admin && data?.capacidades.puedeCerrarInvestigacion && data.investigacion?.estado === "ABIERTA";
  const begin = (next: Action) => { if (guard.current) return; setAuthorizationCountId(next === "autorizar" ? current?.id ?? null : null); setAction(next); setError(""); setSuccess(""); setAmount(""); setDescription(""); setReferences(""); setReason(""); };

  const submit = async () => {
    if (guard.current || !action || !data || !admin) return;
    guard.current = true; setPending(true); setError(""); setSuccess("");
    try {
      const content = action === "conteo"
        ? { importeRecibido: e9Money(amount), evidencia: e9Evidence(description, references) }
        : action === "autorizar"
          ? { conteoId: authorizationCountId, ...(reason.trim() ? { motivo: reason.trim() } : {}) }
          : { conclusion: reason.trim(), evidencia: e9Evidence(description, references) };
      if (reason.trim().length > 2000) throw new Error("El motivo o conclusión admite máximo 2000 caracteres.");
      if (action === "conteo" && !e9Money(amount)) throw new Error("Captura el importe real, no negativo, con máximo dos decimales.");
      if (action === "cerrar" && !reason.trim()) throw new Error("La conclusión documental es obligatoria.");
      if (action === "autorizar" && intendedCount?.diferencia !== "0.00" && !reason.trim()) throw new Error("La discrepancia exige motivo explícito. Autorizar no cierra la investigación.");
      const snapshot = JSON.stringify({ identity, site, id, action, content });
      const replay = intention.current.snapshot === snapshot && !!intention.current.uuid;
      // Pin the intended count before refreshing. Never silently authorize a newer count.
      const expectedCount = authorizationCountId;
      const fresh = await detail.refetch();
      if (!active.current) throw new Error("El contexto de usuario o tienda cambió. Reabre la entrega.");
      if (fresh.error) throw fresh.error;
      const row = fresh.data;
      if (!row || row.ubicacionId !== site) throw new Error("Entrega fuera del alcance vigente.");
      if (!replay && action === "conteo" && (!row.capacidades.puedeContar || row.estado === "AUTORIZADA")) throw new Error("La entrega ya no admite conteos.");
      if (!replay && action === "autorizar" && (!row.capacidades.puedeAutorizar || row.estado === "AUTORIZADA" || !expectedCount || row.conteoVigenteId !== expectedCount)) throw new Error("El conteo cambió o ya fue autorizado. Revisa el detalle antes de confirmar otra intención.");
      if (action === "autorizar" && (!intendedCount || (e9Cents(intendedCount.importeRecibido) ?? 0n) <= 0n)) throw new Error("Un conteo cero permanece pendiente y no admite autorización.");
      if (!replay && action === "cerrar" && (!row.capacidades.puedeCerrarInvestigacion || row.investigacion?.estado !== "ABIERTA")) throw new Error("La investigación ya no admite cierre documental.");
      if (intention.current.snapshot !== snapshot) intention.current = { snapshot, uuid: crypto.randomUUID() };
      const claveOperacion = intention.current.uuid;
      let result: E9Entrega;
      if (action === "conteo") result = await count.mutateAsync({ id, data: { claveOperacion, importeRecibido: e9Money(amount)!, evidencia: e9Evidence(description, references) } });
      else if (action === "autorizar") result = await authorize.mutateAsync({ id, data: { claveOperacion, conteoId: expectedCount!, ...(reason.trim() ? { motivo: reason.trim() } : {}) } });
      else result = await close.mutateAsync({ id, data: { claveOperacion, conclusion: reason.trim(), evidencia: e9Evidence(description, references) } });
      if (result.id !== id || result.ubicacionId !== site) throw new Error("La respuesta no corresponde a la entrega de este contexto. Consulta el estado antes de continuar.");
      client.setQueryData(key, result);
      void invalidateE9(client);
      intention.current = { snapshot: "", uuid: "" };
      if (active.current) {
        setSuccess(action === "cerrar" ? "Cierre documental registrado. No se modificaron importes ni saldos." : action === "autorizar" ? "Recepción documental autorizada. No se ingresó dinero al Fondo." : "Conteo registrado como nueva evidencia.");
        setAction(null);
      }
    } catch (err) { if (active.current) setError(e9Error(err)); }
    finally { guard.current = false; if (active.current) setPending(false); }
  };

  return <Dialog open onOpenChange={value => { if (!value && !guard.current) onClose(); }}>
    <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
      <DialogHeader><DialogTitle>Entrega de efectivo</DialogTitle><DialogDescription>Recepción e investigación son estados independientes. No se modifican cortes cerrados.</DialogDescription></DialogHeader>
      {detail.isLoading && <p role="status">Cargando detalle…</p>}
      {detail.error && <p role="alert" className="text-destructive">{e9Error(detail.error)}</p>}
      {data && <div className="space-y-4">
        <div className="rounded border p-3"><p className="font-semibold">{data.ubicacionNombre} · {corteHref ? <a className="underline" href={corteHref}>Corte #{data.corteId}</a> : <>Corte #{data.corteId}</>}</p><p>Corte: {data.fechaCorte} · Versión {data.versionCorte}</p>{corteHref && <a className="underline" href={corteHref}>Ver corte exacto</a>}<p>Enviado: {corteHref ? <a className="font-semibold text-primary underline" href={corteHref}>{data.importeEnviado}</a> : data.importeEnviado} · Recepción: {data.estado}</p><p>Recibido vigente: {corteHref && current ? <a className="text-primary underline" href={corteHref}>{current.importeRecibido}</a> : current?.importeRecibido ?? "Sin conteo"} · Diferencia: {corteHref && current ? <a className="text-primary underline" href={corteHref}>{current.diferencia}</a> : current?.diferencia ?? "Sin conteo"}</p><p>Investigación: {data.investigacion?.estado ?? "Sin investigación"}</p></div>
        <E9History data={data} corteHref={corteHref} />
        {current && e9Cents(current.importeRecibido) === 0n && data.estado !== "AUTORIZADA" && <p className="text-sm">Conteo cero: recepción pendiente; no se autoriza.</p>}
        <div className="flex flex-wrap gap-2">{canCount && <Button disabled={pending} data-testid="button-e9-conteo" onClick={() => begin("conteo")}>Registrar conteo</Button>}{canAuthorize && <Button disabled={pending} data-testid="button-e9-autorizar" onClick={() => begin("autorizar")}>Autorizar recepción</Button>}{canClose && <Button disabled={pending} variant="outline" data-testid="button-e9-cierre" onClick={() => begin("cerrar")}>Cerrar investigación documentalmente</Button>}</div>
        {action && <fieldset disabled={pending} className="rounded border p-4 space-y-3">
          {action === "conteo" && <Label>Importe físicamente recibido en Mariana<Input aria-label="Importe recibido" data-testid="input-e9-recibido" inputMode="decimal" value={amount} onChange={event => setAmount(event.target.value)} /></Label>}
          {action === "autorizar" && <p>Confirmar documentalmente {intendedCount?.importeRecibido ?? "Sin conteo"} recibido en Mariana. Esta autorización no registra un ingreso al Fondo ni modifica el corte. {intendedCount?.diferencia !== "0.00" && "Hay discrepancia: la investigación permanecerá abierta."}</p>}
          {action !== "conteo" && <Label>{action === "cerrar" ? "Conclusión documental obligatoria" : "Motivo de autorización (obligatorio con discrepancia)"}<Textarea aria-label="Motivo o conclusión" data-testid="input-e9-motivo" maxLength={2000} value={reason} onChange={event => setReason(event.target.value)} /></Label>}
          {action !== "autorizar" && <E9EvidenceFields description={description} setDescription={setDescription} references={references} setReferences={setReferences} />}
          {action === "cerrar" && <p className="text-sm">Este cierre sólo documenta la conclusión. No perdona faltantes, ajusta saldos, recupera dinero ni declara conciliada la diferencia.</p>}
          <div className="flex gap-2"><Button data-testid="button-e9-confirmar" onClick={() => void submit()}>{pending ? "Procesando…" : "Confirmar"}</Button><Button variant="outline" onClick={() => setAction(null)}>Cancelar</Button></div>
        </fieldset>}
      </div>}
      {error && <p role="alert" className="text-destructive">{error}</p>}
      {success && <p role="status">{success}</p>}
      <Button variant="outline" disabled={pending || detail.isFetching} onClick={() => void detail.refetch()}>Consultar estado actualizado</Button>
    </DialogContent>
  </Dialog>;
}