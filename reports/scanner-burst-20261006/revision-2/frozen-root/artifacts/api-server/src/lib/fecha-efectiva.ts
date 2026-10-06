const FECHA_EFECTIVA_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,9}))?(Z|[+-]\d{2}:\d{2})$/;

export const FECHA_EFECTIVA_ERROR_MESSAGE =
  "El campo fechaEfectiva debe incluir fecha, hora y desplazamiento explícito (RFC 3339); no se acepta una fecha YYYY-MM-DD ni una fecha sin zona horaria.";

export class FechaEfectivaValidationError extends Error {
  readonly statusCode = 400;

  constructor(message = FECHA_EFECTIVA_ERROR_MESSAGE) {
    super(message);
    this.name = "FechaEfectivaValidationError";
  }
}

function isValidCalendarDate(year: number, month: number, day: number): boolean {
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;

  const calendarDate = new Date(0);
  calendarDate.setUTCFullYear(year, month - 1, day);
  calendarDate.setUTCHours(0, 0, 0, 0);

  return (
    calendarDate.getUTCFullYear() === year &&
    calendarDate.getUTCMonth() === month - 1 &&
    calendarDate.getUTCDate() === day
  );
}

/**
 * Validates and parses the raw HTTP value before any zod `coerce.date()`.
 *
 * `null` and `undefined` deliberately mean "use the server's current instant".
 * A non-empty value must be a complete RFC 3339 date-time with an explicit
 * `Z` or numeric offset. In particular, a date-only value is never inferred
 * as UTC or as the server's local time.
 */
export function parseFechaEfectiva(
  rawFechaEfectiva: unknown,
  now: Date = new Date(),
): Date {
  if (rawFechaEfectiva === null || rawFechaEfectiva === undefined) {
    return new Date(now.getTime());
  }

  if (typeof rawFechaEfectiva !== "string") {
    throw new FechaEfectivaValidationError();
  }

  const match = FECHA_EFECTIVA_PATTERN.exec(rawFechaEfectiva);
  if (!match) {
    throw new FechaEfectivaValidationError();
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);
  const offset = match[8];

  if (
    !isValidCalendarDate(year, month, day) ||
    hour > 23 ||
    minute > 59 ||
    second > 59
  ) {
    throw new FechaEfectivaValidationError();
  }

  if (offset !== "Z") {
    const offsetHour = Number(offset.slice(1, 3));
    const offsetMinute = Number(offset.slice(4, 6));
    if (offsetHour > 23 || offsetMinute > 59) {
      throw new FechaEfectivaValidationError();
    }
  }

  const parsed = new Date(rawFechaEfectiva);
  if (Number.isNaN(parsed.getTime())) {
    throw new FechaEfectivaValidationError();
  }

  return parsed;
}