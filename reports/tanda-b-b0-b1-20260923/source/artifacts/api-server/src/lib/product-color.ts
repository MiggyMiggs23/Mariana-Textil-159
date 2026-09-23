const PRODUCT_COLOR_HEX = /^#[0-9A-Fa-f]{6}$/;

export function canEditProductColorHex(role: string): boolean {
  return role === "ADMIN";
}

export function normalizeProductColorHex(value: string | null): string | null {
  if (value === null) return null;
  if (!PRODUCT_COLOR_HEX.test(value)) {
    throw new Error("El color hexadecimal debe tener el formato #RRGGBB.");
  }
  return value.toUpperCase();
}