import type { GetAdminComparacionTiendasPeriodo } from "@workspace/api-client-react";

export type CajaComparativoFilters = {
  periodo?: string;
  desde: string;
  hasta: string;
};

export function buildCajaComparativoRequest(
  filters: CajaComparativoFilters | undefined,
  periodo: GetAdminComparacionTiendasPeriodo,
  desde: string,
  hasta: string,
) {
  if (filters) {
    return { periodo: "personalizado" as const, desde: filters.desde, hasta: filters.hasta };
  }
  if (periodo === "personalizado") {
    return { periodo, desde, hasta };
  }
  return { periodo };
}