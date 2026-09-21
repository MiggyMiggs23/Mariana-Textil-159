# A+C: procedencia INSERT segura ante SAVEPOINT

**Implementación inicial preparada; revisión independiente pendiente. No se ejecutaron los 51 casos ni se creó una base. No habilita apertura.**

## Autorización y fuentes

Se leyó literalmente la nueva autorización previamente guardada por coordinación en `e2-apertura-limitada/evidencia-a-c/autorizacion-propietario-subtransacciones-savepoint.txt`. La coordinación aclaró que se permiten objetos DDL auxiliares propios A+C. Se preservaron las condiciones previas, fixture, casos y evidencia anterior.

Base inspeccionada: `ff152eb93fc704183fcaf27aa79bd212b0644eca`. El commit exacto del candidato se entregará a coordinación antes de cualquier `git archive`; este informe forma parte del commit, por lo que no incluye su propio hash.

Se revisaron los tres SQL preparados, el informe corregido anterior (47 PASS, cuatro FAIL SAVEPOINT), las condiciones y revisión del harness, el runner corregido y las memorias de evidencia diferida, evidencia histórica, pagos dirigidos, secuencias y conservación del artefacto.

Había tres comparaciones de pertenencia usando `xmin` contra `txid_current() % 4294967296`: finalización del abono (línea original 94), prueba retenida (178) y guarda de aplicación tardía (334). Se corrigen las tres. `02` y `03` no tenían ese supuesto. La búsqueda en TypeScript de API/scripts no encontró otra comparación equivalente A+C: `credit-abono-evidence.ts` delega la finalización mediante el `Tx` recibido. Los usos de xmin para verificación de caché y txid para nombres de fixtures son ajenos. Las copias históricas permanecen intactas.

## Corrección inicial

Se añaden dos columnas propias A+C, `e2_insert_xid xid8`, una en cada fuente (`movimientos_credito` y `cobros_credito_pendientes_e1`). No hay DEFAULT ni backfill: filas históricas quedan NULL.

Una función trigger compartida, `e2_stamp_insert_transaction`, y dos triggers BEFORE INSERT OR UPDATE establecen:

- INSERT: siempre reemplazar cualquier valor suministrado por `pg_current_xact_id()`, identificador completo de la transacción superior.
- UPDATE: siempre conservar `OLD.e2_insert_xid`, ignorando intentos de alterar el marcador. Una versión nueva de una fuente vieja no se convierte en una recepción nueva.

Las tres comprobaciones usan esa procedencia en vez de xmin. La reversión elimina triggers/función/columnas bajo sus bloqueos y condiciones existentes, sin CASCADE. El preflight SQL verifica las dos columnas, triggers y cuerpo exacto de la función. El preflight TypeScript incluye columnas, triggers y hashes actualizados de las funciones modificadas; no se ejecutó su ruta runtime. No se añade tabla ni estado de sesión ni cambio de flags.

## Argumento de seguridad y límites

El marcador pertenece a la fila de origen, no a la versión MVCC de su header. Se escribe por un trigger normal en la misma operación:

1. Un hijo activo y uno liberado reciben el mismo xid8 superior. RELEASE no lo cambia. ROLLBACK TO revierte la fila/marcador junto con la escritura. Una fuente previa al SAVEPOINT conserva su identidad.
2. Un escritor ajeno tiene otro identificador completo. MVCC no expone sus escrituras no confirmadas; después de confirmar, el marcador distinto rechaza la fuente. Se mantienen los FOR SHARE existentes.
3. UPDATE de fuente histórica conserva NULL; UPDATE de fuente confirmada conserva el xid8 anterior. UPDATE de fuente nueva mantiene su identidad de INSERT. INSERT ON CONFLICT DO UPDATE termina conservando el marcador anterior por la rama UPDATE.
4. Un campo SQL xid8 conserva la época a través del wrap de XID de 32 bits. VACUUM/freezing del header no altera ese dato. No se reconstruye época desde xmin, no se usa visibilidad de snapshot como pertenencia y no se usa xmin >= topxid.
5. DML directo no puede falsificar el marcador: INSERT lo sobrescribe y UPDATE conserva OLD. El modelo presupone catálogo/triggers de confianza, igual que las guardas A+C existentes. No pretende resistir al propietario/superusuario que desactive triggers, cambie su orden/cuerpo, altere session_replication_role, haga restauraciones físicas o modifique directamente el catálogo. Un nuevo trigger capaz de escribir el marcador exige revisión del contrato; la ACL/endurecimiento global no queda probado.
6. No se ofrece garantía ante reutilización completa de xid8 de 64 bits ni restauración externa que cambie la identidad del clúster. Se cubre el wraparound ordinario de XID32 dentro del mismo clúster PostgreSQL.

Se descartó `pg_xact_status` sobre xmin reconstruido: una tupla congelada puede conservar xmin bruto antiguo que coincida con un XID reutilizado en curso. Ni `pg_snapshot_xip` ni la visibilidad de esa tupla resuelven su época.

## Compatibilidad estática y alcance

La creación de las dos tablas de evidencia se mantiene antes del nuevo DDL para conservar el rechazo atómico `42P07` esperado al instalar dos veces. La fixture sintética borra/recrea el esquema completo. Los contadores de los casos siguen refiriéndose a las cinco tablas existentes; no hay una tabla extra. La consulta de catálogo del caso preflight observa las dos tablas de evidencia sin excluir la comprobación adicional de procedencia que ahora realiza el SQL exacto. No se editaron expectativas ni casos.

La matriz de 51 casos sigue pendiente y no demuestra por sí sola todas las propiedades adicionales (DML de marcador, UPDATE de fuente vieja, wraparound); estos puntos se justifican por construcción y requieren la revisión independiente solicitada. No se afirma PASS de instalación, preflight SQL/TypeScript o semántica PostgreSQL.

Checks estáticos: `git diff --check`, correspondencia de todos los hashes de cuerpos SQL contra el preflight TypeScript y transpile de sintaxis TypeScript: PASS. No es typecheck completo ni ejecución de la aplicación. Hashes y estado en `e2-apertura-limitada/evidencia-a-c/postgresql-validacion-savepoint-20260921/static-review.json`. El INSERT posicional de retenidos del harness conserva sus expresiones originales; PostgreSQL permite omitir columnas finales sin lista explícita, dejando la columna añadida con NULL antes del trigger.

## Próximo paso y aislamiento

Revisión independiente del candidato antes de ejecutar. Después fijar commit y hashes, exportar esa revisión y repetir una sola vez los 51 casos intactos en PostgreSQL 16 nuevo, socket privado sin TCP. Si falla alguno, reportarlo sin corregir contra resultados. Destruir en finally y comprobar destrucción independientemente.

No se usó DB API, HTTP, clones E1/E10, paquetes, runtime preflight, workflows ni bundle. No se abrió captura/devolución. No hay cleanup pendiente porque no se creó ni inició clúster. La autorización nueva y el cambio ajeno en `reports/e2-correccion-sql-y-registro-arranques-20260921.md` no se incluyen en el commit.