// Read-only evidence audit. Does not execute tests/builds/apps or rewrite evidence.
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
const dir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(dir, "../../..");
const hash = data => createHash("sha256").update(data).digest("hex");
const read = file => fs.readFileSync(file);
const runs = [
  "frontend-node-mutants-2026-09-22T19-51-29.604Z",
  "frontend-node-mutants-2026-09-22T19-56-12.418Z",
  "frontend-node-mutants-2026-09-22T20-01-38.538Z",
];
const result = { mode: "READ_ONLY_POST_EXECUTION_AUDIT", runs: [], acceptedE12: [], acceptedE4: [], errors: [] };
const check = (condition, message) => { if (!condition) result.errors.push(message); };
for (const run of runs) {
  const location = path.join(dir, run);
  const manifestBytes = read(path.join(location, "manifest.json"));
  const m = JSON.parse(manifestBytes);
  const summary = {
    run, originalStatus: m.status, manifestSha256: hash(manifestBytes),
    finishedAtPresent: !!m.finishedAt, sourcesChecked: 0, sourceMismatches: [],
    harnessFilesChecked: 0, harnessMismatches: [], acceptedIds: [], incompleteIds: [],
  };
  for (const [file, expected] of Object.entries(m.sourceHashes)) {
    summary.sourcesChecked++;
    const actual = fs.existsSync(path.join(root, file)) ? hash(read(path.join(root, file))) : null;
    if (actual !== expected) summary.sourceMismatches.push({ file, expected, actual });
  }
  for (const [file, expected] of Object.entries(m.harnessHashes)) {
    summary.harnessFilesChecked++;
    const actual = hash(read(path.resolve(dir, file)));
    if (actual !== expected) summary.harnessMismatches.push({ file, expected, actual });
  }
  for (const c of m.cases) {
    const paired = c.mode === "E12_GREEN_SEMANTIC_RED_RESTORED";
    if (!c.green || (paired && (!c.red || !c.restored))) {
      summary.incompleteIds.push(c.id);
      continue;
    }
    const planned = m.plannedCases.find(p => p.id === c.id);
    const file = `artifacts/mariana-textil/${planned.file}`;
    const source = read(path.join(root, file));
    const expectedOriginal = m.sourceHashes[file];
    const hookHarness = `artifacts/mariana-textil/src/components/${paired ? "e12" : "e4"}-node-test-harness.tsx`;
    for (const snapshot of paired ? [c.greenSandbox, c.redSandbox] : [c.greenSandbox]) {
      for (const input of [`artifacts/mariana-textil/${c.testFile}`, hookHarness])
        check(hash(read(path.join(snapshot, input))) === m.sourceHashes[input], `${c.id}: physical test/hook harness mismatch ${input}`);
      for (const input of ["frontend-offline-guard.cjs", "frontend-node-dom.cjs", "frontend-node-reporter.mjs", "frontend-node-build.mjs", "frontend-e4-off-flags.mjs"])
        check(hash(read(path.join(snapshot, "artifacts/mariana-textil", input))) === m.harnessHashes[input], `${c.id}: physical infrastructure mismatch ${input}`);
    }
    check(hash(source) === expectedOriginal && c.originalHash === expectedOriginal, `${run}/${c.id}: productive original mismatch`);
    check(c.testHash === m.sourceHashes[`artifacts/mariana-textil/${c.testFile}`], `${run}/${c.id}: test hash mismatch`);
    if (paired) {
      const text = source.toString();
      check(text.split(planned.before).length === 2, `${c.id}: nonunique mutation anchor`);
      const mutantHash = hash(text.replace(planned.before, planned.after));
      check(mutantHash === c.mutantHash && mutantHash === c.red.caseSourceHash, `${c.id}: mutant hash mismatch`);
      check(c.restored.caseSourceHash === expectedOriginal, `${c.id}: restored phase source mismatch`);
      check(hash(read(path.join(c.redSandbox, file))) === expectedOriginal, `${c.id}: restored physical source mismatch`);
      check(hash(read(path.join(c.redSandbox, "artifacts/mariana-textil/case.test.cjs"))) === c.restored.bundleHash, `${c.id}: restored physical bundle mismatch`);
    }
    check(c.green.caseSourceHash === expectedOriginal, `${c.id}: green phase source mismatch`);
    check(hash(read(path.join(c.greenSandbox, file))) === expectedOriginal, `${c.id}: green physical source mismatch`);
    check(hash(read(path.join(c.greenSandbox, "artifacts/mariana-textil/case.test.cjs"))) === c.green.bundleHash, `${c.id}: green physical bundle mismatch`);
    for (const phase of paired ? ["green", "red", "restored"] : ["green"]) {
      const prefix = `${c.id}-${phase}`;
      const recorded = c[phase];
      const raw = JSON.parse(read(path.join(location, `${prefix}.json`)));
      const executed = raw.tests.filter(t => !t.skipped);
      check(executed.length === 1 && executed[0].name === c.id, `${prefix}: wrong native selection`);
      check(JSON.stringify(executed[0]) === JSON.stringify(recorded.actual), `${prefix}: raw report disagrees with manifest`);
      const log = read(path.join(location, `${prefix}.log`)).toString();
      check(!/E4_OFFLINE|E4_.*ESCAPE|SyntaxError|ERR_MODULE_NOT_FOUND|MODULE_NOT_FOUND/.test(log), `${prefix}: infrastructure failure`);
      check(read(path.join(location, `${prefix}-build.log`)).toString().includes("BUNDLE_ONLY_OK"), `${prefix}: missing successful build terminal`);
      const actual = executed[0];
      if (phase === "red") {
        const wrapped = actual.code === "ERR_TEST_FAILURE" && actual.failureType === "testCodeFailure";
        check(recorded.exit === 1 && actual.status === "failed" &&
          (wrapped ? actual.causeCode : actual.code) === "ERR_ASSERTION" &&
          (wrapped ? actual.causeMessage : actual.message)?.includes(planned.assertion),
        `${prefix}: missing own semantic assertion`);
      } else check(recorded.exit === 0 && actual.status === "passed", `${prefix}: not terminal GREEN`);
    }
    summary.acceptedIds.push(c.id);
    (paired ? result.acceptedE12 : result.acceptedE4).push(c.id);
  }
  result.runs.push(summary);
}
check(new Set(result.acceptedE12).size === 33 && result.acceptedE12.length === 33, "E12 coverage/duplication mismatch");
check(new Set(result.acceptedE4).size === 15 && result.acceptedE4.length === 15, "E4 coverage/duplication mismatch");
for (const [index, run] of result.runs.entries()) {
  check(run.harnessMismatches.length === 0, `${run.run}: runner/guard changed`);
  check(run.sourceMismatches.length === (index === 0 ? 1 : 0), `${run.run}: unexpected live source differences`);
  if (index === 0) check(run.sourceMismatches[0]?.file === "artifacts/mariana-textil/src/components/e12-node-test-harness.tsx", "Unexpected first-run source mismatch");
}
console.log(JSON.stringify(result, null, 2));
process.exitCode = result.errors.length ? 1 : 0;