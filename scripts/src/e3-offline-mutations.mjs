import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, cpSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
const root = resolve(import.meta.dirname, "../..");
const app = join(root, "artifacts/api-server");
const require = createRequire(join(app, "package.json"));
const evidence = join(root, "reports/e3-20260921/backend-tests");
mkdirSync(evidence, { recursive: true });
const temp = mkdtempSync(join(tmpdir(), "e3-offline-"));
mkdirSync(join(temp, "src/lib"), { recursive: true });
mkdirSync(join(temp, "src/routes"), { recursive: true });
mkdirSync(join(temp, "node_modules"), { recursive: true });
for (const dependency of ["express", "zod"]) {
  const packageRoot = resolve(require.resolve(`${dependency}/package.json`), "..");
  symlinkSync(packageRoot, join(temp, "node_modules", dependency), "dir");
}
for (const file of ["e3-collection.ts", "e3-collection.test.ts", "e3-context.ts", "e3-legacy-capture.ts", "credit-allocation.ts", "credit-evidence-contract.ts", "date-only.ts", "request.ts"]) {
  cpSync(join(app, "src/lib", file), join(temp, "src/lib", file));
}
cpSync(join(app, "src/routes/e3-collections.ts"), join(temp, "src/routes/e3-collections.ts"));
writeFileSync(join(temp, "package.json"), JSON.stringify({ type: "module" }));
const domain = join(temp, "src/lib/e3-collection.ts"), route = join(temp, "src/routes/e3-collections.ts");
const context = join(temp, "src/lib/e3-context.ts");
const legacy = join(temp, "src/lib/e3-legacy-capture.ts");
const pristine = new Map([domain, route, context, legacy].map(path => [path, readFileSync(path, "utf8")]));
const mutations = [
  ["01", domain, "remanenteCentavos: input.importeCentavos -", "remanenteCentavos: 0 * input.importeCentavos -", "lost collection remainder"],
  ["02", domain, "if (input.previewToken !== preview.previewToken)", "if (false && input.previewToken !== preview.previewToken)", "stale preview accepted"],
  ["03", domain, "recibo: validateE3Receipt(previous.receipt), replay: true", "recibo: validateE3Receipt(previous.receipt), replay: false", "retry misclassified as new"],
  ["04", domain, 'origin === "CAJA" ? "INGRESO_FISICO" : "CORRECCION_CONTABLE"', 'origin === "CAJA" ? "INGRESO_FISICO" : "INGRESO_FISICO"', "recapture classified as physical money"],
  ["05", domain, 'origin === "CAJA" && input.formaPago === "EFECTIVO" ? input.sesionCajaId : null', 'origin === "CAJA" ? input.sesionCajaId : null', "bank transfer assigned physical cash session"],
  ["06", domain, "amount !== pending.reduce", "amount > pending.reduce", "P6 short payment accepted"],
  ["07", domain, "saldoAFavorCentavos: nonnegative, deudaCentavos: nonnegative", "saldoAFavorCentavos: nonnegative.default(0), deudaCentavos: nonnegative", "historic missing balance reconstructed as zero"],
  ["08", route, "if (!E3_ENABLED)", "if (false && !E3_ENABLED)", "source release gate bypassed"],
  ["09", domain, "if (!await tx.hasPreview(", "if (false && !await tx.hasPreview(", "forged or expired preview accepted without issuance"],
  ["10", domain, "if (bound && bound.intentHash !== intentHash)", "if (false && bound && bound.intentHash !== intentHash)", "another actor overwrites pending preview intent"],
  ["11", context, 'if (actor.rol === "ADMIN")', 'if (actor.rol === "ADMIN" || actor.rol === "CAJA")', "cashier reads another site"],
  ["12", domain, "actorNombre: state.actorNombre", "actorNombre: String(actor.id)", "internal actor id printed instead of frozen name"],
  ["13", domain, "folio: await tx.allocateFolio(input.sitioId)", "folio: `E3-${input.operacionClave}`", "UUID substituted for per-site folio counter"],
  ["14", legacy, "if (enabled)", "if (false && enabled)", "legacy capture bypasses dedicated recapture permission"],
];
function run(label, pattern) {
  const result = spawnSync(process.execPath, [
    "--require", join(root, "scripts/src/offline-test-guard.cjs"),
    "--import", join(root, "scripts/node_modules/tsx/dist/loader.mjs"),
    "--test", ...(pattern ? [`--test-name-pattern=^E3-${pattern} `] : []),
    join(temp, "src/lib/e3-collection.test.ts"),
  ], { cwd: temp, encoding: "utf8", env: {
    PATH: process.env.PATH ?? "", HOME: process.env.HOME ?? "", NODE_ENV: "test",
    DATABASE_URL: "postgresql://e1-offline.invalid:9/forbidden",
  } });
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
  writeFileSync(join(evidence, `${label}.log`), output);
  return { status: result.status, output };
}
if (run("green-before").status !== 0) throw new Error("Baseline not green");
const summary = [];
for (const [id, path, before, after, defect] of mutations) {
  const source = pristine.get(path);
  if (source.split(before).length !== 2) throw new Error(`Mutation ${id} is not unique`);
  writeFileSync(path, source.replace(before, after));
  try {
    const red = run(`red-${id}`, id);
    if (red.status !== 1 || !red.output.includes(`E3-${id} `) ||
        !/AssertionError|ERR_ASSERTION/.test(red.output)) throw new Error(`Mutation ${id} did not yield a named assertion failure`);
    summary.push({ test: `E3-${id}`, defect, redExit: red.status });
  } finally { writeFileSync(path, source); }
}
if (run("green-restored").status !== 0) throw new Error("Restored implementation not green");
writeFileSync(join(evidence, "mutations.json"), JSON.stringify({
  sourceBaseRevision: "55ac9c70181a01e6b42c56a8beb334417f6512f0", isolation: temp,
  database: "no connections; inherited credentials removed; offline socket/process guard",
  greenBefore: 14, greenRestored: 14, mutations: summary,
}, null, 2) + "\n");
console.log(`E3 offline: 14 green, 14 named assertion failures, 14 restored green. ${evidence}`);