import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import pg from '../../../scripts/node_modules/pg/lib/index.js';

const root = process.cwd(), privateRoot = root + '/.local/tanda-h';
const out = root + '/reports/tanda-h/permissions';
const read = path => JSON.parse(fs.readFileSync(path, 'utf8'));
const save = (name, value) => fs.writeFileSync(`${out}/${name}.json`, JSON.stringify(value, null, 2) + '\n');
const cfg = read(privateRoot + '/worker-databases.json').permissions;
const build = read(root + '/reports/tanda-h/setup/build-identity.json');
for (const asset of build.assets) assert.equal(crypto.createHash('sha256').update(fs.readFileSync(privateRoot + '/frozen-source/' + asset.path)).digest('hex'), asset.sha256);
const apiPid = Number(fs.readFileSync(privateRoot + '/permissions-api.pid', 'utf8'));
const uiPid = Number(fs.readFileSync(privateRoot + '/permissions-ui.pid', 'utf8'));
const environ = pid => fs.readFileSync(`/proc/${pid}/environ`, 'utf8').split('\0');
const apiEnv = environ(apiPid), uiEnv = environ(uiPid);
assert(apiEnv.includes('TEST_DATABASE_URL=' + cfg.url));
assert(apiEnv.includes('PORT=43873'));
assert(apiEnv.includes('REQUIRE_ISOLATED_TEST_DATABASE=1'));
assert(uiEnv.includes('API_PORT=43873') && uiEnv.includes('PROXY_PORT=43883'));
const db = new pg.Client({ connectionString: cfg.url });
await db.connect();
const identity = (await db.query('select current_database() db,current_user actor,inet_server_port() port')).rows[0];
assert.equal(identity.db, 'tanda_h_permissions');
assert.equal(identity.actor, 'h_permissions');
assert.equal(identity.port, 55444);
save('identity', { ...identity, apiPid, uiPid, buildCommit: build.commit, allBuildHashesVerified: true, at: new Date().toISOString() });
const roles = ['admin', 'terminal', 'caja', 'supervisor', 'bodega', 'sistemas', 'contador'];
const credentials = read(privateRoot + '/credentials.json');
const sessions = {}, matrices = {};
async function request(role, method, url, body) {
  const response = await fetch('http://127.0.0.1:43873/api' + url, {
    method, headers: { 'content-type': 'application/json', ...(sessions[role] ? { cookie: sessions[role] } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(15000),
  });
  const text = await response.text();
  let data; try { data = JSON.parse(text); } catch { data = { nonJson: true }; }
  return { status: response.status, data, cookie: response.headers.get('set-cookie')?.split(';')[0] };
}
const auth = [];
for (const role of roles) {
  const login = await request(role, 'POST', '/auth/login', { usuario: credentials[role].username, password: credentials[role].password });
  assert.equal(login.status, 200, role + ' login');
  sessions[role] = login.cookie;
  const me = await request(role, 'GET', '/auth/me');
  const user = me.data.user ?? me.data;
  assert.equal(user.rol, role.toUpperCase());
  assert(Array.isArray(user.permisos));
  matrices[role] = { role: user.rol, id: user.id, permissions: user.permisos };
  auth.push({ role: user.rol, loginHttp: login.status, meHttp: me.status, userId: user.id });
}
save('auth-http', auth); save('matrices', matrices);
const tables = (await db.query("select tablename from pg_tables where schemaname='public' order by tablename")).rows.map(r => r.tablename).filter(t => t !== 'sesiones');
async function snapshot() {
  const result = {};
  await db.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  try {
    for (const table of tables) {
      const q = '"' + table.replaceAll('"', '""') + '"';
      result[table] = (await db.query(`select count(*)::int count,md5(coalesce(string_agg(h,'' order by h),'')) digest from (select md5(row_to_json(t)::text) h from ${q} t)s`)).rows[0];
    }
  } finally { await db.query('ROLLBACK'); }
  return result;
}
const uuid = () => crypto.randomUUID();
const ledgerPath = out + '/fixtures.json';
const ledger = fs.existsSync(ledgerPath) ? read(ledgerPath) : {};
async function create(key, url, body, role = 'admin') {
  const previous = ledger[key];
  if (previous && !(key === 'salidaCancel' && previous.status === 400 && previous.response.code === 'INVALID_CLIENT' && body.clienteId === 8)) {
    assert(previous.status >= 200 && previous.status < 300, key + ' previous unsuccessful fixture; inspect before replay'); return previous.response;
  }
  const r = await request(role, 'POST', url, body);
  ledger[key] = { role, url, body, status: r.status, response: r.data, ...(previous ? { previousRejectedAttempt: previous } : {}) }; save('fixtures', ledger);
  assert(r.status >= 200 && r.status < 300, `${key} ${r.status} ${JSON.stringify(r.data)}`);
  return r.data;
}
try {
  const manifest = read(root + '/reports/tanda-h/setup/fixture-manifest-redacted.json');
  const rolls = manifest.rolls.filter(r => r.siteId === 835 && r.unit === 'METRO');
  assert(rolls.length >= 5);
  const productId = rolls[0].productId;
  const supplierId = rolls[0].supplierId;
  const client = (await db.query('select id from clientes where activo=true and es_sistema=false and id=$1', [manifest.customer.id])).rows[0];
  assert(client);
  const van = await create('van', '/camionetas', { nombre: 'TANDA H PERMISSIONS VAN', placas: 'H-PERM', tipo: 'PROPIA' });
  const driver = await create('driver', '/choferes', { nombreCompleto: 'TANDA H PERMISSIONS DRIVER', telefono: '5550001234' });
  const equipment = await create('equipment', '/equipos', { ubicacionId: 835, tipo: 'PISTOLA_ESCANER', identificador: 'TANDA-H-PERMISSIONS', marca: 'TANDA H', modelo: 'TEST' });
  const containerBody = { proveedorId: supplierId, referencia: 'TANDA H PERMISSIONS CONTAINER', fechaEstimadaLlegada: '2026-10-01', sitioDestinoId: 835, lineas: [{ productoId: productId, cantidadEsperada: '10.000', rollosEsperados: 1 }] };
  const container = await create('container', '/contenedores', containerBody);
  const audit = await create('audit', '/inventario/auditorias', { ubicacionId: 835 });
  for (let i = 1; i <= 3; i++) await create('reprint' + i, '/etiquetas/reimpresiones', { rolloIds: [rolls[0].id], motivo: 'TANDA H PERMISSIONS review fixture ' + i });
  const watermark = (await db.query('select id from reimpresiones_etiqueta where rollo_id=$1 order by id desc limit 1', [rolls[0].id])).rows[0];
  const floor = (await db.query('select id from pisos where ubicacion_id=835 and activo=true order by id limit 1')).rows[0];
  const entry = await create('entry', '/inventario/entradas', { ubicacionId: 835, proveedorId: supplierId, observaciones: 'TANDA H PERMISSIONS pending cost', uuidCliente: uuid(), lineas: [{ productoId: productId, costoUnitario: null, cantidades: ['10.000'], pisosPorCantidad: [floor?.id ?? null] }] }, 'bodega');
  const extra = await create('extra', '/inventario/salidas-extraordinarias', { rolloId: rolls[1].id, motivo: 'MUESTRA', justificacion: 'TANDA H PERMISSIONS reversible fixture', uuidCliente: uuid() });
  const salidaCancel = await create('salidaCancel', '/salidas/venta-cliente', { uuidCliente: uuid(), origenId: 835, clienteId: client.id, series: [rolls[2].serie], nota: 'TANDA H PERMISSIONS cancel fixture' });
  const salidaSale = await create('salidaSale', '/salidas/venta-cliente', { uuidCliente: uuid(), origenId: 835, clienteId: client.id, series: [rolls[3].serie], nota: 'TANDA H PERMISSIONS sale fixture' });
  const ticket = await create('ticket', '/tickets', { uuidCliente: uuid(), ubicacionId: 835, clienteId: client.id, documentoTipo: 'TICKET', facturado: false, lineas: [{ rolloId: rolls[4].id, productoId: productId, tipo: 'NORMAL', cantidad: 10, precioUnitario: 150 }] });
  const row = (await db.query("select * from permisos_rol where rol='TERMINAL' and modulo='dashboard'")).rows[0];
  assert(row);
  const cases = [
    ['camionetas', 'editar', 'PATCH', '/camionetas/' + van.id, { nombre: 'TANDA H PERMISSIONS VAN' }],
    ['choferes', 'editar', 'PATCH', '/choferes/' + driver.id, { nombreCompleto: 'TANDA H PERMISSIONS DRIVER' }],
    ['equipos', 'editar', 'PATCH', '/equipos/' + equipment.id, { marca: 'TANDA H' }],
    ['contenedores', 'editar', 'PATCH', '/contenedores/' + container.id, containerBody],
    ['contenedores', 'autorizar', 'POST', '/contenedores/' + container.id + '/cancelar', { motivo: 'TANDA H PERMISSIONS valid cancellation' }],
    ['auditoria_inventario', 'editar', 'POST', '/inventario/auditorias/' + audit.id + '/escaneos', { serie: rolls[0].serie }],
    ['etiquetas', 'editar', 'POST', '/etiquetas/rollos/' + rolls[0].id + '/revisar', { ultimaReimpresionId: watermark.id }],
    ['entradas', 'editar', 'POST', '/inventario/entradas/' + entry.id + '/costos', { costosProductos: [{ productoId: productId, costoUnitario: '100.00' }], costosRollos: [] }],
    ['salidas', 'editar', 'POST', '/inventario/salidas-extraordinarias/' + extra.movimientoId + '/revertir', { justificacion: 'TANDA H PERMISSIONS valid reversal', uuidCliente: uuid() }],
    ['salidas', 'autorizar', 'POST', '/salidas/' + salidaCancel.id + '/cancelar', { motivo: 'TANDA H PERMISSIONS valid cancel' }],
    ['salidas_venta', 'crear', 'POST', '/salidas/venta-cliente/generar-venta', { uuidCliente: uuid(), documentoTipo: 'TICKET', ubicacionId: 835, clienteId: client.id, salidaIds: [salidaSale.id], precios: [{ salidaRolloId: salidaSale.rollos[0].id, precioUnitario: 150 }] }],
    ['cobros_pagos', 'crear', 'POST', '/tickets/' + ticket.id + '/cobrar', { pagos: [{ formaPago: 'EFECTIVO', importe: Number(ticket.total) }] }],
    ['permisos', 'editar', 'PUT', '/permisos/roles/TERMINAL/dashboard', { puedeVer: row.puede_ver, puedeCrear: row.puede_crear, puedeEditar: row.puede_editar, puedeAutorizar: row.puede_autorizar }],
    ['clientes_finanzas', 'crear', 'POST', '/clientes/' + client.id + '/pagos/vista-previa', { importe: 1, fechaEfectiva: '2026-09-01T12:00:00.000Z' }],
    ['auditoria_inventario', 'autorizar', 'POST', '/inventario/auditorias/' + audit.id + '/confirmar', {}],
  ].map(([module, action, method, url, body]) => ({ module, action, method, url, body }));
  save('cases', cases);
  assert(!fs.existsSync(out + '/direct-requests.json'), 'No duplicate campaign run');
  const plan = read(out + '/mapped-24-plan.json');
  const results = [];
  for (const c of cases) {
    if (c.module === 'auditoria_inventario' && c.action === 'autorizar') await create('auditClose', '/inventario/auditorias/' + audit.id + '/cerrar', {});
    for (const cell of plan.filter(p => p.module === c.module && p.action === c.action)) {
      const before = await snapshot();
      const r = await request(cell.role.toLowerCase(), c.method, c.url, c.body);
      const after = await snapshot();
      const changedTables = tables.filter(t => JSON.stringify(before[t]) !== JSON.stringify(after[t]));
      const selected = r.status === 403 && r.data.error === `No tienes permiso para '${c.action}' en el módulo '${c.module}'.`;
      results.push({ cellId: cell.cellId, campaignCaseId: cell.campaignCaseId, role: cell.role, ...c, status: r.status, response: r.data, selectedActionGuardObserved: selected, classification: selected ? 'SELECTED_ACTION_DENIAL' : r.data.code === 'PERFIL_DENEGADO' ? 'BLOCKED_E11_OUTER' : r.status === 409 ? 'BLOCKED_LEGACY_GATE' : 'BLOCKED_OUTER_OR_OTHER', changedTables, before, after });
      save('direct-requests', results);
      assert(!(r.status >= 200 && r.status < 300), 'BYPASS: denied role accepted selected operation; stop immediately');
      assert(changedTables.every(t => /auditor/.test(t)), 'Unexpected business writes; stop immediately');
    }
  }
  assert.equal(results.length, 24);
  const controls = [];
  for (const c of cases) {
    if (c.module === 'permisos') { controls.push({ ...c, skipped: 'No matrix writes authorized; even unchanged-value positive update omitted.' }); continue; }
    if (c.module === 'auditoria_inventario') { controls.push({ ...c, skipped: 'Audit now closed; no incomplete-count confirmation or ineligible edit control.' }); continue; }
    const r = await request('admin', c.method, c.url, c.body);
    controls.push({ role: 'ADMIN', ...c, status: r.status, response: r.data });
    save('positive-controls', controls);
  }
  save('positive-controls', controls);
  save('runtime-summary', { authenticatedRoles: auth.length, mappedCellsRequested: results.length, newSelectedActionCells: results.filter(r => r.selectedActionGuardObserved).length, outerE11: results.filter(r => r.classification === 'BLOCKED_E11_OUTER').length, legacy409: results.filter(r => r.classification === 'BLOCKED_LEGACY_GATE').length, otherOuter: results.filter(r => r.classification === 'BLOCKED_OUTER_OR_OTHER').length, successfulPositiveControls: controls.filter(r => r.status >= 200 && r.status < 300).length, remainingDirect: 381 - results.filter(r => r.selectedActionGuardObserved).length, ownerRows: 357, deniedBusinessWrites: results.flatMap(r => r.changedTables).filter(t => !/auditor/.test(t)).length, matrixChanges: 0, gatesChanged: 0, sourceFixes: 0, bypassesDemonstrated: 0, completedAt: new Date().toISOString() });
  console.log('Completed 24 authenticated direct requests; see runtime-summary.json');
} finally { await db.end(); }