import type { E11OperacionAccion, E11OperacionRecuperacion } from "@workspace/api-client-react";
/** Original namespace only, never financial IDs or revoked A payload. */
export type E11Recovery = { actorId: number; accion: E11OperacionAccion; uuidOriginal: string; state: "RESULTADO_INCIERTO" | "RESULTADO_CONFIRMADO_NO_CONSULTABLE" | "QUARANTINE" | "CONFIRMED" };
export const E11_RECOVERY_PREFIX = "e11-recovery:";
export const e11Action = (operation: string) => {
  const action = operation.split(":")[0].toUpperCase();
  if (!["PERFIL", "SNAPSHOT", "DECISION", "PREPARACION"].includes(action)) throw new Error("Acción de recuperación inválida.");
  return action as E11OperacionAccion;
};
export const e11RecoveryKey = (r: Pick<E11Recovery, "actorId" | "accion" | "uuidOriginal">) => `${E11_RECOVERY_PREFIX}${r.actorId}:${r.accion}:${r.uuidOriginal}`;
export const e11SameRecovery = (a: Pick<E11Recovery, "actorId" | "accion" | "uuidOriginal">, b: Pick<E11Recovery, "actorId" | "accion" | "uuidOriginal">) =>
  a.actorId === b.actorId && a.accion === b.accion && a.uuidOriginal === b.uuidOriginal;
export function e11Recoveries(): E11Recovery[] {
  return Object.keys(localStorage).filter(k => k.startsWith(E11_RECOVERY_PREFIX)).map(k => {
    const r = JSON.parse(localStorage.getItem(k)!) as E11Recovery;
    if (!r || !Number.isInteger(r.actorId) || r.actorId <= 0 || r.actorId > 2147483647 || k !== e11RecoveryKey(r)
      || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(r.uuidOriginal)
      || e11Action(r.accion) !== r.accion
      || !["RESULTADO_INCIERTO", "RESULTADO_CONFIRMADO_NO_CONSULTABLE", "QUARANTINE", "CONFIRMED"].includes(r.state)) throw new Error("Registro sin terna original verificable; no inferir actor ADMIN ni liberar. Solicita revisión del registro.");
    return { actorId: r.actorId, accion: r.accion, uuidOriginal: r.uuidOriginal, state: r.state };
  });
}
export function e11MarkRecovery(uuid: string, operation: string, state: E11Recovery["state"], actorId: number) {
  const record: E11Recovery = { actorId, accion: e11Action(operation), uuidOriginal: uuid.toLowerCase(), state };
  if (!Number.isInteger(actorId) || actorId <= 0) throw new Error("Falta actor original.");
  localStorage.setItem(e11RecoveryKey(record), JSON.stringify(record));
  window.dispatchEvent(new Event("e11-recovery"));
}
export function e11ClearRecovery(uuid: string, operation: string, actorId: number) {
  localStorage.removeItem(e11RecoveryKey({ actorId, accion: e11Action(operation), uuidOriginal: uuid.toLowerCase() }));
  window.dispatchEvent(new Event("e11-recovery"));
}
export function e11Quarantine(storage: Storage, key: string) {
  try {
    const record = JSON.parse(storage.getItem(key)!);
    const actorId = JSON.parse(record.scope)[0];
    if (!record?.command?.uuid || !record.operation) throw new Error("Intención sin terna de recuperación.");
    e11MarkRecovery(record.command.uuid, record.operation, record.confirmed ? "RESULTADO_CONFIRMADO_NO_CONSULTABLE" : "QUARANTINE", actorId);
  } finally { storage.removeItem(key); }
}
export function e11AssertRecovery(r: E11OperacionRecuperacion, expected: E11Recovery) {
  if (!r || !e11SameRecovery(r, expected) || !/^[a-f0-9]{64}$/.test(r.revision)
    || !["PENDIENTE", "CONFIRMADA", "CERRADA_SIN_EFECTO"].includes(r.estado)
    || (r.resolucionId === null ? r.resueltoEn !== null : !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(r.resolucionId) || !r.resueltoEn || !Number.isFinite(Date.parse(r.resueltoEn)))
    || (r.estado === "PENDIENTE" && r.resolucionId !== null)) throw new Error("Respuesta de recuperación ajena a la terna original o inválida.");
}
export function e11ApplyResolution(expected: E11Recovery, r: E11OperacionRecuperacion) {
  e11AssertRecovery(r, expected);
  if (!["CONFIRMADA", "CERRADA_SIN_EFECTO"].includes(r.estado) || !r.resolucionId
    || !/^[a-f0-9-]{36}$/i.test(r.resolucionId) || !r.resueltoEn || !Number.isFinite(Date.parse(r.resueltoEn))) return false;
  // Remove only payloads whose ORIGINAL namespace corresponds to verified terminal metadata.
  for (const storage of [sessionStorage, localStorage]) for (const key of Object.keys(storage)) {
    if (!key.startsWith("e11-intencion:")) continue;
    let record;
    try {
      record = JSON.parse(storage.getItem(key)!);
      if (JSON.parse(record.scope)[0] !== expected.actorId || e11Action(record.operation) !== expected.accion || record.command?.uuid !== expected.uuidOriginal) continue;
    } catch { continue; } // An unrelated corrupt intention never authorizes deletion or blocks this exact terminal namespace.
    storage.removeItem(key);
  }
  localStorage.removeItem(e11RecoveryKey(expected));
  window.dispatchEvent(new CustomEvent("e11-resolved", { detail: { actorId: r.actorId, accion: r.accion, uuidOriginal: r.uuidOriginal, estado: r.estado, resolucionId: r.resolucionId } }));
  window.dispatchEvent(new Event("e11-recovery"));
  return true;
}