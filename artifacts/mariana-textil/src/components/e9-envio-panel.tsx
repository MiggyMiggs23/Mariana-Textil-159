import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetCurrentUser, useGetE9Disponibilidad, useObtenerCorteCaja, useCreateE9Entrega,
  getGetE9DisponibilidadQueryKey, getObtenerCorteCajaQueryKey, getGetE9EntregaQueryKey,
  type CurrentUser, type E9Entrega,
} from "@workspace/api-client-react";
import { E9_ENABLED } from "@/lib/e9-feature-flags";
import { e9Cents, e9Evidence, e9Error, e9Site, invalidateE9 } from "@/lib/e9-ui";
import { hasPermission, Modules } from "@/lib/permisos";
import { E9EvidenceFields } from "@/components/e9-entregas-panel";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

export function E9EnvioPanel({ corteId, ubicacionId }: { corteId: number; ubicacionId: number }) {
  return E9_ENABLED ? <E9SendContext corteId={corteId} ubicacionId={ubicacionId} /> : null;
}

function E9SendContext({ corteId, ubicacionId }: { corteId: number; ubicacionId: number }) {
  const { data: user } = useGetCurrentUser();
  if (!user || !["ADMIN", "SUPERVISOR"].includes(user.rol) || !hasPermission(user, Modules.CORTES, "ver") || e9Site(user, ubicacionId) !== ubicacionId) return null;
  return <E9Send key={`${JSON.stringify(user)}:${ubicacionId}:${corteId}`} user={user} site={ubicacionId} corteId={corteId} />;
}

