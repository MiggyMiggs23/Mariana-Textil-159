import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { startupMode } from "./startup-mode";

test("normal startup stays unchanged unless inspection is explicitly requested", () => {
  assert.deepEqual(startupMode({}), { kind: "normal" });
  assert.deepEqual(startupMode({ NODE_ENV: "production" }), { kind: "normal" });
  assert.deepEqual(startupMode({ API_INSPECTION_BOOT: "0" }), { kind: "normal" });
});

test("inspection requires explicit development and cannot use an absent/false NODE_ENV as an escape", () => {
  assert.deepEqual(startupMode({ API_INSPECTION_BOOT: "1", NODE_ENV: "development" }), { kind: "inspection" });
  assert.throws(() => startupMode({ API_INSPECTION_BOOT: "1" }));
  assert.throws(() => startupMode({ API_INSPECTION_BOOT: "1", NODE_ENV: "false" }));
  assert.throws(() => startupMode({ API_INSPECTION_BOOT: "1", NODE_ENV: "production" }));
});

test("inspection bypasses schema initialization and returns before writing maintenance", () => {
  const source = readFileSync(new URL("../index.ts", import.meta.url), "utf8");
  assert.match(source, /if \(mode\.kind === "inspection"\)[\s\S]*?SELECT 1[\s\S]*?else if \(mode\.kind === "limited"\)/);
  const afterListen = source.slice(source.indexOf('server.on("listening"'));
  assert.match(afterListen, /if \(nonWritingBoot\)[\s\S]*?installGracefulShutdown[\s\S]*?return;[\s\S]*?backfillCompras/);
});