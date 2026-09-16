# Prompt H — respaldo verificado y preflight; purga NO autorizada

Fecha: 15 de septiembre de 2026, America/Mexico_City.

## Resultado

| Comprobación | Resultado |
| --- | --- |
| Identidad obtenida desde el pool del proceso API | Confirmada: heliumdb, PostgreSQL 16.10 |
| Respaldo completo y restauración desechable | PASS para el snapshot de 21:12:30 |
| Comparación de las 60 tablas, conteos y huellas | PASS |
| Columnas, restricciones, índices, funciones, secuencias y ownership/ACL | PASS |
| Triggers no internos, definiciones y estados habilitados | 14/14 coincidentes |
| Drive privado, descarga y SHA-256 | PASS |
| Preflight de 21:21:47 | Completado en solo lectura; **NO-GO por cambios posteriores al respaldo** |
| Typecheck completo | 0 errores, exit 0 |
| Purga | **NO autorizada; NO ejecutada** |

No se reinició la API ni se crearon usuarios, ADMIN o sesiones de aplicación. La restauración completa contiene los datos originales para verificación; los roles locales sin login necesarios para restaurar ownership/ACL no son usuarios nuevos de la aplicación. La base desechable permanece disponible mediante socket Unix privado, sin escucha de red.

## Respaldo

- Ruta: `.local/backups/prompt-h-block2-20260915211230-4200/prompt-h-block2-20260915211230-4200.dump`
- Tamaño: **440704 bytes**.
- SHA-256 original y descargado: `c2022931971513cb0c411e61ca3251f62e6a806fe358ebc373b93cbe13ea2abb`.
- [Archivo privado de Drive](https://drive.google.com/file/d/1-ovp55uY1HTP1mmp6-xOfMvynboXFocK/view).
- Restauración preservada: directorio `restore-cluster` junto al dump; base `restore_disposable_20260915211230-4200`.

## Correcciones aprobadas, todavía sin aplicar

| Contador | Objetivo | Primero posterior |
| --- | ---: | ---: |
| entrada_folio, salida_folio, viaje_folio, auditoria_inventario_folio | 0 por sitio | 1 |
| ticket_folio | 999 | 1000 |
| series_consecutivo | 1000000 | 1000001 |

El eventual TRUNCATE de A no usará RESTART IDENTITY. Se preservan IDs internos y sus secuencias para evitar que referencias de la bitácora conservada adquieran un significado distinto. `existencias` se reconstruirá usando la misma transacción, no se truncará manualmente. Ninguna de estas operaciones se ejecutó.

El folio de negocio `contenedores_folio_seq` queda señalado aparte, sin objetivo inventado ni reinicio ejecutado; su tratamiento deberá resolverse antes de autorizar la ejecución.

## Por qué el preflight no habilita una purga

| Elemento | Snapshot verificado | Preflight |
| --- | --- | --- |
| auditoria | 3285 filas | 3286 filas; huella distinta |
| sesiones | 11 filas | 11 filas; huella distinta |
| ubicaciones | 11 filas | 11 filas; huella distinta |
| auditoria_id_seq | 3964 | 3965 |

La causa de estos cambios no se atribuye sin evidencia. No hubo escrituras de estos procedimientos en la base fuente. El respaldo sigue acreditado para su instante, pero no representa exactamente el estado posterior. Antes de una purga se necesita una referencia renovada y verificada bajo control de escrituras concurrentes, un preflight actualizado y una autorización textual independiente. Este reporte no solicita ni concede autorización de purga.

## Hallazgos documentados sin corregir

- **14 triggers vivos, no 11.**
- `cuadre_fiscal_registros` existe en la base y no está declarada en Drizzle: deriva de esquema, sin cambios a la tabla o al esquema.
- Los triggers append-only impiden DELETE, pero no TRUNCATE de un rol con privilegios: la inmutabilidad de `auditoria` y `movimientos_credito` puede eludirse por esa vía. Se comprobó por inspección, sin prueba destructiva; no se afirma una explotación desde HTTP.
- Defaults de entrada 99 y salida 499 conservados sin corregir.

## Evidencia

- `aprobacion-listas-no-purga.md`: texto del propietario y alcance.
- `api-pool-identity-2026-09-15.md`: consulta desde el proceso real; inspector local cerrado.
- `block2-restore.md`: comparación tabla por tabla y consultas.
- `block2-restore-metadata.json`: resultados estructurados.
- `block2-drive-verification.json`: permisos, enlace, tamaño y hashes.
- `block3-preflight.md`: conteos A, valores B, huellas C, listado de folios/series que se perderían, restricciones y diferencias.
- `block3-preflight-metadata.json`: consultas y salidas del preflight.
- `typecheck-final.txt`: salida completa del verificador.

No se presenta comprobación posterior a purga, validación autenticada del catálogo ni reinicio de servicios: no corresponde afirmar esos resultados sin ejecutar una purga autorizada.