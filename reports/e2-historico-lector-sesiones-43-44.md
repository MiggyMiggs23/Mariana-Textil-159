# Lector histórico E2 — sesiones 43 y 44

## Dictamen

**NO_CLOSED_ROWS / comparación no disponible.**

El lector histórico E2 real se ejecutó en solo lectura, pero la base efectiva de
la API todavía presenta las sesiones 43 y 44 como `ABIERTA`. Ninguna tiene
`cerrada_at`, `efectivo_contado`, auditoría `CERRAR_CAJA` ni `cashSnapshot`.
Por tanto no existe en esta lectura un esperado guardado por el cierre y no es
posible comparar esperado contra cálculo ni producir un desglose por folio.

No se interpreta la ausencia como PASS y no se fabricó un cierre o snapshot.

| Sesión | Sitio | Estado leído | `cerrada_at` | Esperado guardado | Cálculo del lector | Delta | Folios |
|---:|---|---|---|---|---|---|---|
| 43 | Cruces | `ABIERTA` | `NULL` | no existe | no ejecutable como corte cerrado | no calculable | no hay cierre guardado que comparar |
| 44 | Mariana | `ABIERTA` | `NULL` | no existe | no ejecutable como corte cerrado | no calculable | no hay cierre guardado que comparar |

## Ejecución

- Resultado JSON principal:
  `reports/e2-historico-lector-sesiones-43-44.json`.
- Estado interno del lector: `NO_CLOSED_ROWS`.
- Filas cerradas revisadas: `0`.
- Captura PostgreSQL del lector: `2026-09-18 22:39:47.914943+00`.
- Comprobación puntual posterior: `2026-09-18 22:40:36.185148+00`.
- Base: `heliumdb`, OID `16384`, esquema `public`, rol `postgres`.
- Transacción: `REPEATABLE READ READ ONLY`; `default_transaction_read_only=on`;
  terminó con `ROLLBACK`.
- No se reinició la API y no se ejecutó DDL, DML, inicializador, backfill,
  fixture, login ni corrección de negocio.

La comprobación puntual usó la conexión `DATABASE_URL` efectiva del proceso API
sin mostrarla. Confirmó para ambas sesiones cero auditorías de cierre y cero
snapshots. El operador histórico también configura su conexión y transacción
como solo lectura antes de consultar.

Una primera captura con la variable disponible directamente en el shell obtuvo
el mismo resultado y se conservó separadamente en
`reports/e2-historico-lector-sesiones-43-44-shell-env-no-api.json`; no sustituye
la captura principal realizada con la conexión efectiva del proceso.

## Revisión y huellas

- HEAD ejecutado:
  `3a4416808c233c1e2f337a4a26814dd8d2e7d2ac`.
- Árbol Git de HEAD:
  `fce0089795533d62441fc020417490ae9e339d68`.
- Operador `scripts/src/e2-historical-readonly.ts`:
  `66e96f883315472ecbf2250a8a5e9aecd7c19bae293588dd1699542824effbf5`.
- Lector `artifacts/api-server/src/lib/caja-corte-reader.ts`:
  `827dd2340c99e0a50b497e5902c545d15fe44b2f0c3f31b621d61ea8338338fb`.
- Aritmética `artifacts/api-server/src/lib/caja-cash-ledger.ts`:
  `d5663a1e88af3e4443f919fc280dd349cbf208893dc5ea4eb841b73690e7b78a`.
- SQL legacy embebido:
  `c16e102a83c2a476594f3c5fb683264b5b23dfb9edbdcff847d1f0433f6aee2d`.
- JSON principal:
  `a3b03a542d9b8f5968259b4ef78f332dca1cfb8ad465367a4165e888b083a812`.

El operador y los dos módulos del lector coinciden byte a byte con la revisión
`6ba45992bcdfa082167064f31d49302997178f32`, donde quedaron versionados. También
coinciden con HEAD. El campo `dirty: true` del JSON principal se debe a que la
primera salida de reporte ya existía sin versionar al iniciar la segunda
captura; no había diferencias en estos tres archivos ejecutados. La primera
captura registró `dirty: false`.

## Condición para obtener la comparación solicitada

La comparación solicitada requiere que las sesiones aparezcan confirmadas como
`CERRADA` en esta misma base y que exista evidencia del esperado guardado al
cierre. No se impone `cashSnapshot` como requisito universal: el lector conserva
compatibilidad con cierres legacy sin snapshot. Esa compatibilidad no permite
presentar un cálculo reconstruido como si fuera un importe guardado.

Este informe no determina por qué la acción observada por el propietario no
aparece confirmada; únicamente conserva el estado leído y detiene la aceptación.