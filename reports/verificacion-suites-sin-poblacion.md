# Verificación segura de suites sin población

**Fecha de ejecución:** 2026-09-12 23:45:54 CST (`America/Mexico_City`), equivalente a 2026-09-13 05:45:54 UTC.  
**Alcance del resultado reportado:** pruebas puras/contract del frontend, paquetes compartidos y contratos de esquema con dobles locales. En la ejecución seleccionada no se ejecutaron workflows, servidor, HTTP, mutaciones API, creación de usuarios, fixtures persistidos ni conexión a PostgreSQL. El intento preliminar con descubrimiento por defecto está separado y aclarado abajo.

## Resultado agregado

| Grupo | Archivos ejecutados | Tests | Pasaron | Fallaron | Skipped por el runner |
|---|---:|---:|---:|---:|---:|
| `@workspace/mariana-textil` (`src/**`) | 71 | 253 | 248 | 5 | 0 |
| `lib/db` estático/mock (`src/**`) | 17 | 23 | 21 | 2 | 0 |
| `@workspace/metered-pricing` | 1 | 2 | 2 | 0 | 0 |
| `@workspace/number-format` | 1 | 8 | 8 | 0 | 0 |
| `@workspace/scanned-code` | 1 | 14 | 14 | 0 | 0 |
| **Total ejecutado** | **91** | **300** | **293** | **7** | **0** |

No se reporta un resultado verde: hubo **7 fallos reales**. No se silenció ningún fallo convirtiéndolo en skip.

## Controles de seguridad

- La inspección estática de los 71 tests del frontend encontró **0** archivos con importación/evidencia directa de `@workspace/db`, `drizzle`, `pg`, variables de base, `pool` o `.query(...)`, y **0** con `fetch`, cliente HTTP, `child_process`, escritura de archivos o mutación de red.
- La inspección estática de los 3 tests de paquetes compartidos encontró **0** evidencias de base de datos.
- Los 17 tests de `lib/db` seleccionados usan únicamente pools/clientes falsos locales, generación/inspección de SQL o lectura estática; no se invoca un pool real. Los imports `Pool` en TypeScript son de tipo.
- Cada proceso se lanzó con entorno controlado `env -i PATH="$PATH" HOME="$HOME" NODE_ENV=test`; no se proporcionó ninguna variable de conexión de base de datos y no se leyó ni imprimió ningún valor de entorno sensible.
- Los tests de UI que importan React, `@workspace/api-zod`, `@workspace/scanned-code`, `@workspace/number-format` o helpers locales fueron inspeccionados como imports puros; no ejecutan la capa API.

## Comandos ejecutados

Para el resultado reportado, el manifest se construyó con `find ... | sort` y se pasó explícitamente a `tsx --test`; no se usó una suite API genérica ni `test:isolated`.

```sh
(cd artifacts/mariana-textil &&
  files=$(find src -type f \( -name '*.test.ts' -o -name '*.test.tsx' -o -name '*.test.mjs' -o -name '*.test.js' \) | sort) &&
  env -i PATH="$PATH" HOME="$HOME" NODE_ENV=test pnpm exec tsx --test $files)

(cd artifacts/api-server &&
  files=$(find ../../lib/db/src -type f \( -name '*.test.ts' -o -name '*.test.mjs' -o -name '*.test.js' \) | sort |
    grep -Ev 'run-isolated-tests.test|prepare-test-database.test|test-database-guard.test') &&
  env -i PATH="$PATH" HOME="$HOME" NODE_ENV=test pnpm exec tsx --test $files)

env -i PATH="$PATH" HOME="$HOME" NODE_ENV=test \
  pnpm --filter @workspace/metered-pricing exec tsx --test src/index.test.ts
env -i PATH="$PATH" HOME="$HOME" NODE_ENV=test \
  pnpm --filter @workspace/number-format exec tsx --test src/index.test.ts
env -i PATH="$PATH" HOME="$HOME" NODE_ENV=test \
  pnpm --filter @workspace/scanned-code exec tsx --test src/index.test.ts
```

### Aclaración del intento preliminar (no contado)

El primer intento se ejecutó desde `/home/runner/workspace` (root), antes de corregir el `cd`. La selección intentada fue:

