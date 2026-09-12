# Auditoría de restricciones literales por rol (runtime)

**Alcance.** Esta es una auditoría de lectura del código que hoy se ejecuta en
`artifacts/api-server/src` y `artifacts/mariana-textil/src`. Las referencias de
archivo y línea son las actuales al hacer la auditoría. No se modificó código
de aplicación, no se consultó la base de datos y no se ejecutaron workflows,
la aplicación o pruebas.

Se reporta una condición solo cuando el rol cambia un resultado observable:

* **Veto/allowlist:** responde 403, impide una transición o limita una ruta.
* **Alcance:** fuerza o rechaza una ubicación.
* **Visibilidad/redacción:** omite datos o controles, aunque la operación
  general esté permitida.
* **Credencial/invariante ADMIN:** requiere una autorización ADMIN adicional o
  evita que se destruya la cuenta de recuperación.
* **Notificación:** selecciona destinatarios o tipos de aviso. No se presenta
  como veto salvo que también exista un guard de acción.

`requierePermiso` y `hasPermission` son la matriz configurable y, por sí
solos, no son una restricción literal reportada aquí. Sí se reporta el rol
literal que se superpone a una comprobación de matriz (por ejemplo, ADMIN
evitando la matriz, o SUPERVISOR vetando una acción aun con permiso).

## Resumen ejecutivo

Los gates hardcodeados no están confinados al frontend:

* El servidor tiene guards directos (`requireRole`, `requiereAdmin`) y
  allowlists para analytics, auditoría, documentos, catálogos, pisos,
  etiquetas, purga y operaciones fiscales.
* `ADMIN` y `SUPERVISOR` tienen lectura amplia de salidas y bypass operativo
  transversal en los helpers generales de inventario. En salidas,
  `canOperate` es transversal para ADMIN, pero exige el sitio asignado a
  SUPERVISOR y a los demás roles no ADMIN; `CAJA`, BODEGA y otros usuarios
  pueden quedar ligados a su sitio. **SUPERVISOR no es equivalente a ADMIN:**
  los mínimos de stock conservan un bypass de escritura exclusivo de ADMIN.
* En salidas, CAJA tiene veto explícito en armado, mostrador, modificación y
  envío de borradores, pero `POST /salidas/venta-cliente` solo comprueba
  origen: una CAJA de su propio sitio no queda vetada por ese literal si la
  matriz le otorga el permiso.
* El servidor impone dos restricciones SUPERVISOR de clientes que no deben
  confundirse con permisos: no puede capturar términos financieros al crear
  clientes y no puede dar de baja ni reactivar clientes, aun cuando tenga
  `clientes.editar`.
* Hay redacción server-side global para SUPERVISOR y redacción específica para
  TERMINAL. Esto protege aunque un componente frontend no oculte algo.
* El frontend agrega veto de ruta, ocultamiento de navegación y controles
  condicionados. Es una consecuencia de UX, no un sustituto de los guards
  server-side.
* Las notificaciones contienen ramas ADMIN/CAJA y destinatarios implícitos,
  pero esos filtros no deben etiquetarse automáticamente como veto de
  negocio.

## 1. Servidor: veto de acción y allowlists

