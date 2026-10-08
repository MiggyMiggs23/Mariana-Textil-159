export type LocationsListDecision =
  | { ok: true; includeInactive: boolean }
  | { ok: false; status: 400 | 403; error: string };

/**
 * Resolves the optional administrative catalog mode at the request boundary.
 *
 * The default is deliberately active-only.  The broader catalog is not a new
 * permission: it is an explicit ADMIN-only mode after the existing
 * `ubicaciones.ver` permission has already run.
 */
export function resolveLocationsListDecision(
  rawIncludeInactive: unknown,
  role: string,
): LocationsListDecision {
  const values = Array.isArray(rawIncludeInactive)
    ? rawIncludeInactive
    : [rawIncludeInactive];

  if (values.length > 1) {
    return {
      ok: false,
      status: 400,
      error: "El parámetro includeInactive solo puede aparecer una vez.",
    };
  }

  const value = values[0];
  if (value === undefined) {
    return { ok: true, includeInactive: false };
  }
  if (value !== "true" && value !== "false") {
    return {
      ok: false,
      status: 400,
      error: "includeInactive debe ser booleano.",
    };
  }

  const includeInactive = value === "true";
  if (includeInactive && role !== "ADMIN") {
    return {
      ok: false,
      status: 403,
      error: "Solo ADMIN puede consultar ubicaciones inactivas.",
    };
  }

  return { ok: true, includeInactive };
}