```sh
files=$(find src -type f \( -name '*.test.ts' -o -name '*.test.tsx' -o -name '*.test.mjs' -o -name '*.test.js' \) | sort)
```

Como `find` falló, la invocación que **sí llegó al runner** fue exactamente:

```sh
env -i PATH="$PATH" HOME="$HOME" NODE_ENV=test \
  pnpm --filter @workspace/mariana-textil exec tsx --test
```

La evidencia capturada fue `find: ‘src’: No such file or directory`, seguida de `exit_code=1`; `find` no abortó el shell wrapper, por lo que `$files` quedó vacío y **sí se ejecutó** la invocación efectiva anterior sin rutas. El runner hizo descubrimiento por defecto. El `tail` disponible conserva un `AssertionError [ERR_ASSERTION]` en `artifacts/mariana-textil/src/pages/salidas-venta-errors.contract.test.ts:53:10` (`expected: /salida\.estado !== "ENTREGADA"/`, `operator: 'match'`) y termina con `test at test-screenshots.js:1:1`, `✖ test-screenshots.js (157.75691ms)`, `'test failed'` y `ERR_PNPM_RECURSIVE_EXEC_FIRST_FAIL Command failed with exit code 1: tsx --test`. Por tanto, no es correcto decir que no corrió ningún test: corrieron al menos ese contrato TypeScript y `test-screenshots.js` (dos archivos descubiertos); no se conserva un conteo completo de ese intento.

`test-screenshots.js` es un script Playwright, no un test del servidor API ni de `lib/db`; contiene respuestas mock para rutas `/api/*` y una navegación a `http://localhost:80/salidas`. El log disponible prueba que el archivo fue descubierto y falló, pero no conserva evidencia suficiente para afirmar si `page.goto` alcanzó a completarse. En consecuencia, este intento preliminar no debe describirse como una ejecución “sin HTTP”: queda fuera del alcance seguro y fuera del agregado, y no cambia el resultado seleccionado de 91 archivos/300 tests. Sí recibió la protección `env -i PATH="$PATH" HOME="$HOME" NODE_ENV=test` **antes de `pnpm`/`tsx`**, por lo que no heredó variables de conexión de base de datos; esa protección no bloquea HTTP por sí sola. La ejecución seleccionada posterior sí usó rutas explícitas y no incluyó `test-screenshots.js`, suites de `artifacts/api-server` ni tests de mutación.

## Fallos completos de la ejecución seleccionada

### Frontend: 5 fallos / 253 tests

1. `artifacts/mariana-textil/src/components/reportes/report-explanations.contract.test.ts:36:10`
   - Test: `statistics outside Reportes render their sentence below each audited surface`.
   - Fallo: `AssertionError [ERR_ASSERTION]`.
   - Esperado: `/dashboard-inventory-explanation/`.
   - Actual: el contenido leído de `artifacts/mariana-textil/src/pages/dashboard.tsx` no contiene `dashboard-inventory-explanation`.

2. `artifacts/mariana-textil/src/pages/detail-link-tables.contract.test.ts:103:12`
   - Test: `detail-capable table identifiers have one primary link and declared routes`.
   - Fallo: `AssertionError [ERR_ASSERTION]`.
   - Esperado: la clase primaria exacta `text-primary underline underline-offset-4 hover:text-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2` en cada tabla auditada.
   - Actual: al menos una de las fuentes leídas no coincide con esa expresión regular exacta.

3. `artifacts/mariana-textil/src/pages/productos.contract.test.ts:14:10`
   - Test: `catálogo agrupado conserva unidad, especificaciones y totales separados`.
   - Fallo: `AssertionError [ERR_ASSERTION]`.
   - Esperado: `/value=\{UnidadProducto\.BOLSA\}/`.
   - Actual: `artifacts/mariana-textil/src/pages/productos.tsx` no contiene `value={UnidadProducto.BOLSA}`.

