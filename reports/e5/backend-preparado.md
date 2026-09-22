# E5 — verificación backend preparada para MAIN

## Estado

Se prepararon 49 casos nativos offline con un mutante productivo semántico por
obligación. No se ejecutaron tests, API, app, DB, SQL, workflows ni instalaciones.
E5 permanece OFF. No se modificaron fuentes productivas, generados, frontend, SQL
ni evidencia E4/E12/E9.

Los dos intentos iniciales de MAIN terminaron antes del primer caso: primero por
un ancla no única y después por dependencias incompletas del snapshot
(`date-only`/`drizzle-zod`). Son fallos de infraestructura de preparación, no
verdes, rojos, mutantes muertos ni defectos productivos. Tras repararlos, solo se
ejecutaron el preflight estático y el bundle aislado autorizado; sigue habiendo
cero casos E5 ejecutados.

El tercer intento alcanzó casos y detuvo la matriz en
`E5-EXACT-MULTICHARGE`: el verde pasó, pero el mutante produjo directamente
`E5_EXACT_REQUIRED` en lugar de un `AssertionError`, por lo que el runner lo
rechazó correctamente como rojo no específico. La obligación productiva sí era
correcta; la expectativa positiva no envolvía el rechazo inesperado. Se corrigió
con `assert.doesNotReject`, que convierte exactamente esa desviación en
`ERR_ASSERTION` propio. La inspección de las restantes expectativas encontró el
mismo riesgo en `E5-FUND-GUARD-OFF-NO-QUERY` y se envolvió del mismo modo antes de
que MAIN llegue a ese caso. No se rebajó ninguna obligación ni se contó el fallo
de dominio como mutante muerto.

El siguiente intento aceptó diez ciclos completos y se detuvo en
`E5-RECEIVE-SCOPE`. El mutante quitaba solo la llamada de alcance durante
validación, pero el `e5View` final ejecutaba legítimamente el mismo guard y volvía
a producir `E5_NOT_FOUND`; por eso verde y rojo pasaron. El fixture sí aísla un
actor de otra tienda y no se relajó. Se corrigió el mutante para desactivar la
condición mínima de `e5Scope` compartida por ambos puntos secuenciales, de modo
que el defecto de alcance llegue a la expectativa `assert.rejects` y produzca su
`ERR_ASSERTION`. No hay defecto productivo.

El manifiesto parcial `backend-2026-09-22T22-42-59.382Z` aceptó, en orden:
`E5-OFF-COMMAND`, `E5-OFF-PREVIEW`, `E5-OFF-HTTP`,
`E5-OFF-AVAILABILITY`, `E5-MONEY-POSITIVE`, `E5-EXACT-MULTICHARGE`,
`E5-EXACT-NONADMIN`, `E5-ALLOCATION-EXACT-MOVEMENT`,
`E5-ALLOCATION-NO-DUPLICATE` y `E5-RECEIVE-PERMISSION`. Sus snapshots
comparten el hash de test `a749f3cafec5a712da7102f97b6605585928f7a086b15d76e943cfa733d4dce5`;
esta reparación no cambia `e5.test.ts`, por lo que esos ciclos permanecen
byte-preservados. Restan 39 IDs, desde `E5-RECEIVE-SCOPE` hasta
`E5-APPEND-AUDIT-PRIVATE`, en el orden de `backend-mutants.mjs`.

La continuación `backend-2026-09-22T22-47-35.491Z` aceptó 28 ciclos, desde
`E5-RECEIVE-SCOPE` hasta `E5-DESTINATION-MONEY-ONLY`, y luego tuvo un fallo
verde en `E5-CASH-RETAINED-WITHOUT-APPLICATION`. El fixture pedía una excepción
para una aplicación E5 con naturaleza `OPERACION_CREDITO_SIN_DINERO`, pero el
contrato productivo la omite antes de validar identidades de ingresos físicos.
Eso es la separación exigida: la aplicación no representa una segunda entrada
de efectivo. Se corrigió únicamente el fixture para mezclar recepción retenida y
aplicación y exigir que el resultado contenga solo `COBRO_RETENIDO`, con
`cobrosRetenidos=10.00` y `abonosFisicos=0.00`. No hay cambio productivo ni se
convirtió el verde fallido en evidencia roja.

