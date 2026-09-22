// Static reconciliation only. Reads source, manifests and existing logs; never executes tests.
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import mutations from "./backend-mutants.mjs";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
const testFile = "artifacts/api-server/src/lib/e5.test.ts";
const logRoot = path.join(root, "reports/e5/logs");
const output = path.join(root, "reports/e5/backend-consolidation.json");
const ts = createRequire(path.join(root, "artifacts/api-server/package.json"))("typescript");
const sha = value => createHash("sha256").update(value).digest("hex");
const read = file => fs.readFileSync(path.join(root, file), "utf8");
const uniqueReplace = (text, before, after, label) => {
  if (text.split(before).length !== 2) throw new Error(`RECONSTRUCTION_ANCHOR ${label}`);
  return text.replace(before, after);
};
const parse = text => {
  const ast = ts.createSourceFile(testFile, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  if (ast.parseDiagnostics.length) throw new Error("TEST_AST_PARSE");
  return ast;
};
const testDeclarations = ast => new Map(ast.statements.flatMap(statement => {
  if (!ts.isExpressionStatement(statement) || !ts.isCallExpression(statement.expression) ||
      statement.expression.expression.getText(ast) !== "test") return [];
  const name = statement.expression.arguments[0];
  return ts.isStringLiteral(name) ? [[name.text, statement.getText(ast)]] : [];
}));
const helperDeclarations = ast => new Map(ast.statements.flatMap((statement, index) => {
  if (ts.isImportDeclaration(statement)) return [];
  if (ts.isExpressionStatement(statement) && ts.isCallExpression(statement.expression) &&
      statement.expression.expression.getText(ast) === "test") return [];
  let name = `statement:${index}`;
  if ((ts.isFunctionDeclaration(statement) || ts.isClassDeclaration(statement)) && statement.name) name = statement.name.text;
  if (ts.isVariableStatement(statement)) name = statement.declarationList.declarations.map(d => d.name.getText(ast)).join(",");
  return [[name, statement.getText(ast)]];
}));
const identifiers = (ast, declaration) => {
  const result = new Set();
  const visit = node => { if (ts.isIdentifier(node)) result.add(node.text); ts.forEachChild(node, visit); };
  visit(declaration);
  return result;
};

const current = read(testFile);
const currentAst = parse(current);
const currentTests = testDeclarations(currentAst);
if (currentTests.size !== 49 || mutations.length !== 49) throw new Error("CASE_CARDINALITY");

const sequenceHelper = `function spySequence(...results: Record<string, unknown>[][]) {
  const queries: { sql: string; params: unknown[] }[] = []; let call = 0;
  const tx: E5Sql = { execute: async q => {
    const x = dialect.sqlToQuery(q); queries.push(x); return { rows: results[call++] ?? [] };
  } };
  return { tx, queries };
}
`;
const currentLoad = `test("E5-LOAD-FOR-UPDATE", async () => {
  const s = spySequence([{ id: admin.id, rol: admin.rol, ubicacion_id: admin.ubicacionId }], []);
  await e5Repository(s.tx, deps).load(key(1), admin);
  assert.match(s.queries[0]!.sql, /FROM usuarios[\\s\\S]*FOR SHARE/);
  assert.match(s.queries[1]!.sql, /FROM e5_cobros[\\s\\S]*FOR UPDATE/);
});`;
const oldLoad = `test("E5-LOAD-FOR-UPDATE", async () => {
  const s = spy(); await e5Repository(s.tx, deps).load(key(1), admin); assert.match(s.queries[0]!.sql, /FOR UPDATE/);
});`;
const currentE1 = `test("E5-E1-CORRECT-PRODUCER", async () => {
  const x = await pending(); const s = spySequence(
    [{ id: admin.id, rol: admin.rol, ubicacion_id: admin.ubicacionId }], [], [], []);
  await e5Repository(s.tx, deps).receive(x.detail, receive(), admin);
  assert.match(s.queries[0]!.sql, /FROM usuarios[\\s\\S]*FOR SHARE/);
  const e1 = s.queries.filter(q => /operaciones_credito_e1|cobros_credito_pendientes_e1/.test(q.sql));
  assert.equal(e1.length, 2); assert.match(e1[0]!.sql, /COBRO_PENDIENTE/);
});`;
const oldE1 = `test("E5-E1-CORRECT-PRODUCER", async () => {
  const x = await pending(); const s = spy([{ id: admin.id, rol: admin.rol, ubicacion_id: admin.ubicacionId }]);
  await e5Repository(s.tx, deps).receive(x.detail, receive(), admin);
  const e1 = s.queries.filter(q => /operaciones_credito_e1|cobros_credito_pendientes_e1/.test(q.sql));
  assert.equal(e1.length, 2); assert.match(e1[0]!.sql, /COBRO_PENDIENTE/);
});`;
const currentCash = currentTests.get("E5-CASH-RETAINED-WITHOUT-APPLICATION");
const oldCash = `test("E5-CASH-RETAINED-WITHOUT-APPLICATION", () => {
  const retained = creditCashDocuments(9, [], [{ sesionCajaId: 9, naturaleza: "INGRESO_FISICO",
    medio: "EFECTIVO", cuentaDestino: "CAJA_FISICA", operacionProductor: "COBRO_PENDIENTE",
    operacionClave: key(1), importe: "10.00" }]);
  const total = calculateCash(retained);
  assert.equal(total.cobrosRetenidos, "10.00"); assert.equal(total.abonosFisicos, "0.00");
  assert.throws(() => creditCashDocuments(9, [{ id: 1, clienteId: 7, sesionCajaId: 9,
    naturaleza: "OPERACION_CREDITO_SIN_DINERO", formaPago: null, cuentaDestino: null, tipo: "ABONO",
    importe: "-10.00", operacionProductor: "E5_APLICACION_RETENIDA", operacionClave: key(2) }], []),
  /identidad\\/origen físico soportado/);
});`;
let snapshot2d = uniqueReplace(current, sequenceHelper, "", "remove-spySequence");
snapshot2d = uniqueReplace(snapshot2d, currentLoad, oldLoad, "old-load");
snapshot2d = uniqueReplace(snapshot2d, currentE1, oldE1, "old-e1");
const snapshotA749 = uniqueReplace(snapshot2d, currentCash, oldCash, "old-cash");
const snapshots = new Map([
  [sha(snapshotA749), { text: snapshotA749, label: "A749_PRE_CASH_FIX" }],
  [sha(snapshot2d), { text: snapshot2d, label: "2D227_POST_CASH_FIX" }],
  [sha(current), { text: current, label: "EFA7_CURRENT" }],
]);
for (const [expected, label] of [
  ["a749f3cafec5a712da7102f97b6605585928f7a086b15d76e943cfa733d4dce5", "a749"],
  ["2d2277ea6d8ab001fda8e9075f2a5b9240f1a370f48298fd48d60dec89a93b87", "2d227"],
  ["efa7f41070cee32dcafe17360d69a48ad0bc40622fd195b367fb3b241f919261", "current"],
]) if (!snapshots.has(expected)) throw new Error(`SNAPSHOT_RECONSTRUCTION ${label}`);

const manifestFiles = fs.readdirSync(logRoot)
  .map(dir => `reports/e5/logs/${dir}/manifest.json`)
  .filter(file => fs.existsSync(path.join(root, file))).sort();
const manifests = manifestFiles.map(file => {
  const bytes = read(file), value = JSON.parse(bytes);
  return { file, bytes, value };
});
const allEvidence = new Map();
for (const manifest of manifests)
  for (const item of manifest.value.cases ?? []) allEvidence.set(item.name, { manifest, item });
if (allEvidence.size !== 49) throw new Error(`UNIQUE_TERMINAL_COUNT ${allEvidence.size}`);

const infrastructurePattern = /Cannot find module|Could not resolve|SyntaxError|E12_OFFLINE_ACCESS_BLOCKED|E5_OFFLINE_WRITE_BLOCKED/;
const terminal = [];
for (const [id] of mutations) {
  const evidence = allEvidence.get(id);
  if (!evidence) throw new Error(`MISSING_CASE ${id}`);
  const { manifest, item } = evidence;
  const dir = path.dirname(path.join(root, manifest.file));
  const phase = name => fs.readFileSync(path.join(dir, `${id}-${name}.log`), "utf8");
  const green = phase("green"), red = phase("red"), restored = phase("restored-green");
  if (item.green !== 0 || item.red === 0 || item.restored !== 0 ||
      !green.includes("# pass 1") || !red.includes("# fail 1") ||
      !red.includes("ERR_ASSERTION") || !red.includes(id) || !restored.includes("# pass 1") ||
      infrastructurePattern.test(green + red + restored))
    throw new Error(`NOT_TERMINAL_SPECIFIC_ASSERTION ${id}`);
  const source = read(item.file);
  if (source.split(item.before).length !== 2 ||
      sha(source.replace(item.before, item.after)) !== item.mutantHash)
    throw new Error(`CURRENT_MUTANT_MISMATCH ${id}`);
  for (const [file, expected] of Object.entries(manifest.value.sourceHashes)) {
    if (file === testFile) continue;
    if (sha(read(file)) !== expected) throw new Error(`DEPENDENCY_CHANGED ${id} ${file}`);
  }
  const testHash = manifest.value.sourceHashes[testFile];
  const snapshot = snapshots.get(testHash);
  if (!snapshot) throw new Error(`UNRECONCILED_TEST_SNAPSHOT ${id} ${testHash}`);
  const historicalTests = testDeclarations(parse(snapshot.text));
  if (historicalTests.get(id) !== currentTests.get(id)) throw new Error(`CASE_DECLARATION_CHANGED ${id}`);
  terminal.push({ id, evidenceManifest: manifest.file, evidenceManifestStatus: manifest.value.status,
    testSnapshotSha256: testHash, testSnapshotLabel: snapshot.label,
    declarationSha256: sha(currentTests.get(id)), productiveFile: item.file,
    productiveCurrentSha256: sha(source), mutantSha256: item.mutantHash,
    phases: ["GREEN_EXIT_0", "RED_ERR_ASSERTION_ID", "RESTORED_GREEN_EXIT_0"] });
}

const helperSnapshots = {};
for (const [snapshotHash, snapshot] of snapshots) {
  const ast = parse(snapshot.text), helpers = helperDeclarations(ast);
  helperSnapshots[snapshotHash] = Object.fromEntries([...helpers].map(([name, declaration]) =>
    [name, { sha256: sha(declaration), current: helperDeclarations(currentAst).get(name) === declaration }]));
}
const changedHelpers = [];
const currentHelpers = helperDeclarations(currentAst);
for (const [snapshotHash, snapshot] of snapshots) {
  if (snapshotHash === sha(current)) continue;
  const historical = helperDeclarations(parse(snapshot.text));
  for (const name of new Set([...historical.keys(), ...currentHelpers.keys()])) {
    if (historical.get(name) === currentHelpers.get(name)) continue;
    const affected = [];
    for (const statement of currentAst.statements) {
      if (!ts.isExpressionStatement(statement) || !ts.isCallExpression(statement.expression) ||
          statement.expression.expression.getText(currentAst) !== "test") continue;
      const id = statement.expression.arguments[0]?.text;
      if (id && identifiers(currentAst, statement).has(name)) affected.push(id);
    }
    changedHelpers.push({ fromSnapshotSha256: snapshotHash, helper: name,
      change: historical.has(name) ? (currentHelpers.has(name) ? "CHANGED" : "REMOVED") : "ADDED",
      currentCaseReferences: affected });
  }
}
if (changedHelpers.some(change => change.helper !== "spySequence" ||
    change.currentCaseReferences.some(id => !["E5-LOAD-FOR-UPDATE", "E5-E1-CORRECT-PRODUCER"].includes(id))))
  throw new Error("UNRECONCILED_HELPER_IMPACT");

const currentHashes = {};
for (const file of new Set(manifests.flatMap(m => Object.keys(m.value.sourceHashes))))
  currentHashes[file] = sha(read(file));
const feature = read("artifacts/api-server/src/lib/e5-feature.ts");
if (!/export const E5_ENABLED = false;/.test(feature) || !/export const E5_CONTADOR_A_ENABLED = false;/.test(feature))
  throw new Error("SOURCE_GATES_NOT_FALSE");

const report = {
  status: "CONSOLIDATED_STATIC_EVIDENCE_49_UNIQUE_NOT_SINGLE_SUITE_PASS",
  generatedAt: new Date().toISOString(),
  testsExecutedByAudit: 0,
  databaseOrSqlExecutedByAudit: false,
  uniqueTerminalCases: terminal.length,
  invalidatedCaseIds: [],
  rerunRequiredCaseIds: [],
  sourceGates: { E5_ENABLED: false, E5_CONTADOR_A_ENABLED: false },
  manifests: manifests.map(({ file, bytes, value }) => {
    const sourceHashMismatchesCurrent = Object.entries(value.sourceHashes).flatMap(([source, expected]) => {
      const currentHash = sha(read(source));
      return currentHash === expected ? [] : [{ source, manifestSha256: expected, currentSha256: currentHash }];
    });
    return { file, sha256: sha(bytes), status: value.status, error: value.error ?? null,
      recordedCases: value.cases?.length ?? 0, sourceHashMismatchesCurrent };
  }),
  testSnapshots: Object.fromEntries([...snapshots].map(([hashValue, snapshot]) => [hashValue, {
    label: snapshot.label, declarationCount: testDeclarations(parse(snapshot.text)).size,
    changedDeclarationsAgainstCurrent: [...testDeclarations(parse(snapshot.text))]
      .filter(([id, declaration]) => currentTests.get(id) !== declaration).map(([id]) => id),
  }])),
  changedHelpers,
  helperSnapshots,
  currentSourceHashes: currentHashes,
  terminal,
  limitations: [
    "Synthetic in-memory actors/repository and captured SQL requests only.",
    "No PostgreSQL, transaction isolation, locks, triggers or DDL semantics were executed.",
    "No integrated HTTP routing/authentication/application server was executed.",
    "FAIL manifests remain FAIL; terminal cycles are reconciled individually and are not relabeled.",
    "Earlier setup/infrastructure failures remain recorded and are not counted as cases.",
  ],
};
fs.writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify({ output: path.relative(root, output), status: report.status,
  uniqueTerminalCases: report.uniqueTerminalCases, invalidatedCaseIds: report.invalidatedCaseIds,
  testsExecuted: 0 }, null, 2));