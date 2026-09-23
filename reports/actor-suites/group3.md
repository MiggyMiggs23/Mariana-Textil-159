# Adaptación de suites con actores — propiedad asignada

## Alcance adaptado

Se adaptaron exclusivamente las nueve suites asignadas:

- `productos-purge.integration.test.ts`
- `proveedores-alcance-fechas.integration.test.ts`
- `reportes.integration.test.ts`
- `role-access-matrix.integration.test.ts`
- `security-api.test.ts`
- `store-sales-global.integration.test.ts`
- `task57.integration.test.ts`
- `task58.integration.test.ts`
- `viajes.integration.test.ts`

## Controles conservados

- El preflight síncrono compartido `actor-suite-preflight.mjs` exige la
  identidad firmada por el runner, `NODE_ENV=test`,
  `REQUIRE_ISOLATED_TEST_DATABASE=1`, `TEST_DATABASE_URL` y una URL de
  aplicación distinta antes de importar `@workspace/db` o la aplicación.
- Después del import dinámico de DB, cada suite usa
  `createTestDatabaseGuard`, comprueba `current_database()` y sólo después
  importa aplicación o módulos que escriben fixtures.
- Se conservaron los casos, roles, sesiones, HTTP in-process sobre loopback y
  aserciones de negocio existentes. No se agregaron skips.
- El cierre local se limita a servidores y pools. La evidencia y los actores
  permanecen en la base desechable; la destrucción integral del clúster por el
  runner es el teardown primario. No se elimina auditoría append-only.

## Verificación estática

La primera invocación con resolución normal del paquete leyó declaraciones
compiladas obsoletas; ese resultado no se considera diagnóstico fuente. La
verificación final usa el patrón source-only de E7: `configFilePath` absoluto,
`rootDir` en la raíz absoluta del workspace, `projectReferences: []`, `noEmit`
y `baseUrl` absoluto con ocho `paths` hacia fuentes de workspace. Resultado:
357 archivos raíz, **0 diagnósticos**, sin emitir ni ejecutar pruebas.

Una comparación AST contra `5aadfec` confirmó que se preservan todos los casos
nombrados: 58 en total entre las nueve rutas (incluidos los 49 escenarios del
harness de seguridad). No se quitaron casos. Además del armazón de
preflight/import/teardown, `reportes.integration.test.ts` actualiza una
expectativa obsoleta: comprueba la lista exacta vigente de mapas mensuales
(`mes-producto`, `mes-tela`, `mes-sitio`) y conserva las validaciones de
contenido y estructura de cada mapa. `security-api.test.ts` registra sus 49
escenarios como terminales `node:test` nativos, en el mismo orden, y relanza el
error original sin terminar anticipadamente el reporter. La fixture de venta
de `productos-purge.integration.test.ts` crea su propia entrada y proveedor
trazables antes de consumir el rollo, conforme al contrato vigente de
atribución a proveedor; sus aserciones no cambian.

La discrepancia **BLOCKED_POLICY** observada en tres contratos de defaults de
CAJA quedó resuelta contra la regla exacta de startup, no mediante overrides:
S-03 niega inventario, S-03AA niega resumen de caja sin override y S-26 niega
crédito de cliente. Aunque `ensureSalidasSchema` restaura grants legacy, la
producción ejecuta después `ensureCajaPermissions`, cuya regla documentada
repara el baseline heredado de CAJA y sólo concede lectura/creación de
`cobros_pagos`. La suite replica ahora ese orden; no agrega denegaciones por
usuario ni cambia las aserciones. El control de
lectura de ticket de SUPERVISOR usa un ticket existente propio para alcanzar el
gate (en lugar de confundir un 404 por ID inexistente con autorización). Las
NOTA de la fixture de viajes quedan en estado real `PENDIENTE`, mientras el
TICKET conserva `NO_APLICA`, conforme al constraint documental vigente.
Los casos positivos de alcance S-09B y S-23A no reutilizan el actor del
baseline: crean actores CAJA propios con grants explícitos únicamente de
`salidas.ver` e `inventario.ver`, respectivamente, para separar autorización
condicional de restricciones territoriales. S-26 conserva la comprobación
exacta de keys e incluye `saldoAFavor`, campo obligatorio del contrato OpenAPI;
además comprueba el valor real `0.00` del cliente nuevo.
El ajuste contable propio usado por S-26 para validar exportaciones declara la
evidencia E1 vigente (`sitioOrigenId`, naturaleza `CORRECCION_CONTABLE`,
`operacionClave` UUID y justificación). No usa ingreso/devolución física ni
intenta abrir los gates OFF de captura de efectivo.
La verificación XLSX de estado de cuenta de S-26 sigue el contrato público
actual del productor: C es la fecha de vencimiento (nula para un ajuste), D es
importe, E saldo corrido, y la fila resumen coloca saldo actual, saldo a favor
y saldo pendiente en F, G y J. Los formatos monetarios comprobados corresponden
a D, E y F de resumen. Queda un bloqueo de producción separado: el productor de
`clientes/cartera.xlsx` serializa `saldoAFavor` como número en C pero no asigna
el formato monetario que la aserción existente exige; no se debilita esa
aserción ni se modifica producción desde esta adaptación.

