# Tarea 4 — revisión acotada posterior a liberación

## Procedencia y límites

No es certificación integral. No se cambiaron workflows, runtimes, permisos, reglas de negocio, base de datos ni bundles servidos. No hubo commits ni escrituras de prueba en la base de la app.

- API liberada: `artifacts/api-server/dist-owner-login-v9-20260926/index.mjs`, SHA256 `3aa7706416313c4bf5bbb0cfce03ee7f2151d0c36d6008579346b022d9c5a9ea`, verificado localmente. La inspección de API usó `sourcesContent` de su mapa, no HEAD.
- Frontend liberado: `dist-priority-credit-presentation-20260926/index.html`, SHA256 `af0541fd749f49ffe917aaae51ba6adc8c1f99f1dd5ad1de419a57a2a0c578b5`, verificado localmente.
- Fuente frontend: `reports/priority-20260926/credit-presentation/frozen-root`. Se leyó su constructor/manifiesto y se conservó intacta.
- `conciliacion.tsx` actual coincidía byte por byte con esa fuente antes del cambio: SHA256 `a3e335cdfd3dfdda319583ffae1a80bb8b8412b78f4c631159f231d876c5fe31`.
- Cambio actual: SHA256 `dbea832020088b2e6ef3eaacfdf5387ad5a609e407516ac9fcb7c3f23324797f`. Overlay de un archivo en `frozen-overlay.patch`; comprobación inversa `git apply --check --reverse` correcta. MAIN debe aplicar al candidato congelado, no sustituir el árbol con HEAD.

## T4-01 — Confirmado y corregido; severidad ALTA

**Conciliación declara existencias correctas cuando falla su consulta.**

Evidencia liberada: `artifacts/mariana-textil/src/pages/conciliacion.tsx:40-48,113-139` dentro del frozen-root. El hook omitía `isError`; ausencia de datos se convertía en cero discrepancias. Tras un rechazo HTTP/red, terminada la carga, aparecía «Las existencias coinciden con el kardex» y cero combinaciones verificadas. Un error de refetch con datos previos también podía mantener acciones de reparación sobre evidencia vencida.

La API liberada `../src/routes/inventario.ts:2422-2446` puede rechazar por alcance o propagar un error de consulta: no hay contrato que convierta ese rechazo en conciliación exitosa.

**Corrección mínima:** consumir `isError/refetch` y mostrar un estado explícito de consulta fallida con reintento antes de las ramas saludable/discrepancias. No imprime detalles técnicos del servidor ni ofrece recalcular sobre el resultado fallido. Conserva carga, respuesta vacía exitosa y discrepancias exitosas. No cambia números, reglas contables ni autorizaciones.

**Regresión:** `conciliacion.test.mjs` transpila y renderiza el componente real (React server renderer, dependencias periféricas y hook controlados; no es una prueba de navegador integrado). Antes: 1 falla terminal por el falso mensaje saludable, 2 controles pasan. Después: 4/4, incluyendo consulta fallida sin datos, con datos vacíos y con discrepancias previas; carga; respuesta exitosa; reparación legítima; handler de reintento. No se afirma validación visual ni API/DB extremo a extremo.

## T4-02 — Respuesta incierta reproducida en handler aislado; persistencia SQL pendiente

La ruta liberada `../src/routes/inventario.ts:2470-2483` confirma `recalcularExistencias` antes de consultar/formatear la respuesta. En el mapa, `../src/lib/inventario.ts:3112-3120` confirma que la reparación tiene su propia transacción y candado. Si la lectura posterior falla, la respuesta puede fallar aunque la reparación esté confirmada. Esto NO demuestra escrituras parciales dentro de la reparación; tampoco demuestra daño de inventario.

Prioridad de investigación MEDIA. `recalcular-boundary.test.mjs` extrae mediante AST el handler exacto del mapa v9 y prueba la secuencia reparación resuelta → fallo de lectura → `next(error)` (1/1 PASS). Son colaboradores controlados, no una transacción SQL: acredita control de flujo, NO confirma por sí sola persistencia ni escrituras parciales. No se cambió la frontera transaccional especulativamente. Prueba restante: fallo dirigido después del commit, en copia desechable con identificación de base, y verificación del resultado persistido/reintento. **BLOCKED** hasta infraestructura y coordinación de MAIN.

## T4-03 — Efectos retenidos por hooks condicionales; severidad MEDIA, corregido

