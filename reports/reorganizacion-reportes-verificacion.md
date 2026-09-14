# Reorganización de Reportes: estado de verificación

Fecha: 2026-09-14.

## Estado

El mapa fue aprobado, incluida la retirada R01 y la conservación íntegra de X04 en
Ventas → Comparar. El estado actual distingue evidencia numérica real de las
comprobaciones parciales de contrato UI: la composición fuente está preservada,
pero no se declara una publicación completa ni una E2E autenticada en vivo.

La API está actualmente en ejecución. La regresión inicial de autorización se
corrigió y las pruebas de seguridad/alcance quedaron reparadas; la nota de que
la API se detuvo pertenece únicamente a la línea histórica de la primera
revisión del 14 de septiembre y no describe el estado actual.

### Estado factual actual

- Seguridad y alcance: **62 pruebas de servidor y 16 pruebas frontend de
  alcance aprobadas**. Son conteos por suite y no se suman como pruebas
  distintas; no se asume independencia donde hay solapamiento.
- Build de API y frontend: **ambos pasan**; el typecheck todavía reporta
  únicamente los errores preexistentes de `src/lib/pos.ts:426` y
  `src/routes/clientes.ts:1329`.
- Contrato de composición: **56 tablas y 18 gráficos preservados** (`53`
  tablas genéricas/13 gráficos, `2` tablas/2 gráficos de Caja Diferencias y
  X04 con `1` tabla/3 gráficos).
- Comprobación numérica real: **53 tablas genéricas pasan**, además de caja en
  cero y cancelaciones por CTE con el SQL compartido (escenario `150`).
- X04 numérico: la comparación aislada legacy/current `compareStores` para el
  global del año 2026 pasa en el mismo snapshot `READ ONLY REPEATABLE READ`;
  los números y totales raw coinciden, y la exportación compuesta conserva sus
  12 columnas y toma los totales propiedad de la fuente sin recalcularlos.
- El usuario autorizó retirar solo el enlace pendiente al historial individual
  de etiquetas, sin construir esa pantalla ahora. Se conservan los registros
  y el enlace al detalle del rollo (`/inventario/rollos/:id`).
- Las comprobaciones parciales de contrato UI read-only ya pasaron con
  autenticación y respuestas interceptadas; no hicieron login ni escrituras de
  DB. No son una E2E autenticada viva ni una publicación.

## Ajustes autorizados

- No implementar la tasa de cancelación en esta entrega.
- Su definición futura es cancelados del periodo / (contabilizados + cancelados del periodo) × 100. Cancelados usa fecha de cancelación; contabilizados usa el predicado canónico, como Caja en Tiempo Real.
- Ventas V19/V20/V21 y Control deben compartir una fuente, no versiones paralelas.
- X04 conserva todas las columnas y Total General.
- Se retira únicamente la tarjeta Compras que duplicaba Costo recibido.

## Verificación solicitada, punto por punto

| Punto | Resultado | Evidencia / límite |
|---|---|---|
| 1. Typecheck/build | BUILD PASA; TYPECHECK CON ERRORES PREEXISTENTES | API y frontend construyen; quedan únicamente `src/lib/pos.ts:426` y `src/routes/clientes.ts:1329`, ambos preexistentes. |
| 1. Codegen sin diferencias | PASÓ | Codegen terminó correctamente; una segunda generación conservó exactamente los hashes de los archivos generados. |
| 2. Suites de seguridad, alcance y reportes | PASÓ | Se repararon y aprobaron 62 pruebas de servidor y 16 pruebas frontend de alcance. |
| 2. Integraciones restantes | BLOQUEADAS | Suites de integración de reportes/analytics, permisos y admin bypass requieren INSERT/DELETE/usuarios/fixtures fuera de la población autorizada. No ejecutadas. |
| 3. Mapa contra implementación | PASÓ EN EL CONTRATO DE FUENTES | Se preservan 56 tablas y 18 gráficos; X04 conserva su tabla/3 gráficos y R01 es la única excepción autorizada. Las comprobaciones parciales de contrato UI también pasaron, con los límites documentados abajo. |
| 4. Ninguna cifra cambia | PASÓ NUMÉRICAMENTE | Las 53 tablas genéricas pasan en el snapshot real; caja en cero y cancelaciones por CTE compartido pasan. X04 global 2026 también pasa la comparación raw legacy/current y la exportación. |
| 5. Cada señal cuenta y abre documento | PARCIAL | Por decisión del usuario se retiró solo el enlace pendiente al historial individual de etiquetas y se conservó el acceso al detalle del rollo. Con filas capturadas en cero se validaron contratos, no click-through de documentos reales. |
| 6. Bloques en cero visibles | PASÓ EN CONTRATO UI, SIN FILAS REALES | La navegación y las formas read-only pasaron con respuestas interceptadas; las filas de cancelaciones, abonos, ajustes y detalle de corte fueron cero, por lo que no se acredita click-through de documentos. |
| 7. Comparación en cinco y selector único | PASÓ EN CONTRATO UI | Pasaron las cinco pestañas normales y Comparar en las cinco sobre TIENDA+BODEGA, con un solo selector de sitio, parámetros de sitio/exportación y restricciones de rol; no se cuenta como E2E autenticada en vivo. |
| 8. PROPIA y permisos | PASÓ EN PRUEBAS AUTORIZADAS | 62 pruebas de servidor cubren la reparación de seguridad/alcance. No se fabricaron usuarios ni se amplió el snapshot real. |
| 9. Cinco pestañas en teléfono | PASÓ EN CONTRATO UI | Mobile 402 no mostró overflow de documentos. Es una comprobación read-only interceptada; no hubo login real, descarga de bytes ni E2E autenticada. |

