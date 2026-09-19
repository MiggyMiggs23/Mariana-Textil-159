# Apertura limitada E2/E3 — paquete de revisión, no de ejecución

## Estado

Preparado conforme a `autorizacion-preparacion.md`. No se aplicó SQL, no se activó ningún permiso, no se cambiaron variables del entorno ni se reinició la API. No se alteró la interfaz que utiliza el propietario para su primer corte real.

El backend preparado mantiene separados y cerrados el ingreso y la devolución. Los parches de activación están archivados, no aplicados. El candidato frontend completo también permanece como parche offline, no como código servido.

**Resultado posterior de la recuperación autorizada:** se detuvo antes de arrancar la API. La identidad operativa y las tres guardas E1 coinciden, pero un intento automático de arranque normal reemplazó el bundle autorizado y dejó actualizaciones persistentes en filas de permisos. No se encontró una copia del bundle anterior. Las lecturas no encontraron transacciones cliente abiertas/preparadas ni nuevas operaciones de negocio de las categorías comprobadas desde el reinicio. No se afirma ausencia total de efectos: ver `recuperacion/resultado.md`. El frontend está en ejecución; la API queda detenida. La autorización de recuperar la versión anterior no autoriza sustituirla por la compilación encontrada.

**Permisos cotejados después contra respaldo:** cero cambios de valores efectivos y de las 3,968 decisiones de acceso; las diferencias de contenido en permisos son únicamente los `updated_at` conocidos. Evidencia: `permisos-respaldo/resultado.md`. El bloqueo por bundle distinto permanece.

**Diseño A + C aprobado; preparación offline completada, candidato inactivo:** revisión independiente reconfirmada, SQL futuro reconciliado, contrato V3 con digests coordinados, 428/428 pruebas ampliadas y 24/24 mutantes detectados con restauraciones verdes. Typecheck raíz del candidato congelado y de `80eaa93d`: ambos exit 0/cero diagnósticos. **Resultado PostgreSQL posterior: FAIL de instalación del candidato exacto `f8818255`**, ejecutado con autorización textual en una sola base nueva aislada, ya destruida. El error sintáctico de `e2_validate_abono_finalization` bloqueó las pruebas posteriores; no se corrigió el candidato durante la validación. No se tocó la base de API, clones E1/E10, bundle ni permisos. Ver `evidencia-a-c/postgresql-validacion/resultado.md` y `evidencia-a-c/estado-offline.md`. Corrección/validación de una revisión nueva pendientes; apertura no autorizada.

**Reconstrucción posterior aceptada por el propietario:** el commit `7cb77f8cfc6287fa51325a25122c48af392a7ada` produjo SHA `3415998ed6eb1b8d6977793ac53f43ce91477f691b12f5c8dc11d14a2b801a98`. Tras la detención correcta bajo el criterio anterior, el propietario aclaró y autorizó la identidad por commit/entradas limpias. Ancestría, comparación de 3,116 rutas, autorización, instalación y barrera de preflight están en `reconstruccion/autorizacion-bundle-7cb.md`. Este cambio no activa A+C ni vuelve ejecutables los SQL/parches de apertura.

**Incidente posterior, corregido sin ocultarlo:** el segundo arranque pasó el preflight externo pero Node no recibió efectivamente la variable inspection declarada en metadata y ejecutó el mantenimiento normal. Fue detenido. Catálogo/guardas y permisos efectivos siguieron iguales; no hubo nuevas operaciones de negocio en las categorías cotejadas, pero sí timestamps y consumo de secuencias de permisos. Tras exportar las variables en el propio comando y exigirlas antes de `psql`, el arranque final de `22:16:58Z` aprobó: inspection pausó inicializadores/backfill/poller, escuchó en 8080 y `/api/healthz` respondió 200. La API está en ejecución; A+C y la captura siguen cerradas. Ver `recuperacion/incidente-arranque-escritor/resultado.md`.

## Índice de entregables

