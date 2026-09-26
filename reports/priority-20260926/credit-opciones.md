# Clientes y crédito: opciones antes de cambiar

**Recomendación: opción 1, después de separar navegación, API y render en la medición. No se implementó ninguna opción de crédito.**

## Lo que sí sabemos

El API tardó 2.172 / 2.211 / 2.123 s; la operación visible histórica tardó 11.496 / 10.288 / 12.024 s. No son el mismo intervalo: el cronómetro de la operación empieza antes de una navegación completa, que vuelve a cargar aplicación/autenticación/alcance. `browser-performance.mjs:68–72,103–104` usa el mismo `performance.now()` de Node al comenzar y terminar: **no tiene una resta entre relojes relativos de Node y navegador**. `request.timing().responseEnd` empieza en la solicitud, no en la acción.

No hay timestamp de acción, traza CPU ni hash del frontend en aquellos JSON; por tanto, no está demostrado que los ~9 segundos restantes sean solamente render. Medir con el mismo reloj monotónico y registrar además epoch de acción, `performance.timeOrigin + startTime`, fin del recurso, commit visible y dos frames. No comparar `performance.now()` del navegador antes/después de `goto`: cambia el origen temporal.

## 1. Paginar las tablas en pantalla, conservar datos y totales completos — recomendada primero

**Arquitectura:** mantener contrato/API, proyección canónica, filtros y exportaciones. Ordenar el conjunto completo en cliente y mostrar una página de filas con controles accesibles. Conservar los totales enviados por el servidor, nunca recalcularlos sobre la página.

**Evidencia:** frontend congelado `components/reportes/generic-report-renderer.tsx:47–73` crea el testid `report-content-clientes` junto con gráficos y todas las tablas; `report-table.tsx:48–62,89–111` limita altura pero monta todas las filas/celdas. No hay virtualización. El gráfico `clientes-top` también contiene todos los clientes (`reportes-commercial.ts:235`).

**Consecuencia:** menos DOM/formatos/render, pero no reduce SQL ni bytes del API. El buscador del navegador ya no encontrará filas de otras páginas; impresión debe continuar por exportación completa. No se propone ocultar saldos cero ni cambiar gráfico a top-N. Si la traza prueba que el cuello es bootstrap, esta opción no resolverá sola el objetivo.

## 2. Reorganizar consultas independientes del reporte con concurrencia acotada

**Arquitectura:** adelantar conteos del periodo previo y primeros clientes, y cargar proyecciones en cuanto se conozcan sus IDs; conservar SQL y projector. Respetar límite de conexiones y comparar bajo carga.

**Evidencia:** sourcemap API `lib/reportes.ts:167–206` despacha a `lib/reportes-commercial.ts:168–237`: siete consultas paralelas (`173–214`) seguidas de periodo previo (`217`), proyección global (`222–224`) y primeras compras (`231–233`).

**Consecuencia:** puede reducir espera de API, no DOM. Más concurrencia puede empeorar pool/otros usuarios. No introducir cache financiera ni índice. Las consultas actuales no comparten snapshot; no prometer consistencia transaccional nueva como parte de una optimización sin decisión explícita.

## 3. Optimizar lectura de evidencias/proyección canónica, solo con perfil SQL/CPU y paridad financiera

**Arquitectura:** optimizar agregación de aplicaciones o coste algorítmico manteniendo la proyección histórica completa. No sustituirla por suma firmada ni filtrar movimientos por fecha/sitio.

**Evidencia:** `credit-aging-read-model.ts:232–281` ya hace una sola consulta bulk; no es N+1 por cliente. Las agregaciones correlacionadas de aplicaciones (`246–262`) y la proyección por cliente (`281`) requieren medición para determinar cuál pesa.

**Consecuencia:** mayor riesgo y verificación. Comparar céntimos de deuda, favor, cada cargo y aplicaciones con prepagos, reversos, pagos dirigidos y marcas históricas. Mantener estados/permisos; no tocar escritores financieros.

## Invariantes exactos para las tres opciones

* Ventas = suma de importe de líneas seleccionadas por modalidad en tickets admitidos; filtros de producto/tela/color/unidad/proveedor seleccionan tickets por EXISTS, no recortan sus importes a las líneas coincidentes. Utilidad = suma de importe − costo congelado, **NULL** si falta costo en cualquier línea seleccionada. Promedio = ventas / tickets, cero sin tickets.
* Pago asignado por modalidad = suma de `tp.importe × subtotal_componente / NULLIF(subtotal_ticket,0)`; operaciones son DISTINCT pago por componente, no un total único sumable entre modalidades. No redondear cada línea ni duplicar joins.
* Cartera = foto **global histórica** de clientes activos no-sistema, restringida solo por cliente explícito, no por fecha/sitio/modalidad/producto. Cada fila usa `pendienteCents / 100`; total suma todas las filas, incluidos ceros. Favor y deuda permanecen separados; preservar FIFO, reversos y evidencia dirigida.
* Antigüedad usa fecha UTC actual, no fecha final del reporte; sin vencimiento = Sin plazo; días ≤0 = Vigente, después 1–30/31–60/61–90/91+. Riesgo es frecuencia actual/previa <0.5, o SIN_HISTORIAL sin previa.
* No confundir pagos dirigidos embebidos (aprobados por created_at, actualmente sin filtro de sitio) con Solicitudes Resueltas (aprobadas/rechazadas, resuelta_at/created_at y sitio). No unificarlos como si fueran equivalentes.
* Totales genéricos actuales convierten NULL a cero incluso en utilidad; no corregir esa diferencia respecto a filas silenciosamente bajo etiqueta de rendimiento.

Fuentes frontend: `reports/noche-20260926/tarea-7/staging/frontend-root-inventory/artifacts/mariana-textil/src`. Fuentes API y números de línea: sourcesContent de `artifacts/api-server/dist-auditoria-colaborativa-final-20260925/index.mjs.map`. Evidencia ampliada: `performance-analysis.md`. Objetivo de directorio <2 s pendiente de medición real final; pruebas offline no certifican ese objetivo.