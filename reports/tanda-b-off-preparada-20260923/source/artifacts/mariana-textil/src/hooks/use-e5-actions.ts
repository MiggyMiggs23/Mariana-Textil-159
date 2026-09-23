import { useLayoutEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useCreateE5Cobro, useCreateE5Propuesta, useAuthorizeE5Aplicacion,
  useRejectE5Propuesta, useReturnE5Cobro,
  useGetCurrentUser,
  getE5Disponibilidad, getE5Contexto, getE5Cobro, getE5DevolucionOpciones,
  type E5RecepcionInput, type E5PropuestaInput, type E5AutorizarInput,
  type E5RechazarInput, type E5DevolverInput, type E5Cobro,
} from "@workspace/api-client-react";
import { E5_ENABLED } from "@/lib/e5-feature-flags";
import { useE11Session } from "@/lib/e11-session";
import { e5AuthorizationContext, e5CanRead, e5CanReceive, e5CanPrepare, assertE5Context, assertE5Detail } from "@/lib/e5-authorization";

export type E5Command =
  | { kind: "recibir"; data: E5RecepcionInput }
  | { kind: "preparar"; id: string; data: E5PropuestaInput }
  | { kind: "autorizar"; id: string; data: E5AutorizarInput }
  | { kind: "rechazar"; id: string; data: E5RechazarInput }
  | { kind: "devolver"; id: string; data: E5DevolverInput };

function assertCommandScope(command: E5Command, scope: string) {
  const parts = scope.split(":");
  if (!command || !["recibir", "preparar", "autorizar", "rechazar", "devolver"].includes(command.kind)
    || !command.data || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(command.data.claveOperacion))
    throw new Error("Intención E5 guardada inválida. No se enviará ni se descartará; solicita revisión.");
  if (command.kind === "recibir") {
    if (parts[3] !== "recepcion" || command.data.ubicacionId !== Number(parts[1])
      || command.data.clienteId !== Number(parts[4]) || command.data.entrada !== parts[5])
      throw new Error("La intención no pertenece al sitio, cliente o entrada actuales.");
  } else if (parts[3] !== "detalle" || command.id !== parts[4] || !Number.isSafeInteger(command.data.revisionEsperada) || command.data.revisionEsperada < 1) {
    throw new Error("La intención no pertenece a esta recepción o no contiene revisión válida.");
  }
}

export function e5Error(error: unknown): string {
  const e = error as { data?: { error?: { message?: string; code?: string } }; message?: string };
  return e?.data?.error?.message
    ? `${e.data.error.code ?? "E5"}: ${e.data.error.message}`
    : e?.message || "No se pudo comprobar la operación. No se mostrará un saldo estimado.";
}

/** Canonical decimal arithmetic, never round a user's input to another amount. */
export function e5Cents(value: string): number {
  if (!/^\d{1,12}(?:\.\d{1,2})?$/.test(value.trim())) throw new Error("Importe inválido: usa hasta dos decimales.");
  const [whole, fraction = ""] = value.trim().split(".");
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(cents)) throw new Error("Importe fuera de rango.");
  return cents;
}
export const e5Decimal = (cents: number) => `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, "0")}`;

