type HeatmapMetricKind = "count" | "quantity" | "money";

type HeatmapMatrixOptions = {
  rows: Array<Record<string, unknown>>;
  rowKey: string;
  columnKey: string;
  valueKey: string;
  columns?: string[];
  kind?: HeatmapMetricKind;
  formatColumnLabel?: (value: string) => string;
};

function displayLabel(value: unknown): string {
  const label = String(value ?? "").trim();
  return label || "Sin dato";
}

function finiteNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Pivots long-form records into the matrix consumed by the heatmap renderer.
 * Missing row/column combinations stay null; explicit zero remains numeric.
 */
export function buildHeatmapMatrix({
  rows,
  rowKey,
  columnKey,
  valueKey,
  columns = [],
  kind = "quantity",
  formatColumnLabel = (value) => value,
}: HeatmapMatrixOptions) {
  const discoveredColumns = rows
    .map((row) => displayLabel(row[columnKey]))
    .filter((label) => !columns.includes(label));
  const columnLabels = [
    ...columns,
    ...[...new Set(discoveredColumns)].sort((a, b) =>
      a.localeCompare(b, "es-MX"),
    ),
  ];
  const series = columnLabels.map((label, index) => ({
    key: `value_${index}`,
    label: formatColumnLabel(label),
    kind,
  }));
  const columnKeyByLabel = new Map(
    columnLabels.map((label, index) => [label, series[index].key]),
  );
  const matrixRows = new Map<string, Record<string, string | number | null>>();

  for (const source of rows) {
    const rowLabel = displayLabel(source[rowKey]);
    const columnLabel = displayLabel(source[columnKey]);
    const matrixKey = columnKeyByLabel.get(columnLabel);
    if (!matrixKey) continue;
    let target = matrixRows.get(rowLabel);
    if (!target) {
      target = {
        label: rowLabel,
        ...Object.fromEntries(series.map(({ key }) => [key, null])),
      };
      matrixRows.set(rowLabel, target);
    }
    const value = finiteNumber(source[valueKey]);
    if (value === null) continue;
    const previous = target[matrixKey];
    target[matrixKey] =
      typeof previous === "number" ? previous + value : value;
  }

  return {
    categoryKey: "label",
    series,
    rows: [...matrixRows.values()].sort((a, b) =>
      String(a.label).localeCompare(String(b.label), "es-MX"),
    ),
  };
}