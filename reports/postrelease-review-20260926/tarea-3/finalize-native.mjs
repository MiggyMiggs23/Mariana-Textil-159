import fs from 'node:fs';
import assert from 'node:assert/strict';
const out = 'reports/postrelease-review-20260926/tarea-3';
const load = name => JSON.parse(fs.readFileSync(`${out}/${name}`));
const execution = load('execution-ledger.json');
const api = load('direct-requests.json');
const auditNegatives = load('audit-access-floor-negatives.json');
const positives = load('native-positive-journal.json');
const baseUi = load('native-ui-1790418031511/result.json');
const saleUi = load('native-ui-1790418525549/result.json');
const saleDeniedUi = load('native-ui-1790418373171/result.json');
const targeted = [
  ...load('native-targeted-1790419397346/result.json').cells,
  ...load('native-targeted-1790419485965/result.json').cells,
  ...load('native-targeted-1790419570429/result.json').cells,
];
const screenshot = (cell, folder) => {
  const file = cell.file ?? `${out}/${folder}/${cell.role}-${cell.id.split(':').slice(1).join('-')}.png`;
  assert(fs.existsSync(file), file); return file;
};
const bindings = [
  ...['TERMINAL','CAJA'].map(role => ({ role, module: 'auditoria_inventario', action: 'editar',
    op: 'audit-scan', fixture: 1, positive: 'positive-auditoria_inventario:editar-access-floor' })),
  ...['TERMINAL','SUPERVISOR','BODEGA','SISTEMAS'].map(role => ({ role, module: 'cobros_pagos', action: 'crear',
    op: 'ticket1-collect', fixture: 1, positive: 'positive-cobros_pagos:crear' })),
  { role: 'CAJA', module: 'salidas', action: 'autorizar', op: 'salida1-cancel', fixture: 1, positive: 'positive-salidas:autorizar' },
  ...['TERMINAL','CAJA','SUPERVISOR','BODEGA','SISTEMAS'].map(role => ({ role, module: 'salidas_venta', action: 'crear',
    fixture: 2, positive: 'positive-salidas_venta:crear' })),
];
const combined = bindings.map(binding => {
  const id = `${binding.role}:${binding.module}:${binding.action}`;
  const baseline = execution.rows.find(r => r.id === id);
  assert(baseline.pendingCombined, id);
  const positive = positives.find(r => r.key === binding.positive);
  assert(positive?.status >= 200 && positive.status < 300, binding.positive);
  const allowedTerminal = binding.module === 'salidas_venta' && binding.role === 'TERMINAL';
  const deniedApi = binding.module === 'auditoria_inventario'
    ? auditNegatives.find(r => r.cellId === id)
    : api.find(r => r.cellId === id);
  if (!allowedTerminal) {
    assert(deniedApi?.selectedGuard, id);
    assert(deniedApi.unchanged || deniedApi.changedTables.every(t => /auditor/.test(t)));
    assert.deepEqual(deniedApi.body, positive.body, `${id} matching valid request body`);
  }
  let deniedUi, allowedUi, deniedFolder, allowedFolder;
  if (binding.op) {
    deniedUi = targeted.filter(r => r.role === binding.role && r.operation === binding.op).at(-1);
    allowedUi = targeted.filter(r => r.role === 'ADMIN' && r.operation === binding.op).at(-1);
    assert.equal(deniedUi?.fixture, binding.fixture);
    assert.equal(allowedUi?.fixture, binding.fixture);
  } else {
    allowedUi = saleUi.cells.find(r => r.role === 'TERMINAL');
    allowedFolder = 'native-ui-1790418525549';
    deniedUi = allowedTerminal ? allowedUi : saleDeniedUi.cells.find(r => r.id === id) ?? baseUi.cells.find(r => r.id === id);
    deniedFolder = allowedTerminal ? allowedFolder
      : saleDeniedUi.cells.includes(deniedUi) ? 'native-ui-1790418373171' : 'native-ui-1790418031511';
    assert.equal(deniedUi?.fixtureId, binding.fixture);
    assert.equal(allowedUi?.fixtureId, binding.fixture);
    assert.deepEqual(allowedUi.selectedOutputIds, [2], 'Only exact native salida2 selected');
  }
  assert.equal(allowedUi.control.visible, true);
  assert.equal(allowedUi.control.enabled, true);
  if (!allowedTerminal) assert.equal(deniedUi.control.visible, false);
  return { id, classification: allowedTerminal ? 'EFFECTIVE_ALLOWED_UI_AND_API_SUCCESS'
    : 'EXACT_API_ACTION_DENIAL_PLUS_NATIVE_UI_ACCESS_DENIAL',
    uiDenialBoundary: allowedTerminal ? null : deniedUi.boundary ?? deniedUi.businessBoundaryText ?? [],
    uiEvidence: screenshot(deniedUi, deniedFolder), eligiblePositiveUiEvidence: screenshot(allowedUi, allowedFolder),
    positiveRole: positive.role, positiveApiStatus: positive.status,
    positivePath: positive.path, positiveBody: positive.body, fixtureId: binding.fixture,
    caveat: allowedTerminal ? 'Original role permission drift resolved as actual allowed operation, not denied.'
      : 'UI may deny at ancestor view guard; API evidence independently reaches selected action guard. Not proof UI action flag alone caused hiding.' };
});
const rows = execution.rows.map(row => {
  const fresh = combined.find(c => c.id === row.id);
  return { ...row, freshUiResult: fresh ?? null, freshClosure: Boolean(fresh),
    pendingDirectFinal: row.pendingDirect && !row.configuredPrerequisiteVariant?.selectedDirectClosed,
    pendingCombinedFinal: row.pendingCombined && !fresh,
  };
});
const counts = {
  universe: rows.length,
  newDirectClosures: rows.filter(r => r.pendingDirect && !r.pendingDirectFinal).length,
  newCombinedClosures: combined.length,
  pendingDirect: rows.filter(r => r.pendingDirectFinal).length,
  pendingCombined: rows.filter(r => r.pendingCombinedFinal).length,
  positiveApiSuccesses: positives.filter(r => r.key.startsWith('positive-') && r.status >= 200 && r.status < 300).length,
  positiveApiBusinessStateRejections: positives.filter(r => r.key.startsWith('positive-') && r.status === 400).length,
};
assert.equal(counts.newDirectClosures, 4);
assert.equal(counts.newCombinedClosures, 12);
assert.equal(counts.pendingDirect, 377);
assert.equal(counts.pendingCombined, 389);
fs.writeFileSync(`${out}/final-ledger.json`, JSON.stringify({ counts, combinedEvidence: combined, rows }, null, 2));
fs.writeFileSync(`${out}/remaining-exact-cells.json`, JSON.stringify(rows.filter(r => r.pendingDirectFinal || r.pendingCombinedFinal).map(r => ({
  id: r.id, pendingDirect: r.pendingDirectFinal, pendingCombined: r.pendingCombinedFinal,
  blocker: r.currentStatus === 'OPERATION_SEMANTICS_UNRESOLVED'
    ? r.module === 'caja_abonos' && r.action === 'ver' ? 'DYNAMIC_OR_PROFILE_BOUNDARY_NOT_EXCLUSIVE_ACTION'
      : 'BUSINESS_OPERATION_DEFINITION_UNRESOLVED_NOT_PASS'
    : r.configuredPrerequisiteVariant?.selectedDirectClosed ? 'CONFIGURED_VARIANT_DIRECT_CLOSED_UI_NOT_PROVEN'
    : r.priorClassification === 'OUTER_E11' ? 'E11_BOUNDARY_NOT_SELECTED_GUARD'
    : r.module === 'auditoria_inventario' && r.action === 'autorizar' ? 'AUDIT_ABIERTA_NOT_CONFIRM_ELIGIBLE'
    : r.module === 'salidas' && r.action === 'editar' ? 'NO_RELEASED_ADMIN_REVERTIR_UI_COUNTERPART'
    : 'LEGACY_OR_OUTER_BOUNDARY_OR_MISSING_MATCHED_UI',
})), null, 2));
console.log(JSON.stringify(counts));