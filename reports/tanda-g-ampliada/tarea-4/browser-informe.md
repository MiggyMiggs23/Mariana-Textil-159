# Tarea 4 — ampliación de navegador real (tramo acotado)

## Resultado

Se utilizó Chromium/Playwright real contra **UI privada 43864 / API privada 43854**
iniciadas por MAIN, con el volumen previamente cargado. Actores sintéticos
`TANDA GA ADMIN` y `TANDA GA CAJA`, nunca actores restaurados. No se cambió ningún
gate, índice, fuente, dato financiero ni sesión de caja; solo sesiones de login.
La caja se abrió visualmente, **no se confirmó cobro ni cierre**.

| Pantalla y estado listo específico | Muestra 1 ms | Muestra 2 ms | Muestra 3 ms | Evaluación |
|---|---:|---:|---:|---|
| Cobros: Caja Operativa + primer botón Cobrar, CAJA tienda 1 | 3533.37 | 947.69 | 1045.29 | Primera >2s |
| Inventario agrupado global: sin carga + fila TANDA GA visible | 1274.61 | 790.15 | 1289.20 | 3 muestras <2s |
| Corte: diálogo + Efectivo esperado visible, ADMIN tienda 1 | 3094.04 | 2587.20 | 2514.73 | 3 muestras >2s |
| Clientes y crédito: report-content-clientes visible | 17279.85 | 5607.41 | 5844.10 | 3 muestras >2s |
| Estado de cuenta cliente 8, E7 activo | — | — | — | Medición válida detenida; ver evidencia |

Medición desde `page.goto` hasta DOM específico + dos animation frames. En corte
incluye seleccionar tienda, esperar caja y abrir diálogo: no es tiempo aislado
del endpoint corte. Reporte usa filtro **mensual predeterminado septiembre 2026**,
sobre la base anual cargada; no se seleccionó un año en UI. Tres muestras son
descriptivas; no se pretende estimar p95 estable con n=3.

“Muestra 1” significa first-touch de cada proceso de navegador; **no frío real**.
Cachés OS/DB podían estar calientes. Se reutilizó el contexto para muestras 2/3,
con navegación completa, no recarga parcial. Login no se incluye. Chromium
headless, viewport 1360×1000, mismo entorno compartido del informe SQL.
Se abortaron recursos fuera del origen privado (p. ej. tipografías externas),
condición que puede diferir de producción.

## Evidencia y atribución

Capturas PNG por muestra, texto DOM y tiempos individuales de solicitudes en:

* `browser/stock/`: 3 capturas listas e inventario global.
* `browser/cash-ready/`: 3 capturas listas, rol CAJA.
* `browser/cut-ready/`: 3 diálogos completos, rol ADMIN.
* `browser/credit_reports-{0,1,2}.png`: reporte listo y JSON `browser/results-admin.json`.
* `browser/account-bounded/client_statement-0.png`: estado de cuenta en carga.
  El DOM capturado después muestra movimientos; no confundir esos momentos.

Los tiempos de request son `request.timing()` de Playwright; `responseEnd`
representa duración desde inicio de solicitud, no solamente ejecución SQL.
La versión corregida etiqueta cada request al **iniciar**, no al terminar.
El primer lote exploratorio `browser/results-admin.json` etiquetaba al terminar:
no usar sus solicitudes tardías de una navegación abortada para atribuirlas a
otra pantalla. Las tres solicitudes `/api/reportes/clientes` sí corresponden a
sus tres navegaciones consecutivas de reporte.

Ejemplos útiles:

* Reporte `/api/reportes/clientes?periodo=mensual...`: duraciones HTTP
  **683.47 / 687.20 / 478.49ms**, frente a 17.28 / 5.61 / 5.84s hasta DOM.
  El primer reporte además encontró `/api/auth/me` lento (~10.4s) después del
  intento pesado de cliente. Hay costo fuera de esa consulta de reporte;
  **no atribuir los 5–17s a SQL de reporte**.