type Target = { site: number; client: number; id?: string };
function assertResponse(next: E5Cobro, command: E5Command, target: Target, actorId: number, before?: E5Cobro) {
  const mismatch = () => { throw new Error("Respuesta de mutación no corresponde a la recepción, cliente, sitio o actor solicitados. Se conserva la intención incierta; consulta a ADMIN, no generes otro cobro."); };
  const normalizedRows = (rows: E5PropuestaInput["asignaciones"]) => JSON.stringify(rows.map(a =>
    [a.movimientoVentaId, a.notaId, e5Cents(a.importe)]).sort((a, b) => a[0] - b[0]));
  if (!next || !next.id || next.clienteId !== target.client || next.ubicacionId !== target.site || !next.receptor) mismatch();
  if (command.kind === "recibir") {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(next.id) || next.receptor.id !== actorId
      || e5Cents(next.importeRecibido) !== e5Cents(command.data.importe)
      || next.formaPago !== command.data.formaPago || next.cuentaDestino !== command.data.cuentaDestino
      || next.sesionCajaId !== command.data.sesionCajaId || next.sesionOperativaId !== command.data.sesionOperativaId) mismatch();
    const docs = [...new Set(next.notasIndicadas.map(n => n.notaId))].sort((a, b) => a - b);
    if (JSON.stringify(docs) !== JSON.stringify([...command.data.notasIndicadas].sort((a, b) => a - b))) mismatch();
    if (command.data.aplicarAhora) {
      if (!next.aplicaciones.some(a => a.actor.id === actorId && normalizedRows(a.asignaciones) === normalizedRows(command.data.aplicarAhora!))) mismatch();
    } else if (e5Cents(next.importeAplicado) !== 0 || e5Cents(next.importePendiente) !== e5Cents(command.data.importe)) mismatch();
    return;
  }
  if (!before || next.id !== command.id || next.id !== target.id || next.receptor.id !== before.receptor.id
    || next.revision <= command.data.revisionEsperada) mismatch();
  if (command.kind === "preparar") {
    const proposal = next.propuestas.find(p => p.id === next.propuestaVigenteId);
    if (!proposal || proposal.actor.id !== actorId || normalizedRows(proposal.asignaciones) !== normalizedRows(command.data.asignaciones)
      || e5Cents(proposal.importeFavorPropuesto ?? "0") !== e5Cents(command.data.importeFavorPropuesto ?? "0")) mismatch();
  } else if (command.kind === "autorizar") {
    const application = next.aplicaciones.find(a => a.propuestaId === command.data.propuestaId && a.actor.id === actorId);
    if (!application || normalizedRows(application.asignaciones) !== normalizedRows(command.data.asignaciones)
      || e5Cents(application.importeFavorGenerado ?? "0") !== e5Cents(command.data.importeFavorAutorizado ?? "0")) mismatch();
  } else if (command.kind === "rechazar") {
    if (!next.rechazos.some(r => r.propuestaId === command.data.propuestaId && r.actor.id === actorId && r.motivo === command.data.motivo)) mismatch();
  } else if (!next.devolucion || next.devolucion.actor.id !== actorId || next.devolucion.peticionCliente !== command.data.peticionCliente
    || e5Cents(next.devolucion.importe) !== e5Cents(before!.importeRecibido)) mismatch();
}

/** Same normalized content keeps its UUID; changed content gets a new intention. */
export function useE5Identity() {
  const previous = useRef<{ content: string; key: string } | undefined>(undefined);
  return (content: unknown) => {
    const normalized = JSON.stringify(content);
    if (previous.current?.content !== normalized) previous.current = { content: normalized, key: crypto.randomUUID() };
    return previous.current.key;
  };
}

