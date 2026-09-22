// Generates evidence only. Live access is READ ONLY; DDL runs only in a disposable cluster.
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { hash, readCatalog } from "../e2-paquete-liberacion-preparado-20260921/release-preflight.mjs";

const root = process.cwd();
const out = path.dirname(fileURLToPath(import.meta.url));
const pkg = path.join(root, "reports/e2-paquete-liberacion-preparado-20260921");
const diagnostic = path.join(root, "reports/e2-diagnostico-b0-20260922");
const json = p => JSON.parse(fs.readFileSync(p, "utf8"));
const save = (name, value) => fs.writeFileSync(path.join(out, name), JSON.stringify(value, null, 2) + "\n");
const sha = file => createHash("sha256").update(fs.readFileSync(file)).digest("hex");
assert.ok(fs.existsSync(path.join(out, "autorizacion-ampliada-del-propietario.txt")));
const clean = { PATH: process.env.PATH, HOME: "/tmp", LANG: "C.UTF-8" };
const run = (cmd, args, options = {}) => {
  const p = spawnSync(cmd, args, { env: clean, encoding: "utf8", timeout: 180000, maxBuffer: 32 * 1024 * 1024, ...options });
  if (p.status !== 0) throw new Error(`Isolated ${path.basename(cmd)} failed (${p.status}): ${p.stderr}`);
  return p.stdout;
};
function inventory() {
  const files = {};
  const walk = dir => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.isFile()) files[path.relative(root, p)] = sha(p);
    }
  };
  for (const dir of [pkg, "artifacts/api-server/dist", "artifacts/api-server/dist-e2-20260927"]) walk(dir);
  if (fs.existsSync(".replit")) files[".replit"] = sha(".replit");
  return files;
}
const protectedBefore = inventory();
save("protected-before.json", protectedBefore);
const pids = fs.readdirSync("/proc").filter(p => /^\d+$/.test(p)).filter(p => {
  try {
    const args = fs.readFileSync(`/proc/${p}/cmdline`, "utf8").split("\0").filter(Boolean);
    return /(?:^|\/)node$/.test(args[0] ?? "") &&
      args.some(a => a === "artifacts/api-server/dist/index.mjs" || a === path.join(root, "artifacts/api-server/dist/index.mjs"));
  } catch { return false; }
});
assert.equal(pids.length, 1, "Exactly one retained API process required");
const pid = pids[0];
const startTicks = () => fs.readFileSync(`/proc/${pid}/stat`, "utf8").split(") ")[1].split(" ")[19];
const originalStartTicks = startTicks();
// Consume runtime connection internally, without printing or persisting credentials.
const runtime = Object.fromEntries(fs.readFileSync(`/proc/${pid}/environ`, "utf8").split("\0").filter(Boolean).map(s => {
  const i = s.indexOf("="); return [s.slice(0, i), s.slice(i + 1)];
}));
const live = readCatalog({ ...runtime, PATH: process.env.PATH });
assert.equal(live.readOnly, "on");
save("catalog-B0-live.json", live);
save("live-read-evidence.json", {
  capturedAt: new Date().toISOString(), pid: Number(pid), startTicks: originalStartTicks,
  source: "Unique retained API process connection; no credentials persisted",
  querySha256: sha(path.join(pkg, "release-catalog.sql")),
  transaction: "BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY; ROLLBACK",
  defaultTransactionReadOnly: true, schemaSha256: hash(live.schemaRows), attributesSha256: hash(live.attributes),
});
assert.equal(hash(live), hash(json(path.join(diagnostic, "actual-catalog.json"))),
  "STOP: additional discrepancy since the accepted live B0 diagnostic");
