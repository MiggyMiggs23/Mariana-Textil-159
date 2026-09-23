// Explicitly authorized DTO/Zod fixture validation only. No UI tests imported.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { createHash } from "node:crypto";
const root = process.cwd(), app = "artifacts/mariana-textil";
const require = createRequire(path.join(root, app, "package.json")), ts = require("typescript");
const loaded = new Map();
function load(file) {
  file = path.resolve(file);
  if (loaded.has(file)) return loaded.get(file);
  const source = fs.readFileSync(file, "utf8"), module = { exports: {} };
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const nativeRequire = createRequire(file);
  const sourceRequire = specifier => {
    // Authentic TypeScript dependencies only; no hook/page execution and no stub.
    if (specifier.startsWith(".")) {
      const candidate = path.resolve(path.dirname(file), specifier) + ".ts";
      if (fs.existsSync(candidate)) return load(candidate).data;
    }
    return nativeRequire(specifier);
  };
  new Function("require", "module", "exports", js)(sourceRequire, module, module.exports);
  const result = { data: module.exports, sha256: createHash("sha256").update(source).digest("hex") };
  loaded.set(file, result);
  return result;
}
const fixtures = load(`${app}/src/components/e11-node-test-transport.ts`);
const generated = load("lib/api-zod/src/generated/api.ts"), f = fixtures.data, z = generated.data;
const pairs = [
  ["GetE11DisponibilidadResponse", f.available], ["GetE11IdentidadResponse", f.identity()],
  ["GetE11PerfilResponse", { ...f.identity(), usuarioId: 9 }], ["AssignE11PerfilResponse", f.event],
  ["ListE11PerfilHistorialResponse", f.history], ["ListE11FiscalClientesResponse", f.fiscalClients],
  ["ListE11FiscalVentasResponse", f.sales], ["GetE11FiscalFacturaResponse", f.sale],
  ["ListE11FinanzasClientesResponse", f.financialClients], ["ListE11FinanzasNotasResponse", f.notes],
  ["GetE11FinanzasEstadoCuentaResponse", f.account], ["ListE11ConciliacionesResponse", f.periods],
  ["CreateE11ConciliacionResponse", f.snapshot], ["GetE11ConciliacionResponse", f.snapshot],
  ["ListE11ConciliacionVentasResponse", f.sales], ["DecideE11ConciliacionResponse", f.snapshot],
  ["ListE11PreparacionesResponse", f.preparations], ["GetE11PreparacionResponse", f.preparation],
  ["PrepareE11AplicacionResponse", { ...f.preparation, revision: 2, propuestaId: f.OTHER }],
  ["GetE11OperacionRecuperacionResponse", f.recoveryPending],
  ["ResolveE11OperacionResponse", f.recoveryTombstone],
];
for (const [name, data] of pairs) { if (!z[name]) throw Error(`SCHEMA_MISSING ${name}`); z[name].parse(data); }
for (const row of [f.recoveryPending, f.recoveryCommitted, f.recoveryConfirmed, f.recoveryTombstone]) {
  z.GetE11OperacionRecuperacionResponse.parse(row);
  z.ResolveE11OperacionResponse.parse(row);
}
z.ResolveE11OperacionBody.parse(f.resolution);
z.GetE11IdentidadResponse.parse(f.recoveryIdentity);
z.GetE11DisponibilidadResponse.parse(f.recoveryAvailability);
z.GetE11OperacionRecuperacionParams.parse(f.recoveryPending);
z.ResolveE11OperacionParams.parse(f.recoveryPending);
const invalid = [
  ["GetE11OperacionRecuperacionResponse", { ...f.recoveryPending, actorId: 0 }],
  ["GetE11OperacionRecuperacionResponse", { ...f.recoveryPending, accion: "RECIBIR" }],
  ["GetE11OperacionRecuperacionResponse", { ...f.recoveryPending, uuidOriginal: "not-a-uuid" }],
  ["GetE11OperacionRecuperacionResponse", { ...f.recoveryPending, revision: "v1" }],
  ["ResolveE11OperacionBody", { ...f.resolution, uuid: "not-a-uuid" }],
  ["ResolveE11OperacionBody", { ...f.resolution, motivo: "" }],
  ["ResolveE11OperacionBody", { ...f.resolution, motivo: "x".repeat(501) }],
  ["ResolveE11OperacionBody", { ...f.resolution, identidadVersion: "v1" }],
  ["ResolveE11OperacionBody", { ...f.resolution, revisionEsperada: "v1" }],
];
for (const [name, data] of invalid) if (z[name].safeParse(data).success) throw Error(`INVALID_FIXTURE_ACCEPTED ${name}`);
const output = `reports/e11/frontend-fixtures-${new Date().toISOString().replaceAll(":", "-")}.json`;
fs.writeFileSync(output, JSON.stringify({ status: "PASS_21_RESPONSE_FIXTURES_NOT_UI_EXECUTION", casesExecuted: 0,
  fixtureSha256: fixtures.sha256, generatedZodSha256: generated.sha256, schemas: pairs.map(([name]) => name),
  recoveryPositiveVariants: 4, invalidRecoveryFixturesRejected: invalid.length,
  note: "Schema validation is not authority to release quarantine: semantic exact-terna/state/resolution checks require mounted UI tests.",
  inputHashes: Object.fromEntries([...loaded].map(([file, result]) => [path.relative(root, file), result.sha256])),
}, null, 2), { flag: "wx" });
console.log(output);