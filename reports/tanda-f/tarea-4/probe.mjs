import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import vm from 'node:vm';
import pg from '../../../lib/db/node_modules/pg/lib/index.js';
const root='/home/runner/workspace', out=path.join(root,'reports/tanda-f/tarea-4',process.env.TASK4_FOLLOWUP==='1'?'followup':'');
fs.mkdirSync(out,{recursive:true});
const privateRoot=path.join(root,'.local/tanda-f'), source=path.join(privateRoot,'source');
const api='http://127.0.0.1:43831/api';
const db=new pg.Client({connectionString:'postgresql://postgres@127.0.0.1:55440/tanda_f_permissions'});
await db.connect();
const identity=(await db.query("select current_database() db,current_setting('data_directory') dir,inet_server_port() port")).rows[0];
if(identity.db!=='tanda_f_permissions'||identity.dir!==privateRoot+'/cluster'||identity.port!==55440) throw Error('Unsafe DB identity');
const pid=fs.readFileSync(privateRoot+'/cluster/postmaster.pid','utf8').split('\n')[0];
if(!fs.readFileSync(`/proc/${pid}/cmdline`,'utf8').includes(privateRoot+'/cluster')) throw Error('Unsafe cluster PID');
const apipid=fs.readFileSync(privateRoot+'/permissions-api.pid','utf8').trim();
const env=fs.readFileSync(`/proc/${apipid}/environ`,'utf8').split('\0');
if(!env.includes('TEST_DATABASE_URL=postgresql://postgres@127.0.0.1:55440/tanda_f_permissions')||
 !env.includes('DATABASE_URL=postgresql://postgres@127.0.0.1:55440/tanda_f_witness')) throw Error('Unsafe API environment');
