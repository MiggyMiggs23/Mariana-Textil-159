# Auditoría documental Prompt A — Bloque 5: verificabilidad

**Fecha de lectura:** 2026-09-15  
**Fuentes leídas:** `replit.md` completo (975 líneas, 157159 bytes), `lib/api-spec/openapi.yaml`
y las fuentes que se citan en las tablas.  
El conteo de `replit.md` corresponde al snapshot de inicio de esta auditoría; si
una revisión concurrente deja el archivo modificado después de ese snapshot, no
debe mezclarse con este baseline.
**Alcance:** solo lecturas estáticas. No se ejecutaron workflows, servidor, build,
typecheck, navegador, suites, SQL, migraciones ni escrituras de código/DB; solo
se generaron los dos reportes de esta auditoría. No se modificó
`replit.md`, `artifacts/`, `lib/`, `scripts/`, DB, servicios, auth ni tests.
La salida textual reproducible está en
`reports/prompt-a-verificabilidad-salida.txt`.

## Cómo leer el resultado

- **COMPROBADA — código actual:** la afirmación se pudo verificar en una declaración
  o contrato leído en esta sesión.
- **COMPROBADA — existencia:** el path existe exactamente, pero la auditoría no
  acredita el resultado histórico que el archivo describe.
- **CONTRADICCIÓN:** el texto de `replit.md` no coincide con el código o con la
  existencia observada.
- **NO APLICA:** no es un path HTTP OpenAPI (por ejemplo, un prefijo de proceso o
  una ruta del router frontend); se deja evidencia separada.
- **NO COMPROBADA:** requiere ejecución, datos, navegador, impresora o un artefacto
  que no se volvió a ejecutar. No se presenta como correcta.

Los resultados históricos de pruebas y datos se conservan explícitamente como
**no rerun**. Los conteos de declaraciones actuales (módulos, enums, tipos,
estados y listas de purga) sí fueron recontados en esta sesión.

## 1. Todas las rutas y strings con forma de ruta HTTP

Se comprobó cada ocurrencia, no solo cada string único. Para una ruta con parámetros
se exigió la forma literal de OpenAPI (`{id}`); una forma frontend con `:id` se
clasificó como tal, no como endpoint.

| Ubicación en `replit.md` | Afirmación/path | Resultado | Comprobación y corrección sugerida |
|---:|---|---|---|
| 27 | `GET /inventario/entradas/{id}` | COMPROBADA | Existe literalmente en OpenAPI. Mantener. |
| 105 | enlace `/tickets/{id}` | COMPROBADA | Existe literalmente en OpenAPI; además el router frontend usa `/tickets/:id` en `artifacts/mariana-textil/src/App.tsx:581`. |
| 191 | API en `/api` | NO APLICA | Es prefijo/preview del proceso, no un path declarado en OpenAPI. No corregirlo como endpoint; si se exige un contrato HTTP, documentar el prefijo por separado. |
| 243 | `/precios` | COMPROBADA | Existe en OpenAPI y como ruta frontend `App.tsx:448`. |
| 255 | `/auth/login` | COMPROBADA | Existe literalmente en OpenAPI. |
| 279 | `GET /inventario/existencias/agrupadas` | COMPROBADA | Existe literalmente en OpenAPI. |
| 280 | `GET /dashboard` | COMPROBADA | Existe literalmente en OpenAPI y el router fuente mantiene el endpoint. |
| 281 | `GET /inventario/rollos` | COMPROBADA | Existe literalmente en OpenAPI; el router local declara `/rollos` y `routes/index.ts:48` lo monta bajo `/inventario`. |
| 281 | `GET /productos/{id}` | COMPROBADA | Existe literalmente en OpenAPI. |
| 287 | `GET /productos` | COMPROBADA | Existe literalmente en OpenAPI. |
| 369 | `/pos/buscar` | COMPROBADA | Existe literalmente en OpenAPI. |
| 369 | `POST /salidas/borrador/rollos` | COMPROBADA | Existe literalmente en OpenAPI. |
| 369 | `/etiquetas/rollos` | COMPROBADA | Existe literalmente en OpenAPI. |
| 369 | `/rollos` | NO APLICA / precisa contexto | No existe como path literal OpenAPI ni como ruta frontend. Sí es el segmento local del `inventarioRouter` (`routes/inventario.ts:1659`) y queda publicado como `/inventario/rollos` por el montaje comprobado arriba. Corrección sugerida: escribir `/inventario/rollos` cuando se refiera a HTTP; conservar `/rollos` solo como segmento interno del router. |
| 550 | `/pos` | NO APLICA | No existe como path OpenAPI, pero sí como ruta frontend exacta en `App.tsx:460`. Es un enlace/pantalla, no una afirmación de API. |
| 621 | `PATCH /productos/{id}` | COMPROBADA | El path existe literalmente en OpenAPI. |
| 621 | `/precios` | COMPROBADA | Segunda ocurrencia; existe literalmente en OpenAPI. |
| 945 | `/tmp/reportes-composition-x04-final.json` | CONTRADICCIÓN de existencia, no ruta HTTP | No es endpoint y el archivo no existe en esta sesión (`test -e` dio `MISSING`). No presentarlo como evidencia disponible; sustituir por el artefacto existente o marcarlo no comprobado. |
| 950 | `/admin/diferencias` | COMPROBADA | Existe literalmente en OpenAPI y la ruta fuente se declara en `admin-analytics.ts:228`. |
| 954 | `/inventario/rollos/:id` | NO APLICA | Es link frontend exacto en `App.tsx:401`; OpenAPI usa `/inventario/rollos/{id}` para el API. No mezclar las dos sintaxis. |

