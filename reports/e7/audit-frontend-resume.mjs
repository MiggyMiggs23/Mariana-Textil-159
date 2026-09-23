// Evidence inspection only: never starts a native case, app, API or database.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { createHash } from "node:crypto";
import { cases } from "./frontend-mutants-cases.mjs";
const root = process.cwd(), app = "artifacts/mariana-textil";
const require = createRequire(path.join(root, app, "package.json")), ts = require("typescript");
const hash = bytes => createHash("sha256").update(bytes).digest("hex");
const need = (ok, message) => { if (!ok) throw Error(message); };
const dir = "reports/e7/frontend-native-2026-09-23T03-06-55.940Z", file = `${dir}/manifest.json`;
const originalBytes = fs.readFileSync(file), original = JSON.parse(originalBytes);
need(original.status === "FAIL_NOT_ACCEPTED" && original.error.includes("E7-GROUP1-FOUR-green"), "EXPECTED_ORIGINAL_FAIL");
const secondDir = "reports/e7/frontend-native-2026-09-23T03-16-45.147Z";
const secondFile = `${secondDir}/manifest.json`, secondBytes = fs.readFileSync(secondFile), second = JSON.parse(secondBytes);
need(second.status === "FAIL_NOT_ACCEPTED" && second.error.includes("E7-GROUP1-LINKS-green"), "EXPECTED_SECOND_FAIL");
const thirdDir = "reports/e7/frontend-native-2026-09-23T03-31-40.181Z";
const thirdFile = `${thirdDir}/manifest.json`, thirdBytes = fs.readFileSync(thirdFile), third = JSON.parse(thirdBytes);
need(third.status === "FAIL_NOT_ACCEPTED" && third.error.includes("E7-RANGE-green"), "EXPECTED_THIRD_FAIL");
const source = fs.readFileSync(`${app}/src/components/e7-node.dom.test.tsx`, "utf8");
const ast = ts.createSourceFile("e7-node.dom.test.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const declarations = ast.statements.filter(s => ts.isExpressionStatement(s) && ts.isCallExpression(s.expression) && s.expression.expression.getText() === "test");
const prior = [
  ...original.cases.filter(c => c.green && c.red && c.restored).map(c => ({ ...c, evidenceDir: dir, evidenceManifest: original })),
  ...second.cases.filter(c => c.green && c.red && c.restored).map(c => ({ ...c, evidenceDir: secondDir, evidenceManifest: second })),
  ...third.cases.filter(c => c.green && c.red && c.restored).map(c => ({ ...c, evidenceDir: thirdDir, evidenceManifest: third })),
];
need(prior.length === 14 && new Set(prior.map(c => c.id)).size === 14, "EXPECTED_FOURTEEN_PRIOR_TERMINALS");
const terminals = prior.map(row => {
  const registered = cases.find(c => c.id === row.id), declaration = declarations.find(d => d.expression.arguments[0]?.text === row.id);
  const inventory = row.evidenceManifest.caseInventory.find(c => c.id === row.id);
  const productive = fs.readFileSync(`${app}/${registered.file}`);
  need(hash(declaration.getText()) === inventory.caseAstHash, `CASE_AST_DRIFT ${row.id}`);
  need(hash(productive) === inventory.sourceHash && hash(productive) === row.green.sourceHash
    && hash(productive) === row.restored.sourceHash, `PRODUCTIVE_SOURCE_DRIFT ${row.id}`);
  const phases = {};
  for (const phase of ["green", "red", "restored"]) {
    const name = `${row.evidenceDir}/${row.id}-${phase}.json`, bytes = fs.readFileSync(name), native = JSON.parse(bytes);
    const actuals = native.tests.filter(t => !t.skipped);
    need(actuals.length === 1 && actuals[0].name === row.id, `NATIVE_SELECTION ${row.id}:${phase}`);
    const actual = actuals[0], wrapped = actual.code === "ERR_TEST_FAILURE" && actual.failureType === "testCodeFailure";
    if (phase === "red") {
      const message = wrapped ? actual.causeMessage : actual.message;
      need(actual.status === "failed" && (wrapped ? actual.causeCode : actual.code) === "ERR_ASSERTION"
        && (message === row.id || message?.startsWith(`${row.id}\n`)), `NATIVE_RED ${row.id}`);
    } else need(actual.status === "passed", `NATIVE_GREEN ${row.id}:${phase}`);
    phases[phase] = { nativeEvidence: name, evidenceHash: hash(bytes), bundleHash: row[phase].bundleHash,
      sourceHash: row[phase].sourceHash, actual };
  }
  return { id: row.id, originalManifest: `${row.evidenceDir}/manifest.json`, caseAstHash: inventory.caseAstHash, productiveSourceHash: hash(productive), phases };
});
const changedDependencies = Object.entries(original.sourceHashes).filter(([file, before]) => hash(fs.readFileSync(file)) !== before)
  .map(([file, before]) => ({ file, before, after: hash(fs.readFileSync(file)) }));
const testPath = `${app}/src/components/e7-node.dom.test.tsx`;
need(changedDependencies.length === 2 && changedDependencies.every(d => [testPath, `${app}/src/components/e7-node-test-transport.ts`].includes(d.file)), "UNEXPECTED_DEPENDENCY_DRIFT");
const changedHarness = Object.entries(original.harnessHashes).filter(([file, before]) => hash(fs.readFileSync(file)) !== before);
need(changedHarness.length === 0, "RUNNER_OR_MUTANT_DRIFT");
const transportPath = `${app}/src/components/e7-node-test-transport.ts`, currentTransport = fs.readFileSync(transportPath, "utf8");
const removedDocumentAddition = currentTransport
  .replace("export const legacyDocuments: api.ClienteDocumento[] = [];\n", "")
  .replace('  base.routes.set("GET /api/clientes/21/documentos", ({ params }) => {\n    if (params.size !== 0) return unknownAdjacentQuery("/api/clientes/21/documentos");\n    return structuredClone(legacyDocuments);\n  });\n', "");
need(hash(removedDocumentAddition) === second.sourceHashes[transportPath], "CHANGE_NOT_EXCLUSIVELY_DOCUMENT_FIXTURE");
const secondChangedDependencies = Object.entries(second.sourceHashes).filter(([file, before]) => hash(fs.readFileSync(file)) !== before)
  .map(([file, before]) => ({ file, before, after: hash(fs.readFileSync(file)) }));
need(secondChangedDependencies.length === 2 && secondChangedDependencies.every(d => [testPath, transportPath].includes(d.file)), "SECOND_DEPENDENCY_DRIFT");
need(Object.entries(second.harnessHashes).every(([file, before]) => hash(fs.readFileSync(file)) === before), "SECOND_HARNESS_DRIFT");
const thirdChangedDependencies = Object.entries(third.sourceHashes).filter(([file, before]) => hash(fs.readFileSync(file)) !== before)
  .map(([file, before]) => ({ file, before, after: hash(fs.readFileSync(file)) }));
need(thirdChangedDependencies.length === 1 && thirdChangedDependencies[0].file === testPath, "THIRD_DEPENDENCY_DRIFT");
need(Object.entries(third.harnessHashes).every(([file, before]) => hash(fs.readFileSync(file)) === before), "THIRD_HARNESS_DRIFT");
const oldRange = `test("E7-RANGE", async () => {
  await app("E7-RANGE"); await attribution();
  const count = t.requests.filter(r => r.path === "/api/e7/atribucion").length;
  const dates = document.querySelectorAll<HTMLInputElement>('input[type="date"]');
  check(dates.length >= 2);
  await act(async () => {
    fireEvent.change(dates[0], { target: { value: "2024-01-01" } });
    fireEvent.change(dates[1], { target: { value: "2026-09-24" } });
  });
  await until(() => node("e7-range-error"));
  check(!node("e7-collection") && t.requests.filter(r => r.path === "/api/e7/atribucion").length === count);
});`;
const rangeNode = declarations.find(d => d.expression.arguments[0]?.text === "E7-RANGE");
need(hash(oldRange) === third.caseInventory.find(c => c.id === "E7-RANGE").caseAstHash, "OLD_RANGE_AST_MISMATCH");
const reconstructed = source.replace(rangeNode.getText(), oldRange)
  .replace('import { E11ApplicationBoundary } from "../pages/e11";', 'import { E11SessionProvider } from "../lib/e11-session";')
  .replace("<E11ApplicationBoundary>{element}</E11ApplicationBoundary>", "<E11SessionProvider user={actor}>{element}</E11SessionProvider>")
  .replace("// Download extension; the pending RANGE preparation is repaired separately.", "// Download extension: preceding 20 native declaration ASTs remain unchanged.");
need(hash(reconstructed) === third.sourceHashes[testPath], "TEST_CHANGE_EXCEEDS_PENDING_PREPARATION_FIX");
const directParentUsers = declarations.filter(d => d.getText().includes("directParent(")).map(d => d.expression.arguments[0].text);
need(directParentUsers.length === 2 && directParentUsers.every(id => ["E7-COUNTER-BOUNDARY", "E7-SISTEMAS-TIEMPO"].includes(id))
  && !prior.some(row => directParentUsers.includes(row.id)), "SHARED_PARENT_HELPER_AFFECTS_PRIOR_TERMINAL");
const remaining = cases.filter(c => !prior.some(row => row.id === c.id)).map(c => c.id);
need(remaining.length === 9 && remaining[0] === "E7-RANGE", "EXPECTED_NINE_REMAINING");
const command = `node reports/e7/run-frontend-node-mutants.mjs --ids ${remaining.join(",")}`;
const queryReviewFile = "reports/e7/frontend-remaining-dom-review.json", reviewBytes = fs.readFileSync(queryReviewFile);
const review = JSON.parse(reviewBytes), reviewedIds = review.obligations.map(row => row.id);
need(reviewedIds.length === 9 && new Set(reviewedIds).size === 9 && remaining.every(id => reviewedIds.includes(id)), "DOM_REVIEW_NOT_ALL_NINE");
const output = `reports/e7/frontend-resume-audit-${new Date().toISOString().replaceAll(":", "-")}.json`;
fs.writeFileSync(output, JSON.stringify({
  status: "THREE_FAILS_AND_FOURTEEN_TERMINALS_PRESERVED_NINE_PENDING",
  helperCasesExecuted: 0, originalManifest: file, originalManifestHash: hash(originalBytes),
  originalStatus: original.status, originalError: original.error,
  secondManifest: secondFile, secondManifestHash: hash(secondBytes), secondStatus: second.status, secondError: second.error,
  thirdManifest: thirdFile, thirdManifestHash: hash(thirdBytes), thirdStatus: third.status, thirdError: third.error,
  diagnosis: "RANGE used default hoy where the real parent hides date inputs; failure is the input-count positive control, not productive range validation. Review also found raw E11SessionProvider incorrectly used with E11 OFF in the two unexecuted direct-parent obligations.",
  repair: "Pending RANGE now starts with actual custom-preset valid dates, verifies both inputs and dispatched valid range, then changes only the start date. Direct-parent helper now uses the same productive E11ApplicationBoundary as App, preserving real E11-OFF behavior rather than mounting an inner provider that waits forever.",
  dependencyPolicy: "Fourteen original terminal cycles, ASTs and productive-source hashes retained. Latest transport, fixtures and native harness unchanged. Reversing the pending RANGE body, two-use parent wrapper/import and explanatory comment exactly reproduces the third run's test-file SHA. No previously completed case uses that helper. No full-23 PASS claim.",
  requeuedPriorIds: [], priorDependencyHashesSecondRun: second.sourceHashes, priorHarnessHashesSecondRun: second.harnessHashes,
  secondChangedDependencies, documentOnlyAdditionReversesToSecondTransportHash: true,
  thirdChangedDependencies, directParentUsers, testChangesReverseToThirdSourceHash: true,
  rangeAstRepair: { id: "E7-RANGE", before: hash(oldRange), after: hash(rangeNode.getText()), previouslyAccepted: false },
  priorDependencyHashesThirdRun: third.sourceHashes, priorHarnessHashesThirdRun: third.harnessHashes,
  queryReview: queryReviewFile, queryReviewHash: hash(reviewBytes),
  reviewedSourceHashes: Object.fromEntries(review.reviewedSources.map(file => [file, hash(fs.readFileSync(file))])),
  changedDependencies, changedHarness, priorDependencyHashes: original.sourceHashes, priorHarnessHashes: original.harnessHashes,
  terminals, remainingIds: remaining, remainingCount: remaining.length, command,
}, null, 2), { flag: "wx" });
need(hash(fs.readFileSync(file)) === hash(originalBytes), "ORIGINAL_FAIL_CHANGED");
need(hash(fs.readFileSync(secondFile)) === hash(secondBytes), "SECOND_FAIL_CHANGED");
need(hash(fs.readFileSync(thirdFile)) === hash(thirdBytes), "THIRD_FAIL_CHANGED");
console.log(output); console.log(command);