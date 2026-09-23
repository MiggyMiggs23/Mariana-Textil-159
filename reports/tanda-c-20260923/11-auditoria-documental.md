# Tarea 11 — Auditoría completa de `replit.md` y correcciones documentales realizadas

## Resultado ejecutivo

**Aplicadas las cinco correcciones documentales H1–H5 en `replit.md`, tras autorización de MAIN al completar los commits 1–10.** La primera fase leyó íntegro el documento de 1,647 líneas, incluidos sus antecedentes, decisiones futuras, límites de pruebas y secciones finales E10. Se contrastaron los puntos de mayor riesgo con código fuente y reportes históricos locales. En la integración se revalidaron los contextos exactos y sus evidencias, incluidos los resultados posteriores de las tareas 4 y 7. Este subtrabajo solo modificó `replit.md` y este informe: no ejecutó pruebas, SQL, scripts de aplicación, conexiones de red, inspecciones de procesos ni consultas de base; no reinició servicios ni hizo commits.

Se realizaron cinco correcciones documentales evidentes:

1. Eliminar la regla de clasificar tablas desconocidas como A y exigir una clasificación autorizada sin conteo fijo.
2. Separar la preparación histórica E2 de la liberación CLOSED documentada el 22/09 y de observaciones posteriores de proceso.
3. Corregir la generalización “todas las acciones destructivas exigen texto exacto”, que contradice la confirmación de productos con credenciales.
4. Alinear el rótulo de la banda del tablero con **Cobranza del periodo** en la fuente actual.
5. Retirar la falsa actualidad de “el inventario vivo posterior registra 14” dentro de la narración de triggers históricos.

Las ambigüedades restantes se documentan aparte, sin alterar reglas empresariales ni reescribir resultados históricos como si fueran comportamiento actual.

**Frontera fundamental:** fuente preparada ≠ bundle servido ≠ estado de la base ≠ proceso vivo. Esta revisión acredita lectura documental/estática y cita las comprobaciones de MAIN sin reejecutarlas. Las referencias numéricas de cobertura y hallazgos corresponden al archivo de 1,647 líneas anterior a la aplicación; se conservan como evidencia histórica. MAIN guardará el commit 11 en su orden.

## 1. Método y cobertura

“Revisado” significa que se leyó la sección y se evaluó su coherencia documental, vigencia declarada y relación con otras secciones. **No significa que cada endpoint, prueba o promesa haya sido verificado funcionalmente.** La columna de contraste distingue evidencia puntual de los sectores donde no se encontró una diferencia evidente que justificara tocar el texto.