### Observación de rutas

La única cadena que parece una API inexistente es `/rollos`, pero la evidencia del
router muestra que es un segmento montado bajo `/inventario`; por tanto no se
clasifica como endpoint inexistente. La ruta `/pos` es exclusivamente frontend.
El único path de evidencia realmente faltante es el JSON bajo `/tmp`.

## 2. Archivos `docs/` y `reports/` citados: existencia exacta

Cada ocurrencia se conserva, incluso cuando el mismo archivo se cita dos veces.
Todos los paths siguientes dieron `EXACT` con `fs.existsSync`; no se comprobó el
contenido ni se rerunearon las pruebas que los reportes describen.

| Ubicación | Archivo citado exactamente | Resultado | Límite/corrección |
|---:|---|---|---|
| 222 | `docs/endpoint-permissions.md` | COMPROBADA — existencia | No se leyó para validar la matriz completa; no afirmar su contenido por esta tabla. |
| 321 | `reports/inventory-truth-part1-validation-2026-08-26.md` | COMPROBADA — existencia | Resultado histórico, no rerun. |
| 379 | `docs/inventory-engine-lock-loops.md` | COMPROBADA — existencia | No se rerunó su prueba de contrato. |
| 470 | `reports/auditoria-suites-base-pruebas.html` | COMPROBADA — existencia | No se rerunó el inventario de suites. |
| 802 | `reports/reconstruir-cache-existencias-disposable-evidence.md` | COMPROBADA — existencia | No se rerunó la reconstrucción. |
| 814 | `docs/stock-minimos-verificacion.md` | COMPROBADA — existencia | No se rerunaron las verificaciones reales. |
| 825 | `reports/abonos-fifo-2026-09-15-resultado.md` | COMPROBADA — existencia | No rerun; evidencia histórica. |
| 825, 838 | `reports/abonos-bloque4-2026-09-15-resultado.md` | COMPROBADA — existencia | Dos claims separados; no volver a ejecutar operaciones financieras. |
| 827 | `reports/credito-saldo-favor/verificacion-items-1-2.md` | COMPROBADA — existencia | El propio documento se cita como antecedente; no rerun. |
| 827 | `reports/credito-saldo-favor/resultado-2026-09-15.md` | COMPROBADA — existencia | El propio documento se cita como antecedente; no rerun. |
| 834 | `reports/abonos-fifo-2026-09-15-diagnostico.md` | COMPROBADA — existencia | No se rerunó diagnóstico ni se investigó base histórica. |
| 839 | `reports/abonos-fifo-2026-09-15-propuesta-bloque-5.md` | COMPROBADA — existencia | Existencia de propuesta, no implementación. |
| 881 | `reports/proveedores-utilidad-verificacion.md` | COMPROBADA — existencia | No se rerunaron pruebas ni SQL. |
| 920 | `reports/export-download-verification.md` | COMPROBADA — existencia | No se descargaron archivos en esta auditoría. |
| 948 | `reports/mapa-destino-reportes.md` | COMPROBADA — existencia | No se verificó el mapa contra cada vista. |
| 970, 974 | `reports/prompt-c-readonly-2026-09-15-after.md` | COMPROBADA — existencia | Dos claims; lectura/resultado histórico, no rerun. |
| 976 | `reports/prompt-c-resultado.md` | COMPROBADA — existencia | No rerun de Prompt C. |
| 377 | `reports/` | DIRECTORIO, no archivo | Es un destino/glob de reportes, no una evidencia identificable. Exigir path de archivo cuando se use como prueba. |

`replit.md` también dice “y su JSON” en la línea 974 sin dar el nombre exacto
del archivo. Eso queda **NO COMPROBADO como cita de archivo**; debe escribirse el
path exacto si se quiere auditar su existencia.

