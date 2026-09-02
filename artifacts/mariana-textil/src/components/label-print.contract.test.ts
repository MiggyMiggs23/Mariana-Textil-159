import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const componentFile = new URL("./label-print.tsx", import.meta.url);

test("roll label keeps the supplied monochrome mark large and renders its name as text", async () => {
  const source = await readFile(componentFile, "utf8");

  assert.match(source, /max-h-\[44mm\] w-full max-w-\[33mm\]/);
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

test("product name and quantity use named discrete font steps without silent truncation", async () => {
  const source = await readFile(componentFile, "utf8");

  assert.match(source, /LABEL_PRODUCT_NAME_FONT_STEPS_PX = \[30, 24, 18, 14\]/);
  assert.match(source, /LABEL_QUANTITY_FONT_STEPS_PX = \[29, 24, 19, 13\]/);
  assert.match(source, /fontSteps=\{LABEL_PRODUCT_NAME_FONT_STEPS_PX\}/);
  assert.match(source, /fontSteps=\{LABEL_QUANTITY_FONT_STEPS_PX\}/);
  assert.match(source, /testId="label-product-name"/);
  assert.match(source, /testId="label-quantity"/);
  assert.match(source, /dataset\.fontStep/);
  assert.match(source, /dataset\.fitState = fits \? "fits" : "overflow"/);
  assert.doesNotMatch(source, /fontSize -= 1/);
});

test("label refits after fonts load and before print while preserving three decimals", async () => {
  const source = await readFile(componentFile, "utf8");

  assert.match(source, /document\.fonts\?\.ready\.then\(\(\) => requestAnimationFrame\(fit\)\)/);
  assert.match(source, /window\.addEventListener\("beforeprint", fit\)/);
  assert.match(source, /parsed\.toFixed\(3\)/);
});