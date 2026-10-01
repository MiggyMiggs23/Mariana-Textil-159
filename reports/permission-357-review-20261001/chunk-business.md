# Revisión business — permisos 357 (histórico)

Cobertura exacta: **179 IDs**, **30 módulo/acción**, 16 módulos. A=173 celdas; B=0; C=6.

No se modificaron código de aplicación, permisos, DB ni workflows; no se hicieron solicitudes a DB/API ni pruebas runtime. Los roles concedidos/denegados son exclusivamente los de effective-matrices.json histórico (incluye el usuario auditado), no inferencias sobre producción.

Fuente API: artifacts/api-server/dist-driver-phones-20261001/index.mjs.map. Fuente UI: reports/sidebar-order-20261001/frozen-root. Las citas API/UI usan la convención documentada en JSON. Diferencias completas frente a HEAD/working tree en chunk-business-head-comparison.json; no se sustituyó evidencia activa por HEAD.

Comparación: 206 archivos relevantes, 16 diferentes de git HEAD, 16 diferentes del árbol de trabajo; 0 discrepancias API sourcemap/frozen. Archivos distintos de HEAD: artifacts/api-server/src/routes/index.ts; artifacts/api-server/src/lib/inventario.ts; artifacts/api-server/src/lib/credit-movement-detail.ts; artifacts/mariana-textil/src/pages/cliente-movimiento-detail.tsx; lib/db/src/schema/pos.ts; lib/db/src/lib/clientes-schema.ts; artifacts/api-server/src/routes/clientes.ts; artifacts/api-server/src/lib/e7-read-model.ts; artifacts/api-server/src/lib/admin-analytics.ts; artifacts/api-server/src/lib/reportes-commercial.ts; artifacts/api-server/src/lib/reportes-sales.ts; artifacts/mariana-textil/src/components/client-directory.tsx; artifacts/mariana-textil/src/pages/cliente-detail.tsx; artifacts/mariana-textil/src/pages/clientes.tsx; artifacts/mariana-textil/src/pages/ticket-detail.tsx; artifacts/mariana-textil/src/pages/caja/tiempo-real.tsx. No se atribuye automáticamente efecto sobre permisos a estas diferencias; la clasificación se hizo sobre el contenido activo.

## Criterio de evidencia negativa

Inventario completo de referencias módulo/enum en todas las fuentes propias del bundle API y todos los TS/TSX activos UI. Inventario independiente de todas las llamadas de guardas y lecturas puede*. Revisión de bucles E3, wrapper E4, actor E5, gestores de camionetas/choferes, rutas montadas y helper UI. Comparación textual/hash de archivos relevantes contra frozen, árbol de trabajo y git HEAD. No se ejecutó aplicación, API, DB, pruebas ni workflows.

chunk-business-evidence.json conserva TODOS los hits por módulo y un inventario independiente de guardas, incluidos falsos positivos. Los registros de matriz, defaults ADMIN, editor genérico, tipos y cache keys no prueban una operación. Las acciones bajo otros módulos tampoco.

Sin consumidores operativos de la celda encontrados en los corpus activos auditados: candidata a marcar no aplicable/obsoleta, NO a borrar literalmente una columna. El contrato ModulePermission/AccionPermiso, resolución y matrices rol/usuario/ubicación comparten las cuatro acciones. Retirar representación o semántica requiere diseño de capacidades aplicables por módulo, migraciones de datos/esquema si corresponde, actualización de API/OpenAPI, tipos/clientes/editor, herencia y pruebas de compatibilidad; preservar historial. No se ha cambiado nada.

## dashboard:crear — Crear — dashboard — A

IDs exactos (6): TERMINAL:dashboard:crear, CAJA:dashboard:crear, SUPERVISOR:dashboard:crear, BODEGA:dashboard:crear, SISTEMAS:dashboard:crear, CONTADOR:dashboard:crear.

Matriz histórica — concedido: ADMIN; denegado: TERMINAL, CAJA, SUPERVISOR, BODEGA, SISTEMAS, CONTADOR; desconocido: ninguno.

Sólo lectura del tablero; crear, editar y autorizar no son operaciones de este módulo.

Citas: API routes/dashboard.ts:12-15; UI App.tsx:260-269.

Motivo histórico: El histórico no encontró operación estática y trasladó la celda a OWNER_SEMANTICS_REQUIRED. La evidencia actual lo explica por matriz rectangular con acciones no aplicables, no por una decisión de negocio pendiente. No consta traza del parser histórico para demostrar su motivo interno.

Prueba negativa completa: chunk-business-evidence.json → moduleSearch.dashboard, además guardInventory. Retiro: candidata no aplicable; sólo con cambio estructural compatible descrito arriba.

No requiere decisión del propietario para esta clasificación; no constituye cierre de prueba API/UI.

## dashboard:editar — Modificar — dashboard — A

IDs exactos (6): TERMINAL:dashboard:editar, CAJA:dashboard:editar, SUPERVISOR:dashboard:editar, BODEGA:dashboard:editar, SISTEMAS:dashboard:editar, CONTADOR:dashboard:editar.

Matriz histórica — concedido: ADMIN; denegado: TERMINAL, CAJA, SUPERVISOR, BODEGA, SISTEMAS, CONTADOR; desconocido: ninguno.

Sólo lectura del tablero; crear, editar y autorizar no son operaciones de este módulo.

Citas: API routes/dashboard.ts:12-15; UI App.tsx:260-269.

Motivo histórico: El histórico no encontró operación estática y trasladó la celda a OWNER_SEMANTICS_REQUIRED. La evidencia actual lo explica por matriz rectangular con acciones no aplicables, no por una decisión de negocio pendiente. No consta traza del parser histórico para demostrar su motivo interno.

Prueba negativa completa: chunk-business-evidence.json → moduleSearch.dashboard, además guardInventory. Retiro: candidata no aplicable; sólo con cambio estructural compatible descrito arriba.