## 3. Funciones, campos y nombres de código

La siguiente tabla cubre las funciones y campos nombrados en el documento. Una
declaración local también cuenta como existencia; no se exige que sea exportada.
La sugerencia general de mantenimiento es sustituir las referencias de línea por
archivo + nombre de función, tal como el propio documento exige en su regla de
higiene.

| Ubicación `replit.md` | Nombre citado | Declaración actual | Resultado |
|---:|---|---|---|
| 30 | `autorizarNota` | `artifacts/api-server/src/lib/pos.ts:1794` | COMPROBADA |
| 50 | `MAYOREO_THRESHOLD_UNITS` | `lib/metered-pricing/src/index.ts:2 = 10` | COMPROBADA; el valor 10 coincide |
| 62, 474 | `documentosPendientes` | campos de respuesta en `pos.ts:2469`, `admin-analytics.ts` y OpenAPI | COMPROBADA como campo; no es función |
| 107 | `venderRollo` | `artifacts/api-server/src/lib/inventario.ts:1800` | COMPROBADA |
| 107, 312 | `salidaMostrador` | `inventario.ts:1717` | COMPROBADA |
| 119, 354 | `SALIDA_EN_TRANSITO_ALERT_THRESHOLD_HOURS` | `admin-alertas.ts:11 = 24` | COMPROBADA; frontera estricta está en `isSalidaEnTransitoOverdue:29` |
| 153 | `ensureSalidasSchema` | `lib/db/src/lib/salidas-schema.ts:8` | COMPROBADA |
| 229 | `normalizarSerieEscaneada` | `lib/scanned-code/src/index.ts:36` | COMPROBADA |
| 229 | `interpretarCodigoEscaneado` | `lib/scanned-code/src/index.ts:15` | COMPROBADA |
| 237 | `resolvePermiso` | `artifacts/api-server/src/lib/permisos.ts:121` | COMPROBADA |
| 237 | `requierePermiso` | `permisos.ts:258` | COMPROBADA |
| 219 | `buildPermissionMatrix` | `permisos.ts:188` | COMPROBADA |
| 273, 279 | `reconstruirCacheExistencias` | `inventario.ts:2832` | COMPROBADA |
| 279 | `refreshCache` | función local `inventario.ts:235` | COMPROBADA |
| 279 | `conciliarTodo` | `inventario.ts:2692` | COMPROBADA |
| 279, 280 | `getInventarioPorUbicacion` | `inventario.ts:2885` | COMPROBADA |
| 279 | `buildInventoryReport` | `reportes-inventory.ts:191` | COMPROBADA |
| 280 | `currentCost` | función local `routes/precios.ts:47` | COMPROBADA; la referencia `:37` de `replit.md` apunta a tipos, no a la función |
| 280 | `weightedCurrentUnitCost` | `lib/precios.ts:21` | COMPROBADA |
| 281 | `getRolloDetail` | función local `routes/inventario.ts:372` | COMPROBADA; la cita `:260` apunta a una interfaz |
| 281 | `analiticaGlobalProveedores` | `compras-proveedor.ts:1758` | COMPROBADA |
| 283 | `getContenedorDetail` | `contenedores.ts:262` | COMPROBADA; la cita `:242` apunta a actualización |
| 283 | `getContenedoresSummary` | `contenedores.ts:542` | COMPROBADA; la cita `:509` está dentro de SQL de detalle |
| 283 | `canEditContenedor` | `contenedores-helpers.ts:87` | COMPROBADA |
| 289, 680, 744 | `resolveReadScope` | `routes/inventario.ts` y consumidores de alcance | COMPROBADA |
| 295 | `iniciarTransferencia` | no hay implementación activa; solo strings en `transferencias-block3-architecture.test.ts:43` | COMPROBADA la ausencia de función activa |
| 295 | `confirmarTransferencia` | no hay implementación activa; solo marker de prueba | COMPROBADA la ausencia de función activa |
| 295 | `cancelarTransferencia` | no hay implementación activa; solo marker de prueba | COMPROBADA la ausencia de función activa |
| 295, 378 | `transferirRolloInmediato` | `inventario.ts:1403` | COMPROBADA |
| 295 | `ajustarRollo` | `inventario.ts:2166` | COMPROBADA |
| 296, 339, 378 | `moverRollo` | `inventario.ts:1478` | COMPROBADA |
| 296, 339, 348, 378 | `recibirTransferencia` | `inventario.ts:1601` | COMPROBADA |
| 325, 346, 361, 368, 371 | `CampoEscaneo` | componente frontend y uso en las pantallas listadas | COMPROBADA como nombre; la cobertura física no queda comprobada |
| 361, 368 | `deliver`, `onScan` | callbacks en el componente/consumidores de escaneo | COMPROBADA por búsqueda estática; no implica prueba con hardware |
| 376 | `lockInventoryPairs` | `inventario.ts:68` | COMPROBADA |
| 423 | `revertirMovimiento` | `inventario.ts:2484` | COMPROBADA |
| 521, 523 | `destinationReadModel` | `admin-analytics.ts:130` | COMPROBADA |
| 517 | `accountDestination` | `admin-analytics.ts:111` | COMPROBADA |
| 535 | `isValidPaymentDestination` | `credit-allocation.ts:546` | COMPROBADA |
| 535 | `allocateCreditFifo` | `credit-allocation.ts:142` | COMPROBADA |
| 550 | `home-route.ts` | `artifacts/mariana-textil/src/lib/home-route.ts` | COMPROBADA |
| 550 | `sensitive-data.ts` | `artifacts/api-server/src/lib/sensitive-data.ts` | COMPROBADA |
| 630 | algoritmo en `lib/credit-allocation.ts` | archivo real `artifacts/api-server/src/lib/credit-allocation.ts` | CONTRADICCIÓN de path relativo; corregir el prefijo, no el nombre del algoritmo |
| 728 | `clientes.diasCredito` | campo usado en código generado/cliente | COMPROBADA como nombre; no se revalidó UI |
| 760 | `tipoMovimientoEnum` | `lib/db/src/schema/enums.ts:66` | COMPROBADA |
| 850 | `deriveEstadoNota` | `artifacts/api-server/src/lib/clientes-aging.ts:26` | COMPROBADA |
| 941 | `compareStores` | `artifacts/api-server/src/lib/admin-analytics.ts:1908` | COMPROBADA como función; el resultado histórico del snapshot/exportación sigue NO COMPROBADO |
| 961 | `useSharedCuentasDestino` | `artifacts/mariana-textil/src/hooks/use-shared-cuentas-destino.ts:3` | COMPROBADA |
| 961 | `getDestinationAccounts` | `admin-analytics.ts:1301` | COMPROBADA |
| 968 | `listarSesionesCajaHistorial` | `pos.ts:2101` | COMPROBADA |
| 968 | `buildCorteCaja` | `pos.ts:2161` | COMPROBADA |

