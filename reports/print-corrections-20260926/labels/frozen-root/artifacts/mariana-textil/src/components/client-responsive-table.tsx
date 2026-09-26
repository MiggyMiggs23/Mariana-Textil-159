import { useEffect, type ReactNode } from "react";
import { Link, useSearch } from "wouter";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export interface ResponsiveTableRow {
  id: string | number;
  cells: ReactNode[];
  ticketId?: number | null;
  /** Optional destination for the row's explicit primary identifier. */
  href?: string | null;
  /** Optional accessible/readable label for the explicit destination. */
  linkLabel?: ReactNode;
}

interface ResponsiveTableProps {
  headers: string[];
  rows: ResponsiveTableRow[];
  empty: string;
  highlightedRowId?: string | number | null;
}

export function ResponsiveTable({
  headers,
  rows,
  empty,
  highlightedRowId,
}: ResponsiveTableProps) {
  const search = useSearch();
  const supportsAccountMovementHighlight =
    headers.includes("Pago") && headers.includes("Saldo");
  const requestedRowId = supportsAccountMovementHighlight
    ? new URLSearchParams(search).get("movimientoId")
    : null;
  const effectiveHighlightedRowId = highlightedRowId ?? requestedRowId;

  useEffect(() => {
    if (effectiveHighlightedRowId == null) return;
    const frame = window.requestAnimationFrame(() => {
      document
        .getElementById(`responsive-table-row-${effectiveHighlightedRowId}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [effectiveHighlightedRowId, rows.length]);

  if (!rows.length) {
    return <p className="py-10 text-center text-muted-foreground">{empty}</p>;
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            {headers.map((header) => (
              <TableHead
                key={header}
                className={header === "Importe" || header === "Total" ? "text-right" : ""}
              >
                {header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => {
            const highlighted =
              effectiveHighlightedRowId != null &&
              String(row.id) === String(effectiveHighlightedRowId);
            return (
              <TableRow
                key={row.id}
                id={highlighted ? `responsive-table-row-${row.id}` : undefined}
                aria-current={highlighted ? "true" : undefined}
                className={highlighted ? "bg-primary/10 ring-2 ring-inset ring-primary" : undefined}
                data-highlighted={highlighted ? "true" : undefined}
              >
                {row.cells.map((cell, index) => (
                  <TableCell
                    key={headers[index]}
                    className={index === headers.length - 1 ? "text-right font-mono" : ""}
                  >
                    {headers[index] === "Folio" &&
                    (row.href != null || row.ticketId != null) ? (
                      <Link
                        href={row.href ?? `/tickets/${row.ticketId}`}
                        className="text-primary underline underline-offset-4 hover:text-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      >
                        {row.linkLabel ?? cell}
                      </Link>
                    ) : (
                      cell
                    )}
                  </TableCell>
                ))}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}