No requiere decisión del propietario para esta clasificación; no constituye cierre de prueba API/UI.

## dashboard:autorizar — Autorizar — dashboard — A

IDs exactos (6): TERMINAL:dashboard:autorizar, CAJA:dashboard:autorizar, SUPERVISOR:dashboard:autorizar, BODEGA:dashboard:autorizar, SISTEMAS:dashboard:autorizar, CONTADOR:dashboard:autorizar.

Matriz histórica — concedido: ADMIN; denegado: TERMINAL, CAJA, SUPERVISOR, BODEGA, SISTEMAS, CONTADOR; desconocido: ninguno.

Sólo lectura del tablero; crear, editar y autorizar no son operaciones de este módulo.

Citas: API routes/dashboard.ts:12-15; UI App.tsx:260-269.

Motivo histórico: El histórico no encontró operación estática y trasladó la celda a OWNER_SEMANTICS_REQUIRED. La evidencia actual lo explica por matriz rectangular con acciones no aplicables, no por una decisión de negocio pendiente. No consta traza del parser histórico para demostrar su motivo interno.

Prueba negativa completa: chunk-business-evidence.json → moduleSearch.dashboard, además guardInventory. Retiro: candidata no aplicable; sólo con cambio estructural compatible descrito arriba.

No requiere decisión del propietario para esta clasificación; no constituye cierre de prueba API/UI.

## entradas:autorizar — Autorizar — entradas — A

IDs exactos (6): TERMINAL:entradas:autorizar, CAJA:entradas:autorizar, SUPERVISOR:entradas:autorizar, BODEGA:entradas:autorizar, SISTEMAS:entradas:autorizar, CONTADOR:entradas:autorizar.

Matriz histórica — concedido: ADMIN; denegado: TERMINAL, CAJA, SUPERVISOR, BODEGA, SISTEMAS, CONTADOR; desconocido: ninguno.

Las altas y modificaciones usan entradas.crear/editar. No confundir autorizar con validaciones de la entrada o autorización bajo otro módulo.

Citas: API routes/inventario.ts:770,972,1237,1331; UI pages/entradas.tsx:203.

Motivo histórico: El histórico no encontró operación estática y trasladó la celda a OWNER_SEMANTICS_REQUIRED. La evidencia actual lo explica por matriz rectangular con acciones no aplicables, no por una decisión de negocio pendiente. No consta traza del parser histórico para demostrar su motivo interno.

Prueba negativa completa: chunk-business-evidence.json → moduleSearch.entradas, además guardInventory. Retiro: candidata no aplicable; sólo con cambio estructural compatible descrito arriba.

No requiere decisión del propietario para esta clasificación; no constituye cierre de prueba API/UI.

## etiquetas:autorizar — Autorizar — etiquetas — A

IDs exactos (6): TERMINAL:etiquetas:autorizar, CAJA:etiquetas:autorizar, SUPERVISOR:etiquetas:autorizar, BODEGA:etiquetas:autorizar, SISTEMAS:etiquetas:autorizar, CONTADOR:etiquetas:autorizar.

Matriz histórica — concedido: ADMIN; denegado: TERMINAL, CAJA, SUPERVISOR, BODEGA, SISTEMAS, CONTADOR; desconocido: ninguno.

Imprimir usa crear; configuración usa editar; historial usa sesión/otras condiciones. Ninguna autorización consume etiquetas.autorizar.

Citas: API routes/etiquetas.ts:183,325,561,675-734; UI pages/etiquetas.tsx:60; UI components/reprint-labels-dialog.tsx:83.

Motivo histórico: El histórico no encontró operación estática y trasladó la celda a OWNER_SEMANTICS_REQUIRED. La evidencia actual lo explica por matriz rectangular con acciones no aplicables, no por una decisión de negocio pendiente. No consta traza del parser histórico para demostrar su motivo interno.

Prueba negativa completa: chunk-business-evidence.json → moduleSearch.etiquetas, además guardInventory. Retiro: candidata no aplicable; sólo con cambio estructural compatible descrito arriba.

No requiere decisión del propietario para esta clasificación; no constituye cierre de prueba API/UI.

## clientes:autorizar — Autorizar — clientes — A

IDs exactos (6): TERMINAL:clientes:autorizar, CAJA:clientes:autorizar, SUPERVISOR:clientes:autorizar, BODEGA:clientes:autorizar, SISTEMAS:clientes:autorizar, CONTADOR:clientes:autorizar.

Matriz histórica — concedido: ADMIN; denegado: TERMINAL, CAJA, SUPERVISOR, BODEGA, SISTEMAS, CONTADOR; desconocido: ninguno.

El directorio consume ver/crear/editar. Ajustes financieros son clientes_finanzas.autorizar, no clientes.autorizar.

Citas: API routes/clientes.ts:635,683,1079,2372,2472; UI pages/cliente-detail.tsx:337-344.

Motivo histórico: El histórico no encontró operación estática y trasladó la celda a OWNER_SEMANTICS_REQUIRED. La evidencia actual lo explica por matriz rectangular con acciones no aplicables, no por una decisión de negocio pendiente. No consta traza del parser histórico para demostrar su motivo interno.

Prueba negativa completa: chunk-business-evidence.json → moduleSearch.clientes, además guardInventory. Retiro: candidata no aplicable; sólo con cambio estructural compatible descrito arriba.

No requiere decisión del propietario para esta clasificación; no constituye cierre de prueba API/UI.

## clientes_credito:crear — Crear — clientes credito — A

IDs exactos (6): TERMINAL:clientes_credito:crear, CAJA:clientes_credito:crear, SUPERVISOR:clientes_credito:crear, BODEGA:clientes_credito:crear, SISTEMAS:clientes_credito:crear, CONTADOR:clientes_credito:crear.

