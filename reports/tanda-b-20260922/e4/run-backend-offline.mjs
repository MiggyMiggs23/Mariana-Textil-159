/**
 * MAIN: node reports/tanda-b-20260922/e4/run-backend-offline.mjs
 * Bundles explicit tests from physical snapshots. NEVER runs SQL or starts an app.
 */
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";

const dir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(dir, "../../..");
const require = createRequire(path.join(root, "artifacts/api-server/package.json"));
const { build } = require("esbuild");
const source = "artifacts/api-server/src/lib/e4-cash-out.ts";
const adapter = "artifacts/api-server/src/lib/e4-cash-out-repository.ts";
const testFile = "artifacts/api-server/src/lib/e4-cash-out.test.ts";
const contract = "lib/api-zod/src/generated/api.ts";
const guard = "reports/tanda-b-20260922/e4/offline-guard.cjs";
const files = [source, adapter, testFile, "artifacts/api-server/src/lib/caja-cash-ledger.ts", contract, guard];
const hash = value => createHash("sha256").update(value).digest("hex");
const originals = new Map(files.map(file => [file, fs.readFileSync(path.join(root, file), "utf8")]));
const run = path.join(dir, "logs", `backend-${new Date().toISOString().replaceAll(":", "-")}`);
fs.mkdirSync(run, { recursive: true });
const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), "e4-backend-offline-"));
const manifest = {
  startedAt: new Date().toISOString(), mode: "OFFLINE_SYNTHETIC_REPOSITORIES_NO_SQL_NO_APP",
  sourceHashes: Object.fromEntries([...originals].map(([file, content]) => [file, hash(content)])),
  cases: [], tests: testFile, sandbox,
};
const env = Object.fromEntries(Object.entries(process.env).filter(([name]) =>
  !/DATABASE|POSTGRES|^PG[A-Z_]|^DIRECT_URL$|^NODE_OPTIONS$/.test(name)));
