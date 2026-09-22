import { useMemo } from "react";
import { ReporteKpi } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowDownRight, ArrowUpRight, Minus, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatReportValue } from "./report-format";

export function ReportKpis({ kpis, hasEconomicAccess }: { kpis: ReporteKpi[], hasEconomicAccess: boolean }) {
  const visibleKpis = useMemo(() => {
    // If you need economic filtering:
    return kpis.filter(kpi => kpi.kind !== "money" || hasEconomicAccess);
  }, [kpis, hasEconomicAccess]);

  if (visibleKpis.length === 0) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4" data-testid="report-kpis">
      {visibleKpis.map(kpi => {
        const trend = kpi.comparisonPrevious;
        const hasTrend = trend !== undefined && trend !== null;
        const trendIsPositive = hasTrend && trend > 0;
        const trendIsNegative = hasTrend && trend < 0;

        const isPending = kpi.value == null || (typeof kpi.value === 'string' && kpi.value.toLowerCase().includes('pendiente'));

        // Family accents
        let accentColor = "bg-report-header";
        if (kpi.kind === "money") accentColor = "bg-report-accent-warm";
        else if (kpi.kind === "quantity") accentColor = "bg-report-modality-metraje";
        else if (kpi.kind === "count") accentColor = "bg-report-modality-rollos";

        // Modality labels inside KPIs
        let valueContent: React.ReactNode;
        if (isPending) {
          valueContent = (
            <span className="text-xl italic text-report-text-muted opacity-80 flex items-center gap-1.5" style={{ backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 2px, rgba(0,0,0,0.05) 2px, rgba(0,0,0,0.05) 4px)' }}>
              <AlertCircle className="w-5 h-5" />
              Pendiente
            </span>
          );
        } else if (typeof kpi.value === "string" && (kpi.value.toUpperCase() === "ROLLOS" || kpi.value.toUpperCase() === "METRAJE")) {
           valueContent = (
             <span className={cn(
               "text-2xl font-black tracking-tight",
               kpi.value.toUpperCase() === "ROLLOS" ? "text-report-modality-rollos" : "text-report-modality-metraje"
             )}>
               {kpi.value}
             </span>
           );
        } else {
           valueContent = typeof kpi.value === "number" ? formatReportValue(kpi.value, kpi.kind) : kpi.value;
        }

        return (
          <Card key={kpi.id} className="relative overflow-hidden border-border shadow-sm group" data-testid={`kpi-card-${kpi.id}`}>
            {/* Family accent strip */}
            <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${accentColor} opacity-80 group-hover:opacity-100 transition-opacity`} />

            <CardContent className="p-5 pl-6 flex flex-col justify-center">
              <p className="text-[11px] font-bold tracking-widest uppercase text-report-text-muted truncate mb-1.5" title={kpi.label}>
                {kpi.label}
              </p>

              <div className="flex items-baseline justify-between gap-2">
                <h3 className={cn(
                  "text-3xl font-mono font-bold tracking-tight text-report-header",
                  isPending && "font-sans"
                )}>
                  {valueContent}
                </h3>
              </div>

              {hasTrend && !isPending && (
                <div
                  className={cn(
                    "flex items-center text-xs font-semibold mt-2",
                    trendIsPositive ? "text-report-positive" : trendIsNegative ? "text-report-negative" : "text-report-text-muted"
                  )}
                  data-testid={`kpi-trend-${kpi.id}`}
                >
                  {trendIsPositive ? <ArrowUpRight className="w-4 h-4 mr-0.5" /> : trendIsNegative ? <ArrowDownRight className="w-4 h-4 mr-0.5" /> : <Minus className="w-4 h-4 mr-0.5" />}
                  {formatReportValue(Math.abs(trend!), "percentage")}
                  <span className="text-report-text-muted ml-1.5 font-normal">vs ant.</span>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
