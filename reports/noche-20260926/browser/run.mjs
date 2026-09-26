#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { load, base } from "./runtime.mjs";
import { compile } from "./adapt.mjs";

const plan = JSON.parse(fs.readFileSync(path.join(base, "browser/plan.json"), "utf8"));
const [command, id] = process.argv.slice(2);
if (command === "--plan") {
  console.log(JSON.stringify(plan, null, 2));
  process.exit(0);
}
if (!["--case", "--all", "--compile"].includes(command)) throw Error("Usage: run.mjs --plan | --compile CASE | --case CASE | --all; explicit NIGHT_BROWSER_MANIFEST handoff required.");
const { m } = load();
if (command !== "--compile" && process.env.NIGHT_BROWSER_WINDOW !== "MAIN_EXCLUSIVE_GRANTED") throw Error("MAIN exclusive writer window required; permissions worker may still own the database");
fs.mkdirSync(m.privateDir, { recursive: true, mode: 0o700 });
const journalFile = path.join(m.privateDir, "night-browser-journal.json");
const journal = fs.existsSync(journalFile) ? JSON.parse(fs.readFileSync(journalFile, "utf8")) : {};
const selected = command === "--all" ? plan.cases : plan.cases.filter(x => x.id === id);
if (!selected.length) throw Error("Unknown case; consult --plan");
const summaryFile = path.join(base, "browser/execution.json");
const summary = fs.existsSync(summaryFile) ? JSON.parse(fs.readFileSync(summaryFile, "utf8")) : { cases: [], limitations: [
  "Only synthetic actors; copied real identities are never used.",
  "Physical scanner not exercised; real browser keyboard-wedge input is used.",
  "Access-floor ambiguity uses configured first active floor (nombre ASC); owner decision not invented.",
  "No refund business gate changes; unavailable return paths are blocked, never passed.",
  "Frozen bundle fingerprints are checked locally; MAIN remains responsible for process/DB-copy identity before handoff.",
  "No case is automatically replayed after any execution attempt; ambiguous writes need independent readback.",
  "Broad exploratory contracts must be populated from real screen/fixture evidence; absent coverage stays explicit."
] };
for (const item of selected) {
  const dir = path.join(base, `tarea-${item.task}`, item.id);
  fs.mkdirSync(dir, { recursive: true });
  const result = { id: item.id, task: item.task, status: "PREPARING" };
  try {
    let file, args = [];
    if (item.id.startsWith("continuation-") || item.id.startsWith("flow-")) file = compile(m, item.id, dir);
    else if (item.id === "audit") file = path.join(base, "browser/audit.mjs");
    else { file = path.join(base, "browser/inspect.mjs"); args = [item.id]; }
    const syntax = spawnSync(process.execPath, ["--check", file], { encoding: "utf8" });
    if (syntax.status !== 0) throw Error("Prepared script syntax check failed; see private diagnostics");
    if (command === "--compile") { console.log(JSON.stringify({ id: item.id, status: "COMPILED_NOT_EXECUTED" })); continue; }
    if (journal[item.id]) throw Error("Already attempted: inspect private journal and fresh readback; automatic replay prohibited");
    journal[item.id] = { status: "ATTEMPTED_UNCERTAIN", startedAt: new Date().toISOString(), apiSha256: m.bundle.apiSha256 };
    fs.writeFileSync(journalFile, JSON.stringify(journal, null, 2), { mode: 0o600 });
    const log = fs.openSync(path.join(m.privateDir, item.id + ".log"), "w", 0o600);
    let child;
    try { child = spawnSync(process.execPath, [file, ...args], { stdio: ["ignore", log, log], timeout: 600000, env: { ...process.env, NIGHT_BROWSER_MANIFEST: path.resolve(process.env.NIGHT_BROWSER_MANIFEST) } }); }
    finally { fs.closeSync(log); }
    const aliases = { "flow-close-recovery": "close", "flow-sale-remate": "sale", "flow-sale-transfer": "sale", "flow-credit-sale-settled": "credit-sale", "flow-authorize-credit-settled": "authorize-credit", "flow-abono-settled": "abono" };
    const stage = aliases[item.id] || item.id.replace(/^(flow|continuation)-/, "");
    const resultFile = item.id.startsWith("flow-") || item.id.startsWith("continuation-")
      ? path.join(dir, stage + "-result.json")
      : path.join(dir, "result.json");
    const detail = fs.existsSync(resultFile) ? JSON.parse(fs.readFileSync(resultFile, "utf8")) : null;
    result.status = child.status === 0 && detail?.status === "PASS" ? "PASS" : "PARTIAL_OR_BLOCKED";
    result.exitCode = child.status;
    result.resultFile = path.relative(base, resultFile);
    if (child.error) result.error = "Child execution timeout/error; do not replay unverified writes";
    if (!detail) result.error = "No final result file. Inspect private diagnostics; outcome uncertain";
    if (detail?.steps) result.observations = detail.steps.map((x, i) => ({ item: x.action || `step-${i}`, status: x.status || x.httpStatus || "OBSERVED" }));
    journal[item.id].status = result.status;
    journal[item.id].completedAt = new Date().toISOString();
    fs.writeFileSync(journalFile, JSON.stringify(journal, null, 2), { mode: 0o600 });
  } catch (e) {
    result.status = "BLOCKED";
    result.error = e.message;
  }
  fs.writeFileSync(path.join(dir, "case.json"), JSON.stringify(result, null, 2));
  summary.cases.push(result);
  fs.writeFileSync(summaryFile, JSON.stringify(summary, null, 2));
  console.log(JSON.stringify({ id: item.id, status: result.status }));
}