Matriz histórica — concedido: ADMIN; denegado: TERMINAL, CAJA, SUPERVISOR, BODEGA, SISTEMAS, CONTADOR; desconocido: ninguno.

Consulta usa ver y cambio de límite usa editar. Crear crédito no selecciona crear/autorizar de esta celda.

Citas: API routes/clientes.ts:1007,1017,1189,1259; UI pages/cliente-detail.tsx:337,343.

Motivo histórico: El histórico no encontró operación estática y trasladó la celda a OWNER_SEMANTICS_REQUIRED. La evidencia actual lo explica por matriz rectangular con acciones no aplicables, no por una decisión de negocio pendiente. No consta traza del parser histórico para demostrar su motivo interno.

Prueba negativa completa: chunk-business-evidence.json → moduleSearch.clientes_credito, además guardInventory. Retiro: candidata no aplicable; sólo con cambio estructural compatible descrito arriba.

No requiere decisión del propietario para esta clasificación; no constituye cierre de prueba API/UI.

## clientes_credito:autorizar — Autorizar — clientes credito — A

IDs exactos (6): TERMINAL:clientes_credito:autorizar, CAJA:clientes_credito:autorizar, SUPERVISOR:clientes_credito:autorizar, BODEGA:clientes_credito:autorizar, SISTEMAS:clientes_credito:autorizar, CONTADOR:clientes_credito:autorizar.

Matriz histórica — concedido: ADMIN; denegado: TERMINAL, CAJA, SUPERVISOR, BODEGA, SISTEMAS, CONTADOR; desconocido: ninguno.

Consulta usa ver y cambio de límite usa editar. Crear crédito no selecciona crear/autorizar de esta celda.

Citas: API routes/clientes.ts:1007,1017,1189,1259; UI pages/cliente-detail.tsx:337,343.

Motivo histórico: El histórico no encontró operación estática y trasladó la celda a OWNER_SEMANTICS_REQUIRED. La evidencia actual lo explica por matriz rectangular con acciones no aplicables, no por una decisión de negocio pendiente. No consta traza del parser histórico para demostrar su motivo interno.

Prueba negativa completa: chunk-business-evidence.json → moduleSearch.clientes_credito, además guardInventory. Retiro: candidata no aplicable; sólo con cambio estructural compatible descrito arriba.

No requiere decisión del propietario para esta clasificación; no constituye cierre de prueba API/UI.

## clientes_precios:crear — Crear — clientes precios — A

IDs exactos (6): TERMINAL:clientes_precios:crear, CAJA:clientes_precios:crear, SUPERVISOR:clientes_precios:crear, BODEGA:clientes_precios:crear, SISTEMAS:clientes_precios:crear, CONTADOR:clientes_precios:crear.

Matriz histórica — concedido: ADMIN; denegado: TERMINAL, CAJA, SUPERVISOR, BODEGA, SISTEMAS, CONTADOR; desconocido: ninguno.

Pestaña de precios del cliente es lectura (ver). Los cambios de precios en otro módulo no consumen clientes_precios.crear/editar/autorizar.

Citas: API routes/clientes.ts:1318; UI pages/cliente-detail.tsx:338.

Motivo histórico: El histórico no encontró operación estática y trasladó la celda a OWNER_SEMANTICS_REQUIRED. La evidencia actual lo explica por matriz rectangular con acciones no aplicables, no por una decisión de negocio pendiente. No consta traza del parser histórico para demostrar su motivo interno.

Prueba negativa completa: chunk-business-evidence.json → moduleSearch.clientes_precios, además guardInventory. Retiro: candidata no aplicable; sólo con cambio estructural compatible descrito arriba.

No requiere decisión del propietario para esta clasificación; no constituye cierre de prueba API/UI.

## clientes_precios:editar — Modificar — clientes precios — A

IDs exactos (6): TERMINAL:clientes_precios:editar, CAJA:clientes_precios:editar, SUPERVISOR:clientes_precios:editar, BODEGA:clientes_precios:editar, SISTEMAS:clientes_precios:editar, CONTADOR:clientes_precios:editar.

Matriz histórica — concedido: ADMIN; denegado: TERMINAL, CAJA, SUPERVISOR, BODEGA, SISTEMAS, CONTADOR; desconocido: ninguno.

Pestaña de precios del cliente es lectura (ver). Los cambios de precios en otro módulo no consumen clientes_precios.crear/editar/autorizar.

Citas: API routes/clientes.ts:1318; UI pages/cliente-detail.tsx:338.

Motivo histórico: El histórico no encontró operación estática y trasladó la celda a OWNER_SEMANTICS_REQUIRED. La evidencia actual lo explica por matriz rectangular con acciones no aplicables, no por una decisión de negocio pendiente. No consta traza del parser histórico para demostrar su motivo interno.

Prueba negativa completa: chunk-business-evidence.json → moduleSearch.clientes_precios, además guardInventory. Retiro: candidata no aplicable; sólo con cambio estructural compatible descrito arriba.

No requiere decisión del propietario para esta clasificación; no constituye cierre de prueba API/UI.

## clientes_precios:autorizar — Autorizar — clientes precios — A

IDs exactos (6): TERMINAL:clientes_precios:autorizar, CAJA:clientes_precios:autorizar, SUPERVISOR:clientes_precios:autorizar, BODEGA:clientes_precios:autorizar, SISTEMAS:clientes_precios:autorizar, CONTADOR:clientes_precios:autorizar.

Matriz histórica — concedido: ADMIN; denegado: TERMINAL, CAJA, SUPERVISOR, BODEGA, SISTEMAS, CONTADOR; desconocido: ninguno.

Pestaña de precios del cliente es lectura (ver). Los cambios de precios en otro módulo no consumen clientes_precios.crear/editar/autorizar.