### Referencias de línea que contradicen el contenido actual

Estas no son rutas HTTP: son claims explícitos de ubicación de código y por eso
se revisaron contra el archivo actual.

| Ubicación del claim | `replit.md` afirma | Lectura actual | Corrección puntual sugerida |
|---:|---|---|---|
| 538 | `pos.ts:2082-2088` deriva las cuentas del corte | Es la consulta de `ticket_pagos` y construcción de formas de pago dentro de `listarSesionesCajaHistorial` | Cambiar a nombre de función y citar `buildCorteCaja` para el cálculo de efectivo; eliminar la línea histórica falsa |
| 539 | `admin-analytics.ts:324-335` repite el predicado | 324-330 es `mexicoCityHour`; 332-347 es `where` | Citar `getSalesSummary` y `accountedDocumentPredicate`/la copia SQL real |
| 540 | `admin-analytics.ts:376-378` es el mismo predicado para margen | 376-378 cuenta costo/importe; no es el predicado | Citar `getSessionMargin`; su copia directa está en 440-442 |
| 542 | `notificaciones.ts:194` usa `pendingTicketPredicate()` | 194-200 calcula el contador; el uso actual está en 225 | Citar `router.get("/notificaciones/feed")` y `pendingTicketPredicate`, sin línea fija |
| 279 | `lib/inventario.ts`, `lib/reportes-inventory.ts` | Los archivos existen bajo `artifacts/api-server/src/lib/` | Completar prefijo de repositorio |
| 280 | `routes/dashboard.ts`, `routes/precios.ts`, `lib/precios.ts` | Existen bajo `artifacts/api-server/src/`; `currentCost` inicia en 47, no 37 | Completar prefijos y reemplazar línea por función |
| 281 | `routes/inventario.ts:260`, `:1179`, `:642`, `routes/etiquetas.ts:83,147,289`, `routes/productos.ts:468` | Varias líneas apuntan a interfaces, `pageSize`, parsing de reversa, helpers de revisión o import preview, no a los endpoints descritos | Eliminar líneas obsoletas y citar funciones/handlers |
| 283 | `lib/contenedores.ts:242` y `:509` son las funciones citadas | 242 está en cancelación; 509 en SQL; las funciones empiezan en 262 y 542 | Citar `getContenedorDetail` y `getContenedoresSummary` |
| 354 | constante en `lib/admin-alertas.ts` | El archivo real es `artifacts/api-server/src/lib/admin-alertas.ts` | Completar prefijo |

