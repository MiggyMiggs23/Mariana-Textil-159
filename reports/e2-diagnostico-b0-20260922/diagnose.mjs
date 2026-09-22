// Authorized read-only live catalog + empty disposable reconstruction. No app imports.
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { readCatalog, hash } from "../e2-paquete-liberacion-preparado-20260921/release-preflight.mjs";

const out = path.dirname(fileURLToPath(import.meta.url));
const workspace = process.cwd();
const pkg = path.join(workspace, "reports/e2-paquete-liberacion-preparado-20260921");
assert.ok(fs.existsSync(path.join(pkg, "autorizacion-diagnostico-b0-solo-lectura.txt")));
const save = (name, value) => fs.writeFileSync(path.join(out, name), JSON.stringify(value, null, 2) + "\n");
const inventory = () => {
  const result = {};
  const walk = dir => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const name = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(name);
      else if (entry.isFile()) result[path.relative(workspace, name)] = hash(fs.readFileSync(name, "utf8"));
    }
  };
  for (const dir of [pkg, "artifacts/api-server/dist", "artifacts/api-server/dist-e2-20260927"]) walk(dir);
  return result;
};
const before = inventory();
const clean = { PATH: process.env.PATH, HOME: "/tmp", LANG: "C.UTF-8" };
const run = (cmd, args, options = {}) => {
  const p = spawnSync(cmd, args, { env: clean, encoding: "utf8", timeout: 120000, maxBuffer: 32 * 1024 * 1024, ...options });
  if (p.status !== 0) throw new Error(`Isolated command ${path.basename(cmd)} failed (${p.status}): ${p.stderr}`);
  return p.stdout;
};
// Select the actual retained API process, never a connector or inherited DB target.
const candidates = fs.readdirSync("/proc").filter(x => /^\d+$/.test(x)).filter(pid => {
  try {
    const args = fs.readFileSync(`/proc/${pid}/cmdline`, "utf8").split("\0").filter(Boolean);
    return /(?:^|\/)node$/.test(args[0] ?? "") &&
      args.some(a => a === "artifacts/api-server/dist/index.mjs" || a === path.join(workspace, "artifacts/api-server/dist/index.mjs"));
  } catch { return false; }
});
assert.equal(candidates.length, 1, "Exactly one retained API process required.");
const pid = candidates[0];
const runtime = Object.fromEntries(fs.readFileSync(`/proc/${pid}/environ`, "utf8").split("\0").filter(Boolean).map(s => {
  const i = s.indexOf("=");
  return [s.slice(0, i), s.slice(i + 1)];
}));
// Only readCatalog consumes credentials; neither runtime env nor URI is saved/logged.
const actual = readCatalog({ ...runtime, PATH: process.env.PATH });
assert.equal(actual.readOnly, "on");
save("actual-catalog.json", actual);
save("live-read-evidence.json", {
  capturedAt: new Date().toISOString(), pid: Number(pid),
  connectionSource: "Environment of the uniquely identified retained API node process; credentials not persisted",
  query: "Unmodified release-catalog.sql via original readCatalog",
  querySha256: hash(fs.readFileSync(path.join(pkg, "release-catalog.sql"), "utf8")),
  transaction: "BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY; ... ROLLBACK",
  defaultTransactionReadOnly: true,
  identity: Object.fromEntries(Object.entries(actual).filter(([k]) => !["schemaRows", "attributes"].includes(k))),
});
let exported;
let temp;
let started = false;
let stopped = false;
try {
  exported = run("node", [path.join(pkg, "prepare-export.mjs"), "31804125a1e752bde128d72e9fd44d23972ffff1"]).trim();
  assert.ok(exported.startsWith("/tmp/e2-release-preparation-"));
  const fixture = run(path.join(workspace, "scripts/node_modules/.bin/tsx"),
    [path.join(pkg, "reconstruct-catalog-fixture.mjs"), path.join(exported, "source")]);
  temp = fs.mkdtempSync("/tmp/e2-b0-diagnostic-pg-");
  fs.chmodSync(temp, 0o700);
  const socket = path.join(temp, "socket");
  fs.mkdirSync(socket);
  const pg = { ...clean, HOME: temp, PGHOST: socket, PGPORT: "55438", PGUSER: "postgres", PGDATABASE: "heliumdb" };
  run("initdb", ["-U", "postgres", "-A", "trust", "--no-locale", "-E", "UTF8", "-D", path.join(temp, "data")]);
  run("pg_ctl", ["-D", path.join(temp, "data"), "-l", path.join(temp, "postgres.txt"), "-o", `-k ${socket} -h "" -p 55438`, "-w", "start"]);
  started = true;
  run("createdb", ["heliumdb"], { env: pg });
  run("psql", ["-X", "-q", "-A", "-t", "-v", "ON_ERROR_STOP=1"], { env: pg, input: fixture });
  const expected = readCatalog({ ...clean, API_INSPECTION_BOOT: "1", NODE_ENV: "development",
    DATABASE_URL: `postgresql://postgres@localhost:55438/heliumdb?host=${encodeURIComponent(socket)}` });
  const approved = JSON.parse(fs.readFileSync(path.join(pkg, "release-expected.json"), "utf8"));
  assert.equal(hash(expected.schemaRows), approved.baseSchemaSha256, "Reconstruction must match approved B0 schema");
  assert.equal(hash(expected.attributes), approved.baseAttributesSha256, "Reconstruction must match approved B0 attributes");
  save("reconstructed-catalog.json", expected);
  const diffs = [];
  const counts = {};
  for (const section of ["schemaRows", "attributes"]) {
    const key = r => JSON.stringify(section === "schemaRows"
      ? [r.kind, r.schema_name, r.object_name, r.parent_name] : [r.kind, r.parent, r.name]);
    const e = new Map(expected[section].map(r => [key(r), r]));
    const a = new Map(actual[section].map(r => [key(r), r]));
    assert.equal(e.size, expected[section].length, "Duplicate expected row identity");
    assert.equal(a.size, actual[section].length, "Duplicate actual row identity");
    let equal = 0;
    for (const id of [...new Set([...e.keys(), ...a.keys()])].sort()) {
      const er = e.get(id), ar = a.get(id);
      if (er && ar && er.definition === ar.definition) { equal++; continue; }
      diffs.push({ section, key: JSON.parse(id), expected: er ?? null, actual: ar ?? null });
    }
    counts[section] = { expected: e.size, actual: a.size, equal, differences: diffs.filter(x => x.section === section).length };
  }
  save("differences.json", diffs);
  save("comparison-summary.json", {
    counts, sourceRevision: approved.source, reconstructionMatchesApprovedB0: true,
    expectedIdentity: Object.fromEntries(Object.entries(expected).filter(([k]) => !["schemaRows", "attributes"].includes(k))),
    actualIdentity: Object.fromEntries(Object.entries(actual).filter(([k]) => !["schemaRows", "attributes"].includes(k))),
    expectedSchemaSha256: hash(expected.schemaRows), actualSchemaSha256: hash(actual.schemaRows),
    expectedAttributesSha256: hash(expected.attributes), actualAttributesSha256: hash(actual.attributes),
    fixtureSha256: hash(fixture), onlyB0Reconstructed: true,
  });
  console.log(JSON.stringify({ counts, differences: diffs }, null, 2));
} finally {
  if (started) {
    run("pg_ctl", ["-D", path.join(temp, "data"), "-m", "immediate", "-w", "stop"]);
    stopped = true;
  }
  if (temp && (!started || stopped)) fs.rmSync(temp, { recursive: true, force: true });
  if (exported?.startsWith("/tmp/e2-release-preparation-")) fs.rmSync(exported, { recursive: true, force: true });
  assert.deepEqual(inventory(), before, "Protected files must remain identical");
  save("cleanup-and-preservation.json", {
    at: new Date().toISOString(), postgresStarted: started, postgresStopped: stopped,
    disposableDirectoryRemoved: temp ? !fs.existsSync(temp) : true,
    exportedSourceRemoved: exported ? !fs.existsSync(exported) : true,
    protectedFilesUnchanged: true, protectedFileCount: Object.keys(before).length,
    apiProcessStillPresent: fs.existsSync(`/proc/${pid}`),
    apiPid: Number(pid), workflowActions: 0, apiRestarts: 0,
  });
}