import { useMemo } from "react";
import { AlertCircle, Info, AlertTriangle } from "lucide-react";

export function ReportWarnings({ warnings }: { warnings: string[] }) {
  if (!warnings || warnings.length === 0) return null;

  return (
    <div className="grid gap-3 mb-6" data-testid="report-warnings">
      {warnings.map((w, i) => {
        // Simple heuristic to determine severity
        const isError = w.toLowerCase().includes("error") || w.toLowerCase().includes("crítico");
        const isWarning = w.toLowerCase().includes("advertencia") || w.toLowerCase().includes("atención");

        return (
          <div
            key={i}
            data-testid={`warning-alert-${i}`}
            className={`flex items-start gap-3 p-3 rounded-md border text-sm shadow-sm ${
              isError
                ? "bg-destructive/10 border-destructive/20 text-destructive"
                : isWarning
                  ? "bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-950/30 dark:border-amber-900/50 dark:text-amber-500"
                  : "bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-950/30 dark:border-blue-900/50 dark:text-blue-400"
            }`}
          >
            <div className="mt-0.5 flex-shrink-0">
              {isError ? <AlertCircle className="w-5 h-5" /> : isWarning ? <AlertTriangle className="w-5 h-5" /> : <Info className="w-5 h-5" />}
            </div>
            <p className="font-medium leading-relaxed">{w}</p>
          </div>
        );
      })}
    </div>
  );
}
