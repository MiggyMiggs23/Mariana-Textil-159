import { useState, useMemo } from "react";
import { ReporteTable } from "@workspace/api-client-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ArrowUpDown } from "lucide-react";
import { formatReportValue } from "./report-format";

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

  return (
    <Card data-testid={`report-table-${block.id}`}>
      {(block.title) && (
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">{block.title}</CardTitle>
        </CardHeader>
      )}
      <CardContent className="p-0">
        <div className="overflow-x-auto w-full custom-scrollbar">
          <Table className="text-sm">
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40 whitespace-nowrap">
                {visibleColumns.map((col: any) => (
                  <TableHead 
                    key={col.key} 
                    className={`${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : ''} ${col.sortable !== false ? 'cursor-pointer hover:bg-muted/60 select-none' : ''}`}
                    onClick={() => handleSort(col.key, col.sortable)}
                    data-testid={`th-${col.key}`}
                  >
                    <div className={`flex items-center gap-1 ${col.align === 'right' ? 'justify-end' : col.align === 'center' ? 'justify-center' : ''}`}>
                      {col.label || col.key} {col.sortable !== false && <ArrowUpDown className="w-3 h-3 opacity-50" />}
                    </div>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedData.map((row: any, idx) => (
                <TableRow key={row.id || idx} className="hover:bg-muted/30 whitespace-nowrap" data-testid={`tr-${idx}`}>
                  {visibleColumns.map((col: any) => {
                    const val = row[col.key];
                    const isEconomic = col.kind === "money";
                    return (
                      <TableCell 
                        key={col.key} 
                        className={`${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : ''} ${isEconomic ? 'font-mono font-medium' : ''}`}
                      >
                        {val === undefined || val === null ? (col.economic ? "Pendiente" : "-") :
                          formatReportValue(val, col.kind || "count")}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
              {sortedData.length === 0 && (
                <TableRow>
                  <TableCell colSpan={visibleColumns.length} className="text-center text-muted-foreground py-8">
                    No hay datos disponibles
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
            {block.totals && sortedData.length > 0 && (
              <TableFooter>
                <TableRow className="whitespace-nowrap font-bold bg-sidebar/5">
                  {visibleColumns.map((col: any, idx) => {
                    const val = (block.totals as any)[col.key];
                    const isEconomic = col.kind === "money";
                    return (
                      <TableCell 
                        key={col.key}
                        className={`${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : ''} ${isEconomic ? 'font-mono' : ''}`}
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