El manifiesto de esa continuación tiene hash de test
`a749f3cafec5a712da7102f97b6605585928f7a086b15d76e943cfa733d4dce5`.
La corrección necesaria del fixture cambia ese hash; por tanto, los 28 ciclos
siguen siendo resultados terminales de su snapshot histórico, pero no se afirma
igualdad byte a byte con una continuación nueva. Restan 11 IDs desde
`E5-CASH-RETAINED-WITHOUT-APPLICATION` hasta `E5-APPEND-AUDIT-PRIVATE`.

La continuación localizada realmente como
`backend-2026-09-22T22-50-50.887Z` (no `.898Z`) aceptó
`E5-CASH-RETAINED-WITHOUT-APPLICATION`,
`E5-DRIZZLE-PRODUCER-METADATA` y `E5-KEY-LOCK-REQUEST`, y tuvo fallo verde
en `E5-LOAD-FOR-UPDATE`. El adapter ahora revalida primero al actor mediante
`SELECT ... FROM usuarios ... FOR SHARE`; el fixture antiguo devolvía cero filas
y además suponía que la consulta del cobro era la primera. Se añadió una cola SQL
explícita: identidad ADMIN vigente en la primera respuesta y cobro ausente en la
segunda, exigiendo tanto `FOR SHARE` de identidad como `FOR UPDATE` del cobro.
También se hizo explícita esa secuencia en `E5-E1-CORRECT-PRODUCER`.

Se revisaron los ocho fixtures restantes contra el adapter actual:
`LOAD` y `E1` requerían modelar `liveActor`; `SAVE-CAS`,
`APPLICATION-NO-SECOND-MONEY`, `LIST-SCOPE`, `DOCUMENT-ADMIN-ONLY`,
`REFUND-OPTIONS-NO-ORIGINAL-CASH` y `APPEND-AUDIT-PRIVATE` no atraviesan ese
revalidador en sus rutas probadas y sus secuencias/respuestas ya coinciden con
el adapter. El fallo es de fixture, no productivo; no se tocó producción.

Los casos usan actores, repositorio transaccional y respuestas SQL sintéticos.
Las consultas del adapter solo acreditan que el código solicita locks, CAS,
filtros y productores concretos; **no acreditan locks, rollback ni semántica
PostgreSQL real**. MAIN debe pedir/revisar anclas finales si la integración backend
continúa cambiando antes de ejecutar.

El `tsc --noEmit` source-only final compila `e5.test.ts` y sus imports con estado
0 (se corrigieron los 13 usos `evidencia`/`evidence` y el callback tipado). Se usa
resolución Bundler y condición workspace, sin `-p`, build mode ni project
references; no depende de dists obsoletos. No se tocaron generados ni fuentes
productivas.

## Cobertura preparada

- Gate OFF en core, preview y frontera HTTP; disponibilidad OFF sin acceso.
- Dinero exacto, multicargo por documento y movimiento exacto; duplicados,
  permisos, alcance, medio/cuenta/sesiones y productor retenido E1.
- Aplicación ADMIN al momento; propuesta futura explícita; A cerrado; autorización
  ADMIN, subconjunto, parcial, nota saldada, rechazo y favor explícito sin FIFO.
- Replay por intención, revisión, rollback serial sintético, estados y devolución
  total nunca aplicada; no caja original supuesta.
- Dos fechas, avisos a tres días, recibo/constancia inmutables y privacidad Fondo.
- Solicitudes adapter de lock/CAS/FOR UPDATE, scope de lectores, documentos ADMIN,
  auditoría append privada y ausencia de segundo efecto monetario en guardado.
