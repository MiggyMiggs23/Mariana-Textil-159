# Verificación segura: crédito, saldo a favor y contador de rollos

Fecha de la ejecución: 2026-09-15 (UTC)

## Alcance y restricciones

Se ejecutaron solamente comandos de codegen, typecheck y una manifest explícita
no vacía de pruebas puras/contract. No se ejecutó el UI tester, no se reinició
ningún workflow, no se crearon usuarios/fixtures, no se hicieron mutaciones de
negocio y no se usó `executeSql` ni una base de desarrollo/red. Las pruebas
seleccionadas usaron `NODE_ENV=test`, un `DATABASE_URL` local deliberadamente
inalcanzable en `127.0.0.1:1`, y `TEST_DATABASE_URL` sin definir.

## 1. Codegen y typecheck

### Codegen

Comando exacto:

```text
pnpm --filter @workspace/api-spec run codegen
```

Resultado de la primera ejecución:

- código de salida del codegen: `0`;
- manifest de SHA-256: `733` archivos antes y `733` después;
- comparación before/after: código `1` (drift detectado);
- los archivos que cambiaron fueron:
  - `lib/api-client-react/src/generated/api.schemas.ts`
  - `lib/api-zod/src/generated/api.ts`
  - `lib/api-zod/src/generated/types/exportReporteVistaPdfParams.ts`
  - `lib/api-zod/src/generated/types/exportReporteVistaXlsxParams.ts`
  - `lib/api-zod/src/generated/types/notificacionCredito.ts`
  - `lib/api-zod/src/generated/types/reportesCatalogos.ts`

El drift provino de outputs generados que estaban atrasados respecto del
OpenAPI actual, incluyendo `saldoPendiente` y descripciones de parámetros y
catálogos. No se reparó manualmente ningún archivo. Los seis cambios anteriores
son outputs normales producidos por Orval; se conservaron.

Se ejecutó una segunda vez el mismo codegen con el mismo manifest de hashes
para comprobar estabilidad:

- código de salida del codegen: `0`;
- archivos: `733` antes / `733` después;
- comparación before/after: código `0` (sin drift adicional).

**Clasificación codegen:** la primera comparación requerida falla por drift;
la salida ya generada es idempotente en la segunda ejecución. No se puede
declarar “sin diferencias” para la primera ejecución.

### Typecheck completo

Comando exacto:

```text
pnpm run typecheck
```

Código de salida de la shell: `1`. Salida de errores:

```text
artifacts/api-server typecheck: src/lib/pos.ts(426,41): error TS2339: Property 'toISOString' does not exist on type 'never'.
artifacts/api-server typecheck: src/routes/clientes.ts(1329,10): error TS1117: An object literal cannot have multiple properties with the same name.
```

No se corrigieron estos errores.

**Clasificación typecheck:** FAIL.

## 2. Manifest explícita pura/contract

### Backend

Comando exacto (15 rutas explícitas; no hubo glob discovery):

```text
set +e
export NODE_ENV=test
export DATABASE_URL='postgresql://unit_test_disabled:unit_test_disabled@127.0.0.1:1/unit_test_database_access_is_disabled'
unset TEST_DATABASE_URL
pnpm --filter @workspace/api-server exec tsx --test \
  src/lib/clientes-aging.test.ts \
  src/lib/credit-allocation.test.ts \
  src/lib/admin-alertas-credit-risk.test.ts \
  src/lib/clientes-create.test.ts \
  src/lib/admin-analytics.contract.ts \
  src/lib/admin-analytics-active-stores.contract.ts \
  src/lib/inventory-status-semantics.test.ts \
  src/caja-diaria-block4.contract.test.ts \
  src/clientes-estado-cuenta.contract.test.ts \
  src/clientes-notas-credito.contract.test.ts \
  src/clientes-pagos.contract.test.ts \
  src/clientes-bolsa.contract.test.ts \
  src/lib/ticket-credit-contract.test.ts \
  src/lib/ticket-payment-methods.contract.test.ts \
  src/pos-caja-final.contract.test.ts
rc=$?
printf 'BACKEND_SAFE_MANIFEST_RC=%s\n' "$rc"
exit 0
```

