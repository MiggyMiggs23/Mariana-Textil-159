# Liberación simple — detenida tras instalar SQL E3

Fecha: 23 de septiembre de 2026.

## Regla y autorización

La autorización íntegra se guardó como primera escritura en
`reports/autorizacion-procedimiento-simple-y-liberacion-e3-tanda-b-20260923.txt`.
`replit.md` registra el procedimiento simple temporal, sus controles mínimos,
las suspensiones y su término al decidir el propietario operar con datos
reales. No se ejecutó la purga futura.

## Estado exacto

| Etapa | Resultado |
|---|---|
| Ensayo E3 en PostgreSQL desechable | PASS: SQL01 y SQL03 completos; candidato E3 arrancado de verdad; `/api/healthz` 200 |
| Limpieza del ensayo | `pgStopExit=0`, `disposableDestroyed=true` |
| SQL E3/01 en base efectiva de API PID195 | COMPLETED, exit0, COMMIT; incluye 12 inserciones de permisos reportadas por PostgreSQL |
| SQL E3/03 en esa misma base | COMPLETED, exit0, COMMIT |
| Configuración API para candidato E3 | Aceptada, pero no se reinició el workflow ni se llegó a servir E3 |
| Configuración UI para E3 | RECHAZADA antes de aplicarse por sintaxis TOML |
| Recuperación | Configuración API devuelta al bundle E2 anterior mediante invocación directa, sin preflight suspendido; PID195 E2 original sigue vivo |
| SQL de Tanda B | NO iniciado: ninguno de los cinco archivos ejecutado contra la base de la API |
| Candidato combinado E3 + Tanda B | Construido offline, NO servido ni ensayado contra PostgreSQL en esta intervención |

No se presenta E3 como liberada ni verificada en pantalla. Sus dos SQL sí
quedaron confirmados. No se presenta Tanda B como instalada.

## Motivo de detención y responsabilidad

Error al preparar la configuración de UI: las comillas de `"$PORT"` quedaron
sin escape dentro de la cadena TOML `run`. El validador devolvió
`ARTIFACT_SYNTAX_ERROR`, antes de modificar la configuración de la UI.
Es un error de preparación del agente, no del SQL ni del sistema de negocio.
No se corrigió el temporal ni se reintentó la configuración tras ese fallo,
siguiendo la instrucción de detener y reportar.

El archivo temporal rechazado se conserva como evidencia en
`artifacts/mariana-textil/.replit-artifact/artifact.simple.tmp.toml`.
La UI sigue usando su workflow anterior de desarrollo.
La API había recibido la configuración E3, pero su proceso no se había
reiniciado: seguía sirviendo E2. Se dejó el comando de API apuntando
directamente a `artifacts/api-server/dist-e2-20260927/index.mjs`, con
INSPECTION configurado para un futuro arranque y sin wrapper de comparación
de catálogo. No se modificó el bundle E2 ni se ejecutó un reinicio.

## Puertas y comprobación de recuperación

- El proceso observado sigue siendo PID195, iniciado el 23/09/2026 a las
  15:34:56 UTC, con `dist-e2-20260927/index.mjs`.
- El GET de salud de la API por el proxy devolvió 200 y `{"status":"ok"}`.
- E3 ordinario/efectivo NO quedó abierto en la aplicación servida: no se
  sustituyeron API/UI por el candidato E3.
- **En PostgreSQL sí cambió la guarda de efectivo E1**: SQL03 ya admite el
  caso autorizado INGRESO_FISICO/ABONO/ABONO_ORDINARIO. Esto no equivale a
  que la UI o el backend E2 sirvan el flujo nuevo.
- Dirigido, retenido, devolución, atribución, Fondo y remate no se abrieron
  en la aplicación. No se activó ninguna puerta de Tanda B.
- La vuelta al bundle anterior NO deshizo SQL01/SQL03 ni las filas de
  permisos insertadas. No hubo rollback de base ni restauración de respaldo.

La salud del proceso anterior no demuestra compatibilidad funcional completa
con todo el esquema ampliado. Se conserva esa limitación explícitamente;
no se fabricaron recibos, usuarios ni operaciones de prueba en la base API.

## Evidencia

- `rehearse-e3-primer-ensayo/status.json` y logs fixture/e3-1/e3-2/candidate.
- `apply-e3-primera-aplicacion/status.json` y logs e3-1/e3-2: ambos COMMIT.
- `api-before.toml.txt` y `ui-before.toml.txt`: comandos anteriores conservados.
- `combined-source-review.json` y `combined-build.json`: preparación offline,
  distinta de una liberación.
- Las instantáneas auxiliares de filas usadas por el operador no se incluyen
  en la entrega: contienen datos de la aplicación y se eliminan al cerrar;
  se conservan los resultados, estados y logs SQL, no copias de usuarios.

## Pendientes desde pantalla y antes de continuar

Requiere nueva instrucción del propietario tras este reporte para corregir
la configuración de UI y continuar la operación detenida. NO repetir
SQL01/SQL03 a ciegas: ya están instalados.

Después de servir correctamente E3 deben probarse desde pantalla, con
operaciones de prueba expresamente autorizadas: visibilidad según permiso,
abono ordinario en efectivo, destino/caja, emisión y reimpresión del recibo,
saldo y reflejo contable; verificar que dirigido/retenido/devolución y demás
funcionalidades excluidas permanezcan cerradas.

Solo después de verificar E3 corresponde ensayar e instalar Tanda B,
manteniendo E3 ordinario abierto en el candidato combinado. Faltan el ensayo
PostgreSQL de esa secuencia, sus cinco SQL reales, el arranque combinado y
las verificaciones de UI/API. No se reanudó nada tras el fallo.