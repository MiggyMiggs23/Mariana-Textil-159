import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { pathToFileURL } from "node:url";

export const base = path.resolve("reports/noche-20260926");
export function load() {
  const file = process.env.NIGHT_BROWSER_MANIFEST;
  if (!file || !path.resolve(file).includes("/private.local/")) throw Error("NIGHT_BROWSER_MANIFEST must point inside private.local");
  const m = JSON.parse(fs.readFileSync(file, "utf8"));
  const u = new URL(m.origin);
  if (!["127.0.0.1", "localhost"].includes(u.hostname) || !u.port || ["80", "5000", "5173"].includes(u.port)) throw Error("Dedicated loopback origin required; active preview forbidden");
  if (!m.disposable || m.mainHandoff !== "READY_FOR_BROWSER" || !m.syntheticActorsOnly) throw Error("MAIN disposable/synthetic handoff required");
  if (!path.resolve(m.privateDir).includes("/private.local/")) throw Error("Private state directory required");
  if (!m.bundle?.apiEntry || !m.bundle?.apiSha256 || !m.bundle?.frontendRoot || !m.bundle?.frontendFiles) throw Error("Frozen bundle fingerprint required");
  const hash = file => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
  if (hash(m.bundle.apiEntry) !== m.bundle.apiSha256) throw Error("API frozen hash mismatch");
  for (const [file, digest] of Object.entries(m.bundle.frontendFiles)) {
    if (hash(path.join(m.bundle.frontendRoot, file)) !== digest) throw Error("Frontend frozen hash mismatch");
  }
  m.privateDir = path.resolve(m.privateDir);
  const credentials = JSON.parse(fs.readFileSync(m.credentialsFile || path.join(m.privateDir, "credentials.json")));
  if (m.credentialsFile && credentials.admin?.usuario === m.syntheticAdminUsername) {
    credentials.admin = { ...credentials.admin, username: credentials.admin.usuario, synthetic: true };
  }
  if (!credentials.admin?.synthetic || !credentials.admin.username || !credentials.admin.password) throw Error("Synthetic ADMIN credentials required (never use copied real users)");
  return { m, credentials };
}
export async function browserKit(m) {
  if (process.env.NIGHT_BROWSER_WINDOW !== "MAIN_EXCLUSIVE_GRANTED") throw Error("Permissions worker owns writer slot until MAIN explicitly grants NIGHT_BROWSER_WINDOW=MAIN_EXCLUSIVE_GRANTED");
  const mod = await import(pathToFileURL(path.resolve(m.playwrightModule)).href);
  return mod.chromium.launch({ headless: true, executablePath: m.chromiumExecutable || "/repl/tools/bin/chromium", args: ["--no-sandbox"] });
}
export async function session(browser, m, actor, mobile = false) {
  if (!actor?.synthetic) throw Error("Only explicitly synthetic test actors accepted");
  const c = await browser.newContext({ viewport: { width: mobile ? 402 : 1360, height: 1000 }, ...(mobile ? { isMobile: true, hasTouch: true, userAgent: "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/140.0.0.0 Mobile Safari/537.36" } : {}) });
  await c.route("**/*", route => {
    const u = new URL(route.request().url());
    if (u.origin !== m.origin || /\/e5\/cobros\/[^/]+\/devolver$/.test(u.pathname)) return route.abort();
    return route.continue();
  });
  const p = await c.newPage(); p.setDefaultTimeout(15000);
  await p.goto(m.origin + "/login");
  await p.getByLabel("Usuario", { exact: true }).fill(actor.username);
  await p.getByLabel("Contraseña", { exact: true }).fill(actor.password);
  const response = p.waitForResponse(r => new URL(r.url()).pathname === "/api/auth/login");
  await p.getByRole("button", { name: "Ingresar", exact: true }).click();
  if ((await response).status() !== 200) throw Error("Synthetic native login rejected");
  await p.waitForURL(u => !u.pathname.endsWith("/login"));
  await p.waitForLoadState("networkidle", { timeout: 5000 }).catch(() => { p.__networkIdleNotReached = true; });
  return p;
}
export async function api(p, url) {
  return p.evaluate(async url => {
    const r = await fetch(url, { credentials: "include" });
    return { status: r.status, body: await r.json() };
  }, url);
}
export function recorder(task, name) {
  const dir = path.join(base, `tarea-${task}`, name);
  fs.mkdirSync(dir, { recursive: true });
  const result = { status: "RUNNING", checks: [], screenshots: [], startedAt: new Date().toISOString() };
  const save = () => fs.writeFileSync(path.join(dir, "result.json"), JSON.stringify(result, null, 2));
  const snap = async (p, name) => {
    const file = path.join(dir, name.replace(/[^a-zA-Z0-9_-]/g, "_") + ".png");
    await p.screenshot({ path: file, fullPage: true });
    result.screenshots.push({ file: path.relative(base, file), sha256: crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex") }); save();
  };
  const check = async (id, fn, pages = []) => {
    const item = { id, status: "RUNNING" }; result.checks.push(item); save();
    try { item.evidence = await fn(); item.status = "PASS"; }
    catch (e) { item.status = "BLOCKED_OR_DEFECT"; item.error = e.message; }
    for (const [i, p] of pages.entries()) await snap(p, `${id}-${i}`).catch(e => { item.screenshotError = e.message; });
    save(); return item.status === "PASS";
  };
  const finish = () => { result.status = result.checks.every(x => x.status === "PASS") ? "PASS" : "PARTIAL_OR_BLOCKED"; save(); };
  return { result, save, snap, check, finish, dir };
}