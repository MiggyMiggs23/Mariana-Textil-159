// Reconciles historical evidence; never contacts an API, browser or database.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../../..');
const load = path => JSON.parse(readFileSync(resolve(root, path), 'utf8'));
const baselinePath = 'reports/tanda-g-ampliada/task1/runtime-cell-classification.json';
const hPath = 'reports/tanda-h/permissions/direct-requests.json';
const baseline = load(baselinePath);
const trancheH = load(hPath);
const actions = new Set(['ver', 'crear', 'editar', 'autorizar']);
const statuses = new Set(['OWNER_SEMANTICS_REQUIRED', 'OUTER_BOUNDARY_DENIAL_ONLY', 'LEGACY_GATE_NOT_ACTION_COVERAGE']);

function reconcile(cells, requests) {
  assert.equal(new Set(cells.map(c => c.id)).size, cells.length, 'IDs de matriz duplicados');
  assert.equal(new Set(requests.map(r => r.cellId)).size, requests.length, 'Requests duplicados');
  const byId = new Map(cells.map(c => [c.id, c]));
  const attempts = new Map();
  for (const r of requests) {
    const cell = byId.get(r.cellId);
    assert(cell, `Request sin celda: ${r.cellId}`);
    assert.equal(r.role, cell.role);
    assert.equal(r.module, cell.module);
    assert.equal(r.action, cell.action);
    assert.equal(r.selectedActionGuardObserved, false, `Nuevo guard seleccionado: revisar ${r.cellId}`);
    assert.equal(r.changedTables.filter(t => !/auditor/i.test(t)).length, 0, `Escritura de negocio: ${r.cellId}`);
    assert(r.status === 403 || r.status === 409, `Respuesta no denegada: ${r.cellId}`);
    attempts.set(r.cellId, r);
  }
  const rows = cells.map(c => {
    assert(actions.has(c.action), `Acción desconocida: ${c.id}`);
    assert.equal(c.id, `${c.role}:${c.module}:${c.action}`);
    if (!c.directActionApiEvidence) assert(statuses.has(c.status), `Estado desconocido: ${c.id}`);
    if (c.combinedActionCoverage) assert(c.directActionApiEvidence, `UI+API sin guard: ${c.id}`);
    const r = attempts.get(c.id);
    if (r) assert(!c.directActionApiEvidence, `Intento H sobre celda ya cerrada: ${c.id}`);
    return {
      id: c.id, role: c.role, module: c.module, action: c.action,
      directActionApi: c.directActionApiEvidence,
      actionSpecificUiAndApi: c.combinedActionCoverage,
      pending: !c.directActionApiEvidence ? c.status : c.combinedActionCoverage ? null : 'UI_ACTION_PENDING',
      historicalApi: c.denial ? { method: c.denial.method, url: c.denial.url, status: c.denial.status } : null,
      historicalUi: c.browser ? { path: c.browser.path, screenshot: c.browser.screenshot ?? null } : null,
      hAttempt: r ? { campaignCaseId: r.campaignCaseId, method: r.method, url: r.url, status: r.status, classification: r.classification } : null,
    };
  });
  const direct = rows.filter(r => r.directActionApi).length;
  const combined = rows.filter(r => r.actionSpecificUiAndApi).length;
  const owner = rows.filter(r => r.pending === 'OWNER_SEMANTICS_REQUIRED');
  const blocked = rows.filter(r => r.pending === 'OUTER_BOUNDARY_DENIAL_ONLY' || r.pending === 'LEGACY_GATE_NOT_ACTION_COVERAGE');
  const ui = rows.filter(r => r.directActionApi && !r.actionSpecificUiAndApi);
  assert.equal(rows.length, direct + owner.length + blocked.length);
  assert.equal(rows.length, combined + ui.length + owner.length + blocked.length);
  assert.equal(requests.length, attempts.size);
  return { rows, counts: {
    uniqueCells: rows.length, historicalDirect: direct, pendingDirect: rows.length - direct,
    historicalCombined: combined, pendingCombined: rows.length - combined,
    uiMissingWithDirectApi: ui.length, ownerUnknown: owner.length,
    outerOnly: blocked.filter(r => r.pending === 'OUTER_BOUNDARY_DENIAL_ONLY').length,
    legacyOnly: blocked.filter(r => r.pending === 'LEGACY_GATE_NOT_ACTION_COVERAGE').length,
    authenticatedHistoricalHAttempts: requests.length, newlyClosedByH: 0,
  } };
}

const real = reconcile(baseline, trancheH);
assert.deepEqual(real.counts, {
  uniqueCells: 433, historicalDirect: 52, pendingDirect: 381,
  historicalCombined: 12, pendingCombined: 421, uiMissingWithDirectApi: 40,
  ownerUnknown: 357, outerOnly: 18, legacyOnly: 6,
  authenticatedHistoricalHAttempts: 24, newlyClosedByH: 0,
});

// Introduced-defect controls: the same auditor must reject a fabricated
// selected guard, a denied request with a write, and a UI closure without API.
let defectsCaught = 0;
const mustReject = fn => { assert.throws(fn); defectsCaught++; };
const mutateRequest = changes => trancheH.map((r, i) => i ? r : { ...r, ...changes });
mustReject(() => reconcile(baseline, mutateRequest({ selectedActionGuardObserved: true })));
mustReject(() => reconcile(baseline, mutateRequest({ changedTables: ['tickets'] })));
mustReject(() => reconcile(baseline.map((c, i) => i ? c : { ...c, combinedActionCoverage: true }), trancheH));
mustReject(() => reconcile(baseline, mutateRequest({ status: 200 })));
mustReject(() => reconcile(baseline, [...trancheH, trancheH[0]]));
assert.equal(defectsCaught, 5);

const csv = values => values.map(row => row.map(v => `"${String(v ?? '').replaceAll('"', '""')}"`).join(',')).join('\n') + '\n';
writeFileSync(resolve(here, 'ledger.json'), JSON.stringify({ sources: [baselinePath, hPath], ...real, introducedDefectsCaught: defectsCaught }, null, 2) + '\n');
writeFileSync(resolve(here, 'owner-357.csv'), csv([
  ['cell_id', 'role', 'module', 'action', 'permission_api_field', 'question_for_owner'],
  ...real.rows.filter(r => r.pending === 'OWNER_SEMANTICS_REQUIRED').map(r => [
    r.id, r.role, r.module, r.action, { ver: 'puedeVer', crear: 'puedeCrear', editar: 'puedeEditar', autorizar: 'puedeAutorizar' }[r.action],
    '¿Qué método/ruta y botón real consumen este campo, o confirma que no tiene operación?',
  ]),
]));
console.log(JSON.stringify({ ...real.counts, introducedDefectsCaught: defectsCaught }));