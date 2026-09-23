// Posthoc evidence audit only: never builds or executes a test/application.
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

const inputs = process.argv.slice(2);
if (!inputs.length) throw Error("Usage: node check-frontend-duplicate-keys.mjs <manifest.json> [...]");
const hash = bytes => createHash("sha256").update(bytes).digest("hex");
const problems = [], manifests = [], logs = [];
const warning = /Encountered two children with the same key|Non-unique keys may cause children|Each child in a list should have a unique ["']key["']/i;
for (const input of inputs) {
  try {
    const bytes = fs.readFileSync(input), manifest = JSON.parse(bytes);
    manifests.push({ path: input, sha256: hash(bytes), status: manifest.status });
    if (manifest.status !== "PASS_SELECTED_DECLARED_UI_OBLIGATIONS_NOT_FULL_E11"
      || manifest.mode !== "GREEN_SPECIFIC_RED_RESTORED"
      || manifest.changed?.length || manifest.changedHarness?.length
      || manifest.cleanupErrors?.length
      || manifest.cases.length !== manifest.selectedCount) {
      problems.push({ manifest: input, error: "E11_NONTERMINAL_OR_INVALID_RUN" });
    }
    for (const id of manifest.selectedIds) {
      const row = manifest.cases.find(c => c.id === id);
      for (const phase of ["green", "red", "restored"]) {
        const file = path.join(path.dirname(input), `${id}-${phase}.log`);
        if (!row?.[phase]) {
          problems.push({ manifest: input, id, phase, error: "E11_PHASE_NOT_RECORDED" });
          continue;
        }
        try {
          const bytes = fs.readFileSync(file);
          const lines = bytes.toString().split(/\r?\n/).flatMap((line, index) => warning.test(line) ? [index + 1] : []);
          logs.push({ path: file, sha256: hash(bytes), warningLines: lines });
          if (lines.length) problems.push({ manifest: input, id, phase, error: "E11_DUPLICATE_OR_NONUNIQUE_REACT_KEYS", lines });
        } catch (e) { problems.push({ path: file, error: String(e) }); }
      }
    }
  } catch (e) { problems.push({ manifest: input, error: String(e) }); }
}
const output = path.join(path.dirname(fileURLToPath(import.meta.url)), `frontend-duplicate-keys-${new Date().toISOString().replaceAll(":", "-")}.json`);
const status = problems.length ? "FAIL_REACT_KEY_WARNING_CLOSURE" : "PASS_ZERO_REACT_KEY_WARNINGS_POSTHOC_ONLY";
fs.writeFileSync(output, JSON.stringify({ status, manifests, logs, problems, testsExecuted: 0,
  scope: "Additional closure gate for all three phase logs; not a substitute for exact GREEN/ERR_ASSERTION RED/restored validation or suite coverage." }, null, 2), { flag: "wx" });
console.log(`${output} (${status})`);
if (problems.length) process.exitCode = 1;