const save=(name,data)=>fs.writeFileSync(path.join(out,name),JSON.stringify(data,null,2)+'\n');
save('identity.json',{...identity,clusterPid:Number(pid),apiPid:Number(apipid),apiPort:43831,witness:'tanda_f_witness',verified:new Date().toISOString()});
if(!(await fetch(api+'/healthz')).ok) throw Error('No API health');
const roles=['admin','terminal','caja','supervisor','bodega','sistemas','contador'];
const credentials=JSON.parse(fs.readFileSync(privateRoot+'/credentials.json'));
const fixture=JSON.parse(fs.readFileSync(root+'/reports/tanda-f/setup/fixture-manifest-redacted.json'));
const tables=(await db.query("select tablename from pg_tables where schemaname='public' order by tablename")).rows.map(x=>x.tablename).filter(x=>x!=='sesiones');
async function snapshot(){
 const result={};
 await db.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
 try {
 for(const name of tables) {
  const q='"'+name.replaceAll('"','""')+'"';
  const rows=await db.query(`select count(*)::int count,md5(coalesce(string_agg(h,'' order by h),'')) digest from (select md5(row_to_json(t)::text) h from ${q} t) s`);
  result[name]=rows.rows[0];
 }
 } finally {await db.query('ROLLBACK');}
 return result;
}
const diff=(a,b)=>Object.keys(a).filter(k=>JSON.stringify(a[k])!==JSON.stringify(b[k]));
const sessions={}, matrices={}, users={};
for(const role of roles){
 const c=credentials[role];
 const response=await fetch(api+'/auth/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({usuario:c.username,password:c.password})});
 if(!response.ok) throw Error(`Login ${role} status ${response.status}`);
 sessions[role]=response.headers.get('set-cookie').split(';')[0];
 const me=await fetch(api+'/auth/me',{headers:{cookie:sessions[role]}});
 const body=await me.json(); const user=body.user??body;
 if(!Array.isArray(user.permisos)) throw Error('Unexpected permission response keys: '+Object.keys(body));
 users[role]=user;matrices[role]={role:user.rol,id:user.id,permissions:user.permisos};
}
save('effective-matrices.json',matrices);
const actions={ver:'puedeVer',crear:'puedeCrear',editar:'puedeEditar',autorizar:'puedeAutorizar'};
const allowed=(role,module,action)=>!!matrices[role].permissions.find(p=>p.modulo===module)?.[actions[action]];
// Execute the actual frozen UI helper body, removing only its TS parameter/return annotations.
const uiFile=source+'/artifacts/mariana-textil/src/lib/permisos.ts';
const uiSource=fs.readFileSync(uiFile,'utf8');
const helper=uiSource.slice(uiSource.indexOf('export function hasPermission'));
const functionBody=helper.slice(helper.indexOf('{')+1,helper.lastIndexOf('}'));
const uiHas=vm.runInNewContext('(function(user,module,action="ver"){'+functionBody+'})');
const comparison=[];
for(const role of roles) for(const p of matrices[role].permissions) for(const action of Object.keys(actions))
 comparison.push({role:matrices[role].role,module:p.modulo,action,matrix:p[actions[action]],uiStatic:uiHas(users[role],p.modulo,action)});
save('ui-static-comparison.json',{kind:'static actual helper evaluation; NOT browser control visibility',sha256:crypto.createHash('sha256').update(uiSource).digest('hex'),comparisons:comparison});
const routesDir=source+'/artifacts/api-server/src/routes';
const inventory=[],guardLines=[];
for(const file of fs.readdirSync(routesDir).filter(n=>n.endsWith('.ts'))){
 const text=fs.readFileSync(path.join(routesDir,file),'utf8');
 text.split('\n').forEach((line,i)=>{if(/requierePermiso|requiereAdmin|requireRole|resolvePermiso/.test(line))guardLines.push({file,line:i+1,text:line.trim()});});
 const re=/\b(?:router|inventarioRouter)\.(get|post|patch|put|delete)\(\s*["'`]([^"'`]+)["'`]([\s\S]*?)(?=(?:async\s*\(|\([^)]*\)\s*=>))/g;
 for(const m of text.matchAll(re)){
  const guards=[...m[3].matchAll(/requierePermiso\(\s*["']([^"']+)["']\s*,\s*["']([^"']+)["']\s*\)/g)].map(g=>({module:g[1],action:g[2]}));
  let endpoint=m[2];
  if(['inventario.ts','auditorias-inventario.ts'].includes(file)) endpoint='/inventario'+endpoint;
  inventory.push({file,line:text.slice(0,m.index).split('\n').length,method:m[1].toUpperCase(),endpoint,guards,otherGuard:m[3].trim()});
 }
}
save('endpoint-inventory.json',{note:'Literal route extractor; router.use, aliases/arrays, inline guards and factory routes require manual review. Raw guard citations included separately.',routes:inventory});
save('guard-citations.json',guardLines);
const uiCitations=[];
function walk(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const f=path.join(dir,e.name);if(e.isDirectory())walk(f);else if(/\.(tsx|ts)$/.test(f))fs.readFileSync(f,'utf8').split('\n').forEach((l,i)=>{if(/hasPermission\(|PermissionGuard|RequirePermission/.test(l))uiCitations.push({file:path.relative(source,f),line:i+1,text:l.trim()});});}}
walk(source+'/artifacts/mariana-textil/src');save('ui-citations.json',uiCitations);
fs.writeFileSync(out+'/progress.txt',new Date().toISOString()+' Tranche 1: identity guarded; seven authenticated natural matrices captured; literal endpoint inventory + static UI predicates evaluated. No permission edits.\n');
const cases=[];
const reads=[
 ['dashboard','/dashboard'],['productos','/productos'],['precios','/precios'],
 ['clientes','/clientes'],['clientes_credito','/clientes/8/credito'],['clientes_precios','/clientes/8/precios'],
 ['clientes_finanzas','/clientes/8/estado-cuenta'],['proveedores','/proveedores'],['proveedores_finanzas','/proveedores/226/estado-cuenta'],
 ['ubicaciones','/locations'],['usuarios','/users'],['permisos','/permisos/roles'],
 ['inventario','/inventario/existencias'],['auditoria','/auditoria'],['contenedores','/contenedores'],
 ['camionetas','/camionetas'],['choferes','/choferes'],['viajes','/viajes'],['equipos','/equipos'],
 ['pos','/pos/buscar?q=994000001'],['entradas','/inventario/entradas'],['salidas','/salidas'],
 ['movimientos','/inventario/kardex?productoId=2078&ubicacionId=836'],['conciliacion','/inventario/conciliacion'],
 ['reportes','/reportes'],['resumen_caja','/caja/tiendas/836/ventas'],['cobros_pagos','/caja/tickets'],
 ['cortes','/sesiones-caja/46/corte'],['etiquetas','/etiquetas/rollos/6233'],
 ['auditoria_inventario','/inventario/auditorias'],['salidas_venta','/salidas/venta-cliente/pendientes'],
];
for(const [module,url] of reads) cases.push({module,action:'ver',method:'GET',url,validation:'No request body; fixture IDs where needed. Exact route/status recorded, 404 never counted as denial.'});
// Supplemental literal GET coverage. Only known fixture IDs and no unknown parameters.
for(const r of inventory.filter(r=>r.method==='GET'&&r.guards.length===1)){
 let url=r.endpoint;
 const fixtureId=url.startsWith('/clientes/')?8:url.startsWith('/proveedores/')?226:
  /^\/(productos|precios)\//.test(url)?2078:url.startsWith('/inventario/rollos/')||url.startsWith('/etiquetas/rollos/')?6233:
  url.startsWith('/inventario/movimientos/')?7370:url.startsWith('/inventario/entradas/')?468:
  url.startsWith('/locations/')?836:url.startsWith('/sesiones-caja/')?46:null;
 if(fixtureId)url=url.replace(':id',String(fixtureId));
 url=url.replace(':ubicacionId','836').replace(':clienteId','8');
 if(/[:$]/.test(url)||/\.(pdf|xlsx)$|exportar|imprimir/.test(url))continue;
 if(cases.some(c=>c.method==='GET'&&c.url.split('?')[0]===url))continue;
 const g=r.guards[0];
 cases.push({module:g.module,action:g.action,method:'GET',url,validation:'Literal guard extracted from frozen source; actual fixture IDs where required. Query-dependent schemas not universally validated; 400/404 remain gaps.'});
}
const edits=[
 ['productos','/productos/2078',{tela:'TANDA F DENIED PRODUCT EDIT'}],
 ['clientes','/clientes/8',{nombre:'TANDA F DENIED CLIENT EDIT'}],
 ['proveedores','/proveedores/226',{nombre:'TANDA F DENIED SUPPLIER EDIT'}],
 ['ubicaciones','/locations/836',{nombre:'TANDA F DENIED LOCATION EDIT'}],
 ['clientes_credito','/clientes/8/credito',{limiteCredito:5001,diasCredito:30}],
 ['precios','/precios/2078/cambiar',{precioListaNuevo:'151.00',motivo:'TANDA F DENIED PRICE EDIT',modoPrecio:'ROLLO'}],
];
for(const [module,url,body]of edits) cases.push({module,action:'editar',method:module==='precios'?'POST':'PATCH',url,body,validation:'Existing synthetic fixture IDs; named fields verified against route/schema. Not positive-control executed.'});
for(const [module,url,body]of [
 ['clientes','/clientes',{nombre:'TANDA F DENIED CREATE CLIENT'}],
 ['proveedores','/proveedores',{nombre:'TANDA F DENIED CREATE SUPPLIER',tipo:'NACIONAL'}],
 ['ubicaciones','/locations',{nombre:'TANDA F DENIED CREATE SITE',tipo:'TIENDA',iniciales:'TFD'}],
])cases.push({module,action:'crear',method:'POST',url,body,validation:'Named fields verified against schema; positive-control not executed.'});
if(process.env.TASK4_FOLLOWUP==='1'){
 cases.splice(0);
 const add=(module,action,method,url,body)=>cases.push({module,action,method,url,body,
  validation:'Frozen route/schema inspected; synthetic fixture identifiers; no positive control. Deeper business preconditions not independently proven.'});
 add('productos','editar','PATCH','/productos/2078',{tela:'TANDA F DENIED PRODUCT EDIT'});
 add('productos','crear','POST','/productos',{tela:'TANDA F DENIED NEW FABRIC',color:'AZUL',unidad:'METRO'});
 add('marcar_remate','autorizar','POST','/inventario/rollos/6233/remate',{motivo:'TANDA F denied remate authorization'});
 add('etiquetas','crear','POST','/etiquetas/reimpresiones',{rolloIds:[6233],motivo:'TANDA F denied label reprint'});
 const floors=await db.query('select id from pisos where ubicacion_id=836 and activo=true order by id limit 1');
 add('inventario','editar','PATCH','/inventario/rollos/6233/piso',{pisoId:floors.rows[0]?.id??null});
 add('auditoria_inventario','crear','POST','/inventario/auditorias',{ubicacionId:836});
 add('ajustes','crear','POST','/inventario/rollos/6233/ajustar',{cantidadNueva:'9.000',justificacion:'TANDA F denied adjustment'});
 add('conciliacion','autorizar','POST','/inventario/conciliacion/recalcular',{productoId:2078,ubicacionId:836});
 add('proveedores_finanzas','autorizar','POST','/proveedores/226/ajustes',{importe:1,notas:'TANDA F denied supplier adjustment'});
 add('clientes_finanzas','autorizar','POST','/clientes/8/ajustes',{importe:1,motivo:'TANDA F denied client adjustment'});
 add('usuarios','editar','PATCH','/users/235',{nombre:'TANDA F DENIED USER NAME'});
 add('usuarios','crear','POST','/users',{nombre:'TANDA F DENIED USER',usuario:'tandaf-denied-new-user',rol:'TERMINAL',ubicacionId:836,alcanceConsulta:'PROPIA'});
 add('cortes','crear','POST','/sesiones-caja/46/cerrar',{efectivoContado:5000});
 add('contenedores','crear','POST','/contenedores',{proveedorId:227,referencia:'TANDA F DENIED CONTAINER',fechaEstimadaLlegada:'2026-10-01',sitioDestinoId:836,lineas:[{productoId:2078,cantidadEsperada:'10.000',rollosEsperados:1}]});
 add('camionetas','crear','POST','/camionetas',{nombre:'TANDA F DENIED VAN',placas:'TF-DENIED',tipo:'PROPIA'});
 add('choferes','crear','POST','/choferes',{nombreCompleto:'TANDA F DENIED DRIVER',telefono:'5550001234'});
 add('equipos','crear','POST','/equipos',{ubicacionId:836,tipo:'PISTOLA_ESCANER',identificador:'TANDA-F-DENIED',marca:'TANDA F TEST',modelo:'DENIED'});
 add('caja_abonos','crear','GET','/caja/abonos-e3/contexto?buscar=TANDA&sitioId=836');
 add('caja_abonos','crear','POST','/caja/abonos-e3/vista-previa',{clienteId:8,importeCentavos:100,formaPago:'EFECTIVO',cuentaDestino:'CAJA_FISICA',sitioId:836,sesionCajaId:46,operacionClave:'af000001-0000-4000-8000-000000000001'});
 add('clientes_recapturas','crear','POST','/clientes/8/recapturas-e3/vista-previa',{clienteId:8,importeCentavos:100,formaPago:'EFECTIVO',cuentaDestino:'CAJA_FISICA',sitioId:836,sesionCajaId:null,operacionClave:'af000002-0000-4000-8000-000000000001',motivo:'TANDA F denied recapture',fechaRecepcion:'2026-09-22T12:00:00-06:00'});
}
save('probe-cases.json',cases);
const results=[],beforeAll=await snapshot();
save('before-denials.json',beforeAll);
for(const role of roles) for(const c of cases){
 if(allowed(role,c.module,c.action)) continue;
 const before=c.method==='GET'?null:await snapshot();
 const requestBody=c.module==='usuarios'&&c.action==='crear'?{...c.body,password:crypto.randomBytes(24).toString('hex')}:c.body;
 const response=await fetch(api+c.url,{method:c.method,headers:{cookie:sessions[role],'content-type':'application/json'},body:requestBody?JSON.stringify(requestBody):undefined});
 const text=await response.text();
 let error;try{error=JSON.parse(text).error;}catch{}
 const after=before?await snapshot():null;
 results.push({role:matrices[role].role,module:c.module,action:c.action,method:c.method,url:c.url,status:response.status,
  error:typeof error==='string'?error.slice(0,400):undefined,denied:response.status===403,
  changedTables:before?diff(before,after):null,mutationCheck:before?'all public table row digests except sesiones, immediately before/after':'aggregate tranche check'});
 save('api-results.json',results);
}
const afterAll=await snapshot();save('after-denials.json',afterAll);
const coverage=[];
for(const role of roles)for(const p of matrices[role].permissions)for(const action of Object.keys(actions)){
 if(p[actions[action]])continue;
 const attempts=results.filter(r=>r.role===matrices[role].role&&r.module===p.modulo&&r.action===action);
 coverage.push({role:matrices[role].role,module:p.modulo,action,attempts:attempts.length,denials:attempts.filter(r=>r.denied).length,
  status:attempts.length===0?'GAP_NOT_PROBED':attempts.every(r=>r.denied&&(r.changedTables===null||r.changedTables.length===0))?'DENIED_OBSERVED':'REVIEW'});
}
save('denied-action-coverage.json',coverage);
save('summary.json',{roles:roles.map(r=>matrices[r].role),matrixCells:comparison.length,staticUiMismatches:comparison.filter(c=>c.matrix!==c.uiStatic).length,
 attempts:results.length,statuses:results.reduce((a,r)=>(a[r.status]=(a[r.status]??0)+1,a),{}),writeAttempts:results.filter(r=>r.method!=='GET').length,
 changedTables:diff(beforeAll,afterAll),coverage:coverage.reduce((a,r)=>(a[r.status]=(a[r.status]??0)+1,a),{}),excludedFromRowDigests:['sesiones'],
 limitation:'No browser interaction; no positive mutation controls; sequences/external side effects not fingerprinted; route inventory lexical not exhaustive.'});
fs.appendFileSync(out+'/progress.txt',new Date().toISOString()+' Tranche 2: deny probes complete; all seven roles accounted; snapshots saved. Results and explicit gaps in summary/coverage.\n');
await db.end();
console.log('Task4 evidence saved; no credentials or session tokens recorded.');