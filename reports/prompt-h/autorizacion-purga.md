# Autorización textual del propietario — purga de Prompt H

Fecha de recepción: **15 de septiembre de 2026**, America/Mexico_City. La hora exacta del mensaje no está disponible; los instantes de ejecución se registrarán por separado.

## Cita textual íntegra

> Autorizo la purga

## Contexto y alcance autorizado

Autorización recibida después de presentar directamente en el chat el preflight de **2026-09-15 21:48:10** y el respaldo restaurado de **2026-09-15 21:42:48**:

- Respaldo: `.local/backups/prompt-h-block2-20260915214248-7517/prompt-h-block2-20260915214248-7517.dump`.
- SHA-256: `da7d3f7f342756511c6a04d000f0f4f4fa3feea6b9caad21e6abec5213dffb22`.
- Drive: `https://drive.google.com/file/d/10PvcuYFcbmmCuGbLRkIEULiz0zlb05FC/view`.
- Listas: A=35, B=7, C=18; 60 tablas, 14 triggers no internos.
- Vaciar solo A mediante TRUNCATE **sin RESTART IDENTITY**, sin CASCADE.
- Reiniciar `entrada_folio`, `salida_folio`, `viaje_folio`, `auditoria_inventario_folio` a **0 por sitio**; `ticket_folio` a **999**; `series_consecutivo` a **1000000**.
- Reconstruir `existencias` mediante la función real con la misma transacción.
- Conservar íntegramente las 18 tablas de C, incluidos productos, colores, historial de precios y bitácora.
- No modificar ni deshabilitar triggers. No reiniciar IDs internos ni sus secuencias.

`contenedores_folio_seq` se conserva sin reinicio: no se inventa un objetivo para la cuestión que se presentó como pendiente. No se autoriza corregir defaults, cambiar longitudes de serie, crear usuarios/sesiones ni resolver otros asuntos financieros.

Este archivo se guardó **antes de ejecutar cualquier escritura de la purga**. La ejecución exige revalidar la identidad y la igualdad con el respaldo/preflight bajo bloqueo transaccional; cualquier diferencia bloquea la purga. La evidencia del commit se distinguirá de posibles efectos del posterior arranque normal.