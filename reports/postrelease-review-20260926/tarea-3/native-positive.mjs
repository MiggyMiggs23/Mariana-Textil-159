// Run only after MAIN ends TASK2 exclusive window.
// setup preserves resources for one targeted browser pass; positives consumes them.
import fs from 'node:fs';
import assert from 'node:assert/strict';
const out = 'reports/postrelease-review-20260926/tarea-3';
const privateDir = '/tmp/postrelease-review-20260926/postreview_permissions_20260926';
const load = p => JSON.parse(fs.readFileSync(p));
const phase = process.argv[2];
assert(['setup','positives','e5-read'].includes(phase), 'Explicit phase required');
assert.equal(process.env.MAIN_TASK2_WINDOW_ENDED, 'yes', 'MAIN exclusive window not released');
const pid = load(`${privateDir}/pids.json`).api;
const url = load(`${privateDir}/test-env.json`).TEST_DATABASE_URL;
assert(fs.readFileSync(`/proc/${pid}/environ`, 'utf8').split('\0').includes(`DATABASE_URL=${url}`));
const credentials = load(`${privateDir}/permissions-credentials.json`);
const authBefore = load(`${out}/auth-me.json`);
const cases = load(`${out}/cases.json`);
const fixtures = load(`${out}/fixtures.json`);
const identity = load(`${out}/fixture-identity.json`);
const journalFile = `${out}/native-positive-journal.json`;
const journal = fs.existsSync(journalFile) ? load(journalFile) : [];
const save = () => fs.writeFileSync(journalFile, JSON.stringify(journal, null, 2));
const sessions = {};
async function request(role, method, path, body) {
  const response = await fetch(`http://127.0.0.1:18337/api${path}`, {
    method, headers: { 'content-type': 'application/json', ...(sessions[role] ? { cookie: sessions[role] } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(30000),
  });
  const data = await response.json();
  return { status: response.status, data, cookie: response.headers.get('set-cookie')?.split(';')[0] };
}
async function login(role) {
  if (sessions[role]) return;
  const result = await request(role, 'POST', '/auth/login', credentials[role]);
  assert.equal(result.status, 200); sessions[role] = result.cookie;
  const me = await request(role, 'GET', '/auth/me');
  const user = me.data.user ?? me.data;
  assert.equal(user.id, authBefore[role].id); assert.equal(user.rol, role);
}
async function operation(key, role, method, path, body) {
  const previous = journal.find(r => r.key === key);
  if (previous) {
    assert(previous.status >= 200 && previous.status < 300, `Uncertain/failed prior ${key}; independent readback required, never blindly replay`);
    return previous.response;
  }
  await login(role);
  const record = { key, phase, role, method, path, body, state: 'REQUEST_NOT_YET_CONFIRMED' };
  journal.push(record); save();
  const result = await request(role, method, path, body);
  Object.assign(record, { status: result.status, response: result.data, state: 'RESPONSE_RECEIVED' }); save();
  assert(result.status >= 200 && result.status < 300, `${key}: ${result.status} ${JSON.stringify(result.data)}`);
  return result.data;
}
if (phase === 'setup') {
  for (const role of ['ADMIN','SUPERVISOR','BODEGA','SISTEMAS'])
    await operation(`participate-${role}`, role, 'POST', `/inventario/auditorias/${fixtures.audit.data.id}/participar`, {});
  await operation('open-native-caja', 'ADMIN', 'POST', '/sesiones-caja/abrir', {
    ubicacionId: identity.site.id, fondoInicial: 0,
  });
}
if (phase === 'positives') {
  // All consume only resources created by runtime.mjs in this new disposable.
  // Confirm browser screenshots completed before enabling this phase.
  assert.equal(process.env.MAIN_ELIGIBLE_UI_CAPTURED, 'yes');
  for (const pair of [
    'camionetas:editar','choferes:editar','equipos:editar','contenedores:editar',
    'contenedores:autorizar','etiquetas:editar','entradas:editar',
    'salidas:editar','salidas:autorizar','auditoria_inventario:editar',
    'salidas_venta:crear','cobros_pagos:crear',
  ]) {
    const c = cases.find(c => `${c.module}:${c.action}` === pair); assert(c);
    if (pair === 'auditoria_inventario:editar') {
      // Browser chose the released desktop access floor, not the stock floor.
      // Preserve the rejected floor3 attempt; rebind BOTH negatives and positive.
      await login('ADMIN');
      const floors = await request('ADMIN', 'GET', `/inventario/auditorias/${fixtures.audit.data.id}/pisos`);
      assert.equal(floors.status, 200);
      const floor = floors.data.find(p => p.nombre === 'Planta Alta');
      assert(floor, 'Must match the actual targeted screenshot access floor');
      const correctedBody = { ...c.body, pisoId: floor.id };
      const readback = async () => {
        const r = await request('ADMIN', 'GET', `/inventario/auditorias/${fixtures.audit.data.id}`);
        assert.equal(r.status, 200);
        return { totalEscaneados: r.data.totalEscaneados, resultados: r.data.resultados, estado: r.data.estado };
      };
      const negatives = [];
      for (const deniedRole of ['TERMINAL','CAJA']) {
        await login(deniedRole);
        const before = await readback(), r = await request(deniedRole, c.method, c.path, correctedBody), after = await readback();
        assert.equal(r.status, 403);
        assert.equal(r.data.error, "No tienes permiso para 'editar' en el módulo 'auditoria_inventario'.");
        assert.deepEqual(after, before);
        negatives.push({ cellId: `${deniedRole}:auditoria_inventario:editar`, method: c.method, path: c.path,
          body: correctedBody, status: r.status, response: r.data, selectedGuard: true, before, after, unchanged: true });
      }
      fs.writeFileSync(`${out}/audit-access-floor-negatives.json`, JSON.stringify(negatives, null, 2));
      await operation('positive-auditoria_inventario:editar-access-floor', 'ADMIN', c.method, c.path, correctedBody);
      continue;
    }
    // Real TERMINAL has this permission; no synthetic grant or denial invented.
    const role = pair === 'salidas_venta:crear' ? 'TERMINAL' : 'ADMIN';
    await operation(`positive-${pair}`, role, c.method, c.path, c.body);
  }
}
if (phase === 'e5-read') {
  const results = [];
  for (const role of Object.keys(credentials)) {
    await login(role);
    const path = `/e5/contexto?clienteId=${identity.client.id}&ubicacionId=${identity.site.id}`;
    const r = await request(role, 'GET', path);
    results.push({ role, path, status: r.status, response: r.data,
      classification: 'COMPOSITE_OR_PROFILE_BOUNDARY_NOT_SINGLE_PERMISSION_CLOSURE' });
    fs.writeFileSync(`${out}/e5-dynamic-results.json`, JSON.stringify(results, null, 2));
  }
}
console.log(JSON.stringify({ phase, journalEntries: journal.length }));