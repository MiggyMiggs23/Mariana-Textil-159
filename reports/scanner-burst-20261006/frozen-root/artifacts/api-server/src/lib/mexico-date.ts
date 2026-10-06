const MEXICO_TIME_ZONE = "America/Mexico_City";

export type DateBoundary = "start" | "end";

const mexicoDateParts = new Intl.DateTimeFormat("en-US", {
  timeZone: MEXICO_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

function utcMillis(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  millisecond: number,
): number {
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  date.setUTCHours(hour, minute, second, millisecond);
  return date.getTime();
}

function mexicoOffsetMillis(instant: Date): number {
  const parts = Object.fromEntries(
    mexicoDateParts
      .formatToParts(instant)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)]),
  );

  return (
    utcMillis(
      parts.year,
      parts.month,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second,
      0,
    ) - Math.floor(instant.getTime() / 1000) * 1000
  );
}

function mexicoLocalToInstant(
  year: number,
  month: number,
  day: number,
  boundary: DateBoundary,
): Date {
  const hour = boundary === "start" ? 0 : 23;
  const minute = boundary === "start" ? 0 : 59;
  const second = boundary === "start" ? 0 : 59;
  const millisecond = boundary === "start" ? 0 : 999;
  const localMillis = utcMillis(
    year,
    month,
    day,
    hour,
    minute,
    second,
    millisecond,
  );

  let instantMillis = localMillis;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    instantMillis =
      localMillis - mexicoOffsetMillis(new Date(instantMillis));
  }

  return new Date(instantMillis);
}

/**
 * Parses an HTML date input (YYYY-MM-DD) as a business-day boundary in
 * America/Mexico_City.
 *
 * undefined means the query parameter was omitted; null means it was supplied
 * but malformed.
 */
export function parseMexicoDateQuery(
  value: unknown,
  boundary: DateBoundary,
): Date | null | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string" || value.length === 0) return null;

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }

  const calendarDate = new Date(0);
  calendarDate.setUTCFullYear(year, month - 1, day);
  calendarDate.setUTCHours(0, 0, 0, 0);
  if (
    calendarDate.getUTCFullYear() !== year ||
    calendarDate.getUTCMonth() !== month - 1 ||
    calendarDate.getUTCDate() !== day
  ) {
    return null;
  }

  return mexicoLocalToInstant(year, month, day, boundary);
}