| Ubicación actual | Evidencia breve | Efecto y categoría |
|---|---|---|
| `artifacts/api-server/src/middlewares/auth.ts:119-126` | `requireRole(...roles)`; `if (!req.auth || !roles.includes(req.auth.user.rol)) ... 403` | Guard literal reutilizable por todas las rutas que lo invocan. **Veto.** |
| `artifacts/api-server/src/lib/permisos.ts:297-312` | `requiereAdmin`; `req.auth.user.rol !== "ADMIN"` | Guard no configurable para operaciones reservadas a ADMIN. **Veto.** |
| `artifacts/api-server/src/routes/admin-alertas.ts:11` | `requireRole("ADMIN")` | Todo `/admin/alertas` requiere ADMIN. **Veto.** |
| `artifacts/api-server/src/routes/admin-analytics.ts:71-83` | GET de `/admin/cuentas-destino` permite `ADMIN, CONTADOR, SISTEMAS`; las demás rutas del router caen en `requireRole("ADMIN")` | Analytics, cortes, diferencias y exportaciones tienen allowlist ADMIN; la consulta de cuentas destino permite además CONTADOR/SISTEMAS. **Veto.** |
| `artifacts/api-server/src/routes/admin-analytics.ts:331,360-362` | `requireRole("ADMIN", "CONTADOR", "SISTEMAS")`; confirmaciones/diferencias `ADMIN, CONTADOR`; resolución `ADMIN` | Operación fiscal separa lectura, captura y resolución. **Veto.** |
| `artifacts/api-server/src/routes/cliente-documentos.ts:40-44,64-69,155-156` | `requierePermiso(...), requireRole("ADMIN")` | Listar, cargar, ver y descargar documentos de cliente exigen ADMIN además del permiso de matriz. **Veto/dato sensible.** |
| `artifacts/api-server/src/routes/clientes-admin.ts:22-25` | `GET /clientes/incobrables` usa `requireRole("ADMIN")`; `router.use` en `15-16` solo exige sesión | Solo incobrables es ADMIN-only; no se debe atribuir el guard de línea 24 a todo el router. Las verificaciones SUPERVISOR de las filas siguientes son defensas adicionales. **Veto.** |
| `artifacts/api-server/src/routes/clientes-admin.ts:63-67` | `if (req.auth!.user.rol === "SUPERVISOR") ... "no puede dar de baja"` | SUPERVISOR no puede dar de baja clientes aunque pase `clientes.editar`. **Veto superpuesto a matriz.** |
| `artifacts/api-server/src/routes/clientes-admin.ts:217-221` | `if (req.auth!.user.rol === "SUPERVISOR") ... "no puede reactivar"` | SUPERVISOR no puede reactivar clientes aunque pase `clientes.editar`. **Veto superpuesto a matriz.** |
| `artifacts/api-server/src/routes/clientes.ts:268-285,692-705` | `rol !== "ADMIN" && !permiso?.puedeVer` devuelve la forma operativa sin saldo/límite en lista y detalle | ADMIN bypassea el permiso financiero; otros roles solo reciben finanzas si la matriz lo permite. **Visibilidad.** |
| `artifacts/api-server/src/routes/clientes.ts:298-317` | `rol === "SUPERVISOR" && (diasCredito !== undefined || limiteCredito !== undefined)` | SUPERVISOR no puede capturar términos financieros de un cliente. **Veto de dato sensible, independiente de la matriz.** |
| `artifacts/api-server/src/routes/camionetas.ts:36-47` | `rol !== "ADMIN" && rol !== "SISTEMAS"` | Solo ADMIN/SISTEMAS pueden crear o editar el catálogo de camionetas, además de `camionetas.crear/editar`. **Veto.** |
| `artifacts/api-server/src/routes/choferes.ts:38-53` | misma allowlist ADMIN/SISTEMAS | Solo ADMIN/SISTEMAS pueden crear o editar el catálogo de choferes. **Veto.** |
| `artifacts/api-server/src/routes/locations.ts:162-177` | lista de pisos oculta inactivos para todo rol no ADMIN | ADMIN ve pisos activos e inactivos; los demás solo activos. **Visibilidad.** |
| `artifacts/api-server/src/routes/locations.ts:180-207,209-224` | `if (rol !== "ADMIN") ... "Solo ADMIN administra pisos"` | Crear/editar pisos solo para ADMIN además de `ubicaciones.crear/editar`. **Veto.** |
| `artifacts/api-server/src/routes/auditorias-inventario.ts:40-53,55-71,88-134` | `ROLES = new Set(["ADMIN","SUPERVISOR","BODEGA","SISTEMAS"])`; BODEGA se limita a su ubicación en sitios, cabeceras y detalle | Los demás roles no pueden entrar; BODEGA solo ve/opera auditorías de su propio sitio. **Veto/allowlist/alcance.** |
| `artifacts/api-server/src/routes/auditorias-inventario.ts:276-289` | `rol !== "ADMIN"` al confirmar/aplicar | Confirmar y aplicar auditoría está reservado a ADMIN. **Veto.** |
| `artifacts/api-server/src/routes/stock-minimos.ts:65-78` | `operationalSiteError`; solo `rol === "ADMIN"` retorna sin error | Las escrituras de mínimos conservan bypass transversal exclusivo de ADMIN; el resto debe usar su sitio asignado. No reutilizan el helper de inventario que permite a SUPERVISOR operar transversalmente. **Veto/alcance.** |
| `artifacts/api-server/src/routes/purga.ts:19-21` | `router.use("/purga", requireSession, requireRole("ADMIN"))` | Preflight y borrado de registros inactivos solo ADMIN. **Veto.** |
| `artifacts/api-server/src/routes/pagos-dirigidos.ts:269,304` | `requireRole("ADMIN")` | Aprobar o rechazar solicitudes de pago dirigido solo ADMIN. **Veto.** |
| `artifacts/api-server/src/routes/pagos-dirigidos.ts:194-227` | ADMIN lista todo y aplica; otros requieren finanzas, solo ven sus solicitudes y crean una solicitud en vez de aplicar directamente | El rol cambia el alcance y el flujo de pago dirigido antes de la aprobación ADMIN. **Alcance/veto.** |
| `artifacts/api-server/src/routes/etiquetas.ts:48-56,202-217,238-245,313,342,372` | ADMIN/SUPERVISOR/TODAS pueden pedir sitio; BODEGA y otros quedan en sitio propio; reimpresión permite `ADMIN/BODEGA/SUPERVISOR` con credencial ADMIN para no ADMIN; historial, exportación y alertas exigen ADMIN | Etiquetas separa operación autorizada de auditoría y alertas. **Veto/credencial/alcance.** |
| `artifacts/api-server/src/routes/permisos.ts:74-109` | `if (rol === "ADMIN")`; `validRoles` excluye ADMIN | El rol ADMIN del catálogo no puede modificarse; los objetivos deben ser uno de los otros seis roles válidos. **Invariante/veto.** |
| `artifacts/api-server/src/routes/permisos.ts:128-155` | `SISTEMAS && rol === "SISTEMAS"` y `grantsMissingPermission` | SISTEMAS no puede auto-concederse permisos que no posee. **Invariante/veto.** |
| `artifacts/api-server/src/lib/permisos.ts:121-129,188-197` | `resolvePermiso` y `buildPermissionMatrix` retornan `FULL_ACCESS` directamente para ADMIN | ADMIN bypassea la matriz configurable; no es un permiso almacenado ordinario. **Bypass/visibilidad.** |
| `artifacts/api-server/src/routes/permisos.ts:187-249` | `hasAdminRecoveryAccount`; error “Debe conservarse al menos un ADMIN activo con acceso completo” | No se acepta un cambio de matriz que elimine la cuenta ADMIN de recuperación. **Invariante.** |
| `artifacts/api-server/src/routes/permisos.ts:285-289,352-362,390-426,518-539,542-568` | `user.rol === "ADMIN"` / `lockedUser?.rol === "ADMIN"` | ADMIN no puede consultar/modificar overrides explícitos como configuración ordinaria; la regla se aplica tanto al crear/modificar como al eliminar un override. **Invariante/veto.** |

## 2. Servidor: usuarios, rol global y recuperación