## 4. Constantes, valores, enums y conteos

### 4.1 Valores nombrados

| Ubicación | Claim | Declaración o fuente actual | Resultado |
|---:|---|---|---|
| 42 | `METREADO_CASH_ONLY` | código de error literal en `pos.ts:1713`, cubierto por test existente | COMPROBADA como código; no es una constante exportada |
| 50 | Mayoreo = 10 unidades | `MAYOREO_THRESHOLD_UNITS = 10`; aliases de metros/bolsas apuntan al mismo valor | COMPROBADA |
| 64 | mínimo de 5 Notas liquidadas, colores 90/70 y utilización 75% | Se trata de lógica/resultado de crédito, no de una constante única visible en la cita | NO COMPROBADA en esta auditoría estática; no convertir en “valor de declaración” sin ubicar cada fuente |
| 119, 354 | alerta de Salidas = 24 h, estrictamente mayor | constante 24 y comparación `>` en `isSalidaEnTransitoOverdue` | COMPROBADA |
| 261 | promedio metrado de 12 meses | `MONTH_COUNT = 12` en `reportes-que-comprar.ts`; el costo metrado tiene fuentes separadas | PARCIALMENTE COMPROBADA; no se revalidó toda la regla financiera |
| 337, 360 | nueve estados históricos con conteos | lista de estados legados en `ensureSalidasSchema` permite el mapeo, pero los conteos de filas son históricos | NO COMPROBADA como conteo actual; no rerun |
| 354 | exactamente 24 h aún no alerta | frontera estricta comprobable en función | COMPROBADA |
| 564 | defaults históricos 99/499 versus código 0 | no se consultó DB ni se hizo push | NO COMPROBADA; conservar como pendiente histórica |
| 670 | inactividad 8 h, tope 16 h | `INACTIVITY_MS = 8*60*60*1000`, `ABSOLUTE_SESSION_MS = 16*60*60*1000` en `middlewares/auth.ts:17-18` | COMPROBADA |
| 696 | plazos 7, 15, 30, 60 | no se ubicó una declaración única durante este barrido | NO COMPROBADA como lista de constante |
| 718 | umbral estricto 10% | `CANCELLATION_RATE_ALERT_THRESHOLD_PERCENT = 10` en `admin-analytics.ts:23`; el label es `CANCELACIONES_ALTAS` | COMPROBADA valor; `CANCELACIONES_ALTAS` no es el nombre de la constante |
| 786 | Salida conserva diez renglones; 11 pagina 10+1 | no se rerunó impresión ni se ubicó aquí una declaración única de capacidad | NO COMPROBADA |
| 788 | Nota 8, Entrada 10/22 | no se rerunó PDF | NO COMPROBADA |
| 809 | `HISTORY_MIN_MONTHS = 3` | `reportes-que-comprar.ts:13 = 3` | COMPROBADA |

### 4.2 Roles, tipos de equipo y estados

