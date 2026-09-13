# Fase 2 — cinco suites aisladas

**Fecha:** 2026-09-13  
**Resultado:** BLOQUEADAS por la política vigente de ejecución aislada  
**Alcance solicitado:** `inventario`, `POS`, `cuadre fiscal`, `salidas` y `admin analytics`

## Política y procedimiento comprobados

Se leyeron antes de cualquier intento:

- `.agents/memory/local-disposable-integration.md`
- `.agents/memory/test-database-startup-initializers.md`
- `.agents/memory/test-database-preparation-failures.md`
- `.agents/memory/regression-baseline-isolation.md`
- `.agents/memory/explicit-test-manifests.md`
- `lib/db/src/isolated-test-policy.mjs` (política vigente y lista cerrada)
- `replit.md` (regla de población y procedimiento de `pnpm test:isolated`)

La lista de política se consultó con `pnpm --reporter=silent test:isolated --list` y terminó
con **exit 0**. Reportó `policyVersion: 1` y únicamente estas suites permitidas:

- `prepare-smoke`
- `api-script:test:ticket-iva-schema`
- `api-script:test:admin-realtime-reconciliation`

Las cinco aliases solicitadas aparecen como `status: "blocked"`,
`review: "unreviewed"`, con el motivo:

> Alias is not approved for disposable-runner execution; database reachability and
> fixture/actor behavior remain unreviewed.

## Prueba terminal de bloqueo

Para no pasar por alto la política, cada intento usó el runner aislado (no el comando
directo de la suite), con las variables de conexión de origen retiradas del entorno:
`DATABASE_URL`, `TEST_DATABASE_URL` y overrides `PG*` no estuvieron disponibles; se
conservó solamente el sentinel administrativo `APPLICATION_DATABASE_URL`, junto con
`NODE_ENV=test` y `REQUIRE_ISOLATED_TEST_DATABASE=1`.

| Suite solicitada | Comando de política intentado | Exit | Resultado |
|---|---|---:|---|
| inventario | `pnpm test:isolated --suite api-script:test:inventario` | 1 | bloqueada por política |
| POS | `pnpm test:isolated --suite api-script:test:pos` | 1 | bloqueada por política |
| cuadre fiscal | `pnpm test:isolated --suite api-script:test:cuadre-fiscal-integration` | 1 | bloqueada por política |
| salidas | `pnpm test:isolated --suite api-script:test:salidas` | 1 | bloqueada por política |
| admin analytics | `pnpm test:isolated --suite api-script:test:admin-analytics-integration` | 1 | bloqueada por política |

Cada intento produjo el rechazo de la política antes de crear o iniciar el clúster
del runner:

`Suite "api-script:test:<suite>" is blocked by isolated-test policy: Alias is not approved for disposable-runner execution; database reachability and fixture/actor behavior remain unreviewed.`

Los comandos directos solicitados (`pnpm --filter @workspace/api-server run
test:<suite>`) **no se ejecutaron**, porque hacerlo habría eludido la política
existente. No se modificaron aplicaciones, contratos, suites ni la política.

## Conteos y aislamiento

- Suites solicitadas: **5**
- Suites ejecutadas: **0**
- Pruebas aprobadas: **0**
- Pruebas fallidas: **0**
- Suites bloqueadas: **5**
- Clúster PostgreSQL desechable iniciado: **no**
- `schema`, `seed` o inicializadores ejecutados: **no**
- Procesos hijos de pruebas/API creados: **no**
- Mutaciones de datos: **0**
- `current_database()` ejecutado: **no aplica**; la guardia rechazó las aliases
  antes de construir `DisposablePostgresRunner`.
- Cluster/puerto/directorio temporal pendiente de limpieza: **ninguno**

El resultado es un bloqueo documentado, no una aprobación ni una ejecución parcial.
Se requiere revisión explícita de esas cinco aliases en la política antes de poder
ejecutarlas de forma segura en un clúster local desechable.

## Incidente posterior del wrapper operador (infraestructura)

