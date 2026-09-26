import { useLayoutEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useE11Session, e11Error, e11On } from "@/lib/e11-session";
import { e11Recoveries, e11MarkRecovery, e11ClearRecovery, e11Action } from "@/lib/e11-recovery";
import type { E11IdentidadCapacidadesItem } from "@workspace/api-client-react";

export function useE11Intention() {
  const previous = useRef<{ body: string; uuid: string } | null>(null);
  return {
    uuid: (body: unknown) => {
      const normalized = JSON.stringify(body);
      if (previous.current?.body !== normalized) previous.current = { body: normalized, uuid: crypto.randomUUID() };
      return previous.current.uuid;
    },
    reset: () => { previous.current = null; },
  };
}

export function useE11Write<C extends { uuid: string }, R>(operation: string, capability: E11IdentidadCapacidadesItem,
  send: (command: C) => Promise<R>, verify: (command: C, retry: boolean) => Promise<void>,
  corresponding: (response: R, command: C) => boolean) {
  const session = useE11Session(), queryClient = useQueryClient();
  const lock = useRef(false), alive = useRef(true), settled = useRef(false);
  const saved = useRef<C | null>(null);
  const [pending, setPending] = useState<C | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [result, setResult] = useState<R | null>(null), [rejected, setRejected] = useState(0);
  const [storageError, setStorageError] = useState(false), [barrier, setBarrier] = useState(false);
  const key = `e11-intencion:${encodeURIComponent(session?.key ?? "closed")}:${operation}`;
  const matches = (r: ReturnType<typeof e11Recoveries>[number], uuid?: string) => r.actorId === session?.identity.usuarioId && r.accion === e11Action(operation) && r.uuidOriginal === uuid;
  useLayoutEffect(() => {
    alive.current = true;
    const inspect = () => {
      try {
        const records = e11Recoveries();
        if (saved.current && !records.some(r => matches(r, saved.current?.uuid))) { settled.current = true; saved.current = null; setPending(null); }
        setBarrier(records.some(r => !matches(r, saved.current?.uuid) || r.state !== "RESULTADO_INCIERTO"));
      }
      catch (e) { setStorageError(true); setError(e11Error(e)); }
    };
    try {
      const raw = sessionStorage.getItem(key);
      if (raw) {
        const record = JSON.parse(raw) as { scope: string; operation: string; command: C; confirmed?: boolean };
        if (record.scope !== session?.key || record.operation !== operation || !/^[0-9a-f-]{36}$/i.test(record.command?.uuid)) throw new Error("Intención guardada inválida; requiere recuperación ADMIN.");
        saved.current = record.command; setPending(record.command);
        settled.current = record.confirmed === true;
        // Upgrade earlier persisted uncertain intentions before any possible retry.
        if (!e11Recoveries().some(r => matches(r, record.command.uuid))) e11MarkRecovery(record.command.uuid, operation, record.confirmed ? "CONFIRMED" : "RESULTADO_INCIERTO", session!.identity.usuarioId);
      }
      inspect();
    } catch (e) { setStorageError(true); setError(e11Error(e)); }
    window.addEventListener("e11-recovery", inspect); window.addEventListener("storage", inspect);
    return () => { alive.current = false; saved.current = null; window.removeEventListener("e11-recovery", inspect); window.removeEventListener("storage", inspect); };
  }, [key]);
  const run = async (command: C, retry = false) => {
    if (!e11On() || !session || lock.current || settled.current || storageError || (!retry && saved.current)) return;
    lock.current = true; setBusy(true); setError("");
    const previouslyUncertain = !!saved.current;
    let sent = false, accepted = false;
    try {
      const records = e11Recoveries();
      if (records.some(r => !matches(r, command.uuid) || r.state !== "RESULTADO_INCIERTO")
        || (retry && !records.some(r => matches(r, command.uuid)))
        || (retry && (!saved.current || JSON.stringify(saved.current) !== JSON.stringify(command))))
        throw new Error("Recuperación pendiente: conserva el UUID original y solicita revisión ADMIN; no se permite otra intención.");
      const identity = await session.check();
      if (!identity.capacidades.includes(capability)) throw new Error("Capacidad revocada; recuperación sólo con autorización vigente.");
      await verify(command, retry); await session.check();
      if (!alive.current) return;
      if (e11Recoveries().some(r => !matches(r, command.uuid) || r.state !== "RESULTADO_INCIERTO")) throw new Error("Otra operación requiere recuperación. No se enviará una nueva intención.");
      // Both writes must succeed before sending. Failure cannot become a POST.
      sessionStorage.setItem(key, JSON.stringify({ scope: session.key, operation, command }));
      saved.current = command; setPending(command);
      e11MarkRecovery(command.uuid, operation, "RESULTADO_INCIERTO", session.identity.usuarioId);
      sent = true;
      const response = await send(command);
      await session.check();
      if (!alive.current) return;
      if (!corresponding(response, command)) throw new Error("Respuesta no correspondiente; conserva UUID y solicita recuperación.");
      accepted = true; settled.current = true;
      // Commit knowledge before refresh; refresh failure never permits a second write.
      sessionStorage.setItem(key, JSON.stringify({ scope: session.key, operation, command, confirmed: true }));
      e11MarkRecovery(command.uuid, operation, "CONFIRMED", session.identity.usuarioId);
      setResult(response);
      await queryClient.invalidateQueries({ predicate: q => /^\/api\/(e11|e5|notificaciones)/.test(String(q.queryKey[0])) }, { throwOnError: true });
      await session.check();
      if (!alive.current) return;
      sessionStorage.removeItem(key); e11ClearRecovery(command.uuid, operation, session.identity.usuarioId);
      saved.current = null; setPending(null);
    } catch (e) {
      if (!alive.current) return;
      if (accepted) { setError(`Resultado confirmado; recuperación/actualización pendiente. No volver a enviar UUID ${command.uuid}. ${e11Error(e)}`); return; }
      const { status, data } = e as { status?: number; data?: { code?: string; uuid?: string } };
      const special = data?.code === "RESULTADO_CONFIRMADO_NO_CONSULTABLE" || data?.code === "RESULTADO_INCIERTO";
      if (special) {
        try {
          if (data?.uuid && data.uuid !== command.uuid) throw new Error("UUID de respuesta ajeno; conservar intención original.");
          e11MarkRecovery(command.uuid, operation, data.code as "RESULTADO_CONFIRMADO_NO_CONSULTABLE" | "RESULTADO_INCIERTO", session.identity.usuarioId);
        } catch (storageFailure) { setStorageError(true); setError(e11Error(storageFailure)); return; }
      }
      // A replay rejection says nothing about the effect of its ORIGINAL attempt.
      const noEffectCodes = ["VALIDACION", "NO_AUTENTICADO", "E11_DISABLED", "PERFIL_DENEGADO", "PERMISO_DENEGADO", "ADMIN_REQUERIDO", "E5_DISABLED", "NO_ENCONTRADO", "REVISION_OBSOLETA", "PERFIL_CAMBIADO", "FUENTE_CAMBIADA", "PERIODO_ABIERTO", "ESTADO_INVALIDO", "NOTA_SIN_SALDO", "IMPORTE_NO_COINCIDE", "USUARIO_NO_CONTADOR"];
      const definitiveFirstRejection = sent && !previouslyUncertain && !special && status !== undefined && status >= 400 && status < 500 && noEffectCodes.includes(data?.code ?? "");
      if (definitiveFirstRejection) {
        try {
          saved.current = null; setPending(null);
          sessionStorage.removeItem(key); e11ClearRecovery(command.uuid, operation, session.identity.usuarioId);
          setRejected(v => v + 1);
        } catch (storageFailure) { setStorageError(true); setError(e11Error(storageFailure)); return; }
      } else if (!sent && !saved.current && !previouslyUncertain) setRejected(v => v + 1);
      if (!sent && saved.current && !previouslyUncertain) setStorageError(true);
      void queryClient.invalidateQueries({ predicate: q => String(q.queryKey[0]).startsWith("/api/e11/") });
      setError(`${e11Error(e)} ${definitiveFirstRejection ? "Primer rechazo definitivo: revisa fuente y confirma nueva intención." : `Conserva UUID ${command.uuid}. No crear otra preparación; reintento exacto autorizado o recuperación ADMIN.`}`);
    } finally { lock.current = false; if (alive.current) setBusy(false); }
  };
  return { run, retry: () => saved.current && run(saved.current, true), pending, busy, error, result, rejected,
    blocked: busy || !!pending || storageError || barrier || settled.current };
}