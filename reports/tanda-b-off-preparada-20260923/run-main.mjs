// MAIN-only entry. Explicit allowlisted environment, no database URL in argv or evidence.
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { report, requireMain, closedEnv, write } from "./common.mjs";
requireMain();
const mode = process.argv[2];
if (!["capture", "preflight"].includes(mode) || process.argv.length !== 3) throw new Error("Usage: run-main.mjs capture|preflight");
if (!process.env.DATABASE_URL || !process.env.TANDA_B_PG_BIN || process.env.TANDA_B_RUNTIME_PID !== "191") throw new Error("Explicit DATABASE_URL, TANDA_B_PG_BIN and TANDA_B_RUNTIME_PID=191 required");
const env = { PATH: process.env.PATH, HOME: process.env.HOME, LANG:"C.UTF-8",
  DATABASE_URL:process.env.DATABASE_URL, TANDA_B_PG_BIN:process.env.TANDA_B_PG_BIN,
  TANDA_B_RUNTIME_PID:"191", TANDA_B_MAIN_ONLY:"AUTHORIZED",
  API_INSPECTION_BOOT:"1", NODE_ENV:"development", ...closedEnv };
const evidence = path.join(report, "evidencia", `${mode}-cli.json`);
if (fs.existsSync(evidence)) throw new Error("CLI evidence exists; refusing overwrite");
const result = spawnSync(process.execPath, [path.join(report, mode === "capture" ? "capture-readonly.mjs" : "release-preflight.mjs")],
  { env, encoding:"utf8", timeout:300000, maxBuffer:4*1024*1024 });
const token = mode === "capture" ? "TANDA_B_CAPTURE=PASS_READ_ONLY" : "TANDA_B_OFF_REAL_PREFLIGHT=PASS";
const pass = result.status === 0 && result.stdout.includes(token);
write(evidence, { status:pass ? "PASS" : "FAIL", exit:result.status, positiveExecutionToken:result.stdout.includes(token),
  stdout:result.stdout, stderr:result.stderr, credentialsRecorded:false });
if (!pass) process.exitCode=1;
console.log(`${mode.toUpperCase()}=${pass ? "PASS" : "FAIL"}`);