| Líneas de `replit.md` | Secciones leídas, incluidas subsecciones | Contraste y resultado |
|---|---|---|
| 1–27 | Impresión: series, encabezados, firmas, paginación, Entrada/Salida | Reglas documentales y excepciones; tensión general de repetición de encabezados separada como D4. No PDF nuevo. |
| 28–61 | Parte 9: pago, IVA, navegación, metreados, Precios | Distingue decisiones futuras y gates; no convertir confirmación histórica bajo costo en bloqueo vigente. |
| 62–97 | Estándar de composición: referencias, composición, límites, aprobación | Consistencia documental; no es prueba responsive nueva. |
| 98–115 | POS/Caja y regla contable | Identidad Ventas/Contado/Crédito consistente con secciones de cobranza; no verificar cifras reales. |
| 116–174 | Salidas para venta: ciclo, etiquetas, trazabilidad, reservas | Se conservan reglas y cambios históricos; no inferir activación adicional. |
| 175–209 | Equipos; inicializadores del 8/09; inventarios de triggers | Conteos de 11/14 ya rotulados históricos en 204–206. H5 identifica una mención posterior que no lo está suficientemente. |
| 210–234 | Tabulares, ticket y etiquetas | Reglas y evidencia histórica, sin declarar prueba de impresora. |
| 235–270 | Run & Operate, Stack, rutas de archivos | Comandos presentados no autorizan ejecutarlos. D3: generalización de conexión de pruebas. |
| 271–316 | Decisiones de arquitectura, permisos, BODEGA, productos, costos | Ruta de purga actual confirma distinción credenciales/texto; H3. BODEGA ya refleja decisión del 23/09; no duplicar trabajo de T1. |
| 317–346 | Existencia, archivos revisados, catálogo y transferencias | Función de reconstrucción actual acepta transacción; las descripciones de cambios antiguos no son contradicciones por sí solas. |
| 347–370 | Carrito POS, mostrador y seis vistas | Coberturas históricas se preservan, sin reejecutarlas. |
| 371–413 | Escáner, Salidas, recepción QR, alertas, verificación | Límites de dispositivo están explícitos; no cerrar cámara/pistola por lectura de fuente. |
| 414–438 | Intérprete, candados, salida en una acción | No ampliar las reglas de reversibilidad ni confundir cambios antiguos con puertas nuevas. |
| 439–478 | Logo, iniciales, folios, controles de etiquetas, módulos, extraordinarias | Normas y pendientes separados; vetos por rol siguen decisión independiente. |
| 479–530 | Pruebas permanentes, preparación, refresco, costos, arnés y población | Prohibición de copiar actores reales es explícita; conflicto de ensayo de recuperación en D2. |
| 531–548 | Cierre de cinco partes, unidades y fuente de crédito | H3: generalización destructiva contradice reglas específicas y handler. |
| 549–597 | E1: origen, naturalezas, actores, guardas, históricos, verificación | Mantener evidencia DDL y límites; E2 CLOSED no abre efectivo, retenidos ni atribución. |
| 598–644 | Parte 7 y Cuentas Destino | Separación ventas/cobranza y antecedentes; H4 corrige otra sección que conserva rótulo anterior. |
| 645–660 | SISTEMAS y CONTADOR | E11 es objetivo/preparación, no migración acreditada. La amplitud SISTEMAS ya se reconoce pendiente. |
| 661–733 | Limpieza piloto, Prompt M, fase 2, Prompt H, comparaciones | Contraste directo con script y reportes reales. H1/H5; se descarta falsa contradicción A33/A35 y reset. |
| 734–775 | Pendientes piloto, Product, Gotchas | Evidencia histórica de API no se convierte en estado actual; instrucciones de arranque subordinadas a autorización. |
| 776–787 | Reportes por modalidad, notificaciones, destinos | No se propone reescribir resultados ni ampliar FIFO. |
| 788–858 | Auditoría de inventario, reactivación, activación y diez reversos | Lista explícitamente pendiente; lectura estática no acredita incidentes persistidos. |
| 859–896 | Purga, caja diaria, E4, compras, feed | E4 se presenta preparada OFF; el DDL fuente añade tablas no clasificadas para purga. |
| 897–938 | Utilidad, sesiones, compras, filtros, Nota, vencimientos | Reglas/históricos; no se encontraron diferencias suficientemente demostradas para propuesta principal. |
| 939–1002 | Tiempo real, estados, POS, ventas por tienda | Fuente de tablero muestra Cobranza del periodo; H4. No deducir conciliación real. |
| 1003–1036 | Formatos, diagnóstico Epson/Wasp, capacidades y márgenes | No validar físicamente; D4 registra tensión de generalización. |
| 1037–1056 | Stock mínimo y Qué comprar | La conservación de configuración frente a episodios coincide con método histórico de purga. |
| 1057–1088 | Higiene, verdes falsos, Prompt B, autorización financiera | Aplicado: reportes históricos no se vuelven a acreditar, sin reconstruir autorizaciones. |
| 1089–1155 | Ventas/cobranza, abonos, fechas, estados, favor | Pendientes reales se conservan. No convertir las recapturas históricas en entrada física. |
| 1156–1166 | Utilidad proveedor y migración 14/09 | Ya dice que la purga antigua no fue ampliada; refuerza H1. |
| 1167–1243 | Reportes por decisión, cobertura, exportaciones y Control | Límites y pruebas históricas separados; no inventar evidencia X04 ausente ni cerrar grupo. |
| 1244–1263 | Tablero Prompt C, corte pendiente y verificación | H2/H4: rótulo y estado del lector E2. |
| 1264–1293 | Prompt L: series de ocho dígitos | Fuente `series.ts` mantiene 10,000,000; reset de siete dígitos es histórico, no error del reporte del 13. |
| 1294–1339 | Prompt F, arranque, bundles, detalle autenticado pendiente | H2: bundle 7cb retenido no es el E2 CLOSED liberado; inspection debe quedar contextualizado. |
| 1340–1361 | Entradas y Prompt K | Antecedentes y límites explícitos; no convertir snapshots de catálogo en conteo fijo actual. |
| 1362–1394 | Cartera y endpoints pendientes | No declarar Prompt P resuelto por cambios de formato o pruebas actor. |
| 1395–1424 | Prompt G, P y Q | G histórico; P detenido; Q antecedente. H2 contextualiza su referencia a E2 sin activación. |
| 1425–1438 | Apertura limitada y A+C | FAIL PostgreSQL antiguo sigue siendo válido para esa revisión; no es el último resultado E2. H2 añade precedencia explícita sin borrar el fallo. |
| 1439–1468 | E2: fórmula, devolución, históricos, límites | H2 distingue lector liberado de devolución/captura cerradas. |
| 1469–1513 | Prompt S y aceptación de contratos | Las pruebas previas y cinco fallos son históricos; no declarar regresión actual por el relato. |
| 1514–1545 | Plan U y remate/precios/purga futura | Políticas decididas no equivalen a implementación. No resolver vetos ni ejecutar purga. |
| 1546–1647 | E10, reglas, frontera de ensayo, revisión exacta | Instalación E10 no habilita Fondo. D2 registra coexistencia de regla general y excepción histórica de actores. |

