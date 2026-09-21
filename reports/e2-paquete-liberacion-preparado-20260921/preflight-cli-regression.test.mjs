import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
const directory = path.dirname(fileURLToPath(import.meta.url));
test("symlink CLI must execute checks and reject missing inspection environment", t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "e2-preflight-cli-regression-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const link = path.join(root, "preflight.mjs");
  fs.symlinkSync(path.join(directory, "release-preflight.mjs"), link);
  const result = spawnSync(process.execPath, [link], {
    env: { PATH: process.env.PATH, HOME: root, LANG: "C.UTF-8" }, encoding: "utf8",
  });
  assert.notEqual(result.status, 0, "A skipped preflight must never return success.");
  assert.match(result.stderr, /E2_RELEASE_PREFLIGHT=FAIL INSPECTION environment mismatch/);
});