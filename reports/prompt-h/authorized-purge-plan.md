# Prompt H — plan del operador autorizado (documento previo al apply)

**Estado del plan:** `PREPARADO_PARA_REVISION_PRINCIPAL`. Estas líneas
conservan las puertas y el SQL auditado antes del apply; no describen el estado
final. El resultado ejecutado está en
`reports/prompt-h/block4-purga-verificacion.md` y
`.local/prompt-h-authorized-purge-status.json`, con
`COMMITTED_POSTCOMMIT_READ_PASS`. La API de source permaneció detenida y no se
reinició durante ese apply; el arranque posterior separado está documentado en
`reports/prompt-h/post-arranque-comparacion.md`.

## Autorización y evidencia vigente

- Cita exacta del propietario: `Autorizo la purga`.
- Archivo de autorización: `reports/prompt-h/autorizacion-purga.md`.
- Snapshot fuente: `.local/backups/prompt-h-block2-20260915214248-7517/source-snapshot.json`.
- Dump local y archivo descargado/verified de Drive: mismo SHA-256
  `da7d3f7f342756511c6a04d000f0f4f4fa3feea6b9caad21e6abec5213dffb22`.
- Metadatos de restauración local verificada:
  `.local/backups/prompt-h-block2-20260915214248-7517/restore-metadata.json`.
- Verificación Drive: `reports/prompt-h/block2-drive-verification.json`.
- Preflight vigente: `reports/prompt-h/block3-preflight-metadata.json` y
  `reports/prompt-h/block3-preflight.md`.
- Las clases se derivan en cada ejecución de `classification.listNames` del
  preflight vigente y se rechaza cualquier conjunto distinto de **A=35,
  B=7, C=18, total=60**. No se reutilizan las listas del operador histórico.

## Ruta exacta

1. Revalidar antes de abrir una transacción: cita del propietario, hashes del
   dump y descarga Drive, restauración local PASS, freshness PASS, identidad
   `heliumdb/public`, API detenida/puerto 8080 cerrado, metadatos de esquema,
   14 triggers enabled y 45 secuencias.
2. En modo predeterminado (`--dry-run` o sin argumento), abrir únicamente una
   transacción `REPEATABLE READ READ ONLY`; comparar las 60 tablas con conteo y
   hash canónico completo. No se hacen escrituras ni se intenta una reversión.
3. `--apply` requiere además la revisión principal explícita:
   `PROMPT_H_MAIN_REVIEW=APPROVED`. La ausencia de esta variable bloquea.
4. Importar `appDrizzle` y la función real
   `reconstruirCacheExistencias` solamente después de todas las puertas.
   No se importan `app.ts`, `index.ts`, inicializadores, semillas, usuarios ni
   autenticación.
5. Dentro de **una sola**
   `appDrizzle.transaction(async tx => { ... })`, en orden determinista:
   - `LOCK TABLE` A en `ACCESS EXCLUSIVE`, después B en `ACCESS EXCLUSIVE`,
     después C en `SHARE`;
   - revalidar bajo esos locks identidad, las 60 tablas, esquema/constraints/
     indexes/functions, estados/definiciones de los 14 triggers, conteos y
     hash completo de cada tabla, y los 45 valores de secuencia;
   - comprobar de nuevo el archivo de autorización y su SHA antes de escribir;
   - un único `TRUNCATE TABLE` de las 35 tablas A,
     `CONTINUE IDENTITY RESTRICT`, sin `CASCADE`;
   - seis `UPDATE` de filas B: cuatro contadores por sitio a `0`,
     `ticket_folio` a `999`, `series_consecutivo` a `1000000`;
   - `await reconstruirCacheExistencias(tx)` usando el mismo `tx`;
   - comprobar A vacía, B con objetivos exactos, C con conteo y hash completo
     exactos, `movimientos=0`, `rollos=0`, todos los pares de inventario
     consistentes, secuencias intactas y 14 triggers intactos/enabled.
6. Persistir evidencia por tabla capturada dentro de la transacción antes de
   devolver el callback. Un error antes del retorno depende del rollback
   automático de esa transacción; nunca se reintenta una mutación destructiva.
7. Después de la frontera de commit, hacer una captura directa de solo lectura
   y persistir su resultado sin reiniciar la API. Un error posterior al intento
   de commit queda como `COMMIT_STATUS_UNKNOWN_AFTER_COMMIT_ATTEMPT_NO_RETRY`;
   no se autoreintenta.

## SQL auditado

La lista real de identificadores se genera desde el preflight vigente y se
vuelve a comparar contra el snapshot. La forma exacta, sin nombres inventados,
es:

```sql
LOCK TABLE <A ordenada> IN ACCESS EXCLUSIVE MODE;
LOCK TABLE <B ordenada> IN ACCESS EXCLUSIVE MODE;
LOCK TABLE <C ordenada> IN SHARE MODE;

TRUNCATE TABLE ONLY <las 35 tablas A únicamente>
  CONTINUE IDENTITY RESTRICT;

UPDATE public.entrada_folio SET ultimo_folio = 0;
UPDATE public.salida_folio SET ultimo_folio = 0;
UPDATE public.viaje_folio SET ultimo_folio = 0;
UPDATE public.auditoria_inventario_folio SET ultimo_folio = 0;
UPDATE public.ticket_folio SET ultimo_folio = 999;
UPDATE public.series_consecutivo SET ultimo_numero = 1000000;

-- función real, no SQL sustitutivo:
await reconstruirCacheExistencias(tx);
```

No hay `DELETE`, `CASCADE`, `RESTART IDENTITY`, `ALTER SEQUENCE`, `setval`,
`ALTER TABLE ... DISABLE TRIGGER` ni `ENABLE TRIGGER` en la ruta.
`public.contenedores_folio_seq` forma parte de los 45 valores preservados y no
se inventa ni se aplica un objetivo.

## Riesgos que requieren revisión principal

- Cualquier tabla nueva, tabla ausente, deriva de catálogo, trigger no
  enabled/definición diferente, secuencia diferente, hash diferente o cambio
  de autorización aborta antes de la primera escritura.
- La autorización del propietario no sustituye la revisión principal; por eso
  `--apply` exige la compuerta separada `PROMPT_H_MAIN_REVIEW=APPROVED`.
- A incluye sesiones y movimientos: el commit invalida sesiones y elimina la
  evidencia operativa A. La API no debe arrancar durante la ventana.
- El `SHARE` de C preserva el catálogo, pero la operación todavía depende de
  que no aparezcan escritores inesperados; cualquier bloqueo o timeout revierte.
- La función de caché real podría fallar o revelar un par inconsistente; el
  callback propaga el error y no se reintenta.
- Un error después de que el callback termine puede dejar incierto el estado
  del commit; se registra durablemente y se detiene, sin segundo intento.
- La evidencia de secuencias se compara por los 45 nombres y valores del
  snapshot/preflight; no se hace una prueba que consuma `nextval`.

## Operador

`scripts/src/prompt-h-authorized-purge.mts`

- `--dry-run`/sin argumento: solo lectura.
- `--apply`: reservado para después de esta revisión principal explícita; el
  apply autorizado posterior quedó documentado en el Bloque 4 y no debe
  repetirse.
- Pruebas puras de plan/hash: `scripts/src/prompt-h-authorized-purge.test.mts`.
