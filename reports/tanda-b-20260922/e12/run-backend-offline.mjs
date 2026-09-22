// MAIN ONLY: explicit node:test green/red cases on physical snapshots, never SQL/app.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
const dir = path.dirname(fileURLToPath(import.meta.url)), root = path.resolve(dir, "../../..");
const require = createRequire(path.join(root, "artifacts/api-server/package.json"));
const { build } = require("esbuild");
const base = "artifacts/api-server/src/lib/";
const source = base + "e12-supplier-cash.ts", cash = base + "caja-cash-ledger.ts";
const http = base + "e12-http.ts", adapter = base + "e12-fondo-executor.ts", reader = base + "e12-cash-ledger.ts";
const e4 = base + "e4-cash-out-repository.ts", tests = base + "e12-supplier-cash.test.ts";
const guard = "reports/tanda-b-20260922/e12/offline-guard.cjs";
const fondo = base + "fondo.ts";
const files = [source, cash, http, adapter, reader, e4, fondo, base + "e4-cash-out.ts", tests, guard];
const mutations = [
  ["E12-OFF-PAY", source, 'if (!enabled) throw new E12Error("E12_DISABLED"', 'if (false) throw new E12Error("E12_DISABLED"'],
  ["E12-OFF-RETURN", source, 'if (!enabled) throw new E12Error("E12_DISABLED"', 'if (false) throw new E12Error("E12_DISABLED"'],
  ["E12-OFF-READ", reader, "if (!enabled) return [];", "if (false) return [];"],
  ["E12-OFF-HTTP", http, "    requireE12();", "    // defect: ignore new fields while OFF"],
  ["E12-DECIMAL", source, "const payment = await repo.payment(normalized, actor);", 'const payment = await repo.payment({ ...normalized, importe: "0.04" }, actor);'],
  ["E12-PRECISION", http, "Math.abs(value * 100 - Math.round(value * 100)) > 0.000001", "false"],
  ["E12-NEGATIVE", source, 'if (!/^(0|[1-9]\\d*)\\.\\d{2}$/.test(raw))', "if (false)"],
  ["E12-SUM", source, "total === 0n || cash + fund !== total", "total === 0n"],
  ["E12-MIXED-EXAMPLE", source, "await repo.outflow(session!.id, input.split.caja, input.proveedorId", "await repo.outflow(session!.id, input.importe, input.proveedorId"],
  ["E12-CASH-ONLY", source, "const fundMovement = fund > 0n ?", "const fundMovement = fund >= 0n ?"],
  ["E12-FUND-NO-SESSION", source, "if (cash > 0n) {\n    session =", "if (cash >= 0n) {\n    session ="],
  ["E12-SESSION", source, 'if (!session || session.ubicacionId !== 1 || session.estado !== "ABIERTA")\n      throw new E12Error("E12_SESSION_CLOSED", "Se requiere sesión abierta de Mariana."', 'if (false)\n      throw new E12Error("E12_SESSION_CLOSED", "Se requiere sesión abierta de Mariana."'],
  ["E12-SCOPE", source, '(actor.rol !== "ADMIN" && actor.ubicacionId !== 1)', "(false)"],
  ["E12-PRIVACY", source, '(usesFund && actor.rol !== "ADMIN")', "(false)"],
  ["E12-JSON-PRIVACY", source, 'if (role === "ADMIN") return value;', 'if (role === "ADMIN" || role === "CAJA") return value;'],
  ["E12-PROVIDER", source, "if (!await repo.provider(input.proveedorId))", "if (false)"],
  ["E12-CASH-INSUFFICIENT", source, 'if (!override) throw new E12Error("E12_CAJA_INSUFICIENTE", "Saldo de caja insuficiente; requiere desbloqueo ADMIN motivado.", 409);', "if (!override) return null;"],
  ["E12-OVERRIDE-ADMIN", source, "usuarioId: actor.id, createdAt: new Date().toISOString(), saldoAntes:", "usuarioId: 0, createdAt: new Date().toISOString(), saldoAntes:"],
  ["E12-OVERRIDE-ROLE", source, 'if (override && actor.rol !== "ADMIN")', "if (false)"],
  ["E12-OVERRIDE-REASON", source, "!override.motivo.trim() || override.motivo.trim().length > 1000", "false || override.motivo.trim().length > 1000"],
  ["E12-FUND-INSUFFICIENT", source, 'if (balance.saldo.startsWith("-") || e12Money(balance.saldo) < fund)', "if (false)"],
  ["E12-REPLAY", source, "if (previous) return replayResult(previous, actor, content);\n  if (!await repo.provider", "if (false) return replayResult(previous!, actor, content);\n  if (!await repo.provider"],
  ["E12-REPLAY-CONTENT", source, "previous.actorId !== actor.id || previous.content !== content", "previous.actorId !== actor.id"],
  ["E12-FAILURE-ROLLBACK", source, "const fundMovement = fund > 0n ? await repo.fund(e12Format(fund), key, actor, reason) : null;", "const fundMovement = null;"],
  ["E12-CONCURRENT-MODEL", source, 'if (balance.saldo.startsWith("-") || e12Money(balance.saldo) < fund)', "if (false)"],
  ["E12-RETURN-EXACT", source, "repo.income(session.id, original.caja, input.pagoId", "repo.income(session.id, original.total, input.pagoId"],
  ["E12-RETURN-KIND", source, "input.motivo.trim(), original.movimientoFondoId, input.naturaleza)", 'input.motivo.trim(), original.movimientoFondoId, "RECUPERACION_EFECTIVO")'],
  ["E12-RETURN-ONCE", source, "if (original.retorno) throw", "if (false) throw"],
  ["E12-RETURN-FUND-ONLY", source, "if (e12Money(original.caja) > 0n)", "if (e12Money(original.caja) >= 0n)"],
  ["E12-RETURN-PRIVACY", source, "e12Scope(actor, e12Money(original.fondo) > 0n);", "e12Scope(actor);"],
  ["E12-CASH-RETURNS", cash, "- sums.SALIDA + sums.RETORNO_PROVEEDOR)", "- sums.SALIDA)"],
  ["E12-CLOSED-FROZEN", cash, "if (snapshots.length === 0) return legacy;", "if (snapshots.length === 0) { await liveReader(); return legacy; }"],
  ["E12-PARAMETER-ADAPTER", adapter, 'sql`${values[Number(part.slice(1)) - 1]}`', "sql.raw(String(values[Number(part.slice(1)) - 1]))"],
  ["E12-E4-GUARD-BEFORE-WRITE", e4, "await integration?.beforeInsert(input, actor);", "// defect: bypass shared P12 guard"],
  ["E12-DIRECTED-SOURCE", http, "return { ...source, claveOperacion: parsed.claveOperacion,", 'return { ...source, caja: "0.00", claveOperacion: parsed.claveOperacion,'],
  ["E12-DIRECTED-NO-REPARTITION", http, "export const e12ApprovalSchema = z.object({ claveOperacion: z.string().uuid(), desbloqueoCaja: e12OverrideSchema.optional() }).strict();", "export const e12ApprovalSchema = z.object({ claveOperacion: z.string().uuid(), desbloqueoCaja: e12OverrideSchema.optional() }).passthrough();"],
  ["E12-FONDO-SAME-TRANSACTION", fondo, "const request = { idempotencyKey: input.clave, motivo: input.motivo.slice(0, 500) };", 'const request = { idempotencyKey: input.clave, motivo: input.motivo.slice(0, 500) }; await tx.query("COMMIT");'],
  ["E12-FONDO-RECOVERY-PHYSICAL", fondo, 'input.original && input.naturalezaRetorno === "CORRECCION_CAPTURA"', 'input.original && input.naturalezaRetorno === "RECUPERACION_EFECTIVO"'],
  ["E12-FONDO-CORRECTION-NOT-PHYSICAL", fondo, 'input.original && input.naturalezaRetorno === "CORRECCION_CAPTURA"', 'input.original && false'],
  ["E12-FONDO-REAL-WITHDRAWAL-GUARD", fondo, 'if (naturaleza === "RETIRO" && state.saldo < amount)', "if (false)"],
];
const originals = new Map(files.map(file => [file, fs.readFileSync(path.join(root, file), "utf8")]));
const names = [...originals.get(tests).matchAll(/test\("([^"]+)"/g)].map(match => match[1]);
if (new Set(names).size !== names.length || names.length !== mutations.length ||
  mutations.some(([name]) => !names.includes(name))) throw new Error("Every explicit test requires its own isolated mutant");
for (const [name, file, before] of mutations)
  if (originals.get(file).split(before).length !== 2) throw new Error(`Unique mutation anchor absent: ${name}`);
if (process.argv.includes("--validate-only")) {
  console.log(`Prepared ${mutations.length} explicit green/red cases; no tests executed.`);
  process.exit(0);
}
const stamp = new Date().toISOString().replaceAll(":", "-");
const logs = path.join(dir, "logs", `backend-${stamp}`);
const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), "e12-offline-"));
fs.mkdirSync(logs, { recursive: true });
const hash = text => createHash("sha256").update(text).digest("hex");
const manifest = { mode: "OFFLINE_SYNTHETIC_NO_SQL_NO_APP", startedAt: stamp,
  sourceHashes: Object.fromEntries([...originals].map(([f, value]) => [f, hash(value)])), cases: [] };
