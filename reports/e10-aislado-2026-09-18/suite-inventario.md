# E10 — inventario de suites seguras y bloqueadas

Fecha: 2026-09-18. Alcance: inspección estática y pruebas sin base de datos. No se
abrió conexión, no se creó usuario/sesión, no se ejecutó seed ni integración.

## Manifiestos positivos y comandos

### Backend sin DB

Comando del lote protegido actual (pendiente de ejecución por el agente padre):

```sh
node scripts/src/e10-safe-suite.mjs --current
```

Manifiesto exacto: `scripts/src/e10-backend-safe.txt` (subconjunto seguro
explícito de 6 archivos, no la suite backend completa):

```text
src/lib/credit-evidence-contract.test.ts
src/lib/credit-evidence.mock.test.ts
src/lib/credit-evidence-read.test.ts
src/routes/e1-customer-mutations.offline.test.ts
src/e10-generic-readers-privacy.contract.test.ts
../../lib/api-spec/e1-contract.test.ts
```

El manifiesto E1 anterior se conserva sin cambios en
`scripts/src/e1-backend-safe.txt` (5 archivos; los mismos salvo la nueva prueba
E10). No hay descubrimiento implícito.

### Frontend sin DB

Comando canónico:

```sh
node scripts/src/frontend-test-runner.mjs
```

Manifiesto exacto y autoritativo:
`artifacts/mariana-textil/test-manifests/safe.txt` (100 entradas explícitas).
El runner E10 consume ese archivo, exige que no esté vacío y usa el preload de
red; no agrega Vitest, navegador ni integración por descubrimiento.

### Scripts sin DB

Manifiesto exacto `scripts/src/e10-scripts-safe.txt`:

```text
scripts/src/offline-static-fixture-selfcheck.cjs
scripts/src/offline-test-guard-selfcheck.cjs
```

Los tres grupos (backend, frontend y scripts) se ejecutan en serie por
`scripts/src/e10-safe-suite.mjs`, con
`DATABASE_URL=postgresql://e10-offline.invalid:9/forbidden`, preload
`scripts/src/offline-test-guard.cjs`, manifiestos no vacíos y digest de todos
los fuentes antes/después. Una escritura en fuentes hace fallar el comando.

### Baseline HEAD separado

```sh
node scripts/src/e10-safe-suite.mjs --baseline
```

Este modo crea un árbol temporal exclusivamente desde `git archive HEAD`, no
usa el árbol actual, rechaza `.env`, `.env.*`, `.local` y nombres `*secret*`,
enlaza únicamente las dependencias ya instaladas, usa el manifiesto E1 de HEAD
y elimina el temporal al terminar. No instala paquetes.

## Suites bloqueadas por la restricción absoluta

`pnpm test:isolated` **no es segura para E10 y no se ejecutó**. Su entrada
`lib/db/src/run-isolated-tests.mjs` exige `DATABASE_URL`,
`ADMIN_SEED_PASSWORD`, prepara una base PostgreSQL local y llama al seed
canónico; por tanto contradice las prohibiciones de conexión y creación de
actores/sesiones. Sus suites revisadas
`api-script:test:ticket-iva-schema` y
`api-script:test:admin-realtime-reconciliation`, además de `prepare-smoke`,
quedan bloqueadas aquí. No se informa ningún pase.

También quedan bloqueados:

- todos los scripts de `artifacts/api-server/package.json` que declaran
  `TEST_DATABASE_URL`, `REQUIRE_ISOLATED_TEST_DATABASE=1`, o cuyo nombre acaba
  en `integration`;
- pruebas API que arrancan servidor o crean cookies/sesiones/usuarios, entre
  ellas `auditoria.integration.test.ts`,
  `lib/notificaciones-credito.test.ts`, `security-api.test.ts`,
  `admin-invariants.integration.test.ts`, `admin-alertas.integration.test.ts`,
  `admin-analytics.integration.test.ts` y las restantes integraciones;
- `lib/db/src/prepare-test-database.test.mjs` y cualquier prueba de migración,
  schema o seed que ejecute SQL;
- scripts `verify:*readonly`: aunque nominalmente sean de lectura, abren una
  conexión y no están autorizados en esta tarea;
- pruebas browser/PDF/render que no estén en el manifiesto frontend seguro.

Una prueba `.test.ts` sin la palabra `integration` no se presume segura: queda
fuera hasta revisión explícita. Esto evita convertir ausencia de ejecución en
un pase.