export function useE5Actions(scope: string, target: Target) {
  const e11 = useE11Session();
  const queryClient = useQueryClient();
  const user = useGetCurrentUser();
  const receive = useCreateE5Cobro();
  const prepare = useCreateE5Propuesta();
  const authorize = useAuthorizeE5Aplicacion();
  const reject = useRejectE5Propuesta();
  const refund = useReturnE5Cobro();
  const lock = useRef(false);
  const alive = useRef(true);
  const storageKey = `e5-intencion:${scope}`;
  const [pending, setPending] = useState<E5Command | null>(null);
  const pendingRef = useRef<E5Command | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<E5Cobro | null>(null);
  const [recoveryFailed, setRecoveryFailed] = useState(false);
  useLayoutEffect(() => {
    alive.current = true;
    try {
      const raw = sessionStorage.getItem(storageKey);
      if (raw) {
        const saved = JSON.parse(raw) as E5Command;
        assertCommandScope(saved, scope);
        pendingRef.current = saved;
        setPending(saved);
        setError("Hay una operación sin resultado confirmado. Reintenta la misma intención antes de continuar.");
      }
    } catch (err) { setRecoveryFailed(true); setError(e5Error(err)); }
    return () => { alive.current = false; };
  }, [storageKey]);

  const refresh = async () => {
    await queryClient.invalidateQueries({ predicate: q => {
      const key = q.queryKey[0];
      return typeof key === "string" && /^\/api\/(e5|clientes|tickets|caja|sesiones-caja|notificaciones|fondo|cobros)/.test(key);
    } });
  };
  const sendVerified = async (command: E5Command, retry: boolean, additionalReview?: () => Promise<void>) => {
    if (!E5_ENABLED || lock.current || recoveryFailed || (!retry && pendingRef.current)) return;
    lock.current = true;
    setBusy(true);
    setError("");
    setResult(null);
    let sent = false;
    try {
      assertCommandScope(command, scope);
      const actor = await user.refetch();
      const e11Identity = e11 ? await e11.check() : undefined;
      if (actor.error || !actor.data || String(actor.data.id) !== scope.split(":")[0]
        || e5AuthorizationContext(actor.data, e11Identity) !== scope.split(":")[2]) throw new Error("Cambió la identidad, rol o permisos. La intención incierta se conserva para consulta; no se reenviará dinero.");
      const adminAction = ["autorizar", "rechazar", "devolver"].includes(command.kind)
        || (command.kind === "recibir" && !!command.data.aplicarAhora)
        || (command.kind === "preparar" && !!command.data.importeFavorPropuesto);
      if (adminAction && actor.data.rol !== "ADMIN") throw new Error("Esta operación requiere ADMIN vigente.");
      if (!alive.current) return;
      // Mandatory authorization AND state verification on every send, including
      // recovered retries. A resolved/revoked operation is consulted, never sent
      // merely because an old UUID exists in sessionStorage.
      const availability = await getE5Disponibilidad({ ubicacionId: target.site });
      if (!availability.enabled || !e5CanRead(actor.data, availability.capacidades)) throw new Error("Disponibilidad/permisos revocados. Conserva la incertidumbre y solicita consulta ADMIN, sin reenvío.");
      const context = await getE5Contexto({ clienteId: target.client, ubicacionId: target.site });
      assertE5Context(context, target.client, target.site);
      let before: E5Cobro | undefined;
      if (command.kind === "recibir") {
        if (!e5CanReceive(actor.data, command.data.entrada) || !availability.capacidades.puedeRecibir || !context.capacidades.puedeRecibir)
          throw new Error("Recepción no autorizada por rol, permiso de entrada o capacidad vigente.");
        if (command.data.aplicarAhora && !context.capacidades.puedeAutorizar) throw new Error("Aplicación inmediata no autorizada.");
      } else {
        before = await getE5Cobro(command.id);
        assertE5Detail(before, target.id ?? "", target.site, target.client);
        const cap = command.kind === "preparar" ? "puedePreparar" : command.kind === "autorizar" ? "puedeAutorizar" : command.kind === "rechazar" ? "puedeRechazar" : "puedeDevolver";
        if (!before.capacidades[cap]) throw new Error("Capacidad ya no vigente. La operación incierta se conserva para consulta, sin reenviar.");
        if (command.kind === "preparar" && (!e5CanPrepare(actor.data, availability.capacidades)
          || !e5CanPrepare(actor.data, context.capacidades) || !e5CanPrepare(actor.data, before.capacidades)))
          throw new Error("Preparación exige ADMIN o capacidad futura A explícita vigente; un permiso genérico no la sustituye.");
        if (before.revision !== command.data.revisionEsperada) throw new Error("La revisión cambió. Consulta el resultado antes de cualquier reenvío; la intención se conserva.");
        if ("propuestaId" in command.data && before.propuestaVigenteId !== command.data.propuestaId) throw new Error("La propuesta ya no está vigente; no se reenvía.");
        if (command.kind === "devolver") {
          const options = await getE5DevolucionOpciones(command.id);
          if (before.algunaVezAplicado || !options.elegible || e5Cents(options.importe) !== e5Cents(before.importeRecibido)
            || !options.fuentes.some(f => JSON.stringify(f) === JSON.stringify(command.data.fuente)))
            throw new Error("La devolución o fuente no está vigente. No se reenvía.");
        }
      }
      if ("versionContexto" in command.data && context.versionContexto !== command.data.versionContexto)
        throw new Error("Contexto cambiado: no se reenviará una intención vieja. Consulta el resultado y revisa las notas.");
      if (!alive.current) return;
      if (additionalReview) await additionalReview();
      const lastActor = await user.refetch();
      const lastE11Identity = e11 ? await e11.check() : undefined;
      if (lastActor.error || !lastActor.data || lastActor.data.id !== actor.data.id
        || e5AuthorizationContext(lastActor.data, lastE11Identity) !== scope.split(":")[2])
        throw new Error("Autorización cambió durante la comprobación. No se envía; conserva la intención para consulta.");
      if (!alive.current) return;
      // Must persist before sending; a reload cannot silently create another collection.
      sessionStorage.setItem(storageKey, JSON.stringify(command));
      pendingRef.current = command;
      setPending(command);
      sent = true;
      let next: E5Cobro;
      switch (command.kind) {
        case "recibir": next = await receive.mutateAsync({ data: command.data }); break;
        case "preparar": next = await prepare.mutateAsync({ id: command.id, data: command.data }); break;
        case "autorizar": next = await authorize.mutateAsync({ id: command.id, data: command.data }); break;
        case "rechazar": next = await reject.mutateAsync({ id: command.id, data: command.data }); break;
        case "devolver": next = await refund.mutateAsync({ id: command.id, data: command.data }); break;
      }
      assertResponse(next, command, target, actor.data.id, before);
      sessionStorage.removeItem(storageKey);
      if (!alive.current) return;
      pendingRef.current = null;
      setPending(null);
      setResult(next);
      try { await refresh(); }
      catch (refreshError) { if (alive.current) setError(`Operación confirmada; no se pudo actualizar la consulta: ${e5Error(refreshError)}. No repitas el movimiento; actualiza la vista.`); }
    } catch (err) {
      if (!alive.current) return;
      const code = (err as { data?: { error?: { code?: string } } })?.data?.error?.code;
      // Only explicit contract rejections establish that no effect happened.
      // Conflicting UUIDs are NOT permission to discard and collect again.
      const definitive = !!code && [
        "E5_DISABLED", "E5_DEPENDENCY_DISABLED", "E5_FORBIDDEN", "E5_NOT_FOUND",
        "E5_VALIDATION", "E5_EXACT_REQUIRED", "E5_NOTA_STALE", "E5_VERSION_STALE",
        "E5_STATE_CONFLICT", "E5_ALREADY_APPLIED", "E5_REFUND_INELIGIBLE",
        "E5_SOURCE_UNAVAILABLE", "E5_INSUFFICIENT_FUNDS",
      ].includes(code);
      if (sent && definitive) {
        sessionStorage.removeItem(storageKey);
        pendingRef.current = null;
        setPending(null);
      }
      setError(`${e5Error(err)}${sent && !definitive ? " Resultado incierto: conserva y reintenta esta misma operación." : " Recarga datos y revisa de nuevo; no se cambiará el reparto automáticamente."}`);
      if (definitive) void refresh();
    } finally {
      lock.current = false;
      if (alive.current) setBusy(false);
    }
  };
  return { execute: (command: E5Command, additionalReview?: () => Promise<void>) => sendVerified(command, false, additionalReview),
    retry: () => pendingRef.current && sendVerified(pendingRef.current, true),
    pending, busy, error, result, blocked: busy || !!pending || recoveryFailed };
}