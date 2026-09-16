# Prompt M — verificación post-reinicio (solo lectura)

## Estado: **PASS**

- Captura fresca: `2026-09-16 05:41:29.117 UTC` / `2026-09-15 23:41:29.117 America/Mexico_City`.
- Base: `heliumdb.public`; PostgreSQL `16.10`; usuario de sesión `postgres`.
- Transacción: `REPEATABLE READ READ ONLY`; ROLLBACK completado; no hubo escritura de fuente.
- Autorización de reinicio preexistente: `reports/prompt-m/autorizacion-reinicio.md`; SHA-256 `5c1ccf201c9c988bb4569c2ed959904748c538cdcf9a418e1dba743c47444fc1`.

## Comparación de los seis defaults

| Tabla.columna | Comprometido | Actual fresco | Coincide guard |
|---|---:|---:|:---:|
| `entrada_folio.ultimo_folio` | `0` | `0` | PASS |
| `salida_folio.ultimo_folio` | `0` | `0` | PASS |
| `viaje_folio.ultimo_folio` | `0` | `0` | PASS |
| `auditoria_inventario_folio.ultimo_folio` | `0` | `0` | PASS |
| `ticket_folio.ultimo_folio` | `999` | `999` | PASS |
| `series_consecutivo.ultimo_numero` | `10000000` | `10000000` | PASS |

- Los seis defaults actuales cumplen `0/0/0/0/999/10000000`: **PASS**.

## Comparación explícita de las 46 filas

- Filas comprometidas: **46**; filas actuales: **46**; comparación por clave en el JSON: **PASS**.
- Conteos por tabla: `{"auditoria_inventario_folio":11,"entrada_folio":11,"salida_folio":11,"series_consecutivo":1,"ticket_folio":1,"viaje_folio":11}`.
- Cada objeto `rows[]` del JSON conserva clave, valor comprometido, valor actual y booleano `matches_committed`; no se ocultaron filas iguales ni discrepancias.

## Hashes de catálogo protegido

- `productos`: 1234 filas; hash comprometido `ec387f3b7a73aadcdf971c03b221a001`; hash actual `ec387f3b7a73aadcdf971c03b221a001`; **PASS**.
- `precio_historial`: 1016 filas; hash comprometido `995ad0f005ac98c01a8951f6acc37af1`; hash actual `995ad0f005ac98c01a8951f6acc37af1`; **PASS**.
- Comparación de ambos hashes canónicos (productos, precio_historial): **PASS**.

## Alcance y límites

- Esta captura no repitió los ALTER, no ejecutó migraciones, no importó la API, no creó usuarios/sesiones y no realizó escrituras en la fuente.
- Las escrituras normales de arranque en otras tablas tienen autorización separada. Este resultado no afirma que la base completa permanezca idéntica desde el commit DDL.
- MAIN confirmó startup limpio y ambos servicios RUNNING: API `Schema startup complete`/`Server listening` en 8080, backfill `inserted=0`, Vite `ready` en 313 ms para 20329 y sin errores. Evidencia: `/tmp/logs/artifactsapi-server_API_Server_20260916_054036_802_977fa598.log`, `/tmp/logs/artifactsmariana-textil_web_20260916_054036_802_c5d8b9a8.log` y `reports/prompt-m/restart-health.txt` (API 200 `status=ok`, web 200 a las 05:40:37 UTC): **PASS**. No se solicita otro reinicio.
- Evidencia JSON completa, incluidos los 46 objetos de comparación: `reports/prompt-m/post-reinicio.json`.