Después se autorizó una ruta separada y explícita para el wrapper operador
(`scripts/src/run-phase2-five-suites.mts`), sin modificar la allowlist canónica.
La primera preparación aislada terminó, pero el wrapper falló al registrar el hijo
antes de que comenzaran las aserciones de `test:inventario`:

`ReferenceError: Cannot access completion before initialization`

Esto fue un fallo de ciclo de vida del wrapper (la promesa de finalización se
referenciaba desde `trackChild` durante su propio inicializador), no un resultado
de negocio ni una aserción de suite.

Conteo terminal de esa corrida del wrapper:

- Suites con resultado terminal: **0/5**
- Suites aprobadas: **0**
- Suites fallidas por aserción: **0**
- Fallos de infraestructura del wrapper: **1**
- Schema/seed/inicializadores: **1 preparación completada antes del fallo**

La corrección deja la promesa de finalización inicializada antes de llamar a
`trackChild` y añade una autoprueba barata de registro con `wait()` síncrono, para
detectar de nuevo la regresión TDZ. No se reejecutaron suites después de corregirla.

### Limpieza del recurso propio

Se inspeccionó únicamente la identidad registrada por esa corrida:

- Directorio propio: `/tmp/workspace-isolated-pg-HcXWbs`
- `pg_ctl status`: **3, no server running**
- PID stale del `postmaster.pid`: **21421**, sin proceso PostgreSQL activo
- Hijos de suite y procesos PostgreSQL propios restantes: **ninguno**
- Directorio propio eliminado y verificado: **sí**
- UI `44337`, histórico `43335`, development y cualquier fuente: **no tocados**

La nueva versión queda pendiente de revisión independiente; esta actualización no
autoriza por sí sola otra ejecución.

## Corrida real del wrapper corregido

La segunda corrida del wrapper (log terminal explícito:
`/tmp/replit-shell-output-logs/HOKJ0SGBB8SCBCT3NZ2EM/log`) llegó a las cinco suites.
El proceso terminó con **exit 0** y los cinco clústeres propios fueron eliminados,
pero ese exit no es suficiente para declarar PASS: dos suites reportaron fallos de
cleanup que sus scripts absorbieron.

| Suite | Assertions de escenario | Cleanup | Exit hijo observado | Estado de evidencia |
|---|---:|---|---:|---|
| inventario | 25 pass / 0 fail | **FAIL**: `DELETE auditoria` rechazado por `auditoria es append-only` (SQLSTATE `P0001`) | 0 | FAIL (protección correcta, cleanup inadecuado) |
| POS/caja | 36 pass / 0 fail | sin error reportado | 0 | PASS |
| cuadre fiscal | 1 pass / 0 fail | sin error reportado | 0 | PASS |
| salidas | 12 pass / 0 fail | **FAIL**: `DELETE salidas` rechazado por FK `movimientos_salida_id_salidas_id_fk` (SQLSTATE `23503`) | 0 | FAIL (fixture cleanup) |
| admin analytics | 1 pass / 0 fail | sin error reportado | 0 | PASS |

Conteo agregado de escenario: **75 assertions pass / 0 fail**. Conteo terminal de
la ejecución: **5/5 suites llegaron a terminal**, pero el estado global es
**FAIL**, no PASS, por los dos fallos de cleanup. No se modificaron triggers,
auditoría append-only ni FKs; no se debe corregir esto relajando protecciones.
La eliminación completa de cada clúster sí terminó, sin roots propios ni procesos
de suites pendientes.

Estos fallos son de cleanup de fixtures desechables y no una falla de las
aserciones de negocio; tampoco aportan evidencia de UI vacía ni de creación de
ticket. Por tanto no bloquean específicamente esas dos comprobaciones, que siguen
**NOT_RUN**, pero sí bloquean declarar completa la evidencia de las cinco suites y
la aceptación global de la purga.

El typecheck raíz ya tenía resultado real **PASS** con `pnpm run typecheck` antes
de esta corrida; no se repitió para fabricar evidencia nueva. El mapeo de estados
machine-readable está en
`reports/fase2-cinco-suites-aisladas-2026-09-13.json`.