| Parte | Archivo |
|---|---|
| Lista para el mostrador | `lista-primer-corte.md` |
| Revisión de aplicación y controles | `aplicacion.md` |
| Activación posterior exclusiva del ingreso backend | `activacion-income-no-aplicada.patch` |
| Candidato de interfaz con ambos permisos apagados | `frontend-candidate-no-aplicado.patch` |
| Activación posterior exclusiva del ingreso frontend | `activacion-frontend-income-no-aplicada.patch` |
| Reversión de activación frontend | `reversion-frontend-income.patch` |
| Pruebas y hashes del candidato frontend | `frontend-offline-validacion.md`, `frontend-fingerprints.sha256` |
| Arranque acotado y contrato de aprobación | `arranque-acotado.md` |
| Revisión SQL, precondiciones y límites | `sql-review.md` |
| SQL completo de apertura, **no ejecutado** | `sql/01-apply-limited-cash-abono.sql` |
| SQL completo de reversión, **no ejecutado** | `sql/02-revert-closed.sql` |
| Contrato compartido y cálculo offline del digest de plan | `sql/contracts.mjs`, `sql/00-plan-digests.mjs` |
| Evidencia de verificación del código | `verificacion/` |

## Cambio de base propuesto

El único objeto reemplazado es `public.e1_guard_cash_capture_closed()`.

La excepción permite `ABONO / INGRESO_FISICO / EFECTIVO`. La devolución física sigue rechazándose. No se retira ningún trigger ni se alteran las guardas de retenidos y atribución histórica. Se conservan las restricciones permanentes de identidad, naturaleza, sitio, sesión, inmutabilidad y reverso.

Los scripts completos incluyen transacción, bloqueo de las tablas de movimientos/evidencia E1 y auditoría, identidad esperada obligatoria, contrato de plan V2, comparaciones de catálogo y comprobación posterior. No ejecutan DML sobre registros de negocio, ni conceden permisos, ni instalan las tablas de devolución E2.

El digest del plan **no es una certificación del catálogo real ni del bundle**. Identifica el plan aprobado; las comprobaciones independientes de catálogo deben aprobarse realmente al ejecutar. Los valores de identidad no tienen defaults ni se rellenaron con una conexión viva durante esta preparación.

## Arranque propuesto

`EXPLICIT_LIMITED` comprueba identidad, tablas/columnas/tipos declarados en Drizzle, constraints/índices cubiertos y once triggers: diez de E1 y el append-only de auditoría. Comprueba también sus funciones y metadatos. La transacción de comprobación es READ ONLY y termina antes de importar el grafo HTTP y escuchar peticiones.

No ejecuta inicializadores, backfills, poller ni mantenimiento automático de arranque. No corrige un esquema incompleto. La incompatibilidad entre el estado aprobado de la guarda SQL y el permiso de ingreso de la aplicación impide arrancar; devolución, retenidos y atribución deben seguir apagados.

Este modo no vuelve de solo lectura a toda la aplicación: una vez autorizado y arrancado, las operaciones legítimas del usuario siguen escribiendo mediante sus rutas y validaciones normales.

La revisión de contrato `e2-limited-readonly-v2` **no sustituye** el hash del código/bundle. Antes de autorizar la ejecución deben identificarse ambos, además del entorno y la base.

## Reversión sin pérdida de abonos

1. Pausar la recepción de nuevos abonos durante la ventana acordada.
2. Ejecutar, únicamente con autorización, el SQL de reversión: restaura exactamente el cuerpo cerrado de la guarda.
3. Volver el permiso de ingreso backend a `false` y aplicar la reversión equivalente del frontend, conservando devolución en `false`.
4. Arrancar la **versión E2 con el ingreso cerrado**, comprobando estado `CLOSED`.
5. Comprobar por lectura que los abonos ya aceptados, su auditoría, los cortes y el esperado siguen iguales.

**No revertir al bundle anterior a E2:** aquel no contiene el nuevo lector del efectivo ni el soporte de snapshots. Tampoco borrar, compensar o reclasificar abonos legítimos para cerrar la captura.

## Dependencia que impide autorizar la apertura sin otra decisión

La apertura limitada no instala ni registra la evidencia positiva que exige la devolución E2. Sus hooks de atestación aún no forman parte del productor de ABONO y están inactivos.

Con la implementación actual, un abono recibido durante esta apertura carecería de esa prueba. **Activar devoluciones después no lo convertiría automáticamente en devolvible**, aunque conservase saldo íntegro sin aplicar. El esquema preparado exige evidencia en la transacción de origen y no contempla backfill.

