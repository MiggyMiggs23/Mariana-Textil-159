import React from "react";
import { Link } from "wouter";
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
  cells: string[];
  ticketId?: number | null;
}

interface ResponsiveTableProps {
  headers: string[];
  rows: ResponsiveTableRow[];
  empty: string;
}

export function ResponsiveTable({ headers, rows, empty }: ResponsiveTableProps) {
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
          {rows.map((row) => (
            <TableRow key={row.id}>
              {row.cells.map((cell, index) => (
                <TableCell
                  key={headers[index]}
                  className={index === headers.length - 1 ? "text-right font-mono" : ""}
                >
                  {headers[index] === "Folio" && row.ticketId != null ? (
                    <Link
                      href={`/tickets/${row.ticketId}`}
                      className="font-medium text-primary hover:underline"
                    >
                      {cell}
                    </Link>
                  ) : (
                    cell
                  )}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}