import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import mutations from "./backend-mutants.mjs";

const dir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(dir, "../..");
const logsRoot = path.join(dir, "logs");
const outputJson = path.join(dir, "backend-audit-consolidado.json");
const outputText = path.join(dir, "backend-audit-consolidado.md");
const digest = value => createHash("sha256").update(value).digest("hex");
const finalId = "E7-ATTRIBUTION-REAL-DOCUMENTS-AND-LEGENDS";
const expected = mutations.map(([name]) => name);
const documentIds = expected.slice(-2);
const prefixHistoricalExpected = expected.slice(0, -1);
const prefixFinalExpected = expected.slice(0, -2);

function argument(name) {
  const inline = process.argv.find(value => value.startsWith(`${name}=`));
  const index = process.argv.indexOf(name);
  if (inline && index >= 0) throw new Error(`Use one ${name} form`);
  return inline?.slice(name.length + 1) ?? (index >= 0 ? process.argv[index + 1] : undefined);
}
function durableDirectory(value, label) {
  if (!value) throw new Error(`${label} is required`);
  const resolved = path.resolve(root, value);
  const real = fs.realpathSync(resolved);
  const durable = fs.realpathSync(logsRoot) + path.sep;
  if (!real.startsWith(durable) || real.includes(`${path.sep}tmp${path.sep}`))
    throw new Error(`${label} must be a durable reports/e7/logs directory`);
  return real;
}
function readManifest(directory) {
  const file = path.join(directory, "manifest.json");
  return { file, value: JSON.parse(fs.readFileSync(file, "utf8")) };
}
function sameNames(actual, wanted, label) {
  if (JSON.stringify(actual) !== JSON.stringify(wanted)) throw new Error(`${label} IDs/order mismatch`);
}
function verifyRawLog(directory, name, phase, expectedHash, expectedResult) {
  const file = path.join(directory, `${name}-${phase}.log`);
  const real = fs.realpathSync(file);
  if (!real.startsWith(fs.realpathSync(logsRoot) + path.sep)) throw new Error(`Non-durable log: ${file}`);
  const raw = fs.readFileSync(real, "utf8");
  if (expectedHash && digest(raw) !== expectedHash) throw new Error(`Raw log hash mismatch: ${name} ${phase}`);
  if (!raw.includes(`# Subtest: ${name}`)) throw new Error(`Wrong test in raw log: ${name} ${phase}`);
  if (expectedResult === "green" && (!raw.includes("# pass 1") || raw.includes("# fail 1")))
    throw new Error(`Green evidence invalid: ${name} ${phase}`);
  if (expectedResult === "red" &&
      (!raw.includes("# fail 1") || !raw.includes("code: 'ERR_ASSERTION'") || !raw.includes(name)))
    throw new Error(`Red assertion evidence invalid: ${name} ${phase}`);
  if (expectedResult === "survived" && (!raw.includes("# pass 1") || raw.includes("# fail 1")))
    throw new Error(`Preserved survived-mutant evidence invalid: ${name} ${phase}`);
  return { path: path.relative(root, real), sha256: digest(raw) };
}
function verifyCase(directory, item) {
  const mutation = mutations.find(([name]) => name === item.name);
  if (!mutation) throw new Error(`Unknown case ${item.name}`);
  const [, file, before, after] = mutation;
  const current = fs.readFileSync(path.join(root, file), "utf8");
  if (current.split(before).length !== 2) throw new Error(`Current mutant anchor mismatch: ${item.name}`);
  const sourceHash = digest(current), mutantHash = digest(current.replace(before, after));
  if (item.sourceSha256 !== sourceHash || item.restoredSha256 !== sourceHash ||
      item.mutantSha256 !== mutantHash || item.green !== 0 || item.red === 0 || item.restored !== 0)
    throw new Error(`Source/mutant/restoration mismatch: ${item.name}`);
  return {
    id: item.name,
    source: file,
    sourceSha256: sourceHash,
    mutantSha256: mutantHash,
    restoredSha256: item.restoredSha256,
    logs: {
      green: verifyRawLog(directory, item.name, "green", item.rawLogsSha256.green, "green"),
      red: verifyRawLog(directory, item.name, "red", item.rawLogsSha256.red, "red"),
      restoredGreen: verifyRawLog(directory, item.name, "restored-green",
        item.rawLogsSha256.restoredGreen, "green"),
    },
  };
}

if (process.argv.includes("--validate-only")) {
  if (expected.length !== 14 || expected.at(-1) !== finalId ||
      new Set(expected).size !== expected.length) throw new Error("Auditor catalog is not the exact E7 matrix");
  console.log("Prepared durable E7 12-prefix + 2-current-documents auditor; no cases or manifests executed.");
  process.exit(0);
}

const prefixDirectory = durableDirectory(argument("--prefix"), "--prefix");
const prefix = readManifest(prefixDirectory);
if (prefix.value.status !== "FAIL" ||
    prefix.value.error !== `Error: Specific assertion mutant not killed: ${finalId}`)
  throw new Error("Prefix is not the preserved terminal survived-mutant FAIL");
