# Validación completa — Prompt 3D

Fecha: 2026-08-22

## Estado de base de datos efectiva de la API

```json
{"permisos_rol":"permisos_rol","permisos_usuario":"permisos_usuario","alcance_consulta":true,"filas_permisos_rol":100}
```

Todos los comandos de prueba finalizaron con código 0. A continuación se conserva stdout y stderr completos, sin recortes.

## 1. 01-typecheck.log

```text
============================================================
COMANDO: pnpm run typecheck
============================================================

> workspace@0.0.0 typecheck /home/runner/workspace
> pnpm run typecheck:libs && pnpm -r --filter "./artifacts/**" --filter "./scripts" --if-present run typecheck


> workspace@0.0.0 typecheck:libs /home/runner/workspace
> tsc --build

Scope: 4 of 9 workspace projects
artifacts/api-server typecheck$ tsc -p tsconfig.json --noEmit
artifacts/mariana-textil typecheck$ tsc -p tsconfig.json --noEmit
artifacts/mockup-sandbox typecheck$ tsc -p tsconfig.json --noEmit
scripts typecheck$ tsc -p tsconfig.json --noEmit
scripts typecheck: Done
artifacts/api-server typecheck: Done
artifacts/mockup-sandbox typecheck: Done
artifacts/mariana-textil typecheck: Done
```

## 2. 02-permisos.log

```text
============================================================
COMANDO: pnpm --filter @workspace/api-server exec tsx src/lib/permisos.test.ts
============================================================
  ✓ P-01: ADMIN tiene acceso total a dashboard
  ✓ P-02: CAJA puede ver dashboard pero no autorizar
  ✓ P-03: BODEGA no puede acceder a POS
  ✓ P-04: BODEGA no puede ver clientes
  ✓ P-05: CAJA no puede ver proveedores
  ✓ P-06: CAJA puede ver POS
  ✓ P-07: módulo sin fila en ninguna tabla → denegar (null)
  ✓ P-08: usuario override sobrescribe permiso del rol
  ✓ P-09: null override means inherit from role
  ✓ P-10: validateAdminInvariants rejects removing ADMIN access to 'usuarios'
  ✓ P-11: validateAdminInvariants rejects removing ADMIN access to 'permisos'
  ✓ P-12: validateAdminInvariants allows full ADMIN access to 'usuarios'
  ✓ P-13: validateAdminInvariants allows modifying non-protected modules for ADMIN
  ✓ P-14: validateAdminInvariants allows any value for non-ADMIN roles
  ✓ P-15: buildPermissionMatrix returns all 25 modules
  ✓ P-16: ADMIN matrix has full access to all modules
  ✓ P-17: CAJA has no access to proveedores_finanzas
  ✓ P-18: CAJA has no access to clientes_finanzas
  ✓ P-19: CAJA can see clientes_credito
  ✓ P-20: Dynamically updating role matrix affects future permission checks
  ✓ P-21: BODEGA cannot see proveedores_finanzas
  ✓ P-22: BODEGA can see proveedores (operativo)
  ✓ P-23: CAJA can see clientes_precios
  ✓ P-24: CAJA cannot see clientes_finanzas
  ✓ P-25: user override with explicit true overrides role false
  ✓ P-26: protected ADMIN modules survive missing rows and false overrides

Permisos tests: 26/26 passed
```

## 3. 03-inventario.log

```text
============================================================
COMANDO: pnpm --filter @workspace/api-server run test:inventario
============================================================

> @workspace/api-server@0.0.0 test:inventario /home/runner/workspace/artifacts/api-server
> tsx src/lib/inventario.test.ts

  ✓ T-01: Crear rollo DISPONIBLE → existencias 47.3, rollos_count 1
  ✓ T-02: Crear 3 rollos en 1 tx → total 149.2, rollos_count 3
  ✓ T-03: salidaMostrador → MOSTRADOR terminal, existencias decrements
  ✓ T-04: Transferencia salida → total consolidado invariante
  ✓ T-05: Recibir transferencia → total consolidado invariante
  ✓ T-06: Operaciones concurrentes en mismo rollo → una gana, otra falla
  ✓ T-07: Series concurrentes → números globales distintos y consecutivos
  ✓ T-08: Revertir movimiento restaura existencia exacta previa
  ✓ T-09: Ajuste con justificación <10 chars es rechazado
  ✓ T-10: SUM(movimientos.cantidad) = cache para todo par
  ✓ T-11: uuid_cliente repetido → no duplica movimiento, retorna original
  ✓ T-12: Rollo PROGRAMADO ausente de existencias; tras activación presente
  ✓ T-13: Revertir SALIDA_MOSTRADOR falla; rollo permanece MOSTRADOR
  ✓ T-14: Revertir VENTA → rollo DISPONIBLE, existencia restaurada
  ✓ T-15: Revertir ajuste BAJA → rollo DISPONIBLE, cantidad restaurada
  ✓ T-16: Tras reversos, SUM(movimientos) = caché para todo par

─────────────────────────────────────────────
Results: 16 passed, 0 failed
Cleanup: OK
```

## 4. 04-entradas.log

