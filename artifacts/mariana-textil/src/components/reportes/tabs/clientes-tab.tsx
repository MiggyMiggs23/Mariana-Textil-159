import { useGetReporteSeccion, getGetReporteSeccionQueryKey } from "@workspace/api-client-react";
import { GenericReportRenderer } from "../generic-report-renderer";

export function ClientesTab({ 
  apiParams, 
  isDateRangeValid 
}: { 
  apiParams: any; 
  isDateRangeValid: boolean; 
}) {
  const { data: cliData, isLoading: cliLoading, isError: cliError, refetch: cliRefetch } = useGetReporteSeccion("clientes", apiParams, {
    query: {
      enabled: isDateRangeValid,
      queryKey: getGetReporteSeccionQueryKey("clientes", apiParams)
    }
  });

  const { data: pagData, isLoading: pagLoading, isError: pagError, refetch: pagRefetch } = useGetReporteSeccion("pagos-dirigidos", apiParams, {
    query: {
      enabled: isDateRangeValid,
      queryKey: getGetReporteSeccionQueryKey("pagos-dirigidos", apiParams)
    }
  });

  return (
    <div className="space-y-12">
      <GenericReportRenderer data={cliData} isLoading={cliLoading} isError={cliError} refetch={cliRefetch} section="clientes" />
      
      <div className="pt-8 border-t border-border space-y-4">
        <h2 className="text-xl font-bold tracking-tight text-sidebar">Solicitudes Resueltas</h2>
        <GenericReportRenderer data={pagData} isLoading={pagLoading} isError={pagError} refetch={pagRefetch} section="pagos-dirigidos" />
      </div>
    </div>
  );
}
