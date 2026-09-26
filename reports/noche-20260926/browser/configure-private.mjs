// Local file preparation only. Does not import pg, fetch, login or launch a browser.
import fs from "node:fs";
import path from "node:path";
const root = path.resolve("reports/noche-20260926");
const ready = JSON.parse(fs.readFileSync(root + "/tarea-2/private-ready.json"));
const candidate = JSON.parse(fs.readFileSync(root + "/tarea-2/candidate.json"));
const copy = JSON.parse(fs.readFileSync(root + "/tarea-2/copy-ready.json"));
if (ready.status !== "READY" || ready.database !== "noche_20260926" || ready.apiSha256 !== candidate.apiSha256 || copy.admin.usuario !== "e2e.noche.admin") throw Error("Disposable handoff provenance mismatch");
const dir = path.resolve("private.local/night-disposable/browser");
fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
const file = path.join(dir, "manifest.json");
if (fs.existsSync(file)) throw Error("Manifest already exists; refusing overwrite of runtime targets");
const m = JSON.parse(fs.readFileSync(root + "/browser/manifest.example.json"));
Object.assign(m, {
  mainHandoff: "READY_FOR_BROWSER",
  origin: ready.url,
  privateDir: dir,
  credentialsFile: "/tmp/noche-20260926/credentials.json",
  syntheticAdminUsername: copy.admin.usuario,
  privateEnvironmentFile: "/tmp/noche-20260926/test-env.json",
  bundle: candidate,
  provenance: { database: ready.database, apiPid: ready.pid, apiSha256: ready.apiSha256, checkedAt: ready.checkedAt },
  fixturePrefix: "NOCHE26",
  site: { id: null, name: "Mariana" }
});
fs.writeFileSync(file, JSON.stringify(m, null, 2), { mode: 0o600 });
fs.writeFileSync(path.join(dir, "frozen-before-browser.json"), JSON.stringify({ ready, candidate, database: copy.identity.database }, null, 2), { mode: 0o600 });
console.log("Private manifest prepared; credential/environment references only. No browser/database operations. MAIN exclusive writer window remains required.");