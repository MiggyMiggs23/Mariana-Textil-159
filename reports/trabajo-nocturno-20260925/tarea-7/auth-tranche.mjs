// Explicit MAIN handoff: exclusive, frozen night56_test after tasks 5/6.
// Never starts an API, cluster, proxy or workflow. No application DB discovery.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomBytes } from 'node:crypto';
import pg from '../../../scripts/node_modules/pg/lib/index.js';

const root = process.cwd();
const report = resolve(root, 'reports/trabajo-nocturno-20260925/tarea-7');
const privateDir = resolve(root, 'private.local/night-t56');
const handoffFile = resolve(root, 'reports/trabajo-nocturno-20260925/tarea-5/ownership.json');
if (process.argv[2] !== '--execute') {
  console.log('PREPARADO para handoff exclusivo MAIN night56_test: node reports/trabajo-nocturno-20260925/tarea-7/auth-tranche.mjs --execute');
  process.exit(0);
}
assert(existsSync(handoffFile), 'Sin ownership explícito tarea 5/6: STOP.');
assert(!existsSync(resolve(report, 'auth-tranche-results.json')), 'Campaña ya ejecutada; STOP (sin reintentos).');
const ownership = JSON.parse(readFileSync(handoffFile, 'utf8'));
const ready = JSON.parse(readFileSync(resolve(root, 'reports/trabajo-nocturno-20260925/tarea-5/ready.json'), 'utf8'));
assert.equal(ownership.owner, 'night-task56-browser');
assert.equal(ownership.identity.database, 'night56_test');
assert.equal(ownership.identity.db_user, 'postgres');
assert.equal(ownership.identity.port, 55526);
assert.equal(ownership.identity.address, '127.0.0.1');
assert.equal(ownership.identity.directory, resolve(privateDir, 'cluster'));
assert.equal(ownership.source, resolve(privateDir, 'source'));
assert.deepEqual(ownership.ports, { postgres: 55526, api: 43926, ui: 43927 });
assert.equal(ownership.applicationDbAccess, false);
assert.deepEqual(ownership.forcedReleaseFlags, []);
assert.equal(ready.apiPid > 0, true);
assert.equal(ready.healthz, 200);
assert.deepEqual(ready.forcedFlags, []);
assert.equal(ready.credentials, 'private.local/night-t56/credentials.json');
const apiEnv = readFileSync(`/proc/${ready.apiPid}/environ`, 'utf8').split('\0');
assert(apiEnv.includes('TEST_DATABASE_URL=postgresql://postgres@127.0.0.1:55526/night56_test'), 'API no apunta a night56_test');
assert(apiEnv.includes('PORT=43926'), 'API PID/puerto incorrecto');
assert(apiEnv.includes('REQUIRE_ISOLATED_TEST_DATABASE=1'));
const databaseUrl = 'postgresql://postgres@127.0.0.1:55526/night56_test';
const apiOrigin = 'http://127.0.0.1:43926';
const db = new pg.Client({ connectionString: databaseUrl, connectionTimeoutMillis: 4000 });
await db.connect();
const output = { source: 'MAIN-exclusively-handed-off night56_test; synthetic canonical seed only', responses: [], roles: [], positiveControls: [], counts: {} };
const roles = ['TERMINAL', 'CAJA', 'SUPERVISOR', 'BODEGA', 'SISTEMAS', 'CONTADOR'];
const cookies = {};
let stage = 'preflight';
const call = async (role, method, path, body) => {
  const response = await fetch(apiOrigin + '/api' + path, {
    method, headers: { 'content-type': 'application/json', ...(cookies[role] ? { cookie: cookies[role] } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(8000),
  });
  const text = await response.text();
  let data; try { data = JSON.parse(text); } catch { data = { error: 'Non-JSON response' }; }
  return { status: response.status, data, cookie: response.headers.get('set-cookie')?.split(';')[0] };
};
const checkpoint = () => writeFileSync(resolve(report, 'auth-tranche-progress.json'), JSON.stringify({ stage, ...output }, null, 2));
try {
  const identity = (await db.query("select current_database() database,inet_server_port() port,current_setting('data_directory') directory")).rows[0];
  assert.equal(identity.database, ownership.identity.database);
  assert.equal(identity.port, ownership.identity.port);
  assert.equal(identity.directory, ownership.identity.directory);
  const e11 = (await db.query("select to_regclass('public.e11_perfiles') perfiles,to_regclass('public.e11_operaciones') operaciones")).rows[0];
  assert(e11.perfiles && e11.operaciones, 'E11 baseline missing: STOP before any seed/mutation');
  const health = await fetch(apiOrigin + '/api/healthz', { signal: AbortSignal.timeout(4000) });
  assert.equal(health.status, 200);
  const adminSeed = JSON.parse(readFileSync(resolve(privateDir, 'credentials.json'), 'utf8')).admin;
  assert(adminSeed?.username && adminSeed?.password);
  const adminLogin = await call('ADMIN', 'POST', '/auth/login', { usuario: adminSeed.username, password: adminSeed.password });
  assert.equal(adminLogin.status, 200, 'ADMIN login real failed; no user creation / no 500 counted as denial');
  cookies.ADMIN = adminLogin.cookie;
  const adminMe = await call('ADMIN', 'GET', '/auth/me');
  assert.equal((adminMe.data.user ?? adminMe.data).rol, 'ADMIN');
  const location = (await db.query("select id from ubicaciones where tipo in ('TIENDA','BODEGA') and activa=true order by id limit 1")).rows[0];
  assert(location?.id, 'Canonical seed has no eligible site; STOP');
  const existing = (await db.query("select usuario from usuarios where usuario like 'night7_perm_%'")).rows;
  assert.equal(existing.length, 0, 'Synthetic actors already exist; STOP rather than replay');
  stage = 'creating-synthetic-actors'; checkpoint();
  const users = {};
  for (const role of roles) {
    const username = `night7_perm_${role.toLowerCase()}`;
    const password = randomBytes(20).toString('hex');
    const created = await call('ADMIN', 'POST', '/users', {
      nombre: `Night7 prueba ${role}`, usuario: username, password, rol: role,
      ubicacionId: ['SISTEMAS', 'CONTADOR'].includes(role) ? null : location.id,
    });
    assert.equal(created.status, 201, `No se creó actor ${role}: ${JSON.stringify(created.data)}`);
    users[role] = { username, password };
    const login = await call(role, 'POST', '/auth/login', { usuario: username, password });
    assert.equal(login.status, 200, `Login real ${role}: ${JSON.stringify(login.data)}`);
    cookies[role] = login.cookie;
    const me = await call(role, 'GET', '/auth/me');
    assert.equal(me.status, 200);
    assert.equal((me.data.user ?? me.data).rol, role);
    output.roles.push({ role, id: (me.data.user ?? me.data).id, meHttp: me.status });
    checkpoint();
  }
  mkdirSync(privateDir, { recursive: true, mode: 0o700 });
  writeFileSync(resolve(privateDir, 'synthetic-credentials.json'), JSON.stringify(users), { mode: 0o600 });
  // Real ADMIN-created resources, not guessed IDs; these three have real edit buttons
  // in the historic browser evidence. Do not overlap Task 6 browser/account work.
  stage = 'creating-eligible-catalog-resources'; checkpoint();
  const van = await call('ADMIN', 'POST', '/camionetas', { nombre: 'NIGHT7 PERMISSIONS VAN', placas: 'N7-PERM', tipo: 'PROPIA' });
  const driver = await call('ADMIN', 'POST', '/choferes', { nombreCompleto: 'NIGHT7 PERMISSIONS DRIVER', telefono: '5550001234' });
  const equipment = await call('ADMIN', 'POST', '/equipos', { ubicacionId: location.id, tipo: 'PISTOLA_ESCANER', identificador: 'NIGHT7-PERMISSIONS', marca: 'NIGHT7', modelo: 'TEST' });
  for (const [name, result] of [['camionetas', van], ['choferes', driver], ['equipos', equipment]]) {
    assert.equal(result.status, 201, `${name}: fixture failed ${JSON.stringify(result.data)}`);
    assert(Number.isInteger(result.data.id));
  }
  const dashboard = (await db.query("select puede_ver,puede_crear,puede_editar,puede_autorizar from permisos_rol where rol='TERMINAL' and modulo='dashboard'")).rows[0];
  assert(dashboard, 'No real permission row: STOP');
  const cases = [
    ['CONTADOR', 'camionetas', 'editar', 'PATCH', `/camionetas/${van.data.id}`, { nombre: 'NIGHT7 PERMISSIONS VAN' }, 'camionetas'],
    ['CONTADOR', 'choferes', 'editar', 'PATCH', `/choferes/${driver.data.id}`, { nombreCompleto: 'NIGHT7 PERMISSIONS DRIVER' }, 'choferes'],
    ['CONTADOR', 'equipos', 'editar', 'PATCH', `/equipos/${equipment.data.id}`, { marca: 'NIGHT7' }, 'equipos'],
    ...['TERMINAL', 'CAJA', 'SUPERVISOR', 'BODEGA', 'CONTADOR'].map(role => [
      role, 'permisos', 'editar', 'PUT', '/permisos/roles/TERMINAL/dashboard',
      { puedeVer: dashboard.puede_ver, puedeCrear: dashboard.puede_crear, puedeEditar: dashboard.puede_editar, puedeAutorizar: dashboard.puede_autorizar }, 'permisos_rol',
    ]),
  ];
  const mapped = new Set(JSON.parse(readFileSync(resolve(root, 'reports/tanda-h/permissions/mapped-24-plan.json'), 'utf8')).map(c => c.cellId));
  for (const [role, module, action] of cases) assert(mapped.has(`${role}:${module}:${action}`), 'No mapped operation for selected cell');
  stage = 'authenticated-denials'; checkpoint();
  const fingerprint = async table => {
    assert(['camionetas', 'choferes', 'equipos', 'permisos_rol'].includes(table));
    return (await db.query(`select count(*)::int n,md5(coalesce(string_agg(h,'' order by h),'')) digest from (select md5(row_to_json(t)::text) h from "${table}" t) s`)).rows[0];
  };
  for (const [role, module, action, method, url, body, table] of cases) {
    const before = await fingerprint(table);
    const response = await call(role, method, url, body);
    const after = await fingerprint(table);
    const selectedGuard = response.status === 403 && response.data.error === `No tienes permiso para '${action}' en el módulo '${module}'.`;
    const item = { cellId: `${role}:${module}:${action}`, role, method, url, status: response.status,
      response: response.data, selectedGuard, before, after,
      classification: selectedGuard ? 'SELECTED_ACTION_GUARD' : response.status === 403 ? 'OUTER_403_NOT_COVERAGE' : 'NOT_COVERAGE' };
    output.responses.push(item); checkpoint();
    assert.deepEqual(after, before, `${item.cellId}: unauthorized business write`);
    assert(response.status === 403 || response.status === 409, `${item.cellId}: successful mutation or error; STOP`);
  }
  // ADMIN update on catalog fixtures confirms real resources and valid request
  // bodies; permission-matrix positive write is deliberately prohibited.
  stage = 'positive-controls'; checkpoint();
  for (const [role, module, action, method, url, body] of cases.slice(0, 3)) {
    const r = await call('ADMIN', method, url, body);
    output.positiveControls.push({ forCell: `${role}:${module}:${action}`, status: r.status });
    checkpoint();
    assert.equal(r.status, 200, `Positive catalog control ${module} failed`);
  }
  output.counts = { authenticatedNaturalRoles: roles.length, actualDenialRequests: output.responses.length,
    newlyCoveredDirect: output.responses.filter(r => r.selectedGuard).length,
    outerOrBlocked: output.responses.filter(r => !r.selectedGuard).length,
    uiActionNew: 0, newCombined: 0 };
  stage = 'complete';
  writeFileSync(resolve(report, 'auth-tranche-results.json'), JSON.stringify({ stage, identity, ...output }, null, 2));
  console.log(JSON.stringify(output.counts));
} finally {
  checkpoint();
  await db.end();
}