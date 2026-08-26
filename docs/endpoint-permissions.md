# Endpoint Permission Matrix — Mariana Textil

Every non-public endpoint requires authentication (`requireSession`) **and** a specific module + action via `requierePermiso(modulo, accion)`.

## SUPERVISOR: authoritative ceiling and redaction

`SUPERVISOR` has a server-side permission ceiling applied after role rows and
`permisos_usuario` overrides. An override can restrict this role, but can never
grant access outside this inventory:

- Read: `dashboard`, `inventario`, `productos`, `entradas`, `salidas`,
  `movimientos`, `ajustes`, `etiquetas`, `contenedores`, `clientes`,
  `proveedores`, `reportes`.
- Mutations are limited to the configured operational actions for `entradas`,
  `salidas`, `ajustes`, `etiquetas`, `contenedores`, `clientes` and
  `proveedores`. Products are always read-only.
- All operational reads and mutations above use all real locations; the
  assigned user location and `alcanceConsulta` do not restrict SUPERVISOR.

The following endpoint families are an absolute 403 for SUPERVISOR, including
when a role row or user override says `true`:

- `/api/pos/**`, `/api/tickets/**`, `/api/caja/**` (POS, tickets, payments,
  collections, cash sessions, summaries and cuts).
- `/api/precios/**`.
- `/api/locations/**`, `/api/users/**`, `/api/permisos/**`.
- `/api/inventario/conciliacion/**`, `/api/admin/**`, `/api/auditoria/**`.
- Every route protected by `clientes_credito`, `clientes_precios`,
  `clientes_finanzas` or `proveedores_finanzas`, including their JSON, XLSX and
  PDF exports.
- `/api/cliente-documentos/**` and operational customer routes that manage
  credit terms, documents or INE.
- `/api/inventario/entradas/pendientes-costo/**` and
  `/api/inventario/entradas/:id/costos`.

Exact forbidden route inventory (all supported HTTP methods on each listed
path are forbidden):

- POS/tickets/caja: `/api/pos/buscar`, `/api/pos/validar-precio`,
  `/api/tickets`, `/api/tickets/pendientes`, `/api/tickets/:id`,
  `/api/tickets/:id/cancelar`, `/api/tickets/:id/cobrar`,
  `/api/caja/tickets`, `/api/sesiones-caja/actual`,
  `/api/sesiones-caja`, `/api/sesiones-caja/abrir`,
  `/api/sesiones-caja/:id/corte`, `/api/sesiones-caja/:id/cerrar`.
- Prices: `/api/precios`, `/api/precios/:id`,
  `/api/precios/:id/cambiar`.
- Customer restricted data: `/api/clientes/resumen`,
  `/api/clientes/cartera`, `/api/clientes/cartera.xlsx`,
  `/api/clientes/cartera.pdf`, `/api/clientes/analitica`,
  `/api/clientes/analitica.xlsx`, `/api/clientes/:id/credito`,
  `/api/clientes/:id/precios`, `/api/clientes/:id/estado-cuenta`,
  `/api/clientes/:id/estado-cuenta/imprimir`,
  `/api/clientes/:id/estado-cuenta.xlsx`,
  `/api/clientes/:id/estado-cuenta.pdf`, `/api/clientes/:id/compras`,
  `/api/clientes/:id/analitica`, `/api/clientes/:id/estadisticas`,
  `/api/clientes/:id/pagos`, `/api/clientes/:id/ajustes`,
  `/api/clientes/:id/documentos`, `/api/clientes/:id/documentos/:lado`,
  `/api/cliente-documentos/:publicId/ver` and
  `/api/cliente-documentos/:publicId/descargar`.
- Supplier finance: `/api/proveedores/resumen`,
  `/api/proveedores/analitica-global`, `/api/proveedores/:id/compras`,
  `/api/proveedores/:id/pagos`, `/api/proveedores/:id/estado-cuenta`,
  `/api/proveedores/:id/ajustes`, `/api/proveedores/:id/estadisticas`,
  `/api/proveedores/:id/exportar`.
- Administration: `/api/locations`, `/api/locations/:id`, `/api/users`,
  `/api/users/:id`, every `/api/permisos/**`, every `/api/admin/**`,
  every `/api/auditoria/**`, `/api/inventario/conciliacion` and
  `/api/inventario/conciliacion/recalcular`.

Reachable JSON responses are recursively filtered on the server. Economic and
sensitive keys are physically absent (never `null` or a synthetic zero):
purchase/sale costs and prices, inventory values, balances and credit terms,
payment amounts/mixes, INE/document storage metadata, and
margin/profit/utility. The same rule is applied by report/container builders
before XLSX/PDF creation. Product responses omit `precioSugerido`,
`comprasResumen` and `comprasHistorial`. SUPERVISOR entries always create
pending-cost rolls: submitted unit costs are discarded and no cost-capture API
is reachable.

Public exceptions (no auth, no permission check):
- `GET /api/healthz`
- `POST /api/auth/login`
- `GET /api/inventario/server-time` (if present)

