import { useMemo } from "react";
import { ReporteKpi } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
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

        return (
          <Card key={kpi.id} className="relative overflow-hidden" data-testid={`kpi-card-${kpi.id}`}>
            <CardContent className="p-5 flex flex-col justify-center">
              <p className="text-sm font-medium text-muted-foreground truncate" title={kpi.label}>
                {kpi.label}
              </p>
              <div className="flex items-end gap-2 mt-1">
                <h3 className="text-2xl font-black text-sidebar tracking-tight">
                  {typeof kpi.value === "number"
                    ? formatReportValue(kpi.value, kpi.kind)
                    : kpi.value}
                </h3>
                {hasTrend && (
                  <div
                    className={cn(
                      "flex items-center text-xs font-bold mb-1",
                      trendIsPositive ? "text-green-600" : trendIsNegative ? "text-destructive" : "text-muted-foreground"
                    )}
                    data-testid={`kpi-trend-${kpi.id}`}
                  >
                    {trendIsPositive ? <ArrowUpRight className="w-3 h-3 mr-0.5" /> : trendIsNegative ? <ArrowDownRight className="w-3 h-3 mr-0.5" /> : <Minus className="w-3 h-3 mr-0.5" />}
                    {formatReportValue(Math.abs(trend!), "percentage")}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
