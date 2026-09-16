import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { startupMode } from "./startup-mode";

test("normal startup stays unchanged unless inspection is explicitly requested", () => {
  assert.equal(startupMode({}), "normal");
  assert.equal(startupMode({ NODE_ENV: "production" }), "normal");
  assert.equal(startupMode({ API_INSPECTION_BOOT: "0" }), "normal");
});

test("inspection is safe when NODE_ENV is absent from the second shell command", () => {
  assert.equal(startupMode({ API_INSPECTION_BOOT: "1" }), "inspection");
  assert.equal(startupMode({ API_INSPECTION_BOOT: "1", NODE_ENV: "development" }), "inspection");
  assert.throws(() => startupMode({ API_INSPECTION_BOOT: "1", NODE_ENV: "production" }));
});

test("inspection bypasses schema initialization and returns before writing maintenance", () => {
  const source = readFileSync(new URL("../index.ts", import.meta.url), "utf8");
  assert.match(source, /if \(inspectionBoot\)[\s\S]*?SELECT 1[\s\S]*?else\s*\{\s*await ensureStartupSchemas\(\)/);
  const afterListen = source.slice(source.indexOf('server.on("listening"'));
  assert.match(afterListen, /if \(inspectionBoot\)[\s\S]*?installGracefulShutdown[\s\S]*?return;[\s\S]*?backfillCompras/);
});