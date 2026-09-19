# Resultado Tarea 5

**Inventario confirmado: 28**, derivado de los archivos del reporte de verificación
sin población y sus inserciones reales, no del manifiesto Prompt S.
Ver `clasificacion.md` (28 filas) e `inventory.json` (rutas, líneas y hashes).

Se adaptaron **obligaciones separables de tres suites**, no tres integraciones completas:
permisos, redacción TERMINAL de productos-cache y confidencialidad SUPERVISOR de
role-access-matrix. Un archivo nuevo contiene tres pruebas con múltiples escenarios
observables sobre los módulos reales. Las 28 suites originales están intactas y no
se ejecutaron. Veinticinco quedan b; las tres a parciales conservan residual b.
Cada fila detalla qué exige una base desechable; las fronteras protegidas quedan
explícitamente bloqueadas/no mutables.

## Ejecución aceptada

- Base Git observada: `173b7cf1373c7fb568209453721dbf510c5b1d38`.
- Árbol de ejecución capturado: `1735437cb9604914685cc0d7dcea821d0e4a993a`.
- Node `v24.13.0`; TypeScript instalado `5.9.3`.
- Comando: `node reports/tanda-nocturna-20260919/tarea-5/run.mjs`.
- Verde inicial: **3/3**, exit 0.
- Tres mutantes en copias temporales: **cada test falla por ERR_ASSERTION**,
  exit 1, restantes dos tests verdes.
- Cada restauración: **3/3**, exit 0; verde final: **3/3**, exit 0.
- Hashes de las entradas y las 28 suites originales iguales antes/después.
- Ver `green.log`, `red-*.log`, `restored-*.log`, `final-restored.log`,
  `mutation-results.json` y `execution-identity.json`.

Se conserva también el intento preliminar bloqueado por el nuevo import concurrente
de Tarea 4; fue revisado e incluido como dependencia real de constantes cerradas.
No se cuenta ese fallo de aislamiento como prueba de mutante.

**Cero DB, SQL ejecutado, API, creación de actores/sesiones o cambios de producción
por Tarea 5.** Sin build/dist, reinicios, env/deps, cambio de política de pruebas ni
edición de archivos protegidos. Sin mutación de archivos activos para el rojo.
Sin commits: el commit y el typecheck raíz de cierre quedan al agente principal.
No afirmar que las 28 integraciones pasaron ni que se verificaron login, SQL o E2E.