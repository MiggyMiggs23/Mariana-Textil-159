# Adaptación 28 — contrato temprano de suites con actores

## Propósito y propiedad

Este contrato define la interfaz compartida para los tres grupos asignados.
La adaptación no autoriza nuevas suites ni cambios de producción. Las
expectativas históricas incompatibles con contratos vigentes se reconciliaron
explícitamente y están detalladas en los informes de cada grupo; no se afirma
que todas las aserciones originales permanezcan idénticas. La
infraestructura compartida pertenece a `lib/db`; cada propietario adapta sólo
sus rutas asignadas.

## Invariantes obligatorios

1. MAIN es el único ejecutor de integración.
2. El runner crea un clúster PostgreSQL 16 local y desechable, sin red TCP, un
   target aleatorio nuevo por suite y una base local de control alcanzable. Los
   targets anteriores no se reutilizan ni se entregan como target a los hijos
   siguientes, y sólo se destruyen junto con el clúster en `finally`; no hay
   teardown de fixtures. El
   padre no entrega `DATABASE_URL`,
   `APPLICATION_DATABASE_URL`, `TEST_DATABASE_URL` ni overrides `PG*`.
3. Sólo el runner entrega URLs al hijo: `TEST_DATABASE_URL` apunta a la base
   objetivo y `DATABASE_URL` a la segunda base real del mismo clúster. Nunca
   son iguales, placeholders ni una URL heredada de la API. La segunda base
   existe para que la guardia actual compare dos identidades alcanzables.
   Ambas URLs usan el formato que acepta `pg` para Unix socket: directorio de
   socket codificado como host y puerto PostgreSQL explícito en `?port=...`.
   El puerto identifica al postmaster dentro del socket privado; no implica
   listener TCP (`listen_addresses` debe ser vacío).
   `APPLICATION_DATABASE_URL` conserva exclusivamente la misma URL control
   firmada como alias estable para descendientes: si el singleton legacy de DB
   selecciona el target y reescribe `DATABASE_URL`, cada preload restaura desde
   ese alias y vuelve a validar URL e identidad. Nunca es una URL de API.
4. `actor-suite-preflight.mjs`, importable sin DB/aplicación, hace primero un
   preflight síncrono del ambiente firmado: dos URLs PostgreSQL locales,
   distintas y completas; marcador, identidad esperada y selección explícita.
   Después la guardia abre ambos pools, confirma que ambas bases existen y son
   distintas, y compara nombre/OID, usuario, data directory, puerto, socket y
   `listen_addresses` del target. Sólo entonces se importan aplicación, actores
   o sesiones.
5. Las rutas provienen del manifiesto exacto de 28. Selección vacía, duplicada,
   desconocida o expansión cero falla antes de importar DB/aplicación.
6. No se descubren tests implícitamente. Cada ruta obtiene un proceso hijo
   nuevo: Node nativo, preloader de identidad, loader `tsx`, `--test` y una sola
    ruta explícita. Se usa `--test-isolation=none` dentro de ese hijo externo:
    evita el segundo transporte binario IPC de Node sin compartir proceso entre
    rutas. No se comparten pools, hooks `before`, módulos singleton ni estado del
    test runner entre rutas.
7. Las suites pueden crear actores y evidencia sólo en la base desechable. No
   borran usuarios seed/ajenos ni usan bypass de auditoría para limpiar:
   cierran pools/servidores y el dueño destruye el clúster completo en `finally`.
8. HTTP, cuando una suite existente lo exige, permanece in-process y enlazado
   sólo a loopback. No se incorporan API externa, E1/E10 ni URL heredada.
9. Logs y manifests durables se escriben bajo `reports/actor-suites/runs/`.
   Se eliminan URL PostgreSQL, contraseñas y valores secretos.
10. Cada caso conserva procedencia de inicio y fin para suite, runner, helpers
    de aislamiento y árbol de schema. También conserva identidades reales
    target/control antes y después de preparación, OIDs, resumen nativo y
    nombres terminales, y digests de logs. Un cambio durante el caso es
    inseguro; los datos no se reconstruyen después.
    `manifest.json`, `selection.json` y `terminal.json` se reemplazan
    atómicamente. El manifest nace antes de preparar y se persiste después de
    cada caso; `finally` conserva los prefijos y fija FAIL ante aborto o cleanup
    no acreditable.

## Interfaz de selección continuable

- Lista estática sin DB/app: `node lib/db/src/run-isolated-tests.mjs --actor-list`
- Grupo: `--actor-group=grupo-1|grupo-2|grupo-3`
- IDs explícitos: `--actor-ids=ruta1,ruta2`
- Todo el manifiesto: `--actor-all`
- Continuar después de aserciones de negocio fallidas:
  `--actor-continue-on-failure`