| Ubicación actual | Evidencia breve | Efecto y categoría |
|---|---|---|
| `artifacts/api-server/src/routes/users.ts:27-42` | `DEFAULT_QUERY_SCOPE`: ADMIN/SUPERVISOR/SISTEMAS/CONTADOR=`TODAS`; TERMINAL/BODEGA=`PROPIA`; CAJA=`TODAS` | Defaults de alcance por rol. El default no sustituye los guards de ubicación posteriores. **Alcance.** |
| `artifacts/api-server/src/routes/users.ts:82-100` | roles globales ADMIN/SISTEMAS/CONTADOR rechazan ubicación; demás roles requieren una ubicación | Invariante de asignación de cuentas. **Alcance/invariante.** |
| `artifacts/api-server/src/routes/users.ts:119-151` | `role === "ADMIN" && actor.rol !== "ADMIN"` | Solo ADMIN puede crear cuentas ADMIN. También fuerza `TODAS` y ubicación nula para roles globales en `144-170`. **Veto/invariante.** |
| `artifacts/api-server/src/routes/users.ts:227-257` | actor no ADMIN no puede modificar cuenta ADMIN ni asignar rol ADMIN | Impide modificar o promover a ADMIN fuera de ADMIN. **Veto.** |
| `artifacts/api-server/src/routes/users.ts:260-275` | actor no puede cambiar su propio rol (`"No puedes modificar tu propio rol"`) | Protección de auto-degradación/cambio de rol. **Veto.** |
| `artifacts/api-server/src/routes/users.ts:278-319` | `finalRole` global fuerza ubicación nula y `TODAS`; SUPERVISOR también fuerza `TODAS` | Cambiar rol recalcula invariantes de sitio y alcance. **Alcance/invariante.** |
| `artifacts/api-server/src/routes/users.ts:324-375` | `hasAdminRecoveryAccount`; “Debe conservarse al menos un ADMIN activo” | No permite desactivar/degradar/eliminar la última cuenta ADMIN recuperable. **Invariante.** |
| `artifacts/api-server/src/lib/purga-catalogos.ts:397-405,415-441` | SQL busca `rol='ADMIN' AND activo=true AND alcance_consulta='TODAS'`; luego valida credenciales ADMIN | La purga preserva un ADMIN de recuperación y, para productos, pide credenciales de ADMIN activo. **Invariante/credencial.** |

## 3. Servidor: alcance territorial y operaciones de inventario

### Helpers que se propagan a varios endpoints

| Ubicación actual | Evidencia breve | Consecuencia |
|---|---|---|
| `artifacts/api-server/src/routes/inventario.ts:147-179` | `resolveReadScope`: ADMIN/SUPERVISOR retornan el filtro pedido; CAJA retorna siempre su sitio; `PROPIA` fuerza asignación; `TODAS` conserva el filtro | Regla central de lecturas de inventario, reportes, proveedores y equipos. **Alcance.** |
| `artifacts/api-server/src/routes/inventario.ts:191-207` | `checkOperationalScope`: ADMIN/SUPERVISOR retornan `null`; demás roles deben coincidir con su `ubicacionId` | Regla central de mutaciones. SUPERVISOR sí tiene bypass operativo transversal aquí; stock mínimo es una excepción ADMIN-only documentada arriba. **Alcance/veto.** |
| `artifacts/api-server/src/routes/equipos.ts:42-76` | si no ADMIN y `PROPIA`, fuerza ubicación; operaciones comparan todos los IDs con la asignada | Equipos añade una capa explícita de alcance `PROPIA` antes de los helpers generales. **Alcance/veto.** |
| `artifacts/api-server/src/routes/caja-ventas.ts:23-51,62-89` | compara `ubicacionId` resuelta con la solicitada; redacción adicional `rol === "SUPERVISOR"` | Ventas por tienda solo en scope; SUPERVISOR recibe redacción sensible. **Alcance/visibilidad.** |
| `artifacts/api-server/src/routes/reportes.ts:16-21,30-40,49-55,97-110` | `scopedLocations` usa `resolveReadScope`; `buildReport(..., rol === "ADMIN")` alimenta catálogo, sección y exportación | Los reportes heredan scope y solo ADMIN recibe acceso económico completo. **Alcance/visibilidad.** |
| `artifacts/api-server/src/routes/dashboard.ts:29-49,133-137` | ADMIN/SUPERVISOR pueden pedir una ubicación; `PROPIA` fuerza la asignada; TERMINAL recibe redacción sensible | Dashboard aplica alcance y no entrega costos al TERMINAL. **Alcance/redacción.** |
| `artifacts/api-server/src/routes/proveedores.ts:483-497,828-842` | `resolveReadScope(req.auth!)` antes de compras/pagos | Detalle y métricas históricas de proveedor quedan en la ubicación resuelta. **Alcance.** |
| `artifacts/api-server/src/routes/proveedores.ts:385-390` | cambiar `activo` exige `rol === "ADMIN"` | Activar/desactivar proveedor no se concede por la matriz general. **Veto superpuesto a matriz.** |
| `artifacts/api-server/src/routes/viajes.ts:78-187` | `alcanceConsulta === "PROPIA"` fija catálogo, documentos elegibles, creación, listado y detalle al sitio asignado | El flujo de viajes hereda el scope por rol, aunque el helper compare alcance y no el literal del rol. **Alcance.** |

### Endpoints y ramas de inventario

