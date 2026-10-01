/** Ignore only case and surrounding whitespace, not accents or inner spaces. */
export function normalizeCatalogColor(color: string): string {
  return color.trim().toLowerCase();
}

export function catalogColorOptions(products: readonly { color: string }[]) {
  const colors = new Map<string, string>();
  for (const { color } of products) {
    const key = normalizeCatalogColor(color);
    const label = color.trim() || "(Sin color)";
    const current = colors.get(key);
    if (current === undefined || label < current) colors.set(key, label);
  }
  return [...colors].map(([key, label]) => ({ key, label }))
    .sort((a, b) => a.label.localeCompare(b.label, "es"));
}