Citas: API routes/clientes.ts:1318; UI pages/cliente-detail.tsx:338.

Motivo histórico: El histórico no encontró operación estática y trasladó la celda a OWNER_SEMANTICS_REQUIRED. La evidencia actual lo explica por matriz rectangular con acciones no aplicables, no por una decisión de negocio pendiente. No consta traza del parser histórico para demostrar su motivo interno.

Prueba negativa completa: chunk-business-evidence.json → moduleSearch.clientes_precios, además guardInventory. Retiro: candidata no aplicable; sólo con cambio estructural compatible descrito arriba.

No requiere decisión del propietario para esta clasificación; no constituye cierre de prueba API/UI.

## clientes_finanzas:editar — Modificar — clientes finanzas — A

IDs exactos (6): TERMINAL:clientes_finanzas:editar, CAJA:clientes_finanzas:editar, SUPERVISOR:clientes_finanzas:editar, BODEGA:clientes_finanzas:editar, SISTEMAS:clientes_finanzas:editar, CONTADOR:clientes_finanzas:editar.

Matriz histórica — concedido: ADMIN; denegado: TERMINAL, CAJA, SUPERVISOR, BODEGA, SISTEMAS, CONTADOR; desconocido: ninguno.

Las operaciones financieras consumen ver, crear o autorizar; ninguna selecciona editar. El nombre editar de una pantalla no acredita esta celda.

Citas: API routes/clientes.ts:2109,2166,2372,2472; UI pages/cliente-detail.tsx:339-342.

Motivo histórico: El histórico no encontró operación estática y trasladó la celda a OWNER_SEMANTICS_REQUIRED. La evidencia actual lo explica por matriz rectangular con acciones no aplicables, no por una decisión de negocio pendiente. No consta traza del parser histórico para demostrar su motivo interno.

Prueba negativa completa: chunk-business-evidence.json → moduleSearch.clientes_finanzas, además guardInventory. Retiro: candidata no aplicable; sólo con cambio estructural compatible descrito arriba.

No requiere decisión del propietario para esta clasificación; no constituye cierre de prueba API/UI.

## caja_abonos:ver — Consultar cobros pendientes E5 desde Caja — C

IDs exactos (6): TERMINAL:caja_abonos:ver, CAJA:caja_abonos:ver, SUPERVISOR:caja_abonos:ver, BODEGA:caja_abonos:ver, SISTEMAS:caja_abonos:ver, CONTADOR:caja_abonos:ver.

Matriz histórica — concedido: ADMIN; denegado: TERMINAL, CAJA, SUPERVISOR, BODEGA, SISTEMAS, CONTADOR; desconocido: ninguno.

API resolvePermiso(caja_abonos) toma puedeVer y lo combina OR con clientes_finanzas.ver. UI e5CanRead itera E5_READ_MODULES con ver y E5Entry lo aplica. Es consumo real de esta celda, no sólo registro de módulo. Persisten restricciones por rol y alcance.

Citas: API routes/index.ts:45,61; API routes/e5.ts:18-34,50-77; UI lib/e5-authorization.ts:5,19-22; UI components/e5-pendientes.tsx:48,58,281; UI pages/cobros.tsx:6,282; UI pages/cliente-detail.tsx:636; UI App.tsx:559-581; API lib/e5-feature.ts:2; UI lib/e5-feature-flags.ts:2.

Motivo histórico: El histórico conserva NO_OPERATION_FOUND_STATIC/OWNER_SEMANTICS_REQUIRED sin enlace de API/UI. El acceso calculado resolvePermiso + puedeVer y E5_READ_MODULES.some no equivale a un literal requierePermiso(module,action). Es la explicación técnica del falso negativo; no consta traza histórica del parser para atribuir causalidad exacta.

Endpoints: GET /api/e5/disponibilidad; GET /api/e5/cobros; GET /api/e5/contexto; GET /api/e5/cobros/:id. Fixture pendiente: Prueba futura aislada (no ejecutada): usuario activo CAJA/TERMINAL/SUPERVISOR, no ADMIN (bypass), rol permitido por E5, sitio y alcance válidos, sesión autenticada. Permisos efectivos clientes_finanzas.ver=false y caja_abonos.ver=true; para la navegación dar cobros_pagos.ver sin confundirlo con el control interno E5. Cobro E5 válido del sitio/cliente y capacidad/disponibilidad coherentes. Control negativo: cambiar sólo caja_abonos.ver=false manteniendo clientes_finanzas.ver=false, esperar 403 API y bloqueo E5Entry; positivo: true y respuesta/esquema correctos. Control OR: caja_abonos.ver=false/clientes_finanzas.ver=true debe seguir permitido. Montar /cobros, abrir listado E5, observar petición y resultado; listar/detalle deben respetar alcance. También comprobar roles excluidos CONTADOR/SISTEMAS/BODEGA. No se necesita dinero real ni DB real; repositorio fixture o DB aislada autorizada.

No requiere decisión del propietario para esta clasificación; no constituye cierre de prueba API/UI.

## caja_abonos:editar — Modificar — caja abonos — A

IDs exactos (6): TERMINAL:caja_abonos:editar, CAJA:caja_abonos:editar, SUPERVISOR:caja_abonos:editar, BODEGA:caja_abonos:editar, SISTEMAS:caja_abonos:editar, CONTADOR:caja_abonos:editar.

Matriz histórica — concedido: ADMIN; denegado: TERMINAL, CAJA, SUPERVISOR, BODEGA, SISTEMAS, CONTADOR; desconocido: ninguno.

E3 usa crear, incluso para contexto; E5 lee ver/crear. E5 autorizar usa reglas de actor/rol, no caja_abonos.autorizar. Serializar las cuatro banderas en clave de caché no convierte editar/autorizar en permisos de operación.

Citas: API routes/e3-collections.ts:25,45-50; API routes/e5.ts:18-34; UI lib/e5-authorization.ts:5-22.

