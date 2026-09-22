# Paquete operativo E3 CLOSED — preparado, no liberado

## Estado y límites

Este paquete está **PREPARADO Y VALIDADO, NO LIBERADO** sobre la fuente exacta
`95128fc8f2773907c6a34ef2cfeb1f631e84f301`. No se reinició la API operativa,
no se modificó ningún workflow, no se hizo ninguna petición a la API real y no
se aplicó SQL a su base. El runtime E2 retenido y su bundle permanecieron
intactos. La única lectura real fue PostgreSQL READ ONLY.

El candidato servido en el ensayo fue CLOSED/INSPECTION: E3, E3 dirigido,
remate y retiro de la guarda de efectivo siguieron apagados. Los SQL 03 y 04
son referencias bloqueadas `NO-APLICAR`; nunca se usaron. No se afirma una
instalación real.

## Bloqueos para una liberación futura

1. **Bloqueo técnico de recaptura solo ADMIN.** La decisión de negocio ya está
   resuelta: las recapturas son exclusivamente ADMIN. Sin embargo,
   `routes/e3-collections.ts:44-50` exige
   `clientes_recapturas/crear`, pero no contiene un veto ADMIN explícito.
   Hoy la clausura está garantizada por `E3_ENABLED=false` y por la matriz
   preparada en falso. Antes de habilitar E3 se debe implementar y comprobar
   la exclusividad ADMIN incluso si otro rol recibe ese permiso. Este paquete
   CLOSED no autoriza ni permite presentar E3 como activable tal cual.
2. **DECISIÓN DEL PROPIETARIO pendiente: apertura de efectivo / SQL 03.** La
   preparación de esquema (SQL 01) y servir CLOSED son separables de retirar la
   guarda ordinaria de efectivo. Ningún texto de este paquete autoriza
   automáticamente SQL 03, SQL 04 ni E3 ON.

La recaptura solo ADMIN no vuelve a pedirse como decisión: está resuelta. Lo
pendiente es su cumplimiento técnico demostrable antes de una apertura.

## Baseline y proyección

- B0 real es el E2 B1 operativo: catálogo leído con
  `REPEATABLE READ READ ONLY` y `ROLLBACK`, usando el mismo `DATABASE_URL`
  efectivo del PID retenido, comparado internamente sin guardar credenciales.
- `pg_dump --schema-only` se ejecutó con
  `default_transaction_read_only=on`, conservando owners y ACL y sin copiar
  usuarios ni filas reales.
- PostgreSQL `pg_dump` renumera los `enumsortorder` fraccionarios al restaurar.
  En la copia desechable se restauraron los valores exactos desde la captura
  READ ONLY antes de comparar. B0 local coincidió completamente con B0 real,
  incluidos enums y triggers ALWAYS.
- B1 proyectado es exclusivamente B0 + `sql/01-install-prepared.sql`.
  Conservó todas las filas semánticas preexistentes. No se aplicó 03 ni 04.

Expectativas finales:

- B0 catálogo: `89c445d53c3db7d8cb3a45bdab49f82acb12943d62084eced21ab3af5cf5a358`
- B0 atributos: `597213c727c1b825a480720b0484badf26c17a02309fba8cd57d72af0e7a7665`
- B1 catálogo: `1f184dc7f5775f1ca48faa618c7daae2ffc33f09ab1f12ecb70cf153787e341e`
- B1 atributos: `e360831b5e3d0ea63408d8c592d4bc88ea33eb0340d3e25896e2b6feb50cfe24`
- SQL 01: `15754c178aa05204cfaabd0dc17c9907e76db6d7553e9ddbadb0b4197d291c87`

## Outputs finales

- API: `/home/runner/workspace/artifacts/api-server/dist-e3-20260922`
- API `index.mjs`:
  `753a9996b7249ff6227787318f5e6d0b929fd712dd4cd4e068ee8275f636d942`
- Frontend:
  `/home/runner/workspace/artifacts/mariana-textil/dist-e3-20260922`
