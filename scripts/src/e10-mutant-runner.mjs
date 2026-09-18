/**
 * Actual source-mutant proof for the pure E10 contract cases. Copies are under
 * .local only; watched application modules are never edited.
 */
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import { dirname, resolve } from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const API = resolve(ROOT, "artifacts/api-server");
const OUT = resolve(ROOT, ".local/e10-mutants");
const REPORT = resolve(ROOT, "reports/e10-aislado-2026-09-18/mutantes-resultados.json");
const TSX = resolve(API, "node_modules/.bin/tsx");
const files = ["src/lib/fondo.ts", "src/routes/fondo.ts", "src/lib/fondo.test.ts"];
const mutants = [
  {
    name: "cent-money-number-rounding",
    file: "src/lib/fondo.ts",
    from: "const result = BigInt(units) * 100n + BigInt(cents);",
    to: "const result = BigInt(Math.trunc(Number(units) * 100 + Number(cents)));",
    detects: "exact cent conversion beyond Number safe integer range",
  },
  {
    name: "removed-intrinsic-admin-guard",
    file: "src/routes/fondo.ts",
    from: 'if (!req.auth || req.auth.user.rol !== "ADMIN") {\n    res.status(403)',
    to: 'if (false) {\n    res.status(403)',
    detects: "standalone intrinsic ADMIN denial before router data access",
  },
  {
    name: "removed-csv-formula-neutralization",
    file: "src/routes/fondo.ts",
    from: "return /^[\\u0000-\\u0020]*[=+\\-@]/.test(value) ? `'${value}` : value;",
    to: "return value;",
    detects: "formula-leading user text in CSV",
  },
  {
    name: "removed-initial-reconciliation-presentation",
    file: "src/lib/fondo.ts",
    from: "conciliacionInicial: row.conciliacion_inicial,",
    to: "conciliacionInicial: undefined,",
    detects: "initial reconciliation evidence remains reachable in detail",
  },
  {
    name: "collapsed-idempotency-canonical-payload",
    file: "src/lib/fondo.ts",
    from: "export function canonicalPayload(value: unknown): string {",
    to: 'export function canonicalPayload(value: unknown): string { if (value && typeof value === "object") return "{}";',
    detects: "changed idempotency payload differs from original",
  },
  {
    name: "removed-site-and-unknown-query-validation",
    file: "src/routes/fondo.ts",
    from: "const strictEmpty = z.object({}).strict();",
    to: "const strictEmpty = z.object({}).passthrough();",
    detects: "source-level strict unknown query/site rejection guard",
  },
  {
    name: "removed-inverse-of-inverse-guard",
    file: "src/lib/fondo.ts",
    from: "if (original.original_id) throw new FondoError",
    to: "if (false && original.original_id) throw new FondoError",
    detects: "source-level inverse immutability guard",
  },
  {
    name: "removed-persisted-arqueo-difference",
    file: "src/lib/fondo.ts",
    from: "const counted = parseMoney(input.efectivoContado); const difference = counted - state.saldo;",
    to: "const counted = parseMoney(input.efectivoContado); const difference = 0n;",
    detects: "source-level counted-minus-book persisted difference",
  },
  {
    name: "removed-stale-version-check",
    file: "src/lib/fondo.ts",
    from: "if (state.version !== input.expectedVersionSaldo) throw new FondoError",
    to: "if (false) throw new FondoError",
    detects: "source-level stale displayed-version conflict",
  },
  {
    name: "removed-normal-withdrawal-invariant",
    file: "src/lib/fondo.ts",
    from: 'if (naturaleza === "RETIRO" && state.saldo < amount) throw new FondoError',
    to: 'if (false) throw new FondoError',
    detects: "source-level insufficient normal withdrawal guard",
  },
];

function ms(start) {
  return Number(process.hrtime.bigint() - start) / 1e6;
}
async function runTest(apiRoot) {
  const start = process.hrtime.bigint();
  try {
    const result = await execFileAsync(TSX, ["--test",
      resolve(apiRoot, "src/lib/fondo.test.ts"),
      resolve(ROOT, "scripts/src/e10-mutant-contract.test.mts")], {
      cwd: API, env: { ...process.env, NODE_ENV: "test", E10_MUTANT_API_ROOT: apiRoot }, timeout: 30_000,
      maxBuffer: 1024 * 1024,
    });
    return { exitCode: 0, milliseconds: ms(start), stdoutTail: result.stdout.trim().split("\n").slice(-3) };
  } catch (error) {
    return {
      exitCode: Number.isInteger(error?.code) ? error.code : 1,
      milliseconds: ms(start),
      stderrTail: String(error?.stderr ?? "").trim().split("\n").slice(-3),
    };
  }
}

await fs.rm(OUT, { recursive: true, force: true });
await fs.mkdir(OUT, { recursive: true, mode: 0o700 });
const fixed = await runTest(API);
assert.equal(fixed.exitCode, 0, "Fixed E10 contract test must be GREEN before mutants");
const results = [];
for (const [index, mutant] of mutants.entries()) {
  const tree = resolve(OUT, mutant.name, "artifacts/api-server");
  for (const file of files) {
    const destination = resolve(tree, file);
    await fs.mkdir(dirname(destination), { recursive: true });
    await fs.copyFile(resolve(API, file), destination);
  }
  await fs.symlink(resolve(API, "node_modules"), resolve(tree, "node_modules"), "dir");
  const path = resolve(tree, mutant.file);
  const source = await fs.readFile(path, "utf8");
  assert.ok(source.includes(mutant.from), `Mutation target drifted: ${mutant.name}`);
  await fs.writeFile(path, source.replace(mutant.from, mutant.to));
  const observed = await runTest(tree);
  assert.notEqual(observed.exitCode, 0, `Mutant unexpectedly survived: ${mutant.name}`);
  results.push({
    ...mutant,
    processNonzero: true,
    proofKind: index < 5 ? "observable pure behavior" : "source-architecture only (not canonical behavior proof)",
    canonicalBehaviorRed: index < 5,
    ...observed,
  });
}
const report = {
  status: "PARTIAL",
  boundary: "actual copied source trees; pure contract process; no DB connection",
  fixedGreen: fixed,
  mutants: results,
  exactBehaviorCoverage: results.filter((row) => row.canonicalBehaviorRed)
    .map(({ name, detects }) => ({ name, detects })),
  architectureOnlyNonzero: results.filter((row) => !row.canonicalBehaviorRed)
    .map(({ name, detects }) => ({ name, detects })),
  blockedCanonicalBehaviorProof: [
    "removed-site-and-unknown-query-validation",
    "removed-inverse-of-inverse-guard",
    "removed-persisted-arqueo-difference",
    "removed-stale-version-check",
    "removed-normal-withdrawal-invariant",
    "database-level trigger removal mutants",
    "simultaneous scheduling mutant",
  ],
};
await fs.writeFile(REPORT, `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 });
console.log(JSON.stringify({ status: report.status, report: REPORT,
  behaviorMutants: results.filter((row) => row.canonicalBehaviorRed).length,
  architectureOnly: results.filter((row) => !row.canonicalBehaviorRed).length }));