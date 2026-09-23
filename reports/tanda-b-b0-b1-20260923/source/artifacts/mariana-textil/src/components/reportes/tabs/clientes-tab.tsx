import { useGetReporteSeccion, getGetReporteSeccionQueryKey } from "@workspace/api-client-react";
import { GenericReportRenderer } from "../generic-report-renderer";
import type { ReportComparisonFrame } from "../report-source-frame";

function ClientesSiteFrame({
  frame,
  isDateRangeValid,
}: {
  frame: ReportComparisonFrame;
  isDateRangeValid: boolean;
}) {
  const { data: cliData, isLoading: cliLoading, isError: cliError, refetch: cliRefetch } = useGetReporteSeccion("clientes", frame.apiParams, {
    query: {
      enabled: isDateRangeValid,
      queryKey: getGetReporteSeccionQueryKey("clientes", frame.apiParams),
    },
  });
  const { data: pagData, isLoading: pagLoading, isError: pagError, refetch: pagRefetch } = useGetReporteSeccion("pagos-dirigidos", frame.apiParams, {
    query: {
      enabled: isDateRangeValid,
      queryKey: getGetReporteSeccionQueryKey("pagos-dirigidos", frame.apiParams),
    },
  });

  return (
    <div className="space-y-6 rounded-xl border border-border/70 bg-card/40 p-4">
      <h2 className="text-xl font-bold tracking-tight text-sidebar">{frame.siteLabel}</h2>
      <GenericReportRenderer data={cliData} isLoading={cliLoading} isError={cliError} refetch={cliRefetch} section={`clientes-${frame.siteLabel}`} />
      <div className="pt-8 border-t border-border space-y-4">
        <h3 className="text-lg font-bold tracking-tight text-sidebar">Solicitudes Resueltas</h3>
        <GenericReportRenderer data={pagData} isLoading={pagLoading} isError={pagError} refetch={pagRefetch} section={`pagos-dirigidos-${frame.siteLabel}`} />
      </div>
    </div>
  );
}

export function ClientesTab({ 
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
  const { data: cliData, isLoading: cliLoading, isError: cliError, refetch: cliRefetch } = useGetReporteSeccion("clientes", apiParams, {
    query: {
      enabled: isDateRangeValid && !comparisonMode,
      queryKey: getGetReporteSeccionQueryKey("clientes", apiParams)
    }
  });

  const { data: pagData, isLoading: pagLoading, isError: pagError, refetch: pagRefetch } = useGetReporteSeccion("pagos-dirigidos", apiParams, {
    query: {
      enabled: isDateRangeValid && !comparisonMode,
      queryKey: getGetReporteSeccionQueryKey("pagos-dirigidos", apiParams)
    }
  });

  if (comparisonMode) {
    return (
      <div className="space-y-6">
        {comparisonFrames.map((frame) => (
          <ClientesSiteFrame
            key={frame.siteId}
            frame={frame}
            isDateRangeValid={isDateRangeValid}
          />
        ))}
      </div>
    );
  }

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