## 2. Hallazgos evidentes y evidencia por archivo/línea

### H1 — Regla peligrosa de reconstrucción de listas

**Texto:** `replit.md:705–708` exige sumar 60 tablas y clasificar cualquier nueva/omitida como A salvo autorización distinta.

**Contraste:**

- `scripts/src/purge-operational-phase2.mts:493–509,712–740`: el ejecutable histórico rechaza catálogos distintos del fijo de 58 relaciones y 11 triggers; no incorpora automáticamente tablas nuevas.
- `lib/db/src/schema/pos.ts:302,322,430`: E1 agrega operaciones, cobros pendientes y atribuciones.
- `lib/db/src/schema/e3-receipts.ts:9,17,22`: preparación fuente agrega vistas, folios y recibos.
- `reports/e2-liberacion-20260922/resultado.md:50–53`: 69 tablas preexistentes más dos A+C en esa instalación documentada.
- `reports/tanda-b-20260922/e4/01-preparado.sql:4,23` y `reports/e11/01-preparado.sql:92–181`: DDL preparado mezcla operaciones y perfiles/configuración.
- `replit.md:1165` ya reconoce que la purga histórica rechaza el esquema ampliado.

**Conclusión:** ni 58 ni 60 es una expectativa actual válida por sí sola. Clasificar lo desconocido como borrable contradice la preservación explícita y omite autorización de familias nuevas. Proponer **bloqueo hasta clasificación**, no adaptación de código. Inventario ampliado en T10.

### H2 — E2 conserva presente de preparación ya superado en los reportes

**Texto afectado:** `replit.md:1254` dice que API aún no se reinició con el lector; `1315` llama vigente al bundle 7cb; `1334` dice inspection no habilitado; `1423,1431,1439–1459` contienen preparación y validaciones previas sin un cierre actualizado que guíe al lector.

**Contraste independiente:**

- `reports/e2-liberacion-20260922/resultado.md:47–68,80–93`: instalación A+C, arranque de liberación, comprobación posterior; E2 CLOSED servido por SHA `008dfd54d93f6a1606370d44cb2086673669c51278c92ebb6a5a63f4d503e7f5`; 7cb conservado como retenido; captura/devolución/retención/atribución/Fondo cerrados; primer cierre pendiente del propietario.
- `reports/e2-liberacion-20260922/verificacion-reanudacion-workflow-api.md:12–28,32–49`: observación posterior del mismo artefacto en inspection, sin comparación de filas de ese arranque. Es reporte, no inspección ejecutada por T11.
- `reports/e3-fase-b-detenida-20260923.md:23–47`: mismo hash de bundle, otro PID; fase B detenida; no se verificó modo ni conexión efectiva del proceso nuevo. **No afirmar que ese proceso nuevo estaba comprobado en inspection.**
- **Actualización revalidada al aplicar:** `reports/tanda-c-20260923/04-creditos.md`, «Estado y alcance», documenta que MAIN sí comprobó posteriormente la conexión efectiva del PID 191 en READ ONLY, con cero escrituras y ROLLBACK. `reports/tanda-c-20260923/07-paquete-tanda-b.md`, «Ejecutado y no ejecutado» y «Diferencias exactas», registra captura/preflight CLI reales PASS y bloqueo de reconstrucción por `enumsortorder` del fixture. No se liberó Tanda B ni se arrancó el candidato. Estas evidencias posteriores no reescriben lo que no se comprobó en el intento histórico E3 ni prueban por sí mismas el modo de arranque actual de la API.
- `artifacts/api-server/src/index.ts:158–194,205–235`: fuente separa normal/inspection/limited; inicializadores y mantenimiento no pertenecen a la rama inspection. No identifica por sí sola qué artefacto sirve.
- `artifacts/api-server/src/lib/credit-evidence-contract.ts:28–30`, `e3-ordinary-cash-release.ts:2`, `e4-cash-out.ts:2`, `e12-supplier-cash.ts:2`, `e9-feature.ts:2`, `e7-feature.ts:2`, `e11-feature.ts:2–5`: gates fuente cerrados; presencia de código no equivale a liberación.