* Caja first-touch: `/api/sesiones-caja/actual?ubicacionId=836` ~1225ms,
  `/api/auth/me` ~1184ms; no equivalen a tiempo SQL aislado.
* Corte: ninguna solicitud finalizada guardada en las tres muestras superó
  ~772ms, pero navegación + selección + DOM supera 2s.
* Estado de cuenta: `/api/clientes/8/compras?...` respondió 200,
  **4231ms** total, responseStart ~2382ms, requestStart ~433ms.
  Esto incluye cola/transporte/deserialización y carga colateral de la página;
  no demuestra por sí solo una sentencia SQL >2s.

Los planes SQL iniciales **no perfilan el endpoint E7 efectivo del navegador**.
Por ello no se inventa una “consulta culpable” de los excesos de UI. La
instrumentación SQL de compras/E7 y el perfil CPU/render quedan pendientes:
la evidencia actual distingue HTTP de DOM, pero no completa esa atribución.
No se reejecutó el benchmark SQL ni se aplicaron propuestas de índices.

## Bloqueos y correcciones de instrumentación

Se conservan intentos exploratorios en vez de presentarlos como aprobaciones:

1. Selección de tienda ADMIN no persistió tras navegación completa; primer
   `/cobros` mostró “Selecciona un sitio”, no una caja lenta. Corregido usando CAJA
   asignada y seleccionando sitio después de navegar para corte ADMIN.
2. Primer selector “Tickets pendientes” no existía: UI usa “Tickets de Caja”.
   Corregido a botón `Cobrar`; los timeouts en `browser/cash/` son **del harness**.
3. Cliente efectivo usa E7. El selector de tabla legacy
   `statement-desktop-table` no aplica; timeout de 22.27s en
   `account-bounded` **no es una medida de disponibilidad**. Captura muestra
   “Consultando vista previa de exportación E7…” y DOM posterior contiene
   miles de movimientos.
4. Corregido selector a `e7-movements`, pero siguiente proceso agotó 20s
   esperando campo `Usuario` en login, antes de mediciones. Se detuvo el tramo,
   sin declarar fallo funcional ni inferir su causa. Tampoco se obtuvo un
   trio válido de tiempos E7. Un intento previo agotó captura esperando fuentes;
   el harness ahora conserva resultado antes de capturar y limita screenshot.

No se lanzó/reinició ningún servicio ni se inspeccionaron logs. Se reutilizaron
Chromium y Playwright ya instalados; librerías compartidas disponibles de Nix
se enlazaron en `.local/tanda-g-ampliada/performance-browser-libs` sin instalar
paquetes ni cambiar el entorno de la app.

## Reproducción acotada y pendientes

`browser.mjs` admite `PERF_RUN` (subdirectorio), `PERF_ROLE`, `PERF_CASES`.
Ejemplos que produjeron muestras válidas:

```
PERF_RUN=stock PERF_CASES=grouped_stock node reports/tanda-g-ampliada/tarea-4/browser.mjs
PERF_RUN=cash-ready PERF_ROLE=caja PERF_CASES=cashier node reports/tanda-g-ampliada/tarea-4/browser.mjs
PERF_RUN=cut-ready PERF_CASES=cash_cut node reports/tanda-g-ampliada/tarea-4/browser.mjs
```

El reporte se midió en el primer lote general. No sobrescribir sus evidencias
sin cambiar PERF_RUN. No ejecutar sobre la aplicación real.

**Pendientes concretos:** 3 mediciones E7 con DOM correcto; perfil de sus queries
y consultas colaterales; medición anual seleccionada en UI; cobro nativo de ticket
150 como caso aislado de escritura (no realizado dentro del tramo); atribución
SQL/CPU de >2s; cold-start auténtico. El límite del tramo prevaleció sobre seguir
intentando login o inventar una prueba completa.