| Ubicación actual | Evidencia breve | Efecto y categoría |
|---|---|---|
| `artifacts/api-server/src/routes/inventario.ts:395-399,498-502,537-541` | `requiereAdmin` en listar/crear/editar salidas extraordinarias | Las operaciones extraordinarias siguen siendo ADMIN-only además del permiso `salidas`. **Veto.** |
| `artifacts/api-server/src/routes/inventario.ts:624-650` | entrada usa `checkOperationalScope`; no ADMIN/SUPERVISOR sobrescribe a su sitio asignado | ADMIN/SUPERVISOR pueden elegir sitio permitido por el helper; otros quedan en sitio propio. **Alcance.** |
| `artifacts/api-server/src/routes/inventario.ts:667-684,773-786` | BODEGA/SUPERVISOR no deben enviar costo positivo; se guarda `costoUnitario:null` y `allowPendingCosts` | BODEGA/SUPERVISOR capturan entradas con costo pendiente; otros deben enviar costo válido. **Veto/dato financiero.** |
| `artifacts/api-server/src/routes/inventario.ts:792,945-950,1167,1226,1350,1423` | `omitTerminalSensitiveFields(response, rol !== "ADMIN")` | Respuestas de entrada y movimientos omiten campos sensibles para todo rol no ADMIN según el helper usado. La redacción concreta de costo/precio la define `sensitive-data.ts`; no es un permiso de escritura. **Redacción.** |
| `artifacts/api-server/src/routes/inventario.ts:999-1031,1087-1096` | tres endpoints de costo pendiente hacen `rol !== "ADMIN"` y 403 | Contar, listar y capturar costos pendientes son ADMIN-only, aunque exista permiso `entradas`. **Veto.** |
| `artifacts/api-server/src/routes/inventario.ts:1240-1255` | vender rollo: `rol !== "ADMIN"` y “debe registrarse mediante ticket POS” | La venta directa de rollo queda reservada a ADMIN; la venta operativa ordinaria debe pasar por POS. **Veto.** |
| `artifacts/api-server/src/routes/inventario.ts:1364-1400` | movimiento con `motivoSalidaExtraordinaria` exige `rol === "ADMIN"` | Revertir salida extraordinaria es ADMIN-only; el resto de reversiones además pasa scope. **Veto/alcance.** |
| `artifacts/api-server/src/routes/inventario.ts:1441-1473,1539-1547` | detail/listado de rollos omite terminal; detalle permite campos económicos solo ADMIN o CAJA | TERMINAL y otros roles reciben menos campos; CAJA conserva campos en esos endpoints. **Redacción.** |
| `artifacts/api-server/src/routes/inventario.ts:1653-1681` | CAJA sin sitio recibe 403; para CAJA el catálogo filtra `id = auth.user.ubicacionId` | CAJA solo puede seleccionar/ver su sitio operativo. **Alcance/veto.** |
| `artifacts/api-server/src/routes/inventario.ts:1788-1857` | `resolveReadScope`; `omitTerminalSensitiveFields(..., rol !== "ADMIN")` | Existencias agrupadas/detalladas respetan scope; respuestas omiten datos sensibles para TERMINAL/no ADMIN según helper. **Alcance/redacción.** |
| `artifacts/api-server/src/routes/inventario.ts:1914-2004` | tres guards `incluirUbicacionesInactivas && rol !== "ADMIN"` | Kardex y filtros/exportación solo permiten incluir ubicaciones inactivas a ADMIN. **Veto de consulta.** |
| `artifacts/api-server/src/routes/inventario.ts:2078-2142` | pendientes y revisión usan `resolveReadScope`/`checkOperationalScope` | La autorización de ajustes queda ligada al sitio resuelto, no solo al permiso. **Alcance.** |
| `artifacts/api-server/src/routes/inventario.ts:2206-2221` | recalcular exige par concreto y `checkOperationalScope` | Quien no sea ADMIN ni SUPERVISOR puede recalcular únicamente según el scope operativo; ADMIN/SUPERVISOR pueden hacerlo transversalmente. **Alcance.** |

## 4. Servidor: salidas, POS y trazabilidad

