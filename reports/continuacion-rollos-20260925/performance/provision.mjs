// MAIN exclusive phase only. Canonical authenticated ADMIN API produces all
// fixture identities; read-only SQL verifies them. No source actors are copied.
import fs from "node:fs";
import { randomBytes } from "node:crypto";
import pg from "../../../scripts/node_modules/pg/lib/index.js";

const root = process.cwd();
const priv = `${root}/private.local/roll-return-continuation`;
const report = `${root}/reports/continuacion-rollos-20260925/performance`;
const ready = JSON.parse(fs.readFileSync(`${root}/reports/continuacion-rollos-20260925/preparation/ready.json`, "utf8"));
if (process.env.MAIN_APPROVED_ANNUAL_PROVISION !== "yes" ||
    ready.postgresPort !== 55536 || ready.testDatabase !== "continue_test" ||
    ready.apiOrigin !== "http://127.0.0.1:43936" ||
    ready.origin !== "http://127.0.0.1:43937" || ready.applicationRowsCopied !== false) {
  throw Error("MAIN approval and precise disposable-copy identity required");
}
const targetUrl = "postgresql://postgres@127.0.0.1:55536/continue_test";
const effective = fs.readFileSync(`/proc/${ready.apiPid}/environ`, "utf8").split("\0");
if (!effective.includes(`DATABASE_URL=${targetUrl}`) ||
    !effective.includes("PORT=43936") ||
    effective.some(entry => entry.startsWith("TEST_DATABASE_URL="))) {
  throw Error("Private API process is not bound to the approved disposable database");
}
const canonical = JSON.parse(fs.readFileSync(`${priv}/credentials.json`, "utf8")).admin;
if (canonical?.username !== "admin" || !canonical.password) throw Error("Canonical disposable ADMIN credentials unavailable");
const file = `${priv}/annual-provision-state.json`;
const fixturePath = `${priv}/annual-fixture.json`;
const credentialPath = `${priv}/annual-credentials.json`;
if (fs.existsSync(file) || fs.existsSync(fixturePath) || fs.existsSync(credentialPath)) {
  throw Error("Annual provisioning already attempted. Inspect private state and readback; never replay automatically");
}
const dbUrl = targetUrl;
const c = new pg.Client({ connectionString: dbUrl, connectionTimeoutMillis: 5000 });
await c.connect();
const state = { completed: [], uncertain: null };
const persist = () => fs.writeFileSync(file, JSON.stringify(state, null, 2), { mode: 0o600 });
try {
  const identity = (await c.query(`SELECT current_database() db, current_user actor,
    inet_server_port() port, current_setting('data_directory') directory`)).rows[0];
  if (identity.db !== "continue_test" || identity.port !== 55536 || identity.actor !== "postgres" ||
      identity.directory !== `${priv}/cluster`) throw Error("Private cluster identity mismatch");
  const admins = (await c.query(`SELECT id,usuario,rol,activo FROM usuarios WHERE usuario=$1`, [canonical.username])).rows;
  if (admins.length !== 1 || admins[0].rol !== "ADMIN" || !admins[0].activo) throw Error("Canonical seeded ADMIN absent");
  // Earlier disposable browser/permissions campaigns may already have created
  // their own synthetic actors. Preparation guarantees zero copied app rows.
  const preexisting = (await c.query(`SELECT
    (SELECT count(*) FROM ubicaciones WHERE nombre LIKE 'ROLL RETURN PERF %')::int sites,
    (SELECT count(*) FROM productos WHERE sku LIKE 'ROLL-RETURN-PERF-%')::int products,
    (SELECT count(*) FROM clientes WHERE nombre LIKE 'ROLL RETURN PERF %')::int customers`)).rows[0];
  if (Object.values(preexisting).some(Number)) throw Error("Synthetic namespace already in use; no replay");
  const health = await fetch(`${ready.apiOrigin}/api/healthz`);
  if (health.status !== 200) throw Error(`Private API health HTTP ${health.status}`);
  const login = await fetch(`${ready.apiOrigin}/api/auth/login`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ usuario: canonical.username, password: canonical.password })
  });
  if (login.status !== 200) throw Error(`Private canonical ADMIN login HTTP ${login.status}`);
  const actor = await login.json();
  if (actor.id !== admins[0].id || actor.rol !== "ADMIN") throw Error("Login/DB canonical identity mismatch");
  const cookie = login.headers.get("set-cookie")?.split(";")[0];
  if (!cookie) throw Error("Canonical login omitted session cookie");
  state.identity = identity;
  state.canonicalAdminId = actor.id;
  const call = async (key, endpoint, body, verify) => {
    state.uncertain = { key, endpoint, at: new Date().toISOString() }; persist();
    const response = await fetch(`${ready.apiOrigin}/api${endpoint}`, {
      method: "POST", headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify(body)
    });
    // This is intentionally NOT retried; an HTTP failure could still have committed.
    const text = await response.text();
    if (response.status !== 201) throw Error(`${key}: HTTP ${response.status}: ${text.slice(0, 400)}`);
    const data = JSON.parse(text);
    await verify(data);
    state.completed.push({ key, id: data.id });
    state.uncertain = null; persist();
    return data;
  };
  const one = async (sql, args) => (await c.query(sql, args)).rows[0];
  const sites = [];
  for (let i = 0; i < 3; i++) {
    const nombre = `ROLL RETURN PERF TIENDA ${i + 1}`;
    const location = await call(`site-${i + 1}`, "/locations",
      { nombre, iniciales: ["RPA", "RPB", "RPC"][i], tipo: "TIENDA" },
      async data => {
        const row = await one("SELECT nombre,iniciales,tipo FROM ubicaciones WHERE id=$1", [data.id]);
        if (row?.nombre !== nombre || row.iniciales !== ["RPA", "RPB", "RPC"][i] || row.tipo !== "TIENDA") throw Error("Site readback mismatch");
      });
    sites.push({ id: location.id, nombre });
  }
  const products = [];
  for (let i = 0; i < 4; i++) {
    // METREADO source rows do not invent physical roll provenance.
    const sku = `ROLL-RETURN-PERF-${i + 1}`, tela = `ROLL RETURN PERF METRO ${i + 1}`;
    const product = await call(`product-${i + 1}`, "/productos",
      { sku, tela, color: `PERF ${i + 1}`, unidad: "METRO", precioSugerido: "100.00" },
      async data => {
        const row = await one("SELECT sku,tela,unidad FROM productos WHERE id=$1", [data.id]);
        if (data.sku !== sku || row?.sku !== sku || row.tela !== tela || row.unidad !== "METRO") throw Error("Product readback mismatch");
      });
    products.push({ id: product.id, sku });
  }
  const customerName = "ROLL RETURN PERF ANNUAL CUSTOMER";
  const customer = await call("customer", "/clientes",
    { nombre: customerName, diasCredito: 30, limiteCredito: "999999999.00" },
    async data => {
      const row = await one("SELECT nombre,dias_credito FROM clientes WHERE id=$1", [data.id]);
      if (row?.nombre !== customerName || row.dias_credito !== 30) throw Error("Customer readback mismatch");
    });
  const actors = { admin: { id: actor.id, username: canonical.username } };
  const credentials = { admin: canonical };
  for (const role of ["terminal", "caja"]) {
    const username = `roll-return-perf-${role}`;
    const password = randomBytes(24).toString("base64url");
    // Journal the intended credential privately before the irreversible API call.
    // If the response is lost, MAIN can reconcile the user without guessing it.
    state[role + "Credential"] = { username, password }; persist();
    const user = await call(`actor-${role}`, "/users",
      { nombre: `ROLL RETURN PERF ${role.toUpperCase()}`, usuario: username,
        password, rol: role.toUpperCase(), ubicacionId: sites[0].id,
        alcanceConsulta: role === "caja" ? "TODAS" : "PROPIA" },
      async data => {
        const row = await one("SELECT usuario,rol,ubicacion_id,activo FROM usuarios WHERE id=$1", [data.id]);
        if (data.usuario !== username || row?.usuario !== username ||
            row.rol !== role.toUpperCase() || row.ubicacion_id !== sites[0].id || !row.activo) {
          throw Error("Synthetic actor readback mismatch");
        }
      });
    actors[role] = { id: user.id, username };
    credentials[role] = { username, password };
  }
  const sessions = [];
  for (const [i, site] of sites.entries()) {
    const session = await call(`session-${i + 1}`, "/sesiones-caja/abrir",
      { ubicacionId: site.id, fondoInicial: 5000 },
      async data => {
        const row = await one("SELECT ubicacion_id,usuario_id,estado FROM sesiones_caja WHERE id=$1", [data.id]);
        if (row?.ubicacion_id !== site.id || row.usuario_id !== actor.id || row.estado !== "ABIERTA") {
          throw Error("Open session readback mismatch");
        }
      });
    sessions.push({ id: session.id, ubicacion_id: site.id });
  }
  // Credentials remain private and are never echoed or written into reports.
  fs.writeFileSync(credentialPath, JSON.stringify(credentials), { mode: 0o600, flag: "wx" });
  fs.writeFileSync(fixturePath, JSON.stringify({
    sites, products, customer: { id: customer.id, nombre: customerName }, actors, sessions
  }, null, 2), { mode: 0o600, flag: "wx" });
  fs.writeFileSync(`${report}/provision-result.json`, JSON.stringify({
    identity, canonicalAdmin: actor.id, sites, products, customer: { id: customer.id, nombre: customerName },
    actors, sessions, producer: "authenticated canonical ADMIN API with SQL readback",
    applicationRowsCopied: false
  }, null, 2));
  state.finished = true; persist();
  console.log("Synthetic fixture provisioned through canonical ADMIN API; private credentials retained.");
} finally { await c.end(); }