## Superficie de privacidad encontrada

1. `/auditoria`, `/auditoria/:id` y `/auditoria/export.xlsx` estaban protegidos
   por el permiso configurable `auditoria.ver`; un SUPERVISOR o CONTADOR podía
   recibir filas Fondo si se le otorgaba ese permiso. El conteo de ventana,
   paginación, búsqueda y XLSX nacían del mismo lector sin exclusión.
2. `notificaciones_sistema` permitía a no-ADMIN leer una notificación Fondo
   dirigida personalmente; ADMIN además veía globales. Feed, listado, badge,
   “leer todas” y “leer una” compartían esa fuga potencial.
3. No se encontró enumeración dinámica de tablas en reportes genéricos ni en
   `report-export.ts`; sus hojas se construyen desde secciones comerciales
   explícitas. No se cambió esa ruta.

La corrección filtra en SQL antes de conteo, límite, proyección, enlaces y
mutaciones. Auditoría permite el dato sólo cuando el rol real de sesión es
exactamente `ADMIN`, independientemente de permisos configurados. Las
notificaciones genéricas excluyen Fondo incluso para ADMIN: Fondo no posee
canal global y sus endpoints propios pertenecen al worker backend.

## Prueba E10 ejecutada y mutantes requeridos

Se ejecutó únicamente:

```sh
node --require ./scripts/src/offline-test-guard.cjs \
  --import /home/runner/workspace/node_modules/.pnpm/tsx@4.23.1/node_modules/tsx/dist/loader.mjs \
  --test artifacts/api-server/src/e10-generic-readers-privacy.contract.test.ts
```

Resultado real final: 4/4 pasan, 0 fallos, duración Node 1,227.050 ms. Incluye
compilación real del fragmento Drizzle con `PgDialect.sqlToQuery`: la consulta
resultante usa `LEFT(upper(a.accion), 6) = 'FONDO_'`, no contiene
`LIKE`/`ESCAPE`, no tiene parámetros y conserva un registro ordinario de Caja
con `datosDespues.fondoInicial`. No usa DB, servidor, usuario ni sesión.

Instrucciones de mutación (en copia aislada de fuentes, una por vez):

1. En `lib/auditoria.ts`, quitar `nonFondoAuditSql()` de `whereSql` o moverlo
   después del `LIMIT`. Debe fallar
   “actual list query applies privacy before count and paging only for
   non-ADMIN”.
2. Quitar el módulo canónico `fondo` y dejar sólo `fondo_mariana`. Debe fallar
   “compiled audit predicate is exact and preserves ordinary Caja fondoInicial
   metadata”.
3. En `exportAuditoriaQuery`, reemplazar
   `whereSql(filters, includeConfidentialFondo)` por una condición sin Fondo,
   o quitar el predicado de `getAuditoria`. Debe fallar
   “actual detail and export query builders share the role-sensitive
   boundary”.
4. Hacer que `nonFondoSystemNotification()` compile a `true`. Debe fallar
   “actual generic notification predicate excludes entities, type and source
   payload”.

Los cuatro mutantes semánticos se ejecutaron uno por vez en copias
`/tmp/e10-mutant-*`, con el preload offline y sin DB. Cada mutante modificó el
constructor/predicado real compilado, y los cuatro terminaron por su
`AssertionError` esperado (`exit=1`). Tras restaurar, el archivo quedó GREEN
4/4 (1,815.863 ms en la verificación posterior a extraer el seam puro).
Evidencia: `reports/e10-aislado-2026-09-18/mutantes-generic-privacy.log`.
GREEN final: `reports/e10-aislado-2026-09-18/generic-privacy-green.log`.

## Resultado baseline HEAD

El árbol baseline ahora incluye `tsconfig.base.json` y sólo dos fixtures
versionados requeridos por los manifiestos. Cada `node_modules` de paquete se
reconstruye con dependencias externas ya instaladas, mientras cada alias
`@workspace/*` se enlaza y valida contra el árbol temporal baseline; un alias
que resuelva al árbol actual aborta antes de las pruebas.

Ejecución válida final de `node scripts/src/e10-safe-suite.mjs --baseline`:

- backend E1: 59/59 pasa, 4,719.566 ms;
- frontend: 361/361 pasa, 66,712.882 ms;
- ambos selfchecks offline pasan (bloqueo de red y fixture loopback);
- lote: `exit=0`, 73,082 ms; digest de fuentes sin cambios.

