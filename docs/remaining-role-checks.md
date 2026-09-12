# Inventario de gates de rol restantes (runtime)

Fuente: código runtime de `artifacts/api-server/src` y `artifacts/mariana-textil/src`. Excluidos tests/fixtures/seeds y únicamente la política retirada `applySupervisorCeiling`. No es afirmación de configuración aprobada. Los números son actuales y pueden cambiar al retirar el cap principal. El apéndice de coincidencias de código acompaña este informe.

## API — veto de acción y allowlists literales

| Archivo:línea | Rol | Restricción efectiva | Categoría |
|---|---|---|---|
| `artifacts/api-server/src/middlewares/auth.ts:119-121` | roles indicados por cada ruta | `requireRole(...roles)` responde 403 si la sesión falta o el rol no pertenece a la lista literal | veto de acción |
| `artifacts/api-server/src/routes/clientes-admin.ts:24` | ADMIN | entrada al router clientes-admin limitada a ADMIN | veto de acción |
| `artifacts/api-server/src/routes/clientes-admin.ts:63-67` | SUPERVISOR | `POST /clientes/:id/baja` devuelve 403; no puede dar de baja clientes aunque tenga `clientes:editar` | veto de acción |
| `artifacts/api-server/src/routes/clientes-admin.ts:217-221` | SUPERVISOR | `POST /clientes/:id/reactivar` devuelve 403; no puede reactivar clientes aunque tenga `clientes:editar` | veto de acción |
| `artifacts/api-server/src/routes/clientes.ts:308-317` | SUPERVISOR | `POST /clientes` devuelve 403 si envía `diasCredito` o `limiteCredito`; no puede capturar términos financieros | veto de acción/dato sensible |
| `artifacts/api-server/src/routes/admin-alertas.ts:11` | ADMIN | `/admin/alertas` solo se ejecuta para ADMIN | veto de acción |
| `artifacts/api-server/src/routes/cliente-documentos.ts:43,67,155-156` | ADMIN | administración, ver y descargar documentos requieren ADMIN; ver/descargar además `clientes:ver` | veto de acción |
| `artifacts/api-server/src/routes/pagos-dirigidos.ts:269,304` | ADMIN | aprobar o rechazar pago dirigido | veto de acción |
| `artifacts/api-server/src/routes/purga.ts:20` | ADMIN | todo `/purga` requiere sesión y ADMIN | veto de acción |
| `artifacts/api-server/src/routes/admin-analytics.ts:79,82,331,360-362` | ADMIN/CONTADOR/SISTEMAS; ADMIN | allowlists distintas para analytics, cuadre fiscal, confirmaciones/diferencias y resolver diferencias | veto de acción |
| `artifacts/api-server/src/routes/permisos.ts:83,106` | cualquier otro rol | rol enviado debe estar en `validRoles`; valores no válidos se rechazan | veto/invariante |
| `artifacts/api-server/src/routes/permisos.ts:136` | SISTEMAS | no puede modificar los permisos del rol SISTEMAS | veto/invariante |
| `artifacts/api-server/src/lib/permisos.ts:307` | no ADMIN | operación protegida de permisos se rechaza | veto de acción |

## API — inventario: permiso por acción y alcance operativo