env.NODE_ENV = "test";
const mutations = [
  ["E4-OFF-CREATE", source, 'if (!enabled) fail(', 'if (false) fail('],
  ["E4-OFF-REVIEW", source, 'if (!enabled) fail(', 'if (false) fail('],
  ["E4-OFF-READ", adapter, 'if (!enabled) return new Map();', 'if (false) return new Map();'],
  ["E4-CAPTURE-ROLE", source, 'if (!roles.includes(actor.rol))', 'if (false)'],
  ["E4-OWN-STORE", source, 'if (actor.rol !== "ADMIN" && actor.ubicacionId !== location)', 'if (false)'],
  ["E4-PROVIDER-LOCATION", source, 'if (input.tipo === "PROVEEDOR" && session.ubicacionId !== E4_MARIANA_LOCATION_ID)', 'if (false)'],
  ["E4-PROVIDER-REQUIRED", source, 'if (input.tipo === "PROVEEDOR" && (!Number.isInteger(proveedorId) || Number(proveedorId) <= 0))', 'if (false)'],
  ["E4-PROVIDER-ACTIVE", source, 'if (proveedorId !== null && !await repo.providerActive(proveedorId))', 'if (false)'],
  ["E4-EXTRA-ACCOUNT", source, 'if (input.tipo === "EXTRAORDINARIA" && (proveedorId !== null || input.cuentaOrigen !== "CAJA_FISICA"))', 'if (false)'],
  ["E4-EXPLICIT-KIND", source, 'if (input.tipo !== "EXTRAORDINARIA" && input.tipo !== "PROVEEDOR")', 'if (false)'],
  ["E4-REASON", source, '|| !value.trim() ||', '|| false ||'],
  ["E4-AMOUNT", source, 'if (cents <= 0n || cents > 999999999999n)', 'if (cents < 0n || cents > 999999999999n)'],
  ["E4-CLOSED", source, 'if (session.estado !== "ABIERTA")', 'if (false)'],
  ["E4-CAPTURE-RETRY", source, 'if (previous) return retry(previous, actor, request) as E4Salida;', 'if (false) return retry(previous!, actor, request) as E4Salida;'],
  ["E4-RETRY-CONTENT", source, 'operation.actorId !== actor.id || operation.request !== request', 'operation.actorId !== actor.id'],
  ["E4-RETRY-ACTOR", source, 'operation.actorId !== actor.id || operation.request !== request', 'operation.request !== request'],
  ["E4-REVIEW-ROLE", source, 'input.accion === "RESPONDER" ? ["SUPERVISOR"] : ["ADMIN"]', '["ADMIN", "SUPERVISOR", "CAJA"]'],
  ["E4-RESPONSE-REASON", source, ': text(input.explicacion, 2000);', ': (input.explicacion ?? "");'],
  ["E4-RESPONSE-SCOPE", source, 'if (actor.rol !== "ADMIN" && actor.ubicacionId !== location)', 'if (false)'],
  ["E4-REVIEW-VERSION", source, 'if (current.version !== input.version)', 'if (false)'],
  ["E4-REVIEW-STATE", source, 'if (!allowed.includes(current.estado))', 'if (false)'],
  ["E4-REVIEW-RETRY", source, 'if (previous) return retry(previous, actor, request) as E4Revision;', 'if (false) return retry(previous!, actor, request) as E4Revision;'],
  ["E4-COMPETING-REVIEWS", source, 'if (current.version !== input.version)', 'if (false)'],
  ["E4-CYCLE-CASH", source, ': "RESPONDIDA",', ': "ACEPTADA",'],
  ["E4-ATOMIC-AUDIT", source, 'await repo.audit(created.id, actor.id, "SALIDA_DINERO_CAJA", {\n    ...created, ubicacionId: session.ubicacionId,\n  }, input.ip);', '/* DEFECT: omitted final atomic audit */'],
  ["E4-PROOF", source, 'if (input.accion !== "RESPONDER" || !valid || comprobanteUrl.length > 2000)', 'if (false)'],
  ["E4-ADAPTER-LOCKS", adapter, 'FOR UPDATE OF s`', '`'],
  ["E4-ADAPTER-CAS", adapter, 'if (result.rows.length !== 1)', 'if (false)'],
  ["E4-READER", adapter, 'row.revision as E4Revision', 'undefined as unknown as E4Revision'],
  // Only the exact corte endpoint schema is changed; other response schemas remain intact.
  ["E4-CONTRACT", contract, 'export const ObtenerCorteCajaResponse = zod.object({', 'export const ObtenerCorteCajaResponse = zod.object({', "corte"],
  ["E4-OFFLINE-GUARD", guard, 'require("node:net").Socket.prototype.connect = deny;',
    'require("node:net").Socket.prototype.connect = function () { return this; };'],
  ["E4-ADAPTER-WRITE", adapter, 'estado: input.tipo === "EXTRAORDINARIA" ? "PENDIENTE" : "NO_APLICA"',
    'estado: input.tipo === "EXTRAORDINARIA" ? "ACEPTADA" : "NO_APLICA"'],
  ["E4-PERMISSIONS-ON", source, 'enabled ? "cobros_pagos" : "cortes"', 'enabled ? "cortes" : "cortes"'],
  ["E4-PERMISSIONS-OFF", source, 'enabled ? "cobros_pagos" : "cortes"', 'enabled ? "cobros_pagos" : "cobros_pagos"'],
];
if (mutations.length === 0) throw new Error("Empty explicit test manifest");
const declared = [...originals.get(testFile).matchAll(/test\("([^"]+)"/g)].map(match => match[1]);
if (declared.length !== mutations.length || mutations.some(([name]) => !declared.includes(name)))
  throw new Error("Every new test must have exactly one isolated negative control");
const requestedCases = process.argv.slice(2);
if (requestedCases.some(name => !declared.includes(name)) || new Set(requestedCases).size !== requestedCases.length)
  throw new Error("Unknown or duplicate explicit case selection");
const selectedMutations = requestedCases.length ? mutations.filter(([name]) => requestedCases.includes(name)) : mutations;
if (selectedMutations.length === 0) throw new Error("Empty selected test manifest");
manifest.plannedCases = selectedMutations.map(([name, file, before, after, special]) => ({ name, file, before, after, special }));
manifest.caseCount = selectedMutations.length;
manifest.totalDeclaredCases = mutations.length;
fs.writeFileSync(path.join(run, "manifest.json"), JSON.stringify(manifest, null, 2));

async function snapshot(name, mutation) {
  const target = path.join(sandbox, name);
  fs.mkdirSync(target, { recursive: true });
  for (const [file, content] of originals) {
    const output = path.join(target, file);
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.writeFileSync(output, content);
    if (fs.lstatSync(output).isSymbolicLink() || !fs.realpathSync(output).startsWith(fs.realpathSync(target) + path.sep))
      throw new Error("Mutable file escaped physical snapshot");
  }
  if (mutation) {
    const [, file, before, after, special] = mutation;
    const original = originals.get(file);
    let changed;
    if (special === "corte") {
      const start = original.indexOf(before);
      const end = original.indexOf("\nexport ", start + before.length);
      if (start < 0 || end < 0) throw new Error("Exact corte endpoint boundary absent");
      const section = original.slice(start, end);
      if (!section.includes('"e4": zod.object({')) throw new Error("Corte mutation anchor absent");
      changed = original.slice(0, start) + section.replace('"e4": zod.object({', '"e4Removed": zod.object({') + original.slice(end);
    } else {
      if (original.split(before).length !== 2) throw new Error(`Mutation anchor must occur once: ${name}`);
      changed = original.replace(before, after);
    }
    fs.writeFileSync(path.join(target, file), changed);
  }
  const outfile = path.join(target, "case.test.mjs");
  const result = await build({
    entryPoints: [path.join(target, testFile)], outfile, bundle: true, platform: "node", format: "esm",
    target: "node24", metafile: true, logLevel: "silent",
    alias: { "@workspace/api-zod": path.join(target, contract) },
    nodePaths: [path.join(root, "artifacts/api-server/node_modules"), path.join(root, "lib/api-zod/node_modules")],
  });
  // Any mutable workspace input must come from this physical snapshot, not a workspace package symlink.
  for (const file of Object.keys(result.metafile.inputs)) {
    const real = fs.realpathSync(path.resolve(file));
    if (real.startsWith(root + path.sep) && !real.includes(`${path.sep}node_modules${path.sep}`))
      throw new Error(`Unexpected live mutable input: ${real}`);
  }
  return outfile;
}
function execute(bundle, name, phase) {
  const args = ["--require", path.join(path.dirname(bundle), guard), "--test", "--test-isolation=none",
    "--test-reporter=tap", "--test-name-pattern", `^${name}$`, bundle];
  const result = spawnSync(process.execPath, args, { env, encoding: "utf8", timeout: 60000, maxBuffer: 8 * 1024 * 1024 });
  const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
  fs.writeFileSync(path.join(run, `${name}-${phase}.log`), output);
  if (result.error) throw result.error;
  return { exit: result.status, output, args };
}
try {
  const green = await snapshot("green");
  for (const mutation of selectedMutations) {
    const [name, file, before, after] = mutation;
    const baseline = execute(green, name, "green");
    if (baseline.exit !== 0 || !new RegExp(`\\bok \\d+ - ${name}(?:\\n|\\r|$)`).test(baseline.output))
      throw new Error(`GREEN failed or selected test did not run: ${name}`);
    const candidate = await snapshot(name, mutation);
    const red = execute(candidate, name, "red");
    // Setup, syntax, missing import, blocked network and timeouts are NOT acceptable reds.
    if (red.exit !== 1 || !new RegExp(`not ok \\d+ - ${name}(?:\\n|\\r|$)`).test(red.output) ||
        !/ERR_ASSERTION/.test(red.output) || /(?:Error: |error: ['"])E4_OFFLINE_ACCESS_BLOCKED|ERR_MODULE_NOT_FOUND|SyntaxError/.test(red.output))
      throw new Error(`RED not an isolated assertion failure: ${name}`);
    manifest.cases.push({ name, file, before, after, green: baseline.exit, red: red.exit,
      logs: [`${name}-green.log`, `${name}-red.log`] });
    fs.writeFileSync(path.join(run, "manifest.json"), JSON.stringify(manifest, null, 2));
    console.log(`${name}: GREEN / isolated RED`);
  }
  manifest.status = "PASS";
} catch (error) {
  manifest.status = "FAIL";
  manifest.error = String(error);
  process.exitCode = 1;
} finally {
  for (const [file, content] of originals) {
    if (hash(fs.readFileSync(path.join(root, file))) !== hash(content)) {
      manifest.status = "FAIL_SOURCE_CHANGED";
      process.exitCode = 1;
    }
  }
  manifest.finishedAt = new Date().toISOString();
  fs.writeFileSync(path.join(run, "manifest.json"), JSON.stringify(manifest, null, 2));
  console.log(`Manifest: ${path.relative(root, path.join(run, "manifest.json"))}`);
  // Keep failing physical copies for diagnosis; accepted run can discard snapshots.
  if (manifest.status === "PASS") fs.rmSync(sandbox, { recursive: true, force: true });
}