Motivo histórico: El histórico no encontró operación estática y trasladó la celda a OWNER_SEMANTICS_REQUIRED. La evidencia actual lo explica por matriz rectangular con acciones no aplicables, no por una decisión de negocio pendiente. No consta traza del parser histórico para demostrar su motivo interno.

Prueba negativa completa: chunk-business-evidence.json → moduleSearch.caja_abonos, además guardInventory. Retiro: candidata no aplicable; sólo con cambio estructural compatible descrito arriba.

No requiere decisión del propietario para esta clasificación; no constituye cierre de prueba API/UI.

## caja_abonos:autorizar — Autorizar — caja abonos — A

IDs exactos (6): TERMINAL:caja_abonos:autorizar, CAJA:caja_abonos:autorizar, SUPERVISOR:caja_abonos:autorizar, BODEGA:caja_abonos:autorizar, SISTEMAS:caja_abonos:autorizar, CONTADOR:caja_abonos:autorizar.

Matriz histórica — concedido: ADMIN; denegado: TERMINAL, CAJA, SUPERVISOR, BODEGA, SISTEMAS, CONTADOR; desconocido: ninguno.

E3 usa crear, incluso para contexto; E5 lee ver/crear. E5 autorizar usa reglas de actor/rol, no caja_abonos.autorizar. Serializar las cuatro banderas en clave de caché no convierte editar/autorizar en permisos de operación.

Citas: API routes/e3-collections.ts:25,45-50; API routes/e5.ts:18-34; UI lib/e5-authorization.ts:5-22.

Motivo histórico: El histórico no encontró operación estática y trasladó la celda a OWNER_SEMANTICS_REQUIRED. La evidencia actual lo explica por matriz rectangular con acciones no aplicables, no por una decisión de negocio pendiente. No consta traza del parser histórico para demostrar su motivo interno.

Prueba negativa completa: chunk-business-evidence.json → moduleSearch.caja_abonos, además guardInventory. Retiro: candidata no aplicable; sólo con cambio estructural compatible descrito arriba.

No requiere decisión del propietario para esta clasificación; no constituye cierre de prueba API/UI.

## clientes_recapturas:ver — Consultar — clientes recapturas — A

IDs exactos (6): TERMINAL:clientes_recapturas:ver, CAJA:clientes_recapturas:ver, SUPERVISOR:clientes_recapturas:ver, BODEGA:clientes_recapturas:ver, SISTEMAS:clientes_recapturas:ver, CONTADOR:clientes_recapturas:ver.

Matriz histórica — concedido: ADMIN; denegado: TERMINAL, CAJA, SUPERVISOR, BODEGA, SISTEMAS, CONTADOR; desconocido: ninguno.

El bucle E3 enlaza module=clientes_recapturas con acción crear en ambas rutas. Recibos exigen ADMIN, no ver/editar/autorizar de recapturas.

Citas: API routes/e3-collections.ts:45-50,52-75; UI pages/cliente-detail.tsx:345.

Motivo histórico: El histórico no encontró operación estática y trasladó la celda a OWNER_SEMANTICS_REQUIRED. La evidencia actual lo explica por matriz rectangular con acciones no aplicables, no por una decisión de negocio pendiente. No consta traza del parser histórico para demostrar su motivo interno.

Prueba negativa completa: chunk-business-evidence.json → moduleSearch.clientes_recapturas, además guardInventory. Retiro: candidata no aplicable; sólo con cambio estructural compatible descrito arriba.

No requiere decisión del propietario para esta clasificación; no constituye cierre de prueba API/UI.

## clientes_recapturas:editar — Modificar — clientes recapturas — A

IDs exactos (6): TERMINAL:clientes_recapturas:editar, CAJA:clientes_recapturas:editar, SUPERVISOR:clientes_recapturas:editar, BODEGA:clientes_recapturas:editar, SISTEMAS:clientes_recapturas:editar, CONTADOR:clientes_recapturas:editar.

Matriz histórica — concedido: ADMIN; denegado: TERMINAL, CAJA, SUPERVISOR, BODEGA, SISTEMAS, CONTADOR; desconocido: ninguno.

El bucle E3 enlaza module=clientes_recapturas con acción crear en ambas rutas. Recibos exigen ADMIN, no ver/editar/autorizar de recapturas.

Citas: API routes/e3-collections.ts:45-50,52-75; UI pages/cliente-detail.tsx:345.

Motivo histórico: El histórico no encontró operación estática y trasladó la celda a OWNER_SEMANTICS_REQUIRED. La evidencia actual lo explica por matriz rectangular con acciones no aplicables, no por una decisión de negocio pendiente. No consta traza del parser histórico para demostrar su motivo interno.

Prueba negativa completa: chunk-business-evidence.json → moduleSearch.clientes_recapturas, además guardInventory. Retiro: candidata no aplicable; sólo con cambio estructural compatible descrito arriba.

No requiere decisión del propietario para esta clasificación; no constituye cierre de prueba API/UI.

## clientes_recapturas:autorizar — Autorizar — clientes recapturas — A

IDs exactos (6): TERMINAL:clientes_recapturas:autorizar, CAJA:clientes_recapturas:autorizar, SUPERVISOR:clientes_recapturas:autorizar, BODEGA:clientes_recapturas:autorizar, SISTEMAS:clientes_recapturas:autorizar, CONTADOR:clientes_recapturas:autorizar.

Matriz histórica — concedido: ADMIN; denegado: TERMINAL, CAJA, SUPERVISOR, BODEGA, SISTEMAS, CONTADOR; desconocido: ninguno.

El bucle E3 enlaza module=clientes_recapturas con acción crear en ambas rutas. Recibos exigen ADMIN, no ver/editar/autorizar de recapturas.

