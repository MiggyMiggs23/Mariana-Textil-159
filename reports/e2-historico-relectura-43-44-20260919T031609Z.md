# Relectura histórica E2 — sesiones cerradas 43 y 44

## Resultado

**MATCH en las seis lecturas (detalle, historial y admin de cada sesión). Ambos cierres son legacy, sin `cashSnapshot`.** No es aceptación integral de E2 ni prueba de que se utilizara su nueva fórmula de captura.

El cierre **no guardó `efectivoEsperado` como campo independiente**. Guardó `efectivoContado` y `diferencia` en la auditoría. El esperado implícito se obtiene exclusivamente de esos valores persistidos:

`esperado implícito del cierre = efectivoContado guardado − diferencia guardada`.

No se presenta un cálculo desde movimientos actuales como si fuera un campo guardado. La comparación directa de un campo `efectivoEsperado` persistido no está disponible; sí se puede contrastar el esperado implícito respaldado por la auditoría de cierre.

| Sesión / sitio | Nota | Fondo inicial | Contado guardado | Diferencia guardada | Esperado implícito del cierre | Lector E2 | Delta lector − cierre implícito | cashSnapshot |
|---|---:|---:|---:|---:|---:|---:|---:|---|
| 43 / Cruces | 1000 | $1,500.00 | $0.00 | −$1,500.00 | $1,500.00 | $1,500.00 | $0.00 | No; legacy |
| 44 / Mariana | 1001 | $1,500.00 | $1,500.00 | $0.00 | $1,500.00 | $1,500.00 | $0.00 | No; legacy |

Cruces tiene una diferencia de efectivo de **−$1,500.00** porque el cierre guardó contado cero frente a fondo inicial de $1,500.00. Esa diferencia de caja no es un desacuerdo entre lector y cierre.

## Evidencia guardada por los cierres

- Sesión 43: `CERRADA`, `cerrada_at = 2026-09-19 03:13:43.38+00`; auditoría `4183`, acción `CERRAR_CAJA`, entidad `sesiones_caja`, entidad ID `43`.
  - `datos_despues = {"diferencia":"-1500.00","efectivoContado":"0.00"}`.
- Sesión 44: `CERRADA`, `cerrada_at = 2026-09-19 03:14:04.679+00`; auditoría `4184`, misma acción/entidad, entidad ID `44`.
  - `datos_despues = {"diferencia":"0.00","efectivoContado":"1500.00"}`.
- Una auditoría de cierre por sesión. Ninguna contiene la clave `cashSnapshot` ni la clave `efectivoEsperado`.
- Ambas notas siguen con `cobrado=false`, `cobrado_at=NULL` y cero renglones en `ticket_pagos`. Totales de nota: 1000, $16,000.00; 1001, $4,900.00. Esos totales no son efectivo cobrado.
- En cada sesión: pagos en efectivo legacy $0.00 y salidas de `CAJA_FISICA` $0.00.

Los cierres ocurrieron el 18 de septiembre a las 21:13:43.380 y 21:14:04.679, respectivamente, en Ciudad de México (UTC−06).

## Fórmula del bundle y comportamiento del lector

Se revisó, sin ejecutar ni modificar, `artifacts/api-server/src/lib/pos.ts` del commit fuente autorizado del bundle:

- `buildCorteCaja` calcula `esperado = fondoInicial + formas.EFECTIVO − salidasPorCuenta.CAJA_FISICA`.
- `cerrarSesionCaja` guarda estado/fecha/contado, obtiene ese corte y registra en auditoría únicamente `efectivoContado` y `diferencia`; no guarda `cashSnapshot`.
- Para estos dos cortes: **$1,500.00 + $0.00 − $0.00 = $1,500.00**.

El lector real `readSessionCash`, al recibir una sesión cerrada sin snapshot, retorna los importes legacy proporcionados por la superficie; no reconstruye un snapshot ni llama al lector de caja abierta. El operador conserva las tres fórmulas legacy: detalle e historial descuentan salidas; admin conserva su omisión histórica de salidas. En estos cortes no hay salidas y las tres coinciden. No se generaliza esa coincidencia a otros casos.

## Revisiones e integridad

- HEAD ejecutado por el operador: `bf22d61c54d64454e45986803ac458cfa328871f`.
- El operador registró `dirty: false` al capturar, antes de escribir el informe nuevo.
- Última revisión que cambió el módulo lector: `6ba45992bcdfa082167064f31d49302997178f32`.
- SHA-256 operador `scripts/src/e2-historical-readonly.ts`: `66e96f883315472ecbf2250a8a5e9aecd7c19bae293588dd1699542824effbf5`.
- SHA-256 lector `caja-corte-reader.ts`: `827dd2340c99e0a50b497e5902c545d15fe44b2f0c3f31b621d61ea8338338fb`.
- SHA-256 aritmética `caja-cash-ledger.ts`: `d5663a1e88af3e4443f919fc280dd349cbf208893dc5ea4eb841b73690e7b78a`.
- Commit fuente del bundle: `7cb77f8cfc6287fa51325a25122c48af392a7ada`.
- SHA-256 comprobado de `artifacts/api-server/dist/index.mjs`: `3415998ed6eb1b8d6977793ac53f43ce91477f691b12f5c8dc11d14a2b801a98`.
- Proceso API observado: PID `176`, ejecutando ese archivo; inicio mostrado por `ps`: `Sat Sep 19 02:34:33 2026`, anterior a ambos cierres. No se reinició en esta revisión.
- La atribución del bundle se apoya en el proceso observado, hash del archivo y procedencia registrada en `reports/e2-apertura-limitada/reconstruccion/autorizacion-bundle-7cb.md`; no se importó el bundle para inspeccionarlo ni se afirma un hash de su memoria.

## Ejecución de solo lectura y archivos nuevos

- Operador histórico existente, sin modificar: `capture E2_READ_ONLY_REVIEWED`.
- Conexión tomada de la configuración efectiva del proceso API, sin imprimir credenciales. Base comprobada: `heliumdb`.
- Captura del lector: `2026-09-19 03:16:12.39392+00`; `REPEATABLE READ READ ONLY`, `default_transaction_read_only=on`, `ROLLBACK`; código de salida `0`, estado `MATCH`, seis filas comparadas, cero discrepancias.
- Las comprobaciones de auditoría y evidencia se hicieron en transacciones separadas `REPEATABLE READ READ ONLY`, terminadas con `ROLLBACK`. El informe de evidencia verifica que fecha y contado del cierre coinciden con la captura del lector; no se afirma que todas las consultas compartieran una única instantánea.
- No se ejecutaron DDL, DML, inicializadores, login, fixtures, reparación ni reinicios. Solo se crearon archivos de reporte.

Archivos de esta ejecución, con nombres nuevos:

1. `reports/e2-historico-relectura-43-44-20260919T031609Z-lector.json`: captura original del operador y huellas.
2. `reports/e2-historico-relectura-43-44-20260919T031609Z-evidencia.json`: cierres, auditorías, notas, componentes de caja, comparación y revisión del bundle. Incluye SHA-256 de la captura del lector.
3. Este informe.

Los JSON se escribieron con creación exclusiva (`wx`). No se sobrescribieron los informes anteriores, incluidos los que registraron las sesiones abiertas.