**Conclusión:** actualizar estado documentado del lector y etiquetar antecedentes; no borrar FAIL de una revisión antigua ni declarar abiertas captura/devolución. No afirmar salud actual o instalación de Tanda B.

### H3 — Confirmación destructiva generalizada

**Texto:** `replit.md:533` afirma sin excepción que las acciones destructivas requieren texto exacto.

**Contraste:** `replit.md:301–306` establece credenciales ADMIN para productos; `artifacts/api-server/src/routes/purga.ts:48–68` exige `usuario/password` para productos y `confirmacion` para otras entidades. `artifacts/mariana-textil/src/pages/producto-detail.tsx:549,605` presenta credenciales.

**Conclusión:** acotar la frase general a la confirmación definida por cada flujo. No unificar diálogos, cambiar autenticación o extender la excepción a entidades sin evidencia.

### H4 — Rótulo antiguo en la sección canónica del tablero

**Texto:** `replit.md:1247` conserva “Cobrado en el periodo”.

**Contraste:** `artifacts/mariana-textil/src/pages/caja/tiempo-real.tsx:203,437` declara “Cobranza del periodo”; `replit.md:612,618,626,1094` usa esa nomenclatura.

**Conclusión:** sustitución de rótulo únicamente, sin tocar importes, predicados ni claves técnicas. Se describe fuente, no se acredita navegador autenticado o bundle frontend nuevo.

### H5 — Conteo de triggers posterior presentado como vivo

**Texto:** `replit.md:724` termina con “El inventario vivo posterior registra 14”.

**Contraste:** `replit.md:204–206` ya distingue los 11 históricos de los 14 de Prompt H; `replit.md:555,596` documenta inventarios E1 posteriores de 23/26. `reports/fase2-purga-2026-09-13.md:136–150` acredita los 11 del 13/09. No se consultó el inventario actual.

**Conclusión:** cambiar solo esa mención a “captura histórica posterior de Prompt H”; no sustituir 14 por un supuesto conteo vivo de 26 u otro número.

## 3. Diff propuesto originalmente — evidencia histórica de las líneas previas

Los bloques siguientes conservan sin reescritura la propuesta original de sustituciones documentales y sus líneas previas. **H1–H5 ya se aplicaron por contexto exacto; no volver a aplicarlos.** En H2b se ajustó «la última observación de proceso» a «las observaciones posteriores». En H2c el párrafo de actualidad se amplió con las comprobaciones posteriores T4/T7 indicadas arriba: conexión efectiva del PID 191 comprobada, captura/preflight PASS, fixture bloqueado por `enumsortorder`, sin liberación ni inferencia de modo actual. El resto de las sustituciones coincide con estos bloques. **No son instrucciones operativas ni incluyen SQL nuevo.** Se preservan los resultados históricos, incluidos los FAIL de sus revisiones.

### H1 — Clasificación fail-closed

```diff
--- a/replit.md
+++ b/replit.md
@@
 **Regla de reconstrucción de listas:** en cada ejecución se debe redescubrir y
-listar el conjunto completo, comprobar que A+B+C suma las 60 tablas y clasificar
-cualquier tabla nueva u omitida antes como A hasta que exista una autorización
-distinta. No se heredan listas parciales entre ejecuciones.
+listar el catálogo efectivo completo, sin fijar su tamaño a las 58 o 60 tablas
+históricas. Cada tabla y sus dependencias requieren una clasificación explícita
+y autorizada: borrar, reajustar/reconstruir o preservar. Una tabla nueva,
+omitida o desconocida queda pendiente y bloquea la ejecución; nunca se clasifica
+como A por omisión. No se heredan listas ni autorizaciones entre ejecuciones.
+El ejecutable del 13 de septiembre está fijado a su respaldo y catálogo
+históricos y no debe reutilizarse contra el esquema ampliado. El procedimiento
+documental y los pendientes de adaptación están en
+`reports/tanda-c-20260923/10-procedimiento-purga.md`; no autorizan una purga.
```

### H2a — Frontera del lector de corte