4. `artifacts/mariana-textil/src/pages/salidas-status.contract.test.ts:78:10`
   - Test: `desktop and mobile salida rows render the same shared component from salida.estado`.
   - Fallo: `AssertionError [ERR_ASSERTION]`.
   - Esperado: 2 coincidencias de `<SalidaEstadoBadge estado={salida.estado} modalidad={salida.modalidad} documentoVenta={salida.documentoVenta} autorizada={salida.autorizada} />` en `salidas.tsx`.
   - Actual: `0 !== 2`. La aserción falla antes de las comprobaciones posteriores del detalle.

5. `artifacts/mariana-textil/src/pages/salidas-venta-errors.contract.test.ts:53:10`
   - Test: `ENTREGADA is present in salida maps, generated state filter, and closed-detail behavior`.
   - Fallo: `AssertionError [ERR_ASSERTION]`.
   - Esperado: `/salida\.estado !== "ENTREGADA"/`.
   - Actual: `artifacts/mariana-textil/src/pages/salida-detail.tsx` no contiene esa comparación con comillas dobles exactas (sí contiene otras condiciones de `ENTREGADA`).

### `lib/db` estático/mock: 2 fallos / 23 tests

1. `lib/db/src/lib/caja-permissions-schema.test.ts:21:10`
   - Test: `startup repairs only inherited CAJA role rows`.
   - Fallo: `AssertionError [ERR_ASSERTION]`.
   - Esperado: `calls[0].values[0].length === 31`.
   - Actual: `32 !== 31`. El doble local recibió 32 módulos.

2. `lib/db/src/lib/salidas-schema.contract.test.ts:16:3`
   - Test: `salidas startup schema includes venta, delivery and ticket linkage`.
   - Fallo: `Error: Inicializador de Salidas incompleto; faltan: columna movimientos.salida_id, FK movimientos.salida_id → salidas.id, índice sobre movimientos(salida_id).`
   - Stack relevante: `lib/db/src/lib/salidas-schema.ts:382:13`, llamado desde `lib/db/src/lib/salidas-schema.contract.test.ts:16:3`.

No se modificó ningún test ni se intentó corregir estos 7 fallos.

## Manifest exacto ejecutado

### Frontend: 71 archivos (`artifacts/mariana-textil/src`)

