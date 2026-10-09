export function parsePositiveQueryId(
  search: string | null | undefined,
  key: string,
): number | null {
  const raw = new URLSearchParams(search ?? undefined).get(key);
  if (!raw || !/^[1-9]\d*$/.test(raw)) return null;
  const id = Number(raw);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

export function parseOpaqueQueryId(
  search: string | null | undefined,
  key: string,
): string | null {
  const raw = new URLSearchParams(search ?? undefined).get(key);
  if (
    !raw
    || raw.trim() !== raw
    || /[\u0000-\u001f\u007f]/.test(raw)
  ) {
    return null;
  }
  return raw;
}

export function encodeOpaqueQueryId(id: string | number): string {
  return encodeURIComponent(String(id));
}

export function parseDateOnlyQuery(
  search: string | null | undefined,
  key: string,
): string | null {
  const raw = new URLSearchParams(search ?? undefined).get(key);
  if (!raw || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const [year, month, day] = raw.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day
    ? raw
    : null;
}

export function buildCorteListingHref({
  desde,
  hasta,
  ubicacionId,
  cajeroId,
}: {
  desde: string;
  hasta: string;
  ubicacionId?: number | null;
  cajeroId?: number | null;
}): string {
  const params = new URLSearchParams({ desde, hasta });
  if (ubicacionId != null && ubicacionId > 0) {
    params.set("ubicacionId", String(ubicacionId));
  }
  if (cajeroId != null && cajeroId > 0) {
    params.set("cajeroId", String(cajeroId));
  }
  return `/caja/cortes?${params.toString()}`;
}

export type ExactPageSelection<T> =
  | { kind: "found"; item: T }
  | { kind: "next-page"; page: number }
  | { kind: "not-found" };

/**
 * Selects an exact row from a paginated result without treating the first
 * page as the complete dataset.
 */
export function selectExactPageItem<T>(
  items: T[],
  targetId: string,
  currentPage: number,
  totalPages: number,
  getId: (item: T) => string,
): ExactPageSelection<T> {
  const item = items.find((candidate) => getId(candidate) === targetId);
  if (item) return { kind: "found", item };
  if (currentPage < totalPages) return { kind: "next-page", page: currentPage + 1 };
  return { kind: "not-found" };
}