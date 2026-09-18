# E1 — migración operativa aplicada

Estado: **PASS — COMMITTED_VERIFIED**. API pausada durante la ejecución y después; no se ha autorizado ni realizado su reanudación.

Autorización previa: autorizacion.md. SQL aplicado: reports/e1-ensayo-2026-09-17/operativo-propuesto/01.sql, SHA-256 680f8f4d339d20775dabeb540c43d4945391652f1eabd6e0162f3a1ca48ce57f.

## Ejecución y conservación

- 27/27 sentencias confirmadas; COMMIT enviado y respuesta confirmada.
- Identidad exacta y comparación completa contra el respaldo inmediatamente antes del DDL: PASS, cero objetos E1.
- Tiempo hasta confirmar COMMIT: 1108.736 ms.
- Total supervisado, incluido preflight dentro de la transacción y cierre de conexiones: 1114.729 ms.
- Bloqueo S08 adquirido → COMMIT confirmado: 605.572 ms.
- Supervisor total de 30 segundos activo, no agotado. Conexión de control abierta antes de BEGIN.
- Las 63 tablas previas conservaron conteos y huellas de todos sus campos; los tres movimientos conservan importe, fecha y contenido originales.
- Las siete columnas nuevas de los históricos siguen NULL. No hubo recaptura ni atribución.
- Tablas: 63 → 66. Triggers no internos: 17 → 23. Los anteriores conservaron definición/estado; también sus triggers internos y las 47 secuencias, incluyendo estado completo operativo.
- Tres tablas E1 nuevas vacías; ninguna captura activada.
- Comprobación posterior desde conexión nueva READ ONLY: resultado confirmado, no se presumió rollback ni se repitió DDL.
- Clon desechable y respaldo de Drive conservados; no se borraron ni alteraron durante la migración.

## Intentos previos conservados

1. ejecucion.json: el control de IPv6 encontró /proc/net/tcp6 ausente. Se detuvo ANTES de abrir conexiones a la base, cero sentencias.
2. ejecucion-after-ipv6-probe.json: tras BEGIN y cinco SET, el controlador devolvió name[] como texto en vez de array JavaScript. Se confirmó en READ ONLY que el esquema era correcto; hubo ROLLBACK confirmado y comparación integral con el respaldo PASS. Cero DDL y cero COMMIT enviados.
3. ejecucion-after-name-array.json: usó to_json(current_schemas(false)) para verificar la representación correcta, sin relajar la identidad. Ejecutó por única vez el DDL autorizado y confirmó su resultado.

Los reintentos fueron explícitos y condicionados a la evidencia de ausencia de DDL/COMMIT; cada uno conserva un archivo de ejecución único. No se eliminó ningún informe anterior. El SQL autorizado nunca cambió.

## Tiempos por sentencia

| Sentencia | Resultado | Milisegundos |
|---|---|---:|
| S01 | PASS | 0.420 |
| S02 | PASS | 0.428 |
| S03 | PASS | 0.261 |
| S04 | PASS | 0.308 |
| S05 | PASS | 0.224 |
| S06 | PASS | 0.232 |
| S07 | PASS | 14.285 |
| S08 | PASS | 0.735 |
| S09 | PASS | 87.204 |
| S10 | PASS | 287.183 |
| S11 | PASS | 20.817 |
| S12 | PASS | 69.656 |
| S13 | PASS | 3.045 |
| S14 | PASS | 4.643 |
| S15 | PASS | 93.148 |
| S16 | PASS | 2.688 |
| S17 | PASS | 0.715 |
| S18 | PASS | 1.484 |
| S19 | PASS | 0.596 |
| S20 | PASS | 0.685 |
| S21 | PASS | 1.415 |
| S22 | PASS | 0.419 |
| S23 | PASS | 2.064 |
| S24 | PASS | 0.731 |
| S25 | PASS | 0.585 |
| S26 | PASS | 0.838 |
| S27 | PASS | 19.276 |

## Límites de verificación

Este informe acredita la migración y conservación, no que el código de E1 esté listo para operar. La validación del código se documenta separadamente. La autorización de escritura no incluye fixtures financieros, ni siquiera en el clon; no se ejecutan pruebas transaccionales de aplicación hasta contar con alcance textual específico. No se crean usuarios ni sesiones de prueba. La API continúa pausada.
