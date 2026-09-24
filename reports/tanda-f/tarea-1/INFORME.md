# Tanda F — Tarea 1: crédito en navegador real

**Resultado:** recorrido positivo PASS; límite global PASS en la interfaz natural y conciliación de deuda, con **negativo directo de API no ejecutado** porque la interfaz deshabilita la autorización. No se forzó el control ni se abrió una puerta para sobrepasarlo. Diagnóstico sin correcciones.

## Aislamiento y método

- Navegador Chromium 140 / Playwright 1.55, origen único `http://127.0.0.1:43820`. Peticiones externas bloqueadas.
- API privada en 43821; base **tanda_f_browser**, cluster privado 55440. Identidad efectiva del proceso, variables de aislamiento y directorio PostgreSQL comprobados en `../setup/runtime-ready.json`.
- Todas las mutaciones de esta tarea fueron mediante controles reales del navegador: ventas, autorizaciones y abonos. SQL exclusivamente con `default_transaction_read_only=on`, identidad comprobada por captura.
- ADMIN natural para POS/abonos; CAJA natural de cada tienda para autorizar. Matriz y gates intactos. Fuente/API/UI congelados en preparación; MAIN arrancó los servidores. No se modificó código de aplicación.
- Datos exclusivamente sintéticos del fixture, cliente 8, tiendas 836/837/838. Copias hermanas no utilizadas. Servidores y cluster permanecen activos para MAIN; **no se hizo teardown**.

## Recorrido y resultados

| Paso real | Resultado conciliado | Evidencia |
|---|---|---|
| Crear y autorizar nota #1003 en tienda 1 | Crédito $1,500; movimiento 55 | `02-site1-*` a `06-site1-*` |
| Crear y autorizar #1004 en tienda 2 | Crédito global $3,000; movimiento 56 | `02-site2-*` a `06-site2-*` |
| Crear y autorizar #1005 en tienda 3 | Crédito global $4,500; movimiento 57 | `02-site3-*` a `06-site3-*` |
| Crear cuarta nota #1006 en tienda 3 e intentar autorizar naturalmente | UI muestra proyección **$6,000**, límite **$5,000**, exceso **$1,000** y botón deshabilitado. Nota queda PENDIENTE; no nace cuarta venta de crédito | `09-global-limit-authorization.png`, `after-limit.json` |
| Abono parcial $500 desde tienda 3 | Se aplica a #1003 de tienda 1; saldo de esa nota $1,000 | `11-partial-fifo-preview.png`, `after-partial.json` |
| Abono $1,000 desde tienda 2 | Liquida #1003; no se dirige a la nota local | `12-settle-oldest-*`, `after-oldest-settled.json` |
| Abono $2,000 desde tienda 1 | FIFO: **$1,500 a #1004/tienda 2**, luego **$500 a #1005/tienda 3** | `13-cross-store-fifo-fifo-preview.png`, `after-cross-store.json` |
| Abono $1,000 desde tienda 2 | Liquida #1005; deuda autorizada total $0 | `14-settle-all-*`, `after-all-settled.json` |
| Anticipo/abono ordinario $300 desde tienda 1, sin seleccionar nota y sin deuda autorizada | Ninguna aplicación a nota; neto del ledger **-$300**, es decir $300 a favor. Existe historial de notas y una nota pendiente no autorizada; no se afirma cliente sin historia documental | `15-advance-no-debt-fifo-preview.png`, `after-advance.json` |
| Autorizar ahora #1006 desde CAJA tienda 3 | Usa automáticamente los **$300 a favor de tienda 1**; deuda resultante $1,200, crédito disponible $3,800, favor restante $0 | `16-favor-authorization-preview.png`, `final-state.json` |
| Abrir nota final | UI **ABONO PARCIAL**, saldo $1,200, historial $300 aplicado del movimiento 62 | `18-final-note-balance.png` |

Todas las capturas citadas están en `evidence/`; su texto visible acompaña cada PNG.

## Antigüedad y reparto global

Las tres autorizaciones ocurrieron realmente en orden, sin modificar fechas:

1. Movimiento 55 / tienda 836: `2026-09-24T03:57:58.010Z`.
2. Movimiento 56 / tienda 837: `2026-09-24T03:58:04.306Z`.
3. Movimiento 57 / tienda 838: `2026-09-24T03:58:10.098Z`.

La tabla `aplicaciones_credito` y la vista previa de UI concuerdan. Los pagos se hicieron deliberadamente desde tiendas distintas de la nota más antigua. Se probó prioridad global de estas tres notas, no un escenario de empates exactos ni vencimientos manipulados.

## Conciliación final

- Cuatro ventas de crédito autorizadas: **$6,000**.
- Cinco ingresos físicos/abonos: **$4,800** ($500 + $1,000 + $2,000 + $1,000 + $300).
- Cinco recibos E3, una fila de abono por pago.
- Aplicaciones: $1,500 a cada una de las tres primeras notas y $300 a la cuarta.
- **Deuda final $1,200; saldo a favor consumido $300; sin duplicación de crédito o abonos observada.**
- `assert-results.mjs` comprueba los snapshots de lectura, orden, importes, aplicaciones, recibos y exclusión de la nota pendiente antes de autorizar. Resultado: `assertions.json`, todas las aserciones PASS.
- El campo legado `clientes.saldo_credito` no se usó como saldo canónico; se conciliaron movimientos y aplicaciones reales.

## Límites y seguimiento

- El límite duro global está demostrado en la proyección de autorización y bloqueo natural de UI, con deuda de tres tiendas corroborada. **No certifica aquí el rechazo de una petición manipulada contra API**; ese negativo corresponde al worker de concurrencia/permisos o una autorización de diagnóstico API separada. No se alteró el límite para continuar.
- No se probaron impresión física, PDF, pagos dirigidos ni reversos: no forman parte de este tramo. No se abrieron gates cerrados.
- Se observa una rotulación potencialmente confusa en autorización: “Saldo deudor proyectado” y “Suma de los dos” muestran ambos el saldo resultante, junto a “Importe por aprobar”. Por ejemplo $6,000 / $1,500 / $6,000. Se registra sin cambiar cálculos ni UI.
- La cuarta nota quedó **autorizada con $1,200 pendiente intencionalmente**, para conservar la evidencia de aplicación automática de favor. Las tres sesiones de caja siguen abiertas; MAIN decide siguientes tareas y teardown.
- Scripts mutantes conservados como evidencia de lo ejecutado: **no volver a correrlos sobre esta base**, pues crearían nuevas operaciones.

## Commit

Únicamente este directorio de tarea se incluye en el commit de Tarea 1. Preparación, evidencia de otros workers y archivos preexistentes quedan fuera; MAIN puede obtener el hash con `git log -1 --format=%H -- reports/tanda-f/tarea-1`.