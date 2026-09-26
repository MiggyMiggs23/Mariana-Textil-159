import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import pg from '../../../scripts/node_modules/pg/lib/index.js';
assert.equal(process.env.MAIN_TASK2_WINDOW_ENDED, 'yes');
const out = 'reports/postrelease-review-20260926/tarea-3';
const priv = '/tmp/postrelease-review-20260926/postreview_permissions_20260926';
const load = p => JSON.parse(fs.readFileSync(p));
const url = load(`${priv}/test-env.json`).TEST_DATABASE_URL;
const pid = load(`${priv}/pids.json`).api;
assert(fs.readFileSync(`/proc/${pid}/environ`, 'utf8').split('\0').includes(`DATABASE_URL=${url}`));
const db = new pg.Client({ connectionString: url, options: '-c default_transaction_read_only=on' });
await db.connect();
assert.equal((await db.query('select current_database() d')).rows[0].d, 'postreview_permissions_20260926');
const journalPath = `${out}/variant-journal.json`;
const journal = fs.existsSync(journalPath) ? load(journalPath) : [];
const save = () => fs.writeFileSync(journalPath, JSON.stringify(journal, null, 2));
const credentialsPath = `${priv}/permission-variant-credentials.json`;
const credentials = fs.existsSync(credentialsPath) ? load(credentialsPath) : {};
const originalCredentials = load(`${priv}/permissions-credentials.json`);
const cookies = {};
async function call(role, method, path, body) {
  const r = await fetch(`http://127.0.0.1:18337/api${path}`, {
    method, headers: { 'content-type': 'application/json', ...(cookies[role] ? { cookie: cookies[role] } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(30000),
  });
  return { status: r.status, data: await r.json(), cookie: r.headers.get('set-cookie')?.split(';')[0] };
}
async function login(role, c) {
  const r = await call(role, 'POST', '/auth/login', { usuario: c.usuario, password: c.password });
  assert.equal(r.status, 200); cookies[role] = r.cookie;
  const me = await call(role, 'GET', '/auth/me'); assert.equal(me.status, 200);
  return me.data.user ?? me.data;
}
async function native(key, method, path, body) {
  const previous = journal.find(r => r.key === key);
  if (previous) { assert(previous.status >= 200 && previous.status < 300, `${key} uncertain; no replay`); return previous.response; }
  const record = { key, method, path, state: 'UNCERTAIN_UNTIL_RESPONSE' };
  journal.push(record); save();
  const r = await call('ADMIN', method, path, body);
  Object.assign(record, { status: r.status, response: r.data, state: 'RESPONSE_RECEIVED' }); save();
  assert(r.status >= 200 && r.status < 300, `${key} ${r.status}`); return r.data;
}
try {
  await login('ADMIN', originalCredentials.ADMIN);
  const site = load(`${out}/fixture-identity.json`).site.id;
  for (const role of ['TARGET','TERMINAL','CAJA','SUPERVISOR','BODEGA']) {
    if (!credentials[role]) {
      credentials[role] = { usuario: `pr26.variant.${role.toLowerCase()}`, password: crypto.randomBytes(24).toString('hex') };
      fs.writeFileSync(credentialsPath, JSON.stringify(credentials), { mode: 0o600 });
    }
    const u = await native(`actor-${role}`, 'POST', '/users', {
      ...credentials[role], nombre: `PR26 prerequisite ${role}`,
      rol: role === 'TARGET' ? 'TERMINAL' : role, ubicacionId: site,
    });
    credentials[role].id = u.id;
    fs.writeFileSync(credentialsPath, JSON.stringify(credentials), { mode: 0o600 });
    if (role !== 'TARGET') await native(`prerequisite-${role}`, 'PUT', `/permisos/usuarios/${u.id}/permisos`, {
      puedeVer: true, puedeCrear: false, puedeEditar: false, puedeAutorizar: false,
    });
  }
  const tables = (await db.query("select tablename from pg_tables where schemaname='public' and tablename<>'sesiones' order by tablename")).rows.map(r => r.tablename);
  const snapshot = async () => {
    const rows = (await db.query(tables.map(t => {
      const q = `"${t.replaceAll('"','""')}"`;
      return `select '${t.replaceAll("'","''")}' tab,count(*)::int n,md5(coalesce(string_agg(h,'' order by h),'')) digest from (select md5(row_to_json(t)::text) h from ${q} t)s`;
    }).join(' UNION ALL '))).rows;
    return Object.fromEntries(rows.map(r => [r.tab, { n: r.n, digest: r.digest }]));
  };
  const path = `/permisos/usuarios/${credentials.TARGET.id}/dashboard`;
  const body = { puedeVer: true, puedeCrear: false, puedeEditar: false, puedeAutorizar: false };
  const results = [];
  for (const role of ['TERMINAL','CAJA','SUPERVISOR','BODEGA']) {
    const me = await login(role, credentials[role]);
    const p = me.permisos.find(p => p.modulo === 'permisos');
    assert.equal(me.rol, role); assert.equal(p.puedeVer, true); assert.equal(p.puedeEditar, false);
    const before = await snapshot(), r = await call(role, 'PUT', path, body), after = await snapshot();
    const changedTables = tables.filter(t => JSON.stringify(before[t]) !== JSON.stringify(after[t]));
    const selectedGuard = r.status === 403 && r.data.error === "No tienes permiso para 'editar' en el módulo 'permisos'.";
    assert(selectedGuard); assert(changedTables.every(t => /auditor/.test(t)));
    results.push({ cellId: `${role}:permisos:editar`, stateVariant: 'DEDICATED_ACTOR_VER_TRUE_EDITAR_FALSE', auth: me,
      method: 'PUT', path, body, status: r.status, response: r.data, selectedGuard, changedTables, before, after });
    fs.writeFileSync(`${out}/variant-results.json`, JSON.stringify(results, null, 2));
  }
  const positive = await native('positive-same-target', 'PUT', path, body);
  fs.writeFileSync(`${out}/variant-positive.json`, JSON.stringify({ role: 'ADMIN', method: 'PUT', path, body, response: positive, status: journal.find(r => r.key === 'positive-same-target').status }, null, 2));
  console.log(JSON.stringify({ newSelectedGuards: results.length, positive: 'success', changedOriginalActors: false }));
} finally { await db.end(); }