| Ubicación actual | Evidencia breve | Efecto y categoría |
|---|---|---|
| `artifacts/api-server/src/routes/salidas.ts:283-307` | `CAJA` se fija al destino propio; ADMIN/TODAS no fija origen; sin sitio se rechaza | Lectura de ventas pendientes se adapta al rol y evita el bypass de alcance legado de CAJA. **Alcance.** |
| `artifacts/api-server/src/routes/salidas.ts:309-346` | `canRead`: CAJA solo destino; ADMIN/SUPERVISOR/TODAS global; otros origen/destino propios | Visibilidad de salidas depende de rol y sitio. **Alcance.** |
| `artifacts/api-server/src/routes/salidas.ts:321-337` | `rejectCajaMutation`; `canOperate` solo ADMIN o sitio asignado; recepción global solo ADMIN+TODAS | CAJA tiene veto en las mutaciones que invocan `rejectCajaMutation`; ADMIN opera transversalmente y SUPERVISOR/otros no ADMIN solo desde sitio permitido. La excepción venta-cliente está documentada en `97-101`. **Veto/alcance.** |
| `artifacts/api-server/src/routes/salidas.ts:458-497,611-641` | list/export: ADMIN/SUPERVISOR/TODAS sin filtro; CAJA fuerza destino; demás requieren ubicación | Lista y exportación son territoriales. **Alcance.** |
| `artifacts/api-server/src/routes/salidas.ts:505-521,535-557` | CAJA no puede armar ni crear mostrador; origen exige ADMIN o ubicación asignada | Veto de esos endpoints y scope de origen. No se generaliza a toda salida: `POST /salidas/venta-cliente` tiene su propia comprobación en la fila siguiente. **Veto/alcance.** |
| `artifacts/api-server/src/routes/salidas.ts:97-101` | crear/enviar venta a cliente exige ADMIN o que `ubicacionId` coincida con el origen; no invoca `rejectCajaMutation` | Venta cliente no permite a un rol no ADMIN operar desde otro origen; CAJA de su propio origen no queda vetada por este literal si tiene el permiso de matriz. **Alcance/veto/gap observable.** |
| `artifacts/api-server/src/routes/salidas.ts:674-693,833-863` | recepción global solo ADMIN+TODAS; los demás deben ser destino asignado | Recibir una salida está limitado territorialmente. **Alcance.** |
| `artifacts/api-server/src/routes/salidas.ts:783-817` | En modificar/enviar borrador CAJA recibe 403; se llama `requireSalidaAccess(...,"origin")` | Esos endpoints dejan CAJA en recepción; no debe extrapolarse al endpoint venta-cliente de la fila `97-101`. **Veto/alcance.** |
| `artifacts/api-server/src/routes/salidas.ts:866-893` | CAJA no cancela; no ADMIN debe verificar usuario/password ADMIN activo | Cancelación exige permiso, acceso a origen/destino y autorización ADMIN adicional cuando la sesión no es ADMIN. **Veto/credencial.** |
| `artifacts/api-server/src/routes/pos.ts:117-132` | `scopedLocation`: ADMIN debe seleccionar sitio; los demás usan `ubicacionId` propia | POS no permite a un rol no ADMIN elegir otro sitio. **Alcance.** |
| `artifacts/api-server/src/routes/pos.ts:140-169` | operación local no ADMIN debe coincidir; lectura privilegiada `ADMIN, CONTADOR, SISTEMAS`; otros necesitan POS/cobros | Ticket puede tener lectores fiscales/técnicos globales, sin que eso les dé permiso operativo POS. **Veto/alcance.** |
| `artifacts/api-server/src/routes/pos.ts:172-202` | ADMIN bypass; demás deben satisfacer al menos un permiso | Bypass explícito de ADMIN sobre la matriz en helpers POS. **Veto superpuesto a matriz.** |
| `artifacts/api-server/src/routes/pos.ts:390-427,518-564,625-664,696` | `rol === "TERMINAL"` decide costos y redacción de ticket/listados/detalle | TERMINAL opera tickets sin recibir datos sensibles de costos/precios. **Redacción.** |
| `artifacts/api-server/src/routes/pos.ts:645-654` | `privileged = ["ADMIN","CONTADOR","SISTEMAS"]`; otros pasan permiso + scope | Lectura de ticket tiene allowlist global e indirecta por trazabilidad vinculada. **Veto/alcance.** |
| `artifacts/api-server/src/routes/pos.ts:671-708` | no ADMIN verifica credenciales ADMIN antes de cancelar | Cancelar ticket exige autorización ADMIN adicional; luego se comprueba sitio. **Credencial/alcance.** |
| `artifacts/api-server/src/routes/pos.ts:893-910` | `rol !== "ADMIN"` devuelve 403 en historial de caja | Historial de sesiones de caja solo ADMIN. **Veto.** |
| `artifacts/api-server/src/lib/venta-trace-access.ts:1-23` | `canReadLinkedVentaTrace`: ADMIN o permiso/relación; `canDeliverVenta`: ADMIN o sitio de origen | Helper indirecto controla lectura/entrega de trazabilidad ligada a venta. **Alcance/veto.** |

## 5. Servidor: datos económicos y sensibles

| Ubicación actual | Evidencia breve | Efecto y categoría |
|---|---|---|
| `artifacts/api-server/src/app.ts:43-51` | wrapper global de `res.json` llama `omitSupervisorSensitiveFields(body, rol === "SUPERVISOR")` | Toda respuesta JSON pasa por redacción SUPERVISOR cuando hay sesión con ese rol. **Redacción global.** |
| `artifacts/api-server/src/lib/sensitive-data.ts:8-19,22-88,91-114` | `omitTerminalSensitiveFields`; `omitSupervisorSensitiveFields`; key matcher para costo, precio, margen, crédito, pagos, INE, etc. | TERMINAL pierde campos económico-financieros; SUPERVISOR pierde además crédito, pagos, documentos y muchas claves sensibles. **Redacción.** |
| `artifacts/api-server/src/routes/productos.ts:334-339,756-760` | response `omitTerminalSensitiveFields(... rol === "TERMINAL")` | Listado y detalle de productos no entregan costos/precios al TERMINAL. **Redacción.** |
| `artifacts/api-server/src/routes/productos.ts:342-370,764-785` | `canEditProductColorHex` solo retorna true para ADMIN | `colorHex` no se puede capturar/editar por otro rol aunque pase `productos.crear/editar`. **Veto de campo.** |
| `artifacts/api-server/src/lib/product-color.ts:1-5` | `return role === "ADMIN"` | Helper indirecto que implementa el gate ADMIN del campo hexadecimal. **Veto de dato.** |
| `artifacts/api-server/src/routes/contenedores.ts:48-58,199-222,229-249` | `admin: rol === "ADMIN"`; BODEGA recibe `sitioId`; disponibles permite sitio libre a ADMIN/SUPERVISOR | ADMIN conserva economía completa; BODEGA queda en sitio propio; ADMIN/SUPERVISOR pueden elegir sitio para entradas. **Alcance/redacción.** |
| `artifacts/api-server/src/routes/contenedores.ts:221,344` y `artifacts/api-server/src/lib/contenedores-helpers.ts:39-56` | `redactEconomicData` elimina `costo`, `costoTotal`, `costoUnitario`, `costoPromedio`, `participacion` | Resumen/listado económico se redacta para no ADMIN. **Redacción.** |
| `artifacts/api-server/src/lib/reportes.ts:105-161,164-202` | `source.economic === true`, key matcher; `return economic ? report : redactEconomic(report)` | Reportes no económicos eliminan bloques/columnas/KPI marcados como económicos; `economic` solo es true para ADMIN desde `routes/reportes.ts`. **Redacción.** |
| `artifacts/api-server/src/routes/proveedores.ts:221-276` | `hasFinanzas = finanzasPerm?.puedeVer`; sin permiso retorna `presentProveedor` sin métricas | Métricas de proveedor dependen de permiso; el hook global también protege SUPERVISOR. **Visibilidad.** |
| `artifacts/api-server/src/routes/pos.ts:392,426,518-564,630-663` | `rol === "TERMINAL"` controla `includeCosts` y `omitTerminalTicketSensitiveFields` | Redacción terminal en crear/listar/pendientes/detalle de tickets. **Redacción.** |

