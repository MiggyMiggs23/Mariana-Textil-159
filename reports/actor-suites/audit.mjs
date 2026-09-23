#!/usr/bin/env node

/**
 * Fail-closed, read-only consolidator for Adaptación 28 evidence.
 *
 * This program never imports DB/application code, discovers runs implicitly,
 * or executes suites. Every run directory must be supplied explicitly.
 */
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import {
  ACTOR_SUITE_GROUPS,
  ACTOR_SUITE_PATHS,
} from "../../lib/db/src/actor-suite-manifest.mjs";

const workspaceRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const runsRoot = join(workspaceRoot, "reports", "actor-suites", "runs");
const PERMISSIONS_PATH = "artifacts/api-server/src/lib/permisos.test.ts";
const SECURITY_PATH = "artifacts/api-server/src/security-api.test.ts";
const SHA256 = /^[a-f0-9]{64}$/;
const NATIVE_FIELDS = ["tests", "pass", "fail", "cancelled", "skipped", "todo"];

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function sourceBacksNativeName(source, sourceLiterals, name) {
  if (sourceLiterals.has(name) ||
      (name.includes(": ") &&
        name.split(": ").every(part => sourceLiterals.has(part)))) {
    return true;
  }
  for (const match of source.matchAll(/`((?:\\.|[^`])*\$\{[^}]+\}(?:\\.|[^`])*)`/g)) {
    const template = match[1];
    const parts = [];
    const expressions = [];
    let cursor = 0;
    for (const expression of template.matchAll(/\$\{([^}]+)\}/g)) {
      parts.push(template.slice(cursor, expression.index));
      expressions.push(expression[1].trim());
      cursor = expression.index + expression[0].length;
    }
    parts.push(template.slice(cursor));
    if (expressions.length === 0 ||
        expressions.some(expression =>
          !/^[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)+$/.test(expression))) {
      continue;
    }
    const pattern = new RegExp(
      `^${parts.map(escapeRegExp).join("(.+?)")}$`,
    );
    const rendered = pattern.exec(name);
    if (rendered &&
        rendered.slice(1).every(value => sourceLiterals.has(value))) {
      return true;
    }
  }
  return false;
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function parseArguments(args) {
  const runDirectories = [];
  let output;
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--run") {
      const value = args[++index];
      if (!value) throw new Error("--run requires one evidence directory.");
      runDirectories.push(value);
    } else if (arg.startsWith("--run=")) {
      runDirectories.push(arg.slice("--run=".length));
    } else if (arg === "--runs") {
      const value = args[++index];
      if (!value) throw new Error("--runs requires comma-separated directories.");
      runDirectories.push(...value.split(","));
    } else if (arg.startsWith("--runs=")) {
      runDirectories.push(...arg.slice("--runs=".length).split(","));
    } else if (arg === "--output") {
      output = args[++index];
      if (!output) throw new Error("--output requires a JSON path.");
    } else if (arg.startsWith("--output=")) {
      output = arg.slice("--output=".length);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  const normalizedRuns = runDirectories.map(value => value.trim()).filter(Boolean);
  if (normalizedRuns.length === 0) {
    throw new Error("At least one explicit --run/--runs directory is required.");
  }
  if (new Set(normalizedRuns).size !== normalizedRuns.length) {
    throw new Error("Duplicate run directories are not allowed.");
  }
  return { runDirectories: normalizedRuns, output };
}

function inside(parent, candidate) {
  const rel = relative(parent, candidate);
  return rel !== "" && rel !== ".." && !rel.startsWith(`..${sep}`) &&
    !isAbsolute(rel);
}

function safeRunDirectory(input) {
  const resolved = resolve(workspaceRoot, input);
  if (!inside(runsRoot, resolved)) {
    throw new Error(`Run directory must be below reports/actor-suites/runs: ${input}`);
  }
  return resolved;
}