```diff
--- a/replit.md
+++ b/replit.md
@@
-La fórmula anterior de detalle e historial era **fondo inicial + pagos EFECTIVO de tickets − salidas de efectivo**, sin abonos de crédito. E2 prepara el nuevo lector común descrito abajo; el servidor API aún no se reinició con ese código. Los cortes cerrados anteriores conservan la fórmula histórica de cada superficie; no se ejecutó ningún cierre ni cuadre para esta preparación.
+La fórmula anterior de detalle e historial era **fondo inicial + pagos EFECTIVO de tickets − salidas de efectivo**, sin abonos de crédito. El lector común E2 fue liberado en modo CLOSED según `reports/e2-liberacion-20260922/resultado.md`; eso no habilitó captura ni devolución de efectivo de crédito. Los cortes cerrados anteriores conservan la fórmula histórica de cada superficie. El primer cierre real quedó pendiente del propietario; la preparación y la liberación no acreditan que se haya ejecutado.
```

### H2b — Bundle retenido, no vigente por herencia

```diff
--- a/replit.md
+++ b/replit.md
@@
-**Identidad de bundles reconstruidos:** la procedencia se acredita por el commit exacto y por demostrar que todas las entradas versionadas de la construcción estaban limpias e idénticas a su árbol. El SHA-256 de la salida registra y protege los bytes aceptados, pero no se usa por sí solo para exigir que dos compilaciones independientes sean idénticas. Registrar juntos commit, árbol, limpieza, herramientas, comando, fecha y hash resultante. No llamar “worktree limpio” a una extracción `git archive` sin `.git`: acreditar en ese caso la igualdad de todas sus rutas con los blobs del commit. El bundle vigente autorizado por el propietario procede de `7cb77f8cfc6287fa51325a25122c48af392a7ada`, árbol `c36407dc8310b9da47a0d3bbc40ffe44c6183f60`, y su `index.mjs` tiene SHA-256 `3415998ed6eb1b8d6977793ac53f43ce91477f691b12f5c8dc11d14a2b801a98`; evidencia en `reports/e2-apertura-limitada/reconstruccion/autorizacion-bundle-7cb.md`.
+**Identidad de bundles reconstruidos:** la procedencia se acredita por el commit exacto y por demostrar que todas las entradas versionadas de la construcción estaban limpias e idénticas a su árbol. El SHA-256 de la salida registra y protege los bytes aceptados, pero no se usa por sí solo para exigir que dos compilaciones independientes sean idénticas. Registrar juntos commit, árbol, limpieza, herramientas, comando, fecha y hash resultante. No llamar “worktree limpio” a una extracción `git archive` sin `.git`: acreditar en ese caso la igualdad de todas sus rutas con los blobs del commit. El bundle anterior autorizado por el propietario procede de `7cb77f8cfc6287fa51325a25122c48af392a7ada`, árbol `c36407dc8310b9da47a0d3bbc40ffe44c6183f60`, y su `index.mjs` tiene SHA-256 `3415998ed6eb1b8d6977793ac53f43ce91477f691b12f5c8dc11d14a2b801a98`; evidencia en `reports/e2-apertura-limitada/reconstruccion/autorizacion-bundle-7cb.md`. Quedó conservado como runtime retenido durante la liberación E2 CLOSED del 22 de septiembre; no se lo identifica como bundle servido actual. El artefacto liberado y los límites de la última observación de proceso están en «E2 — lector CLOSED liberado; captura y devolución cerradas».
@@
-El modo optativo de inspección sigue disponible en el código, pero **no está habilitado** ni es el modo normal de desarrollo. No convierte la API en un servidor globalmente de solo lectura: incluso los GET autenticados pueden renovar la sesión.
+El modo optativo de inspección sigue disponible en el código y no es el arranque normal de desarrollo. La liberación E2 CLOSED del 22 de septiembre lo utilizó con inicializadores, backfill y monitor pausados, según su evidencia de arranque; no se deduce de ello el modo de cualquier proceso posterior. No convierte la API en un servidor globalmente de solo lectura: incluso los GET autenticados pueden renovar la sesión.
```

### H2c — Marcar antecedentes y añadir estado documentado E2

