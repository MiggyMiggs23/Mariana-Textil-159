import fs from 'node:fs';
import assert from 'node:assert/strict';
import pg from '../../../scripts/node_modules/pg/lib/index.js';

const dir = 'reports/tanda-h/permissions';
const read = name => JSON.parse(fs.readFileSync(`${dir}/${name}.json`, 'utf8'));
const requests = read('direct-requests'), controls = read('positive-controls'), browser = read('browser-results');
const cfg = JSON.parse(fs.readFileSync('.local/tanda-h/worker-databases.json')).permissions;
const db = new pg.Client({ connectionString: cfg.url });
await db.connect();
try {
  const persisted = (await db.query("select count(*)::int count,md5(coalesce(string_agg(h,'' order by h),'')) digest from (select md5(row_to_json(t)::text) h from permisos_rol t)s")).rows[0];
  assert.deepEqual(persisted, requests[0].before.permisos_rol);
  const matrices = read('matrices');
  const credentials = JSON.parse(fs.readFileSync('.local/tanda-h/credentials.json'));
  let checked = 0;
  for (const [role, matrix] of Object.entries(matrices)) {
    const login = await fetch('http://127.0.0.1:43873/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ usuario: credentials[role].username, password: credentials[role].password }), signal: AbortSignal.timeout(10000) });
    assert.equal(login.status, 200);
    const me = await fetch('http://127.0.0.1:43873/api/auth/me', { headers: { cookie: login.headers.get('set-cookie').split(';')[0] }, signal: AbortSignal.timeout(10000) });
    assert.equal(me.status, 200);
    const data = await me.json(), user = data.user ?? data;
    assert.equal(user.rol, matrix.role);
    assert.deepEqual(user.permisos, matrix.permissions);
    checked += matrix.permissions.length;
  }
  assert.equal(new Set(requests.map(r => r.cellId)).size, 24);
  assert.equal(new Set(requests.map(r => r.campaignCaseId)).size, 24);
  assert.equal(requests.filter(r => r.selectedActionGuardObserved).length, 0);
  assert(requests.every(r => r.changedTables.length === 0));
  const summary = { ...read('runtime-summary'), phase: 'COMPLETE_BLOCKED_SELECTED_GUARDS', effectivePermissionRowsRechecked: checked, rolesActuallyBrowsed: [...new Set(browser.map(r => r.role))], browserObservations: browser.length, browserErrors: browser.filter(r => r.error).length, actualEditDialogClicks: browser.filter(r => r.actualEditClicked && r.dialogVisible).length, newStrictCombinedCells: 0, elapsedPolicy: 'Bounded tranche; no gate forcing or indefinite route walk.', auditControlLimitation: 'Closed audit confirms lifecycle fixture only. No incomplete-count positive confirmation applied; edit positive omitted after audit closure.', permissionControlLimitation: 'No positive permission update: matrix writes prohibited even for unchanged requested values.', legacyControlLimitation: 'ADMIN valid customer/body receives dedicated-capture 409; no legacy success control exists under unchanged gates.' };
  fs.writeFileSync(`${dir}/runtime-summary.json`, JSON.stringify(summary, null, 2) + '\n');
  fs.writeFileSync(`${dir}/RESULTADO.txt`,
    'TANDA H — PERMISOS — CIERRE BLOQUEADO, NO BYPASS DEMOSTRADO\n\n' +
    'Identidad verificada: tanda_h_permissions / h_permissions / PostgreSQL 55444; API 43873; UI 43883. PID y hashes del build congelado comprobados. Siete roles naturales autenticados por HTTP y navegador contra la misma copia.\n\n' +
    'Prioridad de solicitudes directas completada: 24 celdas únicas y 24 requests autenticados con IDs de campaña nuevos. Resultado: 15 denegaciones E11 (14 celdas outer previas + CONTADOR clientes_finanzas.crear), cuatro denegaciones permisos.ver antes de editar, cinco 409 legacy. Ninguna alcanza el guard seleccionado. No se contabilizan como cobertura interior.\n\n' +
    'Saldo directo: 381 = 357 campos sin consumidor identificado + 18 outer + 6 legacy. Nuevas celdas directas/duales cerradas: 0. Los 357 campos exactos por rol, módulo, acción y nombre de campo están en owner-357.csv; preguntas en owner-questions.txt. No se inventa semántica.\n\n' +
    `${controls.filter(c => c.status >= 200 && c.status < 300).length} controles positivos ADMIN aceptados sobre fixtures reales: camionetas, choferes, equipos, contenedor editar/cancelar, etiquetas revisar, entrada costos, salida extraordinaria revertir, salida cancelar, generar venta y cobrar ticket. No son rutas ficticias. Audit confirmar queda sin positivo seguro: no se aplicó conteo incompleto; editar audit tampoco tiene positivo después del cierre. Actualización positiva de permisos omitida por prohibición de tocar matriz. Legacy ADMIN devuelve 409 y no es control positivo.\n\n` +
    'Cada denegación incluye fingerprint de todas las tablas públicas salvo sesiones antes/después: cero cambios, incluida matriz. Se revalidaron el fingerprint de permisos_rol y los permisos efectivos de /auth/me al final; no se asume que cada permiso efectivo tenga fila persistida. Los únicos cambios de negocio fueron fixtures y controles positivos autorizados en la copia aislada. Un intento de fixture rechazado INVALID_CLIENT se conserva en el ledger y se corrigió usando el cliente nativo aprobado del manifest; no se cuenta como test de permisos.\n\n' +
    `${browser.length} observaciones UI de siete roles, ${browser.filter(r => r.actualEditClicked && r.dialogVisible).length} diálogos reales de edición ADMIN/SISTEMAS, 0 errores finales. Capturas por observación. Las capturas/páginas o botones ocultos detrás de E11 no cierran el guard interior. No se guardaron cambios desde UI. El primer chequeo de sesión por APIRequestContext no conservó la sesión del navegador; se usó fetch same-origin dentro del navegador y se verificó rol en cada sesión; no se presenta aquel intento como evidencia.\n\n` +
    'Bloqueador de alcance: sin modificar gates, matriz o roles de negocio no hay evidencia nueva de alcanzar estos 24 guards seleccionados. No se autoriza desactivar E3/E11 ni permisos.ver para fabricar cobertura. No se tocó aplicación productiva, schema, fuente de producto o workflows. Sin bypass demostrado ni fix especulativo.\n');
  console.log(JSON.stringify({ complete: true, checkedPermissionRows: checked, remaining: 381, directRequests: 24, positiveControls: summary.successfulPositiveControls, browserObservations: browser.length }));
} finally { await db.end(); }