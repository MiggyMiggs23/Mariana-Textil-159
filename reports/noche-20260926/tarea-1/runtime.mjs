import fs from 'node:fs';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import pg from '../../../scripts/node_modules/pg/lib/index.js';
const out = 'reports/noche-20260926/tarea-1';
const load = p => JSON.parse(fs.readFileSync(p));
const save = (n, v) => fs.writeFileSync(`${out}/${n}.json`, JSON.stringify(v, null, 2));
const ready = load('reports/noche-20260926/tarea-2/private-ready.json');
assert.equal(ready.database, 'noche_20260926');
assert.equal(ready.apiUrl, 'http://127.0.0.1:18227');
const url = load('/tmp/noche-20260926/test-env.json').TEST_DATABASE_URL;
assert(fs.readFileSync(`/proc/${ready.pid}/environ`, 'utf8').split('\0').includes('DATABASE_URL=' + url));
const db = new pg.Client({ connectionString: url });
await db.connect();
assert.equal((await db.query('select current_database() d')).rows[0].d, 'noche_20260926');
const sessions = {};
const credentialsFile = '/tmp/noche-20260926/permissions-credentials.json';
const credentials = fs.existsSync(credentialsFile) ? load(credentialsFile) : { ADMIN: load('/tmp/noche-20260926/credentials.json').admin };
const calls = [];
async function call(role, method, path, body) {
  const r = await fetch(ready.apiUrl + '/api' + path, { method, headers: { 'content-type': 'application/json', ...(sessions[role] ? { cookie: sessions[role] } : {}) }, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(30000) });
  const text = await r.text(); let data; try { data = JSON.parse(text); } catch { data = { nonJson: true }; }
  return { status: r.status, data, cookie: r.headers.get('set-cookie')?.split(';')[0] };
}
const fixtures = fs.existsSync(`${out}/fixtures.json`) ? load(`${out}/fixtures.json`) : {};
async function create(key, path, body, role = 'ADMIN') {
  if (fixtures[key]) return fixtures[key].data;
  const r = await call(role, 'POST', path, body);
  calls.push({ key, path, status: r.status, data: r.data }); save('fixture-attempts', calls);
  assert(r.status >= 200 && r.status < 300, `${key}: ${JSON.stringify(r)}`);
  fixtures[key] = { status: r.status, data: r.data }; save('fixtures', fixtures);
  return r.data;
}
try {
  const login = async role => {
    const c = credentials[role];
    const r = await call(role, 'POST', '/auth/login', { usuario: c.usuario, password: c.password });
    assert.equal(r.status, 200, `${role} login`);
    sessions[role] = r.cookie;
    const me = await call(role, 'GET', '/auth/me');
    assert.equal((me.data.user ?? me.data).rol, role);
    return me.data.user ?? me.data;
  };
  const auth = { ADMIN: await login('ADMIN') };
  const site = (await db.query("select u.id,p.id piso from ubicaciones u join pisos p on p.ubicacion_id=u.id where u.activa and p.activo order by u.id,p.id limit 1")).rows[0];
  assert(site);
  for (const role of ['TERMINAL','CAJA','SUPERVISOR','BODEGA','SISTEMAS','CONTADOR']) {
    if (!credentials[role]) {
      const c = { usuario: 'n26perm_' + role.toLowerCase(), password: crypto.randomBytes(20).toString('hex') };
      await create('user_' + role, '/users', { nombre: 'N26 permisos ' + role, ...c, rol: role, ubicacionId: ['SISTEMAS','CONTADOR'].includes(role) ? null : site.id });
      credentials[role] = c;
      fs.writeFileSync(credentialsFile, JSON.stringify(credentials), { mode: 0o600 });
    }
    auth[role] = await login(role);
  }
  save('auth-me', auth);
  const product = (await db.query("select id from productos where activo and unidad='METRO' order by id limit 1")).rows[0];
  const supplier = (await db.query("select id from proveedores where activo order by id limit 1")).rows[0];
  const client = (await db.query("select id from clientes where activo and not es_sistema order by id limit 1")).rows[0];
  assert(product && supplier && client);
  const entry = await create('entry_stock', '/inventario/entradas', { ubicacionId: site.id, proveedorId: supplier.id, observaciones: 'N26 permissions stock', uuidCliente: crypto.randomUUID(), lineas: [{ productoId: product.id, costoUnitario: '100.00', cantidades: Array(6).fill('10.000'), pisosPorCantidad: Array(6).fill(site.piso) }] });
  const rolls = entry.rollos;
  assert(rolls.length >= 5);
  const van = await create('van','/camionetas',{ nombre:'N26 PERM VAN',placas:'N26PERM',tipo:'PROPIA' });
  const driver = await create('driver','/choferes',{nombreCompleto:'N26 PERM DRIVER',telefono:'5550001234'});
  const equipment = await create('equipment','/equipos',{ubicacionId:site.id,tipo:'PISTOLA_ESCANER',identificador:'N26-PERM',marca:'N26',modelo:'TEST'});
  const containerBody = { proveedorId:supplier.id,referencia:'N26 PERM CONTAINER',fechaEstimadaLlegada:'2026-10-01',sitioDestinoId:site.id,lineas:[{productoId:product.id,cantidadEsperada:'10.000',rollosEsperados:1}] };
  const container = await create('container','/contenedores',containerBody);
  const audit = await create('audit','/inventario/auditorias',{ubicacionId:site.id});
  for(let i=0;i<3;i++) await create('reprint'+i,'/etiquetas/reimpresiones',{rolloIds:[rolls[0].id],motivo:'N26 permissions review '+i});
  const watermark = (await db.query('select id from reimpresiones_etiqueta where rollo_id=$1 order by id desc limit 1',[rolls[0].id])).rows[0];
  const pending = await create('entry_pending','/inventario/entradas',{ubicacionId:site.id,proveedorId:supplier.id,observaciones:'N26 pending',uuidCliente:crypto.randomUUID(),lineas:[{productoId:product.id,costoUnitario:null,cantidades:['10.000'],pisosPorCantidad:[site.piso]}]},'BODEGA');
  const extra = await create('extra','/inventario/salidas-extraordinarias',{rolloId:rolls[1].id,motivo:'MUESTRA',justificacion:'N26 valid permissions fixture',uuidCliente:crypto.randomUUID()});
  const makeSalida = (key,i) => create(key,'/salidas/venta-cliente',{uuidCliente:crypto.randomUUID(),origenId:site.id,clienteId:client.id,series:[rolls[i].serie],nota:'N26 permission fixture'});
  const salida = await makeSalida('salida',2), sale = await makeSalida('sale',3);
  const ticket = await create('ticket','/tickets',{uuidCliente:crypto.randomUUID(),ubicacionId:site.id,clienteId:client.id,documentoTipo:'TICKET',facturado:false,lineas:[{rolloId:rolls[4].id,productoId:product.id,tipo:'NORMAL',cantidad:10,precioUnitario:150}]});
  const row = (await db.query("select * from permisos_rol where rol='TERMINAL' and modulo='dashboard'")).rows[0];
  const cases = [
    ['camionetas','editar','PATCH',`/camionetas/${van.id}`,{nombre:'N26 PERM VAN'}],
    ['choferes','editar','PATCH',`/choferes/${driver.id}`,{nombreCompleto:'N26 PERM DRIVER'}],
    ['equipos','editar','PATCH',`/equipos/${equipment.id}`,{marca:'N26'}],
    ['contenedores','editar','PATCH',`/contenedores/${container.id}`,containerBody],
    ['contenedores','autorizar','POST',`/contenedores/${container.id}/cancelar`,{motivo:'N26 permissions cancellation'}],
    ['auditoria_inventario','editar','POST',`/inventario/auditorias/${audit.id}/escaneos`,{serie:rolls[0].serie,pisoId:site.piso}],
    ['etiquetas','editar','POST',`/etiquetas/rollos/${rolls[0].id}/revisar`,{ultimaReimpresionId:watermark.id}],
    ['entradas','editar','POST',`/inventario/entradas/${pending.id}/costos`,{costosProductos:[{productoId:product.id,costoUnitario:'100.00'}],costosRollos:[]}],
    ['salidas','editar','POST',`/inventario/salidas-extraordinarias/${extra.movimientoId}/revertir`,{justificacion:'N26 permissions valid reversal',uuidCliente:crypto.randomUUID()}],
    ['salidas','autorizar','POST',`/salidas/${salida.id}/cancelar`,{motivo:'N26 permissions cancellation'}],
    ['salidas_venta','crear','POST','/salidas/venta-cliente/generar-venta',{uuidCliente:crypto.randomUUID(),documentoTipo:'TICKET',ubicacionId:site.id,clienteId:client.id,salidaIds:[sale.id],precios:[{salidaRolloId:sale.rollos[0].id,precioUnitario:150}]}],
    ['cobros_pagos','crear','POST',`/tickets/${ticket.id}/cobrar`,{pagos:[{formaPago:'EFECTIVO',importe:Number(ticket.total)}]}],
    ['permisos','editar','PUT','/permisos/roles/TERMINAL/dashboard',{puedeVer:row.puede_ver,puedeCrear:row.puede_crear,puedeEditar:row.puede_editar,puedeAutorizar:row.puede_autorizar}],
    ['clientes_finanzas','crear','POST',`/clientes/${client.id}/pagos/vista-previa`,{importe:1,fechaEfectiva:'2026-09-26T12:00:00.000Z'}],
    ['auditoria_inventario','autorizar','POST',`/inventario/auditorias/${audit.id}/confirmar`,{}],
  ].map(([module,action,method,path,body])=>({module,action,method,path,body}));
  save('cases',cases);save('fixture-identity',{site,product,supplier,client,rolls});
  const tables = (await db.query("select tablename from pg_tables where schemaname='public' and tablename not in ('sesiones') order by tablename")).rows.map(r=>r.tablename);
  const snapshot = async()=>{const result={};const query=tables.map(t=>{const q='"'+t.replaceAll('"','""')+'"';return `select '${t.replaceAll("'","''")}' as tab,count(*)::int n,md5(coalesce(string_agg(h,'' order by h),'')) digest from (select md5(row_to_json(t)::text) h from ${q} t)s`}).join(' UNION ALL ');for(const r of (await db.query(query)).rows)result[r.tab]={n:r.n,digest:r.digest};return result;};
  const results=fs.existsSync(`${out}/direct-requests.json`)?load(`${out}/direct-requests.json`):[];
  for(const c of cases) for(const cell of load(`${out}/inventory.json`).rows.filter(r=>r.plan&&r.module===c.module&&r.action===c.action)){
    if(results.some(r=>r.cellId===cell.id)) continue;
    const perm=auth[cell.role].permisos?.find(p=>p.modulo===c.module);
    if(perm?.[{crear:'puedeCrear',editar:'puedeEditar',autorizar:'puedeAutorizar'}[c.action]]){results.push({cellId:cell.id,classification:'EFFECTIVE_PERMISSION_DRIFT_NOT_DENIED',permission:perm});save('direct-requests',results);continue;}
    const before=await snapshot(),r=await call(cell.role,c.method,c.path,c.body),after=await snapshot();
    const changedTables=tables.filter(t=>JSON.stringify(before[t])!==JSON.stringify(after[t]));
    const selected=r.status===403&&r.data.error===cell.plan.exactGuardError;
    results.push({cellId:cell.id,...c,status:r.status,response:r.data,selectedGuard:selected,classification:selected?'SELECTED_ACTION_DENIAL':r.data.code==='PERFIL_DENEGADO'?'OUTER_E11':r.status===409?'GATE_OR_STATE_409':'OUTER_OR_OTHER',changedTables,before,after});
    save('direct-requests',results);
    assert(!(r.status>=200&&r.status<300),'Permission bypass '+cell.id);
    assert(changedTables.every(t=>/auditor/.test(t)),'Unexpected business change '+cell.id+':'+changedTables.join(','));
  }
  save('runtime-summary',{attempted:results.filter(r=>r.status).length,selected:results.filter(r=>r.selectedGuard).length,blocked:results.filter(r=>!r.selectedGuard).length,newCombined:0,exclusiveWindow:true});
} catch(e) { save('runtime-error',{error:String(e.stack)});throw e; } finally {await db.end();}