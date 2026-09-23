import fs from "node:fs";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

const root = "/home/runner/workspace";
const commands = {
  "api-server": "cd /home/runner/workspace && API_STARTUP_MODE=NORMAL API_INSPECTION_BOOT=1 NODE_ENV=development exec node artifacts/api-server/dist-e3-apertura-20260922/index.mjs",
  "mariana-textil": 'cd /home/runner/workspace/artifacts/mariana-textil && exec pnpm exec vite preview --config vite.config.ts --outDir dist-e3-apertura-20260922 --host 0.0.0.0 --port "$PORT" --strictPort',
};

for (const [artifact, command] of Object.entries(commands)) {
  const dir = `${root}/artifacts/${artifact}/.replit-artifact`;
  const original = fs.readFileSync(`${dir}/artifact.toml`, "utf8");
  const pattern = /(\[services\.development\]\r?\n)run = [^\r\n]+/g;
  assert.equal([...original.matchAll(pattern)].length, 1);
  const candidate = original.replace(pattern, (_, header) => `${header}run = ${JSON.stringify(command)}`);
  const target = `${dir}/artifact.continuacion-e3.tmp.toml`;
  fs.writeFileSync(target, candidate, { flag: "wx" });
  const checked = spawnSync("python3", ["-c", `
import json, sys, tomllib
with open(sys.argv[1], "rb") as f:
    original = tomllib.load(f)
with open(sys.argv[2], "rb") as f:
    candidate = tomllib.load(f)
command = sys.argv[3]
assert candidate["services"][0]["development"]["run"] == command
original["services"][0]["development"]["run"] = command
assert original == candidate, "Unexpected configuration change"
print(json.dumps({"parser": "python3.tomllib", "result": "PASS", "path": sys.argv[2]}))
`, `${dir}/artifact.toml`, target, command], { encoding: "utf8" });
  process.stdout.write(checked.stdout);
  process.stderr.write(checked.stderr);
  assert.equal(checked.status, 0, "TOML validation failed; STOP");
  const shellCheck = spawnSync("bash", ["-n", "-c", command], { encoding: "utf8" });
  process.stderr.write(shellCheck.stderr);
  assert.equal(shellCheck.status, 0, "Shell syntax validation failed; STOP");
}