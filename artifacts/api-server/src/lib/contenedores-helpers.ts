export class ContenedorValidationError extends Error {}

const DAY_MS = 86_400_000;

export function calendarDayNumber(value: string): number {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) throw new ContenedorValidationError("Fecha inválida.");
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const result = Date.UTC(year, month - 1, day);
  const date = new Date(result);
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new ContenedorValidationError("Fecha inválida.");
  }
  return result / DAY_MS;
}

export function daysBetween(from: string, to: string): number {
  return calendarDayNumber(to) - calendarDayNumber(from);
}

export function mexicoCalendarDate(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

const ECONOMIC_KEYS = new Set([
  "costo",
  "costoTotal",
  "costoUnitario",
  "costoUnitarioReal",
  "costoPromedio",
  "participacion",
]);

export function redactEconomicData<T>(value: T): T {
  if (Array.isArray(value)) return value.map(redactEconomicData) as T;
  if (value && typeof value === "object") {
    const output: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value)) {
      if (!ECONOMIC_KEYS.has(key)) output[key] = redactEconomicData(child);
    }
    return output as T;
  }
  return value;
}

export function periodBounds(
  year: number,
  quarter?: number,
  semester?: number,
): { from: string; to: string } {
  if (quarter != null && semester != null) {
    throw new ContenedorValidationError(
      "Selecciona trimestre o semestre, no ambos.",
    );
  }
  const startMonth = quarter
    ? (quarter - 1) * 3 + 1
    : semester
      ? (semester - 1) * 6 + 1
      : 1;
  const months = quarter ? 3 : semester ? 6 : 12;
  const end = new Date(Date.UTC(year, startMonth - 1 + months, 0));
  return {
    from: `${year}-${String(startMonth).padStart(2, "0")}-01`,
    to: `${end.getUTCFullYear()}-${String(end.getUTCMonth() + 1).padStart(2, "0")}-${String(end.getUTCDate()).padStart(2, "0")}`,
  };
}

export function weightedUnitCost(quantity: number, cost: number): string | null {
  return quantity > 0 ? (cost / quantity).toFixed(4) : null;
}

export function canEditContenedor(
  estado: string,
  entradaId: number | null,
): boolean {
  return estado === "EN_TRANSITO" && entradaId == null;
}