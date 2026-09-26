import { createContext, useContext, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetE11Disponibilidad, useGetE11Identidad, getE11Identidad,
  getGetE11DisponibilidadQueryKey, getGetE11IdentidadQueryKey,
  type E11Identidad, type E11Disponibilidad, type CurrentUser,
} from "@workspace/api-client-react";
import { E11_ENABLED, E11_UI_ENABLED } from "@/lib/e11-feature-flags";
import { e11Quarantine, e11Recoveries, type E11Recovery } from "@/lib/e11-recovery";
import { E11RecoveryAdmin } from "@/components/e11-recovery-admin";

export const e11On = () => E11_ENABLED && E11_UI_ENABLED;
export const e11IdentityKey = (i: E11Identidad) => JSON.stringify([i.usuarioId, i.rolBase, i.perfil, i.perfilVersion, i.permisosVersion, [...i.capacidades].sort()]);
export type E11Session = { identity: E11Identidad; key: string; flags: E11Disponibilidad; check: () => Promise<E11Identidad> };
const Context = createContext<E11Session | null>(null);
export const useE11Session = () => useContext(Context);
export function e11Error(error: unknown) {
  const e = error as { data?: { code?: string; message?: string; requestId?: string }; message?: string };
  return e?.data?.message ? `${e.data.code}: ${e.data.message} · Solicitud ${e.data.requestId ?? "no disponible"}` : e?.message || "No se pudo comprobar la información. No se sustituirá por cero.";
}
export function E11Error({ error }: { error: unknown }) { return <p role="alert" className="text-destructive">{typeof error === "string" ? error : e11Error(error)}</p>; }
export function E11RecoveryNotice({ session }: { session?: E11Session }) {
  const [records, setRecords] = useState<E11Recovery[]>([]);
  const [problem, setProblem] = useState("");
  const [resolved, setResolved] = useState("");
  useLayoutEffect(() => {
    const refresh = () => { try { setRecords(e11Recoveries()); } catch { setProblem("No se pudo leer el registro de recuperación. Escrituras bloqueadas; solicita revisión ADMIN."); } };
    refresh(); window.addEventListener("e11-recovery", refresh); window.addEventListener("storage", refresh);
    const terminal = (event: Event) => { const r = (event as CustomEvent).detail; setResolved(`Actor original ${r.actorId} · ${r.accion} · ${r.uuidOriginal}: ${r.estado} · resolución ${r.resolucionId}. No reenviar operación original.`); };
    window.addEventListener("e11-resolved", terminal);
    return () => { window.removeEventListener("e11-recovery", refresh); window.removeEventListener("storage", refresh); window.removeEventListener("e11-resolved", terminal); };
  }, []);
  if (!records.length && !problem && !resolved) return null;
  return <aside role="alert" data-testid="e11-recovery-notice" className="rounded border border-destructive p-4">
    <strong>Recuperación E11 pendiente — no crear otra intención</strong>
    <p>Entrega estos UUID a ADMIN para consultar la evidencia del servidor con autorización vigente. Cambiar perfil o iniciar sesión no prueba que la operación no ocurrió. No se muestra ni recupera aquí el contenido privado anterior.</p>
    {resolved && <p role="status">{resolved}</p>}
    {records.map(r => <div key={`${r.actorId}:${r.accion}:${r.uuidOriginal}`}><p>Actor original {r.actorId} · {r.uuidOriginal} · {r.accion} · {r.state}</p>
      {session?.identity.rolBase === "ADMIN" && session.identity.perfil === null && session.identity.capacidades.includes("FISCAL_LEER") && <E11RecoveryAdmin record={r} session={session} />}
    </div>)}
    <p>Los marcadores no se descartan por confirmación manual: requieren verificación autorizada del resultado. No hay reenvío automático ni botón para generar otro UUID.</p>
    {problem && <p>{problem}</p>}
  </aside>;
}

