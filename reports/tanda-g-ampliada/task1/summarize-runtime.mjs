import fs from 'node:fs';
const dir='reports/tanda-g-ampliada/task1',runtime=dir+'/runtime';
const read=n=>JSON.parse(fs.readFileSync(runtime+'/'+n+'.json'));
const baseline=JSON.parse(fs.readFileSync('reports/tanda-f/tarea-4/followup/combined-cell-classification.json'));
const residual=baseline.filter(c=>!c.status.startsWith('DENIED'));
const api=['permissions-api','denials-api','denials2-api'].flatMap(read);
const browser=read('browser-results');
const controls=['positive-controls','positive-controls2'].flatMap(read);
const key=c=>`${c.role}:${c.module}:${c.action}`;
const records=residual.map(cell=>{
  const a=api.find(x=>key(x)===key(cell));
  const b=browser.find(x=>x.role===cell.role&&x.module===cell.module);
  const positive=a&&controls.find(x=>x.module===a.module&&x.action===a.action&&x.status>=200&&x.status<300);
  const direct=a?.status===403&&a.response.error===`No tienes permiso para '${cell.action}' en el módulo '${cell.module}'.`;
  const specificUi=['camionetas','choferes','equipos'].includes(cell.module)&&cell.action==='editar'&&b?.editVisible===false&&!b.error;
  const dual=direct&&specificUi&&!!positive;
  return {
    id:key(cell),role:cell.role,module:cell.module,action:cell.action,priorStatus:cell.status,
    status:dual?'DIRECT_API_AND_EDIT_UI_DENIAL_OBSERVED':direct?'DIRECT_API_DENIAL_UI_ACTION_INCOMPLETE':
      a?'OUTER_BOUNDARY_DENIAL_ONLY':cell.status==='NO_OPERATION_FOUND_STATIC'?'OWNER_SEMANTICS_REQUIRED':'LEGACY_GATE_NOT_ACTION_COVERAGE',
    directActionApiEvidence:!!direct,combinedActionCoverage:!!dual,
    denial:a?{method:a.method,url:a.url,status:a.status,response:a.response}:null,
    positiveControl:positive?{status:positive.status,method:positive.method,url:positive.url}:null,
    browser:b?{path:b.path,screenshot:b.screenshot,editVisible:b.editVisible,
      qualification:specificUi?'Edit control absent in real authenticated role browser; positive ADMIN/SISTEMAS dialogs separately clicked.':
        'Real page/module evidence only. Not a claim that each action control was tested in an eligible lifecycle state.'}:null,
    limitation:cell.module==='auditoria_inventario'&&cell.action==='autorizar'?
      'Real CLOSED audit supplied; confirmation positive control intentionally not applied to incomplete count. No speculative adjustment.':
      a?.response.code==='PERFIL_DENEGADO'?'E11 closed-world boundary, not inner guard isolation.':
      a&&!direct?'Outer permisos.ver rejected before editar; unchanged requested matrix and no writes verified.':undefined,
  };
});
const count=pred=>records.filter(pred).length;
const tableChecks=['permissions-state','denials-state','denials2-state','legacy-state'].map(n=>({evidence:n+'.json',...read(n)}));
if(tableChecks.some(x=>x.changedTables.length))throw Error('State difference requires explicit review');
if(new Set(records.map(x=>x.id)).size!==433)throw Error('Residual uniqueness changed');
const summary={
  originalResidualUniqueCells:433,
  operationDenialRequests:api.length,
  operationDeniedUniqueResidualCells:count(x=>x.denial),
  directActionGuardCoveredUniqueCells:count(x=>x.directActionApiEvidence),
  directActionGuardResidualUniqueCells:count(x=>!x.directActionApiEvidence),
  outerBoundaryOnlyUniqueCells:count(x=>x.status==='OUTER_BOUNDARY_DENIAL_ONLY'),
  strictCombinedApiAndActionUiCoveredUniqueCells:count(x=>x.combinedActionCoverage),
  strictCombinedResidualUniqueCells:count(x=>!x.combinedActionCoverage),
  ownerSemanticsRequiredUniqueCells:count(x=>x.status==='OWNER_SEMANTICS_REQUIRED'),
  legacyGateResidualUniqueCells:count(x=>x.status==='LEGACY_GATE_NOT_ACTION_COVERAGE'),
  rolesActuallyBrowsed:[...new Set(browser.map(x=>x.role))],
  uniqueRolePageObservations:browser.length,browserErrors:browser.filter(x=>x.error).length,
  actualCreateOrTabClicks:browser.filter(x=>x.actualButtonClicked).length,
  actualEditDialogClicks:browser.filter(x=>x.actualEditClicked).length,
  screenshots:fs.readdirSync(runtime).filter(n=>n.endsWith('.png')).length,
  successfulPositiveControlOperations:controls.filter(x=>x.status>=200&&x.status<300).length,
  legacyProbeRequests:read('legacy-api').length,
  legacyOutcome:'ADMIN and five natural roles receive E3 dedicated-capture 409; CONTADOR receives E11 403. Neither closes clientes_finanzas.crear.',
  tableChecks,
  bypassesDemonstrated:0,sourceFixes:0,matrixChanges:0,gatesChanged:0,
  environment:read('identity'),
  conclusion:'All seven roles browsed sequentially with real clicks/screenshots; 70 valid operation requests denied without business writes. Only 52 directly attribute the selected permission; 18 are outer boundaries. Strict action-specific UI+API closure is 12 cells, not 70 or 433. Remaining flags cannot be closed by arbitrary route 403s.',
  remainingWork:[
    'Owner semantics for 357 configured flags with no identified consuming operation; this is not a proof of impossible coverage.',
    'Six legacy capture flags remain behind released E3/E11 gates; no gate changes authorized.',
    'Eighteen valid-operation denials were intercepted by outer guards; no changes made to force inner coverage.',
    'Action-specific eligible-state UI coverage beyond catalog edits remains incomplete; page screenshots do not inflate those cells.'
  ],
};
fs.writeFileSync(dir+'/runtime-cell-classification.json',JSON.stringify(records,null,2)+'\n');
fs.writeFileSync(dir+'/runtime-summary.json',JSON.stringify(summary,null,2)+'\n');
console.log(JSON.stringify(summary,null,2));