```diff
--- a/replit.md
+++ b/replit.md
@@
 ## Prompt Q — antecedente de diseño de atribución

+Esta sección conserva el estado del diseño de Prompt Q, anterior a la liberación E2 CLOSED documentada más adelante; no describe por sí sola el runtime posterior.
+
@@
-## Apertura limitada y arranque acotado — preparación sin ejecución
+## Apertura limitada y arranque acotado — antecedente de preparación
+
+Los resultados de esta sección corresponden a las revisiones y fases históricas citadas. En particular, el fallo de instalación de `f8818255` no es el estado final de E2: las validaciones posteriores y la liberación CLOSED se documentan en la sección siguiente. Se conserva el fallo original sin reescribirlo como aprobado. La apertura de captura y devolución sigue siendo una decisión separada.
@@
-## E2 — corte y devolución preparados, sin activación de devolución
+## E2 — lector CLOSED liberado; captura y devolución cerradas
+
+**Estado documentado al 22 de septiembre de 2026:** `reports/e2-liberacion-20260922/resultado.md` registra la liberación técnica E2 CLOSED, la instalación autorizada de las dos tablas A+C y el arranque en inspección del bundle SHA-256 `008dfd54d93f6a1606370d44cb2086673669c51278c92ebb6a5a63f4d503e7f5`. El artefacto 7cb anterior quedó retenido. La comparación posterior a esa liberación conservó datos, catálogo y secuencias; no hubo login ni cierre creado por el agente. El primer cierre real quedó pendiente exclusivamente del propietario. Captura, devolución, retenidos, atribución, Fondo, remate, precio mínimo y borrado preparado de producto continuaron cerrados.
+
+**Límite de actualidad:** la reanudación observada está en `reports/e2-liberacion-20260922/verificacion-reanudacion-workflow-api.md`; ese episodio no incluyó una comparación de filas y secuencias antes/después de su arranque. El intento posterior de fase B E3 se detuvo ante un PID distinto, aunque el hash del bundle coincidía (`reports/e3-fase-b-detenida-20260923.md`); no comprobó la conexión efectiva ni el modo del proceso nuevo y no abrió E3. Estos reportes no certifican indefinidamente el estado de la API ni autorizan otro arranque.
+
+Los párrafos de preparación y sus pruebas que siguen conservan sus revisiones y límites históricos. La liberación del lector no equivale a ejecutar el SQL de devolución ni a activar sus productores; tampoco instala las fuentes nuevas de E3 o Tanda B por el hecho de existir en el repositorio.
```

### H3 — Confirmación por flujo, con excepción comprobada

```diff
--- a/replit.md
+++ b/replit.md
@@
-La bitácora de auditoría es de solo lectura, sin excepciones ni siquiera para ADMIN. Las acciones destructivas exigen escribir un texto exacto para confirmarse. El sistema impide dejar la instalación sin ningún ADMIN activo con acceso completo, validado en el servidor dentro de la transacción. Las acciones de SUPERVISOR sobre clientes, proveedores y productos se resuelven desde la matriz configurada; una descripción general del rol no justifica un techo adicional.
+La bitácora de auditoría es de solo lectura, sin excepciones ni siquiera para ADMIN. Cada acción destructiva conserva su confirmación específica: la purga de productos exige usuario y contraseña de ADMIN; las demás entidades de la ruta de purga conservan el texto exacto. No se generaliza una confirmación a todos los flujos ni se permite saltar sus reglas de integridad. El sistema impide dejar la instalación sin ningún ADMIN activo con acceso completo, validado en el servidor dentro de la transacción. Las acciones de SUPERVISOR sobre clientes, proveedores y productos se resuelven desde la matriz configurada; una descripción general del rol no justifica un techo adicional.
```

### H4 — Rótulo fuente

```diff
--- a/replit.md
+++ b/replit.md
@@
-- **Cobrado en el periodo**, como cifra con aclaración adjunta sin encabezado de sección propio, sigue el orden de bloques definido en «Caja en Tiempo Real». Consume `useSharedCuentasDestino` en `artifacts/mariana-textil/src/hooks/use-shared-cuentas-destino.ts`, igual que Cuentas Destino. Ambas usan el mismo endpoint y la función existente `getDestinationAccounts` de `artifacts/api-server/src/lib/admin-analytics.ts`. No hay un cálculo financiero alternativo de cobranza en el navegador ni una segunda implementación SQL.
+- **Cobranza del periodo**, como cifra con aclaración adjunta sin encabezado de sección propio, sigue el orden de bloques definido en «Caja en Tiempo Real». Consume `useSharedCuentasDestino` en `artifacts/mariana-textil/src/hooks/use-shared-cuentas-destino.ts`, igual que Cuentas Destino. Ambas usan el mismo endpoint y la función existente `getDestinationAccounts` de `artifacts/api-server/src/lib/admin-analytics.ts`. No hay un cálculo financiero alternativo de cobranza en el navegador ni una segunda implementación SQL.
```