Citas: API routes/e3-collections.ts:45-50,52-75; UI pages/cliente-detail.tsx:345.

Motivo histórico: El histórico no encontró operación estática y trasladó la celda a OWNER_SEMANTICS_REQUIRED. La evidencia actual lo explica por matriz rectangular con acciones no aplicables, no por una decisión de negocio pendiente. No consta traza del parser histórico para demostrar su motivo interno.

Prueba negativa completa: chunk-business-evidence.json → moduleSearch.clientes_recapturas, además guardInventory. Retiro: candidata no aplicable; sólo con cambio estructural compatible descrito arriba.

No requiere decisión del propietario para esta clasificación; no constituye cierre de prueba API/UI.

## cortes:editar — Modificar — cortes — A

IDs exactos (6): TERMINAL:cortes:editar, CAJA:cortes:editar, SUPERVISOR:cortes:editar, BODEGA:cortes:editar, SISTEMAS:cortes:editar, CONTADOR:cortes:editar.

Matriz histórica — concedido: ADMIN; denegado: TERMINAL, CAJA, SUPERVISOR, BODEGA, SISTEMAS, CONTADOR; desconocido: ninguno.

Ver/crear controlan cortes. Revisiones y entregas no seleccionan editar/autorizar. El wrapper E4 sólo admite ver|crear y puede elegir otro módulo.

Citas: API routes/pos.ts:1022-1127; API lib/e4-cash-out.ts:5-12; API routes/e9.ts:18-19; UI components/e9-entregas-panel.tsx:26.

Motivo histórico: El histórico no encontró operación estática y trasladó la celda a OWNER_SEMANTICS_REQUIRED. La evidencia actual lo explica por matriz rectangular con acciones no aplicables, no por una decisión de negocio pendiente. No consta traza del parser histórico para demostrar su motivo interno.

Prueba negativa completa: chunk-business-evidence.json → moduleSearch.cortes, además guardInventory. Retiro: candidata no aplicable; sólo con cambio estructural compatible descrito arriba.

No requiere decisión del propietario para esta clasificación; no constituye cierre de prueba API/UI.

## cortes:autorizar — Autorizar — cortes — A

IDs exactos (6): TERMINAL:cortes:autorizar, CAJA:cortes:autorizar, SUPERVISOR:cortes:autorizar, BODEGA:cortes:autorizar, SISTEMAS:cortes:autorizar, CONTADOR:cortes:autorizar.

Matriz histórica — concedido: ADMIN; denegado: TERMINAL, CAJA, SUPERVISOR, BODEGA, SISTEMAS, CONTADOR; desconocido: ninguno.

Ver/crear controlan cortes. Revisiones y entregas no seleccionan editar/autorizar. El wrapper E4 sólo admite ver|crear y puede elegir otro módulo.

Citas: API routes/pos.ts:1022-1127; API lib/e4-cash-out.ts:5-12; API routes/e9.ts:18-19; UI components/e9-entregas-panel.tsx:26.

Motivo histórico: El histórico no encontró operación estática y trasladó la celda a OWNER_SEMANTICS_REQUIRED. La evidencia actual lo explica por matriz rectangular con acciones no aplicables, no por una decisión de negocio pendiente. No consta traza del parser histórico para demostrar su motivo interno.

Prueba negativa completa: chunk-business-evidence.json → moduleSearch.cortes, además guardInventory. Retiro: candidata no aplicable; sólo con cambio estructural compatible descrito arriba.

No requiere decisión del propietario para esta clasificación; no constituye cierre de prueba API/UI.

## cobros_pagos:editar — Modificar — cobros pagos — A

IDs exactos (6): TERMINAL:cobros_pagos:editar, CAJA:cobros_pagos:editar, SUPERVISOR:cobros_pagos:editar, BODEGA:cobros_pagos:editar, SISTEMAS:cobros_pagos:editar, CONTADOR:cobros_pagos:editar.

Matriz histórica — concedido: ADMIN; denegado: TERMINAL, CAJA, SUPERVISOR, BODEGA, SISTEMAS, CONTADOR; desconocido: ninguno.

Wrapper E4 elige cobros_pagos o cortes, pero sólo ver/crear. No deriva editar/autorizar del nombre de la operación. E5 decide autorizaciones por rol, no por esta celda.

Citas: API lib/e4-cash-out.ts:5-12; API routes/pos.ts:1070-1085,1127; UI App.tsx:559-581.

Motivo histórico: El histórico no encontró operación estática y trasladó la celda a OWNER_SEMANTICS_REQUIRED. La evidencia actual lo explica por matriz rectangular con acciones no aplicables, no por una decisión de negocio pendiente. No consta traza del parser histórico para demostrar su motivo interno.

Prueba negativa completa: chunk-business-evidence.json → moduleSearch.cobros_pagos, además guardInventory. Retiro: candidata no aplicable; sólo con cambio estructural compatible descrito arriba.

No requiere decisión del propietario para esta clasificación; no constituye cierre de prueba API/UI.

## cobros_pagos:autorizar — Autorizar — cobros pagos — A

IDs exactos (6): TERMINAL:cobros_pagos:autorizar, CAJA:cobros_pagos:autorizar, SUPERVISOR:cobros_pagos:autorizar, BODEGA:cobros_pagos:autorizar, SISTEMAS:cobros_pagos:autorizar, CONTADOR:cobros_pagos:autorizar.

Matriz histórica — concedido: ADMIN; denegado: TERMINAL, CAJA, SUPERVISOR, BODEGA, SISTEMAS, CONTADOR; desconocido: ninguno.

Wrapper E4 elige cobros_pagos o cortes, pero sólo ver/crear. No deriva editar/autorizar del nombre de la operación. E5 decide autorizaciones por rol, no por esta celda.

Citas: API lib/e4-cash-out.ts:5-12; API routes/pos.ts:1070-1085,1127; UI App.tsx:559-581.

