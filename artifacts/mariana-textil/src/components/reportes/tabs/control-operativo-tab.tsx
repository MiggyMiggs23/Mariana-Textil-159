import { useGetReporteSeccion, getGetReporteSeccionQueryKey } from "@workspace/api-client-react";
import { GenericReportRenderer } from "../generic-report-renderer";
import CajaDiferencias from "@/pages/caja/diferencias";

export function ControlOperativoTab({ 
  apiParams, 
  isDateRangeValid 
}: { 
  apiParams: any; 
  isDateRangeValid: boolean; 
}) {
  const { data, isLoading, isError, refetch } = useGetReporteSeccion("control-operativo", apiParams, {
    query: {
      enabled: isDateRangeValid,
      queryKey: getGetReporteSeccionQueryKey("control-operativo", apiParams)
    }
  });

  return (
    <div className="space-y-12">
      <div className="space-y-4">
        <CajaDiferencias embedded filters={{ desde: apiParams.desde, hasta: apiParams.hasta }} />
      </div>

      <div className="pt-8 border-t border-border space-y-4">
        <h2 className="text-xl font-bold tracking-tight text-sidebar">Alertas y Controles</h2>
        <GenericReportRenderer data={data} isLoading={isLoading} isError={isError} refetch={refetch} section="control-operativo" />
      </div>
    </div>
  );
}
