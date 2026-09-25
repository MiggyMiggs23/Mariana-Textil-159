import { useEffect, useRef, useState } from "react";
import { useGetE11OperacionRecuperacion, useResolveE11Operacion, type ResolveE11OperacionBody, type E11OperacionRecuperacion } from "@workspace/api-client-react";
import type { E11Session } from "@/lib/e11-session";
import { e11ApplyResolution, e11AssertRecovery, e11SameRecovery, type E11Recovery } from "@/lib/e11-recovery";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { E11_ENABLED, E11_UI_ENABLED } from "@/lib/e11-feature-flags";

/** Dedicated metadata-only resolver. Never uses business write/quarantine barriers. */
export function E11RecoveryAdmin({ record, session }: { record: E11Recovery; session: E11Session }) {
  if (!E11_ENABLED || !E11_UI_ENABLED || !session.flags.enabled || session.identity.rolBase !== "ADMIN"
    || session.identity.perfil !== null || !session.identity.capacidades.includes("FISCAL_LEER")) return null;
  return <AuthorizedRecoveryAdmin key={`${session.key}:${record.actorId}:${record.accion}:${record.uuidOriginal}`} record={record} session={session} />;
}
function AuthorizedRecoveryAdmin({ record, session }: { record: E11Recovery; session: E11Session }) {
  const target = { actorId: record.actorId, accion: record.accion, uuidOriginal: record.uuidOriginal };
  const key = `e11-resolver:${encodeURIComponent(session.key)}:${record.actorId}:${record.accion}:${record.uuidOriginal}`;
  const query = useGetE11OperacionRecuperacion(record.actorId, record.accion, record.uuidOriginal, {
    query: { queryKey: ["/api/e11/operaciones", target, session.key], retry: false, staleTime: 0, refetchOnMount: "always", refetchOnWindowFocus: "always" },
  });
  const mutation = useResolveE11Operacion({ mutation: { retry: false, networkMode: "always" } });
  const pending = useRef<ResolveE11OperacionBody | null>(null), lock = useRef(false), alive = useRef(true);
  const [body, setBody] = useState<ResolveE11OperacionBody | null>(null);
  const [reason, setReason] = useState(""), [error, setError] = useState("");
  const [busy, setBusy] = useState(false), [storageBlocked, setStorageBlocked] = useState(false);
  const [metadata, setMetadata] = useState<E11OperacionRecuperacion | null>(null);
  const authorize = async () => {
    const actor = await session.check();
    if (actor.rolBase !== "ADMIN" || actor.perfil !== null || !actor.capacidades.includes("FISCAL_LEER")) throw new Error("Recuperación exclusiva de ADMIN vigente con FISCAL_LEER.");
    return actor;
  };
  const accept = async (response: E11OperacionRecuperacion) => {
    await authorize();
    if (!alive.current) return false;
    e11AssertRecovery(response, record);
    setMetadata(response);
    const terminal = ["CONFIRMADA", "CERRADA_SIN_EFECTO"].includes(response.estado) && !!response.resolucionId;
    if (terminal) {
      // Storage removal failure keeps marker, rather than pretending recovery succeeded.
      sessionStorage.removeItem(key);
      return e11ApplyResolution(record, response);
    }
    return false;
  };
  useEffect(() => {
    alive.current = true;
    try {
      const raw = sessionStorage.getItem(key);
      if (raw) {
        const stored = JSON.parse(raw);
        if (stored.scope !== session.key || !e11SameRecovery(stored.target, target)
          || !/^[a-f0-9-]{36}$/i.test(stored.body?.uuid) || stored.body.identidadVersion !== session.identity.permisosVersion
          || !/^[a-f0-9]{64}$/.test(stored.body.revisionEsperada) || typeof stored.body.motivo !== "string" || !stored.body.motivo.trim())
          throw new Error("Intención resolutora inválida; consulta GET de la terna, no reenviar.");
        pending.current = stored.body; setBody(stored.body);
      }
    } catch (e) { setStorageBlocked(true); setError((e as Error).message); }
    return () => { alive.current = false; pending.current = null; };
  }, [key]);
  useEffect(() => {
    if (query.data && !query.error) void accept(query.data).catch(e => { if (alive.current) setError((e as Error).message); });
  }, [query.data, query.error]);
  const consult = async () => {
    await authorize();
    const fresh = await query.refetch();
    if (fresh.error || !fresh.data) throw fresh.error || new Error("Consulta sin metadata; conservar cuarentena.");
    return { terminal: await accept(fresh.data), data: fresh.data };
  };
  const resolve = async () => {
    if (lock.current || storageBlocked) return;
    lock.current = true; setBusy(true); setError("");
    try {
      const actor = await authorize();
      const fresh = await consult();
      if (fresh.terminal || !alive.current) return;
      let command = pending.current;
      if (!command) {
        if (!reason.trim() || reason.trim().length > 500) throw new Error("Motivo obligatorio, máximo 500 caracteres.");
        if (!window.confirm("Confirmar resolución documental: verifica resultado o cierra sin efecto con tombstone. Nunca reenvía la operación original.")) return;
        command = { uuid: crypto.randomUUID(), revisionEsperada: fresh.data.revision, identidadVersion: actor.permisosVersion, motivo: reason.trim() };
      }
      await authorize();
      if (!alive.current) return;
      sessionStorage.setItem(key, JSON.stringify({ scope: session.key, target, body: command }));
      pending.current = command; setBody(command);
      const response = await mutation.mutateAsync({ ...target, data: command });
      await accept(response);
    } catch (e) {
      if (!alive.current) return;
      setError(`${(e as Error).message}. Conserva UUID resolutor; GET de la terna original es autoridad. 404/PENDIENTE no liberan.`);
      // Lost POST response (including stale replay): GET, not another namespace/quarantine.
      try { await consult(); } catch { /* Prior explicit error remains; original marker stays. */ }
    } finally { lock.current = false; if (alive.current) setBusy(false); }
  };
  return <section data-testid="e11-recovery-admin" className="my-3 space-y-2 border p-3">
    <p>ADMIN · actor original {record.actorId} · {record.accion} · {record.uuidOriginal}</p>
    {metadata && <p>Servidor: {metadata.estado} · resolución {metadata.resolucionId ?? "aún no auditada"}. PENDIENTE no demuestra ausencia definitiva de efecto.</p>}
    {query.error && <p role="alert">No se pudo consultar resultado. No se libera por error ni 404.</p>}
    {error && <p role="alert">{error}</p>}
    <Textarea aria-label="Motivo de resolución ADMIN" maxLength={500} value={body?.motivo ?? reason} disabled={!!body || busy} onChange={e => setReason(e.target.value)} />
    {body && <p>UUID resolutor conservado: {body.uuid}</p>}
    <Button disabled={busy} variant="outline" onClick={() => { void consult().catch(e => setError((e as Error).message)); }}>Consultar resultado original</Button>
    <Button disabled={busy || storageBlocked || (!body && !reason.trim())} onClick={() => void resolve()}>{body ? "Reintentar resolución exacta" : "Revisar y resolver cuarentena"}</Button>
  </section>;
}