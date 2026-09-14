import { useGetReporteSeccion, getGetReporteSeccionQueryKey } from "@workspace/api-client-react";
import { GenericReportRenderer } from "../generic-report-renderer";
import QueComprarReport from "../que-comprar-report";
import { Loader2 } from "lucide-react";

export function QueComprarTab({ 
  apiParams, 
  isDateRangeValid, 
  ubicacionId, 
  isAdmin 
}: { 
  apiParams: any; 
  isDateRangeValid: boolean; 
  ubicacionId: number | null;
  isAdmin: boolean;
}) {
  const { data: invData, isLoading: invLoading, isError: invError, refetch: invRefetch } = useGetReporteSeccion("inventario", apiParams, {
    query: {
      enabled: isDateRangeValid,
      queryKey: getGetReporteSeccionQueryKey("inventario", apiParams)
    }
  });

  const { data: mcData, isLoading: mcLoading, isError: mcError, refetch: mcRefetch } = useGetReporteSeccion("mapas-calor", apiParams, {
    query: {
      enabled: isDateRangeValid,
      queryKey: getGetReporteSeccionQueryKey("mapas-calor", apiParams)
    }
  });

  const { data: colData, isLoading: colLoading, isError: colError, refetch: colRefetch } = useGetReporteSeccion("color", apiParams, {
    query: {
      enabled: isDateRangeValid,
      queryKey: getGetReporteSeccionQueryKey("color", apiParams)
    }
  });

  const { data: comData, isLoading: comLoading, isError: comError, refetch: comRefetch } = useGetReporteSeccion("compras", apiParams, {
    query: {
      enabled: isDateRangeValid && isAdmin,
      queryKey: getGetReporteSeccionQueryKey("compras", apiParams)
    }
  });

  return (
    <div className="space-y-12">
      <div className="space-y-4">
        <h2 className="text-xl font-bold tracking-tight text-sidebar">Recomendación y Evidencia</h2>
        <QueComprarReport
          params={apiParams}
          dateRangeValid={isDateRangeValid}
          ubicacionId={ubicacionId}
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