| Archivo:línea | Rol | Restricción efectiva | Categoría |
|---|---|---|---|
| `artifacts/api-server/src/routes/inventario.ts:147-179` | ADMIN/SUPERVISOR | `resolveReadScope` permite filtro solicitado (la rama SUPERVISOR es independiente del cap retirado) | alcance territorial |
| `artifacts/api-server/src/routes/inventario.ts:159-165` | CAJA | lectura siempre queda en `ubicacionId` asignada; sin ubicación responde error | alcance territorial/veto |
| `artifacts/api-server/src/routes/inventario.ts:167-179` | no ADMIN/CAJA | `TODAS` honra filtro; `PROPIA` fuerza ubicación asignada; sin ubicación produce error | alcance territorial |
| `artifacts/api-server/src/routes/inventario.ts:191-207` | no ADMIN | `checkOperationalScope` solo permite mutar ubicaciones propias; otra ubicación devuelve 403 antes del helper | veto de acción/alcance |
| `artifacts/api-server/src/routes/inventario.ts:395-396` | cualquier rol | listar salidas exige permiso `salidas:ver` y `requiereAdmin` | veto de acción |
| `artifacts/api-server/src/routes/inventario.ts:498-499` | cualquier rol | crear salida extraordinaria exige `salidas:crear` y ADMIN | veto de acción |
| `artifacts/api-server/src/routes/inventario.ts:537-538` | cualquier rol | editar/revertir salida exige `salidas:editar` y ADMIN | veto de acción |
| `artifacts/api-server/src/routes/inventario.ts:627,637-643` | no ADMIN | crear entrada exige `entradas:crear`; ubicación de entrada se valida con `checkOperationalScope` | veto/alcance |
| `artifacts/api-server/src/routes/inventario.ts:1090,1184,1204` | cualquier rol | acciones de entrada requieren `entradas:editar`; operar un rollo fuera de sitio devuelve 403 | veto/alcance |
| `artifacts/api-server/src/routes/inventario.ts:1243,1270` | cualquier rol | vender rollo exige `pos:crear` y ubicación del rollo debe estar en scope | veto/alcance |
| `artifacts/api-server/src/routes/inventario.ts:1308,1328` | cualquier rol | ajustar rollo exige `ajustes:crear` y scope territorial | veto/alcance |
| `artifacts/api-server/src/routes/inventario.ts:1367,1402` | cualquier rol | autorizar ajuste exige `ajustes:autorizar` y scope del movimiento | veto/alcance |
| `artifacts/api-server/src/routes/inventario.ts:1485,1494` | cualquier rol | editar piso exige `inventario:editar` y ubicación propia/permitida | veto/alcance |
| `artifacts/api-server/src/routes/inventario.ts:2084,2138` | cualquier rol | autorizar ajuste pendiente exige permiso y scope del movimiento | veto/alcance |
| `artifacts/api-server/src/routes/inventario.ts:2178,2209,2217` | cualquier rol | ver/autorizar conciliación exige permiso y la ubicación concreta debe pasar scope | veto/alcance |
| `artifacts/api-server/src/routes/inventario.ts:829,964,1004,1025,1130,1444,1529,1656,1691,1791,1917,1956,1988` | cualquier rol | cada endpoint requiere el permiso de módulo/acción literal mostrado (`entradas`, `inventario`, `movimientos`, etc.) | veto de acción |

## API — POS/caja y allowlists adicionales

| Archivo:línea | Rol | Restricción efectiva | Categoría |
|---|---|---|---|
| `artifacts/api-server/src/routes/pos.ts:117-145` | ADMIN vs no ADMIN | `scopedLocation` permite ubicación solicitada solo a ADMIN; los demás quedan en ubicación propia y fuera de ella reciben `LOCATION_FORBIDDEN` | alcance/veto |
| `artifacts/api-server/src/routes/pos.ts:152-166` | ADMIN/CONTADOR/SISTEMAS | solo estos roles pasan la allowlist de operación protegida; los demás no | veto de acción |
| `artifacts/api-server/src/routes/pos.ts:181-202` | ADMIN vs otros | ADMIN puede bypass de permiso; el resto debe tener `puedeVer`/`puedeCrear` del módulo | veto de acción |
| `artifacts/api-server/src/routes/caja-ventas.ts:33-50,71-88` | no ADMIN/SUPERVISOR | `resolveReadScope` aplica ubicación y las respuestas/acciones usan permiso; ADMIN/SUPERVISOR tienen rama de alcance explícita | alcance/veto |
| `artifacts/api-server/src/routes/salidas.ts:100,460-486,625-637` | no ADMIN; CAJA; ADMIN/SUPERVISOR | origen/destino fuera de ubicación, operación CAJA y ramas de salida extraordinaria se rechazan o fuerzan a sitio propio | veto/alcance |
| `artifacts/api-server/src/routes/salidas.ts:748-750` | cualquier rol sin permiso | consulta de salida cliente-venta exige permiso `salidas:ver` | veto de acción |