```text
artifacts/mariana-textil/src/client-utility-card.contract.test.ts
artifacts/mariana-textil/src/components/app-navigation.contract.test.ts
artifacts/mariana-textil/src/components/campo-escaneo.contract.test.ts
artifacts/mariana-textil/src/components/confirmacion-texto-exacto.contract.test.ts
artifacts/mariana-textil/src/components/label-print.contract.test.ts
artifacts/mariana-textil/src/components/mobile-action-layouts.contract.test.ts
artifacts/mariana-textil/src/components/money-input.contract.test.ts
artifacts/mariana-textil/src/components/notification-audio-controller.contract.test.ts
artifacts/mariana-textil/src/components/reportes/que-comprar-report.contract.test.ts
artifacts/mariana-textil/src/components/reportes/report-explanations.contract.test.ts
artifacts/mariana-textil/src/components/shared/combined-filter-url.test.ts
artifacts/mariana-textil/src/components/ui/sonner.contract.test.ts
artifacts/mariana-textil/src/lib/ajuste-confirmacion.contract.test.ts
artifacts/mariana-textil/src/lib/catalog-colors.test.ts
artifacts/mariana-textil/src/lib/credit-terms.contract.test.ts
artifacts/mariana-textil/src/lib/date-only.contract.test.ts
artifacts/mariana-textil/src/lib/home-route.test.ts
artifacts/mariana-textil/src/lib/internal-navigation.contract.test.ts
artifacts/mariana-textil/src/lib/inventory-global-totals.test.ts
artifacts/mariana-textil/src/lib/label-selection.contract.test.ts
artifacts/mariana-textil/src/lib/pos-product-price.contract.test.ts
artifacts/mariana-textil/src/lib/precio-groups.contract.test.ts
artifacts/mariana-textil/src/lib/print.contract.test.ts
artifacts/mariana-textil/src/lib/roll-capture-state.test.ts
artifacts/mariana-textil/src/lib/salida-cancelacion.contract.test.ts
artifacts/mariana-textil/src/lib/ticket-lines.contract.test.ts
artifacts/mariana-textil/src/lib/unit-labels.contract.test.ts
artifacts/mariana-textil/src/lib/user-form-validation.contract.test.ts
artifacts/mariana-textil/src/notifications-read.contract.test.ts
artifacts/mariana-textil/src/pages/ajustes.contract.test.ts
artifacts/mariana-textil/src/pages/auditorias-inventario.contract.test.ts
artifacts/mariana-textil/src/pages/caja/attention-card-tone.test.ts
artifacts/mariana-textil/src/pages/caja/cuentas-destino.contract.test.ts
artifacts/mariana-textil/src/pages/caja/tiempo-real-breakdown.contract.test.ts
artifacts/mariana-textil/src/pages/caja/tiempo-real.contract.test.ts
artifacts/mariana-textil/src/pages/caja/tiempo-real-credit.contract.test.ts
artifacts/mariana-textil/src/pages/caja/tienda-ventas.contract.test.ts
artifacts/mariana-textil/src/pages/cartera.contract.test.ts
artifacts/mariana-textil/src/pages/cliente-ticket-links.contract.test.ts
artifacts/mariana-textil/src/pages/cobros-payment-methods.contract.test.ts
artifacts/mariana-textil/src/pages/cobros-salidas-block4.contract.test.ts
artifacts/mariana-textil/src/pages/detail-link-tables.contract.test.ts
artifacts/mariana-textil/src/pages/entrada-documento.contract.test.ts
artifacts/mariana-textil/src/pages/entradas-roll-capture.contract.test.ts
artifacts/mariana-textil/src/pages/etiquetas-print.contract.test.ts
artifacts/mariana-textil/src/pages/folios-formateados.contract.test.ts
artifacts/mariana-textil/src/pages/hoja-ventas-dia.contract.test.ts
artifacts/mariana-textil/src/pages/human-text-casing.contract.test.ts
artifacts/mariana-textil/src/pages/impresion.contract.test.ts
artifacts/mariana-textil/src/pages/inventario-bulk-selection.contract.test.ts
artifacts/mariana-textil/src/pages/movimientos-ticket-link.contract.test.ts
artifacts/mariana-textil/src/pages/nota.contract.test.ts
artifacts/mariana-textil/src/pages/pos.contract.test.ts
artifacts/mariana-textil/src/pages/precios/precios-grouping-bulk.contract.test.ts
artifacts/mariana-textil/src/pages/precios/precios-null.contract.test.ts
artifacts/mariana-textil/src/pages/print-document-header.contract.test.ts
artifacts/mariana-textil/src/pages/productos.contract.test.ts
artifacts/mariana-textil/src/pages/productos-especificaciones.contract.test.ts
artifacts/mariana-textil/src/pages/proveedor-finanzas.contract.test.ts
artifacts/mariana-textil/src/pages/reversos.contract.test.ts
artifacts/mariana-textil/src/pages/salida-documento.contract.test.ts
artifacts/mariana-textil/src/pages/salidas-cancel-history.contract.test.ts
artifacts/mariana-textil/src/pages/salidas-history-layout.contract.test.ts
artifacts/mariana-textil/src/pages/salidas-status.contract.test.ts
artifacts/mariana-textil/src/pages/salidas-venta-errors.contract.test.ts
artifacts/mariana-textil/src/pages/salidas-venta-final.contract.test.ts
artifacts/mariana-textil/src/pages/stock-minimos.contract.test.ts
artifacts/mariana-textil/src/pages/ticket-detail-route-gate.contract.test.ts
artifacts/mariana-textil/src/pages/viajes.contract.test.ts
artifacts/mariana-textil/src/proveedores-historial.contract.test.ts
artifacts/mariana-textil/src/utilidad-nomenclature.contract.test.ts
```

### `lib/db` mock/estático: 17 archivos

