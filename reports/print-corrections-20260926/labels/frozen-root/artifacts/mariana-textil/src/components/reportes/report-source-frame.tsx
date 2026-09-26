import {
  getGetReporteSeccionQueryKey,
  useGetReporteSeccion,
} from "@workspace/api-client-react";
import { GenericReportRenderer } from "./generic-report-renderer";

export type ReportSourceSection =
  | "ventas"
  | "utilidad"
  | "inventario"
  | "mapas-calor"
  | "color"
  | "compras"
  | "clientes"
  | "pagos-dirigidos"
  | "control-operativo";

export type ReportComparisonFrame = {
  siteId: number;
  siteLabel: string;
  apiParams: Record<string, unknown>;
};

export function ReportSourceFrame({
  section,
  apiParams,
  isDateRangeValid,
  siteLabel,
}: {
  section: ReportSourceSection;
  apiParams: Record<string, unknown>;
  isDateRangeValid: boolean;
  siteLabel: string;
}) {
  const { data, isLoading, isError, refetch } = useGetReporteSeccion(section, apiParams, {
    query: {
      enabled: isDateRangeValid,
      queryKey: getGetReporteSeccionQueryKey(section, apiParams),
    },
  });

  return (
    <section className="space-y-4 rounded-xl border border-border/70 bg-card/40 p-4">
      <h2 className="text-xl font-bold tracking-tight text-sidebar">{siteLabel}</h2>
      <GenericReportRenderer
        data={data}
        isLoading={isLoading}
        isError={isError}
        refetch={refetch}
        section={`${section}-${siteLabel}`}
      />
    </section>
  );
}