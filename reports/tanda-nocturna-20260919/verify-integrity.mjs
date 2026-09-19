// Read-only runtime/source check. Never imports application modules or connects.
import fs from "node:fs";
import cp from "node:child_process";
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const base = "52fba053c44241263abc78c8085e5a8d0a6637c9";
const candidate = "7643992863b4956757d18a32b92a3c0f5fe9f6ad";
const output = path.dirname(fileURLToPath(import.meta.url));
const git = (...args) => cp.execFileSync("git", args, { encoding: "utf8" }).trim();
const all = git("ls-tree", "-r", "--name-only", base).split("\n");
const protectedFile = p =>
  /^reports\/(e1-|e2-)/.test(p) ||
  /\/(credit-(?:abono-evidence|refund|evidence|capture)|caja-corte|corte-caja|e1-)/.test(p) ||
  [
    "artifacts/api-server/src/routes/admin-analytics.ts",
    "artifacts/api-server/src/lib/admin-analytics.ts",
    "artifacts/api-server/src/routes/pos.ts",
    "artifacts/api-server/src/routes/caja.ts",
    "artifacts/api-server/src/pos-caja-final.contract.test.ts",
    "lib/db/src/lib/clientes-schema.ts",
    "lib/api-spec/openapi.yaml",
  ].includes(p);
const protectedPaths = all.filter(protectedFile);
// Committed and uncommitted changes both count.
git("diff", "--exit-code", base, "--", ...protectedPaths);
const changed = git("diff", "--name-only", base, candidate).split("\n");
if (changed.some(protectedFile)) throw Error("Protected candidate file changed");
const hash = p => crypto.createHash("sha256").update(fs.readFileSync(p)).digest("hex");
const bundleHash = hash("artifacts/api-server/dist/index.mjs");
const runtimePreflightHash = hash("reports/e2-apertura-limitada/reconstruccion/runtime-preflight.mjs");
if (bundleHash !== "3415998ed6eb1b8d6977793ac53f43ce91477f691b12f5c8dc11d14a2b801a98") throw Error("Bundle changed");
if (runtimePreflightHash !== "9a87b47b52d3776b10d760bdab6b9f5e71158f75ef71921ec8adbb3e0585de9f") throw Error("Runtime preflight changed");
const processObservation = cp.execFileSync("ps", ["-p", "176", "-o", "pid,lstart,args", "--width", "220"], { encoding: "utf8" });
if (!processObservation.includes("Sep 19 02:34:33 2026") ||
    !processObservation.includes("artifacts/api-server/dist/index.mjs")) throw Error("Runtime process mismatch");
const report = {
  observedUtc: new Date().toISOString(), base, candidate,
  protectedFileCount: protectedPaths.length, protectedChangeCount: 0,
  protectedPaths, bundleHash, runtimePreflightHash, processObservation, changed,
  status: "PASS",
};
fs.writeFileSync(path.join(output, "control-integridad.json"), JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify({ status: report.status, candidate, protectedFileCount: report.protectedFileCount, protectedChangeCount: 0, bundleHash, processObservation }, null, 2));