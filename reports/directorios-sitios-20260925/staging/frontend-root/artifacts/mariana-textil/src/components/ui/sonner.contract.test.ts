import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const toasterSource = readFileSync(new URL("./toaster.tsx", import.meta.url), "utf8");
const appSource = readFileSync(new URL("../../App.tsx", import.meta.url), "utf8");

test("the active toaster centers emergent notifications at the top", () => {
  assert.match(appSource, /from "@\/components\/ui\/toaster"/);
  assert.match(toasterSource, /position="top-center"/);
});