En `salida-nueva.tsx:51-55`, el padre productivo retorna antes de todos sus hooks cuando la query indica VENTA_CLIENTE. El efecto del escáner está en `:107-114`. `salida-hooks.mounted.mjs` monta ese padre real congelado con ReactDOM/JSDOM y cambia la query manteniendo la instancia (hijo de venta y dependencias periféricas controlados). Control: montar/desmontar solamente transferencia instala y limpia un intervalo. Caso: transferencia → venta → transferencia → venta mantiene respectivamente 1,1,2,2 intervalos y deja dos al desmontar. Evidencia: `salida-hooks-results.json`.

**No apareció crash de React.** Lo observado es retención/duplicación de efectos bajo cambios de modalidad en la misma instancia. `App.tsx:351-359` registra ambas modalidades bajo `/salidas/nueva`; el listado ofrece ambas URLs en `salidas.tsx:206-207`.

Seguimiento solicitado por MAIN: la reproducción ahora monta la página real dentro de `Route` real de wouter, usando su `useLocation`/historial. El baseline vuelve a dejar 1,1,2,2 intervalos y dos al desmontar; el criterio de regresión correcto falla terminalmente contra él. Control ordinario de montar/desmontar transferencia limpia su intervalo.

**Corrección mínima:** padre con `useSearch` incondicional, que elige entre el componente de venta existente y `SalidaTransferenciaNueva`. Este último contiene los hooks y efectos existentes de transferencia sin modificar su lógica. React desmonta esa rama cuando cambia la modalidad, limpiando el escáner; `useSearch` garantiza reacción a cambios de query sin depender de otro render.

La fuente actual coincidía antes con el padre liberado SHA `7ac0d0842f8e021b4341a9190e0f4369d3e2e6fb3425731416ab2d116ad7c57f`. Después: `bebaec1f535d9e255f364aa9be934153337fb99bdb9845477d4b7abde7c9822d`. Solo 7 líneas añadidas/2 reemplazadas. No se editó Conciliación durante este seguimiento: se respetó el overlay del dueño de permisos.

Resultado candidato final: intervalos 1,0,1,0 y cero al desmontar, sin errores React. Dos navegaciones adicionales de query **sin render forzado del padre** cambian correctamente transferencia/venta y 1/0 intervalos. Evidencias `salida-hooks-baseline-routing.json` / `salida-hooks-fixed-routing.json`. Dependencias API y el hijo de venta están controlados; esto no acredita la app completa ni navegador real.

## Candidato final integrado — entrega vigente a MAIN

El candidato parcial descrito abajo permanece como evidencia histórica; **no es la entrega final**.

- Comando: `FINAL_COMBINED=1 node reports/postrelease-review-20260926/tarea-4/build-candidate.mjs`.
- Salida: `artifacts/mariana-textil/dist-postreview-final-20260926`.
- `index.html` SHA256: `92f6123346e12d569a724840102d9fff57f915086a8f0e48d4c5b7ccf774bf72`.
- Manifiesto: `final-candidate.json`; fuente: `final-frozen-root`.
- Inventario: `final-source-inventory.json`, SHA256 `b7576f752a30c9d6e49f3088c624ee06922147b71435a5d29c2e92572384be65`.
- Base exacta af0541, **sin copiar HEAD**. Tres deltas autorizados: `index.css` del candidato de impresión a296 (SHA fuente `0b0269d8cbf9f843d21c114803ba0356411af74aad1de79a1dc83f346e875357`); `conciliacion.tsx` del overlay de tarea-3 que ya incluye estado de error de tarea-4 (SHA `2112cba3eae6965a14a82ca3b5a0a70a1d4e6c6ff73155810328ad1098a72448`); `salida-nueva.tsx` con la separación de hooks descrita. Otros **1455 archivos idénticos** al padre.
- Pruebas sobre fuente final: componente Conciliación 4/4; ciclo de QueryClient/error/reintento montado 1/1; prueba de permisos del dueño tarea-3 con perfiles auténticos y ADMIN 1/1; ciclo de Salida con Route real PASS. Las pruebas de error usan autorización controlada positiva y no sustituyen la prueba de permisos separada.
- Typecheck y Vite build PASS. CSS construido `index-CdyF5z0i.css` conserva el mismo asset de impresión a296; no se repitió impresión de navegador/PDF en esta tanda. Advertencias de sourcemap/tamaño de chunk sin cambios de empaquetado.
- **NO activado**, sin runtime ni workflow nuevo, sin commits ni DB writes. API y riesgo SQL T4-02 permanecen intactos. MAIN integra fuente actual, candidato y evidencia antes de liberar.

## Candidato parcial anterior — evidencia conservada, no entrega final