Código de salida: `1`.

| Conteo | Resultado |
|---|---:|
| tests | 110 |
| pass | 108 |
| fail | 2 |
| cancelled | 0 |
| skipped | 0 |
| todo | 0 |

Fallos exactos:

1. `src/clientes-notas-credito.contract.test.ts` — `contrato de notas de
   crédito deriva los tres estados sin persistirlos`: el regex esperaba una
   función `moneyState` que no apareció en el source actual.
2. `src/lib/ticket-credit-contract.test.ts` — `ticket detail contract exposes
   printable persisted credit data`: `ListNotificacionesResponse`/detalle
   recibió `estadoNota: undefined`, requerido por el esquema Zod.

### UI

Comando exacto (19 rutas explícitas; no hubo glob discovery):

```text
set +e
export NODE_ENV=test
export DATABASE_URL='postgresql://unit_test_disabled:unit_test_disabled@127.0.0.1:1/unit_test_database_access_is_disabled'
unset TEST_DATABASE_URL
pnpm --filter @workspace/mariana-textil exec tsx --test \
  src/components/cliente-nota-estado-badge.contract.test.ts \
  src/components/cliente-saldo-a-favor.contract.test.ts \
  src/components/salida-venta-cliente-nueva.contract.test.ts \
  src/lib/credit-terms.contract.test.ts \
  src/lib/pos-product-price.contract.test.ts \
  src/lib/roll-capture-state.test.ts \
  src/pages/caja/attention-card-tone.test.ts \
  src/pages/caja/cuentas-destino.contract.test.ts \
  src/pages/caja/tiempo-real-credit.contract.test.ts \
  src/pages/caja/tiempo-real.contract.test.ts \
  src/pages/caja/tiempo-real-breakdown.contract.test.ts \
  src/pages/caja/tienda-ventas.contract.test.ts \
  src/pages/cartera.contract.test.ts \
  src/pages/cobros-payment-methods.contract.test.ts \
  src/pages/cobros-salidas-block4.contract.test.ts \
  src/pages/nota.contract.test.ts \
  src/pages/pos.contract.test.ts \
  src/pages/salidas-status.contract.test.ts \
  src/notifications-read.contract.test.ts
rc=$?
printf 'UI_SAFE_MANIFEST_RC=%s\n' "$rc"
exit 0
```

Código de salida: `1`.

| Conteo | Resultado |
|---|---:|
| tests | 71 |
| suites | 2 |
| pass | 68 |
| fail | 3 |
| cancelled | 0 |
| skipped | 0 |
| todo | 0 |

Fallos exactos:

1. `src/components/salida-venta-cliente-nueva.contract.test.ts` — `customer-
   sale assembly keeps a visible circular roll counter in sync with scans`:
   el contrato no encontró el orden de clases que esperaba para
   `data-testid="contador-rollos-capturados"`.
2. `src/pages/nota.contract.test.ts` — `Block 4 functionality in ticket detail`:
   el contrato esperaba el literal `estadoNota === "PENDIENTE"`, ausente del
   source actual.
3. `src/pages/salidas-status.contract.test.ts` — `desktop and mobile salida
   rows render the same shared component from salida.estado`: aserción
   `0 !== 2`.

No se corrigieron fallos de pruebas.

## Integraciones no ejecutadas: BLOCKED

Estas suites no se contaron como pass ni como skipped. Requieren una base
PostgreSQL aislada explícita y, según el caso, crean usuarios, fixtures o
mutan datos. Ejecutarlas aquí habría violado las restricciones de no crear
usuarios/fixtures, no hacer mutaciones y no usar fallback de red:

| Suite | Motivo de bloqueo |
|---|---|
| `artifacts/api-server/src/admin-analytics.integration.test.ts` | Inserta tiendas, usuarios, clientes, productos, tickets, movimientos de crédito y caja. |
| `artifacts/api-server/src/aplicaciones-credito.integration.test.ts` | Escribe movimientos y aplicaciones de crédito; requiere `TEST_DATABASE_URL` aislada. |
| `artifacts/api-server/src/admin-realtime-reconciliation.integration.test.ts` | Aunque usa CTEs read-only y no persiste fixtures, requiere una `TEST_DATABASE_URL` aislada explícita. |
| `artifacts/api-server/src/store-sales-global.integration.test.ts` | Crea tiendas, usuarios, clientes, productos, rollos y tickets y ejecuta integración HTTP. |
| `artifacts/api-server/src/pos-location-authorization.integration.test.ts` | Crea usuarios/permisos/sesiones, productos, clientes y tickets y ejecuta intentos de mutación POS. |
| `artifacts/api-server/src/lib/clientes-ledger.test.ts` | Inserta clientes, tickets y movimientos aun dentro de una transacción. |
| `artifacts/api-server/src/lib/notificaciones-credito.test.ts` | Inserta ubicación, usuarios, sesiones, cliente, ticket y notificación y marca lectura. |
| `artifacts/api-server/src/lib/ticket-credit-schema.test.ts` | Muta esquema e inserta un ticket. |
| `artifacts/api-server/src/lib/pos.test.ts` | Suite POS respaldada por base de datos y mutaciones. |
| `artifacts/api-server/src/clientes-ajustes-api.test.ts` | Crea fixtures, usuarios/sesiones y ejecuta endpoints de mutación. |
| `artifacts/api-server/src/postgres-unique-concurrency.integration.test.ts` | Crea usuario/sesión y ejecuta carreras de inserción; exige `TEST_DATABASE_URL` aislada. |

## Clasificación de los diez puntos solicitados

| Punto | Clasificación | Evidencia segura |
|---:|---|---|
| 1. Typecheck completo y codegen sin diferencias | **FAIL** | Typecheck falla con los dos errores TS indicados; la primera comparación de codegen tuvo drift, aunque la segunda fue estable. |
| 2. Suites de crédito, caja, analytics y POS | **FAIL / parcial** | Las manifests explícitas ejecutaron 181 tests: 176 pass y 5 fail. Las integraciones DB quedaron BLOCKED. |
| 3. Contador al escanear varios rollos | **FAIL / no aprobado** | El contract del contador falló; no se ejecutó UI tester ni flujo interactivo. |
| 4. Nota y abono el mismo día en Cobrado/desglose/estado/saldo | **BLOCKED** | Requiere datos persistidos y mutaciones/usuarios; las integraciones están bloqueadas. |
| 5. Cuatro estados, incluido retraso parcial en rojo | **PARCIAL / no aprobado** | La derivación y el badge canónicos pasaron; contratos de nota/detalle fallaron y no hubo verificación visual o persistida. |
| 6. Saldo pendiente junto al estado de notas no pagadas | **PARCIAL / no aprobado** | El contract del badge pasó; el contract de detalle de nota falló y no se comprobó en navegador. |
| 7. Exceso convertido en saldo a favor visible | **PARCIAL** | Contracts de pago/favor y la proyección pura pasaron; no se ejecutó el flujo persistido. |
| 8. Aplicar saldo a favor sin cambiar Cobrado | **PARCIAL** | `clientes-aging.test.ts` pasó la prueba de conservación de Cobrado y FIFO; el caso real de analytics/DB está bloqueado. |
| 9. Saldo a favor no editable directamente | **NO VERIFICADO** | No se ejecutó flujo de UI/DB; los contracts estáticos no sustituyen una comprobación operativa. |
| 10. Pantallas nuevas en teléfono | **BLOCKED / no ejecutado** | El UI tester estaba expresamente prohibido; no se declara aprobación visual. |

Los cambios no generados de la aplicación no fueron editados durante esta
verificación. No se modificó `replit.md` ni se intentó reparar fallos,
typecheck, contratos o drift.