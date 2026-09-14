import { useGetReporteSeccion, getGetReporteSeccionQueryKey } from "@workspace/api-client-react";
import { GenericReportRenderer } from "../generic-report-renderer";

export function UtilidadTab({ 
  apiParams, 
  isDateRangeValid 
}: { 
  apiParams: any; 
  isDateRangeValid: boolean; 
}) {
  const { data, isLoading, isError, refetch } = useGetReporteSeccion("utilidad", apiParams, {
    query: {
      enabled: isDateRangeValid,
      queryKey: getGetReporteSeccionQueryKey("utilidad", apiParams)
    }
  });

  return (
    <GenericReportRenderer data={data} isLoading={isLoading} isError={isError} refetch={refetch} section="utilidad" />
  );
}