### H5 — Conteo de triggers estrictamente histórico

```diff
--- a/replit.md
+++ b/replit.md
@@
-**Evidencia histórica de esa purga:** la consulta exacta posterior dejó habilitados los 11 triggers no internos (`tgenabled='O'`): `aplicaciones_credito_inmutables`, `aplicaciones_credito_validas`, `aplicaciones_pago_proveedor_append_only`, `aplicaciones_pago_proveedor_validar_insert`, `auditoria_append_only`, `auditoria_enriquecer_insert`, `movimientos_credito_inmutables`, `movimientos_credito_reversos_validos`, `pagos_proveedor_inmutables`, `reimpresiones_etiqueta_inmutable` y `ticket_pagos_inmutables`. El inventario vivo posterior registra 14; ningún trigger se modificó para corregir el conteo.
+**Evidencia histórica de esa purga:** la consulta exacta posterior dejó habilitados los 11 triggers no internos (`tgenabled='O'`): `aplicaciones_credito_inmutables`, `aplicaciones_credito_validas`, `aplicaciones_pago_proveedor_append_only`, `aplicaciones_pago_proveedor_validar_insert`, `auditoria_append_only`, `auditoria_enriquecer_insert`, `movimientos_credito_inmutables`, `movimientos_credito_reversos_validos`, `pagos_proveedor_inmutables`, `reimpresiones_etiqueta_inmutable` y `ticket_pagos_inmutables`. La captura histórica posterior de Prompt H registró 14; ninguno de estos conteos representa el inventario actual. Ningún trigger se modificó para corregir aquella descripción del conteo.
```

## 4. Falso positivo descartado: A35 y “sin reset” no contradicen el 13/09

La sospecha basada en una referencia anterior a “replit676” no se sostiene al leer el contexto completo:

| Evidencia | Qué describe realmente |
|---|---|
| `replit.md:675–677` | Reconstrucción atómica y ejecución explícita del 13/09. |
| `replit.md:679–687` | Renovación Prompt H, respaldo y preflight del 15/09 CDMX; A35 y 45 secuencias sin cambios. |
| `replit.md:695–720` | Inventario histórico de Prompt H y TRUNCATE sin reset. |
| `reports/prompt-h/block4-purga-verificacion.md:13–17,25–35` | Método sin reset y finalización del artefacto a 16/09 UTC, 15/09 CDMX. |
| `reports/fase2-purga-2026-09-13.md:50,117–126` | A33, series 1,000,000 y `contenedores_folio_seq` reiniciada a 1/no llamada el 13/09. |
| `scripts/src/purge-operational-phase2.mts:1003–1069` | DELETE y reset específico coinciden con ese reporte, no con Prompt H. |

**No proponer reemplazar A35 por A33 ni borrar “sin reset” del episodio Prompt H.** Tampoco fecharlo el 14/09 por conjetura. La diferencia de método es real entre intervenciones distintas y no constituye una contradicción documental.

## 5. Cuestiones dudosas o de decisión, fuera del diff principal

