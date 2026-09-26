/**
 * Report links are navigation hints supplied by the report API. They are
 * deliberately limited to application-relative paths before they reach
 * wouter: reports must never turn data returned by the API into an external
 * or script URL.
 */
export function isSafeInternalReportHref(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const href = value.trim();
  return href === value
    && href.length > 0
    && href.startsWith("/")
    && !href.startsWith("//")
    && !href.includes("\\")
    && !/[\u0000-\u001f\u007f]/.test(href);
}

function ownRowValue(row: Record<string, unknown>, key: unknown): unknown {
  if (typeof key !== "string" || !Object.prototype.hasOwnProperty.call(row, key)) {
    return undefined;
  }
  return row[key];
}

/**
 * `hrefKey` is the explicit contract for a drill-down. The legacy aliases
 * remain supported for reports that predate that metadata, but all candidates
 * go through the same internal-href validation.
 */
export function getReportTableHref(
  row: Record<string, unknown>,
  col: Record<string, unknown>,
): string | null {
  const candidates: unknown[] = [];
  if (typeof col.hrefKey === "string") {
    candidates.push(ownRowValue(row, col.hrefKey));
  }
  candidates.push(
    ownRowValue(row, `${String(col.key)}Url`),
    ownRowValue(row, `${String(col.key)}Enlace`),
  );
  if (["folio", "ticket", "documento", "id"].includes(String(col.key))) {
    candidates.push(ownRowValue(row, "url"), ownRowValue(row, "enlace"));
  }
  // Legacy link columns used the column's own value as the URL. Never show
  // that value as text: a link column is rendered as "Ver documento".
  if (col.kind === "link") {
    candidates.push(ownRowValue(row, col.key));
  }
  return candidates.find(isSafeInternalReportHref) ?? null;
}