## 6. Servidor: notificaciones (destinatarios, no necesariamente veto)

Estas ramas son relevantes para explicar quién recibe/ve un aviso, pero no se
deben convertir en una afirmación de que el rol no puede realizar la acción
de negocio.

| Ubicación actual | Evidencia breve | Consecuencia |
|---|---|---|
| `artifacts/api-server/src/routes/notificaciones.ts:29-35` | ADMIN ve destinatario nulo o propio; no ADMIN solo `destinatarioUsuarioId = user.id` | Filtro de destinatarios de notificaciones de sistema. **Notificación/visibilidad.** |
| `artifacts/api-server/src/routes/notificaciones.ts:134-151,153-192` | no ADMIN cuenta solicitudes propias y sistema; ADMIN añade alertas, solicitudes pendientes y crédito | El contador de no leídas tiene colas distintas por rol. **Notificación.** |
| `artifacts/api-server/src/routes/notificaciones.ts:195-222,244-255,306-379` | CAJA consulta tickets pendientes de su sitio; rama ADMIN agrega alertas y crédito | Feed con eventos de operación local para CAJA y colas administrativas para ADMIN. **Notificación/alcance.** |
| `artifacts/api-server/src/routes/notificaciones.ts:404-435,437-525` | no ADMIN recibe `sistema` pero listas de crédito quedan vacías; ADMIN recibe aging/crédito | La respuesta cambia por audiencia; no prueba que una acción financiera esté permitida o prohibida. **Notificación/visibilidad.** |
| `artifacts/api-server/src/routes/notificaciones.ts:541-583` | ADMIN marca crédito global; todos marcan solo sistema visible; lectura individual aplica el mismo filtro | Marcar avisos respeta destinatario y rol ADMIN. **Notificación.** |
| `artifacts/api-server/src/lib/stock-minimos.ts:145-166` | destinatarios por `rol IN ("ADMIN","SUPERVISOR")` | Destinatarios de alertas de stock; no es un veto de configuración/operación. **Notificación.** |
| `artifacts/mariana-textil/src/components/notifications-bell.tsx:223` | solo `isAdmin` recibe la acción de pago dirigido en el aviso | El control de la campana refleja la allowlist de resolución; la API sigue siendo la autoridad. **Notificación/ocultamiento.** |
| `artifacts/mariana-textil/src/components/notification-audio-controller.tsx:328` | audio de avisos solo se activa si `role === CAJA` | Comportamiento de notificación, no permiso adicional de negocio. **Notificación.** |

## 7. Frontend: guards de ruta y navegación

| Ubicación actual | Evidencia breve | Consecuencia |
|---|---|---|
| `artifacts/mariana-textil/src/App.tsx:103-115,148-188` | `requiredRoles`, `adminOnly`, `allowedRoles`; `includes(user.rol)` y `user.rol !== "ADMIN"` | `ProtectedRoute` no renderiza secciones cuando falla la allowlist; el permiso de módulo solo es la segunda condición. **Veto de ruta.** |
| `artifacts/mariana-textil/src/App.tsx:518-537` | cuentas destino con `allowedRoles/requiredRoles=["ADMIN","CONTADOR","SISTEMAS"]` | La ruta de cuentas destino se limita a esos roles. **Veto de ruta.** |
| `artifacts/mariana-textil/src/App.tsx:549-559` | `<ProtectedRoute ... adminOnly />` para Alertas y Notificaciones | Pantallas administrativas solo ADMIN. **Veto de ruta.** |
| `artifacts/mariana-textil/src/App.tsx:580-587` | ticket admite allowlist `ADMIN, CONTADOR, SISTEMAS` además de módulos POS/caja/salidas | La ruta frontend de ticket tiene allowlist técnica; el servidor sigue aplicando sus propios guards y scope. **Veto de ruta.** |
| `artifacts/mariana-textil/src/components/layout/app-navigation.ts:29-43,81-87,109-135` | `allowedRoles`, `hiddenForRoles`; Cuentas ADMIN/CONTADOR/SISTEMAS, Alertas ADMIN, Configuración oculta a CONTADOR | Oculta navegación por rol y luego por permisos. **Ocultamiento.** |
| `artifacts/mariana-textil/src/components/layout/app-layout.tsx:59-76,80-99,126-140,301-375` | queries de costos/alertas solo ADMIN; scope del header; navegación/campana cambia para CAJA/TERMINAL | Evita consultas frontend innecesarias y adapta shell operativo; no reemplaza el servidor. **Ocultamiento/alcance.** |
| `artifacts/mariana-textil/src/lib/home-route.ts:4-13` | TERMINAL→`/pos`, CAJA→`/cobros`, ADMIN→`/caja/tiempo-real` | Redirección inicial por rol antes de consultar el resto de permisos. **Veto/flujo.** |
| `artifacts/mariana-textil/src/lib/location-scope.tsx:27-37` | PROPIA, TERMINAL o CAJA siempre retornan sitio asignado | Selector global no permite cambiar ubicación a esos usuarios. **Alcance.** |
| `artifacts/mariana-textil/src/lib/permisos.ts:40-48` | `if (user.rol === "ADMIN") return true` | ADMIN tiene bypass frontend de la matriz; los demás consultan permisos/overrides. **Veto/bypass.** |

## 8. Frontend: acciones, alcance y presentación

