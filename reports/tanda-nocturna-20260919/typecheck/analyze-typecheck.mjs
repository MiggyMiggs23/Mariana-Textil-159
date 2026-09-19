import fs from "node:fs";

const [logPath, exitPath, outputPath, revision] = process.argv.slice(2);
if (!logPath || !exitPath || !outputPath || !revision) {
  throw new Error("usage: node analyze-typecheck.mjs LOG EXIT OUTPUT REVISION");
}

const log = fs.readFileSync(logPath, "utf8");
const exitCode = Number(fs.readFileSync(exitPath, "utf8").trim());
const outcomePattern = /^(PASS|FAIL|SKIP) (.+?) \[(library|library-stage|package)\](?: \((\d+) TypeScript errors\))?$/gm;
const outcomes = [...log.matchAll(outcomePattern)].map((match) => ({
  status: match[1],
  package: match[2],
  kind: match[3],
  diagnostics: match[4] === undefined ? null : Number(match[4]),
}));
const number = (label) => {
  const match = log.match(new RegExp(`^${label}: (\\d+)`, "m"));
  return match ? Number(match[1]) : null;
};
const summary = {
  revision,
  rootCanonicalCommand: "pnpm run typecheck",
  exitCode,
  allSelectedChecksCompleted: /RESULT: (?:PASS|FAIL) \(all selected checks completed;/.test(log),
  selectedArtifactsAndScripts: number("Packages selected"),
  uniqueDiagnostics: number("Unique TypeScript diagnostics"),
  repeatedDiagnosticEmissions: number("Repeated diagnostic emissions"),
  processParserFailures: number("Process/parser failures"),
  outcomes,
};

if (!outcomes.length) {
  throw new Error("canonical runner emitted no package outcomes");
}
if ([summary.uniqueDiagnostics, summary.repeatedDiagnosticEmissions, summary.processParserFailures].includes(null)) {
  throw new Error("canonical runner summary is incomplete");
}
fs.writeFileSync(outputPath, `${JSON.stringify(summary, null, 2)}\n`);