`--actor-group`, `--actor-ids` y `--actor-all` son mutuamente excluyentes. Los
IDs explícitos preservan el orden canónico del manifiesto, por lo que una
continuación puede seleccionar sólo rutas pendientes sin reinterpretar el
prefijo. Ningún modo actor tiene selección predeterminada.
`--actor-continue-on-failure` sólo se acepta junto con una selección actor
explícita. Conserva terminales y logs por suite, crea un target nuevo para la
siguiente ruta y mantiene FAIL global si hubo cualquier fallo. Una identidad o
preparación insegura, reporter nativo incompleto o cleanup no acreditable aborta
la ejecución; sólo las aserciones terminales nativas pueden continuarse.

MAIN debe invocar actor con ambiente limpio, sin secretos ni URLs heredadas:

```sh
env -i PATH="$PATH" HOME="$HOME" LANG="$LANG" \
  node lib/db/src/run-isolated-tests.mjs --actor-group=grupo-1
```

El runner comprueba además que `postgres`, `initdb`, `pg_ctl` y `createdb`
resuelven a PostgreSQL 16 antes de importar `pg`, preparación o aplicación.
Para actor genera criptográficamente un `ADMIN_SEED_PASSWORD` sintético nuevo
por target y lo entrega sólo a los hijos locales de preparación/suite. No lee,
copia, imprime ni persiste un valor heredado. La redacción incluye esa
credencial efímera. El preflight actor rechaza por nombre cualquier secreto
heredado sin leer su valor. Los modos legacy no actor conservan su contrato
anterior de secreto de seed.

## Manifiesto exacto (28)

### grupo-1 (10)

1. `artifacts/api-server/src/admin-alertas.integration.test.ts`
2. `artifacts/api-server/src/admin-invariants.integration.test.ts`
3. `artifacts/api-server/src/aplicaciones-pago-proveedor.integration.test.ts`
4. `artifacts/api-server/src/auditoria.integration.test.ts`
5. `artifacts/api-server/src/clientes-ajustes-api.test.ts`
6. `artifacts/api-server/src/contenedores.integration.test.ts`
7. `artifacts/api-server/src/cuadre-fiscal.integration.test.ts`
8. `artifacts/api-server/src/equipos.integration.test.ts`
9. `artifacts/api-server/src/etiquetas-api.integration.test.ts`
10. `artifacts/api-server/src/inventory-six-view.integration.test.ts`

### grupo-2 (9)

11. `artifacts/api-server/src/kardex-api.test.ts`
12. `artifacts/api-server/src/lib/notificaciones-credito.test.ts`
13. `artifacts/api-server/src/lib/permisos.test.ts`
14. `artifacts/api-server/src/metered-reference-cost.integration.test.ts`
15. `artifacts/api-server/src/pagos-dirigidos.integration.test.ts`
16. `artifacts/api-server/src/pos-location-authorization.integration.test.ts`
17. `artifacts/api-server/src/postgres-unique-concurrency.integration.test.ts`
18. `artifacts/api-server/src/precios.integration.test.ts`
19. `artifacts/api-server/src/productos-cache.integration.test.ts`

### grupo-3 (9)

20. `artifacts/api-server/src/proveedores-alcance-fechas.integration.test.ts`
21. `artifacts/api-server/src/reportes.integration.test.ts`
22. `artifacts/api-server/src/role-access-matrix.integration.test.ts`
23. `artifacts/api-server/src/productos-purge.integration.test.ts`
24. `artifacts/api-server/src/security-api.test.ts`
25. `artifacts/api-server/src/store-sales-global.integration.test.ts`
26. `artifacts/api-server/src/task57.integration.test.ts`
27. `artifacts/api-server/src/task58.integration.test.ts`
28. `artifacts/api-server/src/viajes.integration.test.ts`

El manifiesto contiene las 28 rutas con creación persistida de actores
revalidada en fuente. `lib/notificaciones-credito.test.ts` usa
`INSERT INTO usuarios`; `lib/permisos.test.ts` usa
`db.insert(usuariosTable)`. Se excluyen `salidas-api.test.ts`, cuyo actor es un
`AuthContext` en memoria, y `lib/salidas.test.ts`, que sólo selecciona un usuario
seed activo. Ambas pueden conservar adaptación auxiliar por su grafo DB, pero no
cuentan como rutas actor ni se sustituyen para ajustar cardinalidad.

## Firma de importación franca

Cada suite recibe exactamente esta forma de proceso, sin wrapper de negocio:

```text
node --import <actor-suite-bootstrap.mjs> --test <una-ruta-exacta-del-manifiesto>
```

El bootstrap restaura control, valida ambas identidades reales y registra el
loader TypeScript. No fuerza la importación del singleton DB: un worker de
logging que no usa DB no debe repetir readiness de fixtures a mitad de un caso.
La suite o worker que sí importe DB conserva los contratos propios de ese
módulo. El bootstrap no importa `app`, no registra hooks, no crea
actores/sesiones y no reemplaza exports. La suite conserva su propio
`node:test`; al terminar, su hijo sale y la siguiente ruta empieza con cache de
módulos, hooks, pools y singletons nuevos.