| Ubicación actual | Evidencia breve | Consecuencia |
|---|---|---|
| `artifacts/mariana-textil/src/pages/entradas-pendientes-costo.tsx:316-322` | query `enabled: user?.rol === "ADMIN"` y guard de página | Vista de pendientes de costo solo ADMIN. **Veto.** |
| `artifacts/mariana-textil/src/pages/entradas.tsx:88-103,201,787-800,943` | `showCost`/query solo ADMIN; no ADMIN usa ubicación propia; selector/fallback y columnas de costo condicionados | Costos y selector global se ocultan/restringen para no ADMIN. **Redacción/alcance.** |
| `artifacts/mariana-textil/src/pages/inventario.tsx:39-45,478` | CAJA fija `effectiveUbicacionId`; controles de CAJA separados | Inventario frontend refleja scope fijo de CAJA. **Alcance/ocultamiento.** |
| `artifacts/mariana-textil/src/pages/dashboard.tsx:9-17,55-89` | ADMIN puede consultar sitio seleccionado y ve tarjetas globales; otros reciben ubicación propia y no esas tarjetas | Dashboard frontend restringe selector, resumen y presentación por rol. **Alcance/ocultamiento.** |
| `artifacts/mariana-textil/src/pages/movimientos.tsx:149-161,432` | filtro de ubicación para ADMIN/TODAS; bloques adicionales ADMIN/CONTADOR/SISTEMAS y acción ADMIN | Selector, filtros y acciones de movimientos dependen de rol/scope. **Alcance/ocultamiento.** |
| `artifacts/mariana-textil/src/pages/stock-minimos.tsx:82-110` | excluye CAJA/TERMINAL; habilita escritura para ADMIN o SUPERVISOR+TODAS; edición de sitio para ADMIN o sitio propio | UI refleja la diferencia entre lectura, edición y scope de mínimos. **Veto/alcance.** |
| `artifacts/mariana-textil/src/pages/reportes.tsx:49-76` | `allowedTabs` elimina para no ADMIN utilidad, compras, clientes, pagos dirigidos, comparativo y diferencias | Reportes frontend reserva esas pestañas a ADMIN. **Ocultamiento/veto de ruta.** |
| `artifacts/mariana-textil/src/pages/salidas.tsx:65-121,183-219,250-355` | CAJA no carga filtros/mutaciones; tabs extraordinarias y componente solo ADMIN | CAJA queda como recepción y ADMIN ve extraordinarias. **Veto/ocultamiento.** |
| `artifacts/mariana-textil/src/pages/pos.tsx:439` | `canChooseLocation = currentUser.rol === ADMIN` | Selector de ubicación para crear ticket solo ADMIN. **Alcance/ocultamiento.** |
| `artifacts/mariana-textil/src/pages/salida-nueva.tsx:73-94,339-345` y `components/salida-venta-cliente-nueva.tsx:26,61` | ADMIN puede elegir origen; demás reciben origen propio y selector deshabilitado | UI aplica scope de origen. **Alcance.** |
| `artifacts/mariana-textil/src/pages/salida-detail.tsx:100-154,448-475` | ADMIN/origen/destino calcula cancelación; no ADMIN muestra credenciales ADMIN | Control de cancelar combina rol, permiso, sitio y credencial. **Veto/alcance/credencial.** |
| `artifacts/mariana-textil/src/pages/ticket-detail.tsx:119-197,420-559,1000-1013` | CAJA redirige a cobros; ADMIN cambia controles; tablas económicas solo CAJA/ADMIN; no ADMIN solicita credenciales | Presentación y cancelación de tickets cambian por rol. **Redacción/veto/credencial.** |
| `artifacts/mariana-textil/src/components/salida-mostrador.tsx:36-104` | ADMIN puede escoger; no ADMIN inicializa origen propio | Selector de salida mostrador refleja scope. **Alcance.** |
| `artifacts/mariana-textil/src/components/solicitud-pago-dirigido-dialog.tsx:310` y `pages/pagos-dirigidos.tsx:45,176` | ADMIN “Aplicar pago dirigido”; otros “Enviar solicitud”; solo ADMIN ve resolver pendientes | Frontend distingue aplicar versus solicitar; la autorización real está en API. **Veto/ocultamiento.** |
| `artifacts/mariana-textil/src/pages/cliente-detail.tsx:103-110,326,434-435` | crédito/precios/finanzas excluyen SUPERVISOR; acciones y credenciales ADMIN | SUPERVISOR no ve datos financieros en detalle; acciones administrativas son ADMIN. **Redacción/ocultamiento.** |
| `artifacts/mariana-textil/src/pages/clientes.tsx:51-53,111,143,160,230` | finanzas/crédito excluyen SUPERVISOR; incobrables, columnas y acciones ADMIN | Lista de clientes oculta finanzas y gestión administrativa. **Redacción/ocultamiento.** |
| `artifacts/mariana-textil/src/pages/proveedores.tsx:85-86,234,300` y `pages/proveedor-detail.tsx:138-142` | finanzas excluidas para SUPERVISOR; activar/desactivar ADMIN | Proveedores separa datos financieros de acciones de catálogo. **Redacción/veto.** |
| `artifacts/mariana-textil/src/pages/productos.tsx:210-212,415,458` | no SUPERVISOR ve precios; acciones ADMIN | Precios y administración del producto se ocultan según rol. **Redacción/ocultamiento.** |
| `artifacts/mariana-textil/src/pages/producto-detail.tsx:173-202,370-466,537-611` | TERMINAL/SUPERVISOR no ven costos/precios; `colorHex` solo ADMIN; borrado pide credencial ADMIN | UI refleja redacción y gate del color/borrado. **Redacción/veto/credencial.** |
| `artifacts/mariana-textil/src/pages/rollo-detail.tsx:32-35,210-220,252-266,299-350` | costo total, columna de acciones, reversión y enlace a historial de etiquetas quedan para ADMIN; reimpresión depende de permisos | Detalle de rollo separa economía/auditoría ADMIN de la operación de impresión. **Redacción/veto/ocultamiento.** |
| `artifacts/mariana-textil/src/pages/contenedores/index.tsx:40-41,144-331,575-598,719-828` y `detail.tsx:178-180,531-662` | `isAdmin` controla costos, gráficas, campos y acciones; crear/editar/cancelar combina permiso con ADMIN | Economía de contenedores solo ADMIN y acciones sensibles se ocultan. **Redacción/veto.** |
| `artifacts/mariana-textil/src/pages/etiquetas.tsx:58,97,172,239-316` y `components/reprint-labels-dialog.tsx:82,211-240,456-460` | historial/usuarios/alertas solo ADMIN; reimpresión no ADMIN pide credenciales ADMIN | No debe interpretarse como “solo ADMIN imprime”: la reimpresión permitida por API incluye BODEGA/SUPERVISOR con credencial. **Veto/credencial/redacción.** |
| `artifacts/mariana-textil/src/pages/auditorias-inventario.tsx:317,543` | botón de cerrar solo ADMIN; pie indica autorización ADMIN | UI no ofrece cierre a otros roles. **Ocultamiento.** |
| `artifacts/mariana-textil/src/pages/ajustes.tsx:43,126,231,425` | consultas/acciones marcadas `isAdmin` | Vista y controles de ajustes administrativos quedan ocultos/deshabilitados fuera de ADMIN. **Ocultamiento.** |
| `artifacts/mariana-textil/src/pages/configuracion/camionetas.tsx:59,197,251` y `choferes.tsx:67,221,265` | acciones de inactivos y gestión de catálogo separadas por ADMIN/SISTEMAS o ADMIN | UI refleja las allowlists server-side. **Veto/ocultamiento.** |
| `artifacts/mariana-textil/src/pages/usuarios.tsx:46,270-276,363-394` | no ADMIN no edita cuenta ADMIN; solo ADMIN ve opciones ADMIN/SISTEMAS; roles globales fuerzan `TODAS` | UI de usuarios refleja protección de cuentas y asignación de alcance. **Veto/invariante/alcance.** |
| `artifacts/mariana-textil/src/pages/permisos.tsx:164-168,255` | selector excluye ADMIN; usuarios ADMIN no reciben overrides | Frontend no ofrece modificar la matriz ADMIN ni overrides ADMIN. **Invariante.** |
| `artifacts/mariana-textil/src/pages/caja/cuenta-destino-detalle.tsx:407-414` | historial/confirmación visible a CONTADOR/ADMIN; resolver diferencia solo ADMIN | Presentación fiscal separa lectura/captura/resolución. **Ocultamiento/veto.** |
| `artifacts/mariana-textil/src/pages/cobros.tsx:1780-1806` | cartera por permiso; historial de cortes solo ADMIN | Navegación de caja distingue cartera e historial administrativo. **Ocultamiento.** |