- Construcción: `node reports/postrelease-review-20260926/tarea-4/build-candidate.mjs`.
- Padre: crédito `af0541`; **ninguna fuente del candidato se copió de HEAD**. El script copió el padre congelado y aplicó exclusivamente el overlay textual, con hashes anterior/posterior obligatorios.
- Candidato: `artifacts/mariana-textil/dist-postreview-conciliacion`.
- `index.html` SHA256: `936376d13060f7f32d14c8bbe65c1fd0a22bedf0500eb7ed27bc0fff55426293`.
- Manifiesto: `candidate.json`. Inventario completo de fuentes antes/después: `source-inventory.json`, SHA256 `c226ca7f7bd29e29c3920c756c6bb2d17a0bd10b527a17b8f5e7877981444952`.
- Exactamente un archivo distinto (`conciliacion.tsx`); 1457 archivos iguales. Padre congelado revalidado sin cambios tras construir; bibliotecas internas del candidato enlazadas a su propia copia congelada.
- Pruebas contra **el archivo candidato**: 4/4 del componente real, 1/1 montada con QueryClient real. La prueba montada reproduce fallo inicial, click DOM de Reintentar y éxito, seguido de refetch fallido con datos anteriores; no ejecuta mutaciones. La misma prueba falló terminalmente contra el padre liberado por el falso mensaje saludable.
- Typecheck del candidato PASS; Vite build PASS. Advertencias existentes de resolución de sourcemaps en componentes UI y tamaño de chunk; no se cambió empaquetado para ocultarlas.
- Estado **construido, NO activado**. No nuevo runtime, workflow ni DB. MAIN conserva revisión visual, integración y liberación; API v9 sin cambios.

## Cobertura realizada

- Comparación de identidades liberadas y fuente congelada; reglas de composición/navegación, conciliación/existencia física y excepción documental de reportes en `replit.md:100-129,416-420,1058`.
- Lectura de memoria sobre reglas sustituidas, pruebas sobre componentes reales y baselines concurrentes; skill React/Vite.
- Barrido AST de TSX productivos congelados para retornos condicionales antes de hooks. Señal en `salida-nueva.tsx:51-55` investigada mediante montaje dirigido y corregida (T4-03); **no crash reproducido**, sí fuga de efectos.
- Lectura acotada de conciliación; errores/mutaciones de stock mínimos, ubicaciones, productos, proveedores y costos pendientes; detalles estructurados de errores; rutas API liberadas de conciliación, stock mínimos y productos. No equivale a cobertura funcional completa de esos módulos.
- Typecheck frontend actual: PASS. Transpilación de componente y `git diff --check`: PASS.
- Suite congelada existente de stock mínimos: 3/3 PASS. Suites congeladas de enlaces de inventario y errores de salidas: BLOCKED por dependencia `esbuild` ausente desde el paquete API del frozen-root; no se alteraron dependencias congeladas.
- Corrida adicional sobre fuente actual de esas tres suites: 9/10 PASS; fallo del caso navegador «kardex document cells keep desktop and mobile resolved-route branches» por espera del harness. No se presenta como verde ni se atribuye al cambio de conciliación. Las pruebas ejecutadas no hacen escrituras a la DB de la app.
- Inventario estático en `route-error-inventory.json`: 77 registros de rutas UI en App y 322 registros literales de métodos API sobre routers del mapa liberado; cada registro conserva archivo/línea y explicita que inventario NO significa prueba pasada. Ocho superficies de error tienen el nivel real de inspección descrito.
- Errores técnicos: `ubicaciones.tsx:52,64` muestra `err.message` como alternativa directa; no se forzó un error técnico real del servidor, por lo que es un punto de revisión, no fuga demostrada ni motivo de refactor general. Se conserva sin cambios.

## Negocio / permisos / bloqueos

- **BLOCKED — decisiones de negocio:** ninguna reinterpretación autorizada. La frase general de navegación de cifras (`replit.md:105`) tiene una exclusión explícita de detalle propio para Ventas Total/Utilidad (`:1058`); no se agregó un detalle ni se llamó bug a esa excepción. Cualquier cambio requiere decisión explícita del propietario.
- **Permisos coordinados:** no se editaron archivos ni valores de la matriz; pertenecen a `agentpostrelease-permissions`. La observación del botón Recalcular fue resuelta por su overlay, integrado íntegro con hash obligatorio y su prueba montada. No se amplió acceso ni se inventaron permisos.
- No hubo matriz autenticada multirol/sitio, fallo dirigido SQL, recorridos completos de operaciones parciales, visualización del preview ni pruebas sobre la nueva base desechable. MAIN conserva integración, evidencia de navegador y liberación del candidato. No se detectó una contradicción de negocio inequívoca que autorice cambiar políticas.