```text
lib/db/src/lib/caja-permissions-schema.test.ts
lib/db/src/lib/document-folios-schema.contract.test.ts
lib/db/src/lib/equipos-schema.test.ts
lib/db/src/lib/extraordinary-exits-schema.test.ts
lib/db/src/lib/pisos-schema.test.ts
lib/db/src/lib/product-color-schema.test.ts
lib/db/src/lib/product-meter-schema.test.ts
lib/db/src/lib/product-pricing-schema.test.ts
lib/db/src/lib/product-specifications-schema.test.ts
lib/db/src/lib/role-migration.test.ts
lib/db/src/lib/salidas-schema.contract.test.ts
lib/db/src/lib/salidas-venta-permissions-schema.test.ts
lib/db/src/lib/seed-permissions.test.mjs
lib/db/src/lib/sku.test.mjs
lib/db/src/schema/equipos.test.ts
lib/db/src/scripts/cleanup-bloque-7.contract.test.mjs
lib/db/src/scripts/normalize-base-colors.contract.test.mjs
```

### Shared packages: 3 archivos

```text
lib/metered-pricing/src/index.test.ts
lib/number-format/src/index.test.ts
lib/scanned-code/src/index.test.ts
```

## Skips y bloqueos explícitos

### Tests locales no ejecutados por riesgo de DB/subproceso

Se excluyeron exactamente estos 3 archivos de `lib/db`:

```text
lib/db/src/lib/test-database-guard.test.ts
lib/db/src/prepare-test-database.test.mjs
lib/db/src/run-isolated-tests.test.mjs
```

Motivo: importan `pg` en runtime y/o crean subprocesos/ciclos de preparación o runner; ejecutarlos no cumpliría la condición de no conectar, no poblar y no duplicar la ejecución aprobada del agente padre. No se contaron como tests pasados ni como tests fallidos.

`artifacts/mariana-textil/test-screenshots.js` tampoco pertenece a `artifacts/mariana-textil/src/**`; no se incluyó en el manifest de pruebas de fuente.

### API bloqueada por `lib/db/src/isolated-test-policy.mjs`

La política inventarió 53 aliases de API (`51` bloqueados y `2` aprobados) y 124 archivos de test de API (`122` bloqueados y `2` revisados/aprobados). No se ejecutó ningún alias o archivo API bloqueado, aunque su nombre pareciera contract/unit, para no eludir la política. Tampoco se duplicaron los dos aliases aprobados que corresponden al agente padre:

- `api-script:test:ticket-iva-schema` — `artifacts/api-server/src/lib/ticket-iva-schema.test.ts`
- `api-script:test:admin-realtime-reconciliation` — `artifacts/api-server/src/admin-realtime-reconciliation.integration.test.ts`

Aliases bloqueados exactos:

```text
api-script:test:admin-alertas-integration
api-script:test:admin-analytics
api-script:test:admin-analytics-integration
api-script:test:admin-bypass-empty
api-script:test:admin-invariants
api-script:test:auditoria
api-script:test:clientes-aging
api-script:test:clientes-ajustes
api-script:test:clientes-ajustes:unit
api-script:test:clientes-create
api-script:test:clientes-ledger
api-script:test:contenedores
api-script:test:contenedores-integration
api-script:test:cuadre-fiscal-integration
api-script:test:entradas
api-script:test:etiquetas
api-script:test:etiquetas-integration
api-script:test:inventario
api-script:test:inventario-conciliacion-contract
api-script:test:inventario-lock-barrier
api-script:test:inventory-lock-loops-contract
api-script:test:inventory-six-view-integration
api-script:test:kardex-api
api-script:test:pagos-dirigidos-integration
api-script:test:pending-costs-schema
api-script:test:pos
api-script:test:pos-location-authorization
api-script:test:postgres-errors
api-script:test:postgres-unique-concurrency
api-script:test:precios
api-script:test:precios-integration
api-script:test:productos-cache-integration
api-script:test:productos-purge
api-script:test:proveedores
api-script:test:proveedores-alcance-fechas
api-script:test:reportes
api-script:test:reportes-integration
api-script:test:role-access-matrix
api-script:test:salidas
api-script:test:salidas-api
api-script:test:salidas-schema
api-script:test:scanned-code-contract
api-script:test:security-api
api-script:test:store-sales-global-integration
api-script:test:supervisor-integration
api-script:test:task57-integration
api-script:test:task58-integration
api-script:test:ticket-credit-schema
api-script:test:ticket-line-types-schema
api-script:test:transferencias-block3
api-script:test:viajes-integration
```

