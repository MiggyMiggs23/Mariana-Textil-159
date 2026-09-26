import { ReportWarnings } from "@/components/reportes/report-warnings";
import { ReportKpis } from "@/components/reportes/report-kpis";
import { ReportCharts } from "@/components/reportes/report-charts";
import { ReportTable } from "@/components/reportes/report-table";
import { Loader2, AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export function GenericReportRenderer({ 
  data, 
  isLoading, 
  isError, 
  refetch, 
  section 
}: { 
  data: any; 
  isLoading: boolean; 
  isError: boolean; 
  refetch: () => void; 
  section: string;
}) {
  if (isLoading) {
    return (
      <div className="h-[400px] flex items-center justify-center bg-card rounded-lg border shadow-sm" data-testid={`report-loading-${section}`}>
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-10 w-10 animate-spin text-primary opacity-50" />
          <p className="text-sm text-muted-foreground">Cargando {section}...</p>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-10 text-center text-destructive bg-destructive/5 rounded-xl border border-destructive/20" data-testid={`report-error-${section}`}>
        <AlertCircle className="h-10 w-10 mx-auto mb-2 opacity-80" />
        <p className="font-semibold">No se pudo cargar la sección {section}</p>
        <Button variant="outline" className="mt-4" onClick={() => refetch()} data-testid={`report-retry-${section}`}>
          <RefreshCw className="w-4 h-4 mr-2" /> Intentar de nuevo
        </Button>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6" data-testid={`report-content-${section}`}>
      {data.warnings && data.warnings.length > 0 && (
        <ReportWarnings warnings={data.warnings} />
      )}

      {data.kpis && data.kpis.length > 0 && (
        <ReportKpis
          kpis={data.kpis}
          hasEconomicAccess={data.hasEconomicAccess}
        />
      )}

      {data.charts && data.charts.length > 0 && (
        <ReportCharts charts={data.charts} section={section} />
      )}

      {data.tables && data.tables.length > 0 && (
        <div className="grid grid-cols-1 gap-6">
          {data.tables.map((table: any) => (
            <ReportTable
              key={table.id}
              block={table}
              hasEconomicAccess={data.hasEconomicAccess}
              section={section}
            />
          ))}
        </div>
      )}
    </div>
  );
}