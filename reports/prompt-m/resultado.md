# Prompt M — resultado del operador de defaults

## Estado: **COMMITTED**

- Modo: `apply`.
- Base efectiva: `heliumdb.public`; conexión directa mediante `DATABASE_URL` (URL y secretos omitidos).
- Identidad registrada: `postgres`; PostgreSQL `16.10`.
- Reloj de origen UTC/México: `2026-09-16 05:30:42.331 UTC` / `2026-09-15 23:30:42.331 America/Mexico_City`.
- Autorización: SHA-256 `4c25e87fee2eed7ebb175ae8c22169a9a2886bd372163f3fa9f5b6b640f01423`; autorización textual preexistente verificada.
- Cierre H: `APPROVED_BY_OWNER`; respaldo SHA-256 verificado `da7d3f7f342756511c6a04d000f0f4f4fa3feea6b9caad21e6abec5213dffb22`.

## Bloque 0 y puertas

- Filas del Bloque 0 comparadas: **46**; actuales: **46**.
- Dry-run READ ONLY: **PASS**.
- Defaults vivos pre-ALTER coinciden con Bloque 0: **PASS**.
- Todas las filas de contador intactas: **PASS**.

## SQL autorizado ejecutado

Solo estas tres sentencias DDL, en una transacción; no se ejecutó `drizzle-kit push`, no se importó la API y no se crearon usuarios o sesiones:

```sql
ALTER TABLE public.entrada_folio ALTER COLUMN ultimo_folio SET DEFAULT 0;
ALTER TABLE public.salida_folio ALTER COLUMN ultimo_folio SET DEFAULT 0;
ALTER TABLE public.series_consecutivo ALTER COLUMN ultimo_numero SET DEFAULT 10000000;
```

- Orden de locks: public.auditoria_inventario_folio SHARE → public.entrada_folio ACCESS EXCLUSIVE → public.salida_folio ACCESS EXCLUSIVE → public.series_consecutivo ACCESS EXCLUSIVE → public.ticket_folio SHARE → public.viaje_folio SHARE.
- DDL exacto ejecutado: **sí**.
- Estado de COMMIT reconocido: **COMMITTED**.
- No hubo reintento automático: **PASS**.
- Huella del operador ejecutado antes del arreglo de tipos: `143babe56b95f0564c7a202edfba993bddbbc2d38c82652a415d2f19d70a7387`.
- Huella final del archivo del operador: `9a57885a77c860fe195d128ed6e081210b0f94fa8cb978b334ce7cdbdda39e6a`.
- La evidencia de ejecución y el commit ya realizados se conservaron; no se reejecutaron el operador ni la prueba desechable.

## Prueba desechable

- Resultado: **PASS**; evidencia completa: `reports/prompt-m/operator-evidence.json`.
- Salida textual: `reports/prompt-m/test-output.txt`.
- Fixture local nuevo, sin datos de producción, usuarios ni sesiones; se hizo `ROLLBACK` y después se eliminó únicamente el cluster temporal.
- Defaults omitidos: entradas/salidas/viajes/auditoría `0`, ticket `999`, series `10000000`.
- Allocators equivalentes al SQL de la aplicación: primer folio de entrada `1`, primer folio de salida `1`, primera serie `10000001`.

## Verificación después

- Los seis `pg_attrdef` coinciden con el esquema: **PASS**.
- Las 46 filas antes/después son idénticas: **PASS**.
- Catálogos protegidos (`productos`, `precio_historial`) sin cambio y coincidentes con dry-run: **PASS**.
- Las 45 secuencias sin cambio, coincidentes con dry-run y sin `nextval`: **PASS**.
- Lectura READ ONLY post-COMMIT: **PASS**.

## Typecheck raíz

