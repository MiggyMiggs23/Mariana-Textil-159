import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { load, base } from "./runtime.mjs";
const { m, credentials } = load();
const hash = bytes => crypto.createHash("sha256").update(bytes).digest("hex");
const response = await fetch(m.origin + "/index.html");
const served = hash(Buffer.from(await response.arrayBuffer()));
if (response.status !== 200 || served !== m.bundle.frontendFiles["index.html"]) throw Error("Served frontend changed; do not label run frozen");
const scopes = ["browser", "tarea-3", "tarea-4", "tarea-5", "tarea-6/broad", "tarea-6/native-drilldown-units-color"];
const walk = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(x => x.isDirectory() ? walk(path.join(dir, x.name)) : [path.join(dir, x.name)]);
const files = scopes.flatMap(s => fs.existsSync(path.join(base, s)) ? walk(path.join(base, s)) : []);
const roles = JSON.parse(fs.readFileSync(path.join(m.privateDir, "browser-continuation-state.json"))).roles;
const secrets = [credentials.admin.password, ...(credentials.auditUsers || []).map(x => x.password), ...Object.values(roles).map(x => x.password)].filter(Boolean);
for (const file of files.filter(x => /\.(json|txt|md|mjs)$/.test(x))) {
  const text = fs.readFileSync(file, "utf8");
  if (secrets.some(s => text.includes(s))) throw Error("Secret scan failed for " + path.relative(base, file));
}
const shots = files.filter(x => /\.png$/.test(x)).map(file => {
  const bytes = fs.readFileSync(file);
  if (bytes.subarray(1, 4).toString() !== "PNG") throw Error("Invalid image " + file);
  return { file: path.relative(base, file), bytes: bytes.length, sha256: hash(bytes) };
});
fs.writeFileSync(path.join(base, "browser/screenshot-manifest.json"), JSON.stringify(shots, null, 2));
const release = {
  released: true, at: new Date().toISOString(), writer: "browser-task3-6",
  origin: m.origin, apiSha256: m.bundle.apiSha256, servedFrontendIndexSha256: served,
  noApplicationCodeChanges: true, noCommits: true, browsersClosed: true,
  noDatabaseResetOrBackdating: true, secretsScan: "PASS", screenshotFiles: shots.length,
  paymentInput: "/tmp/noche-20260926/payment-input.json",
  paymentBeforeIds: [2, 3, 4], paymentAfterIds: [5, 6, 7], paymentUnpaidReadback: "tarea-5/independent-final-readbacks/result.json",
  privateProvenance: "private.local/night-disposable/browser",
  cashSession: { id: 1, estado: "CERRADA", esperado: "2548.00", contado: "2548.00", diferencia: "0.00" },
  audit: { id: 2, estado: "ABIERTA", scanned: 5, appliedToInventory: false },
  preservedForMain: "Disposable copy remains for performance/fix verification; MAIN owns teardown.",
  findings: ["Audit duplicate concurrency full-page REVISION_OBSOLETA", "A identity503 and forbidden endpoints500", "Precios500", "Client payment/history500"],
  blocked: ["Commercial roll returns not executed; gates unchanged", "Closed-period day/week/month and NO_CUADRA require safely prepared clock clone"]
};
fs.writeFileSync(path.join(base, "browser/window-released.json"), JSON.stringify(release, null, 2));
console.log(JSON.stringify({ released: true, screenshots: shots.length, servedIndexMatchesFrozen: true, secretsScan: "PASS" }));