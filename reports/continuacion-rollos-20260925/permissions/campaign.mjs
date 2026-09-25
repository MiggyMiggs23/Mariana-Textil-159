// MAIN-only disposable, after E5/E11 journey. No server/cluster startup or real accounts.
// Invocation ONLY after explicit MAIN exclusive handoff following E5/E11:
// node reports/continuacion-rollos-20260925/permissions/campaign.mjs --execute --main-handoff
import assert from 'node:assert/strict';
import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync, symlinkSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomBytes } from 'node:crypto';
import pg from '../../../scripts/node_modules/pg/lib/index.js';

const root = process.cwd();
const out = resolve(root, 'reports/continuacion-rollos-20260925/permissions');
const readyPath = resolve(root, 'reports/continuacion-rollos-20260925/preparation/ready.json');
const manifest = JSON.parse(readFileSync(resolve(out, 'manifest.json'), 'utf8'));
const ledger = JSON.parse(readFileSync(resolve(root, manifest.baseline), 'utf8'));
assert(Array.isArray(manifest.cases) && manifest.cases.length > 0, 'Empty file manifest: STOP');
const ids = new Set();
for (const c of manifest.cases) {
  assert(!ids.has(c.cellId), 'Duplicate cell: ' + c.cellId);
  ids.add(c.cellId);
  assert.equal(c.cellId, `${c.role}:${c.module}:${c.action}`);
  assert.equal(c.outer, 'permisos:ver');
  assert(['TERMINAL', 'CAJA', 'SUPERVISOR', 'BODEGA'].includes(c.role));
  assert.equal(ledger.rows.find(r => r.id === c.cellId)?.pending, 'OUTER_BOUNDARY_DENIAL_ONLY', 'Not a mapped pending ledger cell');
}
if (process.argv[2] !== '--execute') {
  console.log(`READY only: ${manifest.cases.length} mapped cases; awaiting exclusive MAIN handoff; no connections or writes.`);
  process.exit(0);
}
assert.equal(process.argv[3], '--main-handoff', 'Explicit MAIN handoff after E5/E11 required; STOP');
assert.equal(process.argv.length, 4, 'Usage: --execute --main-handoff');
assert(existsSync(readyPath), 'Missing MAIN handoff: STOP');
assert(!existsSync(resolve(out, 'result.json')) && !existsSync(resolve(out, 'progress.json')), 'Campaign started already: STOP; do not replay');
const ready = JSON.parse(readFileSync(readyPath, 'utf8'));
assert.equal(ready.owner, 'MAIN');
assert.equal(ready.state, 'READY_FOR_VERIFICATION_NOT_TESTED');
assert.equal(ready.testDatabase, 'continue_test');
assert.equal(ready.postgresPort, 55536);
assert.equal(ready.apiOrigin, 'http://127.0.0.1:43936');
assert.equal(ready.origin, 'http://127.0.0.1:43937');
assert.equal(ready.applicationRowsCopied, false);
assert.deepEqual(ready.flagsForced, []);
assert.equal(ready.schemaProvenance, 'reports/continuacion-rollos-20260925/preparation/schema-provenance.json');
const provenance = JSON.parse(readFileSync(resolve(root, ready.schemaProvenance), 'utf8'));
assert.equal(provenance.restoredInto.database, ready.testDatabase);
assert.equal(provenance.restoredInto.port, ready.postgresPort);
assert(provenance.canonicalSeed === true);
assert(typeof provenance.restoredInto.directory === 'string' &&
  provenance.restoredInto.directory.startsWith(resolve(root, 'private.local/roll-return-continuation/') + '/'),
  'Cluster must be inside private.local/roll-return-continuation/');
