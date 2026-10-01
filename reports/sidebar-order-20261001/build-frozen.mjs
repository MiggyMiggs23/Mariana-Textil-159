import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const report = path.join(root, "reports/sidebar-order-20261001");
const prior = path.join(root, "reports/driver-multiple-phones-20261001/frozen-root");
const ui = "artifacts/mariana-textil";
const active = path.join(root, ui, "dist-driver-phones-20261001");
const frozen = path.join(report, "frozen-root");
const output = path.join(root, ui, "dist-sidebar-order-20261001");
const approved = ["app-navigation.ts", "app-layout.tsx"].map(name => `${ui}/src/components/layout/${name}`);
const testOnly = [`${ui}/src/components/app-navigation.contract.test.ts`];
const overlay = [...approved, ...testOnly];
const libraries = ["api-client-react", "api-zod", "metered-pricing", "number-format", "scanned-code"];
const retainedPaths = [ui, ...libraries.map(name => `lib/${name}`),
  ...fs.readdirSync(path.join(prior, "lib"), { withFileTypes: true }).filter(entry => entry.isFile()).map(entry => `lib/${entry.name}`),
  "tsconfig.base.json", "attached_assets", "reports/e7"];
const read = file => fs.readFileSync(file);
const sha = value => crypto.createHash("sha256").update(value).digest("hex");
const write = (file, content) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
};
const json = (file, value) => write(file, JSON.stringify(value, null, 2) + "\n");
const skip = name => ["node_modules", ".vite", ".vite-temp"].includes(name) || name.endsWith(".tsbuildinfo");
function inventory(dir, exclude = skip) {
  const result = {};
  function walk(current) {
    for (const entry of fs.readdirSync(current, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      if (exclude(entry.name)) continue;
      const file = path.join(current, entry.name);
      const relative = path.relative(dir, file);
      if (entry.isDirectory()) walk(file);
      else if (entry.isFile()) result[relative] = sha(read(file));
      else if (entry.isSymbolicLink()) result[relative] = { link: fs.readlinkSync(file) };
    }
  }
  walk(dir);
  return result;
}
function selectedInventory() {
  return Object.fromEntries(Object.entries(inventory(prior)).filter(([file]) =>
    retainedPaths.some(selected => file === selected || file.startsWith(selected + "/")),
  ));
}
const guards = () => ({ retained: inventory(prior), activeFrontend: inventory(active, () => false) });
const provenancePath = path.join(report, "baseline-provenance.json");
if (process.argv.includes("--prepare")) {
  assert.ok(!fs.existsSync(provenancePath), "Baseline already captured");
  const baseline = guards();
  const manifest = JSON.parse(read(path.join(root, "reports/driver-multiple-phones-20261001/combined-build-manifest.json")));
  assert.deepEqual(baseline.activeFrontend, manifest.frontendFiles, "Active output does not match retained manifest");
  for (const file of approved) assert.equal(sha(read(path.join(report, "original", path.basename(file)))), baseline.retained[file], `Saved pre-edit source differs from retained baseline: ${file}`);
  json(provenancePath, {
    status: "BASELINE_CAPTURED_AWAITING_MAIN_SOURCE_READY",
    baselineFrontend: path.relative(root, active),
    baselineFrozen: path.relative(root, prior),
    approved,
    retainedPaths,
    guards: baseline,
    policy: "Retain active UI source, shared libraries and typecheck support byte-for-byte; overlay only MAIN-approved navigation and layout files. No HEAD snapshot.",
  });
  console.log("Baseline captured; build awaits explicit MAIN source-ready notification.");
} else if (process.argv.includes("--build-after-main-ready")) {
  const provenance = JSON.parse(read(provenancePath));
  assert.deepEqual(guards(), provenance.guards, "Retained source or active UI drift");
  if (process.argv.includes("--retry-prebuild")) {
    assert.ok(!fs.existsSync(output) && !fs.existsSync(path.join(report, "build-manifest.json")), "Retry forbidden after candidate emission");
    for (const name of ["ui-typecheck", "ui-focused-tests", "ui-build"]) {
      fs.copyFileSync(path.join(report, `${name}.log`), path.join(report, `${name}-first-attempt.log`));
    }
    fs.rmSync(frozen, { recursive: true, force: true });
  }
  assert.ok(!fs.existsSync(frozen) && !fs.existsSync(output), "Refusing to overwrite candidate");
  const before = selectedInventory();
  fs.mkdirSync(frozen, { recursive: true });
  for (const selected of retainedPaths) {
    fs.cpSync(path.join(prior, selected), path.join(frozen, selected), {
      recursive: true, verbatimSymlinks: true, filter: source => !skip(path.basename(source)),
    });
  }
  assert.deepEqual(inventory(frozen), before, "Retained copy differs");
  for (const file of overlay) {
    const content = read(path.join(root, file));
    write(path.join(report, "overlay", file), content);
    write(path.join(frozen, file), content);
  }
  const after = inventory(frozen);
  const deltas = Object.keys(after).filter(file => JSON.stringify(before[file]) !== JSON.stringify(after[file]))
    .map(file => ({ file, beforeSha256: before[file], sha256: after[file] }));
  assert.deepEqual(deltas.map(delta => delta.file).sort(), [...overlay].sort(), "Only approved production files and order expectations may change");
  assert.deepEqual(Object.keys(before), Object.keys(after), "No retained files may be added or removed");
  json(path.join(report, "source-delta-audit.json"), {
    baseline: path.relative(root, prior), retainedPaths, approved, testOnly, deltas,
    preservedCount: Object.keys(before).length - deltas.length,
    before, after, noHeadSnapshot: true, exactPreservationOutsideApprovedFiles: true,
  });
  // Match the existing frozen-build recipe: installed third-party dependencies,
  // with every workspace dependency resolving to the retained candidate libraries.
  for (const pkg of ["", ui, ...libraries.map(name => `lib/${name}`)]) {
    const nm = path.join(frozen, pkg, "node_modules");
    const installed = path.join(root, pkg, "node_modules");
    fs.mkdirSync(nm, { recursive: true });
    if (fs.existsSync(installed)) for (const entry of fs.readdirSync(installed)) {
      if (entry !== "@workspace") fs.symlinkSync(path.join(installed, entry), path.join(nm, entry));
    }
    fs.mkdirSync(path.join(nm, "@workspace"), { recursive: true });
    for (const name of libraries) fs.symlinkSync(path.join(frozen, "lib", name), path.join(nm, "@workspace", name));
  }
  const checks = [];
  function run(name, bin, args, cwd = path.join(frozen, ui)) {
    const result = spawnSync(bin, args, {
      cwd, encoding: "utf8", maxBuffer: 30e6,
      env: { ...process.env, NODE_ENV: "production", BASE_PATH: "/" },
    });
    write(path.join(report, `${name}.log`), `${result.stdout ?? ""}${result.stderr ?? ""}${result.error?.message ?? ""}`);
    const check = { name, command: [bin, ...args], cwd, status: result.status, signal: result.signal };
    checks.push(check);
    console.log(`${name}: ${result.status}`);
    return check;
  }
  run("ui-typecheck", path.join(root, "node_modules/.bin/tsc"),
    ["--noEmit", "--incremental", "false", "-p", path.join(frozen, ui)]);
  const focused = run("ui-focused-tests", process.execPath, [
    path.join(root, "scripts/src/frontend-test-runner.mjs"),
    "--root", frozen, "--app-root", path.join(frozen, ui),
    "src/components/app-navigation.contract.test.ts",
  ]);
  if (focused.status !== 0) {
    const log = read(path.join(report, "ui-focused-tests.log")).toString();
    assert.equal(focused.status, 1);
    assert.match(log, /pass 6/);
    assert.match(log, /fail 1/);
    assert.match(log, /0 !== 2/);
    assert.match(log, /routes use matrix permissions while notifications remain admin-only/);
    focused.acceptedKnownBaselineFailure = true;
  }
  const appSource = read(path.join(frozen, ui, "src/App.tsx")).toString();
  assert.equal(sha(appSource), sha(read(path.join(report, "original/App.tsx"))), "Routes must remain unchanged");
  const requiredRolesMatches = (appSource.match(/component=\{(?:CajaCuentasDestino|CuentaDestinoDetalle)\}[\s\S]*?requiredRoles=\{\["ADMIN", "CONTADOR", "SISTEMAS"\]\}/g) ?? []).length;
  assert.equal(requiredRolesMatches, 0, "Known baseline failure evidence changed");
  const priorProof = JSON.parse(read(path.join(report, "test-results.json")));
  assert.equal(priorProof.sidebarProof.passed, 7);
  assert.equal(priorProof.sidebarProof.failed, 0);
  run("ui-build", path.join(frozen, ui, "node_modules/.bin/vite"), [
    "build", "--config", path.join(frozen, ui, "vite.config.ts"), "--outDir", output,
  ]);
  assert.deepEqual(inventory(frozen), after, "Build/checks changed candidate source");
  assert.deepEqual(guards(), provenance.guards, "Build/checks changed baseline inputs");
  const frontendFiles = inventory(output, () => false);
  write(path.join(report, "frontend.sha256"), Object.entries(frontendFiles)
    .map(([file, hash]) => `${hash}  ${path.relative(root, path.join(output, file))}\n`).join(""));
  const manifest = {
    status: checks.every(check => check.status === 0 || check.acceptedKnownBaselineFailure)
      ? (focused.acceptedKnownBaselineFailure ? "BUILT_TYPECHECKED_KNOWN_BASELINE_TEST_FAILURE_NOT_ACTIVATED" : "BUILT_TYPECHECKED_NOT_ACTIVATED")
      : "BUILT_VALIDATION_FAILED_NOT_ACTIVATED",
    frontend: path.relative(root, output), frozen: path.relative(root, frozen),
    baselineFrontend: path.relative(root, active), baselineFrozen: path.relative(root, prior),
    frontendFiles, checks, sourceDeltas: deltas,
    productionSourceDeltas: deltas.filter(delta => approved.includes(delta.file)),
    testOnlySourceDeltas: deltas.filter(delta => testOnly.includes(delta.file)),
    mainSourceReady: "MAIN approved two production files and contract-test order expectations; comprehensive 7/7 proof accepted without rerunning.",
    priorProofSha256: sha(read(path.join(report, "test-results.json"))),
    proofSuiteSha256: sha(read(path.join(report, "sidebar-order.test.mjs"))),
    knownBaselineFailure: {
      test: "routes use matrix permissions while notifications remain admin-only",
      expectedRequiredRolesMatches: 2, actualOriginalAndCandidateMatches: requiredRolesMatches,
      candidateRoutesMatchOriginal: true,
      action: "Candidate focused run reproduced only the known preexisting 0-versus-2 failure (6 passed / 1 failed). Unrelated route behavior and assertion not fixed.",
    },
    preservedSourceCount: Object.keys(before).length - deltas.length,
    exactPreservationOutsideApprovedFiles: true, baselineInputsUnchanged: true,
    frontendSha256FileHash: sha(read(path.join(report, "frontend.sha256"))),
    recipeSha256: sha(read(path.join(report, "build-frozen.mjs"))),
    sourceDeltaAuditSha256: sha(read(path.join(report, "source-delta-audit.json"))),
    baselineProvenanceSha256: sha(read(provenancePath)),
    databaseAccess: false, apiBuild: false, workflowChanges: false, activation: false,
    validationGaps: ["No candidate browser verification by build worker; MAIN owns visual verification."],
  };
  json(path.join(report, "build-manifest.json"), manifest);
  json(path.join(report, "candidate-ready.json"), {
    status: manifest.status, frontend: manifest.frontend, frozen: manifest.frozen,
    manifestSha256: sha(read(path.join(report, "build-manifest.json"))),
    frontendSha256FileHash: manifest.frontendSha256FileHash,
  });
  console.log(JSON.stringify({ status: manifest.status, frontend: manifest.frontend, checks }, null, 2));
  assert.ok(checks.every(check => check.status === 0 || check.acceptedKnownBaselineFailure), "Candidate validation failed; inspect recorded checks");
} else {
  throw new Error("Use --prepare; --build-after-main-ready is gated on explicit MAIN source-ready notification.");
}