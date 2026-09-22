"use strict";
// Schema-only support validation explicitly requested by MAIN. Not a UI/backend
// test runner: no application, transport, workflow, DB, esbuild or child process.
// Transpile current fixture/schema TS in memory; execute in a VM whose only
// imports are generated schemas and the installed Zod package.
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { createRequire } = require("node:module");
const root = path.resolve(__dirname, "../..");
const appRequire = createRequire(path.join(root, "artifacts/mariana-textil/package.json"));
const zodRequire = createRequire(path.join(root, "lib/api-zod/package.json"));
const ts = appRequire("typescript");
function load(relative, imports) {
  const source = fs.readFileSync(path.join(root, relative), "utf8");
  const compiled = ts.transpileModule(source, {
    fileName: relative, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  const context = vm.createContext({
    module, exports: module.exports,
    require(name) {
      if (!Object.prototype.hasOwnProperty.call(imports, name)) throw Error(`E5_SCHEMA_VALIDATION_IMPORT_DENIED ${name}`);
      return imports[name];
    },
  });
  new vm.Script(compiled, { filename: relative }).runInContext(context, { timeout: 30000 });
  return module.exports;
}
const schemas = load("lib/api-zod/src/generated/api.ts", { zod: zodRequire("zod") });
const fixture = load("artifacts/mariana-textil/src/components/e5-node-test-fixtures.ts", { "@workspace/api-zod": schemas });
let scenarios = 0;
const run = (name, fn) => { fn(); scenarios++; };
for (const name of ["currentUser", "availability", "context", "page", "preview", "createResponse",
  "proposalResponse", "authorizeResponse", "rejectResponse", "refundResponse", "refundOptions",
  "alerts", "document", "printResponse", "multiChargeReceipt", "receptionInput",
  "proposalInput", "authorizationInput"])
  run(name, () => fixture[name]());
for (const stage of ["pending", "proposed", "rejected", "partial", "applied", "returned"])
  run(`receipt-${stage}`, () => fixture.receipt({ stage }));
for (const role of ["ADMIN", "CAJA", "CONTADOR", "SUPERVISOR", "SISTEMAS", "BODEGA"])
  run(`role-${role}`, () => {
    fixture.currentUser(role); fixture.availability(role); fixture.context(role);
    fixture.refundResponse(role);
  });
run("OFF", () => fixture.availability("ADMIN", false));
run("ineligible-refund", () => fixture.refundOptions(false));
run("immediate-partial", () => fixture.createResponse(true));
run("full-application", () => fixture.authorizeResponse(true));
run("constancia-nested", () => fixture.document(true));
run("multicharge-context", () => fixture.context("CAJA", false, true));
run("multicharge-reception-apply", () => fixture.receptionInput(true, true));
for (const onlyFavor of [false, true]) run(`explicit-favor-${onlyFavor}`, () => {
  fixture.proposalInput(true, onlyFavor); fixture.authorizationInput(true, onlyFavor);
  fixture.favorProposalResponse(onlyFavor); fixture.favorAuthorizeResponse(onlyFavor);
  fixture.favorDocument(onlyFavor);
});
// Prove nested required-field enforcement, not just top-level AST inspection.
const badProposal = fixture.proposalResponse();
delete badProposal.propuestas[0].asignaciones[0].movimientoVentaId;
if (schemas.CreateE5PropuestaResponse.safeParse(badProposal).success)
  throw Error("E5_REQUIRED_NESTED_MOVEMENT_NOT_ENFORCED");
const badDocument = fixture.document(true);
delete badDocument.asignaciones[0].movimientoVentaId;
if (schemas.GetE5DocumentoResponse.safeParse(badDocument).success)
  throw Error("E5_REQUIRED_DOCUMENT_MOVEMENT_NOT_ENFORCED");
const badApplication = fixture.authorizeResponse();
delete badApplication.aplicaciones[0].asignaciones[0].movimientoVentaId;
if (schemas.AuthorizeE5AplicacionResponse.safeParse(badApplication).success)
  throw Error("E5_REQUIRED_APPLICATION_MOVEMENT_NOT_ENFORCED");
const badImmediateReception = fixture.receptionInput(true, true);
delete badImmediateReception.aplicarAhora[0].movimientoVentaId;
if (schemas.PreviewE5CobroBody.safeParse(badImmediateReception).success)
  throw Error("E5_REQUIRED_IMMEDIATE_MOVEMENT_NOT_ENFORCED");
console.log(JSON.stringify({
  status: "SCHEMA_SUPPORT_VALIDATED_NOT_UI_OR_BACKEND_PASS",
  scenarios, nestedMissingMovementRejections: 4, uiTestsExecuted: 0, backendTestsExecuted: 0,
}));