```text
============================================================
COMANDO: pnpm --filter @workspace/api-server run test:entradas
============================================================

> @workspace/api-server@0.0.0 test:entradas /home/runner/workspace/artifacts/api-server
> tsx src/lib/entradas.test.ts

  ✓ E-01: Entrada multi-producto → totales, enlace recepcion_id, RECEPCION, existencias y COMPRA proveedor
  ✓ E-02: uuid_cliente repetido → no duplica, retorna entrada original
  ✓ E-03: Rollback → no quema series ni deja filas
  ✓ E-04: Entrada sin rollos → InventarioError

─────────────────────────────────────────────
Results: 4 passed, 0 failed
Cleanup: OK
```

## 5. 05-proveedores.log

```text
============================================================
COMANDO: pnpm --filter @workspace/api-server run test:proveedores
============================================================

> @workspace/api-server@0.0.0 test:proveedores /home/runner/workspace/artifacts/api-server
> tsx src/lib/compras-proveedor.test.ts

  ✓ CP-00: fechas de filtro respetan el día de México y rechazan valores inválidos
  ✓ CP-01: COMPRA insertada en crearEntrada con proveedor
  ✓ CP-02: COMPRA no se duplica (idempotencia backfill)
  ✓ CP-03: PAGO registrado como negativo reduce saldo
  ✓ CP-04: estadoCuenta devuelve movimientos cronológicos con saldo corrido
  ✓ CP-04b: estadoCuenta filtrado conserva saldo inicial y saldo actual global
  ✓ CP-05: Estado de compra Pendiente/Parcial/Pagada calculado correctamente
  ✓ CP-06: registrarAjuste conserva el signo del importe
  ✓ CP-07: resumenProveedores devuelve totales por proveedor
  ✓ CP-08: estadisticasPeriodo devuelve breakdown correcto

─────────────────────────────────────────────
Results: 10 passed, 0 failed
Cleanup: OK
```

## 6. 06-security-api.log

