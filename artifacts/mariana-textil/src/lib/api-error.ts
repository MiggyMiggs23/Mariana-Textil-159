function stringField(value: unknown, key: string): string | undefined {
  if (!value || typeof value !== "object") return undefined;
  const candidate = (value as Record<string, unknown>)[key];
  if (typeof candidate !== "string") return undefined;
  const trimmed = candidate.trim();
  return trimmed || undefined;
}

function cleanMessage(message: string): string {
  return message
    .replace(/^HTTP\s+\d{3}(?:\s+[^:]+)?:\s*/i, "")
    .trim();
}

export function getApiErrorMessage(
  error: unknown,
  fallback = "No se pudo completar la operación.",
): string {
  if (!error || typeof error !== "object") return fallback;

  const record = error as Record<string, unknown>;
  const data = record.data;
  const message =
    stringField(data, "error") ??
    stringField(data, "message") ??
    stringField(error, "error") ??
    stringField(error, "message");

  if (!message || /<!doctype|<html/i.test(message)) return fallback;
  return cleanMessage(message) || fallback;
}