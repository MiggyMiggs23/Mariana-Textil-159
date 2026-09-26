import fs from 'node:fs';
import assert from 'node:assert/strict';
const out='reports/noche-20260926/tarea-1',load=p=>JSON.parse(fs.readFileSync(p));
assert.equal(load('reports/noche-20260926/tarea-2/private-ready.json').database,'noche_20260926');
assert(!fs.existsSync(`${out}/positive-controls.json`),'No replay');
const c=load('/tmp/noche-20260926/permissions-credentials.json').ADMIN;
const origin='http://127.0.0.1:18227/api';
const login=await fetch(origin+'/auth/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(c)});
assert.equal(login.status,200);
const cookie=login.headers.get('set-cookie').split(';')[0];
const selected=new Set(['camionetas:editar','choferes:editar','equipos:editar','contenedores:editar','contenedores:autorizar','etiquetas:editar','entradas:editar','salidas:editar','salidas:autorizar']);
const results=[];
for(const test of load(`${out}/cases.json`).filter(c=>selected.has(c.module+':'+c.action))){
 const r=await fetch(origin+test.path,{method:test.method,headers:{cookie,'content-type':'application/json'},body:JSON.stringify(test.body)});
 results.push({...test,status:r.status,response:await r.json()});
 fs.writeFileSync(`${out}/positive-controls.json`,JSON.stringify(results,null,2));
}
console.log(JSON.stringify(results.map(r=>({module:r.module,action:r.action,status:r.status}))));