assert.equal(ready.credentials, 'private.local/roll-return-continuation/credentials.json');
assert(Number.isSafeInteger(ready.apiPid) && ready.apiPid > 0);
assert(Number.isSafeInteger(ready.uiPid) && ready.uiPid > 0);
const databaseUrl = 'postgresql://postgres@127.0.0.1:55536/continue_test';
const api = ready.apiOrigin;
const web = ready.origin;
const env = pid => readFileSync(`/proc/${pid}/environ`, 'utf8').split('\0');
assert(env(ready.apiPid).includes('DATABASE_URL=' + databaseUrl));
assert(env(ready.apiPid).includes('APPLICATION_DATABASE_URL=postgresql://postgres@127.0.0.1:55536/continue_witness'));
assert(!env(ready.apiPid).some(x => x.startsWith('TEST_DATABASE_URL=') || x.startsWith('REQUIRE_ISOLATED_TEST_DATABASE=')));
assert(env(ready.apiPid).includes('NODE_ENV=development'));
assert(env(ready.apiPid).includes('API_INSPECTION_BOOT=1'));
assert(env(ready.apiPid).includes('PORT=43936'));
assert(env(ready.uiPid).includes('API_PORT=43936'));
assert(env(ready.uiPid).includes('PROXY_PORT=43937'));
const creds = JSON.parse(readFileSync(resolve(root, ready.credentials), 'utf8'));
const admin = creds.admin ?? creds.ADMIN;
assert(admin?.username && admin?.password, 'Missing private ADMIN credential');
const db = new pg.Client({ connectionString: databaseUrl, connectionTimeoutMillis: 4000 });
const cookies = {};
const report = { readyPath, cases: [], ui: [], setup: [], controls: [], counts: {}, state: 'preflight' };
const checkpoint = () => writeFileSync(resolve(out, 'progress.json'), JSON.stringify(report, null, 2) + '\n');
async function request(role, method, path, body) {
  const response = await fetch(api + '/api' + path, {
    method, headers: { 'content-type': 'application/json', ...(cookies[role] ? { cookie: cookies[role] } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(10000),
  });
  const raw = await response.text();
  let data;
  try { data = JSON.parse(raw); } catch { data = { nonJson: raw.slice(0, 300) }; }
  return { status: response.status, data, cookie: response.headers.get('set-cookie')?.split(';')[0] };
}
async function fingerprint(table) {
  assert(['permisos_usuario', 'permisos_rol', 'usuarios'].includes(table));
  return (await db.query(`select count(*)::int count, md5(coalesce(string_agg(h,'' order by h),'')) digest from (select md5(row_to_json(t)::text) h from "${table}" t) s`)).rows[0];
}
async function login(role, credential) {
  const r = await request(role, 'POST', '/auth/login', { usuario: credential.username, password: credential.password });
  assert.equal(r.status, 200, role + ' login: ' + JSON.stringify(r.data));
  assert(r.cookie, role + ' login cookie missing');
  cookies[role] = r.cookie;
  const me = await request(role, 'GET', '/auth/me');
  assert.equal(me.status, 200);
  const user = me.data.user ?? me.data;
  assert.equal(user.rol, role);
  return user;
}
try {
  await db.connect();
  const identity = (await db.query("select current_database() database, inet_server_port() port, current_setting('data_directory') directory")).rows[0];
  assert.equal(identity.database, ready.testDatabase);
  assert.equal(identity.port, 55536);
  assert.equal(identity.directory, provenance.restoredInto.directory, 'Not MAIN-owned disposable cluster');
  assert.equal((await fetch(api + '/api/healthz', { signal: AbortSignal.timeout(4000) })).status, 200);
  assert((await db.query("select to_regclass('public.e11_perfiles') p")).rows[0].p, 'E11 baseline missing');
  const synthetic = (await db.query("select usuario from usuarios where usuario like 'contperm_%'")).rows;
  assert.equal(synthetic.length, 0, 'Synthetic prefix already occupied');
  const location = (await db.query("select id from ubicaciones where tipo in ('TIENDA','BODEGA') and activa=true order by id limit 1")).rows[0];
  assert(location?.id, 'No valid site for natural roles');
  const baselineRoles = await fingerprint('permisos_rol');
  const adminUser = await login('ADMIN', admin);
  report.identity = { ...identity, adminId: adminUser.id };
  report.state = 'creating-synthetic-only';
  checkpoint();
  const actors = {};
  // One subject per natural role, plus a separate synthetic permission target.
  for (const role of [...new Set(manifest.cases.map(c => c.role)), 'SISTEMAS']) {
    const username = 'contperm_' + role.toLowerCase();
    const password = randomBytes(24).toString('hex');
    const created = await request('ADMIN', 'POST', '/users', {
      nombre: `Permisos copia ${role}`, usuario: username, password, rol: role,
      ubicacionId: role === 'SISTEMAS' ? null : location.id,
    });
    assert.equal(created.status, 201, `${role} fixture: ${JSON.stringify(created.data)}`);
    const user = await login(role, { username, password });
    actors[role] = { id: user.id, username, password };
    report.setup.push({ role, id: user.id, http: created.status, login: 200, me: 200 });
    checkpoint();
  }
  // Exactly one prerequisite (ver) is granted per actor. Selected editar is
  // explicitly false; all other fields inherit, no role/site matrix modified.
  const override = { puedeVer: true, puedeCrear: null, puedeEditar: false, puedeAutorizar: null };
  for (const c of manifest.cases) {
    const actor = actors[c.role];
    const grant = await request('ADMIN', 'PUT', `/permisos/usuarios/${actor.id}/permisos`, override);
    assert.equal(grant.status, 200, `Synthetic prerequisite failed: ${c.cellId}: ${JSON.stringify(grant.data)}`);
    // The per-user UI selector lists users through /users (usuarios.ver).
    // Grant only this read prerequisite to the synthetic actor, never editar.
    const usersRead = await request('ADMIN', 'PUT', `/permisos/usuarios/${actor.id}/usuarios`,
      { puedeVer: true, puedeCrear: null, puedeEditar: null, puedeAutorizar: null });
    assert.equal(usersRead.status, 200, `Synthetic UI read prerequisite: ${c.cellId}`);
    const me = await request(c.role, 'GET', '/auth/me');
    const permissions = (me.data.user ?? me.data).permisos;
    const p = Array.isArray(permissions) ? permissions.find(x => x.modulo === 'permisos') : permissions?.permisos;
    assert.equal(p?.puedeVer, true, c.cellId + ' prerequisite');
    assert.equal(p?.puedeEditar, false, c.cellId + ' selected deny');
    const visible = await request(c.role, 'GET', '/permisos/roles');
    assert.equal(visible.status, 200, c.cellId + ' outer guard was not satisfied');
    report.setup.push({ cellId: c.cellId, override: grant.status, usersRead: usersRead.status,
      prerequisiteGet: visible.status, permission: p });
    checkpoint();
  }
  assert.deepEqual(await fingerprint('permisos_rol'), baselineRoles, 'Role matrix changed in setup');
  report.state = 'targeted-denials';
  checkpoint();
  const targetId = actors.SISTEMAS.id;
  // A valid, distinct synthetic target. A positive ADMIN control uses this
  // exact operation and body only AFTER all denials; never write role matrix.
  const target = `/permisos/usuarios/${targetId}/dashboard`;
  const payload = { puedeVer: true, puedeCrear: null, puedeEditar: null, puedeAutorizar: null };
  for (const c of manifest.cases) {
    const before = await fingerprint('permisos_usuario');
    const denied = await request(c.role, 'PUT', target, payload);
    const after = await fingerprint('permisos_usuario');
    const exact = denied.status === 403 && denied.data.error === `No tienes permiso para '${c.action}' en el módulo '${c.module}'.`;
    report.cases.push({ cellId: c.cellId, method: 'PUT', path: target, status: denied.status,
      response: denied.data, exact, before, after, classification: exact ? 'SELECTED_GUARD' : 'BLOCKED_NOT_COVERED' });
    checkpoint();
    assert.deepEqual(after, before, c.cellId + ' denied permission-table write');
    assert.equal(denied.status, 403, c.cellId + ' unexpected response; STOP');
    assert(exact, c.cellId + ' outer guard/other 403; not coverage; STOP');
  }
  const beforePositive = await fingerprint('permisos_usuario');
  const positive = await request('ADMIN', 'PUT', target, payload);
  const afterPositive = await fingerprint('permisos_usuario');
  const positiveRow = (await db.query('select puede_ver from permisos_usuario where usuario_id=$1 and modulo=$2', [targetId, 'dashboard'])).rows[0];
  report.controls.push({ role: 'ADMIN', method: 'PUT', path: target, status: positive.status,
    before: beforePositive, after: afterPositive, targetRow: positiveRow });
  checkpoint();
  assert.equal(positive.status, 200, 'Same valid operation positive control failed');
  assert.notDeepEqual(afterPositive, beforePositive, 'Positive control did not write synthetic target');
  assert.equal(positiveRow?.puede_ver, true);
  assert.deepEqual(await fingerprint('permisos_rol'), baselineRoles, 'Role matrix changed');
  report.state = 'api-complete-ui-observation';
  checkpoint();
  // Single browser process, distinct contexts. UI evidence is not inferred
  // from a page screenshot: inspect the actual Editar checkbox for permisos.
  // Never click it: the UI edits a ROLE matrix, not a synthetic override.
  const playwrightPath = resolve(root, '.cache/pnpm/dlx/0be451ecc86649edb1205a8454559cdd433606b22e8744a742f8d93fdb9e4b57/1a0642de1a4-8c2/node_modules/.pnpm/playwright@1.55.0/node_modules/playwright/index.mjs');
  const chrome = resolve(root, '.cache/ms-playwright/chromium-1187/chrome-linux/chrome');
  if (existsSync(playwrightPath) && existsSync(chrome)) {
    const { chromium } = await import(playwrightPath);
    const libSource = '/nix/store/ifx1nl219iyd84hjr11rbkmjazsjr0q0-electronplayer-2.0.8-usr-target/lib';
    const browserLibs = resolve(out, '.browser-libs');
    if (existsSync(libSource)) {
      mkdirSync(browserLibs, { recursive: true });
      for (const name of readdirSync(libSource)) {
        if (!name.includes('.so') || /^(libc\.|libm\.|libpthread\.|librt\.|libdl\.|ld-|libresolv\.|libutil\.)/.test(name)) continue;
        if (!existsSync(resolve(browserLibs, name))) symlinkSync(resolve(libSource, name), resolve(browserLibs, name));
      }
    }
    const browser = await chromium.launch({ headless: true, executablePath: chrome,
      env: { ...process.env, ...(existsSync(libSource) ? { LD_LIBRARY_PATH: browserLibs } : {}) },
      args: ['--no-sandbox'], timeout: 15000 });
    try {
      for (const c of manifest.cases) {
        const context = await browser.newContext({ viewport: { width: 1360, height: 1000 } });
        try {
          const page = await context.newPage();
          await page.goto(web + '/login', { timeout: 12000 });
          await page.getByLabel('Usuario', { exact: true }).fill(actors[c.role].username);
          await page.getByLabel('Contraseña', { exact: true }).fill(actors[c.role].password);
          await page.getByRole('button', { name: 'Ingresar', exact: true }).click();
          await page.waitForURL(url => !url.pathname.includes('/login'), { timeout: 12000 });
          await page.goto(web + '/permisos', { timeout: 12000 });
          await page.getByRole('tab', { name: 'Por Usuario' }).click();
          await page.getByText('Seleccionar Usuario').click();
          await page.getByRole('option', { name: new RegExp(`contperm_sistemas.*SISTEMAS`) }).click();
          const row = page.getByRole('row').filter({ has: page.getByRole('cell', { name: 'dashboard', exact: true }) });
          await row.waitFor({ timeout: 8000 });
          await page.getByRole('heading', { name: 'Excepciones por Usuario' }).waitFor();
          const control = row.getByRole('combobox', { name: 'dashboard puedeVer' });
          const visible = await control.isVisible();
          const enabled = visible && await control.isEnabled();
          const shot = `ui-${c.role.toLowerCase()}-permisos.jpg`;
          await page.screenshot({ path: resolve(out, shot), fullPage: true });
          report.ui.push({ cellId: c.cellId, actualPath: new URL(page.url()).pathname,
            control: `Por Usuario / contperm_sistemas (${targetId}) / dashboard puedeVer`,
            visible, enabled, screenshot: shot,
            classification: !visible ? 'CONTROL_NOT_VISIBLE' : enabled ? 'EDIT_CONTROL_PRESENT_NOT_CLOSED' : 'EDIT_CONTROL_DISABLED' });
          checkpoint();
        } catch (error) {
          report.ui.push({ cellId: c.cellId, classification: 'UI_ERROR_NOT_COVERED', error: String(error) });
          checkpoint();
        } finally { await context.close(); }
      }
    } finally { await browser.close(); }
  } else {
    report.ui.push({ classification: 'BROWSER_UNAVAILABLE_NOT_COVERED', missing: [playwrightPath, chrome].filter(p => !existsSync(p)) });
  }
  report.counts = { baselinePendingApi: 381, baselinePendingCombined: 421,
    newExactApi: report.cases.filter(x => x.exact).length,
    newCombined: report.ui.filter(x => x.classification === 'EDIT_CONTROL_DISABLED').length,
    ownerUnmappedUntouched: 357 };
  report.counts.remainingApi = 381 - report.counts.newExactApi;
  report.counts.remainingCombined = 421 - report.counts.newCombined;
  report.state = 'complete';
  writeFileSync(resolve(out, 'result.json'), JSON.stringify(report, null, 2) + '\n');
} finally {
  if (report.state !== 'complete' && report.state !== 'preflight') checkpoint();
  await db.end();
}