function E9Send({ user, site, corteId }: { user: CurrentUser; site: number; corteId: number }) {
  const identity = JSON.stringify(user);
  const client = useQueryClient();
  const availability = useGetE9Disponibilidad({ ubicacionId: site }, { query: {
    queryKey: [...getGetE9DisponibilidadQueryKey({ ubicacionId: site }), identity],
    staleTime: 0, refetchOnMount: "always", refetchOnWindowFocus: true, refetchInterval: 15000,
  } });
  const allowed = availability.data?.enabled === true && availability.data.ubicacionId === site && availability.data.capacidades?.puedeEnviar === true && !availability.error;
  const canonical = useObtenerCorteCaja(corteId, { query: {
    queryKey: [...getObtenerCorteCajaQueryKey(corteId), "E9", identity, site],
    enabled: allowed, staleTime: 0, refetchOnMount: "always", refetchOnWindowFocus: true,
  } });
  const create = useCreateE9Entrega();
  const [open, setOpen] = useState(false);
  const [description, setDescription] = useState("");
  const [references, setReferences] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [saved, setSaved] = useState<E9Entrega | null>(null);
  const guard = useRef(false);
  const active = useRef(true);
  const intention = useRef({ snapshot: "", uuid: "" });
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  const corte = canonical.data?.sesion.id === corteId && canonical.data.sesion.ubicacionId === site ? canonical.data : undefined;
  const positive = corte?.efectivoContado != null && (e9Cents(corte.efectivoContado) ?? 0n) > 0n;
  const ready = allowed && !canonical.error && corte?.sesion.estado === "CERRADA" && !!corte.versionCorte && positive;

  const submit = async () => {
    if (guard.current || !ready || !corte || saved) return;
    guard.current = true; setPending(true); setError("");
    try {
      const evidencia = e9Evidence(description, references);
      const versionCorte = corte.versionCorte!;
      const freshAvailability = await availability.refetch();
      if (!active.current) throw new Error("Cambió el contexto de usuario o tienda.");
      if (freshAvailability.error) throw freshAvailability.error;
      if (!freshAvailability.data?.enabled || freshAvailability.data.ubicacionId !== site || !freshAvailability.data.capacidades?.puedeEnviar) throw new Error("El envío ya no está autorizado para este contexto.");
      const fresh = await canonical.refetch();
      if (!active.current) throw new Error("Cambió el contexto de usuario o tienda.");
      if (fresh.error) throw fresh.error;
      if (!fresh.data || fresh.data.sesion.id !== corteId || fresh.data.sesion.ubicacionId !== site || fresh.data.sesion.estado !== "CERRADA") throw new Error("El corte no corresponde a este cierre autorizado.");
      if (fresh.data.versionCorte !== versionCorte) throw new Error("La evidencia canónica cambió. Revisa el corte y confirma una nueva intención.");
      if (fresh.data.efectivoContado !== corte.efectivoContado || (e9Cents(fresh.data.efectivoContado ?? "") ?? 0n) <= 0n) throw new Error("El efectivo físico contado no está disponible para enviar. Revisa el corte.");
      const body = { corteId, versionCorte, evidencia };
      const snapshot = JSON.stringify({ identity, site, body });
      if (intention.current.snapshot !== snapshot) intention.current = { snapshot, uuid: crypto.randomUUID() };
      const result = await create.mutateAsync({ data: { ...body, claveOperacion: intention.current.uuid } });
      if (result.ubicacionId !== site || result.corteId !== corteId || result.versionCorte !== versionCorte) throw new Error("La respuesta no corresponde al corte confirmado. Consulta las entregas antes de continuar.");
      client.setQueryData([...getGetE9EntregaQueryKey(result.id), identity, site], result);
      void invalidateE9(client);
      if (active.current) setSaved(result);
      intention.current = { snapshot: "", uuid: "" };
    } catch (err) { if (active.current) setError(e9Error(err)); }
    finally { guard.current = false; if (active.current) setPending(false); }
  };

  return <section className="rounded border p-3 space-y-2" data-testid="e9-envio-panel">
    <h3 className="font-semibold">Envío completo al cierre</h3>
    {availability.isLoading && <p role="status">Consultando capacidad de envío…</p>}
    {availability.error && <p role="alert" className="text-destructive">{e9Error(availability.error)}</p>}
    {(availability.error || canonical.error) && <Button variant="outline" disabled={availability.isFetching || canonical.isFetching} onClick={() => { void availability.refetch(); if (allowed) void canonical.refetch(); }}>Reintentar consulta</Button>}
    {availability.data && !allowed && !availability.error && <p>{availability.data.motivoInactivo || "No tienes capacidad para documentar el envío de este cierre."}</p>}
    {allowed && canonical.isLoading && <p role="status">Consultando corte canónico…</p>}
    {canonical.error && <p role="alert" className="text-destructive">{e9Error(canonical.error)}</p>}
    {allowed && corte && !corte.versionCorte && <p>No se puede enviar: falta evidencia canónica congelada del corte. No se genera una versión local.</p>}
    {allowed && corte && !positive && <p>Cierre sin efectivo físico contado positivo: no enviable. No se crea un ingreso cero.</p>}
    {ready && <Button data-testid="button-e9-envio" disabled={pending} onClick={() => { setOpen(true); setError(""); }}>Documentar envío completo</Button>}
    <Dialog open={open} onOpenChange={value => { if (!guard.current) setOpen(value); }}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Documentar envío de efectivo</DialogTitle><DialogDescription>Se entrega todo el efectivo físico contado del cierre, sin descontar fondo inicial ni reservar cambio. No registra una recepción ni un ingreso anticipado.</DialogDescription></DialogHeader>
        {saved ? <div role="status" className="space-y-2"><p>Envío registrado · {saved.estado}</p><p>{saved.ubicacionNombre} · {/^\/caja\/cortes(?:\?|$)/.test(saved.corteHref) ? <a className="text-primary underline" href={saved.corteHref}>Corte #{saved.corteId}</a> : <>Corte #{saved.corteId}</>} · Enviado {saved.importeEnviado}</p><p>{saved.enviadoAt} · {saved.enviadoPor.nombre}</p><p>La recepción queda pendiente. Consulta su detalle en Entregas de efectivo.</p></div> : <fieldset disabled={pending} className="space-y-3">
          <p>Corte #{corteId} · {corte?.sesion.nombreUbicacion}</p>
          <p>Fecha de cierre: {corte?.sesion.cerradaAt ?? "No disponible"}</p>
          <p data-testid="text-e9-total-envio" className="font-semibold">Total físico contado congelado: {corte?.efectivoContado ?? "No disponible"}</p>
          <E9EvidenceFields description={description} setDescription={setDescription} references={references} setReferences={setReferences} />
          <Button disabled={!ready || pending} data-testid="button-e9-confirmar-envio" onClick={() => void submit()}>{pending ? "Registrando…" : "Confirmar envío completo"}</Button>
        </fieldset>}
        {error && <p role="alert" className="text-destructive">{error}</p>}
        <Button variant="outline" disabled={pending} onClick={() => setOpen(false)}>Cerrar</Button>
      </DialogContent>
    </Dialog>
  </section>;
}