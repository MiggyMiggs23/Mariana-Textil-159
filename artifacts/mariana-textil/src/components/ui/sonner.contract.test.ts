import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("./sonner.tsx", import.meta.url), "utf8");

test("emergent notifications are centered at the top", () => {
  assert.match(source, /position="top-center"/);
});