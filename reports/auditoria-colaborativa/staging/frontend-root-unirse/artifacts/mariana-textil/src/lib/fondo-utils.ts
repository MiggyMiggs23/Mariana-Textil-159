export function formatFondoCurrency(value: number | string): string {
  if (typeof value === "string") {
    const isNegative = value.startsWith("-");
    const absValue = isNegative ? value.slice(1) : value;
    const [int, dec = "00"] = absValue.split(".");
    const formattedInt = int.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return `${isNegative ? "-" : ""}$${formattedInt}.${dec.padEnd(2, "0").slice(0, 2)}`;
  }
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}
