# Tarea 1 — E8 Inventario: solo productos activos

## Resultado

Completada en fuente backend, sin activar ni modificar ningún bundle en ejecución.
La consulta común de `GET /inventario/existencias/agrupadas` ahora exige
`p.activo = true` antes de aplicar búsqueda. El mismo predicado cubre los casos
con existencia, `includeSinExistencia`, búsqueda y alcance por ubicación.

No se modificaron kardex, lista o detalle de rollos/series, auditorías,
reconstrucción de existencias, conciliación ni reportes históricos. Tampoco se
modificó el consumidor web porque la forma de la respuesta no cambió.

## Archivos de implementación y huellas SHA-256

Base versionada al ejecutar las verificaciones:
`52fba053c44241263abc78c8085e5a8d0a6637c9`.

- `artifacts/api-server/src/routes/inventario.ts`  
  `5cd953c68c21187c77f59973115e2bdd4aef442d593bed4c83f73348c904eda2`
- `artifacts/api-server/src/inventario-existencias-agrupadas.mock.test.ts`  
  `e77d4e8a0a755ba1ec42d14dda70ffb6b7de7f347d0703612c095680d50fdc76`

Este informe y los dos logs son evidencia, no archivos de implementación. No se
creó commit; el agente principal realizará el commit separado después de la
revisión.

## Prueba offline y mutante aislado

El test transpila y ejecuta dentro de una VM allowlisted el handler real extraído
de `routes/inventario.ts`. Express, autorización, esquemas, `sql` y `db.execute`
son dobles locales; ningún módulo de base de datos se importa. El adaptador de
consulta aplica a fixtures el predicado observable producido por el query
builder y el handler real agrega la respuesta. Se comprueban producto activo e
inactivo, con y sin existencia, búsqueda y ubicación.

Mutante aislado: se elimina `p.activo = true` únicamente de la copia de fuente
en memoria mediante `INVENTORY_ACTIVE_FILTER_MUTANT=1`; ningún archivo vivo se
modifica. El proceso real falló con salida 1 porque apareció `Seda oculta`:

- `mutante-sin-filtro.log`  
  `cbead5a9e93f31145311a580d3bb5917aab71cd3043343b03b253daf5fdc9ee9`
- resultado: 1 prueba, 0 aprobadas, 1 fallida, `EXIT_CODE=1`
- aserción semántica: un producto inactivo se filtró a la respuesta agrupada
  con existencia.

Después de restaurar la fuente en memoria, se ejecutó el test nuevo junto con la
suite offline existente `inventory-status-semantics.test.ts`:

- `restaurado.log`  
  `012341a0df72fd3e6ded3e8141de2789f925b005b2f36d56ee784f7c04c49343`
- resultado: 7 pruebas, 7 aprobadas, 0 fallidas, `EXIT_CODE=0`
- aserción semántica: solo productos activos para existencia, cero, búsqueda y
  ubicación; se conservó además la cobertura offline existente.

Herramientas registradas: Node `v24.13.0`, pnpm `10.26.1`.
`git diff --check` terminó con salida 0 para los archivos de implementación.

## Límites de ejecución

Por restricción expresa no se accedió a ninguna base, no se ejecutó SQL, HTTP,
API, servidor, workflow, build, bundle, reinicio, instalación ni cambio de
dependencias o entorno. Por ello no se afirma validación PostgreSQL ni
verificación del runtime servido; la evidencia es exclusivamente VM/mock local
del query builder y handler reales.