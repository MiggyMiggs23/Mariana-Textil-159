// Generates the rehearsal only. Does not start any application or database.
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
const root = "/home/runner/workspace";
const rel = "reports/e3-apertura-preparada-20260922";
const dir = path.join(root, rel);
const old = path.join(root, "reports/e3-paquete-liberacion-preparado-20260922");
const sha = s => createHash("sha256").update(s).digest("hex");
const put = (f, s) => fs.writeFileSync(path.join(dir, f), s, { flag: "wx" });
const delta = JSON.parse(fs.readFileSync(path.join(dir, "evidencia/proyeccion/cash-gate-delta.json")));
assert.equal(delta.removedSchema.length, 1);
assert.equal(delta.addedSchema.length, 1);
for (const row of [...delta.removedSchema, ...delta.addedSchema]) {
  assert.equal(row.kind, "function"); assert.equal(row.object_name, "e1_guard_cash_capture_closed");
}
assert.deepEqual(delta.removedAttributes, []); assert.deepEqual(delta.addedAttributes, []);
const retarget = s => s.replaceAll("e3-paquete-liberacion-preparado-20260922", "e3-apertura-preparada-20260922")
  .replaceAll("dist-e3-20260922", "dist-e3-apertura-20260922")
  .replaceAll("E3_CLOSED_RELEASE_PREFLIGHT", "E3_OPEN_RELEASE_PREFLIGHT");
let preflight = retarget(fs.readFileSync(path.join(old, "release-preflight.mjs"), "utf8"))
  .replace("e3: false, e3Directed: false, remate: false, cashGateRetirement: false",
    "e3: true, e3Directed: false, remate: false, cashGateRetirement: true");
// Source constants, not environment overrides, open the ordinary candidate.
// Reject attempts to open unrelated features through environment selectors.
preflight = preflight.replace('"E3_ENABLED", "E3_DIRECTED_ENABLED"', '"E3_DIRECTED_ENABLED"');
put("release-preflight.mjs", preflight);
let audit = retarget(fs.readFileSync(path.join(old, "api-start-audit-record.mjs"), "utf8"))
  .replace("closed: { e3: true, remate: true, cashGateRetirementNotApplied: true }",
    "release: { e3: true, ordinaryCash: true, directed: false, refunds: false, retained: false, remate: false }");
put("api-start-audit-record.mjs", audit);
// The inventory will be repinned after the necessary ordinary-only build revision.
let wrapper = retarget(fs.readFileSync(path.join(old, "api-start-audit.sh"), "utf8"))
  .replace("Candidate E3 CLOSED only.", "Candidate E3 ordinary + cash only, NOT RELEASED.")
  .replace("export E3_ENABLED=false ", "export E3_ENABLED=true ");
put("api-start-audit.template.sh", wrapper);
let harness = retarget(fs.readFileSync(path.join(root, "scripts/src/e3-candidate-start-20260922.mjs"), "utf8"));
harness = harness.replace('const evidence = path.join(packageDir, "evidencia/arranque-candidato");',
  'const attempt = process.env.E3_REHEARSAL_ATTEMPT;\nassert.ok(["r0", "r1", "r1b"].includes(attempt), "Explicit rehearsal r0/r1/r1b required");\nconst evidence = path.join(packageDir, `evidencia/arranque-candidato-${attempt}`);\nassert.ok(!fs.existsSync(evidence), "Refusing to overwrite rehearsal evidence");');
harness = harness.replace('import fs from "node:fs";',
  'import fs from "node:fs";\nimport { exerciseE3 } from "./integration-cash.mjs";');
harness = harness.replace('from "../../reports/e3-apertura-preparada-20260922/release-preflight.mjs"',
  'from "./release-preflight.mjs"');
harness = harness.replace('E3_ENABLED: "false"', 'E3_ENABLED: "true"');
harness = harness.replace('{ ...runtime, E3_ENABLED: "true" }', '{ ...runtime, E3_DIRECTED_ENABLED: "true" }');
harness = harness.replace("Closed feature environment mismatch: E3_ENABLED", "Closed feature environment mismatch: E3_DIRECTED_ENABLED");
harness = harness.replace('  const expected = JSON.parse', `  sql(fs.readFileSync(path.join(packageDir, "sql/03-prepare-ordinary-cash-gate-retirement.REHEARSAL-ONLY.sql"), "utf8"));
  const expected = JSON.parse`);
// Negative copies contain only runtime files, never dependency/source symlinks.
harness = harness.replace('  fs.cpSync(packageDir, path.join(alteredRoot, packageRelative), { recursive: true });', `
  fs.mkdirSync(path.join(alteredRoot, packageRelative));
  for (const file of ["api-start-audit.sh","api-start-audit-record.mjs","release-preflight.mjs",
    "release-catalog.sql","release-expected.json","release-assets.sha256"])
    fs.copyFileSync(path.join(packageDir,file),path.join(alteredRoot,packageRelative,file));`);
harness = harness.replace('  process.kill(-child.pid, "SIGTERM");',
  '  results.functional = await exerciseE3({ sql, evidence, packageDir });\n  process.kill(-child.pid, "SIGTERM");');
harness = harness.replace('  const logged = fs.readFileSync(log, "utf8");', `  // Pino delivery is asynchronous; still require the actual mandatory startup proof.
  let logged = "";
  const logDeadline = Date.now() + 10000;
  while (Date.now() < logDeadline) {
    if (closed) throw new Error("Candidate exited while waiting for INSPECTION log proof.");
    process.kill(child.pid, 0);
    logged = fs.readFileSync(log, "utf8");
    if (/^E3_OPEN_RELEASE_PREFLIGHT=PASS \\{/m.test(logged)
      && /Inspection boot: schema initializers, purchase backfill and stock-minimum monitor are paused/.test(logged)
      && health?.status === 200) break;
    await new Promise(resolve => setTimeout(resolve, 100));
  }`);
harness = harness.replace('results.status = "PASS_CLOSED_PREPARED_NOT_RELEASED"',
  'results.status = "PASS_ORDINARY_CASH_PREPARED_NOT_RELEASED"');
harness = harness.replace('  fs.rmSync(base, { recursive: true, force: true });',
  '  if (!pgStarted || results.postgresStopExit === 0) fs.rmSync(base, { recursive: true, force: true });');
harness = harness.replaceAll('sourceRevision: "95128fc8f2773907c6a34ef2cfeb1f631e84f301"',
  'sourceRevision: JSON.parse(fs.readFileSync(path.join(packageDir,"preparation-status.json"))).sourceRevision');
put("rehearse.mjs", harness);
console.log(JSON.stringify({ status: "GENERATED_NOT_EXECUTED", preflightSha256: sha(preflight),
  harnessSha256: sha(harness), note: "Requires integration-cash.mjs and explicit ordinary-only rebuild/pinning before execution." }));