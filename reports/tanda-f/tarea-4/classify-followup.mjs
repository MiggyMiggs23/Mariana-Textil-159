import fs from 'node:fs';
const dir='reports/tanda-f/tarea-4';
const read=f=>JSON.parse(fs.readFileSync(`${dir}/${f}`,'utf8'));
const old=read('denied-action-coverage.json'), extra=read('followup/api-results.json');
const prior=read('api-results.json'), routes=read('endpoint-inventory.json').routes, citations=read('guard-citations.json');
const specifics={
 'entradas.editar':['BLOCKED_SYNTHETIC_FIXTURE','Cost/activation endpoints require pending-cost or inactive rolls; setup provides fully costed active rolls, not a valid pending-state fixture.'],
 'salidas.editar':['BLOCKED_SYNTHETIC_FIXTURE','Extraordinary-exit reversal requires an existing reversible extraordinary movement; setup manifest has only entry RECEPCION movements.'],
 'salidas.autorizar':['BLOCKED_SYNTHETIC_FIXTURE','Cancel route requires an existing cancellable salida; none is supplied in the synthetic setup manifest.'],
 'etiquetas.editar':['BLOCKED_SYNTHETIC_FIXTURE','Review requires ultimaReimpresionId matching a real immutable reprint; no synthetic reprint exists in setup manifest. Reprint creation was denied, not used as positive setup.'],
 'auditoria_inventario.editar':['BLOCKED_SYNTHETIC_FIXTURE','Scan/state transition needs a synthetic audit in the relevant lifecycle state; setup contains none.'],
 'auditoria_inventario.autorizar':['BLOCKED_SYNTHETIC_FIXTURE','Confirm/resolve/reactivation requires an audit/faltante decision fixture; setup contains none.'],
 'clientes_finanzas.crear':['BLOCKED_LEGACY_CAPTURE_GATE','Legacy payment and preview routes mount legacyPaymentCaptureGuard before the permission middleware. E3-released code redirects capture to caja_abonos/clientes_recapturas; those crear permissions were tested instead, not counted as this cell.'],
 'contenedores.editar':['BLOCKED_SYNTHETIC_FIXTURE','Requires an existing modifiable synthetic container; setup contains no container. Denied creation cannot supply one.'],
 'contenedores.autorizar':['BLOCKED_SYNTHETIC_FIXTURE','Requires an existing cancellable synthetic container; setup contains no container.'],
 'cobros_pagos.crear':['BLOCKED_SYNTHETIC_FIXTURE','Charge/authorize endpoints require a pending synthetic ticket with valid line/payment/authorization state; setup manifest has no ticket.'],
 'camionetas.editar':['BLOCKED_SYNTHETIC_FIXTURE','Dynamic requiereGestorCamionetas(editar) wraps a real endpoint, but no synthetic vehicle exists in setup manifest.'],
 'choferes.editar':['BLOCKED_SYNTHETIC_FIXTURE','Dynamic requiereGestorChoferes(editar) wraps a real endpoint, but no synthetic driver exists in setup manifest.'],
 'salidas_venta.crear':['BLOCKED_SYNTHETIC_FIXTURE','Generate-sale needs an eligible synthetic salida_venta source; none exists in setup manifest.'],
 'equipos.editar':['BLOCKED_SYNTHETIC_FIXTURE','Update/checklist needs an existing synthetic equipment record; none exists in setup manifest.'],
 'permisos.editar':['UNTESTED_SCOPE_RESTRICTION','Guarded endpoints exist, but testing configuration mutations was withheld under no matrix changes instruction; no permission rows were altered or positive fixtures created.'],
};
const noOperation={
 marcar_remate:'Only autorizar is consumed by POST mark; GET uses inventario.ver and DELETE also requires ADMIN.',
 dashboard:'Dashboard exposes read operations; no write action consumer found.',
 pos:'Ticket creation/cancel/price validation consume crear; search consumes ver; charging consumes cobros_pagos, not pos.editar/autorizar.',
 entradas:'Entry operations consume ver/crear/editar; no entradas.autorizar consumer found.',
 movimientos:'Movement/kardex endpoints consume ver; mutations use ajustes/entradas/salidas, not movimientos write actions.',
 etiquetas:'Labels consume ver/crear/editar; no autorizar consumer found.',
 inventario:'Reads consume ver; floor/stock-minimum editing consumes editar. Entry/adjustment decisions use other modules.',
 productos:'Catalog consumes ver/crear/editar; no productos.autorizar consumer found.',
 precios:'Price changes consume editar; listing consumes ver. No crear/autorizar consumer found.',
 ajustes:'Adjustment creation consumes crear and review/reversal consumes autorizar; no ver/editar consumer found.',
 clientes:'Client catalog consumes ver/crear/editar; financial authorization uses clientes_finanzas.',
 clientes_credito:'Credit terms expose ver and editar; no crear/autorizar consumer found.',
 clientes_precios:'Price lookup consumes ver; no write consumer found for this module.',
 clientes_finanzas:'Financial writers consume crear/autorizar; no editar consumer found.',
 caja_abonos:'E3 factory/context consumes crear only; receipt readers use ADMIN guard, not caja_abonos.ver.',
 clientes_recapturas:'E3 factory consumes crear only; receipt readers use ADMIN guard, not recapturas.ver.',
 proveedores:'Catalog consumes ver/crear/editar; adjustments use proveedores_finanzas.autorizar.',
 proveedores_finanzas:'Financial writers consume crear/autorizar; no editar consumer found.',
 ubicaciones:'Location CRUD consumes ver/crear/editar; no autorizar consumer found.',
 usuarios:'User CRUD consumes ver/crear/editar; no autorizar consumer found.',
 permisos:'Permission routes consume ver/editar; no crear/autorizar consumer found.',
 resumen_caja:'Summary endpoints consume ver; cash lifecycle uses cortes/cobros_pagos instead.',
 cortes:'Cash lifecycle consumes ver and crear; no editar/autorizar consumer found.',
 cobros_pagos:'Ticket/cash readers consume ver, charge/authorization consumes crear; no editar/autorizar consumer found.',
 reportes:'Report/export routes consume ver; no write consumer found.',
 conciliacion:'Read consumes ver and recalculate consumes autorizar; no crear/editar consumer found.',
 auditoria:'Audit readers consume ver; operational code writes events without consuming auditoria write flags.',
 camionetas:'Vehicle CRUD consumes ver/crear/editar via a wrapper; no autorizar consumer found.',
 choferes:'Driver CRUD consumes ver/crear/editar via a wrapper; no autorizar consumer found.',
 viajes:'Trips expose ver/crear; no editar/autorizar consumer found.',
 salidas_venta:'Pending sale reads consume ver and generation consumes crear; no editar/autorizar consumer found.',
 equipos:'Equipment CRUD consumes ver/crear/editar; no autorizar consumer found.',
};
const results=old.map(cell=>{
 const attempts=[...prior,...extra].filter(r=>r.role===cell.role&&r.module===cell.module&&r.action===cell.action);
 const endpoints=routes.filter(r=>r.guards.some(g=>g.module===cell.module&&g.action===cell.action)).map(r=>({method:r.method,path:r.endpoint,file:r.file,line:r.line}));
 const citation=citations.filter(c=>c.text.includes(`"${cell.module}"`)).map(({file,line})=>({file,line}));
 if(attempts.some(r=>r.denied))return {...cell,status:cell.role==='CONTADOR'?'DENIED_AT_E11_LEGACY_BOUNDARY':'DENIED_OBSERVED',
  attempts:attempts.length,denials:attempts.filter(r=>r.denied).length,endpoints,
  limitation:cell.role==='CONTADOR'?'Closed-world E11 legacy rejection; inner module guard not independently exercised.':'Outer module/role guards may reject before selected inner guard.',
  correctedInput:cell.module==='productos'&&cell.action==='editar'?'Original nombre field did not satisfy UpdateProductoBody; followup resent valid tela field and observed403.':undefined};
 const key=cell.module+'.'+cell.action;
 const [classification,reason]=specifics[key]??['NO_OPERATION_FOUND_STATIC',noOperation[cell.module]??'No matching action consumer identified; lexical discovery is not proof of impossibility.'];
 return {...cell,status:classification,reason,
  e11Boundary:cell.role==='CONTADOR'?'Additionally blocked from all legacy endpoints by E11 closed-world policy; no gate change allowed.':undefined,
  endpoints,citations:citation,
  qualification:classification==='NO_OPERATION_FOUND_STATIC'?'Configured false flag without a discovered consuming operation; not an API PASS and not proof that no dynamic endpoint exists.':
   classification==='BLOCKED_SYNTHETIC_FIXTURE'?'No positive setup writes made; restored non-synthetic records were not used as mutation targets. Could be tested in a future explicitly authorized fixture tranche.':undefined};
});
fs.writeFileSync(`${dir}/followup/combined-cell-classification.json`,JSON.stringify(results,null,2)+'\n');
const roles=['ADMIN','TERMINAL','CAJA','SUPERVISOR','BODEGA','SISTEMAS','CONTADOR'];
const counts=a=>a.reduce((m,r)=>(m[r.status]=(m[r.status]??0)+1,m),{});
const summary={originalRequests:prior.length,followupRequests:extra.length,retainedInterimFollowupRequests:read('followup/interim/api-results.json').length,
 combinedFinalRequests:prior.length+extra.length,combinedFinalWriteAttempts:[...prior,...extra].filter(r=>r.method!=='GET').length,
 cells:counts(results),roles:roles.map(role=>({role,...counts(results.filter(r=>r.role===role))})),
 boundaries:'All classifications remain partial evidence; no blanket PASS. Exact no-operation findings are static, not impossible endpoint proofs.'};
fs.writeFileSync(`${dir}/followup/combined-summary.json`,JSON.stringify(summary,null,2)+'\n');
console.log(JSON.stringify(summary,null,2));