## API — datos sensibles, credenciales e invariantes

| Archivo:línea | Rol | Restricción efectiva | Categoría |
|---|---|---|---|
| `artifacts/api-server/src/app.ts:43-51` | SUPERVISOR | hook global envuelve cada `res.json` con `omitSupervisorSensitiveFields(body, rol===SUPERVISOR)`; elimina campos sensibles de respuestas para SUPERVISOR | redacción sensible global |
| `artifacts/api-server/src/lib/sensitive-data.ts` | TERMINAL | `omitTerminalSensitiveFields` elimina campos sensibles para respuestas terminales; usado desde inventario | redacción sensible |
| `artifacts/api-server/src/routes/inventario.ts:96, ...` | TERMINAL | rutas que aplican `omitTerminalSensitiveFields` no entregan campos sensibles a TERMINAL | redacción sensible |
| `artifacts/api-server/src/routes/contenedores.ts:221,344` | no ADMIN | `redactEconomicData` elimina valores económicos; ADMIN recibe resumen completo | redacción sensible |
| `artifacts/api-server/src/lib/contenedores-helpers.ts:48-53` | no ADMIN | elimina recursivamente claves de `ECONOMIC_KEYS` | redacción sensible |
| `artifacts/api-server/src/lib/reportes.ts:103-117,153,197` | no autorizado económicamente | reportes sustituyen/omiten valores económicos; rama autorizada conserva reporte | redacción sensible |
| `artifacts/api-server/src/routes/salidas.ts:873,882-889` | no ADMIN | cancelar requiere usuario/password de un ADMIN activo; sesión ADMIN no necesita credenciales adicionales | credencial ADMIN |
| `artifacts/api-server/src/routes/etiquetas.ts:202-219` | ADMIN/BODEGA/SUPERVISOR | acción inicial permite esos roles; no ADMIN debe presentar credenciales ADMIN activas. No equivale a “solo ADMIN puede reimprimir” | credencial ADMIN |
| `artifacts/api-server/src/lib/purga-catalogos.ts:400-433` | ADMIN | purga exige credenciales de ADMIN activo con alcance `TODAS` | credencial ADMIN/invariante |
| `artifacts/api-server/src/routes/permisos.ts:196-200,399-403,416,529,559` | ADMIN | cambios no pueden dejar al sistema sin ADMIN activo con acceso completo; usuarios ADMIN reciben protección especial | invariante ADMIN |

## Frontend — rutas, navegación y acciones concretas