## 9. Helpers y referencias que se excluyeron o se trataron con cuidado

### Incluidos indirectamente

* `resolveReadScope`, `checkOperationalScope`, `resolveEquiposReadScope`,
  `checkEquiposOperationalScope`, `scopedLocation`, `canRead` y
  `canOperate` se incluyeron porque su retorno cambia qué sitios puede leer o
  mutar el usuario.
* `omitSupervisorSensitiveFields`, `omitTerminalSensitiveFields`,
  `redactEconomicData`, `redactEconomic` y `canEditProductColorHex` se
  incluyeron porque cambian datos o campos observables.
* `requireRole` se incluyó como guard independiente, aunque la ruta tenga
  también `requierePermiso`.

### Excluidos de la lista de restricciones

* `role="..."` de HTML/ARIA, nombres de roles en tipos, enums, etiquetas,
  auditoría, textos, seeds, fixtures, contratos y pruebas.
* Valores de dominio como `CAJA_FISICA`, `BODEGA` en `tipo` de ubicación,
  estados de rollo y categorías de pago cuando no se comparan con el rol de
  la sesión.
* `requierePermiso`/`hasPermission` aislados y la configuración de la matriz:
  son la fuente configurable de permisos, no hardcodes de rol. Se mantuvieron
  cuando una condición de rol les añade bypass, veto o redacción.
* `isAdmin`/`isCaja`/`isTerminal` que solo muestran un nombre, color, texto o
  formato sin cambiar una consulta, dato, acción o ruta.
* Las ramas de notificación de la sección 6 no se convirtieron en vetoes.

### Cobertura de búsqueda

Se enumeraron los archivos runtime de ambas aplicaciones y se buscaron
comparaciones `rol/role ===`, `rol/role !==`, allowlists (`includes`, `Set`,
`requireRole`), `requiereAdmin`, `adminOnly`, `allowedRoles`,
`requiredRoles`, `hiddenForRoles`, helpers de alcance y helpers de redacción.
Después se revisaron los usos indirectos en rutas y componentes. Tests,
contratos, fixtures y seeds no son parte del inventario runtime salvo cuando
el comportamiento se explicó explícitamente por una referencia runtime.

## 10. Lectura correcta de los puntos potencialmente ambiguos

1. **SUPERVISOR y clientes:** las dos ramas de `clientes-admin.ts` son vetoes
   efectivos de baja/reactivación, no una inferencia del frontend. La creación
   de clientes añade además el veto de `diasCredito`/`limiteCredito`.
2. **SUPERVISOR e inventario:** `checkOperationalScope` lo trata como
   transversal para operaciones existentes; `stock-minimos.ts` deliberadamente
   no lo reutiliza y conserva ADMIN-only para escrituras.
3. **Etiquetas:** BODEGA/SUPERVISOR pueden iniciar reimpresión si aportan
   credenciales ADMIN válidas; historial/exportación/alertas sí son ADMIN-only.
4. **Notificaciones:** que ADMIN vea una cola o que un aviso se destine a
   ADMIN/SUPERVISOR no prueba por sí solo que otro rol tenga prohibida la
   operación relacionada.
5. **Frontend versus servidor:** ocultar un botón/ruta solo describe la
   consecuencia frontend. Todo veto de seguridad relevante debe leerse en el
   guard server-side correspondiente.