import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("salida status presentation contains exactly the five lifecycle labels", async () => {
  const status = await readFile(
    new URL("../components/salida-estado-badge.tsx", import.meta.url),
    "utf8",
  );
  const entries = [...status.matchAll(/^\s{2}(ARMANDO|EN_TRANSITO|RECIBIDA|ENTREGADA|CANCELADA): \{ label: "([^"]+)"/gm)];

  assert.deepEqual(
    entries.map((entry) => [entry[1], entry[2]]),
    [
      ["ARMANDO", "Armando"],
      ["EN_TRANSITO", "En tránsito"],
      ["RECIBIDA", "Recibida"],
      ["ENTREGADA", "Entregada"],
      ["CANCELADA", "Cancelada"],
    ],
  );
  assert.doesNotMatch(status, /\bENVIADA\b/);
});

test("desktop and mobile salida rows render the same shared component from salida.estado", async () => {
  const list = await readFile(new URL("./salidas.tsx", import.meta.url), "utf8");
  const detail = await readFile(new URL("./salida-detail.tsx", import.meta.url), "utf8");

  assert.equal(
    (list.match(/<SalidaEstadoBadge estado=\{salida\.estado\} \/>/g) ?? []).length,
    2,
  );
  assert.match(detail, /<SalidaEstadoBadge estado=\{salida\.estado\} \/>/);
  assert.doesNotMatch(list, /function EstadoBadge/);
  assert.doesNotMatch(detail, /function EstadoBadge/);
});

test("salida list and detail have cross-session freshness and lifecycle invalidations", async () => {
  const list = await readFile(new URL("./salidas.tsx", import.meta.url), "utf8");
  const detail = await readFile(new URL("./salida-detail.tsx", import.meta.url), "utf8");
  const reception = await readFile(
    new URL("../components/recepcion-salidas.tsx", import.meta.url),
    "utf8",
  );
  const ticket = await readFile(new URL("./ticket-detail.tsx", import.meta.url), "utf8");

  for (const source of [list, detail]) {
    assert.match(source, /refetchInterval: 30_000/);
    assert.match(source, /refetchOnWindowFocus: true/);
  }
  assert.match(detail, /const invalidate = \(\) => \{[\s\S]*getGetSalidaQueryKey\(id\)[\s\S]*getListSalidasQueryKey\(\)/);
  assert.match(detail, /Salida entregada[\s\S]*invalidate\(\)/);
  assert.match(reception, /getListSalidasRecepcionQueryKey\(\)[\s\S]*getGetSalidaRecepcionQueryKey\(received\.id\)[\s\S]*getListSalidasQueryKey\(\)[\s\S]*getGetSalidaQueryKey\(received\.id\)/);
  assert.match(ticket, /getListSalidasQueryKey\(\)/);
  assert.match(ticket, /getGetSalidaQueryKey\(salida\.id\)/);
});