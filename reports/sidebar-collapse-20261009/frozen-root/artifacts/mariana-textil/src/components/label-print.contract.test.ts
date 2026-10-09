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
  assert.match(source, /text\.getBoundingClientRect\(\)\.width/);
  assert.match(source, /container\.getBoundingClientRect\(\)\.width/);
  assert.match(source, /container\.closest\("\.label-page"\)/);
  assert.match(source, /text\.scrollWidth/);
  assert.match(source, /text\.scrollHeight/);
  assert.match(source, /wrapTwoLines/);
  assert.match(source, /reportLabelFit\(page, testId \?\? "campo", children, fits\)/);
  assert.match(source, /testId="label-serie"/);
  assert.doesNotMatch(source, /font-black truncate/);
  assert.doesNotMatch(source, /element\.scrollWidth <= element\.clientWidth/);
  assert.doesNotMatch(source, /fontSize -= 1/);
});

test("label refits after fonts load and before print while preserving three decimals", async () => {
  const source = await readFile(componentFile, "utf8");

  assert.match(source, /document\.fonts\?\.ready\.then\(\(\) => requestAnimationFrame\(fit\)\)/);
  assert.match(source, /window\.addEventListener\("beforeprint", beforePrint\)/);
  assert.match(source, /event\.preventDefault\(\)/);
  assert.match(source, /parsed\.toFixed\(3\)/);
  assert.match(source, /testId="label-sku"/);
  assert.match(source, /testId="label-qr-payload"/);
});

test("label tries one line before two, never breaks a word or shrinks below approved steps", async () => {
  const source = await readFile(componentFile, "utf8");
  assert.match(source, /wrapTwoLines \? \[1, 2\] : \[1\]/);
  assert.match(source, /wrapTwoLines && lineLimit === 1 \? fontSteps\.slice\(0, 1\) : fontSteps/);
  assert.match(source, /whiteSpace: "nowrap"/);
  assert.match(source, /wordBreak: "normal", hyphens: "none"/);
  assert.match(source, /fontSize \* 1\.05 \* lineLimit/);
  assert.match(source, /container\.addEventListener\("labelprintmeasure", fit\)/);
  assert.match(source, /container\.getBoundingClientRect\(\)\.width <= 0/);
  assert.match(source, /data-fit-state="pending"/);
  const print = await readFile(new URL("../lib/print.ts", import.meta.url), "utf8");
  assert.ok(print.indexOf("await waitForPrintableAssets();") < print.indexOf('new Event("labelprintmeasure")'));
  assert.ok(print.indexOf('new Event("labelprintmeasure")') < print.indexOf("window.print();"));
  assert.match(print, /document\.fonts\?\.status === "loading"/);
  assert.match(print, /throw new Error\(details\.join/);
  assert.match(print, /page\.closest<HTMLElement>\("\.etiquetas-print"\)/);
  assert.match(print, /portal\.style\.setProperty\("left", "-10000px", "important"\)/);
  assert.match(print, /portal\.setAttribute\("style", style\)/);
});