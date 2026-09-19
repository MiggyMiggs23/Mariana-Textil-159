# Revisión independiente del resultado PostgreSQL

Revisión documental, sin conexión PostgreSQL, ejecución SQL, arranque ni modificación del candidato. Fuentes: `run-1789790527925/{manifest.json,commands.log,postgres.log,terminal.json}`, `resultado-postgresql.txt`, harness y exportación exacta comparada con `git show`.

## Dictamen

**FAIL real de instalación del candidato** `f8818255bcb11784c422cc559c3273e1f2e25aa9` en PostgreSQL 16.10, antes de COMMIT. El SHA-256 de la exportación y del contenido obtenido directamente de esa revisión coincide:

`dd99574f022b4d325a73238bf0d1e348e015003d2dad3ebc9de00ede8b094cbd`.

El fixture y los dos fragmentos CLOSED terminaron con salida 0. La invocación posterior usa `psql -X -v ON_ERROR_STOP=1 -f` sobre el archivo exacto; no envuelve, interpola ni reescribe su función. PostgreSQL registra el error al crear `e2_validate_abono_finalization`; psql devuelve 3, indicando línea 150 del archivo y línea 39 del cuerpo. No es un rechazo de los datos sintéticos ni un error del cliente al localizar el archivo.

La causa probable es la expresión CASE sin agrupación dentro de la condición PL/pgSQL IF: el lector de la condición encuentra el THEN del CASE antes del THEN que cierra la condición IF, dejando una expresión SQL incompleta. La localización del error concuerda con esa explicación. **No se ha probado ninguna corrección ni se afirma que corregir ese punto elimine otros defectos.**

## Alcance de las conclusiones

Reversión, catálogo exact03, commit diferido, rollback inducido, SAVEPOINT/xmin, reintentos y concurrencia quedaron **BLOQUEADOS, no aprobados**. La disposición del informe principal es correcta. Las observaciones previas sobre esos comportamientos siguen siendo hipótesis o cobertura preparada, no resultados PostgreSQL.

Matiz necesario: la frase «no installed catalog exists» no cuenta con una consulta de catálogo posterior al fallo. El registro muestra BEGIN y creación provisional de objetos, pero ningún COMMIT de instalación. La reversión al terminar la conexión es la consecuencia transaccional esperada; no se midió independientemente el catálogo antes de destruir la base. No presentar esto como una prueba ejecutada de ausencia de objetos residuales o de atomicidad de todos los fallos.

## Destrucción

`commands.log` documenta DROP DATABASE de la única base de prueba con salida 0, parada con salida 0 y estado posterior «no server running» con salida 3; el servidor registra su apagado. El harness comprueba ausencia de PID y socket y elimina/verifica el directorio privado. `terminal.json` conserva `cleanupError: null` y `rootRemoved: true`. La ausencia de PID/socket está respaldada por esas aserciones completadas, no por campos individuales del JSON. La inspección OS independiente corresponde al agente principal.

No procede otra ejecución completa ni una modificación del candidato bajo esta revisión.