Un intento anterior incluyó indebidamente `typecheck-runner.test.mjs` bajo el
preload, que bloqueó su ejecutable `tsc` y produjo el artefacto `0 !== 2`.
Era un arnés inválido, no un fallo baseline de la aplicación, y no se conserva
como resultado. Ese test queda fuera del manifiesto protegido; su comando
canónico independiente no se ejecutó ni se acredita.

Log terminal completo:
`reports/e10-aislado-2026-09-18/baseline-safe.log`.
El lote protegido actual queda para la corrida coordinada del agente padre. No
se denomina ni acredita como suite backend completa: todo test backend fuera de
los seis paths queda bloqueado/no ejecutado hasta clasificación explícita.

## Typecheck raíz baseline HEAD y atribución

Comando:

```sh
node scripts/src/e10-safe-suite.mjs --baseline-typecheck
```

El modo usa el mismo `git archive HEAD`, incluye los tres artifacts
(`api-server`, `mariana-textil`, `mockup-sandbox`), siete resultados de
bibliotecas y `scripts`; no importa fuentes en runtime ni usa DB. Los
`.tsbuildinfo` generados por TypeScript se excluyen únicamente del digest de
fuentes; los archivos fuente/config permanecieron sin cambios.

Resultado real: `exit=1`, 75,913 ms, seis diagnósticos únicos, todos en E1:

- `e1-rehearsal-customer-cases.mts:213:77` — TS7053;
- `e1-rehearsal.mts:74:29` — TS2554;
- `e1-rehearsal.mts:256:15` — TS7022;
- `e1-rehearsal.mts:261:15` — TS7022;
- `e1-resume-readonly.mts:228:36` — TS7053;
- `e1-resume-readonly.mts:233:19` — TS7053.

API, frontend, mockup y las siete bibliotecas dieron cero errores. El
`reports/e10-aislado-2026-09-18/typecheck.log` actual contiene esos mismos seis
diagnósticos más ocho diagnósticos E10 asignados a sus owners (14 total). Por
comparación HEAD, los seis E1 son baseline y no son regresión E10; no se
modificaron.

Log baseline íntegro:
`reports/e10-aislado-2026-09-18/baseline-typecheck.log`.

`scripts/src/typecheck-runner.test.mjs` queda clasificado **NO EJECUTADO** en el
lote protegido: su caso de `tsc` real es incompatible con el preload de red que
rechaza el ejecutable directo. El typecheck raíz anterior no equivale a ejecutar
ese testcase, por lo que no se declara pase.

## Invocación para el worker de integración aislada

Importar los builders puros desde
`artifacts/api-server/src/lib/auditoria-queries.ts`. Ese módulo sólo importa
`drizzle-orm`, no importa `@workspace/db`, no abre singleton y es exactamente el
que consume/reexporta `lib/auditoria.ts` en producción. Compilar con
`new PgDialect().sqlToQuery(builder(...))` y entregar `sql`/`params` sin
alteración a `connectExactE10`.

Las firmas vigentes son:

```ts
listAuditoria(filters, page, pageSize, includeConfidentialFondo = false)
getAuditoria(id, includeConfidentialFondo = false)
exportAuditoriaRows(filters, includeConfidentialFondo = false)
```

Para fixture ADMIN usar `true`; para SUPERVISOR/CONTADOR, incluso con
`auditoria.ver`, usar `false`. Formas SQL reales:

- lista: `SELECT <selection>, COUNT(*) OVER()::int ... FROM auditoria a
  <whereSql privacidad + filtros> ORDER BY ... LIMIT ... OFFSET ...`;
- detalle: `WHERE a.id = $id::bigint AND (<privacidad>) LIMIT 1`;
- exportación: `FROM auditoria a <whereSql privacidad + filtros> ORDER BY ...
  LIMIT 10001`.

El predicado no-ADMIN excluye las entidades singulares canónicas
`fondo_movimiento`/`fondo_arqueo` y sus variantes plurales, prefijo exacto de
acción `LEFT(upper(a.accion),6)='FONDO_'`, módulos `fondo`/`fondo_mariana` y
marcadores exactos en ambos JSON. Esto cubre las formas emitidas
`FONDO + CREAR/INVERTIR + FONDO_MOVIMIENTO` y
`FONDO + ARQUEO + FONDO_ARQUEO`. No excluye el módulo real Caja ni su campo
ordinario `fondoInicial` (acción real de apertura: `ABRIR_CAJA`).