## Hallazgos iniciales y límites actuales

### Hallazgos iniciales (línea histórica del 14 de septiembre)

Los puntos siguientes describen los hallazgos de la primera ejecución, no el
estado factual actual. Las correcciones autorizadas de seguridad y alcance se
validaron con las 62 pruebas de servidor y 16 frontend indicadas arriba.

### 1. Permisos y alcance — corregido y cubierto por pruebas

- La primera revisión detectó fronteras de rol y propagación de sitios; la
  reparación conserva la frontera y quedó cubierta por las pruebas actuales.

### 2. Reportes compilación inicial (corregido)

El error inicial de `onRefresh={refetch}` fue corregido. El build de API y
frontend pasa; solo permanecen los dos errores de typecheck preexistentes
documentados arriba.

### 3. Los enlaces no cumplen el acceso al documento

- Backend/frontend/OpenAPI no comparten un contrato de enlace consistente.
- El frontend busca sufijos Url/Enlace, mientras el backend entrega campos Href.
- Hay una ruta de etiquetas inexistente y enlaces con sesionId/movimientoId que sus pantallas de destino no procesan.
- Una URL impresa como texto o un listado general no cumple el requisito.

### 4. Comparación, periodos y duplicación de caja (estado actual)

- La fuente compuesta conserva 56 tablas y 18 gráficos. La comparación
  numérica real pasa para las 53 tablas genéricas; X04 tiene además su modo
  aislado documentado abajo. Las comprobaciones parciales de contrato UI pasan;
  no sustituyen una E2E autenticada viva.
- Caja Diferencias standalone no se trata como una segunda fuente genérica de
  caja.

### 5. Exportaciones y accesos anteriores (estado actual)

- El contrato fuente compuesto cuenta y preserva las 56 tablas/18 gráficos; la
  exportación X04 se verificó con sus 12 columnas y totales propiedad de
  `compareStores`. En UI se validaron parámetros GET de exportación, pero no
  bytes descargados.

## Lo que sí se constató

- R01 se retiró y Costo recibido permanece.
- X04 mantiene las doce columnas y Total General.
- No se añadió una tasa de cancelación.
- Ventas y Control invocan un cargador común de cancelaciones.
- Las pruebas nuevas de esa reutilización y el snapshot read-only cubren los
  consumidores autorizados; las comprobaciones UI interceptadas se documentan
  abajo y no implican click-through con filas reales.
- Los servicios arrancaron durante la revisión inicial; esa línea histórica no
  equivale a aprobar la funcionalidad. La API está actualmente en ejecución.

## Diferencia previa de cancelaciones, sin corregir

Caja en Tiempo Real ya coincide con la fórmula futura aprobada y usa fecha de cancelación. Ventas filtra actualmente sus cancelaciones por fecha de cobro/autorización. Se preservó ese criterio existente al extraer la fuente compartida; no se normalizó contra Caja.

Por tanto, esta reorganización no elimina esa diferencia histórica entre Ventas y Caja. No debe introducirse una tasa de Reportes sin resolver explícitamente ese alcance.

## Evidencia X04 numérica aislada

Para cerrar la brecha de evidencia de X04 se ejecutó únicamente el modo
X04 del verificador, sin repetir las 53 comprobaciones numéricas anteriores:

```sh
REPORT_SCOPE_COMPLETE=1 pnpm --filter @workspace/api-server exec tsx \
  src/scripts/verify-report-composition-readonly.ts \
  --x04-only --final --scope-complete
```

La ejecución usó una sola conexión `READ ONLY REPEATABLE READ`, el rango exacto
`2026-01-01`–`2026-12-31`, alcance global y el mismo snapshot real para legacy y
actual. `compareStores` raw coincidió completo (`sourceRawEqual=true`,
`sourceTotalsEqual=true`), con 3 tiendas y 3 puntos diarios en ambos lados.
Los totales globales de la fuente fueron: ventas/subtotal `103302.00`, costo
`86822.00`, margen `16480.00`, tickets `4`, ticket promedio `25825.50`,
cancelaciones `0`, líneas excluidas `0`, metros `4986.000`, kilos `0.000`,
bolsas `0.000`, efectivo `103302.00`, transferencia `0.00`, crédito `0.00`,
facturado `0.00` y diferencia de caja `0.00`; participación global
`100.00`.

La exportación compuesta real `x04-comparativo-tiendas` conservó exactamente
12 columnas, 3 filas y Total General. `sourceOwnedTotals=true` y
`exportTotalsEqual=true`: los campos directos y los desgloses formateados se
tomaron de los totales de `compareStores`; la exportación no recalculó
totales. La evidencia resumida está en
`/tmp/reportes-composition-x04-final.json` y los payloads completos, sin
imprimir filas personales, en
`/tmp/reportes-composition-x04-final.json.payloads.json` con modo `0600`.

## Comprobaciones parciales de contrato UI read-only

La revisión del navegador se completó interceptando autenticación y respuestas;
no hizo login ni escrituras de DB. Pasaron:

- las cinco pestañas en el flujo normal;
- Comparar en las cinco sobre `TIENDA` y `BODEGA`;
- un único selector de sitio, incluido sitio seleccionado;
- parámetros de sitio y de exportación en las solicitudes `GET` de XLSX y PDF;
- las tres rutas legacy;
- `ADMIN` con alcance `PROPIA`;
- `non-ADMIN` con Comparar deshabilitado para `TODAS`;
- ausencia de Control para usuarios no administradores;
- mobile de 402 px sin overflow del documento.

La forma inicial del mock de caja fue capturada incorrectamente y se corrigió;
no era un defecto de la aplicación. No hubo click-through real de filas de
cancelaciones, abonos, ajustes o detalle de corte: las filas capturadas fueron
cero y solo se validaron sus contratos. Tampoco hubo E2E autenticada viva ni
bytes reales de descarga de XLSX/PDF. La vista previa real del screenshot tool
mostró login, como corresponde a una sesión no autenticada, y no es evidencia
de los reportes. Este resultado UI es independiente del pase numérico de las
53 tablas genéricas, caja/cancelaciones y X04.

## Comandos y evidencia

- `pnpm run typecheck` — salida 2; `/tmp/report-reorg-typecheck.log`.
- `pnpm --filter @workspace/mariana-textil run typecheck` — salida 2; `/tmp/report-reorg-frontend-typecheck.log`.
- `pnpm --filter @workspace/api-spec run codegen` — salida 0; `/tmp/report-reorg-codegen.log`.
- Segunda generación y comparación SHA-256 — sin diferencias; `/tmp/report-reorg-codegen-repro.log`.
- Selección segura reportes/analytics/permisos — 119/119; `/tmp/verification-reportes-analytics-permissions-20260914.log`.
- `pnpm --filter @workspace/api-server run test:admin-analytics` — 33/33; `/tmp/verification-admin-analytics-script-20260914.log`.
- `pnpm test:isolated --suite api-script:test:admin-realtime-reconciliation` — 1/1; `/tmp/verification-admin-realtime-reconciliation-20260914.log`.

La integración autorizada usa PostgreSQL local desechable, esquema y seed autorizado, y filas virtuales limitadas a SELECTs. No se añadieron identidades reales ni fixtures persistidos adicionales. Las suites incompatibles no se ejecutaron.
Los conteos de suites se conservan por separado: las suites con solapamiento no
se suman ni se presentan como un número de pruebas independientes.

La verificación numérica autorizada está completada, separando las 53 tablas
genéricas, caja en cero/cancelaciones CTE y la comparación X04 aislada. Las
comprobaciones parciales de contrato UI también están completadas con los
límites documentados. La pantalla de historial individual de etiquetas queda
pospuesta por decisión del usuario; se conserva el enlace al detalle del rollo.
No se declara una E2E autenticada viva
ni la reorganización como publicada.