Motivo histórico: El histórico no encontró operación estática y trasladó la celda a OWNER_SEMANTICS_REQUIRED. La evidencia actual lo explica por matriz rectangular con acciones no aplicables, no por una decisión de negocio pendiente. No consta traza del parser histórico para demostrar su motivo interno.

Prueba negativa completa: chunk-business-evidence.json → moduleSearch.cobros_pagos, además guardInventory. Retiro: candidata no aplicable; sólo con cambio estructural compatible descrito arriba.

No requiere decisión del propietario para esta clasificación; no constituye cierre de prueba API/UI.

## conciliacion:crear — Crear — conciliacion — A

IDs exactos (5): TERMINAL:conciliacion:crear, CAJA:conciliacion:crear, SUPERVISOR:conciliacion:crear, BODEGA:conciliacion:crear, CONTADOR:conciliacion:crear.

Matriz histórica — concedido: ADMIN, SISTEMAS; denegado: TERMINAL, CAJA, SUPERVISOR, BODEGA, CONTADOR; desconocido: ninguno.

Consulta consume ver y reconstrucción autorizar; no crear/editar. Conciliaciones E11 usan FISCAL_CONCILIAR, permiso distinto.

Citas: API routes/inventario.ts:2458,2484-2489; API routes/e11.ts:117-131; UI App.tsx:700.

Motivo histórico: El histórico no encontró operación estática y trasladó la celda a OWNER_SEMANTICS_REQUIRED. La evidencia actual lo explica por matriz rectangular con acciones no aplicables, no por una decisión de negocio pendiente. No consta traza del parser histórico para demostrar su motivo interno.

Prueba negativa completa: chunk-business-evidence.json → moduleSearch.conciliacion, además guardInventory. Retiro: candidata no aplicable; sólo con cambio estructural compatible descrito arriba.

No requiere decisión del propietario para esta clasificación; no constituye cierre de prueba API/UI.

## conciliacion:editar — Modificar — conciliacion — A

IDs exactos (6): TERMINAL:conciliacion:editar, CAJA:conciliacion:editar, SUPERVISOR:conciliacion:editar, BODEGA:conciliacion:editar, SISTEMAS:conciliacion:editar, CONTADOR:conciliacion:editar.

Matriz histórica — concedido: ADMIN; denegado: TERMINAL, CAJA, SUPERVISOR, BODEGA, SISTEMAS, CONTADOR; desconocido: ninguno.

Consulta consume ver y reconstrucción autorizar; no crear/editar. Conciliaciones E11 usan FISCAL_CONCILIAR, permiso distinto.

Citas: API routes/inventario.ts:2458,2484-2489; API routes/e11.ts:117-131; UI App.tsx:700.

Motivo histórico: El histórico no encontró operación estática y trasladó la celda a OWNER_SEMANTICS_REQUIRED. La evidencia actual lo explica por matriz rectangular con acciones no aplicables, no por una decisión de negocio pendiente. No consta traza del parser histórico para demostrar su motivo interno.

Prueba negativa completa: chunk-business-evidence.json → moduleSearch.conciliacion, además guardInventory. Retiro: candidata no aplicable; sólo con cambio estructural compatible descrito arriba.

No requiere decisión del propietario para esta clasificación; no constituye cierre de prueba API/UI.

## auditoria:crear — Crear — auditoria — A

IDs exactos (6): TERMINAL:auditoria:crear, CAJA:auditoria:crear, SUPERVISOR:auditoria:crear, BODEGA:auditoria:crear, SISTEMAS:auditoria:crear, CONTADOR:auditoria:crear.

Matriz histórica — concedido: ADMIN; denegado: TERMINAL, CAJA, SUPERVISOR, BODEGA, SISTEMAS, CONTADOR; desconocido: ninguno.

Bitácora sólo consume auditoria.ver. Auditorías de inventario tienen módulo auditoria_inventario; sus crear/editar/autorizar NO son estas celdas.

Citas: API routes/auditoria.ts:20-26; API routes/auditorias-inventario.ts:172,252,314-315; UI App.tsx:404,709.

Motivo histórico: El histórico no encontró operación estática y trasladó la celda a OWNER_SEMANTICS_REQUIRED. La evidencia actual lo explica por matriz rectangular con acciones no aplicables, no por una decisión de negocio pendiente. No consta traza del parser histórico para demostrar su motivo interno.

Prueba negativa completa: chunk-business-evidence.json → moduleSearch.auditoria, además guardInventory. Retiro: candidata no aplicable; sólo con cambio estructural compatible descrito arriba.

No requiere decisión del propietario para esta clasificación; no constituye cierre de prueba API/UI.

## auditoria:editar — Modificar — auditoria — A

IDs exactos (6): TERMINAL:auditoria:editar, CAJA:auditoria:editar, SUPERVISOR:auditoria:editar, BODEGA:auditoria:editar, SISTEMAS:auditoria:editar, CONTADOR:auditoria:editar.

Matriz histórica — concedido: ADMIN; denegado: TERMINAL, CAJA, SUPERVISOR, BODEGA, SISTEMAS, CONTADOR; desconocido: ninguno.

Bitácora sólo consume auditoria.ver. Auditorías de inventario tienen módulo auditoria_inventario; sus crear/editar/autorizar NO son estas celdas.

Citas: API routes/auditoria.ts:20-26; API routes/auditorias-inventario.ts:172,252,314-315; UI App.tsx:404,709.

Motivo histórico: El histórico no encontró operación estática y trasladó la celda a OWNER_SEMANTICS_REQUIRED. La evidencia actual lo explica por matriz rectangular con acciones no aplicables, no por una decisión de negocio pendiente. No consta traza del parser histórico para demostrar su motivo interno.

Prueba negativa completa: chunk-business-evidence.json → moduleSearch.auditoria, además guardInventory. Retiro: candidata no aplicable; sólo con cambio estructural compatible descrito arriba.