No se ejecutaron suites, SQL, bases, APIs, aplicaciones ni workflows.

## Reconciliación de manifiesto

Se conserva propiedad sobre las nueve rutas originales, incluido
`productos-purge.integration.test.ts`. La auditoría confirmó que
`salidas-api.test.ts` y `lib/salidas.test.ts` no son suites actor y deben quedar
fuera del manifiesto final; no se editaron para reemplazarlas ni ocultar el
total real de 28.

## Alineación puntual autorizada por MAIN: store-sales-global, task57 y task58

Tras los excerpts de MAIN de la corrida 06-07-57.854Z-a06b6834, se separaron
defectos de preparación de dos expectativas de política obsoletas:

- store-sales-global conserva todas las aserciones. El fixture ahora representa
  Ticket cobrado y Nota de crédito autorizada, con sus fechas de procesamiento
  Caja y ADMIN local autorizador. El contrato contabilizado usa cobrado_at /
  autorizado_at, no created_at (replit.md:942; historial 04760f5/9802116).
- task57: replit.md:296–300 e historial 6a5dffc permiten borrar un producto
  activo sin existencia ni historial, con credenciales ADMIN. MAIN autorizó
  cambiar el preflight esperado a true y sustituir el rechazo por inactividad
  por rechazos exactos de credenciales ausentes/incorrectas. Se comprueba ausencia
  de efectos de esos rechazos, borrado con credenciales válidas y auditoría única.
  El producto con referencias sigue bloqueado incluso con ADMIN válido, por el
  motivo actual de historial operativo, no por la antigua regex genérica.
  El actor conserva su rol y recibe un hash de contraseña local verificable.
  La purga de usuario inactivo y las garantías append-only permanecen.
- task58: replit.md:789/798–815 e historial 7f63d19 exigen decisión ADMIN
  posterior para sobrantes. Confirmar no traslada ni recibe ninguno: TODOS
  quedan RESOLUCION_MANUAL. MAIN autorizó sustituir la reubicación/APLICADA por
  comparación exacta antes/después de sitio, piso y estado, resolución manual
  para ambos sobrantes y ausencia de movimientos y cambios de existencias.
  Se preservan íntegros MAL_ACOMODADO y la protección de la carrera anterior.
  La memoria inventory-audit-concurrent-surplus complementa, no revoca, esa
  política conservadora.

Excepción explícita a cualquier afirmación anterior de AST/asserts idénticos:
task57/task58 contienen sustituciones y aserciones adicionales autorizadas de
contrato actual dentro de casos existentes; no son sólo ajustes de fixture.
Cero casos nuevos. No se tocaron producción, gates, las otras suites G3 ni G1
sellado. No se ejecutaron casos, SQL, API, DB, aplicaciones ni workflows.
Typecheck posterior full-source: 357 raíces, 0 diagnósticos, cero lib/dist
locales, noEmit, configuración absoluta y sin projectReferences. No es PASS runtime.