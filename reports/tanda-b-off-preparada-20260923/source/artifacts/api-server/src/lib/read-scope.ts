import type { AuthContext } from "../middlewares/auth";

/** Canonical policy formerly housed in routes/inventario; no behavior change. */
export function resolveReadScope(
  auth: AuthContext,
  requestedUbicacionId?: number,
): { ubicacionId: number | null | undefined; scopeError: string | null } {
  const alcance = auth.user.alcanceConsulta;
  const assigned = auth.user.ubicacionId;
  if (auth.user.rol === "ADMIN" || auth.user.rol === "SUPERVISOR") {
    return { ubicacionId: requestedUbicacionId, scopeError: null };
  }
  if (auth.user.rol === "CAJA") {
    return assigned == null
      ? { ubicacionId: null, scopeError: "No tienes una ubicación asignada." }
      : { ubicacionId: assigned, scopeError: null };
  }
  if (alcance === "TODAS") return { ubicacionId: requestedUbicacionId, scopeError: null };
  if (assigned == null) {
    return { ubicacionId: null, scopeError: "No tienes una ubicación asignada." };
  }
  return { ubicacionId: assigned, scopeError: null };
}