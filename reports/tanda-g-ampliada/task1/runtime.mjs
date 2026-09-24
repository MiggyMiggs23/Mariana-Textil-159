import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import pg from '../../../scripts/node_modules/pg/lib/index.js';
import {chromium} from '../../../.cache/pnpm/dlx/0be451ecc86649edb1205a8454559cdd433606b22e8744a742f8d93fdb9e4b57/1a0642de1a4-8c2/node_modules/.pnpm/playwright@1.55.0/node_modules/playwright/index.mjs';
const root=process.cwd(), privateRoot=root+'/.local/tanda-g-ampliada';
const source=privateRoot+'/frozen-source', out=root+'/reports/tanda-g-ampliada/task1/runtime';
fs.mkdirSync(out,{recursive:true});
const save=(n,v)=>fs.writeFileSync(out+'/'+n+'.json',JSON.stringify(v,null,2)+'\n');
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const cfg=JSON.parse(fs.readFileSync(privateRoot+'/worker-databases.json')).permissions;
const build=JSON.parse(fs.readFileSync(root+'/reports/tanda-g-ampliada/setup/build-identity.json'));
assert.equal(hash(source+'/artifacts/api-server/dist/index.mjs'),build.apiSha256);
for(const asset of build.uiAssets) assert.equal(hash(source+'/'+asset.path),asset.sha256);
const apiPid=Number(fs.readFileSync(privateRoot+'/permissions-api.pid','utf8'));
const env=fs.readFileSync(`/proc/${apiPid}/environ`,'utf8').split('\0');
assert(env.includes('TEST_DATABASE_URL='+cfg.url));
assert(env.includes('PORT=43851'));
assert(env.includes('REQUIRE_ISOLATED_TEST_DATABASE=1'));
assert(env.includes('NODE_ENV=test'));
const db=new pg.Client({connectionString:cfg.url}); await db.connect();
const identity=(await db.query("select current_database() db,current_user actor,inet_server_port() port")).rows[0];
assert.equal(identity.db,'tanda_ga_permissions');assert.equal(identity.actor,'ga_permissions');assert.equal(identity.port,55442);
const clusterPid=Number(fs.readFileSync(privateRoot+'/cluster/postmaster.pid','utf8').split('\n')[0]);
assert(fs.readFileSync(`/proc/${clusterPid}/cmdline`,'utf8').includes(privateRoot+'/cluster'));
save('identity',{...identity,apiPid,clusterPid,buildCommit:build.commit,apiSha256:build.apiSha256,uiHashesVerified:true,at:new Date().toISOString()});
const roles=['admin','terminal','caja','supervisor','bodega','sistemas','contador'];
const credentials=JSON.parse(fs.readFileSync(privateRoot+'/credentials.json'));
const api='http://127.0.0.1:43851/api',origin='http://127.0.0.1:43861';
const sessions={},matrices={};
async function request(role,method,url,body){
  const response=await fetch(api+url,{method,headers:{'content-type':'application/json',...(sessions[role]?{cookie:sessions[role]}:{})},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(20000)});
  const text=await response.text();let data;try{data=JSON.parse(text);}catch{data={nonJson:true};}
  return {status:response.status,data,cookie:response.headers.get('set-cookie')?.split(';')[0]};
}
for(const role of roles){
  const c=credentials[role],login=await request(role,'POST','/auth/login',{usuario:c.username,password:c.password});
  assert.equal(login.status,200,role+' login');sessions[role]=login.cookie;
  const me=await request(role,'GET','/auth/me'); const user=me.data.user??me.data;
  assert.equal(user.rol,role.toUpperCase());assert(Array.isArray(user.permisos));
  matrices[role]={role:user.rol,id:user.id,permissions:user.permisos};
}
save('matrices',matrices);
const allowed=(role,module,action)=>role==='admin'||!!matrices[role].permissions.find(p=>p.modulo===module)?.[{ver:'puedeVer',crear:'puedeCrear',editar:'puedeEditar',autorizar:'puedeAutorizar'}[action]];
const tables=(await db.query("select tablename from pg_tables where schemaname='public' order by tablename")).rows.map(r=>r.tablename).filter(t=>t!=='sesiones');
async function snapshot(){
  const result={};await db.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  try{for(const table of tables){
    const q='"'+table.replaceAll('"','""')+'"';
    result[table]=(await db.query(`select count(*)::int count,md5(coalesce(string_agg(h,'' order by h),'')) digest from (select md5(row_to_json(t)::text) h from ${q} t)s`)).rows[0];
  }}finally{await db.query('ROLLBACK');}
  return result;
}
const mode=process.argv[2];
try{
if(mode==='fixtures2'){
  const ledgerFile=out+'/fixture-ledger2.json';
  const ledger=fs.existsSync(ledgerFile)?JSON.parse(fs.readFileSync(ledgerFile)):{};
  async function create(key,url,body,role='admin'){
    if(ledger[key]?.status>=200&&ledger[key]?.status<300)return ledger[key].response;
    if(ledger[key])assert.equal(ledger[key].status,400,'Do not replay unknown mutation outcome');
    const prior=ledger[key]?[ledger[key]]:[];
    const r=await request(role,'POST',url,body);
    ledger[key]={role,url,body,status:r.status,response:r.data,prior};save('fixture-ledger2',ledger);
    assert(r.status>=200&&r.status<300,`${key}: ${r.status} ${JSON.stringify(r.data)}`);return r.data;
  }
  const floors=(await db.query('select id from pisos where ubicacion_id=836 and activo=true order by id limit 1')).rows;
  assert(allowed('bodega','entradas','crear'));
  await create('entry','/inventario/entradas',{ubicacionId:836,proveedorId:226,observaciones:'TANDA GA TASK1 pending cost fixture',uuidCliente:crypto.randomUUID(),lineas:[{productoId:2078,costoUnitario:null,cantidades:['10.000'],pisosPorCantidad:[floors[0]?.id??null]}]},'bodega');
  await create('extra','/inventario/salidas-extraordinarias',{rolloId:6235,motivo:'MUESTRA',justificacion:'TANDA GA TASK1 reversible fixture',uuidCliente:crypto.randomUUID()});
  await create('salidaCancel','/salidas/venta-cliente',{uuidCliente:crypto.randomUUID(),origenId:836,clienteId:8,series:['996000002'],nota:'TANDA GA TASK1 cancellable fixture'});
  await create('salidaSale','/salidas/venta-cliente',{uuidCliente:crypto.randomUUID(),origenId:836,clienteId:8,series:['996000005'],nota:'TANDA GA TASK1 sale source fixture'});
  await create('ticket','/tickets',{uuidCliente:crypto.randomUUID(),ubicacionId:836,clienteId:8,documentoTipo:'TICKET',facturado:false,lineas:[{rolloId:6236,productoId:2078,tipo:'NORMAL',cantidad:10,precioUnitario:150}]});
  const first=JSON.parse(fs.readFileSync(out+'/fixture-ledger.json'));
  await create('auditClose','/inventario/auditorias/'+first.audit.response.id+'/cerrar',{});
}else if(mode==='denials2'){
  const ledger=JSON.parse(fs.readFileSync(out+'/fixture-ledger2.json'));
  const first=JSON.parse(fs.readFileSync(out+'/fixture-ledger.json'));
  for(const v of Object.values(ledger))assert(v.status>=200&&v.status<300,'Invalid fixture setup');
  const id=key=>{const r=ledger[key].response;assert(Number.isInteger(r.id),key+' missing ID');return r.id;};
  const sourceLine=ledger.salidaSale.response.rollos[0];
  assert(sourceLine);
  const cases=[
    {module:'entradas',action:'editar',method:'POST',url:'/inventario/entradas/'+id('entry')+'/costos',body:{costosProductos:[{productoId:2078,costoUnitario:'100.00'}],costosRollos:[]}},
    {module:'salidas',action:'editar',method:'POST',url:'/inventario/salidas-extraordinarias/'+ledger.extra.response.movimientoId+'/revertir',body:{justificacion:'TANDA GA TASK1 valid denied reversal',uuidCliente:crypto.randomUUID()}},
    {module:'salidas',action:'autorizar',method:'POST',url:'/salidas/'+id('salidaCancel')+'/cancelar',body:{motivo:'TANDA GA TASK1 valid denied cancel'}},
    {module:'salidas_venta',action:'crear',method:'POST',url:'/salidas/venta-cliente/generar-venta',body:{uuidCliente:crypto.randomUUID(),documentoTipo:'TICKET',ubicacionId:836,clienteId:8,salidaIds:[id('salidaSale')],precios:[{salidaRolloId:sourceLine.id,precioUnitario:150}]}},
    {module:'cobros_pagos',action:'crear',method:'POST',url:'/tickets/'+id('ticket')+'/cobrar',body:{pagos:[{formaPago:'EFECTIVO',importe:Number(ledger.ticket.response.total)}]}},
    {module:'auditoria_inventario',action:'autorizar',method:'POST',url:'/inventario/auditorias/'+first.audit.response.id+'/confirmar',body:{}},
  ];
  save('denial-cases2',cases);
  const before=await snapshot();save('denials2-before',before);const results=[];
  for(const c of cases)for(const role of roles.filter(r=>!allowed(r,c.module,c.action))){
    const response=await request(role,c.method,c.url,c.body);
    results.push({role:role.toUpperCase(),...c,status:response.status,response:response.data,
      limitation:role==='contador'?'E11 outer boundary, not inner guard isolation':'Natural role; fixture and body independently checked'});
    save('denials2-api',results);
    if(response.status>=200&&response.status<300)throw Error('BYPASS: accepted denied '+role+' '+c.module+'.'+c.action);
  }
  const after=await snapshot();save('denials2-after',after);
  const changes=tables.filter(t=>JSON.stringify(before[t])!==JSON.stringify(after[t]));
  save('denials2-state',{changedTables:changes,results:results.length});
  assert(changes.every(t=>/auditor/.test(t)),'Unexpected business writes');
}else if(mode==='controls2'){
  const cases=JSON.parse(fs.readFileSync(out+'/denial-cases2.json'));const results=[];
  assert(!fs.existsSync(out+'/positive-controls2.json'),'Positive controls already attempted');
  for(const c of cases){
    if(c.module==='auditoria_inventario')continue; // Do not apply an incomplete count; closed-state fixture still valid for denial.
    const r=await request('admin',c.method,c.url,c.body);
    results.push({...c,status:r.status,response:r.data});save('positive-controls2',results);
  }
}else if(mode==='fixtures'){
  const ledgerFile=out+'/fixture-ledger.json';
  const ledger=fs.existsSync(ledgerFile)?JSON.parse(fs.readFileSync(ledgerFile)):{};
  async function create(key,url,body){
    if(ledger[key])return ledger[key].response;
    const r=await request('admin','POST',url,body);
    ledger[key]={url,body,status:r.status,response:r.data};save('fixture-ledger',ledger);
    assert(r.status>=200&&r.status<300,`${key}: ${r.status} ${JSON.stringify(r.data)}`);
    return r.data;
  }
  await create('van','/camionetas',{nombre:'TANDA GA TASK1 VAN',placas:'GA-T1',tipo:'PROPIA'});
  await create('driver','/choferes',{nombreCompleto:'TANDA GA TASK1 DRIVER',telefono:'5550001234'});
  await create('equipment','/equipos',{ubicacionId:836,tipo:'PISTOLA_ESCANER',identificador:'TANDA-GA-TASK1',marca:'TASK1',modelo:'TEST'});
  await create('container','/contenedores',{proveedorId:227,referencia:'TANDA GA TASK1 CONTAINER',fechaEstimadaLlegada:'2026-10-01',sitioDestinoId:836,lineas:[{productoId:2078,cantidadEsperada:'10.000',rollosEsperados:1}]});
  await create('audit','/inventario/auditorias',{ubicacionId:836});
  for(let i=1;i<=3;i++)await create('reprint'+i,'/etiquetas/reimpresiones',{rolloIds:[6233],motivo:'TANDA GA TASK1 immutable label review fixture '+i});
}else if(mode==='denials'){
  const ledger=JSON.parse(fs.readFileSync(out+'/fixture-ledger.json'));
  for(const v of Object.values(ledger))assert(v.status>=200&&v.status<300,'Invalid fixture setup');
  const id=key=>{const r=ledger[key].response;assert(Number.isInteger(r.id),key+' missing ID');return r.id;};
  const watermark=(await db.query('select id from reimpresiones_etiqueta where rollo_id=6233 order by id desc limit 1')).rows[0];
  assert(watermark);
  const cases=[
    {module:'camionetas',action:'editar',method:'PATCH',url:'/camionetas/'+id('van'),body:{nombre:'TANDA GA TASK1 VAN'}},
    {module:'choferes',action:'editar',method:'PATCH',url:'/choferes/'+id('driver'),body:{nombreCompleto:'TANDA GA TASK1 DRIVER'}},
    {module:'equipos',action:'editar',method:'PATCH',url:'/equipos/'+id('equipment'),body:{marca:'TASK1'}},
    {module:'contenedores',action:'editar',method:'PATCH',url:'/contenedores/'+id('container'),body:ledger.container.body},
    {module:'contenedores',action:'autorizar',method:'POST',url:'/contenedores/'+id('container')+'/cancelar',body:{motivo:'TANDA GA valid denied cancellation'}},
    {module:'auditoria_inventario',action:'editar',method:'POST',url:'/inventario/auditorias/'+id('audit')+'/escaneos',body:{serie:'996000001'}},
    {module:'etiquetas',action:'editar',method:'POST',url:'/etiquetas/rollos/6233/revisar',body:{ultimaReimpresionId:watermark.id}},
  ];
  save('denial-cases',cases);
  const before=await snapshot();save('denials-before',before);
  const results=[];
  for(const c of cases)for(const role of roles.filter(r=>!allowed(r,c.module,c.action))){
    const response=await request(role,c.method,c.url,c.body);
    results.push({role:role.toUpperCase(),...c,status:response.status,response:response.data,
      limitation:role==='contador'?'E11 outer boundary, not inner guard isolation':'Natural role, outer guards may reject first; fixture and body verified separately'});
    save('denials-api',results);
    if(response.status>=200&&response.status<300)throw Error('BYPASS: unexpected accepted denied '+role+' '+c.module+'.'+c.action);
  }
  const after=await snapshot();save('denials-after',after);
  const changes=tables.filter(t=>JSON.stringify(before[t])!==JSON.stringify(after[t]));
  save('denials-state',{changedTables:changes,results:results.length});
  assert(changes.every(t=>/auditor/.test(t)),'Unexpected business writes');
}else if(mode==='controls'){
  const cases=JSON.parse(fs.readFileSync(out+'/denial-cases.json'));
  const results=[];
  assert(!fs.existsSync(out+'/positive-controls.json'),'Positive controls already attempted; inspect before any replay');
  for(const c of cases){
    const r=await request('admin',c.method,c.url,c.body);
    results.push({...c,status:r.status,response:r.data});save('positive-controls',results);
  }
}else if(mode==='legacy'){
  const before=await snapshot();save('legacy-before',before);const results=[];
  for(const role of roles){
    const c={module:'clientes_finanzas',action:'crear',method:'POST',url:'/clientes/8/pagos/vista-previa',body:{importe:1,fechaEfectiva:'2026-09-01T12:00:00.000Z'}};
    const r=await request(role,c.method,c.url,c.body);
    results.push({role:role.toUpperCase(),...c,status:r.status,response:r.data,qualification:'Legacy capture gate probe; neither 409 nor E11 outer rejection proves clientes_finanzas.crear guard.'});
    save('legacy-api',results);
  }
  const after=await snapshot();save('legacy-after',after);
  save('legacy-state',{changedTables:tables.filter(t=>JSON.stringify(before[t])!==JSON.stringify(after[t]))});
}else if(mode==='permissions'){
  const row=(await db.query("select rol,modulo,puede_ver,puede_crear,puede_editar,puede_autorizar from permisos_rol where rol='TERMINAL' and modulo='dashboard'")).rows[0];
  assert(row);
  const body={puedeVer:row.puede_ver,puedeCrear:row.puede_crear,puedeEditar:row.puede_editar,puedeAutorizar:row.puede_autorizar};
  assert(Object.values(body).every(v=>typeof v==='boolean'));
  const before=await snapshot();save('permissions-before',before);
  const results=[];
  for(const role of roles.filter(r=>!allowed(r,'permisos','editar'))){
    const url=`/permisos/roles/${row.rol}/${row.modulo}`;
    const result=await request(role,'PUT',url,body);
    results.push({role:role.toUpperCase(),module:'permisos',action:'editar',method:'PUT',url,body,status:result.status,response:result.data,
      qualification:'Existing row unchanged desired values; outer permisos.ver or E11 boundary may reject before editar.'});
    save('permissions-api',results);
    if(result.status>=200&&result.status<300)throw Error('CONFIRMED unexpected accepted denied permission request; stop and report');
  }
  const after=await snapshot();save('permissions-after',after);
  const changes=tables.filter(t=>JSON.stringify(before[t])!==JSON.stringify(after[t]));
  save('permissions-state',{changedTables:changes,results:results.length});
  assert(changes.every(t=>/auditor/.test(t)),'Unexpected business writes');
}else if(mode==='browser'){
  // Existing packaged libraries only; exclude bundled libc to retain host ABI.
  const lib=privateRoot+'/task1-browser-libs';
  fs.mkdirSync(lib,{recursive:true});
  const packaged='/nix/store/ifx1nl219iyd84hjr11rbkmjazsjr0q0-electronplayer-2.0.8-usr-target/lib';
  for(const name of fs.readdirSync(packaged)){
    if(!name.includes('.so')||/^(libc\.|libm\.|libpthread\.|librt\.|libdl\.|ld-|libresolv\.|libutil\.)/.test(name))continue;
    const dest=lib+'/'+name;if(!fs.existsSync(dest))try{fs.symlinkSync(packaged+'/'+name,dest);}catch(e){if(e.code!=='EEXIST')throw e;}
  }
  const results=process.env.TASK1_ROLES&&fs.existsSync(out+'/browser-results.json')?JSON.parse(fs.readFileSync(out+'/browser-results.json')):[];
  const pages=[
    {path:'/directorio/camionetas',module:'camionetas',button:'Nueva Camioneta',editRow:'TANDA GA TASK1 VAN'},
    {path:'/directorio/choferes',module:'choferes',button:'Nuevo chofer',editButton:'Editar TANDA GA TASK1 DRIVER'},
    {path:'/equipos',module:'equipos',button:'Nuevo Equipo',editButton:'Editar TANDA-GA-TASK1'},
    {path:'/permisos',module:'permisos'},
    {path:'/contenedores',module:'contenedores'},
    {path:'/inventario/auditorias',module:'auditoria_inventario'},
    {path:'/etiquetas',module:'etiquetas'},
    {path:'/entradas/pendientes-costo',module:'entradas'},
    {path:'/salidas',module:'salidas'},
    {path:'/cobros',module:'cobros_pagos'},
    {path:'/clientes/8',module:'clientes_finanzas'},
  ];
  for(const role of roles.filter(r=>!process.env.TASK1_ROLES||process.env.TASK1_ROLES.split(',').includes(r))){
    const browser=await chromium.launch({headless:true,executablePath:root+'/.cache/ms-playwright/chromium-1187/chrome-linux/chrome',env:{...process.env,LD_LIBRARY_PATH:lib},args:['--no-sandbox'],timeout:20000});
    try{
      const page=await browser.newPage({viewport:{width:1360,height:1000}});
      page.setDefaultTimeout(8000);page.setDefaultNavigationTimeout(15000);
      await page.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());
      await page.goto(origin+'/login');
      await page.getByLabel('Usuario',{exact:true}).fill(credentials[role].username);
      await page.getByLabel('Contraseña',{exact:true}).fill(credentials[role].password);
      await page.getByRole('button',{name:'Ingresar',exact:true}).click();
      await page.waitForURL(u=>!u.pathname.includes('login'));
      for(const target of pages){
        const item={role:role.toUpperCase(),...target,expectedView:allowed(role,target.module,'ver'),expectedCreate:allowed(role,target.module,'crear'),observedAt:new Date().toISOString()};
        try{
          await page.goto(origin+target.path);
          await page.waitForFunction(()=>!document.body.innerText.includes('Comprobando sesión')&&!document.body.innerText.includes('Cargando...'),{},{timeout:12000});
          await page.waitForTimeout(1200);
          assert(!(await page.locator('body').innerText()).includes('Comprobando sesión'),'Unsettled session is not hidden-control evidence');
          item.actualPath=new URL(page.url()).pathname;
          item.visibleButtons=await page.getByRole('button').allTextContents();
          item.screenshot=`${role}-${target.module}.png`;
          await page.screenshot({path:out+'/'+item.screenshot,fullPage:true});
          if(target.button){
            const button=page.getByRole('button',{name:target.button,exact:true});
            item.buttonVisible=await button.isVisible();
            if(item.buttonVisible){
              await button.click();item.actualButtonClicked=target.button;
              item.dialogVisible=await page.getByRole('dialog').isVisible();
              item.dialogScreenshot=`${role}-${target.module}-clicked.png`;
              await page.screenshot({path:out+'/'+item.dialogScreenshot,fullPage:true});
              const cancel=page.getByRole('dialog').getByRole('button',{name:'Cancelar',exact:true});
              if(await cancel.isVisible())await cancel.click();else await page.keyboard.press('Escape');
              await page.getByRole('dialog').waitFor({state:'hidden'});
            }else item.hiddenControlObserved=true;
          }else{
            item.visibleLinks=await page.getByRole('link').allTextContents();
            if(target.module==='permisos'){
              item.checkboxCount=await page.getByRole('checkbox').count();
              item.disabledCheckboxCount=await page.locator('[role=checkbox][disabled]').count();
              const tab=page.getByRole('tab').first();
              if(await tab.isVisible()){await tab.click();item.actualButtonClicked='permission tab (no matrix change)';}
            }
          }
          if(target.editButton||target.editRow){
            const edit=target.editButton?page.getByRole('button',{name:new RegExp('^'+target.editButton+'$','i')}).first():
              page.getByRole('row').filter({hasText:new RegExp(target.editRow,'i')}).getByRole('button').first();
            item.editVisible=await edit.isVisible();
            if(item.editVisible){
              await edit.click();item.actualEditClicked=true;
              item.editDialogVisible=await page.getByRole('dialog').isVisible();
              item.editScreenshot=`${role}-${target.module}-edit.png`;
              await page.screenshot({path:out+'/'+item.editScreenshot,fullPage:true});
              await page.keyboard.press('Escape');
            }
          }
          item.bodyExcerpt=(await page.locator('body').innerText()).slice(0,1500);
        }catch(e){item.error=String(e);}
        const prior=results.findIndex(r=>r.role===item.role&&r.module===item.module);
        if(prior>=0)results[prior]=item;else results.push(item);
        save('browser-results',results);
      }
    }finally{await browser.close();}
    console.log('Role browser completed: '+role);
  }
}else throw Error('Usage runtime.mjs permissions|browser');
}finally{await db.end();}