const env = Object.fromEntries(Object.entries(process.env).filter(([name]) => !/DATABASE|POSTGRES|^PG[A-Z_]|^DIRECT_URL$|^NODE_OPTIONS$/.test(name)));
env.NODE_ENV = "test";
async function bundle(name, mutation) {
  const target = path.join(sandbox, name);
  for (const [file, content] of originals) {
    const output = path.join(target, file);
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.writeFileSync(output, mutation && mutation[1] === file ? content.replace(mutation[2], mutation[3]) : content);
    if (fs.lstatSync(output).isSymbolicLink() || !fs.realpathSync(output).startsWith(fs.realpathSync(target) + path.sep))
      throw new Error("Mutable snapshot escape");
  }
  const output = path.join(target, "test.mjs");
  const buildResult = await build({ entryPoints: [path.join(target, tests)], outfile: output,
    bundle: true, platform: "node", format: "esm", target: "node24", metafile: true, logLevel: "silent",
    nodePaths: [path.join(root, "artifacts/api-server/node_modules"), path.join(root, "lib/api-zod/node_modules")] });
  for (const file of Object.keys(buildResult.metafile.inputs)) {
    const real = fs.realpathSync(path.resolve(file));
    if (real.startsWith(root + path.sep) && !real.includes(`${path.sep}node_modules${path.sep}`)) throw new Error(`Live mutable input: ${real}`);
  }
  return { output, target };
}
function execute(built, name, phase) {
  const result = spawnSync(process.execPath, ["--require", path.join(built.target, guard),
    "--test", "--test-isolation=none", "--test-reporter=tap", "--test-name-pattern", `^${name}$`, built.output],
  { env, encoding: "utf8", timeout: 60000, maxBuffer: 8 * 1024 * 1024 });
  const text = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
  fs.writeFileSync(path.join(logs, `${name}-${phase}.log`), text);
  if (result.error || result.signal || /Cannot find module|Could not resolve|SyntaxError|E12_OFFLINE_ACCESS_BLOCKED/.test(text))
    throw new Error(`Infrastructure/setup failure, never accepted red: ${name} ${phase}`);
  return { exit: result.status, text };
}
try {
  const green = await bundle("green");
  for (const mutation of mutations) {
    const name = mutation[0], g = execute(green, name, "green");
    if (g.exit !== 0 || !g.text.includes(`# pass 1`)) throw new Error(`Green failed: ${name}`);
    const red = await bundle(name, mutation), r = execute(red, name, "red");
    if (r.exit === 0 || !r.text.includes(`# fail 1`) || !r.text.includes(name))
      throw new Error(`Specific behavioral mutant not killed: ${name}`);
    manifest.cases.push({ name, green: g.exit, red: r.exit, file: mutation[1],
      before: mutation[2], after: mutation[3], mutantHash: hash(originals.get(mutation[1]).replace(mutation[2], mutation[3])) });
    fs.writeFileSync(path.join(logs, "manifest.json"), JSON.stringify(manifest, null, 2));
  }
  manifest.status = "PASS";
  console.log(`PASS ${manifest.cases.length}/${mutations.length}; synthetic model only. ${logs}`);
} catch (error) {
  manifest.status = "FAIL"; manifest.error = String(error); process.exitCode = 1;
} finally {
  fs.writeFileSync(path.join(logs, "manifest.json"), JSON.stringify(manifest, null, 2));
  fs.rmSync(sandbox, { recursive: true, force: true });
}