- `pnpm run typecheck`: **PASS**, 0 diagnósticos; salida: `reports/prompt-m/typecheck-final.txt`.
- El fallo anterior de dos diagnósticos se conserva sin modificación en `reports/prompt-m/typecheck-before-fix-failure.txt`.
- El arreglo usa la importación declarada `pg`/`@types/pg` del paquete de scripts y una captura estrechamente acotada del resultado de la transacción; no usa `ts-ignore`, `ts-expect-error` ni reejecuta la base.

## Verificación post-reinicio

- Estado de Prompt M tras la lectura fresca: **CLOSED_DB_AND_POST_RESTART_READONLY**.
- Evidencia: `reports/prompt-m/post-reinicio.json` / `reports/prompt-m/post-reinicio.md`.
- Captura: `2026-09-16 05:41:29.117 UTC` / `2026-09-15 23:41:29.117 America/Mexico_City`; `heliumdb.public`, PostgreSQL `16.10`, transacción `REPEATABLE READ READ ONLY`, `ROLLBACK` completado.
- Los seis defaults actuales coinciden con `0/0/0/0/999/10000000`: **PASS**.
- Las 46 filas actuales coinciden explícitamente, por clave y valor, con `reports/prompt-m/resultado.json`: **PASS**.
- Los hashes canónicos actuales de `productos` (`ec387f3b7a73aadcdf971c03b221a001`) y `precio_historial` (`995ad0f005ac98c01a8951f6acc37af1`) coinciden con el commit: **PASS**.
- No hubo escritura de fuente, importación de API, creación de usuarios/sesiones ni repetición de `ALTER`.
- MAIN confirmó startup limpio y ambos servicios `RUNNING`: API `Schema startup complete`/`Server listening` en 8080 con backfill `inserted=0`, Vite `ready` en 313 ms para 20329 y sin errores. Evidencia: `/tmp/logs/artifactsapi-server_API_Server_20260916_054036_802_977fa598.log`, `/tmp/logs/artifactsmariana-textil_web_20260916_054036_802_c5d8b9a8.log` y `reports/prompt-m/restart-health.txt` (API 200 `status=ok`, web 200 a las 05:40:37 UTC): **PASS**. No se solicita otro reinicio.

## Límites

- Este operador no detiene ni reinicia servicios; el API y sus escrituras concurrentes quedan fuera de su ciclo de vida.
- **Puerta de servicios: PASS.** Las comprobaciones administradas iniciales que encontraron puertos ocupados se conservan como historial; el reinicio normal posterior, autorizado por el propietario, pasó con los logs y health report citados arriba.
- Las escrituras normales de arranque en otras tablas tienen autorización separada. Este cierre no afirma que la base completa permanezca idéntica desde el commit DDL.
- Filas previas: `entrada_folio:1=0, entrada_folio:2=0, entrada_folio:3=0, entrada_folio:4=0, entrada_folio:5=0, entrada_folio:6=0, entrada_folio:7=0, entrada_folio:8=0, entrada_folio:9=0, entrada_folio:458=0, entrada_folio:531=0, salida_folio:1=0, salida_folio:2=0, salida_folio:3=0, salida_folio:4=0, salida_folio:5=0, salida_folio:6=0, salida_folio:7=0, salida_folio:8=0, salida_folio:9=0, salida_folio:458=0, salida_folio:531=0, viaje_folio:1=0, viaje_folio:2=0, viaje_folio:3=0, viaje_folio:4=0, viaje_folio:5=0, viaje_folio:6=0, viaje_folio:7=0, viaje_folio:8=0, viaje_folio:9=0, viaje_folio:458=0, viaje_folio:531=0, auditoria_inventario_folio:1=0, auditoria_inventario_folio:2=0, auditoria_inventario_folio:3=0, auditoria_inventario_folio:4=0, auditoria_inventario_folio:5=0, auditoria_inventario_folio:6=0, auditoria_inventario_folio:7=0, auditoria_inventario_folio:8=0, auditoria_inventario_folio:9=0, auditoria_inventario_folio:458=0, auditoria_inventario_folio:531=0, ticket_folio:1=999, series_consecutivo:1=10000000`.