Auth-only endpoints (session required, no module check):
- `GET /api/auth/me`
- `POST /api/auth/logout`

---

## Dashboard

| Endpoint | Module | Action |
|----------|--------|--------|
| `GET /api/dashboard` | `dashboard` | `ver` |

---

## Locations (Ubicaciones)

| Endpoint | Module | Action |
|----------|--------|--------|
| `GET /api/locations` | `ubicaciones` | `ver` |
| `PATCH /api/locations/:id` | `ubicaciones` | `editar` |

---

## Users (Usuarios)

| Endpoint | Module | Action |
|----------|--------|--------|
| `GET /api/users` | `usuarios` | `ver` |
| `POST /api/users` | `usuarios` | `crear` |
| `PATCH /api/users/:id` | `usuarios` | `editar` |

---

## Productos

| Endpoint | Module | Action |
|----------|--------|--------|
| `GET /api/productos` | `productos` | `ver` |
| `POST /api/productos` | `productos` | `crear` |
| `GET /api/productos/:id` | `productos` | `ver` |
| `PATCH /api/productos/:id` | `productos` | `editar` |
| `POST /api/productos/import/preview` | `productos` | `crear` |
| `POST /api/productos/import/confirm` | `productos` | `crear` |

---

## Proveedores (Operational)

| Endpoint | Module | Action |
|----------|--------|--------|
| `GET /api/proveedores` | `proveedores` | `ver` |
| `POST /api/proveedores` | `proveedores` | `crear` |
| `GET /api/proveedores/:id` | `proveedores` | `ver` |
| `PATCH /api/proveedores/:id` | `proveedores` | `editar` |

**Note:** `GET /api/proveedores` always includes the operational count `totalProveedores`, but omits every financial field (totalCompras, saldoPendiente, etc.) when the user lacks `proveedores_finanzas.puedeVer`. Never sends them expecting frontend to hide.

---

## Proveedores Finanzas

| Endpoint | Module | Action |
|----------|--------|--------|
| `GET /api/proveedores/resumen` | `proveedores_finanzas` | `ver` |
| `GET /api/proveedores/:id/compras` | `proveedores_finanzas` | `ver` |
| `GET /api/proveedores/:id/pagos` | `proveedores_finanzas` | `ver` |
| `GET /api/proveedores/:id/estado-cuenta` | `proveedores_finanzas` | `ver` |
| `GET /api/proveedores/:id/estadisticas` | `proveedores_finanzas` | `ver` |
| `GET /api/proveedores/:id/exportar` | `proveedores_finanzas` | `ver` |
| `POST /api/proveedores/:id/pagos` | `proveedores_finanzas` | `crear` |
| `POST /api/proveedores/:id/ajustes` | `proveedores_finanzas` | `autorizar` |

---

## Clientes (Operational)

| Endpoint | Module | Action |
|----------|--------|--------|
| `GET /api/clientes` | `clientes` | `ver` |
| `POST /api/clientes` | `clientes` | `crear` |
| `GET /api/clientes/:id` | `clientes` | `ver` |
| `PATCH /api/clientes/:id` | `clientes` | `editar` |

**Note:** `GET /api/clientes` and `GET /api/clientes/:id` never include financial fields (limiteCredito, saldoCredito). Those are exclusively available under clientes_credito and clientes_finanzas endpoints.

---

## Clientes Crédito

| Endpoint | Module | Action |
|----------|--------|--------|
| `GET /api/clientes/:id/credito` | `clientes_credito` | `ver` |

Returns only: `limiteCredito`, `saldoActual`, `creditoDisponible`, `puedeComprarCredito` — no history.

---

## Clientes Precios

| Endpoint | Module | Action |
|----------|--------|--------|
| `GET /api/clientes/:id/precios` | `clientes_precios` | `ver` |

Returns only unit prices + date + avg-3. **Never** totals, quantities, or product volumes.

---

## Clientes Finanzas

| Endpoint | Module | Action |
|----------|--------|--------|
| `GET /api/clientes/resumen` | `clientes_finanzas` | `ver` |
| `GET /api/clientes/:id/estado-cuenta` | `clientes_finanzas` | `ver` |
| `GET /api/clientes/:id/compras` | `clientes_finanzas` | `ver` |
| `GET /api/clientes/:id/estadisticas` | `clientes_finanzas` | `ver` |
| `GET /api/clientes/:id/pagos` | `clientes_finanzas` | `ver` |
| `POST /api/clientes/:id/pagos` | `clientes_finanzas` | `crear` |

---

## Permisos (Administration)

| Endpoint | Module | Action |
|----------|--------|--------|
| `GET /api/permisos/roles` | `permisos` | `ver` |
| `PUT /api/permisos/roles/:rol/:modulo` | `permisos` | `editar` |
| `GET /api/permisos/usuarios/:id` | `permisos` | `ver` |
| `PUT /api/permisos/usuarios/:id/:modulo` | `permisos` | `editar` |
| `DELETE /api/permisos/usuarios/:id/:modulo` | `permisos` | `editar` |
| `GET /api/permisos/preview/:id` | `permisos` | `ver` |

