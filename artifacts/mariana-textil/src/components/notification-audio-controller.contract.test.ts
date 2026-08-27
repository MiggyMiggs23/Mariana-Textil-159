import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(
  new URL("./notification-audio-controller.tsx", import.meta.url),
  "utf8",
);

test("notification audio requires activation and serializes deduplicated events", () => {
  assert.match(source, /Activar sonido/);
  assert.match(source, /context\.state !== "running"/);
  assert.match(source, /`\$\{event\.id\}:\$\{event\.updatedAt\}`/);
  assert.match(source, /sessionStorage\.setItem/);
  assert.match(source, /new BroadcastChannel/);
  assert.match(source, /mariana:notification-audio:leader/);
  assert.match(source, /while \(queueRef\.current\.length/);
  assert.match(source, /await playFamily\(item\.family\)/);
  assert.match(source, /role !== Role\.CAJA/);
  assert.match(source, /wakeLock\.request\("screen"\)/);
  assert.match(source, /document\.visibilityState === "visible"/);
});