import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("realtime cards have fixed order and only the three component cards open detail", async () => {
  const source = await readFile(new URL("./tiempo-real.tsx", import.meta.url), "utf8");
  const labels = [
    "Ventas (Total)",
    "Cobrado (Caja)",
    "Ventas a crédito",
    "Utilidad",
    "Ventas pendientes de cobro o autorización",
  ];
  const positions = labels.map((label) => source.indexOf(label));
  assert.ok(positions.every((position) => position >= 0));
  assert.deepEqual([...positions].sort((a, b) => a - b), positions);
  assert.equal((source.match(/openBreakdown\("/g) ?? []).length, 6);
  assert.doesNotMatch(source.slice(source.indexOf("Ventas (Total)"), source.indexOf("Cobrado (Caja)")), /openBreakdown/);
});

test("realtime detail stays in a responsive dialog with folio as its only row link", async () => {
  const source = await readFile(new URL("./tiempo-real.tsx", import.meta.url), "utf8");
  const dialog = source.slice(source.indexOf("<Dialog"), source.lastIndexOf("</Dialog>"));
  assert.match(dialog, /w-\[calc\(100vw-1rem\)\]/);
  assert.match(dialog, /overflow-auto/);
  assert.equal((dialog.match(/<Link /g) ?? []).length, 1);
  assert.match(dialog, /href=\{`\/tickets\/\$\{item\.id\}`\}/);
});