| Archivo:línea | Rol/allowlist | Restricción efectiva | Categoría |
|---|---|---|---|
| `artifacts/mariana-textil/src/App.tsx:149,163,182` | valores `requiredRoles`, `adminOnly`, `allowedRoles` de cada ruta | router no renderiza/permite la ruta cuando el rol no coincide | veto de ruta |
| `artifacts/mariana-textil/src/App.tsx` (configuración de rutas; buscar `requiredRoles`, `allowedRoles`, `adminOnly`) | allowlists literales por ruta | cada entrada de configuración contiene los roles concretos; no es solo la implementación genérica del guard | veto de ruta |
| `artifacts/mariana-textil/src/components/layout/app-navigation.ts:81` | ADMIN/CONTADOR/SISTEMAS | “Cuentas” se muestra solo a esos roles | ocultamiento |
| `artifacts/mariana-textil/src/components/layout/app-navigation.ts:84` | ADMIN | “Alertas” se muestra solo a ADMIN | ocultamiento |
| `artifacts/mariana-textil/src/components/layout/app-navigation.ts:122-126` | `hiddenForRoles`/`allowedRoles` literales | filtra cada elemento de navegación antes de mostrarlo | ocultamiento |
| `artifacts/mariana-textil/src/pages/salidas.tsx:215,219` | ADMIN | pestaña/componente de salidas extraordinarias no se muestra ni activa para otros | ocultamiento/veto |
| `artifacts/mariana-textil/src/pages/entradas-pendientes-costo.tsx:316,322` | ADMIN | query habilitada y página permitida solo a ADMIN | veto |
| `artifacts/mariana-textil/src/pages/configuracion/choferes.tsx:67,221,265` | ADMIN/SISTEMAS; ADMIN | catálogo puede gestionarse por ADMIN/SISTEMAS; acciones sobre chofer inactivo solo ADMIN | veto/ocultamiento |
| `artifacts/mariana-textil/src/pages/auditorias-inventario.tsx:317` | ADMIN | acción de cerrar auditoría solo se muestra a ADMIN | ocultamiento |
| `artifacts/mariana-textil/src/components/salida-venta-cliente-nueva.tsx:26,61` | ADMIN vs demás | ADMIN elige origen; demás quedan con origen propio y selector deshabilitado | alcance/ocultamiento |
| `artifacts/mariana-textil/src/pages/ticket-detail.tsx:420-559` | CAJA/ADMIN | columnas/bloques económicos y de pagos solo aparecen para CAJA o ADMIN | redacción/presentación sensible |
| `artifacts/mariana-textil/src/components/solicitud-pago-dirigido-dialog.tsx:310` | ADMIN vs demás | ADMIN ve “Aplicar pago dirigido”; otros “Enviar solicitud” | veto/ocultamiento |
| `artifacts/mariana-textil/src/pages/entradas.tsx:88,103,201,787,800,943` | ADMIN vs no ADMIN | costos/query y selección de ubicaciones se restringen; no ADMIN queda en sitio propio | sensible/alcance/ocultamiento |
| `artifacts/mariana-textil/src/pages/proveedor-detail.tsx:139` | ADMIN | activar/desactivar proveedor solo ADMIN | veto |
| `artifacts/mariana-textil/src/pages/proveedor-detail.tsx:142` | SUPERVISOR | finanzas de proveedor requiere permiso **y excluye SUPERVISOR** | sensible/ocultamiento |
| `artifacts/mariana-textil/src/pages/proveedores.tsx:86,234,300` | SUPERVISOR; ADMIN | finanzas excluidas para SUPERVISOR; columnas/acciones administrativas solo ADMIN | sensible/ocultamiento |
| `artifacts/mariana-textil/src/pages/cliente-detail.tsx:103-105,326` | SUPERVISOR; ADMIN | crédito, precios y finanzas requieren permiso **y excluyen SUPERVISOR**; acciones administrativas solo ADMIN | sensible/ocultamiento |
| `artifacts/mariana-textil/src/pages/ticket-detail.tsx:119,121,182,197,1000` | CAJA/ADMIN | redirección, controles y acciones cambian por rol; controles ADMIN no se muestran a otros | veto/ocultamiento |
| `artifacts/mariana-textil/src/components/layout/app-layout.tsx:68,75,91-92,126,338,375` | ADMIN/CAJA/TERMINAL | queries ADMIN, navegación CAJA/TERMINAL y campana admin se habilitan/ocultan por rol | presentación/acción |

## Correcciones de interpretación

- `isAdmin` en `reprint-labels-dialog.tsx:82` no se reporta como “imprimir solo ADMIN”: la reimpresión no-ADMIN puede continuar mediante credenciales ADMIN; solo se incluye el gate real de credenciales en `etiquetas.ts`.
- `requireRole` es un gate hardcodeado independiente de permisos/matriz; no se etiqueta como “restricción de matriz”.
- No se tratan declaraciones booleanas aisladas como restricciones: cada fila anterior sigue el uso que produce 403, fuerza scope, omite campos o cambia una acción/render.
- Las exclusiones SUPERVISOR de clientes/proveedores anteriores son independientes y se conservan expresamente.
