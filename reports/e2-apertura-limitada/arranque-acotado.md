# Preparación de arranque acotado E2

Estado: **preparado, no activado ni ejecutado**. No se reinició/arrancó la API, no
se construyó `dist`, no se consultó una base y no se cambió configuración ni
entorno.

La referencia informada del proceso existente (PID `60771`, bundle
`655cad5082301d1456184fac8206f317bc0c88e9a33afe4679f806a62e1010c2`) no se
tocó ni se usó como sustituto de la futura verificación de identidad/revisión.

## Activación explícita preparada

El modo sólo se selecciona con `API_STARTUP_MODE=EXPLICIT_LIMITED` y exige que
`API_LIMITED_STARTUP_APPROVAL` sea un objeto JSON exacto con:

- `mode: "EXPLICIT_LIMITED"` y `approved: true`;
- `route: "/api"` y `revision: "e2-limited-readonly-v2"`;
- identidad esperada `database.name`, `database.oid` e `identitySha256`. Este
  último usa el mismo material que el SQL coordinado:
  base, OID, rol, dirección/puerto y `server_version_num`;
- `guardState` exacto (`CLOSED` o `LIMITED`) y `sqlPlanFingerprints` exactos,
  coordinados con `sql/00-plan-digests.mjs`, en el orden
  `["59dd7352…88fd","982aa15d…b05","9e7e5b8d…2099"]`. El tercero vincula
  expresamente el cuerpo `prosrc` canónico de `auditoria_append_only`;
- verificaciones, en orden exacto:
  `["identity","schema","E1P01","E1A01","E1C01"]`.

No se incluyen valores de credenciales. Claves extra, ausencia, JSON inválido,
identidad distinta, revisión/ruta/verificaciones distintas o un modo desconocido
fallan cerrados antes de `listen`; no hay caída al arranque normal.
`API_INSPECTION_BOOT` permanece separado y ahora exige literalmente
`NODE_ENV=development`; un valor ausente, `false` o productivo no lo habilita.

## Objetos comprobados

El manifiesto de tablas no es una lista mínima manual: se deriva en runtime de
**todas** las tablas exportadas por el esquema Drizzle de `@workspace/db` y
comprueba cada columna declarada y su tipo de catálogo. Por ello incluye, entre
otras, `auditoria`, `salidas_dinero_caja`, `ubicaciones`, `proveedores`,
`sesiones_caja`, autenticación, catálogos, inventario, tickets y crédito. Una
tabla/columna/tipo ausente o distinto falla cerrado. Las tablas refund E2 no se
incluyen porque no están declaradas ni aplicadas mientras el flujo permanece
inactivo.

Además comprueba definiciones de constraints E1 de operación, movimiento, cobro
y atribución; índices de operación/movimiento/pago; el trigger append-only de
`auditoria`; las tres parejas trigger/función temporal cerradas:

- `zz_e1_cash_capture_closed` / `e1_guard_cash_capture_closed` (`E1C01`);
- `zz_e1_pending_receipts_closed` / `e1_guard_pending_receipts_closed` (`E1P01`);
- `zz_e1_historical_attribution_closed` /
  `e1_guard_historical_attribution_closed` (`E1A01`).

Las definiciones exactas y fingerprints esperados proceden de
`reports/e1-guardas-temporales-2026-09-18/sql/01-install-cash.sql`,
`02-install-pending.sql` y `03-install-attribution.sql`. Se exige trigger
habilitado, tabla y función exactas, SQLSTATE y mensaje cerrado; el caso de
efectivo conserva expresamente `INGRESO_FISICO` y `DEVOLUCION_FISICA`.

También compara el inventario canónico compartido por
`reports/e2-apertura-limitada/sql/contracts.mjs`: diez triggers E1
permanentes/temporales
de movimiento, reverso, contexto sesión/sitio/naturaleza, inmutabilidad, cobro y
atribución, más `auditoria_append_only`. Exige tabla, función, tipo/evento,
namespace OID resuelto, cero argumentos/atributos, ausencia de constraint,
parent/qual, estado habilitado, lenguaje, owner, retorno y ACL efectiva
de `PUBLIC` calculada con `aclexplode(...).grantee = 0` (no mediante
`has_function_privilege('public', ...)`). Las tres funciones temporales y la
función append-only de auditoría además se comparan por cuerpo exacto.

