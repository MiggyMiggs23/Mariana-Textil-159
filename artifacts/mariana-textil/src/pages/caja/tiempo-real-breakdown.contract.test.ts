import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("realtime cards have fixed order and exactly six cards open their own detail", async () => {
  const source = await readFile(new URL("./tiempo-real.tsx", import.meta.url), "utf8");
  const labels = [
    "Ventas (Total)",
    "Cobrado (Caja)",
    "Ventas a crédito",
    "Utilidad",
    "Ventas pendientes de cobro o autorización",
    "Salidas en tránsito",
    "Tickets cancelados",
    "Salidas canceladas",
  ];
  const positions = labels.map((label) => source.indexOf(label));
  assert.ok(positions.every((position) => position >= 0));
  assert.deepEqual([...positions].sort((a, b) => a - b), positions);
  assert.equal((source.match(/openBreakdown\("/g) ?? []).length, 12);
  // These two cards have no detail: do not invent reconciliation coverage for them.
  const cards = [...source.matchAll(/<Card\b[\s\S]*?<\/Card>/g)].map(([card]) => card);
  for (const label of ["Ventas (Total)", "Utilidad"]) {
    const card = cards.find((value) => value.includes(label));
    assert.ok(card, `${label} must exist`);
    assert.doesNotMatch(card, /openBreakdown/);
  }
});

test("realtime detail stays in a responsive dialog with folio as its only row link", async () => {
  const source = await readFile(new URL("./tiempo-real.tsx", import.meta.url), "utf8");
  const dialog = source.slice(source.indexOf("<Dialog"), source.lastIndexOf("</Dialog>"));
  assert.match(dialog, /w-\[calc\(100vw-1rem\)\]/);
  assert.match(dialog, /overflow-auto/);
  assert.equal((dialog.match(/<Link /g) ?? []).length, 2);
  assert.match(dialog, /href=\{`\/tickets\/\$\{item\.id\}`\}/);
  assert.match(dialog, /href=\{item\.href\}/);
});

test("salida cards show counts only; cancelled tickets and all detail rows retain amounts", async () => {
  const source = await readFile(new URL("./tiempo-real.tsx", import.meta.url), "utf8");
  const cards = [...source.matchAll(/<Card\b[\s\S]*?<\/Card>/g)].map(([card]) => card);
  for (const [label, field] of [
    ["Salidas en tránsito", "salidasEnTransito"],
    ["Salidas canceladas", "salidasCanceladas"],
  ]) {
    const card = cards.find((value) => value.includes(label));
    assert.ok(card, `${label} must exist`);
    assert.ok(card.includes(`formatCountLabel(dashboard.${field}.conteo, "salida", "salidas")`));
    assert.ok(!card.includes(`dashboard.${field}.importe`), `${label} must not display an amount`);
    assert.doesNotMatch(card, /kind: "money"/);
  }
  const cancelled = cards.find((value) => value.includes("Tickets cancelados"));
  assert.ok(cancelled);
  assert.match(cancelled, /formatCountLabel\(dashboard\.cancelaciones\.tickets/);
  assert.match(cancelled, /formatNumber\(dashboard\.cancelaciones\.importe, \{ kind: "money" \}\)/);
  const dialog = source.slice(source.indexOf("<Dialog"), source.lastIndexOf("</Dialog>"));
  assert.equal((dialog.match(/formatNumber\(item\.importe, \{ kind: "money" \}\)/g) ?? []).length, 2);
});