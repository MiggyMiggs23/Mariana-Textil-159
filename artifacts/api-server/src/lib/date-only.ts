/**
 * Returns the calendar label carried by a date-only database value.
 *
 * PostgreSQL DATE values are sometimes decoded by the database driver as a
 * Date at local midnight and sometimes remain strings (depending on the
 * query/schema path).  Calling toISOString() on the former can move the
 * label to the previous day in a positive-offset server timezone.  Date-only
 * fields are labels, not instants.  The two Date representations encountered
 * here are a UTC-midnight value (for example, a schema adapter's
 * `new Date("YYYY-MM-DD")`) and a local-midnight value (the pg DATE parser).
 * Preserve whichever midnight representation the caller supplied.
 */
export function calendarDate(value: string | Date): string {
  if (typeof value === "string") return value.slice(0, 10);
  const utcMidnight =
    value.getUTCHours() === 0 &&
    value.getUTCMinutes() === 0 &&
    value.getUTCSeconds() === 0 &&
    value.getUTCMilliseconds() === 0;
  const year = utcMidnight ? value.getUTCFullYear() : value.getFullYear();
  const month = utcMidnight ? value.getUTCMonth() + 1 : value.getMonth() + 1;
  const day = utcMidnight ? value.getUTCDate() : value.getDate();
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}