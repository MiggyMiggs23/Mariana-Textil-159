import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const componentFile = new URL("./label-print.tsx", import.meta.url);

test("roll label keeps the supplied monochrome mark large and renders its name as text", async () => {
  const source = await readFile(componentFile, "utf8");

  assert.match(source, /max-h-\[40mm\] w-full max-w-\[30mm\]/);
  assert.match(source, />\s*MARIANA TEXTIL\s*</);
  assert.match(source, /text-\[10px\] font-black/);
  assert.doesNotMatch(source, /justify-center px-\[3mm\] min-w-0/);
});

test("roll label preserves its 100 by 70 millimetre page and QR sizing", async () => {
  const source = await readFile(componentFile, "utf8");

  assert.match(source, /width: '100mm', height: '70mm'/);
  assert.match(source, /width="29mm"/);
  assert.match(source, /height="29mm"/);
  assert.match(source, /style=\{\{ width: "29mm", height: "29mm"/);
});