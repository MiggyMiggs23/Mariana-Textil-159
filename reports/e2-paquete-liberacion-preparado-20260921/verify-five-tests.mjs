import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";

const root = process.argv[2];
if (!root?.startsWith("/tmp/e2-release-preparation-")) throw new Error("Isolated export required.");
const out = path.join(path.dirname(root), "five-test-proof");
fs.mkdirSync(out, { recursive: true });
const relative = "reports/e2-apertura-limitada/evidencia-a-c/01-install-evidence-prepared.sql";
const sqlPath = path.join(root, relative);
const original = fs.readFileSync(sqlPath, "utf8");
const hash = value => createHash("sha256").update(value).digest("hex");
// Reintroduce the obsolete 32-bit tuple-version provenance in the isolated SQL,
// while leaving the production preflight's pinned function bodies unchanged.
const replacements = [
  ["source_xid xid8;", "source_xid xid;"],
  ["retained_xid xid8;", "retained_xid xid;"],
  ["SELECT m.e2_insert_xid,", "SELECT m.xmin,"],
  ["SELECT e2_insert_xid, cliente_id, importe", "SELECT xmin, cliente_id, importe"],
  ["source_xid IS DISTINCT FROM pg_current_xact_id()", "source_xid::text::bigint <> (txid_current() % 4294967296)"],
  ["retained_xid IS DISTINCT FROM pg_current_xact_id()", "retained_xid::text::bigint <> (txid_current() % 4294967296)"],
  ["SELECT e2_insert_xid INTO source_xid", "SELECT xmin INTO source_xid"],
  ["source_xid = pg_current_xact_id()", "source_xid::text::bigint = (txid_current() % 4294967296)"],
];
let mutant = original;
for (const [from, to] of replacements) {
  const expected = from === "source_xid xid8;" ? 2 : 1;
  if (mutant.split(from).length - 1 !== expected) throw new Error(`Unexpected mutation anchor count: ${from}`);
  mutant = mutant.replaceAll(from, to);
}
const cases = [
  ["src/lib/credit-refund.safe.test.ts", "reconciled DDL has one proof owner and independent closed refund gates; no E1 replacement"],
  ["src/lib/limited-startup-preflight.test.ts", "A+C combined inventory supports closed-preserved and rejects each schema drift"],
  ["src/lib/limited-startup-preflight.test.ts", "read-only preflight commits only after schema and all three old guards match"],
  ["src/lib/limited-startup-preflight.test.ts", "dropping the permanent session/site/nature E1 context trigger fails closed"],
  ["src/lib/limited-startup-preflight.test.ts", "a wrong E1 guard fails closed"],
];
const results = [];
try {
  for (const [index, [file, name]] of cases.entries()) {
    const record = { file, name, states: [] };
    for (const [state, sql] of [["positive", original], ["defect", mutant], ["restored", original]]) {
      fs.writeFileSync(sqlPath, sql);
      const result = spawnSync(process.execPath, [
        "--require", path.join(root, "scripts/src/offline-test-guard.cjs"),
        "--import", path.join(root, "scripts/node_modules/tsx/dist/loader.mjs"),
        "--test", "--test-reporter=tap",
        `--test-name-pattern=^${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, file,
      ], {
        cwd: path.join(root, "artifacts/api-server"),
        env: { PATH: process.env.PATH, HOME: path.join(path.dirname(root), "home"),
          LANG: "C.UTF-8", NODE_ENV: "test", DATABASE_URL: "postgresql://e1-offline.invalid:9/forbidden" },
        encoding: "utf8",
      });
      const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
      fs.writeFileSync(path.join(out, `${index + 1}-${state}.tap`), output);
      const correctExit = state === "defect" ? result.status === 1 : result.status === 0;
      const semanticFailure = state !== "defect" || (
        output.includes(`not ok 1 - ${name}`)
        && (index === 0 ? output.includes("ERR_ASSERTION")
          : output.includes("A+C evidence trigger e2_validate_abono_finalization mismatch"))
      );
      record.states.push({ state, exit: result.status, sqlSha256: hash(sql), semanticFailure });
      if (!correctExit || !semanticFailure) {
        results.push(record);
        throw new Error(`Stop: unexpected ${state} outcome for ${name}`);
      }
    }
    results.push(record);
  }
} finally {
  fs.writeFileSync(sqlPath, original);
  fs.writeFileSync(path.join(out, "results.json"), JSON.stringify({
    originalSha256: hash(original), mutantSha256: hash(mutant),
    restoredSha256: hash(fs.readFileSync(sqlPath)), results,
  }, null, 2));
}
console.log(JSON.stringify(results, null, 2));