/**
 * SKU generation utility for Mariana Textil products.
 *
 * Rules:
 * - Uppercase, remove accents/special chars (keep alphanumeric only)
 * - Textile prefix (tela) uses first 3 chars of each word joined, max 12 chars
 *   - But numeric or short alphanumeric tokens (<= 4 chars after cleaning) are preserved fully
 *   - Longer alphanumeric tokens use first 3 chars
 * - Color: first 3 cleaned chars
 * - Append suffix (2, 3...) on collisions
 * - Format: <TELA_PREFIX>-<COLOR_PREFIX>
 */

/**
 * Normalize a string: uppercase, remove accents, keep only alphanumeric chars.
 */
function normalize(str: string): string {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip combining diacritics
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

/**
 * Canonical catalog text normalization shared by every product write path.
 * It preserves accents, trims/collapses whitespace and applies catalog Title
 * Case. Short Spanish articles/prepositions stay lowercase except at the
 * beginning; existing intentional interior camel case is retained.
 */
export function normalizeCatalogTitleCase(value: string): string {
  const shortWords = new Set([
    "de", "del", "la", "las", "el", "los", "y", "e", "en", "con", "por", "para",
  ]);
  return value.trim().replace(/\s+/g, " ").split(" ").map((word, index) => {
    const lower = word.toLocaleLowerCase("es-MX");
    if (index > 0 && shortWords.has(lower)) return lower;
    // Measurement units use a stable display convention.
    if (lower === "mm") return "Mm";
    // Preserve an intentional interior capital (e.g. PomPon), while still
    // normalizing plain lowercase or all-uppercase catalog input.
    const hasInteriorCapital = /[A-ZÁÉÍÓÚÜÑ][a-záéíóúüñ]/.test(word.slice(1));
    const rest = hasInteriorCapital ? word.slice(1) : lower.slice(1);
    return word.charAt(0).toLocaleUpperCase("es-MX") + rest;
  }).join(" ");
}

/**
 * Compute the SKU prefix for a tela (fabric) name.
 * At most the first 3 words are used. Each word token is cleaned, then:
 *   - Pure numeric token → preserved fully (e.g. "50", "4", "15")
 *   - All other tokens → first 3 chars
 * All token contributions are joined and the result is capped to 12 chars.
 */
export function telaPrefix(tela: string): string {
  const words = tela.trim().split(/\s+/).slice(0, 3);
  const parts = words.map((word) => {
    const clean = normalize(word);
    if (clean.length === 0) return "";
    // Pure numeric token → preserve fully
    if (/^\d+$/.test(clean)) {
      return clean;
    }
    return clean.slice(0, 3);
  });
  return parts.join("").slice(0, 12);
}

/**
 * Compute the SKU prefix for a color name (first 3 normalized chars).
 */
export function colorPrefix(color: string): string {
  const words = color.trim().split(/\s+/);
  // Use only the first word for color prefix
  const clean = normalize(words[0] ?? "");
  return clean.slice(0, 3);
}

/**
 * Generate a base SKU (no collision suffix) from tela and color.
 */
export function generateBaseSku(tela: string, color: string): string {
  const tp = telaPrefix(tela);
  const cp = colorPrefix(color);
  return `${tp}-${cp}`;
}

/**
 * Generate a collision-safe SKU.
 * @param tela - Fabric name
 * @param color - Color name
 * @param existingSkus - Set of already-existing SKUs
 * @returns A unique SKU
 */
export function generateSku(
  tela: string,
  color: string,
  existingSkus: Set<string>,
): string {
  const base = generateBaseSku(tela, color);
  if (!existingSkus.has(base)) {
    return base;
  }
  let counter = 2;
  while (true) {
    const candidate = `${base}${counter}`;
    if (!existingSkus.has(candidate)) {
      return candidate;
    }
    counter++;
  }
}