function safeEvidenceFile(runDirectory, name) {
  if (typeof name !== "string" || name.length === 0 ||
      name !== relative(".", name) || name.includes("/") || name.includes("\\")) {
    throw new Error(`Unsafe evidence filename in ${runDirectory}.`);
  }
  const path = join(runDirectory, name);
  if (!inside(runDirectory, path) || !existsSync(path)) {
    throw new Error(`Missing durable evidence file ${name} in ${runDirectory}.`);
  }
  return path;
}

function collectNativeSummary(stdout, suitePath, errors) {
  const counts = {};
  for (const field of NATIVE_FIELDS) {
    const matches = [...stdout.matchAll(
      new RegExp(`^ℹ ${field} (\\d+)$`, "gm"),
    )];
    if (matches.length !== 1) {
      errors.push(
        `${suitePath}: native reporter must contain exactly one "${field}" terminal.`,
      );
      continue;
    }
    counts[field] = Number(matches[0][1]);
  }
  const names = [...stdout.matchAll(/^\s*✔ (.+) \([\d.]+ms\)$/gm)]
    .map(match => match[1]);
  if (Object.values(counts).some(value => !Number.isSafeInteger(value))) {
    return { counts, names };
  }
  if (counts.tests <= 0) {
    errors.push(`${suitePath}: zero native tests can never prove PASS.`);
  }
  if (counts.fail !== 0 || counts.cancelled !== 0 ||
      counts.skipped !== 0 || counts.todo !== 0) {
    errors.push(`${suitePath}: fail/cancelled/skipped/todo must all be zero.`);
  }
  if (counts.pass !== counts.tests) {
    errors.push(`${suitePath}: native pass count must equal tests count.`);
  }
  if (names.length !== counts.tests || new Set(names).size !== names.length) {
    errors.push(
      `${suitePath}: reporter test names must be unique and equal native tests count.`,
    );
  }
  const source = readFileSync(join(workspaceRoot, suitePath), "utf8");
  const sourceLiterals = new Set(
    [...source.matchAll(/(["'`])((?:\\.|(?!\1).)*)\1/g)]
      .map(match => match[2]),
  );
  if (names.some(name => !sourceBacksNativeName(source, sourceLiterals, name))) {
    errors.push(`${suitePath}: native terminal names are not source-backed.`);
  }
  return { counts, names };
}

function sourceProof(suitePath, errors) {
  const absolute = join(workspaceRoot, suitePath);
  if (!existsSync(absolute)) {
    errors.push(`${suitePath}: source file is absent.`);
    return undefined;
  }
  const source = readFileSync(absolute, "utf8");
  const sql = /\bINSERT\s+INTO\s+usuarios\b/i.exec(source);
  const drizzle = /\.insert\s*\(\s*usuariosTable\s*\)/.exec(source);
  const callsite = sql ? "INSERT INTO usuarios" : drizzle
    ? "insert(usuariosTable)" : undefined;
  if (!callsite) {
    errors.push(`${suitePath}: no real usuarios insert callsite is present.`);
  }
  return {
    sha256: sha256(source),
    actorCreationCallsite: callsite,
    source,
  };
}

function requireHash(value, label, errors) {
  if (typeof value !== "string" || !SHA256.test(value)) {
    errors.push(`${label}: missing or invalid sha256 proof.`);
    return false;
  }
  return true;
}

function auditIdentity(caseEvidence, source, suitePath, errors) {
  if (!requireHash(caseEvidence.sourceSha256, `${suitePath}.sourceSha256`, errors) ||
      caseEvidence.sourceSha256 !== source?.sha256) {
    errors.push(`${suitePath}: execution is not bound to the current source hash.`);
  }
  const preflight = caseEvidence.preflight;
  if (!preflight || typeof preflight !== "object") {
    errors.push(`${suitePath}: missing per-suite preflight identity proof.`);
    return;
  }
  for (const [field, expected] of [
    ["identityVerified", true],
    ["targetControlDistinct", true],
    ["preparationMatchedTarget", true],
  ]) {
    if (preflight[field] !== expected) {
      errors.push(`${suitePath}.preflight.${field} must be ${expected}.`);
    }
  }
  for (const field of [
    "targetDatabaseSha256",
    "targetDatabaseOidSha256",
    "controlDatabaseSha256",
    "controlDatabaseOidSha256",
    "preparationTargetDatabaseSha256",
    "preparationTargetDatabaseOidSha256",
  ]) {
    requireHash(preflight[field], `${suitePath}.preflight.${field}`, errors);
  }
  if (preflight.targetDatabaseSha256 !== caseEvidence.targetDatabaseSha256 ||
      preflight.targetDatabaseOidSha256 !== caseEvidence.targetDatabaseOidSha256 ||
      preflight.preparationTargetDatabaseSha256 !==
        preflight.targetDatabaseSha256 ||
      preflight.preparationTargetDatabaseOidSha256 !==
        preflight.targetDatabaseOidSha256 ||
      preflight.controlDatabaseSha256 === preflight.targetDatabaseSha256 ||
      preflight.controlDatabaseOidSha256 === preflight.targetDatabaseOidSha256) {
    errors.push(
      `${suitePath}: target/control/preparation identity hashes are inconsistent.`,
    );
  }
  const preparation = preflight.preparation;
  if (!preparation || preparation.matched !== true ||
      JSON.stringify(preparation.before) !== JSON.stringify(preparation.after) ||
      preparation.after?.target?.databaseSha256 !==
        preflight.targetDatabaseSha256 ||
      preparation.after?.target?.databaseOidSha256 !==
        preflight.targetDatabaseOidSha256 ||
      preparation.after?.control?.databaseSha256 !==
        preflight.controlDatabaseSha256 ||
      preparation.after?.control?.databaseOidSha256 !==
        preflight.controlDatabaseOidSha256) {
    errors.push(`${suitePath}: preparation before/after identity proof is incomplete.`);
  }
}

function auditProvenance(caseEvidence, suitePath, errors) {
  const provenance = caseEvidence.provenance;
  if (!provenance || provenance.unchanged !== true ||
      JSON.stringify(provenance.start) !== JSON.stringify(provenance.end)) {
    errors.push(`${suitePath}: missing unchanged start/end source provenance.`);
    return;
  }
  for (const [label, value] of [
    ["suite", provenance.end?.suiteSha256],
    ["runner", provenance.end?.runnerSha256],
    ["helpers", provenance.end?.helpersSha256],
    ["schema", provenance.end?.schema?.sha256],
  ]) {
    requireHash(value, `${suitePath}.provenance.${label}`, errors);
  }
  if (!Number.isSafeInteger(provenance.end?.schema?.fileCount) ||
      provenance.end.schema.fileCount <= 0 ||
      provenance.end.suiteSha256 !== caseEvidence.sourceSha256) {
    errors.push(`${suitePath}: durable provenance fields are internally inconsistent.`);
  }
}

function expectedPermissionNames(source, errors) {
  if (!source) return [];
  const names = [...source.matchAll(
    /await\s+test\(\s*"([^"]+)"(?:\s*,\s*"([^"]+)")?/g,
  )].map(match => match[2] ? `${match[1]}: ${match[2]}` : match[1]);
  if (names.length !== 29 || new Set(names).size !== 29) {
    errors.push("lib/permisos.test.ts must declare exactly 29 unique test names.");
  }
  return names;
}

function expectedSecurityNames(source, errors) {
  if (!source) return [];
  const names = [...source.matchAll(
    /await\s+test\(\s*"([^"]+)"(?:\s*,\s*"([^"]+)")?/g,
  )].map(match => match[2] ? `${match[1]}: ${match[2]}` : match[1]);
  if (names.length !== 49 || new Set(names).size !== 49) {
    errors.push("security-api.test.ts must declare exactly 49 unique native names.");
  }
  return names;
}

function auditRun(input, globalCases, observations, errors) {
  const runDirectory = safeRunDirectory(input);
  for (const name of ["selection.json", "manifest.json", "terminal.json"]) {
    if (!existsSync(join(runDirectory, name))) {
      errors.push(`${input}: missing ${name}.`);
      return;
    }
  }
  const selection = readJson(join(runDirectory, "selection.json"));
  const manifest = readJson(join(runDirectory, "manifest.json"));
  const terminal = readJson(join(runDirectory, "terminal.json"));
  const runId = manifest.runId;
  if (!runId || selection.runId !== runId || terminal.runId !== runId ||
      runId !== relative(runsRoot, runDirectory)) {
    errors.push(`${input}: runId disagreement across durable evidence.`);
  }
  const selectedPaths = manifest.selectedPaths;
  if (!Array.isArray(selectedPaths) || selectedPaths.length === 0 ||
      JSON.stringify(selection.selectedPaths) !== JSON.stringify(selectedPaths)) {
    errors.push(`${input}: explicit nonempty selection evidence disagrees.`);
    return;
  }
  const selectionHash = sha256(`${selectedPaths.join("\n")}\n`);
  if (manifest.selectionSha256 !== selectionHash ||
      selection.selectionSha256 !== selectionHash ||
      terminal.selectionSha256 !== selectionHash) {
    errors.push(`${input}: selection sha256 disagreement.`);
  }
  const runPassed = manifest.status === "PASS" && terminal.status === "PASS" &&
    terminal.executionPassed === true;
  const failFastRun = manifest.status === "FAIL" && terminal.status === "FAIL" &&
    terminal.executionPassed === false;
  if ((!runPassed && !failFastRun) || terminal.clusterDestroyed !== true) {
    errors.push(`${input}: inconsistent run status or cluster destruction proof.`);
  }
  if (!Array.isArray(manifest.cases) ||
      manifest.cases.length !== manifest.completedCount ||
      manifest.completedCount <= 0 ||
      manifest.completedCount > selectedPaths.length ||
      (runPassed && manifest.completedCount !== selectedPaths.length)) {
    errors.push(`${input}: invalid completed-case accounting.`);
    return;
  }
  const failureCount = manifest.cases.filter(item => item.status === "FAIL").length;
  const failureAccountingMatches =
    manifest.assertionFailures === failureCount;
  const validContinuedRun =
    manifest.completedCount === selectedPaths.length &&
    manifest.assertionFailures > 0 &&
    failureAccountingMatches &&
    manifest.cases.every(item => item.status === "PASS" || item.status === "FAIL");
  const validFailFastRun =
    manifest.cases.at(-1)?.status === "FAIL" &&
    manifest.cases.slice(0, -1).every(item => item.status === "PASS");
  const validUnsafeStop =
    manifest.cases.at(-1)?.status === "UNSAFE" &&
    failureAccountingMatches &&
    manifest.cases.slice(0, -1)
      .every(item => item.status === "PASS" || item.status === "FAIL");
  if (failFastRun &&
      !validContinuedRun && !validFailFastRun && !validUnsafeStop) {
    errors.push(
      `${input}: failed run is neither valid fail-fast, continued, nor parser-unsafe evidence.`,
    );
  }
  manifest.cases.forEach((caseEvidence, index) => {
    const suitePath = selectedPaths[index];
    const caseErrors = [];
    if (manifest.version !== 2 || selection.version !== 2 ||
        terminal.version !== 2) {
      caseErrors.push(`${suitePath}: strict proof requires evidence schema version 2.`);
    }
    if (caseEvidence.path !== suitePath || caseEvidence.ordinal !== index + 1) {
      errors.push(`${input}: case order/path does not match explicit selection.`);
      return;
    }
    if (!ACTOR_SUITE_PATHS.includes(suitePath)) {
      caseErrors.push(`${suitePath}: route is outside the exact manifest.`);
    }
    const recoverableParserUnsafe =
      caseEvidence.status === "UNSAFE" &&
      caseEvidence.exitCode === 0 &&
      caseEvidence.native === null &&
      failFastRun &&
      terminal.clusterDestroyed === true &&
      index === manifest.cases.length - 1 &&
      caseEvidence.reporterError ===
        `${suitePath} emitió terminales nativos que no corresponden a nombres declarados en su fuente.`;
    if ((caseEvidence.status !== "PASS" || caseEvidence.exitCode !== 0) &&
        !recoverableParserUnsafe) {
      if (caseEvidence.status !== "FAIL" || caseEvidence.exitCode === 0 ||
          !failFastRun ||
          (manifest.completedCount !== selectedPaths.length &&
            index !== manifest.cases.length - 1)) {
        caseErrors.push(`${suitePath}: invalid non-PASS case terminal.`);
      }
      const failedStdout = safeEvidenceFile(
        runDirectory,
        caseEvidence.logs?.stdout,
      );
      const failedStderr = safeEvidenceFile(
        runDirectory,
        caseEvidence.logs?.stderr,
      );
      if (sha256(readFileSync(failedStdout)) !== caseEvidence.logs?.stdoutSha256 ||
          sha256(readFileSync(failedStderr)) !== caseEvidence.logs?.stderrSha256) {
        caseErrors.push(`${suitePath}: failed-case durable log sha256 mismatch.`);
      }
      observations.push({
        runId,
        path: suitePath,
        qualification: "FAILED_CASE",
        errors: caseErrors,
      });
      return;
    }
    requireHash(
      caseEvidence.targetDatabaseSha256,
      `${suitePath}.targetDatabaseSha256`,
      caseErrors,
    );
    requireHash(
      caseEvidence.targetDatabaseOidSha256,
      `${suitePath}.targetDatabaseOidSha256`,
      caseErrors,
    );
    const source = sourceProof(suitePath, caseErrors);
    if (!recoverableParserUnsafe &&
        caseEvidence.postflightIdentityVerified !== true) {
      caseErrors.push(`${suitePath}: missing postflight identity verification.`);
    }
    auditProvenance(caseEvidence, suitePath, caseErrors);
    auditIdentity(caseEvidence, source, suitePath, caseErrors);
    const stdoutPath = safeEvidenceFile(
      runDirectory,
      caseEvidence.logs?.stdout,
    );
    const stderrPath = safeEvidenceFile(
      runDirectory,
      caseEvidence.logs?.stderr,
    );
    const stdout = readFileSync(stdoutPath, "utf8");
    const stderr = readFileSync(stderrPath, "utf8");
    if (sha256(stdout) !== caseEvidence.logs?.stdoutSha256 ||
        sha256(stderr) !== caseEvidence.logs?.stderrSha256) {
      caseErrors.push(`${suitePath}: durable log sha256 mismatch.`);
    }
    const native = collectNativeSummary(stdout, suitePath, caseErrors);
    if (!recoverableParserUnsafe &&
        JSON.stringify(caseEvidence.native) !== JSON.stringify({
          ...native.counts,
          testNames: native.names,
        })) {
      caseErrors.push(`${suitePath}: manifest native summary differs from durable log.`);
    }
    if (suitePath === PERMISSIONS_PATH) {
      const expected = expectedPermissionNames(source?.source, caseErrors);
      if (JSON.stringify(native.names) !== JSON.stringify(expected)) {
        caseErrors.push(
          `${suitePath}: native reporter names do not equal the exact 29 source names.`,
        );
      }
    }
    if (suitePath === SECURITY_PATH) {
      const expected = expectedSecurityNames(source?.source, caseErrors);
      if (JSON.stringify(native.names) !== JSON.stringify(expected)) {
        caseErrors.push(
          `${suitePath}: native reporter names do not equal the exact 49 source names.`,
        );
      }
    }
    if (caseErrors.length > 0) {
      observations.push({
        runId,
        path: suitePath,
        qualification: "NONQUALIFYING_HISTORY",
        errors: caseErrors,
      });
      return;
    }
    if (globalCases.has(suitePath)) {
      errors.push(`${suitePath}: duplicate qualifying terminal evidence.`);
      return;
    }
    globalCases.set(suitePath, {
      runId,
      ordinal: index + 1,
      exitCode: caseEvidence.exitCode,
      native: native.counts,
      nativeTestNames: native.names,
      sourceSha256: source?.sha256,
      provenance: caseEvidence.provenance,
      actorCreationCallsite: source?.actorCreationCallsite,
      targetDatabaseSha256: caseEvidence.targetDatabaseSha256,
      targetDatabaseOidSha256: caseEvidence.targetDatabaseOidSha256,
      logs: caseEvidence.logs,
      ...(recoverableParserUnsafe ? {
        evidenceAddendum: {
          classification: "RECOVERED_PARSER_UNSAFE",
          basis: "DURABLE_LOG_REPARSE",
          originalStatus: caseEvidence.status,
          originalReporterError: caseEvidence.reporterError,
          historicalManifestModified: false,
        },
      } : {}),
    });
  });
}

function main() {
  const errors = [];
  const observations = [];
  let options;
  try {
    options = parseArguments(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 2;
    return;
  }
  const cases = new Map();
  for (const run of options.runDirectories) {
    try {
      auditRun(run, cases, observations, errors);
    } catch (error) {
      errors.push(`${run}: ${error.message}`);
    }
  }
  const missingPaths = ACTOR_SUITE_PATHS.filter(path => !cases.has(path));
  const extraPaths = [...cases.keys()].filter(path =>
    !ACTOR_SUITE_PATHS.includes(path));
  if (missingPaths.length) {
    errors.push(`Missing route evidence: ${missingPaths.join(", ")}`);
  }
  if (extraPaths.length) {
    errors.push(`Unexpected route evidence: ${extraPaths.join(", ")}`);
  }
  const targetHashes = [...cases.values()]
    .map(value => value.targetDatabaseSha256)
    .filter(value => SHA256.test(value ?? ""));
  if (targetHashes.length !== cases.size) {
    errors.push("A qualifying route has an invalid private target database hash.");
  }
  if (new Set(targetHashes).size !== targetHashes.length) {
    errors.push("Qualifying routes have conflicting private target database hashes.");
  }
  for (const [label, values] of [
    ["runner", [...cases.values()].map(value =>
      value.provenance?.end?.runnerSha256)],
    ["helpers", [...cases.values()].map(value =>
      value.provenance?.end?.helpersSha256)],
    ["schema", [...cases.values()].map(value =>
      value.provenance?.end?.schema?.sha256)],
  ]) {
    if (values.some(value => !SHA256.test(value ?? ""))) {
      errors.push(`A qualifying route has an invalid ${label} provenance hash.`);
    }
    if (new Set(values).size > 1) {
      errors.push(`Qualifying routes have conflicting ${label} provenance hashes.`);
    }
  }
  const status = errors.length === 0 &&
    cases.size === ACTOR_SUITE_PATHS.length ? "PASS" : "INCOMPLETE_OR_FAIL";
  const report = {
    version: 1,
    status,
    generatedBy: "reports/actor-suites/audit.mjs",
    executedTestsByAuditor: 0,
    explicitRuns: options.runDirectories,
    exactManifest: {
      count: ACTOR_SUITE_PATHS.length,
      groups: Object.fromEntries(
        Object.entries(ACTOR_SUITE_GROUPS).map(([name, paths]) =>
          [name, paths.length]),
      ),
      paths: ACTOR_SUITE_PATHS,
    },
    provenRouteCount: cases.size,
    cases: ACTOR_SUITE_PATHS
      .filter(path => cases.has(path))
      .map(path => ({ path, ...cases.get(path) })),
    nonQualifyingEvidence: observations,
    errors,
  };
  const serialized = `${JSON.stringify(report, null, 2)}\n`;
  if (options.output) {
    const output = resolve(workspaceRoot, options.output);
    if (!inside(join(workspaceRoot, "reports", "actor-suites"), output)) {
      throw new Error("--output must be below reports/actor-suites.");
    }
    mkdirSync(dirname(output), { recursive: true });
    writeFileSync(output, serialized, { mode: 0o600 });
  }
  process.stdout.write(serialized);
  if (status !== "PASS") process.exitCode = 1;
}

main();