const QUANTITY_SCALE = 3;
const QUANTITY_FACTOR = 10 ** QUANTITY_SCALE;

export function quantityToThousandths(value: string | number): number {
  const text = String(value).trim();
  const match = /^([+-]?)(\d+)(?:\.(\d+))?$/.exec(text);
  if (!match) {
    throw new Error(`Cantidad decimal inválida: ${text}`);
  }

  const sign = match[1] === "-" ? -1n : 1n;
  const whole = BigInt(match[2]);
  const fraction = (match[3] ?? "").padEnd(QUANTITY_SCALE + 1, "0");
  let scaled =
    whole * BigInt(QUANTITY_FACTOR) +
    BigInt(fraction.slice(0, QUANTITY_SCALE));

  if (Number(fraction[QUANTITY_SCALE]) >= 5) {
    scaled += 1n;
  }

  const result = Number(sign * scaled);
  if (!Number.isSafeInteger(result)) {
    throw new Error(`Cantidad fuera del rango seguro: ${text}`);
  }
  return result;
}

export function formatQuantityThousandths(value: number): string {
  if (!Number.isSafeInteger(value)) {
    throw new Error(`Milésimas fuera del rango seguro: ${value}`);
  }

  const sign = value < 0 ? "-" : "";
  const absolute = Math.abs(value);
  const whole = Math.floor(absolute / QUANTITY_FACTOR);
  const fraction = String(absolute % QUANTITY_FACTOR).padStart(
    QUANTITY_SCALE,
    "0",
  );
  return `${sign}${whole}.${fraction}`;
}