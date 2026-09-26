// Offline inventory only: historical evidence is never a fresh pass.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../../..');
const source = 'reports/trabajo-nocturno-20260925/tarea-7/ledger.json';
const bytes = readFileSync(resolve(root, source));
const baseline = JSON.parse(bytes);
const bindings = {
  'entradas:editar': ['entradaPendienteCosto', '/entradas/pendientes-costo', 'Capturar costos', 'entrada con rollos sin costo', 'pages/entradas-pendientes-costo.tsx'],
  'salidas:editar': ['salidaExtraordinaria', '/salidas', 'Revertir', 'salida extraordinaria vigente', 'pages/salidas.tsx'],
  'salidas:autorizar': ['salida', '/salidas', 'Cancelar', 'salida cancelable', 'pages/salidas.tsx'],
  'etiquetas:editar': ['rollo', '/etiquetas', 'revisión de etiqueta', 'rollo elegible para revisión', 'pages/etiquetas.tsx'],
  'auditoria_inventario:editar': ['auditoria', '/inventario/auditorias', 'escanear', 'auditoría abierta, piso y participación válidos', 'pages/auditorias-inventario.tsx'],
  'auditoria_inventario:autorizar': ['auditoria', '/inventario/auditorias', 'Confirmar', 'auditoría elegible para cierre', 'pages/auditorias-inventario.tsx'],
  'clientes_finanzas:crear': ['cliente', '/clientes/:cliente', 'vista previa de abono legacy', 'puerta legacy natural; no forzar bandera', 'pages/clientes-detail.tsx'],
  'contenedores:editar': ['contenedor', '/contenedores/:contenedor', 'Editar', 'contenedor EN_TRANSITO', 'pages/contenedores/detail.tsx'],
  'contenedores:autorizar': ['contenedor', '/contenedores/:contenedor', 'Cancelar', 'contenedor EN_TRANSITO', 'pages/contenedores/detail.tsx'],
  'permisos:editar': [null, '/permisos', 'guardar permiso', 'fila existente; conservar matriz', 'pages/permisos.tsx'],
  'cobros_pagos:crear': ['ticket', '/cobros', 'Cobrar', 'ticket pendiente y caja abierta', 'pages/cobros.tsx'],
  'salidas_venta:crear': [null, '/pos', 'generar venta de salida', 'salida cliente elegible; verificar control real', 'pages/pos.tsx'],
  'camionetas:editar': ['camioneta', '/directorio/camionetas', 'Editar', 'camioneta existente', 'pages/directorio/camionetas.tsx'],
  'choferes:editar': ['chofer', '/directorio/choferes', 'Editar', 'chofer existente', 'pages/directorio/choferes.tsx'],
  'equipos:editar': ['equipo', '/equipos', 'Editar', 'equipo en sitio autorizado', 'pages/equipos.tsx'],
};
const rows = baseline.rows.map(c => {
  const unknown = c.pending === 'OWNER_SEMANTICS_REQUIRED';
  const binding = bindings[`${c.module}:${c.action}`];
  const request = c.historicalApi ?? c.hAttempt;
  if (c.pending && !unknown) assert(binding && request, `Missing binding ${c.id}`);
  return { ...c, freshApi: false, freshUi: false,
    execution: unknown ? 'OWNER_OPERATION_REQUIRED' : c.pending ? 'WAITING_DISPOSABLE_HANDOFF' : 'HISTORICAL_CLOSED_NOT_RETESTED',
    plan: c.pending && !unknown ? {
      method: request.method,
      urlTemplate: request.url.replace(/\/\d+(?=\/|$)/g, `/:${binding[0] ?? 'resource'}`),
      fixtureKey: binding[0], page: binding[1], controlCandidate: binding[2],
      eligibleState: binding[3], sourceCandidate: binding[4],
      exactGuardError: `No tienes permiso para '${c.action}' en el módulo '${c.module}'.`,
      assertions: ['authenticated /auth/me role', 'effective permissions captured', 'fresh eligible resource; no historical IDs', 'exact selected guard; outer 403/409 not closure', 'business fingerprint unchanged', 'allowed control eligible on same fixture', 'real control visible/hidden/disabled and screenshot', 'no gate/matrix changes'],
    } : null };
});
assert.equal(rows.length, 433);
assert.equal(new Set(rows.map(c => c.id)).size, rows.length);
for (const c of rows) assert.equal(c.id, `${c.role}:${c.module}:${c.action}`);
assert.equal(rows.filter(c => !c.directActionApi).length, 381);
assert.equal(rows.filter(c => !c.actionSpecificUiAndApi).length, 421);
assert.equal(rows.filter(c => c.execution === 'OWNER_OPERATION_REQUIRED').length, 357);
assert.equal(rows.filter(c => c.plan).length, 64);
const result = { source, sha256: createHash('sha256').update(bytes).digest('hex'),
  counts: { universe: 433, pendingApi: 381, pendingCombined: 421, unknownOwner: 357, executableMapped: 64, freshClosed: 0 }, rows };
writeFileSync(resolve(here, 'inventory.json'), JSON.stringify(result, null, 2) + '\n');
writeFileSync(resolve(here, 'owner-357.csv'), readFileSync(resolve(root, 'reports/trabajo-nocturno-20260925/tarea-7/owner-357.csv')));
console.log(JSON.stringify(result.counts));