Archivos API bloqueados exactos:

```text
artifacts/api-server/src/admin-alertas.integration.test.ts
artifacts/api-server/src/admin-analytics.integration.test.ts
artifacts/api-server/src/admin-bypass-empty-permissions.test.ts
artifacts/api-server/src/admin-invariants.integration.test.ts
artifacts/api-server/src/advisory-locks.contract.test.ts
artifacts/api-server/src/aplicaciones-credito.integration.test.ts
artifacts/api-server/src/aplicaciones-pago-proveedor.integration.test.ts
artifacts/api-server/src/auditoria-inventario.contract.test.ts
artifacts/api-server/src/auditoria.contract.test.ts
artifacts/api-server/src/auditoria.integration.test.ts
artifacts/api-server/src/bloque3-formas-pago.contract.test.ts
artifacts/api-server/src/bloque6-reversos.contract.test.ts
artifacts/api-server/src/bloque6-reversos.integration.test.ts
artifacts/api-server/src/caja-diaria-block4.contract.test.ts
artifacts/api-server/src/clientes-ajustes-api.test.ts
artifacts/api-server/src/clientes-bolsa.contract.test.ts
artifacts/api-server/src/clientes-estado-cuenta.contract.test.ts
artifacts/api-server/src/clientes-notas-credito.contract.test.ts
artifacts/api-server/src/clientes-pagos.contract.test.ts
artifacts/api-server/src/contenedores.integration.test.ts
artifacts/api-server/src/cuadre-fiscal.integration.test.ts
artifacts/api-server/src/dashboard-pieza.contract.test.ts
artifacts/api-server/src/entrada-documento-api.contract.test.ts
artifacts/api-server/src/entry-errors.contract.test.ts
artifacts/api-server/src/equipos.contract.test.ts
artifacts/api-server/src/equipos.integration.test.ts
artifacts/api-server/src/etiquetas-api.integration.test.ts
artifacts/api-server/src/etiquetas-api.test.ts
artifacts/api-server/src/etiquetas-reimpresiones.batch.test.ts
artifacts/api-server/src/historial-compras-proveedores.contract.test.ts
artifacts/api-server/src/hoja-ventas-dia.test.ts
artifacts/api-server/src/human-text-casing.contract.test.ts
artifacts/api-server/src/inventario-conciliacion.contract.test.ts
artifacts/api-server/src/inventory-lock-loops.contract.test.ts
artifacts/api-server/src/inventory-six-view.integration.test.ts
artifacts/api-server/src/kardex-api.test.ts
artifacts/api-server/src/kardex-block2.contract.test.ts
artifacts/api-server/src/kardex-sale-documents.contract.test.ts
artifacts/api-server/src/lib/admin-alertas-credit-risk.test.ts
artifacts/api-server/src/lib/auth-identifiers.test.ts
artifacts/api-server/src/lib/clientes-aging.test.ts
artifacts/api-server/src/lib/clientes-create.test.ts
artifacts/api-server/src/lib/clientes-ledger.test.ts
artifacts/api-server/src/lib/compras-proveedor.test.ts
artifacts/api-server/src/lib/contenedores.test.ts
artifacts/api-server/src/lib/credit-allocation.test.ts
artifacts/api-server/src/lib/entradas.test.ts
artifacts/api-server/src/lib/generacion-venta-idempotency.test.ts
artifacts/api-server/src/lib/inventario-lock-barrier.test.ts
artifacts/api-server/src/lib/inventario.test.ts
artifacts/api-server/src/lib/inventory-status-semantics.test.ts
artifacts/api-server/src/lib/iva.test.ts
artifacts/api-server/src/lib/linked-cancellation.test.ts
artifacts/api-server/src/lib/login-lockout.test.ts
artifacts/api-server/src/lib/metered-reference-cost.test.ts
artifacts/api-server/src/lib/notificaciones-credito.test.ts
artifacts/api-server/src/lib/payment-behavior.test.ts
artifacts/api-server/src/lib/pending-costs-schema.test.ts
artifacts/api-server/src/lib/permisos-matrix.no-db.test.ts
artifacts/api-server/src/lib/permisos-salidas-venta.test.ts
artifacts/api-server/src/lib/permisos.test.ts
artifacts/api-server/src/lib/pos.test.ts
artifacts/api-server/src/lib/postgres-errors.test.ts
artifacts/api-server/src/lib/precios.test.ts
artifacts/api-server/src/lib/product-color.test.ts
artifacts/api-server/src/lib/quantity-comparison.test.ts
artifacts/api-server/src/lib/realtime-cancellations.test.ts
artifacts/api-server/src/lib/report-export.test.ts
artifacts/api-server/src/lib/reportes-commercial.test.ts
artifacts/api-server/src/lib/reportes-inventory.test.ts
artifacts/api-server/src/lib/reportes-que-comprar.test.ts
artifacts/api-server/src/lib/reportes-sales.test.ts
artifacts/api-server/src/lib/reportes.test.ts
artifacts/api-server/src/lib/salida-venta-contract.test.ts
artifacts/api-server/src/lib/salida-venta-zod.contract.test.ts
artifacts/api-server/src/lib/salidas-reservation-entrypoints.contract.test.ts
artifacts/api-server/src/lib/salidas-schema.test.ts
artifacts/api-server/src/lib/salidas.test.ts
artifacts/api-server/src/lib/sensitive-data.test.ts
artifacts/api-server/src/lib/server-lifecycle.test.ts
artifacts/api-server/src/lib/spanish-order.test.ts
artifacts/api-server/src/lib/stock-minimos-engine.test.ts
artifacts/api-server/src/lib/store-order.test.ts
artifacts/api-server/src/lib/ticket-credit-contract.test.ts
artifacts/api-server/src/lib/ticket-credit-schema.test.ts
artifacts/api-server/src/lib/ticket-line-types-schema.test.ts
artifacts/api-server/src/lib/ticket-payment-methods.contract.test.ts
artifacts/api-server/src/lib/venta-trace-access.test.ts
artifacts/api-server/src/metered-reference-cost.integration.test.ts
artifacts/api-server/src/notification-feed.contract.test.ts
artifacts/api-server/src/pagos-dirigidos-block1.contract.test.ts
artifacts/api-server/src/pagos-dirigidos.contract.test.ts
artifacts/api-server/src/pagos-dirigidos.integration.test.ts
artifacts/api-server/src/pending-entry-costs.contract.test.ts
artifacts/api-server/src/pos-caja-final.contract.test.ts
artifacts/api-server/src/pos-location-authorization.integration.test.ts
artifacts/api-server/src/postgres-unique-concurrency.integration.test.ts
artifacts/api-server/src/precios-null.contract.test.ts
artifacts/api-server/src/precios.integration.test.ts
artifacts/api-server/src/productos-cache.contract.test.ts
artifacts/api-server/src/productos-cache.integration.test.ts
artifacts/api-server/src/productos-import.integration.test.ts
artifacts/api-server/src/productos-purge.integration.test.ts
artifacts/api-server/src/productos-task62.contract.test.ts
artifacts/api-server/src/proveedores-alcance-fechas.integration.test.ts
artifacts/api-server/src/proveedores-pagos-block5.contract.test.ts
artifacts/api-server/src/purga-catalogos.contract.test.ts
artifacts/api-server/src/realtime-breakdown.contract.test.ts
artifacts/api-server/src/reportes.integration.test.ts
artifacts/api-server/src/role-access-matrix.integration.test.ts
artifacts/api-server/src/salidas-api.test.ts
artifacts/api-server/src/salidas-extraordinarias.contract.test.ts
artifacts/api-server/src/scanned-code.contract.test.ts
artifacts/api-server/src/security-api.test.ts
artifacts/api-server/src/session-duration.contract.test.ts
artifacts/api-server/src/store-sales-global.integration.test.ts
artifacts/api-server/src/task57.integration.test.ts
artifacts/api-server/src/task58.integration.test.ts
artifacts/api-server/src/transferencias-block3-architecture.test.ts
artifacts/api-server/src/user-validation-errors.test.ts
artifacts/api-server/src/users-create.contract.test.ts
artifacts/api-server/src/viajes.integration.test.ts
```
