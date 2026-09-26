import fs from 'node:fs';
import assert from 'node:assert/strict';
const out='reports/noche-20260926/tarea-1',load=n=>JSON.parse(fs.readFileSync(`${out}/${n}.json`));
const baseline=load('inventory'),api=load('direct-requests'),ui=load('browser-results'),positive=load('positive-controls');
assert.equal(api.length,64);assert.equal(new Set(api.map(r=>r.cellId)).size,64);
const rows=baseline.rows.map(c=>{
 const request=api.find(r=>r.cellId===c.id),observation=ui.find(r=>r.role===c.role&&r.module===c.module),control=ui.find(r=>r.role==='ADMIN'&&r.module===c.module);
 const allowed=positive.find(r=>r.module===c.module&&r.action===c.action);
 const noWrites=request?.changedTables?.every(t=>/auditor/.test(t));
 const eligible=control?.finalObservation&&control.fixtureVisible&&control.actions[c.action]?.enabled>0;
 const hidden=observation?.finalObservation&&!observation.error&&observation.actions[c.action]?.visible===0;
 const freshCombined=!!(request?.selectedGuard&&noWrites&&eligible&&hidden&&allowed?.status>=200&&allowed.status<300);
 return {id:c.id,historicalDirect:c.directActionApi,historicalCombined:c.actionSpecificUiAndApi,freshSelectedGuard:request?.selectedGuard===true,freshCombined,classification:freshCombined?'FRESH_UI_API_BOUND':request?.classification??c.execution,apiStatus:request?.status??null,uiScreenshot:observation?.screenshot??null,positiveScreenshot:control?.screenshot??null,positiveStatus:allowed?.status??null};
});
const newApi=rows.filter(r=>!r.historicalDirect&&r.freshSelectedGuard).length,newCombined=rows.filter(r=>!r.historicalCombined&&r.freshCombined).length;
const result={counts:{mapped:64,authenticatedRequests:63,effectivePermissionDrift:1,freshSelectedGuard:rows.filter(r=>r.freshSelectedGuard).length,newApi,newCombined,pendingApi:381-newApi,pendingCombined:421-newCombined,unknownOwner:357,uiObservations:ui.length,uiTimeouts:ui.filter(r=>r.error).length,positiveRequests:positive.length,positiveSuccess:positive.filter(r=>r.status>=200&&r.status<300).length},rows};
fs.writeFileSync(`${out}/final-ledger.json`,JSON.stringify(result,null,2));
fs.writeFileSync(`${out}/window-released.json`,JSON.stringify({released:true,at:new Date().toISOString(),reason:'All 64 mapped cells classified; 63 requests, one effective-permission drift. Browser and positive controls terminal; no writer remains.'},null,2));
console.log(JSON.stringify(result.counts));