No requiere decisión del propietario para esta clasificación; no constituye cierre de prueba API/UI.

## auditoria:autorizar — Autorizar — auditoria — A

IDs exactos (6): TERMINAL:auditoria:autorizar, CAJA:auditoria:autorizar, SUPERVISOR:auditoria:autorizar, BODEGA:auditoria:autorizar, SISTEMAS:auditoria:autorizar, CONTADOR:auditoria:autorizar.

Matriz histórica — concedido: ADMIN; denegado: TERMINAL, CAJA, SUPERVISOR, BODEGA, SISTEMAS, CONTADOR; desconocido: ninguno.

Bitácora sólo consume auditoria.ver. Auditorías de inventario tienen módulo auditoria_inventario; sus crear/editar/autorizar NO son estas celdas.

Citas: API routes/auditoria.ts:20-26; API routes/auditorias-inventario.ts:172,252,314-315; UI App.tsx:404,709.

Motivo histórico: El histórico no encontró operación estática y trasladó la celda a OWNER_SEMANTICS_REQUIRED. La evidencia actual lo explica por matriz rectangular con acciones no aplicables, no por una decisión de negocio pendiente. No consta traza del parser histórico para demostrar su motivo interno.

Prueba negativa completa: chunk-business-evidence.json → moduleSearch.auditoria, además guardInventory. Retiro: candidata no aplicable; sólo con cambio estructural compatible descrito arriba.

No requiere decisión del propietario para esta clasificación; no constituye cierre de prueba API/UI.

## camionetas:autorizar — Autorizar — camionetas — A

IDs exactos (6): TERMINAL:camionetas:autorizar, CAJA:camionetas:autorizar, SUPERVISOR:camionetas:autorizar, BODEGA:camionetas:autorizar, SISTEMAS:camionetas:autorizar, CONTADOR:camionetas:autorizar.

Matriz histórica — concedido: ADMIN; denegado: TERMINAL, CAJA, SUPERVISOR, BODEGA, SISTEMAS, CONTADOR; desconocido: ninguno.

Wrapper requiereGestorCamionetas recibe crear/editar; no autorizar. Roles gestores adicionales no son consumo de autorizar.

Citas: API routes/camionetas.ts:35-38,65,111; UI pages/configuracion/camionetas.tsx:58.

Motivo histórico: El histórico no encontró operación estática y trasladó la celda a OWNER_SEMANTICS_REQUIRED. La evidencia actual lo explica por matriz rectangular con acciones no aplicables, no por una decisión de negocio pendiente. No consta traza del parser histórico para demostrar su motivo interno.

Prueba negativa completa: chunk-business-evidence.json → moduleSearch.camionetas, además guardInventory. Retiro: candidata no aplicable; sólo con cambio estructural compatible descrito arriba.

No requiere decisión del propietario para esta clasificación; no constituye cierre de prueba API/UI.

## choferes:autorizar — Autorizar — choferes — A

IDs exactos (6): TERMINAL:choferes:autorizar, CAJA:choferes:autorizar, SUPERVISOR:choferes:autorizar, BODEGA:choferes:autorizar, SISTEMAS:choferes:autorizar, CONTADOR:choferes:autorizar.

Matriz histórica — concedido: ADMIN; denegado: TERMINAL, CAJA, SUPERVISOR, BODEGA, SISTEMAS, CONTADOR; desconocido: ninguno.

Wrapper de gestores consume crear/editar. No hay llamada con autorizar, aunque existan restricciones por rol.

Citas: API routes/choferes.ts:64-67,87,155; UI pages/configuracion/choferes.tsx:73-75.

Motivo histórico: El histórico no encontró operación estática y trasladó la celda a OWNER_SEMANTICS_REQUIRED. La evidencia actual lo explica por matriz rectangular con acciones no aplicables, no por una decisión de negocio pendiente. No consta traza del parser histórico para demostrar su motivo interno.

Prueba negativa completa: chunk-business-evidence.json → moduleSearch.choferes, además guardInventory. Retiro: candidata no aplicable; sólo con cambio estructural compatible descrito arriba.

No requiere decisión del propietario para esta clasificación; no constituye cierre de prueba API/UI.

## equipos:autorizar — Autorizar — equipos — A

IDs exactos (6): TERMINAL:equipos:autorizar, CAJA:equipos:autorizar, SUPERVISOR:equipos:autorizar, BODEGA:equipos:autorizar, SISTEMAS:equipos:autorizar, CONTADOR:equipos:autorizar.

Matriz histórica — concedido: ADMIN; denegado: TERMINAL, CAJA, SUPERVISOR, BODEGA, SISTEMAS, CONTADOR; desconocido: ninguno.

Alta usa crear y cambios/desactivación editar; ninguna operación selecciona equipos.autorizar.

Citas: API routes/equipos.ts:208,242,276,352,470; UI pages/equipos/index.tsx:64-65.

Motivo histórico: El histórico no encontró operación estática y trasladó la celda a OWNER_SEMANTICS_REQUIRED. La evidencia actual lo explica por matriz rectangular con acciones no aplicables, no por una decisión de negocio pendiente. No consta traza del parser histórico para demostrar su motivo interno.

Prueba negativa completa: chunk-business-evidence.json → moduleSearch.equipos, además guardInventory. Retiro: candidata no aplicable; sólo con cambio estructural compatible descrito arriba.

No requiere decisión del propietario para esta clasificación; no constituye cierre de prueba API/UI.

## Límites

Ningún elemento se clasifica B en este bloque. No se declara ninguna prueba ejecutada. Las ausencias son de consumidores operativos internos en fuentes activas auditadas; contratos externos desconocidos impiden prometer eliminación universal segura. La causa interna del parser histórico no se puede demostrar sin su traza.