| ID | Evidencia concreta | Por qué no se corrige unilateralmente | Acción recomendada |
|---|---|---|---|
| D1 | `replit.md:732` empieza con archivos del 13/09 y después menciona A35/C18 y Prompt H. | El párrafo dice que son archivos separados; puede leerse correctamente, aunque mezcla fronteras. No hay prueba de que atribuya deliberadamente A35 al 13. | Si se busca claridad editorial, dividirlo en dos párrafos fechados; no cambiar cifras. |
| D2 | `replit.md:524–529` prohíbe restaurar actores reales a pruebas; `1609–1618` conserva identidades de un ensayo E10 autorizado; `1540` pide futuro ensayo de purga. | Una excepción histórica no deroga la regla general. No hay autorización en T11 para decidir nuevos clones con actores reales o para anonimizar un respaldo íntegro. | Exigir decisión expresa del método de recuperación/ensayo privado antes de purga. T10 separa ambos entornos. |
| D3 | `replit.md:245` dice que pruebas usan exclusivamente DATABASE_URL; `513–520,770–771` documenta TEST_DATABASE_URL derivada y pruebas aisladas. | La intención de 245 puede ser identidad canónica frente a Neon externo, no negar TEST_DATABASE_URL. | Revisar su alcance en una limpieza posterior; no cambiar conexiones o guardas para hacer verdadera una frase general. |
| D4 | `replit.md:17–19,825` establece excepciones de encabezado/pie; `1033` generaliza que hojas adicionales repiten ambos. | Cada documento tiene contrato propio; sin nueva inspección de todos los componentes/PDF no fijar una regla universal alternativa. | Precisar qué documentos abarca 1033 con el propietario y evidencia de impresión; no ajustar paginación. |
| D5 | `replit.md:1313,1319` narra recuperación detenida y luego arranque acotado; `551` reanudación E1; `728–740` presente histórico de Prompt H. | Son capturas de episodios, no necesariamente afirmaciones contradictorias del mismo instante. | Mantener el contexto histórico y usar el nuevo estado documentado E2 como referencia, sin declarar disponibilidad viva. |
| D6 | `replit.md:1431` registra FAIL de instalación; `reports/e2-validacion-postgresql-corregida-20260921.md:3,59–75` registra instalación corregida y cuatro fallos SAVEPOINT; `reports/e2-validacion-savepoint-20260921.md:30,100` documenta solución posterior. | El FAIL sigue siendo cierto para `f8818255`; eliminarlo falsearía historia. | H2c añade precedencia y referencia a liberación, no sustituye resultados históricos por PASS genérico. |
| D7 | `replit.md:1532,1542–1544` mantiene tensión purga/no DELETE, SISTEMAS/precios y vetos; `469,477` declara exclusividad ADMIN para extraordinarias. | Decisiones de negocio pendientes o excepciones expresas; la regla general de matriz no autoriza retirarlas. | Resolver por el trabajo de decisión de vetos, no por auditoría documental. |
| D8 | `replit.md:1146` conserva nomenclatura pendiente de Ticket/Nota; `1395–1405` documenta mejoras de Prompt G. | No basta la existencia del helper para probar todos los títulos, variantes y cancelaciones actuales. | Revisar componentes completos y sus consumidores antes de eliminar el pendiente; no inferir cierre por una prueba acotada. |
| D9 | `replit.md:1540` dice “No se prepara ni se ejecuta nada ahora”; esta tarea pide procedimiento documental. | “Ahora” pertenece a una decisión anterior y puede referirse a la operación, no a redactar una guía. La autorización posterior no vuelve ejecutable la purga. | Mantener la prohibición operativa. T10 aclara alcance documental; no convertirlo en permiso de SQL o executable. |

## 6. Lo que expresamente no se da por comprobado

- No se declara conteo actual de tablas, triggers, secuencias, actores, operaciones pendientes o registros borrables.
- No se afirma que la fuente del workspace sea el bundle E2 que sirve, ni que E3/Tanda B estén instalados por existir DDL o código.
- No se acredita UI autenticada, sesión, impresión física, primer cierre real, concurrencia PostgreSQL ni restauración en esta revisión.
- No se reejecutan los resultados 75 escenarios/2 limpiezas fallidas del 13/09, ni las suites históricas de E1/E2/E10; siguen vinculadas a sus revisiones.
- No se convierte el resultado de typecheck de una fecha pasada en aprobación de las modificaciones concurrentes de Tanda C.
- No se autoriza purga, retiro de guardas, cambio de modo de arranque, ampliación de permisos, publicación, reset de counters/secuencias ni restauración de actores.

## 7. Integración realizada y entrega a MAIN

1. Aplicados únicamente H1–H5 en `replit.md`, con la precisión cronológica T4/T7 descrita en §3. Se releyeron la ruta de confirmación de purga, el rótulo del tablero, la evidencia de liberación E2, la detención E3 y los resultados T4/T7. No se cambió código.
2. Se conservaron el diff original, todas las referencias a las líneas previas, la tabla de cobertura completa y las nueve dudas D1–D9. No se editaron reportes históricos ni se resolvieron dudas empresariales por conjetura.
3. T10 permanece como documentación y pendientes, no como ejecutable autorizado. A33/reset del 13/09 y A35/sin reset de Prompt H siguen diferenciados.
4. La revisión del diff no identificó contradicciones nuevas; `git diff --check` terminó sin errores de whitespace. El informe nuevo también se comprueba mediante diff contra `/dev/null` porque todavía no está rastreado. Son controles documentales, no pruebas funcionales ni verificación de modo runtime. T7 sigue bloqueada, sin liberación.
5. MAIN realizará el commit 11 y registrará su revisión exacta en el informe principal. Este subtrabajo **no creó commits**, no ejecutó SQL/red/tests y no cambió ningún archivo de código.