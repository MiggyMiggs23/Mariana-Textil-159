import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";

const files = ["commercial-return.test.ts", "commercial-return-contract.ts", "credit-allocation.ts", "date-only.ts"];
const originals = new Map(files.map(file => [file, readFileSync(new URL(file, import.meta.url), "utf8")]));
const runner = join(process.cwd(), "node_modules/tsx/dist/cli.mjs");
const mutations = [
  ["fractional-money", "commercial-return-contract.ts", "amount * numerator % denominator !== 0n", "false"],
  ["correction-funded", "commercial-return-contract.ts", "if (input.correctionFunded)", "if (false)"],
  ["closed-gate", "commercial-return-contract.ts", "COMMERCIAL_RETURNS_ENABLED = false", "COMMERCIAL_RETURNS_ENABLED = true"],
  ["targeted-debt", "credit-allocation.ts", "balances.set(target.id, pending - reduction)", "balances.set(target.id, pending)"],
  ["wrong-target", "credit-allocation.ts", "target.ticketId !== source.ticketId", "false"],
] as const;

test("isolated negative mutations reject monetary, source, gate and targeted-debt regressions", () => {
  const directory = mkdtempSync(join(tmpdir(), "commercial-return-mutants-"));
  try {
    for (const [name, file, from, to] of mutations) {
      for (const [path, text] of originals) writeFileSync(join(directory, path), text);
      const original = originals.get(file)!;
      assert.equal(original.split(from).length, 2, `${name}: mutation anchor must be unique`);
      writeFileSync(join(directory, file), original.replace(from, to));
      const result = spawnSync(process.execPath, [runner, "--test", join(directory, "commercial-return.test.ts")], {
        encoding: "utf8", timeout: 30_000,
        env: { PATH: process.env.PATH, NODE_ENV: "test" },
      });
      const output = result.stdout + result.stderr;
      assert.notEqual(result.status, 0, `${name}: mutant survived`);
      assert.match(output, /AssertionError|assertion|ERR_ASSERTION/, `${name}: must fail assertions, not bootstrap`);
    }
    for (const [file, text] of originals) {
      assert.equal(readFileSync(new URL(file, import.meta.url), "utf8"), text, "Live source must remain untouched");
      console.log(`${file} sha256=${createHash("sha256").update(text).digest("hex")}`);
    }
  } finally { rmSync(directory, { recursive: true, force: true }); }
});