| Ubicación | Lista afirmada | Recuento/fuente actual | Resultado y corrección |
|---:|---|---|---|
| 121, 143, 237, 239, 415-417 | módulos configurables | `MODULOS` en `artifacts/api-server/src/lib/permisos.ts:73-106` contiene 32; la lista de `replit.md:417` contiene los mismos 32 | COMPROBADA. El número vigente es **32, no 33**. |
| 145, 558, 560 | permisos por rol | `ROLES` de seed contiene 6: TERMINAL, CAJA, SUPERVISOR, BODEGA, SISTEMAS, CONTADOR | COMPROBADA como matriz no-ADMIN; el enum de roles completo tiene 7 |
| 552-556, 820 | roles contra `rolUsuarioEnum` | `rolUsuarioEnum` contiene 7: ADMIN, TERMINAL, CAJA, SUPERVISOR, BODEGA, SISTEMAS, CONTADOR | COMPROBADA. Si se escribe “todos los roles”, incluir ADMIN; “seis permisos por rol” solo describe la matriz no-ADMIN. |
| 135 | siete tipos de equipo | `TIPOS_EQUIPO` contiene 7: COMPUTADORA_POS, IMPRESORA_ENTRADAS, IMPRESORA_SALIDAS_NOTAS, IMPRESORA_ETIQUETAS, IMPRESORA_TICKETS, PISTOLA_ESCANER, SMARTPHONE_ESCANER | COMPROBADA |
| 135, 141 | impresora de entradas y de salidas/notas | `DEFINICIONES_EQUIPO` tiene exactamente `IMPRESORA_ENTRADAS` y `IMPRESORA_SALIDAS_NOTAS`; sus checklists exigen entrada real/Carta y salida+nota/A5, respectivamente | COMPROBADA en código; la instalación física no fue probada |
| 137 | excluir En tránsito y Externo | `routes/equipos.ts:34` fija `EQUIPOS_SITE_TYPES = ["TIENDA","BODEGA"]`; líneas 249-258 aplican el filtro | COMPROBADA |
| 139, 143 | permisos `equipos/ver`, `/crear`, `/editar`, activo derivado y no DELETE | rutas de Equipos exponen GET/POST/PATCH/PATCH; no existe DELETE; `toEquipmentResponse` calcula `activo` por faltantes | COMPROBADA estáticamente |
| 93, 160, 230, 333 | cinco estados de Salida | `estadoSalidaEnum` y DDL contienen ARMANDO, EN_TRANSITO, RECIBIDA, ENTREGADA, CANCELADA en ese orden | COMPROBADA |
| 337, 360 | nueve estados | son estados **históricos previos**, no el enum vigente | COMPROBADA solo como migración documentada; marcar como histórico, no como 9 actuales |
| 248, 495 | cuatro unidades de producto | `unidadProductoEnum` contiene METRO, KILO, BOLSA, PIEZA | COMPROBADA |
| 760 | `DEVOLUCION` existe en `tipoMovimientoEnum` | enum líneas 66-77 contiene DEVOLUCION | COMPROBADA como valor. La afirmación adicional “no hay ruta/servicio/prueba que lo genere” no se acreditó solo por la existencia del enum; dejarla como pendiente de prueba de generación |
| 30 | formas de cuenta | `formaPagoCuentaEnum` contiene EFECTIVO, TRANSFERENCIA, FACTURADO, CHEQUE, OTRO, CREDITO | COMPROBADA como enum; el uso histórico/no seleccionable requiere UI/servidor, no solo enum |
| 40 | formas de ticket | `formaPagoTicketEnum` contiene EFECTIVO, TRANSFERENCIA, CREDITO, FACTURADO | COMPROBADA con precisión semántica: el enum compartido conserva CREDITO, mientras la regla operativa dice que solo Nota lo usa; aclarar “enum compartido; CREDITO solo para Nota” |

### 4.3 Listas de purga: conteo contra fuente

La fuente que se leyó fue
`scripts/src/purge-operational-phase2.mts`. No se ejecutó la purga ni se consultó
la DB. Los nombres se contrastaron uno por uno con el texto de `replit.md`.

| Lista | Claim de `replit.md` | Recuento en fuente | Resultado |
|---|---:|---:|---|
| A | 33 tablas borradas | 33 | COMPROBADA como lista declarada; estado runtime no rerun |
| B | 7 elementos reiniciados | 7 elementos de lista (`ticket_folio`, `entrada_folio`, `salida_folio`, `viaje_folio`, `auditoria_inventario_folio`, `series_consecutivo`, `existencias`) + `public.contenedores_folio_seq` como secuencia aparte | COMPROBADA; aclarar que la secuencia no es tabla |
| C | 18 tablas conservadas | 18 | COMPROBADA como lista declarada; hashes/conteos runtime no rerun |

**Lista A exacta (33):** `tickets`, `ticket_lineas`, `ticket_pagos`,
`autorizaciones_nota`, `movimientos_credito`, `aplicaciones_credito`,
`notificaciones_credito`, `sesiones_caja`, `sesiones_caja_dias`,
`salidas_dinero_caja`, `cuadre_fiscal_registros`, `salidas`, `salida_lineas`,
`salida_rollos`, `viajes`, `viaje_salidas`, `viaje_tickets`, `entradas`,
`contenedores`, `contenedor_lineas`, `pagos_proveedor`,
`aplicaciones_pago_proveedor`, `movimientos`, `rollos`,
`reimpresiones_etiqueta`, `auditorias_inventario`,
`auditoria_inventario_escaneos`, `auditoria_inventario_participantes`,
`auditoria_inventario_snapshot`, `solicitudes_pago_dirigido`,
`notificaciones_sistema`, `stock_minimo_episodios`, `sesiones`.

**Lista B exacta (7):** `ticket_folio`, `entrada_folio`, `salida_folio`,
`viaje_folio`, `auditoria_inventario_folio`, `series_consecutivo`,
`existencias`; además, separada de las tablas, `public.contenedores_folio_seq`.

**Lista C exacta (18):** `productos`, `precio_historial`, `clientes`,
`cliente_documentos`, `proveedores`, `usuarios`, `ubicaciones`, `pisos`,
`permisos_rol`, `permisos_usuario`, `permisos_ubicacion`, `camionetas`,
`choferes`, `equipos`, `equipos_checklist`, `stock_minimo_sitios`,
`stock_minimos`, `auditoria`.

