import { createHash } from "node:crypto";
import { closeSync, openSync, readFileSync, writeSync } from "node:fs";

const [pid, stage, status, preflightExit, exitCode] = process.argv.slice(2);
let sha256 = null;
let hashError = null;
try {
  sha256 = createHash("sha256")
    .update(readFileSync("artifacts/api-server/dist-e3-20260922/index.mjs")).digest("hex");
} catch (error) {
  hashError = error.code ?? "HASH_READ_FAILED";
}
const entry = {
  utc: new Date().toISOString(), pid: Number(pid),
  pid_role: stage === "exec_attempt" ? "exec_target" : "startup_shell_no_api",
  api_exec_attempted: stage === "exec_attempt",
  bundle_sha256: sha256, bundle_hash_error: hashError,
  mode: { NODE_ENV: process.env.NODE_ENV ?? null, API_INSPECTION_BOOT: process.env.API_INSPECTION_BOOT ?? null },
  closed: { e3: true, remate: true, cashGateRetirementNotApplied: true },
  preflight: { result: status, exit_code: preflightExit === "" ? null : Number(preflightExit) },
  stage, startup_exit_before_exec: stage === "exec_attempt" ? null : Number(exitCode),
};
let fd;
try {
  const line = Buffer.from(`${JSON.stringify(entry)}\n`);
  fd = openSync("reports/arranques-api.log", "a", 0o600);
  if (writeSync(fd, line) !== line.length) throw new Error("SHORT_APPEND");
} catch {
  console.error("WARNING: API start audit append failed (details withheld).");
  process.exitCode = 1;
} finally {
  if (fd !== undefined) {
    try { closeSync(fd); } catch { process.exitCode = 1; }
  }
}