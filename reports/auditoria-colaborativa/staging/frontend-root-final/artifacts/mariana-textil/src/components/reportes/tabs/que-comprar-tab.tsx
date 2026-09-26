import { useGetReporteSeccion, getGetReporteSeccionQueryKey } from "@workspace/api-client-react";
import { GenericReportRenderer } from "../generic-report-renderer";
import QueComprarReport from "../que-comprar-report";
import type { ReportComparisonFrame } from "../report-source-frame";

function QueComprarSiteFrame({
  frame,
  isDateRangeValid,
  isAdmin,
}: {
  frame: ReportComparisonFrame;
  isDateRangeValid: boolean;
  isAdmin: boolean;
}) {
  const { data: invData, isLoading: invLoading, isError: invError, refetch: invRefetch } = useGetReporteSeccion("inventario", frame.apiParams, {
    query: {
      enabled: isDateRangeValid,
      queryKey: getGetReporteSeccionQueryKey("inventario", frame.apiParams),
    },
  });
  const { data: mcData, isLoading: mcLoading, isError: mcError, refetch: mcRefetch } = useGetReporteSeccion("mapas-calor", frame.apiParams, {
    query: {
      enabled: isDateRangeValid,
      queryKey: getGetReporteSeccionQueryKey("mapas-calor", frame.apiParams),
    },
  });
  const { data: colData, isLoading: colLoading, isError: colError, refetch: colRefetch } = useGetReporteSeccion("color", frame.apiParams, {
    query: {
      enabled: isDateRangeValid,
      queryKey: getGetReporteSeccionQueryKey("color", frame.apiParams),
    },
  });
  const { data: comData, isLoading: comLoading, isError: comError, refetch: comRefetch } = useGetReporteSeccion("compras", frame.apiParams, {
    query: {
      enabled: isDateRangeValid && isAdmin,
      queryKey: getGetReporteSeccionQueryKey("compras", frame.apiParams),
    },
  });

  return (
    <div className="space-y-8 rounded-xl border border-border/70 bg-card/40 p-4">
      <h2 className="text-xl font-bold tracking-tight text-sidebar">{frame.siteLabel}</h2>
      <div className="space-y-4">
        <h3 className="text-lg font-bold tracking-tight text-sidebar">Recomendación y Evidencia</h3>
        <QueComprarReport params={frame.apiParams as any} dateRangeValid={isDateRangeValid} />
      </div>
      <div className="pt-8 border-t border-border space-y-4">
        <h3 className="text-lg font-bold tracking-tight text-sidebar">Existencia y Rotación</h3>
        <GenericReportRenderer data={invData} isLoading={invLoading} isError={invError} refetch={invRefetch} section={`inventario-${frame.siteLabel}`} />
      </div>
      <div className="pt-8 border-t border-border space-y-4">
        <h3 className="text-lg font-bold tracking-tight text-sidebar">Demanda por mes, tela y color</h3>
        <div className="space-y-12">
          <GenericReportRenderer data={mcData} isLoading={mcLoading} isError={mcError} refetch={mcRefetch} section={`mapas-calor-${frame.siteLabel}`} />
          <GenericReportRenderer data={colData} isLoading={colLoading} isError={colError} refetch={colRefetch} section={`color-${frame.siteLabel}`} />
        </div>
      </div>
      {isAdmin && (
        <div className="pt-8 border-t border-border space-y-4">
          <h3 className="text-lg font-bold tracking-tight text-sidebar">Compras y Proveedores</h3>
          <GenericReportRenderer data={comData} isLoading={comLoading} isError={comError} refetch={comRefetch} section={`compras-${frame.siteLabel}`} />
        </div>
      )}
    </div>
  );
}

export function QueComprarTab({ 
  apiParams, 
  isDateRangeValid, 
  isAdmin,
  comparisonMode = false,
  comparisonFrames = [],
}: { 
  apiParams: any; 
  isDateRangeValid: boolean; 
  isAdmin: boolean;
  comparisonMode?: boolean;
  comparisonFrames?: ReportComparisonFrame[];
}) {
  const { data: invData, isLoading: invLoading, isError: invError, refetch: invRefetch } = useGetReporteSeccion("inventario", apiParams, {
    query: {
      enabled: isDateRangeValid && !comparisonMode,
      queryKey: getGetReporteSeccionQueryKey("inventario", apiParams)
    }
  });

  const { data: mcData, isLoading: mcLoading, isError: mcError, refetch: mcRefetch } = useGetReporteSeccion("mapas-calor", apiParams, {
    query: {
      enabled: isDateRangeValid && !comparisonMode,
      queryKey: getGetReporteSeccionQueryKey("mapas-calor", apiParams)
    }
  });

  const { data: colData, isLoading: colLoading, isError: colError, refetch: colRefetch } = useGetReporteSeccion("color", apiParams, {
    query: {
      enabled: isDateRangeValid && !comparisonMode,
      queryKey: getGetReporteSeccionQueryKey("color", apiParams)
    }
  });

  const { data: comData, isLoading: comLoading, isError: comError, refetch: comRefetch } = useGetReporteSeccion("compras", apiParams, {
    query: {
      enabled: isDateRangeValid && isAdmin && !comparisonMode,
      queryKey: getGetReporteSeccionQueryKey("compras", apiParams)
    }
  });

  if (comparisonMode) {
    return (
      <div className="space-y-6">
        {comparisonFrames.map((frame) => (
          <QueComprarSiteFrame
            key={frame.siteId}
            frame={frame}
            isDateRangeValid={isDateRangeValid}
            isAdmin={isAdmin}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-12">
      <div className="space-y-4">
        <h2 className="text-xl font-bold tracking-tight text-sidebar">Recomendación y Evidencia</h2>
        <QueComprarReport
          params={apiParams}
          dateRangeValid={isDateRangeValid}
        />
      </div>

      <div className="pt-8 border-t border-border space-y-4">
        <h2 className="text-xl font-bold tracking-tight text-sidebar">Existencia y Rotación</h2>
        <GenericReportRenderer data={invData} isLoading={invLoading} isError={invError} refetch={invRefetch} section="inventario" />
      </div>

      <div className="pt-8 border-t border-border space-y-4">
        <h2 className="text-xl font-bold tracking-tight text-sidebar">Demanda por mes, tela y color</h2>
        <div className="space-y-12">
          <GenericReportRenderer data={mcData} isLoading={mcLoading} isError={mcError} refetch={mcRefetch} section="mapas-calor" />
          <GenericReportRenderer data={colData} isLoading={colLoading} isError={colError} refetch={colRefetch} section="color" />
        </div>
      </div>

      {isAdmin && (
        <div className="pt-8 border-t border-border space-y-4">
          <h2 className="text-xl font-bold tracking-tight text-sidebar">Compras y Proveedores</h2>
          <GenericReportRenderer data={comData} isLoading={comLoading} isError={comError} refetch={comRefetch} section="compras" />
        </div>
      )}
    </div>
  );
}