```text
============================================================
COMANDO: pnpm --filter @workspace/api-server run test:security-api
============================================================

> @workspace/api-server@0.0.0 test:security-api /home/runner/workspace/artifacts/api-server
> tsx src/security-api.test.ts

  ✓ S-01: All four roles login → 200 + permisos array present
[02:04:55.496] [32mINFO[39m (64869): [36mrequest completed[39m
    [35mreq[39m: {
      "id": 1,
      "method": "POST",
      "url": "/api/auth/login"
    }
    [35mres[39m: {
      "statusCode": 200
    }
    [35mresponseTime[39m: 43
[02:04:55.531] [32mINFO[39m (64869): [36mrequest completed[39m
    [35mreq[39m: {
      "id": 2,
      "method": "POST",
      "url": "/api/auth/login"
    }
    [35mres[39m: {
      "statusCode": 200
    }
    [35mresponseTime[39m: 28
[02:04:55.559] [32mINFO[39m (64869): [36mrequest completed[39m
    [35mreq[39m: {
      "id": 3,
      "method": "POST",
      "url": "/api/auth/login"
    }
    [35mres[39m: {
      "statusCode": 200
    }
    [35mresponseTime[39m: 26
[02:04:55.587] [32mINFO[39m (64869): [36mrequest completed[39m
    [35mreq[39m: {
      "id": 4,
      "method": "POST",
      "url": "/api/auth/login"
    }
    [35mres[39m: {
      "statusCode": 200
    }
    [35mresponseTime[39m: 27
[02:04:55.618] [32mINFO[39m (64869): [36mrequest completed[39m
    [35mreq[39m: {
      "id": 5,
      "method": "POST",
      "url": "/api/auth/login"
    }
    [35mres[39m: {
      "statusCode": 200
    }
    [35mresponseTime[39m: 29
  ✓ S-02: ADMIN /auth/me effective matrix — 25 modules, all full access
[02:04:55.633] [32mINFO[39m (64869): [36mrequest completed[39m
    [35mreq[39m: {
      "id": 6,
      "method": "GET",
      "url": "/api/auth/me"
    }
    [35mres[39m: {
      "statusCode": 200
    }
    [35mresponseTime[39m: 11
  ✓ S-03: CAJA /auth/me effective matrix — pos OK, proveedores denied
[02:04:55.660] [32mINFO[39m (64869): [36mrequest completed[39m
    [35mreq[39m: {
      "id": 7,
      "method": "POST",
      "url": "/api/auth/login"
    }
    [35mres[39m: {
      "statusCode": 200
    }
    [35mresponseTime[39m: 25
[02:04:55.667] [32mINFO[39m (64869): [36mrequest completed[39m
    [35mreq[39m: {
      "id": 8,
      "method": "GET",
      "url": "/api/auth/me"
    }
    [35mres[39m: {
      "statusCode": 200
    }
    [35mresponseTime[39m: 6
[02:04:55.694] [32mINFO[39m (64869): [36mrequest completed[39m
    [35mreq[39m: {
      "id": 9,
      "method": "POST",
      "url": "/api/auth/login"
    }
    [35mres[39m: {
      "statusCode": 200
    }
    [35mresponseTime[39m: 25
[02:04:55.712] [32mINFO[39m (64869): [36mrequest completed[39m
    [35mreq[39m: {
      "id": 10,
      "method": "GET",
      "url": "/api/inventario/rollos"
    }
    [35mres[39m: {
      "statusCode": 200
    }
    [35mresponseTime[39m: 16
  ✓ S-04: BODEGA — POST /inventario/rollos/:id/vender → 403
[02:04:55.723] [32mINFO[39m (64869): [36mrequest completed[39m
    [35mreq[39m: {
      "id": 11,
      "method": "POST",
      "url": "/api/inventario/rollos/1301/vender"
    }
    [35mres[39m: {
      "statusCode": 403
    }
    [35mresponseTime[39m: 10
[02:04:55.751] [32mINFO[39m (64869): [36mrequest completed[39m
    [35mreq[39m: {
      "id": 12,
      "method": "POST",
      "url": "/api/auth/login"
    }
    [35mres[39m: {
      "statusCode": 200
    }
    [35mresponseTime[39m: 26
  ✓ S-05: BODEGA GET /clientes → 403
[02:04:55.762] [32mINFO[39m (64869): [36mrequest completed[39m
    [35mreq[39m: {
      "id": 13,
      "method": "GET",
      "url": "/api/clientes"
    }
    [35mres[39m: {
      "statusCode": 403
    }
    [35mresponseTime[39m: 10
  ✓ S-06: CAJA POST /inventario/rollos/:id/vender on own-location rollo → 200
[02:04:55.800] [32mINFO[39m (64869): [36mrequest completed[39m
    [35mreq[39m: {
      "id": 14,
      "method": "POST",
      "url": "/api/auth/login"
    }
    [35mres[39m: {
      "statusCode": 200
    }
    [35mresponseTime[39m: 24
[02:04:55.821] [32mINFO[39m (64869): [36mrequest completed[39m
    [35mreq[39m: {
      "id": 15,
      "method": "POST",
      "url": "/api/inventario/rollos/1302/vender"
    }
    [35mres[39m: {
      "statusCode": 200
    }
    [35mresponseTime[39m: 19
  ✓ S-07: CAJA GET /proveedores → 403
[02:04:55.850] [32mINFO[39m (64869): [36mrequest completed[39m
    [35mreq[39m: {
      "id": 16,
      "method": "POST",
      "url": "/api/auth/login"
    }
    [35mres[39m: {
      "statusCode": 200
    }
    [35mresponseTime[39m: 28
[02:04:55.859] [32mINFO[39m (64869): [36mrequest completed[39m
    [35mreq[39m: {
      "id": 17,
      "method": "GET",
      "url": "/api/proveedores"
    }
    [35mres[39m: {
      "statusCode": 403
    }
    [35mresponseTime[39m: 9
[02:04:55.885] [32mINFO[39m (64869): [36mrequest completed[39m
    [35mreq[39m: {
      "id": 18,
      "method": "POST",
      "url": "/api/auth/login"
    }
    [35mres[39m: {
      "statusCode": 200
    }
    [35mresponseTime[39m: 25
  ✓ S-08: INVENTARIOS GET /proveedores → 200, no financial JSON keys
[02:04:55.901] [32mINFO[39m (64869): [36mrequest completed[39m
    [35mreq[39m: {
      "id": 19,
      "method": "GET",
      "url": "/api/proveedores"
    }
    [35mres[39m: {
      "statusCode": 200
    }
    [35mresponseTime[39m: 15
  ✓ S-09: BODEGA GET /proveedores → 200, no financial JSON keys
[02:04:55.926] [32mINFO[39m (64869): [36mrequest completed[39m
    [35mreq[39m: {
      "id": 20,
      "method": "POST",
      "url": "/api/auth/login"
    }
    [35mres[39m: {
      "statusCode": 200
    }
    [35mresponseTime[39m: 24
[02:04:55.937] [32mINFO[39m (64869): [36mrequest completed[39m
    [35mreq[39m: {
      "id": 21,
      "method": "GET",
      "url": "/api/proveedores"
    }
    [35mres[39m: {
      "statusCode": 200
    }
    [35mresponseTime[39m: 10
[02:04:55.963] [32mINFO[39m (64869): [36mrequest completed[39m
    [35mreq[39m: {
      "id": 22,
      "method": "POST",
      "url": "/api/auth/login"
    }
    [35mres[39m: {
      "statusCode": 200
    }
    [35mresponseTime[39m: 25
[02:04:55.973] [32mINFO[39m (64869): [36mrequest completed[39m
    [35mreq[39m: {
      "id": 23,
      "method": "GET",
      "url": "/api/proveedores/resumen"
    }
    [35mres[39m: {
      "statusCode": 403
    }
    [35mresponseTime[39m: 9
  ✓ S-10: INVENTARIOS GET /proveedores/resumen → 403 (proveedores_finanzas.ver denied)
[02:04:56.000] [32mINFO[39m (64869): [36mrequest completed[39m
    [35mreq[39m: {
      "id": 24,
      "method": "POST",
      "url": "/api/auth/login"
    }
    [35mres[39m: {
      "statusCode": 200
    }
    [35mresponseTime[39m: 26
[02:04:56.015] [32mINFO[39m (64869): [36mrequest completed[39m
    [35mreq[39m: {
      "id": 25,
      "method": "PUT",
      "url": "/api/permisos/usuarios/119/proveedores_finanzas"
    }
    [35mres[39m: {
      "statusCode": 200
    }
    [35mresponseTime[39m: 14
[02:04:56.043] [32mINFO[39m (64869): [36mrequest completed[39m
    [35mreq[39m: {
      "id": 26,
      "method": "POST",
      "url": "/api/auth/login"
    }
    [35mres[39m: {
      "statusCode": 200
    }
    [35mresponseTime[39m: 27
[02:04:56.055] [32mINFO[39m (64869): [36mrequest completed[39m
    [35mreq[39m: {
      "id": 27,
      "method": "GET",
      "url": "/api/proveedores/resumen"
    }
    [35mres[39m: {
      "statusCode": 200
    }
    [35mresponseTime[39m: 11
  ✓ S-11: Override grants INVENTARIOS proveedores_finanzas.ver → resumen 200
[02:04:56.062] [32mINFO[39m (64869): [36mrequest completed[39m
    [35mreq[39m: {
      "id": 28,
      "method": "GET",
      "url": "/api/auth/me"
    }
    [35mres[39m: {
      "statusCode": 200
    }
    [35mresponseTime[39m: 6
[02:04:56.089] [32mINFO[39m (64869): [36mrequest completed[39m
    [35mreq[39m: {
      "id": 29,
      "method": "POST",
      "url": "/api/auth/login"
    }
    [35mres[39m: {
      "statusCode": 200
    }
    [35mresponseTime[39m: 26
[02:04:56.102] [32mINFO[39m (64869): [36mrequest completed[39m
    [35mreq[39m: {
      "id": 30,
      "method": "DELETE",
      "url": "/api/permisos/usuarios/119/proveedores_finanzas"
    }
    [35mres[39m: {
      "statusCode": 204
    }
    [35mresponseTime[39m: 12
  ✓ S-12: DELETE override → INVENTARIOS reverts to role default (403)
[02:04:56.128] [32mINFO[39m (64869): [36mrequest completed[39m
    [35mreq[39m: {
      "id": 31,
      "method": "POST",
      "url": "/api/auth/login"
    }
    [35mres[39m: {
      "statusCode": 200
    }
    [35mresponseTime[39m: 25
[02:04:56.138] [32mINFO[39m (64869): [36mrequest completed[39m
    [35mreq[39m: {
      "id": 32,
      "method": "GET",
      "url": "/api/proveedores/resumen"
    }
    [35mres[39m: {
      "statusCode": 403
    }
    [35mresponseTime[39m: 9
[02:04:56.163] [32mINFO[39m (64869): [36mrequest completed[39m
    [35mreq[39m: {
      "id": 33,
      "method": "POST",
      "url": "/api/auth/login"
    }
    [35mres[39m: {
      "statusCode": 200
    }
    [35mresponseTime[39m: 24
[02:04:56.174] [32mINFO[39m (64869): [36mrequest completed[39m
    [35mreq[39m: {
      "id": 34,
      "method": "GET",
      "url": "/api/clientes"
    }
    [35mres[39m: {
      "statusCode": 403
    }
    [35mresponseTime[39m: 10
[02:04:56.201] [32mINFO[39m (64869): [36mrequest completed[39m
    [35mreq[39m: {
      "id": 35,
      "method": "POST",
      "url": "/api/auth/login"
    }
    [35mres[39m: {
      "statusCode": 200
    }
    [35mresponseTime[39m: 26
[02:04:56.215] [32mINFO[39m (64869): [36mrequest completed[39m
    [35mreq[39m: {
      "id": 36,
      "method": "PUT",
      "url": "/api/permisos/usuarios/120/clientes"
    }
    [35mres[39m: {
      "statusCode": 200
    }
    [35mresponseTime[39m: 12
[02:04:56.239] [32mINFO[39m (64869): [36mrequest completed[39m
    [35mreq[39m: {
      "id": 37,
      "method": "POST",
      "url": "/api/auth/login"
    }
    [35mres[39m: {
      "statusCode": 200
    }
    [35mresponseTime[39m: 23
  ✓ S-13: Override true beats role false: BODEGA clientes 403 → override → 200
[02:04:56.251] [32mINFO[39m (64869): [36mrequest completed[39m
    [35mreq[39m: {
      "id": 38,
      "method": "GET",
      "url": "/api/clientes"
    }
    [35mres[39m: {
      "statusCode": 200
    }
    [35mresponseTime[39m: 11
[02:04:56.277] [32mINFO[39m (64869): [36mrequest completed[39m
    [35mreq[39m: {
      "id": 39,
      "method": "POST",
      "url": "/api/auth/login"
    }
    [35mres[39m: {
      "statusCode": 200
    }
    [35mresponseTime[39m: 25
[02:04:56.288] [32mINFO[39m (64869): [36mrequest completed[39m
    [35mreq[39m: {
      "id": 40,
      "method": "DELETE",
      "url": "/api/permisos/usuarios/120/clientes"
    }
    [35mres[39m: {
      "statusCode": 204
    }
    [35mresponseTime[39m: 10
[02:04:56.315] [32mINFO[39m (64869): [36mrequest completed[39m
    [35mreq[39m: {
      "id": 41,
      "method": "POST",
      "url": "/api/auth/login"
    }
    [35mres[39m: {
      "statusCode": 200
    }
    [35mresponseTime[39m: 25
  ✓ S-14: DELETE override → BODEGA clientes reverts to role 403
[02:04:56.324] [32mINFO[39m (64869): [36mrequest completed[39m
    [35mreq[39m: {
      "id": 42,
      "method": "GET",
      "url": "/api/clientes"
    }
    [35mres[39m: {
      "statusCode": 403
    }
    [35mresponseTime[39m: 8
[02:04:56.350] [32mINFO[39m (64869): [36mrequest completed[39m
    [35mreq[39m: {
      "id": 43,
      "method": "POST",
      "url": "/api/auth/login"
    }
    [35mres[39m: {
      "statusCode": 200
    }
    [35mresponseTime[39m: 25
[02:04:56.360] [32mINFO[39m (64869): [36mrequest completed[39m
    [35mreq[39m: {
      "id": 44,
      "method": "GET",
      "url": "/api/permisos/preview/120"
    }
    [35mres[39m: {
      "statusCode": 200
    }
    [35mresponseTime[39m: 9
[02:04:56.374] [32mINFO[39m (64869): [36mrequest completed[39m
    [35mreq[39m: {
      "id": 45,
      "method": "GET",
      "url": "/api/permisos/preview/120"
    }
    [35mres[39m: {
      "statusCode": 200
    }
    [35mresponseTime[39m: 10
  ✓ S-15: Deny-by-default — BODEGA reportes 200; after row removal → 403; restore → 200
[02:04:56.388] [32mINFO[39m (64869): [36mrequest completed[39m
    [35mreq[39m: {
      "id": 46,
      "method": "GET",
      "url": "/api/permisos/preview/120"
    }
    [35mres[39m: {
      "statusCode": 200
    }
    [35mresponseTime[39m: 11
[02:04:56.414] [32mINFO[39m (64869): [36mrequest completed[39m
    [35mreq[39m: {
      "id": 47,
      "method": "POST",
      "url": "/api/auth/login"
    }
    [35mres[39m: {
      "statusCode": 200
    }
    [35mresponseTime[39m: 25
[02:04:56.421] [32mINFO[39m (64869): [36mrequest completed[39m
    [35mreq[39m: {
      "id": 48,
      "method": "PUT",
      "url": "/api/permisos/roles/ADMIN/usuarios"
    }
    [35mres[39m: {
      "statusCode": 403
    }
    [35mresponseTime[39m: 7
[02:04:56.436] [32mINFO[39m (64869): [36mrequest completed[39m
    [35mreq[39m: {
      "id": 49,
      "method": "GET",
      "url": "/api/users"
    }
    [35mres[39m: {
      "statusCode": 200
    }
    [35mresponseTime[39m: 10
[02:04:56.443] [32mINFO[39m (64869): [36mrequest completed[39m
    [35mreq[39m: {
      "id": 50,
      "method": "GET",
      "url": "/api/auth/me"
    }
    [35mres[39m: {
      "statusCode": 200
    }
    [35mresponseTime[39m: 6
  ✓ S-16: PUT /permisos/roles/ADMIN/usuarios with puedeVer=false → 403
[02:04:56.475] [32mINFO[39m (64869): [36mrequest completed[39m
    [35mreq[39m: {
      "id": 51,
      "method": "POST",
      "url": "/api/auth/login"
    }
    [35mres[39m: {
      "statusCode": 200
    }
    [35mresponseTime[39m: 24
[02:04:56.483] [32mINFO[39m (64869): [36mrequest completed[39m
    [35mreq[39m: {
      "id": 52,
      "method": "PUT",
      "url": "/api/permisos/roles/ADMIN/permisos"
    }
    [35mres[39m: {
      "statusCode": 403
    }
    [35mresponseTime[39m: 7
[02:04:56.496] [32mINFO[39m (64869): [36mrequest completed[39m
    [35mreq[39m: {
      "id": 53,
      "method": "GET",
      "url": "/api/permisos/roles"
    }
    [35mres[39m: {
      "statusCode": 200
    }
    [35mresponseTime[39m: 9
  ✓ S-17: PUT /permisos/roles/ADMIN/permisos with puedeCrear=false → 403
[02:04:56.502] [32mINFO[39m (64869): [36mrequest completed[39m
    [35mreq[39m: {
      "id": 54,
      "method": "GET",
      "url": "/api/auth/me"
    }
    [35mres[39m: {
      "statusCode": 200
    }
    [35mresponseTime[39m: 5
[02:04:56.530] [32mINFO[39m (64869): [36mrequest completed[39m
    [35mreq[39m: {
      "id": 55,
      "method": "POST",
      "url": "/api/auth/login"
    }
    [35mres[39m: {
      "statusCode": 200
    }
    [35mresponseTime[39m: 24
  ✓ S-18: Self-override modification → 403 (cannot modify own permissions)
[02:04:56.538] [32mINFO[39m (64869): [36mrequest completed[39m
    [35mreq[39m: {
      "id": 56,
      "method": "PUT",
      "url": "/api/permisos/usuarios/117/dashboard"
    }
    [35mres[39m: {
      "statusCode": 403
    }
    [35mresponseTime[39m: 7
[02:04:56.566] [32mINFO[39m (64869): [36mrequest completed[39m
    [35mreq[39m: {
      "id": 57,
      "method": "POST",
      "url": "/api/auth/login"
    }
    [35mres[39m: {
      "statusCode": 200
    }
    [35mresponseTime[39m: 26
[02:04:56.601] [32mINFO[39m (64869): [36mrequest completed[39m
    [35mreq[39m: {
      "id": 58,
      "method": "PATCH",
      "url": "/api/users/117"
    }
    [35mres[39m: {
      "statusCode": 409
    }
    [35mresponseTime[39m: 11
  ✓ S-19: Last active ADMIN — deactivate → 409 (must keep at least one)
  ✓ S-20: BODEGA PROPIA — GET /inventario/rollos?ubicacionId=other → forced to own
[02:04:56.653] [32mINFO[39m (64869): [36mrequest completed[39m
    [35mreq[39m: {
      "id": 59,
      "method": "POST",
      "url": "/api/auth/login"
    }
    [35mres[39m: {
      "statusCode": 200
    }
    [35mresponseTime[39m: 26
[02:04:56.664] [32mINFO[39m (64869): [36mrequest completed[39m
    [35mreq[39m: {
      "id": 60,
      "method": "GET",
      "url": "/api/inventario/rollos"
    }
    [35mres[39m: {
      "statusCode": 200
    }
    [35mresponseTime[39m: 10
  ✓ S-21: BODEGA PROPIA — GET /inventario/existencias?ubicacionId=other → forced to own
[02:04:56.689] [32mINFO[39m (64869): [36mrequest completed[39m
    [35mreq[39m: {
      "id": 61,
      "method": "POST",
      "url": "/api/auth/login"
    }
    [35mres[39m: {
      "statusCode": 200
    }
    [35mresponseTime[39m: 24
[02:04:56.699] [32mINFO[39m (64869): [36mrequest completed[39m
    [35mreq[39m: {
      "id": 62,
      "method": "GET",
      "url": "/api/inventario/existencias"
    }
    [35mres[39m: {
      "statusCode": 200
    }
    [35mresponseTime[39m: 9
[02:04:56.724] [32mINFO[39m (64869): [36mrequest completed[39m
    [35mreq[39m: {
      "id": 63,
      "method": "POST",
      "url": "/api/auth/login"
    }
    [35mres[39m: {
      "statusCode": 200
    }
    [35mresponseTime[39m: 24
[02:04:56.734] [32mINFO[39m (64869): [36mrequest completed[39m
    [35mreq[39m: {
      "id": 64,
      "method": "GET",
      "url": "/api/inventario/kardex"
    }
    [35mres[39m: {
      "statusCode": 200
    }
    [35mresponseTime[39m: 9
  ✓ S-22: BODEGA PROPIA — GET /inventario/kardex → ignores other ubicacionId param
[02:04:56.760] [32mINFO[39m (64869): [36mrequest completed[39m
    [35mreq[39m: {
      "id": 65,
      "method": "POST",
      "url": "/api/auth/login"
    }
    [35mres[39m: {
      "statusCode": 200
    }
    [35mresponseTime[39m: 25
[02:04:56.771] [32mINFO[39m (64869): [36mrequest completed[39m
    [35mreq[39m: {
      "id": 66,
      "method": "GET",
      "url": "/api/inventario/rollos"
    }
    [35mres[39m: {
      "statusCode": 200
    }
    [35mresponseTime[39m: 10
  ✓ S-23: BODEGA alcanceConsulta=TODAS — GET /inventario/rollos?ubicacionId=other → honors filter
[02:04:56.783] [32mINFO[39m (64869): [36mrequest completed[39m
    [35mreq[39m: {
      "id": 67,
      "method": "GET",
      "url": "/api/inventario/rollos"
    }
    [35mres[39m: {
      "statusCode": 200
    }
    [35mresponseTime[39m: 11
[02:04:56.822] [32mINFO[39m (64869): [36mrequest completed[39m
    [35mreq[39m: {
      "id": 68,
      "method": "POST",
      "url": "/api/auth/login"
    }
    [35mres[39m: {
      "statusCode": 200
    }
    [35mresponseTime[39m: 25
[02:04:56.832] [32mINFO[39m (64869): [36mrequest completed[39m
    [35mreq[39m: {
      "id": 69,
      "method": "POST",
      "url": "/api/inventario/rollos/1303/salida-mostrador"
    }
    [35mres[39m: {
      "statusCode": 403
    }
    [35mresponseTime[39m: 9
[02:04:56.856] [32mINFO[39m (64869): [36mrequest completed[39m
    [35mreq[39m: {
      "id": 70,
      "method": "POST",
      "url": "/api/auth/login"
    }
    [35mres[39m: {
      "statusCode": 200
    }
    [35mresponseTime[39m: 23
  ✓ S-24: Non-ADMIN mutation on other-location → 403; ADMIN same → succeeds
[02:04:56.874] [32mINFO[39m (64869): [36mrequest completed[39m
    [35mreq[39m: {
      "id": 71,
      "method": "POST",
      "url": "/api/inventario/rollos/1303/salida-mostrador"
    }
    [35mres[39m: {
      "statusCode": 200
    }
    [35mresponseTime[39m: 17
[02:04:56.898] [32mINFO[39m (64869): [36mrequest completed[39m
    [35mreq[39m: {
      "id": 72,
      "method": "POST",
      "url": "/api/auth/login"
    }
    [35mres[39m: {
      "statusCode": 200
    }
    [35mresponseTime[39m: 23
[02:04:56.911] [32mINFO[39m (64869): [36mrequest completed[39m
    [35mreq[39m: {
      "id": 73,
      "method": "POST",
      "url": "/api/clientes"
    }
    [35mres[39m: {
      "statusCode": 201
    }
    [35mresponseTime[39m: 12
  ✓ S-25: GET /clientes/:id — no limiteCredito / saldoCredito in response
[02:04:56.920] [32mINFO[39m (64869): [36mrequest completed[39m
    [35mreq[39m: {
      "id": 74,
      "method": "GET",
      "url": "/api/clientes/12"
    }
    [35mres[39m: {
      "statusCode": 200
    }
    [35mresponseTime[39m: 8
[02:04:56.944] [32mINFO[39m (64869): [36mrequest completed[39m
    [35mreq[39m: {
      "id": 75,
      "method": "POST",
      "url": "/api/auth/login"
    }
    [35mres[39m: {
      "statusCode": 200
    }
    [35mresponseTime[39m: 23
[02:04:56.970] [32mINFO[39m (64869): [36mrequest completed[39m
    [35mreq[39m: {
      "id": 76,
      "method": "POST",
      "url": "/api/auth/login"
    }
    [35mres[39m: {
      "statusCode": 200
    }
    [35mresponseTime[39m: 24
[02:04:56.995] [32mINFO[39m (64869): [36mrequest completed[39m
    [35mreq[39m: {
      "id": 77,
      "method": "POST",
      "url": "/api/auth/login"
    }
    [35mres[39m: {
      "statusCode": 200
    }
    [35mresponseTime[39m: 24
[02:04:57.010] [32mINFO[39m (64869): [36mrequest completed[39m
    [35mreq[39m: {
      "id": 78,
      "method": "GET",
      "url": "/api/clientes/12/credito"
    }
    [35mres[39m: {
      "statusCode": 200
    }
    [35mresponseTime[39m: 14
[02:04:57.020] [32mINFO[39m (64869): [36mrequest completed[39m
    [35mreq[39m: {
      "id": 79,
      "method": "GET",
      "url": "/api/clientes/12/precios"
    }
    [35mres[39m: {
      "statusCode": 200
    }
    [35mresponseTime[39m: 8
[02:04:57.029] [32mINFO[39m (64869): [36mrequest completed[39m
    [35mreq[39m: {
      "id": 80,
      "method": "GET",
      "url": "/api/clientes/12/estado-cuenta"
    }
    [35mres[39m: {
      "statusCode": 403
    }
    [35mresponseTime[39m: 8
[02:04:57.037] [32mINFO[39m (64869): [36mrequest completed[39m
    [35mreq[39m: {
      "id": 81,
      "method": "GET",
      "url": "/api/clientes/12"
    }
    [35mres[39m: {
      "statusCode": 403
    }
    [35mresponseTime[39m: 7
[02:04:57.047] [32mINFO[39m (64869): [36mrequest completed[39m
    [35mreq[39m: {
      "id": 82,
      "method": "GET",
      "url": "/api/clientes/12/credito"
    }
    [35mres[39m: {
      "statusCode": 403
    }
    [35mresponseTime[39m: 9
[02:04:57.057] [32mINFO[39m (64869): [36mrequest completed[39m
    [35mreq[39m: {
      "id": 83,
      "method": "GET",
      "url": "/api/clientes/12/precios"
    }
    [35mres[39m: {
      "statusCode": 403
    }
    [35mresponseTime[39m: 9
[02:04:57.068] [32mINFO[39m (64869): [36mrequest completed[39m
    [35mreq[39m: {
      "id": 84,
      "method": "GET",
      "url": "/api/clientes/12/credito"
    }
    [35mres[39m: {
      "statusCode": 200
    }
    [35mresponseTime[39m: 10
  ✓ S-26: clientes_credito / clientes_precios / clientes_finanzas independently gated
[02:04:57.078] [32mINFO[39m (64869): [36mrequest completed[39m
    [35mreq[39m: {
      "id": 85,
      "method": "GET",
      "url": "/api/clientes/12/estado-cuenta"
    }
    [35mres[39m: {
      "statusCode": 200
    }
    [35mresponseTime[39m: 10
[02:04:57.102] [32mINFO[39m (64869): [36mrequest completed[39m
    [35mreq[39m: {
      "id": 86,
      "method": "POST",
      "url": "/api/auth/login"
    }
    [35mres[39m: {
      "statusCode": 200
    }
    [35mresponseTime[39m: 23
[02:04:57.132] [32mINFO[39m (64869): [36mrequest completed[39m
    [35mreq[39m: {
      "id": 87,
      "method": "POST",
      "url": "/api/inventario/rollos/1304/salida-mostrador"
    }
    [35mres[39m: {
      "statusCode": 200
    }
    [35mresponseTime[39m: 16
[02:04:57.145] [32mINFO[39m (64869): [36mrequest completed[39m
    [35mreq[39m: {
      "id": 88,
      "method": "POST",
      "url": "/api/inventario/rollos/1304/revertir"
    }
    [35mres[39m: {
      "statusCode": 400
    }
    [35mresponseTime[39m: 11
[02:04:57.156] [32mINFO[39m (64869): [36mrequest completed[39m
    [35mreq[39m: {
      "id": 89,
      "method": "GET",
      "url": "/api/inventario/rollos/1304"
    }
    [35mres[39m: {
      "statusCode": 200
    }
    [35mresponseTime[39m: 10
[02:04:57.180] [32mINFO[39m (64869): [36mrequest completed[39m
    [35mreq[39m: {
      "id": 90,
      "method": "GET",
      "url": "/api/inventario/rollos/1305"
    }
    [35mres[39m: {
      "statusCode": 200
    }
    [35mresponseTime[39m: 10
[02:04:57.199] [32mINFO[39m (64869): [36mrequest completed[39m
    [35mreq[39m: {
      "id": 91,
      "method": "POST",
      "url": "/api/inventario/rollos/1305/vender"
    }
    [35mres[39m: {
      "statusCode": 200
    }
    [35mresponseTime[39m: 19
[02:04:57.223] [32mINFO[39m (64869): [36mrequest completed[39m
    [35mreq[39m: {
      "id": 92,
      "method": "POST",
      "url": "/api/inventario/rollos/1305/revertir"
    }
    [35mres[39m: {
      "statusCode": 200
    }
    [35mresponseTime[39m: 22
[02:04:57.253] [32mINFO[39m (64869): [36mrequest completed[39m
    [35mreq[39m: {
      "id": 93,
      "method": "GET",
      "url": "/api/inventario/rollos/1306"
    }
    [35mres[39m: {
      "statusCode": 200
    }
    [35mresponseTime[39m: 10
[02:04:57.272] [32mINFO[39m (64869): [36mrequest completed[39m
    [35mreq[39m: {
      "id": 94,
      "method": "POST",
      "url": "/api/inventario/rollos/1306/ajustar"
    }
    [35mres[39m: {
      "statusCode": 200
    }
    [35mresponseTime[39m: 18
  ✓ S-27: SALIDA_MOSTRADOR reversal fails (MOSTRADOR stays); VENTA+BAJA revert + cache reconcile
[02:04:57.290] [32mINFO[39m (64869): [36mrequest completed[39m
    [35mreq[39m: {
      "id": 95,
      "method": "POST",
      "url": "/api/inventario/rollos/1306/revertir"
    }
    [35mres[39m: {
      "statusCode": 200
    }
    [35mresponseTime[39m: 17
[02:04:57.299] [32mINFO[39m (64869): [36mrequest completed[39m
    [35mreq[39m: {
      "id": 96,
      "method": "GET",
      "url": "/api/inventario/kardex"
    }
    [35mres[39m: {
      "statusCode": 200
    }
    [35mresponseTime[39m: 8
[02:04:57.326] [32mINFO[39m (64869): [36mrequest completed[39m
    [35mreq[39m: {
      "id": 97,
      "method": "POST",
      "url": "/api/auth/login"
    }
    [35mres[39m: {
      "statusCode": 200
    }
    [35mresponseTime[39m: 23
[02:04:57.335] [32mINFO[39m (64869): [36mrequest completed[39m
    [35mreq[39m: {
      "id": 98,
      "method": "POST",
      "url": "/api/users"
    }
    [35mres[39m: {
      "statusCode": 403
    }
    [35mresponseTime[39m: 9
[02:04:57.344] [32mINFO[39m (64869): [36mrequest completed[39m
    [35mreq[39m: {
      "id": 99,
      "method": "PATCH",
      "url": "/api/users/120"
    }
    [35mres[39m: {
      "statusCode": 403
    }
    [35mresponseTime[39m: 9
[02:04:57.355] [32mINFO[39m (64869): [36mrequest completed[39m
    [35mreq[39m: {
      "id": 100,
      "method": "PATCH",
      "url": "/api/users/122"
    }
    [35mres[39m: {
      "statusCode": 403
    }
    [35mresponseTime[39m: 10
  ✓ S-28: Non-ADMIN with usuarios permissions cannot escalate to ADMIN
[02:04:57.366] [32mINFO[39m (64869): [36mrequest completed[39m
    [35mreq[39m: {
      "id": 101,
      "method": "PATCH",
      "url": "/api/users/117"
    }
    [35mres[39m: {
      "statusCode": 403
    }
    [35mresponseTime[39m: 10

Security API tests: 28/28 passed
```
