import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
const out = 'reports/postrelease-review-20260926/tarea-3';
const load = p => JSON.parse(fs.readFileSync(p));
const inventory = load(`${out}/inventory.json`);
const results = load(`${out}/direct-requests.json`);
const variants = fs.existsSync(`${out}/variant-results.json`) ? load(`${out}/variant-results.json`) : [];
const variantPositive = fs.existsSync(`${out}/variant-positive.json`) ? load(`${out}/variant-positive.json`) : null;
const mapPath = 'artifacts/api-server/dist-owner-login-v9-20260926/index.mjs.map';
const map = load(mapPath);
const auth = load(`${out}/auth-me.json`);
assert.equal(results.length, 64);
assert.equal(new Set(results.map(r => r.cellId)).size, 64);
const unresolved = inventory.rows.filter(r => r.currentStatus === 'OPERATION_SEMANTICS_UNRESOLVED');
const consumers = unresolved.map(row => {
  const needle = new RegExp(`(?:requierePermiso|resolvePermiso|hasPermission|puede)\\([^)]*["']${row.module}["']\\s*,\\s*["']${row.action}["']`);
  const files = map.sources.filter((s, index) => needle.test(map.sourcesContent[index] ?? ''));
  return { id: row.id, literalConsumers: files,
    status: files.length ? 'NEEDS_OPERATION_REVIEW' : 'NO_LITERAL_ACTION_CONSUMER_FOUND_NOT_A_PASS',
    caveat: 'Static literal scan cannot exclude dynamic consumers and does not define business semantics.' };
});
fs.writeFileSync(`${out}/release-consumer-inventory.json`, JSON.stringify({
  sourceMap: mapPath,
  sha256: crypto.createHash('sha256').update(fs.readFileSync(mapPath)).digest('hex'),
  rows: consumers,
}, null, 2));
const rows = inventory.rows.map(row => {
  const result = results.find(r => r.cellId === row.id);
  const variant = variants.find(r => r.cellId === row.id);
  const variantClosed = Boolean(variant?.selectedGuard &&
    variant.changedTables.every(t => /auditor/.test(t)) &&
    variantPositive?.status >= 200 && variantPositive.status < 300);
  return { ...row, configuredPrerequisiteVariant: variant ? {
    state: variant.stateVariant, role: variant.auth.rol,
    actorId: variant.auth.id, selectedGuard: variant.selectedGuard,
    status: variant.status, positiveStatus: variantPositive?.status ?? null,
    selectedDirectClosed: variantClosed,
    caveat: 'Dedicated synthetic actor; ver=true, editar=false. Original actor remains outer-ver-blocked; not a change to original baseline role matrix.',
  } : null, freshApiResult: result ? {
    status: result.status ?? null, classification: result.classification,
    selectedGuard: result.selectedGuard === true,
    changedTables: result.changedTables ?? null,
    roleVerified: auth[row.role]?.rol === row.role,
    assignedSite: auth[row.role]?.ubicacion ?? null,
    queryScope: auth[row.role]?.alcanceConsulta ?? null,
    effectivePermission: auth[row.role]?.permisos?.find(p => p.modulo === row.module) ?? null,
  } : null,
  freshUiResult: null, freshClosure: false };
});
const directNew = rows.filter(r => r.pendingDirect && (r.freshApiResult?.selectedGuard || r.configuredPrerequisiteVariant?.selectedDirectClosed)).length;
fs.writeFileSync(`${out}/execution-ledger.json`, JSON.stringify({
  counts: { ...inventory.counts, authenticatedRequests: 63,
    exactGuardDenials: results.filter(r => r.selectedGuard).length,
    boundaryBlocked: results.filter(r => r.status && !r.selectedGuard).length,
    effectivePermissionDrift: results.filter(r => !r.status).length,
    configuredPrerequisiteVariantRequests: variants.length,
    newDirectClosures: directNew, newCombinedClosures: 0,
    pendingDirect: 381 - directNew, pendingCombined: 401 },
  rows,
}, null, 2));
console.log(JSON.stringify({ exact: results.filter(r => r.selectedGuard).length,
  newDirect: directNew, newCombined: 0, pendingDirect: 381 - directNew, pendingCombined: 401 }));