La frase “las 33 quedaron en cero”, los hashes, `auditoria=3045`, mínimos,
triggers habilitados y efectos post-restart de las líneas 570-582 son resultados
de ejecución histórica: **NO COMPROBADOS en esta sesión**. La única corrección
de conteo necesaria aquí es no cambiar A a 32 ni contar la secuencia B como tabla.

## 5. Claims de archivos de código con path relativo incompleto

Además de los refs de línea de la sección 3, estos nombres no existen literalmente
desde la raíz, aunque sí existe el archivo con el prefijo de artifact.

| Ubicación | Cita | Path exacto actual | Resultado |
|---:|---|---|---|
| 279 | `lib/inventario.ts` | `artifacts/api-server/src/lib/inventario.ts` | CONTRADICCIÓN de path; completar prefijo |
| 279 | `lib/reportes-inventory.ts` | `artifacts/api-server/src/lib/reportes-inventory.ts` | CONTRADICCIÓN de path; completar prefijo |
| 280 | `lib/precios.ts` | `artifacts/api-server/src/lib/precios.ts` | CONTRADICCIÓN de path; completar prefijo |
| 281 | `lib/compras-proveedor.ts` | `artifacts/api-server/src/lib/compras-proveedor.ts` | CONTRADICCIÓN de path; completar prefijo |
| 283 | `lib/contenedores.ts` | `artifacts/api-server/src/lib/contenedores.ts` | CONTRADICCIÓN de path; completar prefijo |
| 283 | `lib/contenedores-helpers.ts` | `artifacts/api-server/src/lib/contenedores-helpers.ts` | CONTRADICCIÓN de path; completar prefijo |
| 354 | `lib/admin-alertas.ts` | `artifacts/api-server/src/lib/admin-alertas.ts` | CONTRADICCIÓN de path; completar prefijo |
| 630 | `lib/credit-allocation.ts` | `artifacts/api-server/src/lib/credit-allocation.ts` | CONTRADICCIÓN de path; completar prefijo |
| 280-283 | `routes/*.ts` | `artifacts/api-server/src/routes/*.ts` | Path relativo solo entendible por contexto; la regla de higiene debe usar el path completo |
| 568 | `scripts/.local/backups/...` | existe como directorio de respaldo, no archivo | COMPROBADA como directorio; no llamarlo archivo de respaldo |
| 945 | `/tmp/reportes-composition-x04-final.json` | no existe | CONTRADICCIÓN de evidencia disponible |

Los paths que sí se citaron con prefijo completo (`artifacts/...`,
`lib/api-spec/openapi.yaml`, migración SQL y hooks) existen exactamente, salvo que
la tabla de rutas/archivos ya haya indicado una ubicación obsoleta.

## 6. Claims de pruebas, datos y dispositivo: no rerun

Estas afirmaciones se identificaron durante el barrido, pero no se pueden marcar
correctas sin repetir su ejecución. El resultado de “archivo de evidencia existe”
en la sección 2 no cambia esta clasificación.

| Ubicación | Afirmación histórica | Resultado actual de esta auditoría | Qué debe corregirse o conservarse |
|---:|---|---|---|
| 145 | Neon desechable, schema push, seed, integración Equipos, 3 sitios, seis permisos por rol, typecheck y captura sin sesión aprobados | NO COMPROBADA / no rerun | Mantener fecha y evidencia como histórico; no presentarlo como verificación actual |
| 162 | exactamente 11 triggers y todos `O` | NO COMPROBADA / no consulta DB | Conservar como resultado fechado o volver a consultar antes de llamarlo actual |
| 318-322 | arnés de seis vistas: 1 aprobada, 0 fallidas, 36 HTTP, 10 productos | NO COMPROBADA / no rerun | Etiquetar histórico; el reporte citado existe |
| 337-340 | conteo previo de estados y cleanup de development | NO COMPROBADA / no DB | No mezclar con conteos actuales del enum |
| 362-364 | suites 1/1, 5/5, 40/40, typecheck PASS y dispositivo pendiente | NO COMPROBADA / no suites | Mantener explícita la aceptación física pendiente |
| 377 | regresión de concurrencia con barrera y archivos en reports | NO COMPROBADA / no prueba | No afirmar que se reprodujo en esta sesión |
| 389 | folios 00501/00502 y existencia 2500.000 | NO COMPROBADA / histórico | Mantener fecha, no usar como estado DB actual |
| 474 | 75 aserciones, ciclos 11/11 y suites bloqueadas | NO COMPROBADA / no rerun | Conservar “WITH OBSERVATIONS” si se reutiliza |
| 568-582 | purga LIVE, A33/C18, hashes, postcommit/postrestart y API running | NO COMPROBADA / no DB ni servicios | No aplicar corrección; marcar como histórico y no inferir estado vivo |
| 580 | cinco suites, 75 PASS, cleanup P0001/23503 absorbido | NO COMPROBADA / no suites | No convertir `exitCode=0` histórico en verde actual |
| 825 | 26 pruebas, cuatro errores preexistentes, UI 402 no aprobada | NO COMPROBADA / no typecheck | La afirmación de “cuatro, no dos” coincide con la documentación, pero no fue rerun |
| 834-839 | diagnósticos D1/D2, D3, reversos 47/48 y recapturas 49/50 | NO COMPROBADA / no DB | Es operación financiera histórica; no volver a ejecutar ni presentarla como lectura actual |
| 885-924 | 62/16, 56 tablas/18 gráficos, exportaciones 10 casos y límites UI | NO COMPROBADA / no suites, browser ni descargas | Distinguir conteo por suite de número de pruebas y conservar las limitaciones |
| 974 | lecturas Repeatable Read, 125 hojas numéricas, movimientos 43-50 | NO COMPROBADA / no transacción | Mantener como histórico con path exacto de evidencia |

