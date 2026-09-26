import fs from 'node:fs';
import assert from 'node:assert/strict';
import { chromium } from '../../../.cache/pnpm/dlx/0be451ecc86649edb1205a8454559cdd433606b22e8744a742f8d93fdb9e4b57/1a0642de1a4-8c2/node_modules/.pnpm/playwright@1.55.0/node_modules/playwright/index.mjs';
const out='reports/noche-20260926/tarea-1',origin='http://127.0.0.1:18228';
const load=p=>JSON.parse(fs.readFileSync(p)),save=(n,v)=>fs.writeFileSync(`${out}/${n}.json`,JSON.stringify(v,null,2));
const creds=load('/tmp/noche-20260926/permissions-credentials.json'),fixtures=load(`${out}/fixtures.json`),identity=load(`${out}/fixture-identity.json`);
const lib='/tmp/noche-20260926/permissions-browser-libs';
fs.mkdirSync(lib,{recursive:true});
const packaged='/nix/store/ifx1nl219iyd84hjr11rbkmjazsjr0q0-electronplayer-2.0.8-usr-target/lib';
for(const n of fs.readdirSync(packaged))if(n.includes('.so')&&!/^(libc\.|libm\.|libpthread\.|librt\.|libdl\.|ld-|libresolv\.|libutil\.)/.test(n)&&!fs.existsSync(lib+'/'+n))fs.symlinkSync(packaged+'/'+n,lib+'/'+n);
const targets=[
 {module:'entradas',path:'/entradas/pendientes-costo',controls:{editar:'^Capturar$'},fixture:String(fixtures.entry_pending.data.folioFormateado)},
 {module:'salidas',path:'/salidas',controls:{editar:'Revertir',autorizar:'Cancelar salida'},fixture:fixtures.salida.data.folioFormateado},
 {module:'etiquetas',path:'/etiquetas?rolloId='+identity.rolls[0].id,controls:{editar:'Marcar revisado'},fixture:identity.rolls[0].serie},
 {module:'auditoria_inventario',path:'/inventario/auditorias',controls:{editar:'Escanear',autorizar:'Confirmar'},fixture:null},
 {module:'contenedores',path:'/contenedores/'+fixtures.container.data.id,controls:{editar:'Editar',autorizar:'Cancelar'},fixture:'N26 PERM CONTAINER'},
 {module:'permisos',path:'/permisos',controls:{editar:'Guardar'},fixture:null},
 {module:'clientes_finanzas',path:'/clientes/'+identity.client.id,controls:{crear:'Abono|Registrar pago'},fixture:null},
 {module:'cobros_pagos',path:'/cobros',controls:{crear:'Cobrar'},fixture:fixtures.ticket.data.folioFormateado},
 {module:'salidas_venta',path:'/pos',controls:{crear:'Generar venta'},fixture:null},
 {module:'camionetas',path:'/directorio/camionetas',controls:{editar:'Editar'},fixture:'N26 PERM VAN'},
 {module:'choferes',path:'/directorio/choferes',controls:{editar:'Editar N26 PERM DRIVER'},fixture:'N26 PERM DRIVER'},
 {module:'equipos',path:'/equipos',controls:{editar:'Editar N26-PERM'},fixture:'N26-PERM'},
];
const inventory=load(`${out}/inventory.json`).rows;
const results=fs.existsSync(`${out}/browser-results.json`)?load(`${out}/browser-results.json`):[];
const browser=await chromium.launch({headless:true,executablePath:process.cwd()+'/.cache/ms-playwright/chromium-1187/chrome-linux/chrome',env:{...process.env,LD_LIBRARY_PATH:lib},args:['--no-sandbox']});
try{
for(const role of Object.keys(creds)){
 const context=await browser.newContext({viewport:{width:1360,height:1000}});
 const login=await context.request.post(origin+'/api/auth/login',{data:creds[role]});
 assert.equal(login.status(),200);
 const cookie=login.headers()['set-cookie'].split(';')[0],equal=cookie.indexOf('=');
 await context.addCookies([{name:cookie.slice(0,equal),value:cookie.slice(equal+1),url:origin,httpOnly:true,secure:false}]);
 const me=await context.request.get(origin+'/api/auth/me');
 const user=await me.json();assert.equal((user.user??user).rol,role);
 const page=await context.newPage();page.setDefaultTimeout(3000);page.setDefaultNavigationTimeout(15000);
 await page.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());
 for(const t of targets.filter(t=>role==='ADMIN'||inventory.some(c=>c.plan&&c.role===role&&c.module===t.module))){
  if(results.some(r=>r.role===role&&r.module===t.module&&(r.finalObservation||r.error)))continue;
  const previous=results.findIndex(r=>r.role===role&&r.module===t.module);if(previous>=0)results.splice(previous,1);
  const r={role,...t,actions:{},authenticated:true};
  try{
   await page.goto(origin+t.path);
   await page.waitForTimeout(5000);
   await page.waitForFunction(()=>document.body.innerText.length>80&&!document.body.innerText.includes('Verificando perfil y permisos contables'),{},{timeout:20000});
   await page.waitForFunction(()=>!/\bCargando\b|Verificando perfil/.test(document.body.innerText),{},{timeout:10000});
   await page.waitForTimeout(800);
   r.settled=true;r.finalObservation=true;
   r.actualPath=new URL(page.url()).pathname;
   r.fixtureVisible=t.fixture?await page.getByText(t.fixture,{exact:false}).first().isVisible():false;
   r.body=(await page.locator('body').innerText()).slice(0,12000);
   r.buttons=await page.getByRole('button').allTextContents();
   for(const [action,pattern]of Object.entries(t.controls)){
    const controls=page.getByRole('button',{name:new RegExp(pattern,'i')});
    let visible=0,enabled=0;for(let i=0;i<await controls.count();i++)if(await controls.nth(i).isVisible()){visible++;if(await controls.nth(i).isEnabled())enabled++;}
    r.actions[action]={visible,enabled};
   }
   // Non-mutating dialog opening establishes an actual binding, not a text scan.
   if(role==='ADMIN'&&['contenedores','entradas','choferes','equipos'].includes(t.module)){
    const action=page.getByRole('button',{name:new RegExp(t.controls.editar,'i')}).first();
    if(await action.isVisible()&&await action.isEnabled()){await action.click();r.editDialogVisible=await page.getByRole('dialog').first().isVisible();}
   }
   r.screenshot=`ui-${role.toLowerCase()}-${t.module}.jpg`;await page.screenshot({path:out+'/'+r.screenshot,fullPage:true});
  }catch(e){r.error=String(e);}
  results.push(r);save('browser-results',results);
 }
 await context.close();
}
}finally{await browser.close();}
console.log(JSON.stringify({observations:results.length,errors:results.filter(r=>r.error).length}));