- Capacidad ADMIN sin detalle para aplicar al momento, omisión de cargos ya pagados
  dentro de un documento multicargo, errores de dependencia saneados, guard de
  inverso Fondo, lector de destinos OFF/sin aplicaciones/Fondo, caja canónica con
  recepción E1 retenida sin contar aplicación y metadata Drizzle del productor
  `E5_APLICACION_RETENIDA` como operación de crédito sin dinero.

Quedan fuera de la prueba offline: PostgreSQL real, aislamiento/concurrencia real,
triggers/DDL, drivers, rutas Express integradas con auth real, impresora, Fondo/E9
desplegados y cualquier identidad de usuarios/DB reales.

El guard puro de inverso Fondo E5 sí tiene verde/mutante. La presencia de su llamada
en la ruta Fondo y el guard equivalente dentro de la ruta monolítica de clientes se
revisaron como anclas finales, pero no se presentan como prueba funcional: con E5
OFF la llamada Fondo es deliberadamente no observable, y esas rutas no ofrecen
inyección offline sin cargar el driver/DB. No se añadió una aserción de regex sobre
fuente para fingir comportamiento. MAIN debe conservar como revisión obligatoria
las anclas `routes/fondo.ts` (llamada a `assertE5NoIndependentInverse`) y
`routes/clientes.ts` (rechazo de `E5_APLICACION_RETENIDA`).

## Ejecución exclusiva de MAIN

```sh
# Preflight estático de cardinalidad/anclas, sin ejecutar casos:
node reports/e5/run-backend-offline.mjs --validate-only

# Bundle sintáctico del snapshot físico aislado, sin ejecutar casos:
node reports/e5/run-backend-offline.mjs --build-only

# Matriz verde / mutante rojo ERR_ASSERTION / verde restaurado:
node reports/e5/run-backend-offline.mjs

# Continuación explícita, únicamente con IDs nombrados por MAIN:
node reports/e5/run-backend-offline.mjs --ids E5-EXACT-MULTICHARGE,E5-EXACT-NONADMIN
```

Cada ejecución crea el manifiesto exacto en
`reports/e5/logs/backend-<ISO-con-dos-puntos-reemplazados>/manifest.json`, además
de un log verde/rojo/restaurado por caso. El preflight esperado por MAIN debe
informar `Prepared 49 named green/red/restored-green cases`; no se ejecutó aquí.

Typecheck estático source-only reproducible:

```sh
pnpm exec tsc --noEmit --pretty false --skipLibCheck --strict --target ES2022 \
  --module ESNext --moduleResolution Bundler --customConditions workspace \
  --allowSyntheticDefaultImports \
  --typeRoots artifacts/api-server/node_modules/@types --types node \
  artifacts/api-server/src/lib/e5.test.ts
```

El runner copia físicamente todas las entradas, rechaza imports vivos fuera de
node_modules, crea cada proceso con lista blanca pública exclusiva
`PATH/HOME/LANG/TZ/TMPDIR/NODE_ENV=test` (sin secretos de sesión, credenciales ni
variables operativas), usa el guard E12 aceptado y un guard E5 adicional de
escrituras, y exige restauración por hash. Un error de setup/red/guard nunca cuenta
como rojo.

`--ids` nunca altera la matriz ni excluye silenciosamente: valida IDs conocidos,
rechaza duplicados y registra la selección en el manifiesto. Una ejecución parcial
termina como `COMPLETE_EXPLICIT_SUBSET`, nunca como PASS total. Esto permite
conservar intactos los logs/ciclos anteriores y continuar desde un fallo concreto.

El snapshot incluye el árbol fuente real completo de `api-server/src/lib` y el
árbol real `lib/db/src/schema`; no usa aliases ni stubs productivos. La resolución
de paquetes contempla explícitamente `artifacts/api-server/node_modules`,
`lib/db/node_modules`, `lib/api-zod/node_modules` y el almacén raíz. Solo los
inputs realmente alcanzados pueden aparecer en el metafile y todos los inputs
workspace alcanzados deben resolver dentro del snapshot físico.