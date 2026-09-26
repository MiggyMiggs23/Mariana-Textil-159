import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const root = new URL("./equipos/", import.meta.url);

test("equipos form exposes exactly the seven catalog types in display order", async () => {
  const form = await readFile(new URL("./equipo-form-dialog.tsx", root), "utf8");
  const options = Array.from(
    form.matchAll(/<SelectItem value="([^"]+)">([^<]+)<\/SelectItem>/g),
    ([, value, label]) => [value, label] as const,
  );

  assert.deepEqual(options, [
    ["COMPUTADORA_POS", "Computadora POS"],
    ["IMPRESORA_ENTRADAS", "Impresora de entradas"],
    ["IMPRESORA_SALIDAS_NOTAS", "Impresora de salidas/notas"],
    ["IMPRESORA_ETIQUETAS", "Impresora de etiquetas"],
    ["IMPRESORA_TICKETS", "Impresora térmica de tickets"],
    ["PISTOLA_ESCANER", "Pistola Escáner"],
    ["SMARTPHONE_ESCANER", "Smartphone Escáner"],
  ]);
});

test("equipos list sorts all seven catalog types in the same display order", async () => {
  const page = await readFile(new URL("./index.tsx", root), "utf8");
  const order = Array.from(
    page.matchAll(/^\s+([A-Z_]+): ([1-7]),$/gm),
    ([, value, position]) => [value, Number(position)] as const,
  );

  assert.deepEqual(order, [
    ["COMPUTADORA_POS", 1],
    ["IMPRESORA_ENTRADAS", 2],
    ["IMPRESORA_SALIDAS_NOTAS", 3],
    ["IMPRESORA_ETIQUETAS", 4],
    ["IMPRESORA_TICKETS", 5],
    ["PISTOLA_ESCANER", 6],
    ["SMARTPHONE_ESCANER", 7],
  ]);
});

test("equipment checklist UI consumes server checklist items without defining a duplicate catalog", async () => {
  const checklist = await readFile(new URL("./equipo-checklist-dialog.tsx", root), "utf8");

  assert.match(checklist, /useState\(equipo\.checklist\)/);
  assert.match(checklist, /optimisticChecklist\.map\(\(item\)/);
  assert.match(checklist, /setOptimisticChecklist\(data\.checklist\)/);
  assert.doesNotMatch(
    checklist,
    /\b(?:DEFINICIONES_EQUIPO|CHECKLIST_DEFINITIONS|checklistDefinitions)\b/,
  );
});