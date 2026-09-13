import type { CurrentUser, SalidaDetail } from "@workspace/api-client-react";
import { Modules } from "@/lib/permisos";

/**
 * The cancellation visibility rules intentionally use only the fields owned by
 * the generated salida DTO.  Keeping this Pick small prevents list rows from
 * growing a second, frontend-only representation of a salida.
 */
export type SalidaCancellationFacts = Pick<
  SalidaDetail,
  "estado" | "modalidad" | "origenId" | "destinoId"
>;

export type SalidaCancellationActor = Pick<
  CurrentUser,
  "rol" | "ubicacion" | "permisos"
>;

function canAuthorize(actor: SalidaCancellationActor): boolean {
  if (actor.rol === "ADMIN") return true;
  return Boolean(
    actor.permisos?.find(
      (permission) =>
        permission.modulo === Modules.SALIDAS && permission.puedeAutorizar,
    ),
  );
}

function isAtOrigin(
  actor: SalidaCancellationActor,
  salida: SalidaCancellationFacts,
): boolean {
  return actor.rol === "ADMIN" || actor.ubicacion?.id === salida.origenId;
}

function isAtDestination(
  actor: SalidaCancellationActor,
  salida: SalidaCancellationFacts,
): boolean {
  return (
    actor.rol === "ADMIN" || actor.ubicacion?.id === salida.destinoId
  );
}

/**
 * This is the legacy detail predicate from salida-detail.tsx.  It is kept
 * separate from the history predicate because changing the existing detail
 * role behavior would be unrelated to the direct history action.
 */
export function canCancelSalidaDetail(
  salida: SalidaCancellationFacts,
  actor: SalidaCancellationActor | null | undefined,
): boolean {
  if (!actor) return false;

  const authorized = canAuthorize(actor);
  const atOrigin = isAtOrigin(actor, salida);
  const atDestination = isAtDestination(actor, salida);

  return actor.rol !== "CAJA" && salida.modalidad === "VENTA_CLIENTE"
    ? salida.estado !== "ENTREGADA" &&
        salida.estado !== "CANCELADA" &&
        (actor.rol === "ADMIN" || (authorized && atOrigin))
    : salida.estado === "ARMANDO" &&
        (actor.rol === "ADMIN" ||
          (authorized && (atOrigin || atDestination)));
}

/**
 * History has the same state, permission, and site visibility as the detail
 * action, with the backend's unconditional CAJA prohibition made explicit.
 */
export function canCancelSalidaHistory(
  salida: SalidaCancellationFacts,
  actor: SalidaCancellationActor | null | undefined,
): boolean {
  if (!actor || actor.rol === "CAJA") return false;
  return canCancelSalidaDetail(salida, actor);
}