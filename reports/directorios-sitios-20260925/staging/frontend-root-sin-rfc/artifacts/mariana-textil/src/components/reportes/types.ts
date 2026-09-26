import { ReactNode } from "react";
import { NumberFormatKind } from "@workspace/number-format";

export type ReportChartBlock = {
  id: string;
  title: string;
  description?: string;
  type: "line" | "bar" | "pie" | "composed" | "heatmap";
  data: any[];
  keys?: string[];
  config?: any; // Recharts config
  xAxisKey?: string;
};

export type ReportTableBlock = {
  id: string;
  title: string;
  columns: {
    key: string;
    label: string;
    kind: "text" | "money" | "percentage" | "count" | "quantity" | "days";
    align?: "left" | "right" | "center";
    sortable?: boolean;
    hiddenWithoutEconomic?: boolean;
  }[];
  data: any[];
  totals?: any;
};

export type ReportKpiBlock = {
  id: string;
  label: string;
  value: number | string;
  kind: "money" | "percentage" | "count" | "quantity" | "days";
  trend?: number;
  subtitle?: string;
  economic?: boolean;
};

export type ReportWarningBlock = {
  id: string;
  message: string;
  severity: "info" | "warning" | "error";
};

export type ReportData = {
  section: string;
  generatedAt: string;
  hasEconomicAccess: boolean;
  range: { from: string; to: string };
  activeFilters: Record<string, string[]>;
  warnings: ReportWarningBlock[];
  kpis: ReportKpiBlock[];
  charts: ReportChartBlock[];
  tables: ReportTableBlock[];
};

export type ReportesCatalogos = {
  ubicaciones?: { id: number; nombre: string }[];
  productos?: { id: number; nombre: string }[];
  telas?: { id: number; nombre: string }[];
  colores?: { id: number; nombre: string }[];
  unidades?: { id: number; nombre: string }[];
  usuarios?: { id: number; nombre: string }[];
  clientes?: { id: number; nombre: string }[];
  proveedores?: { id: number; nombre: string }[];
  metodosPago?: { id: string; nombre: string }[];
};
