import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';

const directory = 'reports/tanda-h/permissions';
const baselinePath = 'reports/tanda-g-ampliada/task1/runtime-cell-classification.json';
const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
const remaining = baseline.filter(cell => !cell.directActionApiEvidence);
const owner = remaining.filter(cell => cell.status === 'OWNER_SEMANTICS_REQUIRED');
const mapped = remaining.filter(cell => cell.status !== 'OWNER_SEMANTICS_REQUIRED');
assert.equal(new Set(baseline.map(cell => cell.id)).size, 433);
assert.equal(remaining.length, 381);
assert.equal(owner.length, 357);
assert.equal(mapped.length, 24);
assert.equal(mapped.filter(cell => cell.status === 'OUTER_BOUNDARY_DENIAL_ONLY').length, 18);
assert.equal(mapped.filter(cell => cell.status === 'LEGACY_GATE_NOT_ACTION_COVERAGE').length, 6);
const fields = { ver: 'puedeVer', crear: 'puedeCrear', editar: 'puedeEditar', autorizar: 'puedeAutorizar' };
const databaseFields = { ver: 'puede_ver', crear: 'puede_crear', editar: 'puede_editar', autorizar: 'puede_autorizar' };
const csv = rows => rows.map(row => row.map(value => `"${String(value ?? '').replaceAll('"', '""')}"`).join(',')).join('\n') + '\n';
const save = (name, value) => fs.writeFileSync(`${directory}/${name}.json`, JSON.stringify(value, null, 2) + '\n');
fs.writeFileSync(`${directory}/owner-357.csv`, csv([
  ['cell_id', 'role', 'module', 'action', 'api_permission_field', 'database_permission_field', 'status', 'owner_question'],
  ...owner.map(cell => [
    cell.id, cell.role, cell.module, cell.action, fields[cell.action], databaseFields[cell.action],
    'OWNER_SEMANTICS_REQUIRED',
    '¿Qué operación consume este campo para este rol? Indique ruta/método, control UI y estado elegible; o confirme explícitamente que no tiene consumidor.',
  ]),
]));
fs.writeFileSync(`${directory}/owner-questions.txt`,
  '357 campos pendientes: owner-357.csv contiene una fila por rol:módulo:acción; no se atribuye significado de negocio.\n' +
  '1. Para cada fila, ¿qué operación concreta debe consumir el campo? Indique método/ruta y control UI.\n' +
  '2. ¿Qué recurso y estado elegible permiten alcanzar esa operación con el rol natural indicado?\n' +
  '3. Si no existe consumidor, ¿confirma que el campo carece de operación o requiere especificación futura?\n' +
  '4. Para las 24 celdas mapeadas, ¿existe una ruta publicada que alcance el guard seleccionado sin cambiar E3/E11, permisos.ver ni la matriz? Indique evidencia, no desactive gates.\n');
save('mapped-24-plan', mapped.map(cell => ({
  cellId: cell.id,
  campaignCaseId: `tanda-h:permissions:${cell.id}`,
  role: cell.role,
  module: cell.module,
  action: cell.action,
  carriedStatus: cell.status,
  priorDenial: cell.denial,
  priorLimitation: cell.limitation ?? null,
  plannedStatus: 'PENDING_HANDOFF_NOT_EXECUTED',
  requirements: [
    'Authenticate the natural role against the dedicated permissions API and record /auth/me permissions.',
    'Use a new valid fixture in an eligible state; do not replay prior campaign resource IDs.',
    'Record exact selected-action denial; unrelated outer 403 or legacy 409 remains blocked.',
    'Run allowed-role positive control on a valid equivalent fixture; never count arbitrary-route 403.',
    'Compare business-state fingerprints around denials and preserve matrix/gates unchanged.',
  ],
})));
save('preparation', {
  phase: 'PREPARED_AWAITING_MAIN_HANDOFF',
  baselinePath,
  baselineSha256: crypto.createHash('sha256').update(fs.readFileSync(baselinePath)).digest('hex'),
  baselineResidual: 381,
  ownerSemanticsRequired: 357,
  mappedResidual: 24,
  outerBoundaryOnly: 18,
  legacyGateOnly: 6,
  priorDirectCovered: 52,
  newlyCovered: 0,
  actualRequests: 0,
  actualBrowsers: 0,
  baselineRoles: [...new Set(baseline.map(cell => cell.role))],
  requiredNaturalRoles: ['ADMIN', 'TERMINAL', 'CAJA', 'SUPERVISOR', 'BODEGA', 'SISTEMAS', 'CONTADOR'],
  requestedPortsNotYetVerified: { database: 55444, api: 43873, ui: 43883 },
  requiredHandoff: [
    'reports/tanda-h/setup handoff with frozen source/build hashes and baseline identity',
    'Private seven-role credentials path/key mapping; never copy credentials into reports',
    'Private permissions-only database connection and verified database/actor/cluster identity',
    'MAIN-started API PID/port and matching UI proxy binding to the same permissions snapshot',
    'Approved fixture manifest and lifecycle states; no application DB/schema/matrix/gate changes',
  ],
  executionPolicy: 'MAIN starts servers. Twelve-minute bounded tranche begins only after verified handoff. Stop unreachable selected guards as blockers. No coverage credit for repeated historical cells.',
});
console.log(JSON.stringify({ prepared: true, ownerRows: owner.length, mappedRows: mapped.length, actualRequests: 0 }));