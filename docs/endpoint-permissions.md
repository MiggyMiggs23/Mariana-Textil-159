# Endpoint Permission Matrix — Mariana Textil

Every non-public endpoint requires authentication (`requireSession`) **and** a specific module + action via `requierePermiso(modulo, accion)`.

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

| Módulo | ADMIN | CAJA | INVENTARIOS | BODEGA |
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

1. `permisos_usuario` row for (usuario_id, modulo) with non-null value → wins
2. `permisos_rol` row for (rol, modulo)
3. No row exists → **deny (403)** — never allow by omission

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
