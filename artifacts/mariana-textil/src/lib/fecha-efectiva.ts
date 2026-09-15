const MEXICO_CITY_TIME_ZONE = "America/Mexico_City";

const dateTimeFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: MEXICO_CITY_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

const calendarDateFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: MEXICO_CITY_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

function utcMillis(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
): number {
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  date.setUTCHours(hour, minute, second, 0);
  return date.getTime();
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

function formatParts(date: Date): Record<string, number> {
  return Object.fromEntries(
    dateTimeFormatter
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)]),
  );
}

/**
 * Returns the Mexico City offset at an instant, without consulting the
 * browser's local timezone.
 */
function mexicoCityOffsetMinutes(instant: Date): number {
  const parts = formatParts(instant);
  const localAsUtc = utcMillis(
    parts.year,
    parts.month,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );

  return (localAsUtc - instant.getTime()) / 60_000;
}

function formatOffset(offsetMinutes: number): string {
  const sign = offsetMinutes < 0 ? "-" : "+";
  const absoluteMinutes = Math.abs(offsetMinutes);
  const hours = Math.floor(absoluteMinutes / 60);
  const minutes = absoluteMinutes % 60;
  return `${sign}${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function calendarParts(date: Date): Record<string, string> {
  return Object.fromEntries(
    calendarDateFormatter
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );
}

/**
 * Returns the current calendar date in the application's business timezone.
 * This is intentionally independent of the browser's local timezone.
 */
export function todayInMexicoCity(now: Date = new Date()): string {
  const parts = calendarParts(now);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

/**
 * Converts an HTML date-input value into a date-time carrying the actual
 * America/Mexico_City offset for that calendar day.
 *
 * Noon is used as the calendar intent; the offset is derived from Intl at the
 * target instant rather than guessed from the browser or hard-coded as Z.
 * Empty input preserves the server-now path by returning null.
 */
export function buildMexicoCityEffectiveDate(
  dateOnly: string | null | undefined,
): string | null {
  if (dateOnly === null || dateOnly === undefined || dateOnly === "") {
    return null;
  }

  const match = DATE_ONLY_PATTERN.exec(dateOnly);
  if (!match) {
    throw new RangeError("La fecha efectiva debe tener formato YYYY-MM-DD.");
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!isValidCalendarDate(year, month, day)) {
    throw new RangeError("La fecha efectiva no es válida.");
  }

  const localMillis = utcMillis(year, month, day, 12, 0, 0);
  let instantMillis = localMillis;

  // Iterating resolves the offset using the candidate instant itself. This is
  // safe around timezone rule changes and avoids assuming the browser's zone.
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const offsetMinutes = mexicoCityOffsetMinutes(new Date(instantMillis));
    const nextInstantMillis = localMillis - offsetMinutes * 60_000;
    if (nextInstantMillis === instantMillis) break;
    instantMillis = nextInstantMillis;
  }

  const offsetMinutes = mexicoCityOffsetMinutes(new Date(instantMillis));
  return `${dateOnly}T12:00:00${formatOffset(offsetMinutes)}`;
}