const differences = json(path.join(diagnostic, "differences.json"));
assert.equal(differences.length, 10);
const oldB1 = json(path.join(pkg, "verificacion-final/catalog-B1.json"));
const projected = structuredClone(oldB1);
for (const d of differences) {
  assert.equal(d.section, "attributes");
  const rows = projected.attributes.filter(r => r.kind === d.expected.kind && r.parent === d.expected.parent && r.name === d.expected.name);
  assert.equal(rows.length, 1);
  assert.deepEqual(rows[0], d.expected);
  Object.assign(rows[0], d.actual);
}
save("projected-B1-accepted-differences.json", projected);
let exported;
let successful = false;
try {
  exported = run("node", [path.join(pkg, "prepare-export.mjs"), "31804125a1e752bde128d72e9fd44d23972ffff1"]).trim();
  assert.ok(exported.startsWith("/tmp/e2-release-preparation-"));
  let fixture = run(path.join(root, "scripts/node_modules/.bin/tsx"),
    [path.join(pkg, "reconstruct-catalog-fixture.mjs"), path.join(exported, "source")]);
  const replaceOnce = (text, from, to) => {
    assert.equal(text.split(from).length, 2, `Expected exactly one replacement: ${from}`);
    return text.replace(from, to);
  };
  fixture = replaceOnce(fixture,
    `CREATE TYPE public."rol_usuario" AS ENUM ('ADMIN','TERMINAL','CAJA','SUPERVISOR','BODEGA','SISTEMAS','CONTADOR');`,
    `CREATE TYPE public."rol_usuario" AS ENUM ('ADMIN','CAJA','SUPERVISOR','BODEGA','SISTEMAS','CONTADOR');\nALTER TYPE public."rol_usuario" ADD VALUE 'TERMINAL' AFTER 'ADMIN';`);
  fixture = replaceOnce(fixture,
    `CREATE TYPE public."forma_pago_proveedor" AS ENUM ('EFECTIVO','TRANSFERENCIA','FACTURADO','CHEQUE','OTRO');`,
    `CREATE TYPE public."forma_pago_proveedor" AS ENUM ('EFECTIVO','TRANSFERENCIA','CHEQUE','OTRO','FACTURADO');`);
  fixture = replaceOnce(fixture, "\nCOMMIT;", "\nALTER TABLE public.ticket_linea_consumos ENABLE ALWAYS TRIGGER ticket_linea_consumos_append_only;\nCOMMIT;");
  const fixturePath = path.join(exported, "accepted-live-B0.sql");
  fs.writeFileSync(fixturePath, fixture);
  fs.writeFileSync(path.join(out, "accepted-live-B0-fixture.sql"), fixture);
  const isolated = path.join(exported, "validation");
  fs.mkdirSync(path.join(isolated, "sql"), { recursive: true });
  for (const name of ["release-preflight.mjs", "release-catalog.sql", "sql/01-install-evidence-prepared.sql", "sql/03-preflight-schema-prepared.sql"]) {
    fs.copyFileSync(path.join(pkg, name), path.join(isolated, name));
    assert.equal(sha(path.join(pkg, name)), sha(path.join(isolated, name)));
  }
  // Preserve the original validator and historical evidence; adapt only its isolated copy.
  let validator = fs.readFileSync(path.join(pkg, "validate-release-preflight.mjs"), "utf8");
  validator = replaceOnce(validator, "const before = readCatalog(env);", `const before = readCatalog(env);
  const accepted = JSON.parse(fs.readFileSync(${JSON.stringify(path.join(out, "catalog-B0-live.json"))}, "utf8"));
  record("fresh live B0 reproduced exactly BEFORE A+C", () => assert.deepEqual(before, accepted));`);
  validator = replaceOnce(validator, "const after = readCatalog(env);", `const after = readCatalog(env);
  const projected = JSON.parse(fs.readFileSync(${JSON.stringify(path.join(out, "projected-B1-accepted-differences.json"))}, "utf8"));
  record("B1 differs from historical B1 only by the ten accepted B0 attributes", () => assert.deepEqual(after, projected));
  record("A+C preserves all B0 enums and ALWAYS trigger", () => {
    const selected = c => c.attributes.filter(r => r.kind === "enum" || r.name === "ticket_linea_consumos_append_only");
    assert.deepEqual(selected(after), selected(before));
  });`);
  validator = replaceOnce(validator,
    "Archived exact B0 schema plus exact approved A+C SQL, reconstructed empty in fresh PostgreSQL; NOT observed live state.",
    "Fresh READ ONLY catalog from the retained API database accepted as B0 on 2026-09-22; identical empty reconstruction plus exact approved A+C SQL defines B1. Preserves live enums and ALWAYS trigger. Evidence: reports/e2-expectativas-20260922/.");
  validator = replaceOnce(validator, "record(\"external preflight CLI on fresh B1\", () => {", `record("external preflight CLI B0 rejects B1", () => {
    const result = spawnSync(process.execPath, [path.join(directory, "release-preflight.mjs"), "--before"], { env, encoding: "utf8", timeout: 30000 });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /catalog mismatch/);
  });
  record("external preflight CLI on fresh B1", () => {`);
  fs.writeFileSync(path.join(isolated, "validate-release-preflight.mjs"), validator);
  fs.writeFileSync(path.join(out, "isolated-validator-used.mjs.txt"), validator);
  const result = spawnSync("node", [path.join(isolated, "validate-release-preflight.mjs"), fixturePath],
    { env: clean, encoding: "utf8", timeout: 180000, maxBuffer: 32 * 1024 * 1024 });
  fs.writeFileSync(path.join(out, "preflight-validation.log"), result.stdout + result.stderr);
  if (fs.existsSync(path.join(isolated, "verificacion-final"))) {
    fs.cpSync(path.join(isolated, "verificacion-final"), path.join(out, "preflight"), { recursive: true });
  }
  assert.equal(result.status, 0, "Disposable validation failed; see evidence log. Do not publish expectations.");
  const results = json(path.join(out, "preflight/preflight-results.json"));
  assert.ok(!results.some(r => r.result === "FAIL"));
  assert.ok(results.some(r => r.name === "disposable PostgreSQL stopped" && r.exit === 0));
  assert.ok(results.some(r => r.name === "disposable PostgreSQL directory destroyed" && r.absent === true));
  fs.copyFileSync(path.join(isolated, "release-expected.json"), path.join(out, "release-expected.validated.json"));
  successful = true;
} finally {
  if (exported?.startsWith("/tmp/e2-release-preparation-")) fs.rmSync(exported, { recursive: true, force: true });
  assert.deepEqual(inventory(), protectedBefore, "Protected source/package/runtime changed during evidence generation");
  assert.equal(startTicks(), originalStartTicks, "API process must not restart");
  save("preservation-and-cleanup.json", {
    at: new Date().toISOString(), successful, protectedFilesUnchanged: true,
    protectedFileCount: Object.keys(protectedBefore).length,
    apiPid: Number(pid), apiStartTicksUnchanged: true, apiRestarts: 0, workflowActions: 0,
    liveDDL: 0, exportRemoved: exported ? !fs.existsSync(exported) : true,
    disposableCleanup: successful ? "verified in preflight/preflight-results.json" : "see preflight evidence",
  });
}
console.log("READ_ONLY_B0_AND_DISPOSABLE_B1=PASS");