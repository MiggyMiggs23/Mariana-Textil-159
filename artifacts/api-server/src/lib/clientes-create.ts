export type ClientCreditTerms =
  | { ok: true; limiteCredito: string; diasCredito: number }
  | { ok: false; error: string };

export const ACTIVE_CLIENT_NAME_UNIQUE_INDEX =
  "clientes_activos_no_sistema_nombre_normalizado_uidx";

export function normalizedClientName(nombre: string): string {
  return nombre.trim().toLocaleLowerCase("es-MX");
}

export function isActiveNonSystemNameConflict(
  error: unknown,
): boolean {
  if (!error || typeof error !== "object") return false;
  const pgError = error as { code?: unknown; constraint?: unknown };
  return (
    pgError.code === "23505" &&
    pgError.constraint === ACTIVE_CLIENT_NAME_UNIQUE_INDEX
  );
}

export function parseClientCreditTerms(
  limiteCredito: unknown,
  diasCredito: unknown,
): ClientCreditTerms {
  const hasLimit =
    limiteCredito !== undefined && limiteCredito !== null && limiteCredito !== "";
  const parsedLimit = hasLimit ? Number(limiteCredito) : 0;
  const parsedDays =
    diasCredito === undefined || diasCredito === null || diasCredito === ""
      ? null
      : Number(diasCredito);

  if (hasLimit && (!Number.isFinite(parsedLimit) || parsedLimit < 0)) {
    return {
      ok: false,
      error: "El límite de crédito debe ser un importe válido.",
    };
  }
  if (hasLimit && (!Number.isInteger(parsedDays) || parsedDays! < 0)) {
    return {
      ok: false,
      error:
        "Los días de crédito son obligatorios al capturar un límite de crédito.",
    };
  }
  if (!hasLimit && parsedDays !== null) {
    return {
      ok: false,
      error: "Captura un límite de crédito para asignar días de crédito.",
    };
  }
  return {
    ok: true,
    limiteCredito: hasLimit ? parsedLimit.toFixed(2) : "0.00",
    diasCredito: hasLimit ? parsedDays! : 0,
  };
}