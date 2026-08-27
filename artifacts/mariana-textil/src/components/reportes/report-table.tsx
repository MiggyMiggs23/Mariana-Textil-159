import { useState, useMemo } from "react";
import { ReporteTable } from "@workspace/api-client-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowUpDown } from "lucide-react";
import { formatReportValue } from "./report-format";
import { cn } from "@/lib/utils";

export function ReportTable({ block, hasEconomicAccess }: { block: ReporteTable, hasEconomicAccess: boolean }) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortAsc, setSortAsc] = useState(true);

  const visibleColumns = useMemo(() => {
    // If no economic access, hide columns of kind "money"
    return block.columns.filter((c: any) => c.kind !== "money" || hasEconomicAccess);
  }, [block.columns, hasEconomicAccess]);

  const sortedData = useMemo(() => {
    if (!sortKey) return block.rows;
    return [...block.rows].sort((a: any, b: any) => {
      let valA = a[sortKey];
      let valB = b[sortKey];
      if (typeof valA === "string" && !isNaN(Number(valA))) valA = Number(valA);
      if (typeof valB === "string" && !isNaN(Number(valB))) valB = Number(valB);

      if (valA < valB) return sortAsc ? -1 : 1;
      if (valA > valB) return sortAsc ? 1 : -1;
      return 0;
    });
  }, [block.rows, sortKey, sortAsc]);

  const handleSort = (key: string, sortable?: boolean) => {
    if (sortable === false) return;
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(true);
    }
  };

  const isSticky = sortedData.length > 15;

  return (
    <Card className="border-border shadow-sm overflow-hidden" data-testid={`report-table-${block.id}`}>
      {block.title && (
        <CardHeader className="py-4 px-5">
          <CardTitle className="text-lg font-semibold tracking-tight text-report-header">
            {block.title}
          </CardTitle>
        </CardHeader>
      )}
      <CardContent className="p-0">
        <div
          className={`w-full overflow-x-auto custom-scrollbar ${isSticky ? "max-h-[600px] overflow-y-auto" : ""}`}
        >
          <Table className="text-[14px] w-full">
            <TableHeader className={isSticky ? "sticky top-0 z-20" : ""}>
              <TableRow
                className="whitespace-nowrap border-b-0 hover:bg-report-header bg-report-header text-report-header-foreground shadow-sm"
              >
                {visibleColumns.map((col: any) => {
                  const isNumeric = col.kind === "money" || col.kind === "percentage" || col.kind === "count" || col.kind === "quantity" || col.kind === "days";
                  const alignRight = col.align === 'right' || (isNumeric && col.align !== 'left' && col.align !== 'center');
                  const alignCenter = col.align === 'center';

                  return (
                    <TableHead
                      key={col.key}
                      className={`h-11 px-4 font-semibold tracking-wide text-report-header-foreground ${alignRight ? 'text-right' : alignCenter ? 'text-center' : 'text-left'} ${col.sortable !== false ? 'cursor-pointer hover:bg-black/10 dark:hover:bg-white/10 select-none' : ''}`}
                      onClick={() => handleSort(col.key, col.sortable)}
                      data-testid={`th-${col.key}`}
                    >
                      <div className={`flex items-center gap-1.5 ${alignRight ? 'justify-end' : alignCenter ? 'justify-center' : 'justify-start'}`}>
                        {col.label || col.key} {col.sortable !== false && <ArrowUpDown className="w-3.5 h-3.5 opacity-60" />}
                      </div>
                    </TableHead>
                  );
                })}
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedData.map((row: any, idx) => (
                <TableRow
                  key={row.id || idx}
                  className="whitespace-nowrap border-b-0 transition-colors even:bg-report-stripe hover:bg-black/5 dark:hover:bg-white/10"
                  data-testid={`tr-${idx}`}
                >
                  {visibleColumns.map((col: any) => {
                    const val = row[col.key];
                    const isNumeric = col.kind === "money" || col.kind === "percentage" || col.kind === "count" || col.kind === "quantity" || col.kind === "days";
                    const alignRight = col.align === 'right' || (isNumeric && col.align !== 'left' && col.align !== 'center');
                    const alignCenter = col.align === 'center';

                    // Semantic Colors Logic
                    const isPendingText = val === "Costo pendiente" || val === "Sin costo" || val === "Costo antiguo" || (val === undefined || val === null) && col.economic;

                    let content = isPendingText ? (
                      <span className="italic text-report-text-muted opacity-80" style={{ backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 2px, rgba(0,0,0,0.05) 2px, rgba(0,0,0,0.05) 4px)' }}>
                        {val || "Pendiente"}
                      </span>
                    ) : val === undefined || val === null ? "-" : formatReportValue(val, col.kind || "count");

                    let cellClassName = "";
                    let indicator = null;

                    if (!isPendingText && val !== undefined && val !== null) {
                      // 1. Modality
                      if (String(val).toUpperCase() === "ROLLOS") {
                        cellClassName = "text-report-modality-rollos font-semibold";
                      } else if (String(val).toUpperCase() === "METRAJE") {
                        cellClassName = "text-report-modality-metraje font-semibold";
                      }

                      // 2. Sign (Utility / Variations)
                      const isSignedColumn = col.key.toLowerCase().match(/(utilidad|variacion|variación|diferencia|crecimiento)/);
                      if (isSignedColumn && typeof val === 'number') {
                        if (val > 0) cellClassName = "text-report-positive font-medium";
                        else if (val < 0) cellClassName = "text-report-negative font-medium";
                      }

                      // 3. Margin Thresholds
                      if (col.key.toLowerCase().includes('margen') && typeof val === 'number') {
                        if (val >= 30) {
                          indicator = <span className="inline-block w-2 h-2 rounded-full bg-report-margin-high mr-2" />;
                        } else if (val >= 15) {
                          indicator = <span className="inline-block w-2 h-2 rounded-full bg-report-margin-medium mr-2" />;
                        } else {
                          indicator = <span className="inline-block w-2 h-2 rounded-full bg-report-margin-low mr-2" />;
                        }
                      }

                      // 4. ABC Classification
                      if (col.key.toLowerCase() === 'abc' || (typeof val === 'string' && ['A', 'B', 'C'].includes(val.toUpperCase()))) {
                        const abc = String(val).toUpperCase();
                        if (abc === 'A') cellClassName = "bg-report-abc-a text-white font-bold rounded-sm px-2 py-0.5 inline-block text-center min-w-[28px]";
                        if (abc === 'B') cellClassName = "bg-report-abc-b text-white font-bold rounded-sm px-2 py-0.5 inline-block text-center min-w-[28px]";
                        if (abc === 'C') cellClassName = "bg-report-abc-c text-report-header font-bold rounded-sm px-2 py-0.5 inline-block text-center min-w-[28px]";
                        if (['A','B','C'].includes(abc)) {
                          content = <span className={cellClassName}>{val}</span>;
                          cellClassName = ""; // Reset cell wrapper class to not override td
                        }
                      }

                      // 5. Aging Buckets
                      const agingKeys = ['1_30', '1-30', '31_60', '31-60', '61_90', '61-90', 'MAS_90', '90'];
                      if (agingKeys.some(k => col.key.toUpperCase().includes(k)) && typeof val === 'number' && val > 0) {
                        let intensity = 0.05;
                        if (col.key.includes('31')) intensity = 0.15;
                        if (col.key.includes('61')) intensity = 0.25;
                        if (col.key.includes('90')) intensity = 0.4;
                        cellClassName = "font-medium";
                        content = (
                          <div className="relative z-10 p-1 px-2 -mx-2 -my-1 rounded-sm">
                            <div className="absolute inset-0 rounded-sm z-[-1]" style={{ backgroundColor: `hsl(var(--report-aging) / ${intensity})` }} />
                            {content}
                          </div>
                        );
                      }

                      // 6. Color Swatch
                      if (col.key.toLowerCase().includes('color')) {
                        const colorHex = row.colorHex || row.color_hex;
                        content = (
                          <div className="flex items-center gap-2">
                            <span
                              className="inline-block w-4 h-4 rounded-sm border shadow-sm shrink-0"
                              style={{ backgroundColor: colorHex || 'hsl(var(--report-text-muted))' }}
                              title={colorHex ? "Color capturado" : "Sin color asignado"}
                            />
                            <span>{content}</span>
                          </div>
                        );
                      }
                    }

                    return (
                      <TableCell
                        key={col.key}
                        className={cn(
                          "py-2.5 px-4",
                          alignRight ? 'text-right' : alignCenter ? 'text-center' : 'text-left',
                          isNumeric ? 'font-mono' : '',
                          cellClassName
                        )}
                      >
                        <div className={cn("flex items-center", alignRight ? 'justify-end' : alignCenter ? 'justify-center' : 'justify-start')}>
                          {indicator}
                          {content}
                        </div>
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
              {sortedData.length === 0 && (
                <TableRow>
                  <TableCell colSpan={visibleColumns.length} className="text-center py-10 text-report-text-muted">
                    No hay datos disponibles
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
            {block.totals && sortedData.length > 0 && (
              <TableFooter className={isSticky ? "sticky bottom-0 z-20" : ""}>
                <TableRow
                  className="whitespace-nowrap hover:bg-report-accent-warm-bg bg-report-accent-warm-bg text-report-accent-warm border-t-2 border-t-report-accent-warm"
                >
                  {visibleColumns.map((col: any, idx) => {
                    const val = (block.totals as any)[col.key];
                    const isNumeric = col.kind === "money" || col.kind === "percentage" || col.kind === "count" || col.kind === "quantity" || col.kind === "days";
                    const alignRight = col.align === 'right' || (isNumeric && col.align !== 'left' && col.align !== 'center');
                    const alignCenter = col.align === 'center';

                    return (
                      <TableCell
                        key={col.key}
                        className={`py-3 px-4 font-bold ${alignRight ? 'text-right' : alignCenter ? 'text-center' : 'text-left'} ${isNumeric ? 'font-mono' : ''}`}
                      >
                        {val === undefined || val === null ? (idx === 0 ? "Totales" : "") :
                          formatReportValue(val, col.kind || "count")}
                      </TableCell>
                    );
                  })}
                </TableRow>
              </TableFooter>
            )}
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
