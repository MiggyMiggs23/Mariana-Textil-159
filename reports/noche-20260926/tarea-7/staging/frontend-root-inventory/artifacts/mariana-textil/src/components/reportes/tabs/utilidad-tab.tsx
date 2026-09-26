import { useGetReporteSeccion, getGetReporteSeccionQueryKey } from "@workspace/api-client-react";
import { GenericReportRenderer } from "../generic-report-renderer";
import { ReportSourceFrame } from "../report-source-frame";
import type { ReportComparisonFrame } from "../report-source-frame";

export function UtilidadTab({ 
  apiParams, 
  isDateRangeValid,
  comparisonMode = false,
  comparisonFrames = [],
}: { 
  apiParams: any; 
  isDateRangeValid: boolean; 
  comparisonMode?: boolean;
  comparisonFrames?: ReportComparisonFrame[];
}) {
  const { data, isLoading, isError, refetch } = useGetReporteSeccion("utilidad", apiParams, {
    query: {
      enabled: isDateRangeValid && !comparisonMode,
      queryKey: getGetReporteSeccionQueryKey("utilidad", apiParams)
    }
  });

  if (comparisonMode) {
    return (
      <div className="space-y-6">
        {comparisonFrames.map((frame) => (
          <ReportSourceFrame
            key={frame.siteId}
            section="utilidad"
            apiParams={frame.apiParams}
            isDateRangeValid={isDateRangeValid}
            siteLabel={frame.siteLabel}
          />
        ))}
      </div>
    );
  }

  return (
    <GenericReportRenderer data={data} isLoading={isLoading} isError={isError} refetch={refetch} section="utilidad" />
  );
}