sameNames(prefix.value.cases.map(item => item.name), prefixHistoricalExpected, "Prefix");
if (process.argv.includes("--verify-prefix")) {
  const prefixCases = prefix.value.cases.map(item => verifyCase(prefixDirectory, item));
  const terminalFailure = {
    green: verifyRawLog(prefixDirectory, finalId, "green", null, "green"),
    survivedRed: verifyRawLog(prefixDirectory, finalId, "red", null, "survived"),
  };
  const result = {
    status: "VERIFIED_PREFIX_13_TERMINAL_FAILURE_PRESERVED",
    manifest: { path: path.relative(root, prefix.file), sha256: digest(fs.readFileSync(prefix.file)) },
    prefixCases,
    terminalFailure,
    exactReplacementIds: documentIds,
  };
  const output = path.join(dir, "backend-prefix-verification.json");
  fs.writeFileSync(output, `${JSON.stringify(result, null, 2)}\n`);
  console.log(`Verified durable E7 historical prefix 13/14; current document replacement IDs: ${documentIds.join(", ")}`);
  process.exit(0);
}
const terminalDirectory = durableDirectory(argument("--terminal"), "--terminal");
if (prefixDirectory === terminalDirectory) throw new Error("Prefix and terminal evidence must be distinct");
const terminal = readManifest(terminalDirectory);
if (terminal.value.status !== "COMPLETE_EXPLICIT_SUBSET" ||
    JSON.stringify(terminal.value.requestedIds) !== JSON.stringify(documentIds))
  throw new Error("Terminal evidence must be the explicit two-document current cycle");
sameNames(terminal.value.cases.map(item => item.name), documentIds, "Terminal");
const currentTestHash = digest(fs.readFileSync(path.join(root, "artifacts/api-server/src/lib/e7.test.ts"), "utf8"));
if (terminal.value.sourceHashes["artifacts/api-server/src/lib/e7.test.ts"] !== currentTestHash)
  throw new Error("Terminal continuation did not use the current corrected test source");

const preservedTerminalFailure = {
  green: verifyRawLog(prefixDirectory, finalId, "green", null, "green"),
  survivedRed: verifyRawLog(prefixDirectory, finalId, "red", null, "survived"),
};
const historicalPrefixCases = prefix.value.cases.map(item => verifyCase(prefixDirectory, item));
sameNames(historicalPrefixCases.slice(0, -1).map(item => item.id), prefixFinalExpected, "Final prefix");
const supersededStatementCycle = historicalPrefixCases.at(-1);
if (supersededStatementCycle?.id !== documentIds[0])
  throw new Error("Historical statement cycle is not the expected superseded document case");
const cases = [
  ...historicalPrefixCases.slice(0, -1),
  ...terminal.value.cases.map(item => verifyCase(terminalDirectory, item)),
];
sameNames(cases.map(item => item.id), expected, "Consolidated");
const report = {
  status: "PASS",
  mode: "AUDITED_DURABLE_12_PREFIX_PLUS_2_CURRENT_DOCUMENTS",
  cardinality: { obligations: 14, mutants: 14, green: 14, red: 14, restoredGreen: 14 },
  evidence: {
    prefixManifest: path.relative(root, prefix.file),
    terminalManifest: path.relative(root, terminal.file),
    preservedTerminalFailure,
    supersededHistoricalStatementCycle: supersededStatementCycle,
  },
  testsSource: {
    prefixHistoricalSha256: prefix.value.sourceHashes["artifacts/api-server/src/lib/e7.test.ts"],
    terminalAndCurrentSha256: currentTestHash,
    reasonForDifference: "Final document assertion was strengthened to inspect all literal legends in parsed XLSX cells and parsed PDF text operators.",
  },
  cases,
  limitations: [
    "Synthetic finite SQL capture; not PostgreSQL, HTTP, authenticated acceptance, locks, or real database isolation proof.",
    "Grupo 1 exports only; no Grupo 4 interactive surface claim.",
    "Execution logs are durable under reports/e7/logs; transient snapshots were cleaned.",
  ],
};
fs.writeFileSync(outputJson, `${JSON.stringify(report, null, 2)}\n`);
fs.writeFileSync(outputText, `# E7 backend — auditoría consolidada\n\n` +
  `**PASS 14/14** mediante prefijo durable 12 + ciclo documental actual 2.\n\n` +
  `- Obligaciones/mutantes: 14/14.\n` +
  `- Green/red/restored-green: 14/14 cada fase.\n` +
  `- Fuentes, mutantes, restauraciones y logs: hashes verificados.\n` +
  `- Prefijo histórico 13 y FAIL terminal anterior: preservados y auditados; el ciclo STATE histórico fue sustituido por su ciclo documental actual.\n` +
  `- Evidencia: \`${path.relative(root, prefixDirectory)}\` y \`${path.relative(root, terminalDirectory)}\`.\n` +
  `- Límites: captura SQL sintética offline; no prueba PostgreSQL/HTTP/aceptación autenticada; Grupo 1 solamente.\n`);
console.log(`PASS 14/14 audited to ${path.relative(root, outputJson)} and ${path.relative(root, outputText)}`);