// Offline reconciliation only. This program cannot contact a database or API.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../../..');
const source = 'reports/noche-20260926/tarea-1';
const read = name => JSON.parse(fs.readFileSync(resolve(root, source, name)));
const inventory = read('inventory.json');
const previous = read('final-ledger.json');
const requests = read('direct-requests.json');
assert.equal(inventory.rows.length, 433);
assert.equal(new Set(previous.rows.map(row => row.id)).size, 433);
const rows = inventory.rows.map(cell => {
  const last = previous.rows.find(row => row.id === cell.id);
  assert(last, cell.id);
  const request = requests.find(row => row.cellId === cell.id);
  const directClosed = last.historicalDirect || last.freshSelectedGuard;
  const combinedClosed = last.historicalCombined || last.freshCombined;
  return {
    id: cell.id, role: cell.role, module: cell.module, action: cell.action,
    historicalDirectClosed: directClosed, historicalCombinedClosed: combinedClosed,
    pendingDirect: !directClosed, pendingCombined: !combinedClosed,
    priorClassification: last.classification,
    priorApiStatus: last.apiStatus,
    priorResponse: request?.response ?? null,
    operationBinding: cell.plan,
    currentStatus: cell.execution === 'OWNER_OPERATION_REQUIRED'
      ? 'OPERATION_SEMANTICS_UNRESOLVED'
      : combinedClosed ? 'HISTORICAL_CLOSED_NOT_RETESTED' : 'WAITING_NEW_DISPOSABLE_HANDOFF',
    freshApiResult: null, freshUiResult: null, freshClosure: false,
  };
});
const counts = {
  total: rows.length,
  historicalDirectClosed: rows.filter(r => r.historicalDirectClosed).length,
  historicalCombinedClosed: rows.filter(r => r.historicalCombinedClosed).length,
  pendingDirect: rows.filter(r => r.pendingDirect).length,
  pendingCombined: rows.filter(r => r.pendingCombined).length,
  unresolvedOperations: rows.filter(r => r.currentStatus === 'OPERATION_SEMANTICS_UNRESOLVED').length,
  mappedPendingDirect: rows.filter(r => r.operationBinding && r.pendingDirect).length,
  mappedPendingCombined: rows.filter(r => r.operationBinding && r.pendingCombined).length,
  newRequests: 0, newClosures: 0,
};
assert.equal(counts.pendingDirect, 381);
assert.equal(counts.pendingCombined, 401);
assert.equal(counts.unresolvedOperations, 357);
const evidence = ['inventory.json', 'final-ledger.json', 'direct-requests.json'].map(name => ({
  path: `${source}/${name}`,
  sha256: crypto.createHash('sha256').update(fs.readFileSync(resolve(root, source, name))).digest('hex'),
}));
fs.writeFileSync(resolve(here, 'inventory.json'), JSON.stringify({
  authoritativePermissionSource: source,
  requestedHistoricalPath: 'reports/noche-20260926/tarea-3',
  pathCorrection: 'Historical tarea-3 is monetary browser coverage, not the permission matrix.',
  evidence, counts, rows,
}, null, 2) + '\n');
console.log(JSON.stringify(counts));