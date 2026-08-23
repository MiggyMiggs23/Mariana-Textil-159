/**
 * Removes financial fields from response payloads visible to TERMINAL.
 *
 * The operation is recursive because inventory responses include costs in
 * nested entry lines and rollos. It returns a new value and never mutates the
 * object that was validated by the route response schema.
 */
export function omitTerminalSensitiveFields<T>(value: T, isTerminal: boolean): T {
  if (!isTerminal) return value;
  return omit(value) as T;
}

function isSensitiveKey(key: string): boolean {
  const normalized = key.replace(/[_\-\s]/g, "").toLowerCase();
  return (
    normalized.includes("costo") ||
    normalized.includes("margen") ||
    normalized.includes("utilidad")
  );
}

function omit(value: unknown): unknown {
  if (value == null || value instanceof Date || typeof value !== "object") {
    return value;
  }
  if (Array.isArray(value)) return value.map(omit);

  return Object.fromEntries(
    Object.entries(value).flatMap(([key, nestedValue]) =>
      isSensitiveKey(key) ? [] : [[key, omit(nestedValue)]],
    ),
  );
}