---

## Inventario

Inventory routes enforce the following effective permissions on the server:

| Endpoint | Module | Action |
|----------|--------|--------|
| `POST /api/inventario/entradas` | `entradas` | `crear` |
| `GET /api/inventario/entradas` | `entradas` | `ver` |
| `GET /api/inventario/entradas/:id` | `entradas` | `ver` |
| `POST /api/inventario/rollos/:id/activar` | `entradas` | `editar` |
| `POST /api/inventario/rollos/:id/mover` | — | Retirada: responde 410; usar `/api/salidas` |
| `POST /api/inventario/rollos/:id/recibir` | — | Retirada: responde 410; usar `/api/salidas/:id/recibir` |
| `POST /api/salidas` | `salidas` | `crear` |
| `POST /api/salidas/:id/aceptar` | `salidas` | `editar` + ubicación origen |
| `POST /api/salidas/:id/rechazar` | `salidas` | `editar` + ubicación origen |
| `POST /api/salidas/:id/preparar` | `salidas` | `editar` + ubicación origen |
| `POST /api/salidas/:id/enviar` | `salidas` | `editar` + ubicación origen |
| `POST /api/salidas/:id/recibir` | `salidas` | `editar` + ubicación destino |
| `POST /api/salidas/:id/cerrar` | `salidas` | `autorizar` + ubicación destino |
| `POST /api/salidas/:id/cancelar` | `salidas` | `autorizar` + ubicación relacionada |
| `POST /api/inventario/rollos/:id/salida-mostrador` | `salidas` | `crear` |
| `POST /api/inventario/rollos/:id/vender` | `pos` | `crear` |
| `POST /api/inventario/rollos/:id/ajustar` | `ajustes` | `crear` |
| `POST /api/inventario/rollos/:id/revertir` | `ajustes` | `autorizar` |
| `GET /api/inventario/rollos/:id` | `inventario` | `ver` |
| `GET /api/inventario/rollos` | `inventario` | `ver` |
| `GET /api/inventario/existencias` | `inventario` | `ver` |
| `GET /api/inventario/kardex` | `movimientos` | `ver` |
| `GET /api/inventario/conciliacion` | `conciliacion` | `ver` |
| `POST /api/inventario/conciliacion/recalcular` | `conciliacion` | `autorizar` |

---

## Default Role Matrix

| Módulo | ADMIN | CAJA | SUPERVISOR | BODEGA |
|--------|-------|------|-------------|--------|
| dashboard | total | ver | ver | ver |
| pos | total | ver/crear/editar | — | — |
| entradas | total | ver/crear | ver/crear/editar | ver/crear/editar |
| salidas | total | ver | ver/crear/editar | ver/editar |
| movimientos | total | ver | ver | ver |
| inventario | total | ver | ver | ver |
| productos | total | ver | ver | ver |
| ajustes | total | — | ver/crear | ver/crear |
| clientes | total | ver/crear/editar | — | — |
| clientes_credito | total | ver | — | — |
| clientes_precios | total | ver | — | — |
| clientes_finanzas | total | — | — | — |
| proveedores | total | — | ver | ver |
| proveedores_finanzas | total | — | — | — |
| contenedores | total | — | ver | ver |
| ubicaciones | total | — | — | — |
| usuarios | total | — | — | — |
| permisos | total | — | — | — |
| resumen_caja | total | ver | — | — |
| cortes | total | ver/crear | — | — |
| cobros_pagos | total | ver/crear | — | — |
| reportes | total | ver | ver | ver |
| conciliacion | total | — | — | — |
| auditoria | total | — | — | — |

"total" = las cuatro banderas encendidas. "—" = las cuatro apagadas.

---

## Permission Resolution

1. ADMIN bypasses tables with full access.
2. `permisos_usuario` row for (usuario_id, modulo) with non-null value wins.
3. Otherwise use `permisos_rol`; no row means deny.
4. Apply the immutable SUPERVISOR ceiling last. This final step can only
   remove access and therefore defeats permissive role rows and overrides.

## Protected Invariants

- ADMIN always keeps full effective access to `usuarios` and `permisos`, even if
  their matrix rows are missing or an inconsistent override exists, so an
  administrator can repair the permission configuration.
- A user cannot modify their own permission overrides
- There must always be at least one active ADMIN (enforced at application level)

## Fields Omitted Without Finance Permission

### GET /api/proveedores (without proveedores_finanzas.puedeVer)
Omitted: `totalCompras`, `totalComprado12Meses`, `comprasMes`, `totalPagado`, `saldoPendiente`, `ultimaCompra`, `comprasCount`, plus the summary fields `totalDeuda`, `proveedoresConSaldo`.

### GET /api/clientes (without clientes_finanzas.puedeVer)  
The clientes endpoint **never** returns financial fields regardless of permissions, since financial data has its own dedicated endpoints protected by separate modules (clientes_credito, clientes_finanzas). The `limiteCredito` and `saldoCredito` fields are not exposed in any clientes operational endpoint.