## Consultas y límites

El preflight obtiene una conexión dedicada, ejecuta `BEGIN TRANSACTION READ
ONLY`, y sólo lee identidad, `information_schema.columns`, `pg_constraint`,
`pg_indexes`, `pg_trigger`, `pg_class`, `pg_namespace`, `pg_proc` y
`pg_proc.prosrc` y `pg_get_function_result`. Hace `COMMIT` al aprobar o intenta `ROLLBACK` ante
excepción, y siempre libera la conexión.

También se auditó el grafo importado por `app.ts`: esta API usa sesiones propias
en `sesiones`; no importa `connect-pg-simple` ni configura
`pruneSessionInterval`/`createTableIfMissing`, y no invoca `ensure*` al importar.
Para convertir esa revisión en una barrera de orden, `app.ts` y sus rutas se
importan dinámicamente sólo después de terminar la transacción preflight y antes
de `listen`. No se desactiva middleware, permiso, ruta o guarda de aplicación.

El estado de arranque se vincula a las constantes reales de aplicación:
`CREDIT_CASH_INCOME_CAPTURE_ENABLED=true` exige modo/aprobación/guarda `LIMITED`;
con `false`, exige `CLOSED`. Si ingreso está activo no se admite arranque normal
ni inspection. Devolución, pendientes y atribución deben seguir siempre en
`false`; cualquier discrepancia falla antes de importar `app` o escuchar.

En este modo no se llaman inicializadores `ensure*`, lock de esquema, backfill de
compras, poller de stock ni otros jobs de escritura. Un fallo impide `listen`.
No se exigen tablas nuevas de devolución E2: siguen inactivas/no aplicadas y este
modo no constituye elusión de guardas ni autorización de DDL/DML.

Limitaciones: no hubo dry-run de servidor completo, consulta viva, escritura
aislada, validación de credenciales, build de bundle ni verificación de `dist`.
La activación/configuración y cualquier ejecución posterior requieren la
autorización operativa correspondiente.

## Validación offline enfocada

Se leyó `.local/skills/testing/SKILL.md`; no corresponde navegador/UI para estas
unidades de backend. Se hizo una sola pasada final enfocada con entorno vacío
(`env -i`, conservando sólo `PATH`, `HOME`, `NODE_ENV=test` y `NODE_OPTIONS`),
sin credenciales de DB/API. Un preload temporal en `/tmp` rechazó TCP externo y
los puertos 80, 443, 5432 y 8080; sólo permitió IPC/loopback efímero requerido
por el runner. Se eliminó al terminar.

Comando final:

```text
env -i PATH="$PATH" HOME="$HOME" NODE_ENV=test \
  NODE_OPTIONS="--require=/tmp/api-limited-offline-network-guard.cjs" \
  pnpm --filter @workspace/api-server exec tsx --test \
  src/lib/limited-startup-preflight.test.ts \
  src/lib/startup-mode.test.ts \
  src/lib/server-lifecycle.test.ts
```

Resultado terminal final tras el cierre del batch: `FOCUSED_TEST_EXIT=0`; 17 tests, 17 aprobados, 0
fallidos/cancelados/omitidos.

La primera invocación terminó `FOCUSED_TEST_EXIT=1`: detectó que el mutante
`listen-before-preflight` no estaba alterando el texto actualizado y que un
preload demasiado amplio interfería con sockets internos del runner. Se corrigió
la sustitución sobre la copia temporal y se acotó el bloqueo de red; no se tocó
fuente mediante workflow. Después se ejecutó únicamente la pasada enfocada final
anterior. No se lanzó bundle, `index/app` real, servidor, workflow, build ni
conexión a base.