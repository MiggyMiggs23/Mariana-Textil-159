import { useGetReporteSeccion, getGetReporteSeccionQueryKey } from "@workspace/api-client-react";
import { GenericReportRenderer } from "../generic-report-renderer";
import CajaComparativo from "@/pages/caja/comparativo";
import { ReportSourceFrame } from "../report-source-frame";
import type { ReportComparisonFrame } from "../report-source-frame";

export function VentasTab({ 
  apiParams, 
  isDateRangeValid, 
  isGlobal, 
  isAdmin,
  comparisonMode = false,
  comparisonFrames = [],
}: { 
  apiParams: any; 
  isDateRangeValid: boolean; 
  isGlobal: boolean; 
  isAdmin: boolean;
  comparisonMode?: boolean;
  comparisonFrames?: ReportComparisonFrame[];
}) {
  const { data, isLoading, isError, refetch } = useGetReporteSeccion("ventas", apiParams, {
    query: {
      enabled: isDateRangeValid && !comparisonMode,
      queryKey: getGetReporteSeccionQueryKey("ventas", apiParams)
    }
  });

  return (
    <div className="space-y-12">
      {comparisonMode ? (
        <>
          {comparisonFrames.map((frame) => (
            <ReportSourceFrame
              key={frame.siteId}
              section="ventas"
              apiParams={frame.apiParams}
              isDateRangeValid={isDateRangeValid}
              siteLabel={frame.siteLabel}
            />
          ))}
        </>
      ) : (
        <GenericReportRenderer data={data} isLoading={isLoading} isError={isError} refetch={refetch} section="ventas" />
      )}
      
      {isGlobal && isAdmin && (
        <div className="pt-8 border-t border-border mt-8">
          {comparisonMode && (
            <div className="mb-4">
              <h2 className="text-xl font-bold tracking-tight text-sidebar">
                Comparativo legado de tiendas activas
              </h2>
              <p className="text-sm text-muted-foreground">
                Fuente X04 aprobada: compara las tiendas activas y no sustituye
                los reportes por sitio mostrados arriba.
              </p>
            </div>
          )}
          <CajaComparativo
            embedded
            filters={{
              periodo: "personalizado",
              desde: apiParams.desde,
              hasta: apiParams.hasta,
            }}
          />
        </div>
      )}
    </div>
  );
}