- Inventario integral de ambos outputs, assets, workers, fuentes y controles:
  `release-assets.sha256`
- Wrapper candidato: `api-start-audit.sh`; no está conectado a un workflow.

El frontend compilado contiene “Llenar cantidades” y no “Captura en Lote”. El
bundle API contiene las exportaciones XLSX/PDF preparadas. Fuente y bundle
incluyen la conexión de remate, con sus gates API/UI en falso, y E3/E3 dirigido
en falso.

## Ensayo real del candidato

El wrapper verificó hashes antes y después del preflight, ejecutó el preflight
B1 real contra PostgreSQL local nuevo por socket privado y arrancó el bundle
final en modo INSPECTION. `/api/healthz` respondió 200. `strace` atribuyó la
apertura absoluta de `thread-stream-worker.mjs` y `pino-pretty.mjs` al proceso
del ensayo. Antes/después coincidieron catálogo semántico, conteos **y hashes
canónicos deterministas de los valores de todas las filas de las 74 tablas**,
además de valores e `is_called` de todas las secuencias. Cada hash de tabla
ordena `to_jsonb(fila)::text`, conserva duplicados y codifica cada fila en hex
antes del SHA-256; por ello no depende del orden físico. No se importaron
initializers ni se ejecutaron backfills.

Después de aprobar esa comparación y detener el candidato, un control real
modificó un booleano de una fila de `permisos_rol` únicamente en la base
desechable: el conteo siguió en 12 y el hash cambió de
`fac966b0b1d9ad833a7bd6d02c834c23604b83a4ef6489abee98fab240018e68`
a `cab95debfb66584f04af88039c9509a6aee151965365b0054a4e782b6c1695da`.
No es una escritura de arranque ni un falso verde; prueba sensibilidad y el
cluster se destruyó inmediatamente en `finally`.

Se conserva la política E2 aprobada: un fallo de append de auditoría emite
`WARNING` y no cambia por sí solo la decisión del wrapper. El arnés de ensayo,
sin embargo, **no puede quedar verde sin el registro efectivo**: exigió una
entrada exec con PID que correspondía al proceso bundle vivo, hash exacto,
modo INSPECTION y preflight `passed`/exit 0. No se implementó un fail-closed de
auditoría no autorizado.

Controles negativos finales rechazaron: hash alterado en copia aislada,
identidad distinta, drift de catálogo y gate E3 activo. El drift fue restaurado
solo en la base desechable. El candidato, PostgreSQL y todos los directorios
desechables fueron detenidos/destruidos en `finally`.

### Incidencias conservadas

La primera proyección detectó correctamente la renumeración de enums por
`pg_dump`; dos intentos fallidos y sus cierres terminales se conservan. El
primer arranque abortó por un nombre de tabla de control incorrecto. En el
segundo, la primera implementación del control de hash siguió un symlink y
alteró el **output candidato E3**, nunca el bundle E2 activo. Se conservó el
fallo, se recompiló el directorio final desde fuente congelada y se verificó
todo el inventario antes del ensayo exitoso. No se presenta ninguno como verde.

## Evidencia principal

- `evidencia/live/read-only-capture.json`
- `evidencia/live/catalog-B0-real.json`
- `evidencia/proyeccion/projection-result.json`
- `evidencia/proyeccion/accepted-additions.json`
- `evidencia/arranque-candidato/candidate-start-results.json`
- `evidencia/arranque-candidato/before-startup.json`
- `evidencia/arranque-candidato/after-startup.json`
- `evidencia/arranque-candidato/row-value-sensitivity-control.json`
- `evidencia/arranque-candidato/candidate-start-audit.jsonl`
- `evidencia/arranque-candidato/candidate-worker-open.trace`
- `manifest.json`, `release-assets.sha256`, `package-integrity.sha256`

Los logs originales y códigos de salida se conservan. El informe único de Tanda
A corresponde a MAIN y no forma parte de esta documentación operativa.