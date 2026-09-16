# Prompt H — Bloques 2–3 renovados; purga NO autorizada

Fecha de la captura renovada: **15 de septiembre de 2026, America/Mexico_City**.

## Resultado vigente

| Comprobación | Resultado |
| --- | --- |
| API/workflow durante respaldo, Drive y preflight | Workflow `finished`; API pausada durante toda la secuencia; **no reiniciar** |
| Respaldo completo y restauración desechable | **PASS** |
| Drive privado, descarga y SHA-256 | **PASS**; hash fuente/descarga coincidente |
| Preflight de solo lectura | **COMPLETE_READ_ONLY**; `MATCHES_VERIFIED_BACKUP_AT_CAPTURE` |
| Tablas, conteos y huellas | **60/60 coincidentes** |
| Metadatos de esquema/base/ownership/ACL | **PASS**: 604 columnas/defaults, 286 constraints, 218 índices y 49 funciones |
| Secuencias | **45/45 coincidentes** |
| Triggers no internos habilitados | **14/14 coincidentes y enabled** |
| Purga | **NO AUTHORIZED / NO autorizada; NO ejecutada** |

La evidencia operativa de la pausa está en `reports/prompt-h/renovacion-api-pausado.md`. El workflow permaneció `finished` y la API no se reinició durante el respaldo, restauración local, verificación de Drive ni preflight. Este procedimiento no debe reiniciarla. No se ejecutaron `TRUNCATE`, `DELETE`, `UPDATE`, `INSERT`, `setval`, `ALTER SEQUENCE`, `RESTART IDENTITY`, seed, purga ni otra escritura en la fuente.

## Respaldo renovado

- Captura del respaldo: `2026-09-15 21:30:56 America/Mexico_City` (`2026-09-16T03:30:56.297Z` UTC).
- Dump custom privado: `.local/backups/prompt-h-block2-20260915213056-6573/prompt-h-block2-20260915213056-6573.dump`.
- Tamaño: **440802 bytes**.
- SHA-256: `4a5deaa825127629e26c3989ea76dab8800748dc177cb4fc7e6eebedf74489a6`.
- Restauración: `pg_restore` exit code `0`; cluster desechable persistente en el mismo directorio, con socket Unix-only.
- Evidencia: `reports/prompt-h/block2-restore.md` y `reports/prompt-h/block2-restore-metadata.json`.

La verificación de Drive está en `reports/prompt-h/block2-drive-verification.json`: archivo privado y owner-only, [enlace de Drive](https://drive.google.com/file/d/1ABt2lfoEXzulR7_4MJqudfgJNtFjthpK/view), descarga de `440802` bytes y `sourceSha256 = downloadedSha256 = 4a5deaa825127629e26c3989ea76dab8800748dc177cb4fc7e6eebedf74489a6`. La evidencia registra `apiPaused: true`.

## Preflight renovado

- Captura del preflight: `2026-09-15 21:34:45,640 America/Mexico_City` (`2026-09-16T03:34:45.640Z` UTC).
- Snapshot comparado: respaldo de `2026-09-15 21:30:56` (`2026-09-16T03:30:56.297Z` UTC).
- Freshness: **`MATCHES_VERIFIED_BACKUP_AT_CAPTURE`**.
- Evidencia completa por tabla y por objeto: `reports/prompt-h/block3-preflight.md`; metadatos estructurados: `reports/prompt-h/block3-preflight-metadata.json`.

La captura actual conserva C y sus conteos/huellas dentro de una transacción `REPEATABLE READ READ ONLY`. El preflight documenta **8 movimientos de crédito, 6 tickets (2 notas), 226 rollos, 6 entradas y 2 salidas**. Es evidencia de lectura del estado capturado; no se afirma ningún resultado posterior a una purga.

La comparación de Lista A está en `reports/prompt-h/comparacion-lista-a-anterior.md`: las **35/35** tablas conservaron el conteo; **34/35** conservaron conteo y hash; el único cambio fue `sesiones`, con **11 → 11** filas y hash diferente. El resultado actual del preflight renovado coincide con el snapshot nuevo; el detalle histórico del primer intento NO-GO se conserva únicamente como puntero en `reports/prompt-h/previous-live-api/resultado-bloques-2-3.md` y en los artefactos allí preservados. Ese NO-GO es histórico y no es el bloqueo actual.

## Objetivos B y límites

Los seis objetivos numéricos aprobados de B permanecen sin cambio y solo como objetivo report-only: `entrada_folio`, `salida_folio`, `viaje_folio` y `auditoria_inventario_folio` a `0` por sitio; `ticket_folio` a `999`; `series_consecutivo` a `1000000`. No se ejecutó ningún reset de identidad ni de secuencias: no hubo `RESTART IDENTITY`, `setval` ni `ALTER SEQUENCE`. `existencias` conserva su tratamiento separado de reconstrucción futura dentro de la misma transacción.

La decisión empresarial pendiente ya existente sobre `public.contenedores_folio_seq` se conserva sin resolver; no se inventa un objetivo, una pregunta adicional ni una autorización. La purga permanece **NO AUTHORIZED** y requiere autorización textual independiente antes de cualquier mutación.

## Hallazgos y límites

- Los guards de inmutabilidad de `auditoria` y `movimientos_credito` impiden `DELETE` por filas, pero un rol privilegiado podría eludirlos mediante `TRUNCATE`; se comprobó por inspección, sin prueba destructiva y sin afirmar explotación HTTP.
- `cuadre_fiscal_registros` continúa como deriva viva ausente de Drizzle; no se creó, borró ni modificó.
- Los defaults report-only `entrada_folio=99` y `salida_folio=499` permanecen sin corregir.
- El typecheck raíz final está acreditado por `reports/prompt-h/typecheck-final.txt`: **PASS**, 0 diagnósticos TypeScript, 0 fallas de parser y `EXIT_CODE=0`.

No se presenta comprobación posterior a purga, validación autenticada posterior ni reinicio de servicios. La evidencia actual solo acredita respaldo, restauración desechable, Drive y preflight de lectura.