import { useGetReporteSeccion, getGetReporteSeccionQueryKey } from "@workspace/api-client-react";
import { GenericReportRenderer } from "../generic-report-renderer";
import CajaComparativo from "@/pages/caja/comparativo";

export function VentasTab({ 
  apiParams, 
  isDateRangeValid, 
  isGlobal, 
  isAdmin 
}: { 
  apiParams: any; 
  isDateRangeValid: boolean; 
  isGlobal: boolean; 
  isAdmin: boolean;
}) {
  const { data, isLoading, isError, refetch } = useGetReporteSeccion("ventas", apiParams, {
    query: {
      enabled: isDateRangeValid,
      queryKey: getGetReporteSeccionQueryKey("ventas", apiParams)
    }
  });

  return (
    <div className="space-y-12">
      <GenericReportRenderer data={data} isLoading={isLoading} isError={isError} refetch={refetch} section="ventas" />
      
      {isGlobal && isAdmin && (
        <div className="pt-8 border-t border-border mt-8">
          <CajaComparativo embedded filters={{ periodo: apiParams.periodo || "personalizado", desde: apiParams.desde, hasta: apiParams.hasta }} />
        </div>
      )}
    </div>
  );
}
