import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("customer-sale assembly keeps a visible circular roll counter in sync with scans", async () => {
  const source = await readFile(
    new URL("./salida-venta-cliente-nueva.tsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /const capturedRollCount = series\.length;/);
  assert.match(
    source,
    /data-testid="contador-rollos-capturados"[\s\S]*aria-live="polite"[\s\S]*\{capturedRollCount\}/,
  );
  assert.match(
    source,
    /className="sticky top-4 z-20 flex justify-end pointer-events-none"/,
  );
  assert.match(
    source,
    /data-testid="contador-rollos-capturados"[\s\S]*className="[^"]*rounded-full[^"]*h-32 w-32[^"]*sm:h-40 sm:w-40/,
  );
  assert.match(
    source,
    /setSeries\(\(current\) => \[\.\.\.current, value\]\)/,
  );
  assert.match(
    source,
    /setSeries\(\(current\) =>\s*current\.filter\(\(item\) => item !== value\)/,
  );
});