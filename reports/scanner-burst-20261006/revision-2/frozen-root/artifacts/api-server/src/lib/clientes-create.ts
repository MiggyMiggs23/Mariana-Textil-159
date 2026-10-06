import { isPostgresUniqueViolation } from "./postgres-errors";

export type ClientCreditTerms =
  | { ok: true; limiteCredito: string; diasCredito: number }
  | { ok: false; error: string };

export const ACTIVE_CLIENT_NAME_UNIQUE_INDEX =
  "clientes_activos_no_sistema_nombre_normalizado_uidx";

export const CLIENT_CREDIT_TERMS = [0, 7, 15, 30, 60] as const;

export function isClientCreditTerm(value: unknown): value is (typeof CLIENT_CREDIT_TERMS)[number] {
  return (
    typeof value === "number" &&
    CLIENT_CREDIT_TERMS.includes(value as (typeof CLIENT_CREDIT_TERMS)[number])
  );
}

export function normalizedClientName(nombre: string): string {
  return nombre.trim().toLocaleLowerCase("es-MX");
}

export function isActiveNonSystemNameConflict(
  error: unknown,
): boolean {
  return isPostgresUniqueViolation(error, ACTIVE_CLIENT_NAME_UNIQUE_INDEX);
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
      : diasCredito;

  if (hasLimit && (!Number.isFinite(parsedLimit) || parsedLimit < 0)) {
    return {
      ok: false,
      error: "El límite de crédito debe ser un importe válido.",
    };
  }
  if (parsedDays !== null && !isClientCreditTerm(parsedDays)) {
    return {
      ok: false,
      error: "Los días de crédito deben ser 0, 7, 15, 30 o 60.",
    };
  }
  return {
    ok: true,
    limiteCredito: hasLimit ? parsedLimit.toFixed(2) : "0.00",
    diasCredito: parsedDays ?? 0,
  };
}