## 7. Correcciones puntuales que debe aplicar el agente principal

No se aplicaron aquí por la restricción de solo crear estos dos reportes.

1. Sustituir referencias de código relativas (`lib/...`, `routes/...`) por paths
   completos bajo `artifacts/api-server/src/`, o citar archivo + función sin línea.
2. Eliminar/corregir las ubicaciones obsoletas de `pos.ts:2082-2088`,
   `admin-analytics.ts:324-335`, `admin-analytics.ts:376-378` y
   `notificaciones.ts:194`; usar nombres de función y ubicaciones actuales.
3. Documentar que el predicado de documento contabilizado aparece seis veces en
   lógica SQL manual: cinco copias dentro de `getSalesSummary` (líneas 381-397)
   y una en `getSessionMargin` (440-442). El documento decía dos referencias
   desfasadas; no unificar ni modificar el código en esta entrega.
4. Escribir `/inventario/rollos` cuando se refiera al endpoint completo; reservar
   `/rollos` para el segmento interno del router. Mantener `/pos` y
   `/inventario/rollos/:id` etiquetados como frontend.
5. Retirar o reemplazar `/tmp/reportes-composition-x04-final.json`, porque no
   existe en esta sesión; no citar “su JSON” sin path exacto.
6. Mantener **32 módulos**, no 33; conservar el mismo catálogo en el texto y en
   el seed.
7. Distinguir los 7 valores de `rolUsuarioEnum` de los 6 roles de la matriz de
   permisos no-ADMIN.
8. Mantener 7 tipos de equipo, incluidos exactamente las dos impresoras
   `IMPRESORA_ENTRADAS` e `IMPRESORA_SALIDAS_NOTAS`, y conservar la exclusión de
   ubicaciones `TRANSITO`/`EXTERNO` mediante el filtro TIENDA/BODEGA.
9. Mantener cinco estados vigentes de Salida y rotular los nueve estados de las
   líneas 337/360 como estados históricos de migración.
10. Mantener listas A=33, B=7 tablas más una secuencia, C=18; no contar la
    secuencia como tabla.
11. Aclarar la forma de pago de Ticket: el enum compartido aún contiene CREDITO y
    FACTURADO, pero la regla operativa reserva CREDITO para Nota y no lo ofrece
    como cobro de Ticket; no afirmar que el enum carece de esos valores.
12. No llamar constante a `METREADO_CASH_ONLY`; hoy es un código literal de
    error. Para 10% usar el nombre real
    `CANCELLATION_RATE_ALERT_THRESHOLD_PERCENT`.
13. Conservar resultados históricos de pruebas, purga, importes, navegador y
    dispositivo como no rerun; no transformarlos en una aprobación actual.
14. Citar el archivo exacto de JSON de Prompt C si se necesita comprobarlo, y
    comprobar su existencia de forma independiente del `.md`.
15. Para la afirmación de impresoras, separar el catálogo/checklist estáticamente
    comprobado de la instalación física/prueba real, que permanece no comprobada.

## Cierre

El barrido cubrió las 975 líneas y no solo seis ejemplos. Las rutas OpenAPI
literales válidas, los 17 archivos únicos de `docs/`/`reports/`, los nombres de
función, los valores nombrados y los conteos solicitados quedaron listados con
ubicación y resultado. Los únicos problemas documentales puntuales encontrados
en la comprobación estática son los refs de línea obsoletos, los prefijos de
archivo incompletos, la ruta `/rollos` sin distinguir segmento montado, el JSON
`/tmp` ausente, la semántica compartida de CREDITO en el enum de Ticket y el
conteo histórico de duplicaciones (seis copias actuales, no dos referencias
antiguas).