**Decisión y condición bloqueante del propietario:** A + C: conservar la evidencia desde el primer abono y decidir aparte cuándo abrir. Acepta la falta de devolución inmediata, no la pérdida de elegibilidad futura por falta de evidencia. La integración debe presentarse antes de implementarse, sin conectar indiscriminadamente el hook ni cambiar FIFO. La apertura queda bloqueada hasta construir y verificar la evidencia y obtener autorización de apertura separada. Solo es devolvible el importe íntegro nunca aplicado; aplicado o parcialmente usado es otro alcance. La recuperación del servicio anterior es independiente.

No se añadió por cuenta propia una restricción al saldo a favor, una excepción de devolución, una tabla alternativa ni una inferencia histórica.

## Orden de ejecución que requeriría autorización posterior

1. Conservar el primer corte histórico y sus cifras por superficie, con los tickets reales indicados por el propietario.
2. Resolver la dependencia de evidencia anterior y congelar la revisión final de código/SQL.
3. Identificar el entorno de captura y la base; hacer preflight de lectura y revisar resultados y hashes reales.
4. Obtener autorización textual **de ejecución** que enumere SQL, parches, arranque, ventana y reversión.
5. Pausar capturas; aplicar el SQL aprobado y poner en ejecución el bundle y frontend autorizados, sin arranque normal con inicializadores.
6. Comprobar el corte histórico sin modificarlo.
7. El propietario realiza el nuevo corte E2 con operaciones legítimas; comparar esperado, conteo, diferencia, desglose, snapshot y papel.

Este documento no es esa autorización y no sustituye ensayos PostgreSQL de concurrencia, atomicidad o reversión.

## Verificación final de la preparación

- Suite focalizada de aplicación: **67/67 PASS**.
- Arranque acotado, modos y ciclo de vida: **17/17 PASS** con aislamiento offline.
- Frontend candidato, en copias temporales: **2/2 montadas con permisos cerrados**, **4/4 montadas con ingreso habilitado**, **7/7 de contrato**; ambos candidatos pasan typecheck. Mutantes de lock, sitio y devolución detectados.
- SQL: inventario estructural y **10 negativos** aprobados. No se ejecutó PostgreSQL.
- Mismos manifiestos de comparación contra `80eaa93d`: **154 pruebas, 149 PASS y exactamente los cinco fallos conocidos**, sin nuevos fallos. El aumento desde 149 se debe a sustituir una prueba de guarda global por seis de permisos separados, alcance y reversión. No se corrigieron los cinco fallos previos.
- Typecheck canónico final: **exit 0**, cuatro paquetes de artefactos/scripts y siete resultados de bibliotecas, **cero diagnósticos**. El primer fallo TS2345 de una prueba nueva se conserva como evidencia; la reconfirmación final está en `verificacion/final-reconfirm-summary.txt`.
- Fuente productiva final: **4,065 archivos**, SHA-256 agregado `b34c6d2c40ac307b964d5712322a286d8ea92ad1e510594d763c1461b47448fb`, sin cambios durante la comprobación. Las comprobaciones de cada grupo pueden solaparse; no se suman como pruebas independientes.
- La última reconfirmación repitió solo los 17 tests de arranque afectados y el typecheck; no repitió los 154 tests no afectados.
- Durante las comprobaciones offline el bundle anterior se conservó byte a byte. La comprobación visual final no pudo cargar durante el reinicio. La revisión posterior de recuperación detectó que el arranque automático lo había reemplazado; no se inició el bundle distinto para obtener una captura favorable.

## Hashes de SQL y parches revisados

- Apertura SQL: `8d8f11539712cbce8dd4d4b9647ccca453bfae902dc71b7ce3fdd93abde4015d`.
- Reversión SQL: `f18b06411a48eed32f74d70d0901141302d557aecd1a0e9f93850b29e66e4a4c`.
- Contrato SQL V2: `8ebbb631e6e9c6d7495ee492852c66627084365867aaaca978c853c47e235a48`.
- Activación backend: `98598183ecd151fbc1f9377afe983f7758c55a67df1ce2dc2e5f626b9495db36`.
- Candidato frontend: `d0015f7e82fd779638ba23496daaf19d1038bd4d8c3956a2e17c9364e2091a67`.
- Activación frontend: `d78890ccedf541c40c3bb0fb4ac4eb362ce7ca9a386f9a01b08d802e06e91f4a`.
- Reversión frontend: `970ea087bf87dd4209663baf05af57bf7a16a3a17021a909752e2585a634cb76`.