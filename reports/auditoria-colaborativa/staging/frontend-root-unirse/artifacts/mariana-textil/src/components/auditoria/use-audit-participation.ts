import { useCallback, useEffect, useRef, useState } from "react";
import { customFetch } from "@workspace/api-client-react";

export const AUDIT_HEARTBEAT_MS = 20_000;

type Lease = {
  participantesActivos: number;
  maxParticipantes: number;
  expiracionSegundos: number;
  expiraAt: string;
};

export function auditParticipantLimit(error: unknown): boolean {
  return !!error && typeof error === "object" && "data" in error
    && (error as { data?: { code?: string } }).data?.code === "AUDIT_PARTICIPANT_LIMIT";
}

export function useAuditParticipation(id: number | null, userId: number | null, eligible: boolean) {
  const key = eligible && id && userId ? `${userId}:${id}` : null;
  const [session, setSession] = useState<{ key: string; lease: Lease | null; error: unknown; joining: boolean } | null>(null);
  const current = useRef<string | null>(null);
  const latestSession = useRef(session);
  const busy = useRef(new Set<string>());
  const [now, setNow] = useState(() => Date.now());

  // The ref is checked both before dispatch and after response: a previous audit's
  // late heartbeat may never authorize scans for the newly selected audit/user.
  current.current = key;
  latestSession.current = session;
  const join = useCallback(async () => {
    if (!key || !id || busy.current.has(key)) return;
    busy.current.add(key);
    setSession((previous) => ({
      key, lease: previous?.key === key ? previous.lease : null,
      error: null, joining: true,
    }));
    try {
      const lease = await customFetch<Lease>(`/api/inventario/auditorias/${id}/participar`, { method: "POST" });
      if (current.current === key) {
        setNow(Date.now());
        const admitted = { key, lease, error: null, joining: false };
        latestSession.current = admitted;
        setSession(admitted);
      }
    } catch (error) {
      if (current.current === key) {
        const blocked = { key, lease: null, error, joining: false };
        latestSession.current = blocked;
        setSession(blocked);
      }
    } finally {
      busy.current.delete(key);
    }
  }, [key, id]);

  useEffect(() => {
    if (!key) return;
    void join();
    // Intentionally keep renewing in background tabs. Browser timer throttling may
    // expire the lease; the expiration check below disables scans until renewal.
    const heartbeat = window.setInterval(() => { void join(); }, AUDIT_HEARTBEAT_MS);
    const clock = window.setInterval(() => setNow(Date.now()), 1000);
    return () => {
      window.clearInterval(heartbeat);
      window.clearInterval(clock);
    };
  }, [key, join]);

  const active = !!key && session?.key === key && !!session.lease
    && Number.isFinite(Date.parse(session.lease.expiraAt))
    && Date.parse(session.lease.expiraAt) > now;

  const reject = useCallback((error: unknown) => {
    if (key) {
      const blocked = { key, lease: null, error, joining: false };
      latestSession.current = blocked;
      setSession(blocked);
    }
  }, [key]);
  const isValid = useCallback(() => {
    const lease = latestSession.current?.key === key ? latestSession.current.lease : null;
    return !!key && !!lease && Number.isFinite(Date.parse(lease.expiraAt))
      && Date.parse(lease.expiraAt) > Date.now();
  }, [key]);

  return {
    active,
    joining: !!key && (session?.key !== key || session.joining),
    error: session?.key === key ? session.error : null,
    expired: !!key && session?.key === key && !!session.lease && !active,
    retry: join,
    reject,
    isValid,
  };
}