/** Only controller invokes this while gates ON; no legacy business reader here. */
export function E11SessionProvider({ user, children }: { user: CurrentUser; children: ReactNode }) {
  const client = useQueryClient();
  const available = useGetE11Disponibilidad({ query: { queryKey: getGetE11DisponibilidadQueryKey(), staleTime: 15000, refetchOnWindowFocus: "always", refetchOnReconnect: "always" } });
  const identity = useGetE11Identidad({ query: {
    queryKey: [...getGetE11IdentidadQueryKey(), user.id, user.rol],
    enabled: e11On() && available.data?.enabled === true, staleTime: 0,
    refetchOnMount: "always", refetchOnWindowFocus: "always", refetchOnReconnect: "always", refetchInterval: 15000, retry: false,
  } });
  const previous = useRef<string | null>(null);
  const current = useRef<string | null>(null);
  const retired = useRef(new Set<string>());
  const [privacyProblem, setPrivacyProblem] = useState("");
  const data = identity.data;
  const valid = data?.usuarioId === user.id && data.rolBase === user.rol
    && (user.rol === "CONTADOR" ? data.perfil === "A" || data.perfil === "F" : data.perfil === null);
  const key = valid && data ? e11IdentityKey(data) : null;
  current.current = key && !retired.current.has(key) && !identity.error && available.data?.enabled && identity.isFetchedAfterMount ? key : null;
  const purge = (oldKey?: string | null, retainKey?: string | null) => {
    const sensitive = (query: { queryKey: readonly unknown[] }) => {
      const path = String(query.queryKey[0]);
      return (!!oldKey && query.queryKey.includes(oldKey))
        || (user.rol === "CONTADOR" && !path.startsWith("/api/e11/") && path !== "/api/auth/me")
        || (!!oldKey && path.startsWith("/api/e5/"));
    };
    void client.cancelQueries({ predicate: sensitive });
    client.removeQueries({ predicate: sensitive });
    if (oldKey) client.getMutationCache().clear();
    try {
      for (const storage of [sessionStorage, localStorage]) {
        for (const name of Object.keys(storage)) {
          if (name.startsWith("e11-intencion:") && (oldKey ? name.includes(encodeURIComponent(oldKey)) : !retainKey || !name.includes(encodeURIComponent(retainKey)))) {
            try { e11Quarantine(storage, name); }
            catch { setPrivacyProblem("No se pudo completar cuarentena; escrituras bloqueadas. Solicita revisión ADMIN del registro de recuperación."); }
          }
          else if (name.startsWith("e11-resolver:") && (oldKey ? name.includes(encodeURIComponent(oldKey)) : !retainKey || !name.includes(encodeURIComponent(retainKey)))) storage.removeItem(name);
          else if (user.rol === "CONTADOR" && name.startsWith(`e5-intencion:${user.id}:`)) storage.removeItem(name);
        }
      }
    } catch { setPrivacyProblem("No se pudo limpiar almacenamiento sensible. Contabilidad bloqueada; habilita almacenamiento o cierra la sesión."); }
  };
  useLayoutEffect(() => {
    if (previous.current !== key) {
      if (previous.current) retired.current.add(previous.current);
      purge(previous.current, key);
      previous.current = key;
    }
  }, [key]);
  useLayoutEffect(() => () => { current.current = null; purge(previous.current); }, []);
  if (available.error || identity.error) return <><E11RecoveryNotice /><E11Error error={available.error || identity.error} /></>;
  if (privacyProblem) return <><E11RecoveryNotice /><E11Error error={privacyProblem} /></>;
  if (!available.data) return <p>Comprobando disponibilidad contable…</p>;
  if (!available.data.enabled) return <E11Error error="E11 está cerrado. No se utilizarán lectores legacy como alternativa." />;
  if (!data || !identity.isFetchedAfterMount) return <p>Verificando perfil y permisos contables…</p>;
  if (!valid || !key) return <><E11RecoveryNotice /><E11Error error="La identidad recibida no corresponde a la sesión. Datos bloqueados." /></>;
  if (retired.current.has(key)) return <><E11RecoveryNotice /><E11Error error="Identidad revocada. Espera su revalidación o inicia sesión nuevamente." /></>;
  const check = async () => {
    if (!e11On() || current.current !== key) throw new Error("Perfil/contexto revocado; conserva UUID en recuperación, sin reenviar ni mostrar contenido privado.");
    const fresh = await getE11Identidad();
    if (fresh.usuarioId !== user.id || fresh.rolBase !== user.rol || e11IdentityKey(fresh) !== key || current.current !== key) {
      retired.current.add(key);
      if (current.current === key) current.current = null;
      purge(key, current.current);
      void identity.refetch();
      throw new Error("PERFIL_CAMBIADO: perfil o permisos revocados. No se reenviará ni mostrará información anterior.");
    }
    return fresh;
  };
  const session = { identity: data, key, flags: available.data, check };
  // Sibling keys must be distinct so reconciliation deletes BOTH old scope trees.
  return <Context.Provider value={session}><E11RecoveryNotice key={`recovery:${key}`} session={session} /><div key={`business:${key}`}>{children}</div></Context.Provider>;
}