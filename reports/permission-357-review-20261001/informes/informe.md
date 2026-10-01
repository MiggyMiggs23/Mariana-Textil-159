# Revisión de las 357 celdas de permisos



## Resultado

- Se revisaron exactamente 357 celdas históricas, agrupadas en 61 combinaciones de módulo y acción. No se consultó la base de datos actual ni se ejecutaron pruebas de la aplicación.

- A: 59 combinaciones / 348 celdas. No hay una operación enlazada a ESA celda en el código activo revisado. Esto no afirma que la función comercial no exista, que haya desaparecido ni que nunca existiera: una operación parecida puede usar otro permiso.

- B: 0 combinaciones / 0 celdas. No hay casos que requieran decisión semántica del propietario.

- C: 2 combinaciones / 9 celdas. Consultar abonos de caja tiene un control calculado real en API y UI. Consultar ajustes de inventario tiene un control real de UI, pero no una guarda API propia.

- Las 348 celdas A pueden salir de la lista de verificación runtime pendiente como «sin operación aplicable a esta celda». No se presentan como pruebas aprobadas ni requieren decisión del propietario. Ocultarlas o retirarlas de la matriz visible sí exige un cambio técnico acotado y revisión de compatibilidad. No se pueden borrar literalmente sin tocar código/contrato; no deben eliminarse columnas compartidas ni filas completas de módulo. Deben preservarse herencias y datos históricos, y planear migraciones sólo si el diseño aprobado las requiere.

- Concedidos y denegados describen únicamente effective-matrices.json histórico. Los roles afectados son sólo los IDs incluidos en owner-357.csv y se muestran por separado. ADMIN es contexto de la matriz; no forma parte de las 357 celdas. Los permisos por sí solos no anulan restricciones de rol, sitio o sesión.

- La ausencia de consumidores se revisó en referencias completas de módulos, llamadas directas y calculadas, wrappers, helpers, rutas y montajes. El editor genérico, los defaults ADMIN, los tipos de contrato y la serialización de banderas no se cuentan como consumidores operativos.



## Fuentes y alcance

Fuente de verdad: API artifacts/api-server/dist-driver-phones-20261001/index.mjs.map (sourcesContent) y UI reports/sidebar-order-20261001/frozen-root/artifacts/mariana-textil/src. Las citas cortas API son relativas a artifacts/api-server/src del sourcemap; las citas UI son relativas al frozen indicado. Comparaciones con HEAD y árbol de trabajo están retenidas en chunk-business-head-comparison.json y chunk-operations-evidence.json / chunk-operations.json. En business: 206 archivos comparados, 16 diferencias frente a HEAD, ninguna discrepancia entre API frozen y sourcemap relevante. HEAD no sustituyó las fuentes activas. No se modificó código de aplicación, permisos, DB ni workflows.



## Detalle: 61 combinaciones


## A — Sin operación enlazada a esta celda


### Inventario y productos


#### Ajustes de inventario — Modificar (ajustes:editar)

Afectados (5): TERMINAL, CAJA, SUPERVISOR, SISTEMAS, CONTADOR.

Concedido: BODEGA. Denegado: TERMINAL, CAJA, SUPERVISOR, SISTEMAS, CONTADOR. ADMIN (sólo contexto): concedido.

Ajustes usa crear para ajustar y autorizar para revisar/revertir; no existe operación de edición independiente ajustes:editar.

Por qué no se identificó: El inventario histórico dejó esta combinación como NO_OPERATION_FOUND_STATIC y luego OWNER_SEMANTICS_REQUIRED. La revisión actual no encuentra una operación enlazada a esta celda concreta. La matriz permite combinar módulos y acciones aunque algunas combinaciones no tengan consumidor. No se demuestra el motivo interno del analizador histórico ni que la función comercial no exista.

Evidencia negativa completa: chunk-operations-evidence.json, moduleEvidence.ajustes. No se usa ausencia de coincidencia literal aislada como prueba; se examinaron llamadas calculadas y acciones protegidas por otros permisos.

Citas: artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):105; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):142; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):538; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):641; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):680; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):770; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):972; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):1111; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):1151; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):1172; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):1237; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):1277; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):1331; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):1390; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):1455; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):1514; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):1597; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):1639; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):1670; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):1715; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):1842; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):1877; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):2010; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):2147; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):2191; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):2231; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):2263; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):2364; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):2403; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):2458; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):2489; chunk-operations-evidence.json#/moduleEvidence/ajustes; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[925] (artifacts/api-server/src/app.ts):57-57; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[934] (artifacts/api-server/src/routes/index.ts):68-100.

IDs exactos: TERMINAL:ajustes:editar, CAJA:ajustes:editar, SUPERVISOR:ajustes:editar, SISTEMAS:ajustes:editar, CONTADOR:ajustes:editar.


#### Catálogo de productos — Autorizar (productos:autorizar)

Afectados (6): TERMINAL, CAJA, SUPERVISOR, BODEGA, SISTEMAS, CONTADOR.

Concedido: Ninguno. Denegado: TERMINAL, CAJA, SUPERVISOR, BODEGA, SISTEMAS, CONTADOR. ADMIN (sólo contexto): concedido.

El catálogo tiene ver/crear/editar, sin autorización separada productos:autorizar.

Por qué no se identificó: El inventario histórico dejó esta combinación como NO_OPERATION_FOUND_STATIC y luego OWNER_SEMANTICS_REQUIRED. La revisión actual no encuentra una operación enlazada a esta celda concreta. La matriz permite combinar módulos y acciones aunque algunas combinaciones no tengan consumidor. No se demuestra el motivo interno del analizador histórico ni que la función comercial no exista.

Evidencia negativa completa: chunk-operations-evidence.json, moduleEvidence.productos. No se usa ausencia de coincidencia literal aislada como prueba; se examinaron llamadas calculadas y acciones protegidas por otros permisos.

Citas: artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[974] (artifacts/api-server/src/routes/productos.ts):37; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[974] (artifacts/api-server/src/routes/productos.ts):54; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[974] (artifacts/api-server/src/routes/productos.ts):304; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[974] (artifacts/api-server/src/routes/productos.ts):346; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[974] (artifacts/api-server/src/routes/productos.ts):475; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[974] (artifacts/api-server/src/routes/productos.ts):532; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[974] (artifacts/api-server/src/routes/productos.ts):658; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[974] (artifacts/api-server/src/routes/productos.ts):768; chunk-operations-evidence.json#/moduleEvidence/productos; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[925] (artifacts/api-server/src/app.ts):57-57; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[934] (artifacts/api-server/src/routes/index.ts):68-100.

IDs exactos: TERMINAL:productos:autorizar, CAJA:productos:autorizar, SUPERVISOR:productos:autorizar, BODEGA:productos:autorizar, SISTEMAS:productos:autorizar, CONTADOR:productos:autorizar.


#### Consulta de inventario — Autorizar (inventario:autorizar)

Afectados (6): TERMINAL, CAJA, SUPERVISOR, BODEGA, SISTEMAS, CONTADOR.

Concedido: Ninguno. Denegado: TERMINAL, CAJA, SUPERVISOR, BODEGA, SISTEMAS, CONTADOR. ADMIN (sólo contexto): concedido.

Inventario consulta con ver y cambia rollos/mínimos con editar. Crear entradas, salidas y ajustes usa sus módulos; no consume inventario:crear/autorizar.

Por qué no se identificó: El inventario histórico dejó esta combinación como NO_OPERATION_FOUND_STATIC y luego OWNER_SEMANTICS_REQUIRED. La revisión actual no encuentra una operación enlazada a esta celda concreta. La matriz permite combinar módulos y acciones aunque algunas combinaciones no tengan consumidor. No se demuestra el motivo interno del analizador histórico ni que la función comercial no exista.

Evidencia negativa completa: chunk-operations-evidence.json, moduleEvidence.inventario. No se usa ausencia de coincidencia literal aislada como prueba; se examinaron llamadas calculadas y acciones protegidas por otros permisos.

Citas: artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):105; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):142; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):538; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):641; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):680; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):770; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):972; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):1111; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):1151; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):1172; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):1237; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):1277; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):1331; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):1390; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):1455; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):1514; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):1597; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):1639; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):1670; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):1715; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):1842; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):1877; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):2010; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):2147; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):2191; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):2231; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):2263; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):2364; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):2403; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):2458; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):2489; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1292] (artifacts/api-server/src/routes/stock-minimos.ts):5; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1292] (artifacts/api-server/src/routes/stock-minimos.ts):102; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1292] (artifacts/api-server/src/routes/stock-minimos.ts):106; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1292] (artifacts/api-server/src/routes/stock-minimos.ts):128; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1292] (artifacts/api-server/src/routes/stock-minimos.ts):161; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1292] (artifacts/api-server/src/routes/stock-minimos.ts):187; chunk-operations-evidence.json#/moduleEvidence/inventario; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[925] (artifacts/api-server/src/app.ts):57-57; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[934] (artifacts/api-server/src/routes/index.ts):68-100.

IDs exactos: TERMINAL:inventario:autorizar, CAJA:inventario:autorizar, SUPERVISOR:inventario:autorizar, BODEGA:inventario:autorizar, SISTEMAS:inventario:autorizar, CONTADOR:inventario:autorizar.


#### Consulta de inventario — Crear (inventario:crear)

Afectados (6): TERMINAL, CAJA, SUPERVISOR, BODEGA, SISTEMAS, CONTADOR.

Concedido: Ninguno. Denegado: TERMINAL, CAJA, SUPERVISOR, BODEGA, SISTEMAS, CONTADOR. ADMIN (sólo contexto): concedido.

Inventario consulta con ver y cambia rollos/mínimos con editar. Crear entradas, salidas y ajustes usa sus módulos; no consume inventario:crear/autorizar.

Por qué no se identificó: El inventario histórico dejó esta combinación como NO_OPERATION_FOUND_STATIC y luego OWNER_SEMANTICS_REQUIRED. La revisión actual no encuentra una operación enlazada a esta celda concreta. La matriz permite combinar módulos y acciones aunque algunas combinaciones no tengan consumidor. No se demuestra el motivo interno del analizador histórico ni que la función comercial no exista.

Evidencia negativa completa: chunk-operations-evidence.json, moduleEvidence.inventario. No se usa ausencia de coincidencia literal aislada como prueba; se examinaron llamadas calculadas y acciones protegidas por otros permisos.

Citas: artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):105; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):142; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):538; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):641; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):680; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):770; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):972; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):1111; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):1151; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):1172; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):1237; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):1277; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):1331; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):1390; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):1455; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):1514; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):1597; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):1639; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):1670; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):1715; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):1842; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):1877; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):2010; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):2147; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):2191; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):2231; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):2263; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):2364; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):2403; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):2458; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):2489; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1292] (artifacts/api-server/src/routes/stock-minimos.ts):5; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1292] (artifacts/api-server/src/routes/stock-minimos.ts):102; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1292] (artifacts/api-server/src/routes/stock-minimos.ts):106; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1292] (artifacts/api-server/src/routes/stock-minimos.ts):128; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1292] (artifacts/api-server/src/routes/stock-minimos.ts):161; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1292] (artifacts/api-server/src/routes/stock-minimos.ts):187; chunk-operations-evidence.json#/moduleEvidence/inventario; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[925] (artifacts/api-server/src/app.ts):57-57; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[934] (artifacts/api-server/src/routes/index.ts):68-100.

IDs exactos: TERMINAL:inventario:crear, CAJA:inventario:crear, SUPERVISOR:inventario:crear, BODEGA:inventario:crear, SISTEMAS:inventario:crear, CONTADOR:inventario:crear.


#### Entradas de mercancía — Autorizar (entradas:autorizar)

Afectados (6): TERMINAL, CAJA, SUPERVISOR, BODEGA, SISTEMAS, CONTADOR.

Concedido: Ninguno. Denegado: TERMINAL, CAJA, SUPERVISOR, BODEGA, SISTEMAS, CONTADOR. ADMIN (sólo contexto): concedido.

Las altas y modificaciones usan entradas.crear/editar. No confundir autorizar con validaciones de la entrada o autorización bajo otro módulo.

Por qué no se identificó: El inventario histórico dejó esta combinación como NO_OPERATION_FOUND_STATIC y luego OWNER_SEMANTICS_REQUIRED. La revisión actual no encuentra una operación enlazada a esta celda concreta. La matriz permite combinar módulos y acciones aunque algunas combinaciones no tengan consumidor. No se demuestra el motivo interno del analizador histórico ni que la función comercial no exista.

Evidencia negativa completa: chunk-business-evidence.json, moduleSearch.entradas + guardInventory. No se usa ausencia de coincidencia literal aislada como prueba; se examinaron llamadas calculadas y acciones protegidas por otros permisos.

Citas: API routes/inventario.ts:770,972,1237,1331; UI pages/entradas.tsx:203.

IDs exactos: TERMINAL:entradas:autorizar, CAJA:entradas:autorizar, SUPERVISOR:entradas:autorizar, BODEGA:entradas:autorizar, SISTEMAS:entradas:autorizar, CONTADOR:entradas:autorizar.


#### Etiquetas — Autorizar (etiquetas:autorizar)

Afectados (6): TERMINAL, CAJA, SUPERVISOR, BODEGA, SISTEMAS, CONTADOR.

Concedido: Ninguno. Denegado: TERMINAL, CAJA, SUPERVISOR, BODEGA, SISTEMAS, CONTADOR. ADMIN (sólo contexto): concedido.

Imprimir usa crear; configuración usa editar; historial usa sesión/otras condiciones. Ninguna autorización consume etiquetas.autorizar.

Por qué no se identificó: El inventario histórico dejó esta combinación como NO_OPERATION_FOUND_STATIC y luego OWNER_SEMANTICS_REQUIRED. La revisión actual no encuentra una operación enlazada a esta celda concreta. La matriz permite combinar módulos y acciones aunque algunas combinaciones no tengan consumidor. No se demuestra el motivo interno del analizador histórico ni que la función comercial no exista.

Evidencia negativa completa: chunk-business-evidence.json, moduleSearch.etiquetas + guardInventory. No se usa ausencia de coincidencia literal aislada como prueba; se examinaron llamadas calculadas y acciones protegidas por otros permisos.

Citas: API routes/etiquetas.ts:183,325,561,675-734; UI pages/etiquetas.tsx:60; UI components/reprint-labels-dialog.tsx:83.

IDs exactos: TERMINAL:etiquetas:autorizar, CAJA:etiquetas:autorizar, SUPERVISOR:etiquetas:autorizar, BODEGA:etiquetas:autorizar, SISTEMAS:etiquetas:autorizar, CONTADOR:etiquetas:autorizar.


#### Historial de movimientos — Autorizar (movimientos:autorizar)

Afectados (6): TERMINAL, CAJA, SUPERVISOR, BODEGA, SISTEMAS, CONTADOR.

Concedido: Ninguno. Denegado: TERMINAL, CAJA, SUPERVISOR, BODEGA, SISTEMAS, CONTADOR. ADMIN (sólo contexto): concedido.

Kardex y documentos consultan movimientos:ver. Ajustar/revisar/revertir se gobierna por ajustes:crear/autorizar u otras celdas, no por crear/editar/autorizar de movimientos.

Por qué no se identificó: El inventario histórico dejó esta combinación como NO_OPERATION_FOUND_STATIC y luego OWNER_SEMANTICS_REQUIRED. La revisión actual no encuentra una operación enlazada a esta celda concreta. La matriz permite combinar módulos y acciones aunque algunas combinaciones no tengan consumidor. No se demuestra el motivo interno del analizador histórico ni que la función comercial no exista.

Evidencia negativa completa: chunk-operations-evidence.json, moduleEvidence.movimientos. No se usa ausencia de coincidencia literal aislada como prueba; se examinaron llamadas calculadas y acciones protegidas por otros permisos.

Citas: artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):105; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):142; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):538; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):641; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):680; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):770; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):972; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):1111; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):1151; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):1172; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):1237; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):1277; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):1331; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):1390; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):1455; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):1514; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):1597; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):1639; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):1670; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):1715; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):1842; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):1877; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):2010; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):2147; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):2191; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):2231; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):2263; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):2364; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):2403; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):2458; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):2489; chunk-operations-evidence.json#/moduleEvidence/movimientos; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[925] (artifacts/api-server/src/app.ts):57-57; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[934] (artifacts/api-server/src/routes/index.ts):68-100.

IDs exactos: TERMINAL:movimientos:autorizar, CAJA:movimientos:autorizar, SUPERVISOR:movimientos:autorizar, BODEGA:movimientos:autorizar, SISTEMAS:movimientos:autorizar, CONTADOR:movimientos:autorizar.


#### Historial de movimientos — Crear (movimientos:crear)

Afectados (5): TERMINAL, CAJA, SUPERVISOR, BODEGA, CONTADOR.

Concedido: SISTEMAS. Denegado: TERMINAL, CAJA, SUPERVISOR, BODEGA, CONTADOR. ADMIN (sólo contexto): concedido.

Kardex y documentos consultan movimientos:ver. Ajustar/revisar/revertir se gobierna por ajustes:crear/autorizar u otras celdas, no por crear/editar/autorizar de movimientos.

Por qué no se identificó: El inventario histórico dejó esta combinación como NO_OPERATION_FOUND_STATIC y luego OWNER_SEMANTICS_REQUIRED. La revisión actual no encuentra una operación enlazada a esta celda concreta. La matriz permite combinar módulos y acciones aunque algunas combinaciones no tengan consumidor. No se demuestra el motivo interno del analizador histórico ni que la función comercial no exista.

Evidencia negativa completa: chunk-operations-evidence.json, moduleEvidence.movimientos. No se usa ausencia de coincidencia literal aislada como prueba; se examinaron llamadas calculadas y acciones protegidas por otros permisos.

Citas: artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):105; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):142; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):538; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):641; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):680; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):770; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):972; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):1111; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):1151; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):1172; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):1237; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):1277; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):1331; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):1390; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):1455; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):1514; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):1597; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):1639; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):1670; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):1715; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):1842; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):1877; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):2010; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):2147; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):2191; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):2231; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):2263; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):2364; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):2403; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):2458; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):2489; chunk-operations-evidence.json#/moduleEvidence/movimientos; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[925] (artifacts/api-server/src/app.ts):57-57; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[934] (artifacts/api-server/src/routes/index.ts):68-100.

IDs exactos: TERMINAL:movimientos:crear, CAJA:movimientos:crear, SUPERVISOR:movimientos:crear, BODEGA:movimientos:crear, CONTADOR:movimientos:crear.


#### Historial de movimientos — Modificar (movimientos:editar)

Afectados (5): TERMINAL, CAJA, SUPERVISOR, BODEGA, CONTADOR.

Concedido: SISTEMAS. Denegado: TERMINAL, CAJA, SUPERVISOR, BODEGA, CONTADOR. ADMIN (sólo contexto): concedido.

Kardex y documentos consultan movimientos:ver. Ajustar/revisar/revertir se gobierna por ajustes:crear/autorizar u otras celdas, no por crear/editar/autorizar de movimientos.

Por qué no se identificó: El inventario histórico dejó esta combinación como NO_OPERATION_FOUND_STATIC y luego OWNER_SEMANTICS_REQUIRED. La revisión actual no encuentra una operación enlazada a esta celda concreta. La matriz permite combinar módulos y acciones aunque algunas combinaciones no tengan consumidor. No se demuestra el motivo interno del analizador histórico ni que la función comercial no exista.

Evidencia negativa completa: chunk-operations-evidence.json, moduleEvidence.movimientos. No se usa ausencia de coincidencia literal aislada como prueba; se examinaron llamadas calculadas y acciones protegidas por otros permisos.

Citas: artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):105; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):142; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):538; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):641; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):680; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):770; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):972; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):1111; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):1151; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):1172; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):1237; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):1277; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):1331; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):1390; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):1455; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):1514; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):1597; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):1639; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):1670; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):1715; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):1842; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):1877; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):2010; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):2147; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):2191; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):2231; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):2263; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):2364; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):2403; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):2458; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):2489; chunk-operations-evidence.json#/moduleEvidence/movimientos; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[925] (artifacts/api-server/src/app.ts):57-57; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[934] (artifacts/api-server/src/routes/index.ts):68-100.

IDs exactos: TERMINAL:movimientos:editar, CAJA:movimientos:editar, SUPERVISOR:movimientos:editar, BODEGA:movimientos:editar, CONTADOR:movimientos:editar.


#### Marcas de remate — Crear (marcar_remate:crear)

Afectados (6): TERMINAL, CAJA, SUPERVISOR, BODEGA, SISTEMAS, CONTADOR.

Concedido: Ninguno. Denegado: TERMINAL, CAJA, SUPERVISOR, BODEGA, SISTEMAS, CONTADOR. ADMIN (sólo contexto): concedido.

Marcar remate sí existe, pero el adaptador consulta exclusivamente marcar_remate.puedeAutorizar. Consultar el rollo usa inventario:ver y quitar marca exige ADMIN; no consume ver/crear/editar de marcar_remate.

Por qué no se identificó: El inventario histórico dejó esta combinación como NO_OPERATION_FOUND_STATIC y luego OWNER_SEMANTICS_REQUIRED. La revisión actual no encuentra una operación enlazada a esta celda concreta. La matriz permite combinar módulos y acciones aunque algunas combinaciones no tengan consumidor. No se demuestra el motivo interno del analizador histórico ni que la función comercial no exista.

Evidencia negativa completa: chunk-operations-evidence.json, moduleEvidence.marcar_remate. No se usa ausencia de coincidencia literal aislada como prueba; se examinaron llamadas calculadas y acciones protegidas por otros permisos.

Citas: artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[979] (artifacts/api-server/src/lib/tarea4-remate-store.ts):3; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[979] (artifacts/api-server/src/lib/tarea4-remate-store.ts):19; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[979] (artifacts/api-server/src/lib/tarea4-remate-store.ts):21; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):105; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):142; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):538; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):641; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):680; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):770; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):972; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):1111; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):1151; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):1172; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):1237; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):1277; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):1331; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):1390; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):1455; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):1514; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):1597; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):1639; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):1670; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):1715; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):1842; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):1877; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):2010; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):2147; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):2191; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):2231; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):2263; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):2364; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):2403; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):2458; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):2489; chunk-operations-evidence.json#/moduleEvidence/marcar_remate; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[925] (artifacts/api-server/src/app.ts):57-57; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[934] (artifacts/api-server/src/routes/index.ts):68-100.

IDs exactos: TERMINAL:marcar_remate:crear, CAJA:marcar_remate:crear, SUPERVISOR:marcar_remate:crear, BODEGA:marcar_remate:crear, SISTEMAS:marcar_remate:crear, CONTADOR:marcar_remate:crear.


#### Marcas de remate — Modificar (marcar_remate:editar)

Afectados (6): TERMINAL, CAJA, SUPERVISOR, BODEGA, SISTEMAS, CONTADOR.

Concedido: Ninguno. Denegado: TERMINAL, CAJA, SUPERVISOR, BODEGA, SISTEMAS, CONTADOR. ADMIN (sólo contexto): concedido.

Marcar remate sí existe, pero el adaptador consulta exclusivamente marcar_remate.puedeAutorizar. Consultar el rollo usa inventario:ver y quitar marca exige ADMIN; no consume ver/crear/editar de marcar_remate.

Por qué no se identificó: El inventario histórico dejó esta combinación como NO_OPERATION_FOUND_STATIC y luego OWNER_SEMANTICS_REQUIRED. La revisión actual no encuentra una operación enlazada a esta celda concreta. La matriz permite combinar módulos y acciones aunque algunas combinaciones no tengan consumidor. No se demuestra el motivo interno del analizador histórico ni que la función comercial no exista.

Evidencia negativa completa: chunk-operations-evidence.json, moduleEvidence.marcar_remate. No se usa ausencia de coincidencia literal aislada como prueba; se examinaron llamadas calculadas y acciones protegidas por otros permisos.

Citas: artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[979] (artifacts/api-server/src/lib/tarea4-remate-store.ts):3; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[979] (artifacts/api-server/src/lib/tarea4-remate-store.ts):19; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[979] (artifacts/api-server/src/lib/tarea4-remate-store.ts):21; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):105; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):142; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):538; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):641; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):680; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):770; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):972; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):1111; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):1151; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):1172; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):1237; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):1277; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):1331; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):1390; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):1455; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):1514; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):1597; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):1639; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):1670; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):1715; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):1842; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):1877; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):2010; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):2147; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):2191; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):2231; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):2263; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):2364; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):2403; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):2458; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):2489; chunk-operations-evidence.json#/moduleEvidence/marcar_remate; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[925] (artifacts/api-server/src/app.ts):57-57; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[934] (artifacts/api-server/src/routes/index.ts):68-100.

IDs exactos: TERMINAL:marcar_remate:editar, CAJA:marcar_remate:editar, SUPERVISOR:marcar_remate:editar, BODEGA:marcar_remate:editar, SISTEMAS:marcar_remate:editar, CONTADOR:marcar_remate:editar.


#### Marcas de remate — Consultar (marcar_remate:ver)

Afectados (6): TERMINAL, CAJA, SUPERVISOR, BODEGA, SISTEMAS, CONTADOR.

Concedido: Ninguno. Denegado: TERMINAL, CAJA, SUPERVISOR, BODEGA, SISTEMAS, CONTADOR. ADMIN (sólo contexto): concedido.

Marcar remate sí existe, pero el adaptador consulta exclusivamente marcar_remate.puedeAutorizar. Consultar el rollo usa inventario:ver y quitar marca exige ADMIN; no consume ver/crear/editar de marcar_remate.

Por qué no se identificó: El inventario histórico dejó esta combinación como NO_OPERATION_FOUND_STATIC y luego OWNER_SEMANTICS_REQUIRED. La revisión actual no encuentra una operación enlazada a esta celda concreta. La matriz permite combinar módulos y acciones aunque algunas combinaciones no tengan consumidor. No se demuestra el motivo interno del analizador histórico ni que la función comercial no exista.

Evidencia negativa completa: chunk-operations-evidence.json, moduleEvidence.marcar_remate. No se usa ausencia de coincidencia literal aislada como prueba; se examinaron llamadas calculadas y acciones protegidas por otros permisos.

Citas: artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[979] (artifacts/api-server/src/lib/tarea4-remate-store.ts):3; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[979] (artifacts/api-server/src/lib/tarea4-remate-store.ts):19; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[979] (artifacts/api-server/src/lib/tarea4-remate-store.ts):21; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):105; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):142; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):538; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):641; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):680; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):770; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):972; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):1111; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):1151; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):1172; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):1237; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):1277; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):1331; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):1390; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):1455; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):1514; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):1597; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):1639; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):1670; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):1715; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):1842; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):1877; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):2010; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):2147; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):2191; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):2231; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):2263; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):2364; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):2403; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):2458; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):2489; chunk-operations-evidence.json#/moduleEvidence/marcar_remate; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[925] (artifacts/api-server/src/app.ts):57-57; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[934] (artifacts/api-server/src/routes/index.ts):68-100.

IDs exactos: TERMINAL:marcar_remate:ver, CAJA:marcar_remate:ver, SUPERVISOR:marcar_remate:ver, BODEGA:marcar_remate:ver, SISTEMAS:marcar_remate:ver, CONTADOR:marcar_remate:ver.


#### Precios de productos — Autorizar (precios:autorizar)

Afectados (6): TERMINAL, CAJA, SUPERVISOR, BODEGA, SISTEMAS, CONTADOR.

Concedido: Ninguno. Denegado: TERMINAL, CAJA, SUPERVISOR, BODEGA, SISTEMAS, CONTADOR. ADMIN (sólo contexto): concedido.

Consulta precios:ver y cambios simples/masivos/venta por metro precios:editar. POST no significa precios:crear; no existe guard precios:autorizar.

Por qué no se identificó: El inventario histórico dejó esta combinación como NO_OPERATION_FOUND_STATIC y luego OWNER_SEMANTICS_REQUIRED. La revisión actual no encuentra una operación enlazada a esta celda concreta. La matriz permite combinar módulos y acciones aunque algunas combinaciones no tengan consumidor. No se demuestra el motivo interno del analizador histórico ni que la función comercial no exista.

Evidencia negativa completa: chunk-operations-evidence.json, moduleEvidence.precios. No se usa ausencia de coincidencia literal aislada como prueba; se examinaron llamadas calculadas y acciones protegidas por otros permisos.

Citas: artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1273] (artifacts/api-server/src/routes/precios.ts):30; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1273] (artifacts/api-server/src/routes/precios.ts):39; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1273] (artifacts/api-server/src/routes/precios.ts):182; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1273] (artifacts/api-server/src/routes/precios.ts):207; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1273] (artifacts/api-server/src/routes/precios.ts):225; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1273] (artifacts/api-server/src/routes/precios.ts):278; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1273] (artifacts/api-server/src/routes/precios.ts):374; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1273] (artifacts/api-server/src/routes/precios.ts):425; chunk-operations-evidence.json#/moduleEvidence/precios; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[925] (artifacts/api-server/src/app.ts):57-57; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[934] (artifacts/api-server/src/routes/index.ts):68-100.

IDs exactos: TERMINAL:precios:autorizar, CAJA:precios:autorizar, SUPERVISOR:precios:autorizar, BODEGA:precios:autorizar, SISTEMAS:precios:autorizar, CONTADOR:precios:autorizar.


#### Precios de productos — Crear (precios:crear)

Afectados (5): TERMINAL, CAJA, SUPERVISOR, BODEGA, CONTADOR.

Concedido: SISTEMAS. Denegado: TERMINAL, CAJA, SUPERVISOR, BODEGA, CONTADOR. ADMIN (sólo contexto): concedido.

Consulta precios:ver y cambios simples/masivos/venta por metro precios:editar. POST no significa precios:crear; no existe guard precios:autorizar.

Por qué no se identificó: El inventario histórico dejó esta combinación como NO_OPERATION_FOUND_STATIC y luego OWNER_SEMANTICS_REQUIRED. La revisión actual no encuentra una operación enlazada a esta celda concreta. La matriz permite combinar módulos y acciones aunque algunas combinaciones no tengan consumidor. No se demuestra el motivo interno del analizador histórico ni que la función comercial no exista.

Evidencia negativa completa: chunk-operations-evidence.json, moduleEvidence.precios. No se usa ausencia de coincidencia literal aislada como prueba; se examinaron llamadas calculadas y acciones protegidas por otros permisos.

Citas: artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1273] (artifacts/api-server/src/routes/precios.ts):30; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1273] (artifacts/api-server/src/routes/precios.ts):39; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1273] (artifacts/api-server/src/routes/precios.ts):182; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1273] (artifacts/api-server/src/routes/precios.ts):207; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1273] (artifacts/api-server/src/routes/precios.ts):225; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1273] (artifacts/api-server/src/routes/precios.ts):278; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1273] (artifacts/api-server/src/routes/precios.ts):374; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1273] (artifacts/api-server/src/routes/precios.ts):425; chunk-operations-evidence.json#/moduleEvidence/precios; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[925] (artifacts/api-server/src/app.ts):57-57; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[934] (artifacts/api-server/src/routes/index.ts):68-100.

IDs exactos: TERMINAL:precios:crear, CAJA:precios:crear, SUPERVISOR:precios:crear, BODEGA:precios:crear, CONTADOR:precios:crear.


### Ventas/salidas/viajes


#### Punto de venta — Autorizar (pos:autorizar)

Afectados (6): TERMINAL, CAJA, SUPERVISOR, BODEGA, SISTEMAS, CONTADOR.

Concedido: Ninguno. Denegado: TERMINAL, CAJA, SUPERVISOR, BODEGA, SISTEMAS, CONTADOR. ADMIN (sólo contexto): concedido.

POS opera con ver/crear. El wrapper requiereAlguno sólo acepta ver|crear. Editar o autorizar tickets, devoluciones/caja no equivale a consumir pos:editar/autorizar.

Por qué no se identificó: El inventario histórico dejó esta combinación como NO_OPERATION_FOUND_STATIC y luego OWNER_SEMANTICS_REQUIRED. La revisión actual no encuentra una operación enlazada a esta celda concreta. La matriz permite combinar módulos y acciones aunque algunas combinaciones no tengan consumidor. No se demuestra el motivo interno del analizador histórico ni que la función comercial no exista.

Evidencia negativa completa: chunk-operations-evidence.json, moduleEvidence.pos. No se usa ausencia de coincidencia literal aislada como prueba; se examinaron llamadas calculadas y acciones protegidas por otros permisos.

Citas: artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1246] (artifacts/api-server/src/routes/pos.ts):70; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1246] (artifacts/api-server/src/routes/pos.ts):71; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1246] (artifacts/api-server/src/routes/pos.ts):108; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1246] (artifacts/api-server/src/routes/pos.ts):207; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1246] (artifacts/api-server/src/routes/pos.ts):210; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1246] (artifacts/api-server/src/routes/pos.ts):213; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1246] (artifacts/api-server/src/routes/pos.ts):309; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1246] (artifacts/api-server/src/routes/pos.ts):324; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1246] (artifacts/api-server/src/routes/pos.ts):368; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1246] (artifacts/api-server/src/routes/pos.ts):389; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1246] (artifacts/api-server/src/routes/pos.ts):597; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1246] (artifacts/api-server/src/routes/pos.ts):662; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1246] (artifacts/api-server/src/routes/pos.ts):663; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1246] (artifacts/api-server/src/routes/pos.ts):664; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1246] (artifacts/api-server/src/routes/pos.ts):665; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1246] (artifacts/api-server/src/routes/pos.ts):670; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1246] (artifacts/api-server/src/routes/pos.ts):673; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1246] (artifacts/api-server/src/routes/pos.ts):674; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1246] (artifacts/api-server/src/routes/pos.ts):697; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1246] (artifacts/api-server/src/routes/pos.ts):752; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1246] (artifacts/api-server/src/routes/pos.ts):817; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1246] (artifacts/api-server/src/routes/pos.ts):838; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1246] (artifacts/api-server/src/routes/pos.ts):931; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1246] (artifacts/api-server/src/routes/pos.ts):997; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1246] (artifacts/api-server/src/routes/pos.ts):998; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1246] (artifacts/api-server/src/routes/pos.ts):1022; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1246] (artifacts/api-server/src/routes/pos.ts):1041; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1246] (artifacts/api-server/src/routes/pos.ts):1042; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1246] (artifacts/api-server/src/routes/pos.ts):1070; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1246] (artifacts/api-server/src/routes/pos.ts):1084; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1246] (artifacts/api-server/src/routes/pos.ts):1085; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1246] (artifacts/api-server/src/routes/pos.ts):1111; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1246] (artifacts/api-server/src/routes/pos.ts):1127; chunk-operations-evidence.json#/moduleEvidence/pos; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[925] (artifacts/api-server/src/app.ts):57-57; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[934] (artifacts/api-server/src/routes/index.ts):68-100.

IDs exactos: TERMINAL:pos:autorizar, CAJA:pos:autorizar, SUPERVISOR:pos:autorizar, BODEGA:pos:autorizar, SISTEMAS:pos:autorizar, CONTADOR:pos:autorizar.


#### Punto de venta — Modificar (pos:editar)

Afectados (6): TERMINAL, CAJA, SUPERVISOR, BODEGA, SISTEMAS, CONTADOR.

Concedido: Ninguno. Denegado: TERMINAL, CAJA, SUPERVISOR, BODEGA, SISTEMAS, CONTADOR. ADMIN (sólo contexto): concedido.

POS opera con ver/crear. El wrapper requiereAlguno sólo acepta ver|crear. Editar o autorizar tickets, devoluciones/caja no equivale a consumir pos:editar/autorizar.

Por qué no se identificó: El inventario histórico dejó esta combinación como NO_OPERATION_FOUND_STATIC y luego OWNER_SEMANTICS_REQUIRED. La revisión actual no encuentra una operación enlazada a esta celda concreta. La matriz permite combinar módulos y acciones aunque algunas combinaciones no tengan consumidor. No se demuestra el motivo interno del analizador histórico ni que la función comercial no exista.

Evidencia negativa completa: chunk-operations-evidence.json, moduleEvidence.pos. No se usa ausencia de coincidencia literal aislada como prueba; se examinaron llamadas calculadas y acciones protegidas por otros permisos.

Citas: artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1246] (artifacts/api-server/src/routes/pos.ts):70; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1246] (artifacts/api-server/src/routes/pos.ts):71; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1246] (artifacts/api-server/src/routes/pos.ts):108; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1246] (artifacts/api-server/src/routes/pos.ts):207; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1246] (artifacts/api-server/src/routes/pos.ts):210; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1246] (artifacts/api-server/src/routes/pos.ts):213; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1246] (artifacts/api-server/src/routes/pos.ts):309; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1246] (artifacts/api-server/src/routes/pos.ts):324; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1246] (artifacts/api-server/src/routes/pos.ts):368; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1246] (artifacts/api-server/src/routes/pos.ts):389; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1246] (artifacts/api-server/src/routes/pos.ts):597; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1246] (artifacts/api-server/src/routes/pos.ts):662; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1246] (artifacts/api-server/src/routes/pos.ts):663; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1246] (artifacts/api-server/src/routes/pos.ts):664; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1246] (artifacts/api-server/src/routes/pos.ts):665; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1246] (artifacts/api-server/src/routes/pos.ts):670; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1246] (artifacts/api-server/src/routes/pos.ts):673; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1246] (artifacts/api-server/src/routes/pos.ts):674; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1246] (artifacts/api-server/src/routes/pos.ts):697; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1246] (artifacts/api-server/src/routes/pos.ts):752; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1246] (artifacts/api-server/src/routes/pos.ts):817; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1246] (artifacts/api-server/src/routes/pos.ts):838; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1246] (artifacts/api-server/src/routes/pos.ts):931; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1246] (artifacts/api-server/src/routes/pos.ts):997; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1246] (artifacts/api-server/src/routes/pos.ts):998; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1246] (artifacts/api-server/src/routes/pos.ts):1022; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1246] (artifacts/api-server/src/routes/pos.ts):1041; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1246] (artifacts/api-server/src/routes/pos.ts):1042; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1246] (artifacts/api-server/src/routes/pos.ts):1070; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1246] (artifacts/api-server/src/routes/pos.ts):1084; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1246] (artifacts/api-server/src/routes/pos.ts):1085; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1246] (artifacts/api-server/src/routes/pos.ts):1111; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1246] (artifacts/api-server/src/routes/pos.ts):1127; chunk-operations-evidence.json#/moduleEvidence/pos; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[925] (artifacts/api-server/src/app.ts):57-57; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[934] (artifacts/api-server/src/routes/index.ts):68-100.

IDs exactos: TERMINAL:pos:editar, CAJA:pos:editar, SUPERVISOR:pos:editar, BODEGA:pos:editar, SISTEMAS:pos:editar, CONTADOR:pos:editar.


#### Venta de mercancía en salidas — Autorizar (salidas_venta:autorizar)

Afectados (6): TERMINAL, CAJA, SUPERVISOR, BODEGA, SISTEMAS, CONTADOR.

Concedido: Ninguno. Denegado: TERMINAL, CAJA, SUPERVISOR, BODEGA, SISTEMAS, CONTADOR. ADMIN (sólo contexto): concedido.

Venta desde salida usa salidas_venta:ver/crear. Editar salida pertenece a salidas:editar; no a salidas_venta:editar/autorizar.

Por qué no se identificó: El inventario histórico dejó esta combinación como NO_OPERATION_FOUND_STATIC y luego OWNER_SEMANTICS_REQUIRED. La revisión actual no encuentra una operación enlazada a esta celda concreta. La matriz permite combinar módulos y acciones aunque algunas combinaciones no tengan consumidor. No se demuestra el motivo interno del analizador histórico ni que la función comercial no exista.

Evidencia negativa completa: chunk-operations-evidence.json, moduleEvidence.salidas_venta. No se usa ausencia de coincidencia literal aislada como prueba; se examinaron llamadas calculadas y acciones protegidas por otros permisos.

Citas: artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1248] (artifacts/api-server/src/routes/salidas.ts):45; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1248] (artifacts/api-server/src/routes/salidas.ts):98; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1248] (artifacts/api-server/src/routes/salidas.ts):107; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1248] (artifacts/api-server/src/routes/salidas.ts):130; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1248] (artifacts/api-server/src/routes/salidas.ts):207; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1248] (artifacts/api-server/src/routes/salidas.ts):243; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1248] (artifacts/api-server/src/routes/salidas.ts):244; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1248] (artifacts/api-server/src/routes/salidas.ts):248; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1248] (artifacts/api-server/src/routes/salidas.ts):249; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1248] (artifacts/api-server/src/routes/salidas.ts):264; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1248] (artifacts/api-server/src/routes/salidas.ts):267; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1248] (artifacts/api-server/src/routes/salidas.ts):268; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1248] (artifacts/api-server/src/routes/salidas.ts):471; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1248] (artifacts/api-server/src/routes/salidas.ts):540; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1248] (artifacts/api-server/src/routes/salidas.ts):570; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1248] (artifacts/api-server/src/routes/salidas.ts):612; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1248] (artifacts/api-server/src/routes/salidas.ts):646; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1248] (artifacts/api-server/src/routes/salidas.ts):778; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1248] (artifacts/api-server/src/routes/salidas.ts):779; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1248] (artifacts/api-server/src/routes/salidas.ts):781; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1248] (artifacts/api-server/src/routes/salidas.ts):783; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1248] (artifacts/api-server/src/routes/salidas.ts):797; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1248] (artifacts/api-server/src/routes/salidas.ts):819; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1248] (artifacts/api-server/src/routes/salidas.ts):841; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1248] (artifacts/api-server/src/routes/salidas.ts):869; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1248] (artifacts/api-server/src/routes/salidas.ts):902; chunk-operations-evidence.json#/moduleEvidence/salidas_venta; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[925] (artifacts/api-server/src/app.ts):57-57; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[934] (artifacts/api-server/src/routes/index.ts):68-100.

IDs exactos: TERMINAL:salidas_venta:autorizar, CAJA:salidas_venta:autorizar, SUPERVISOR:salidas_venta:autorizar, BODEGA:salidas_venta:autorizar, SISTEMAS:salidas_venta:autorizar, CONTADOR:salidas_venta:autorizar.


#### Venta de mercancía en salidas — Modificar (salidas_venta:editar)

Afectados (6): TERMINAL, CAJA, SUPERVISOR, BODEGA, SISTEMAS, CONTADOR.

Concedido: Ninguno. Denegado: TERMINAL, CAJA, SUPERVISOR, BODEGA, SISTEMAS, CONTADOR. ADMIN (sólo contexto): concedido.

Venta desde salida usa salidas_venta:ver/crear. Editar salida pertenece a salidas:editar; no a salidas_venta:editar/autorizar.

Por qué no se identificó: El inventario histórico dejó esta combinación como NO_OPERATION_FOUND_STATIC y luego OWNER_SEMANTICS_REQUIRED. La revisión actual no encuentra una operación enlazada a esta celda concreta. La matriz permite combinar módulos y acciones aunque algunas combinaciones no tengan consumidor. No se demuestra el motivo interno del analizador histórico ni que la función comercial no exista.

Evidencia negativa completa: chunk-operations-evidence.json, moduleEvidence.salidas_venta. No se usa ausencia de coincidencia literal aislada como prueba; se examinaron llamadas calculadas y acciones protegidas por otros permisos.

Citas: artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1248] (artifacts/api-server/src/routes/salidas.ts):45; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1248] (artifacts/api-server/src/routes/salidas.ts):98; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1248] (artifacts/api-server/src/routes/salidas.ts):107; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1248] (artifacts/api-server/src/routes/salidas.ts):130; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1248] (artifacts/api-server/src/routes/salidas.ts):207; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1248] (artifacts/api-server/src/routes/salidas.ts):243; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1248] (artifacts/api-server/src/routes/salidas.ts):244; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1248] (artifacts/api-server/src/routes/salidas.ts):248; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1248] (artifacts/api-server/src/routes/salidas.ts):249; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1248] (artifacts/api-server/src/routes/salidas.ts):264; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1248] (artifacts/api-server/src/routes/salidas.ts):267; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1248] (artifacts/api-server/src/routes/salidas.ts):268; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1248] (artifacts/api-server/src/routes/salidas.ts):471; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1248] (artifacts/api-server/src/routes/salidas.ts):540; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1248] (artifacts/api-server/src/routes/salidas.ts):570; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1248] (artifacts/api-server/src/routes/salidas.ts):612; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1248] (artifacts/api-server/src/routes/salidas.ts):646; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1248] (artifacts/api-server/src/routes/salidas.ts):778; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1248] (artifacts/api-server/src/routes/salidas.ts):779; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1248] (artifacts/api-server/src/routes/salidas.ts):781; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1248] (artifacts/api-server/src/routes/salidas.ts):783; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1248] (artifacts/api-server/src/routes/salidas.ts):797; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1248] (artifacts/api-server/src/routes/salidas.ts):819; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1248] (artifacts/api-server/src/routes/salidas.ts):841; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1248] (artifacts/api-server/src/routes/salidas.ts):869; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1248] (artifacts/api-server/src/routes/salidas.ts):902; chunk-operations-evidence.json#/moduleEvidence/salidas_venta; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[925] (artifacts/api-server/src/app.ts):57-57; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[934] (artifacts/api-server/src/routes/index.ts):68-100.

IDs exactos: TERMINAL:salidas_venta:editar, CAJA:salidas_venta:editar, SUPERVISOR:salidas_venta:editar, BODEGA:salidas_venta:editar, SISTEMAS:salidas_venta:editar, CONTADOR:salidas_venta:editar.


#### Viajes de reparto — Autorizar (viajes:autorizar)

Afectados (6): TERMINAL, CAJA, SUPERVISOR, BODEGA, SISTEMAS, CONTADOR.

Concedido: Ninguno. Denegado: TERMINAL, CAJA, SUPERVISOR, BODEGA, SISTEMAS, CONTADOR. ADMIN (sólo contexto): concedido.

Viajes sólo expone catálogo/elegibles, creación y consulta con ver/crear. No hay guard viajes:editar/autorizar.

Por qué no se identificó: El inventario histórico dejó esta combinación como NO_OPERATION_FOUND_STATIC y luego OWNER_SEMANTICS_REQUIRED. La revisión actual no encuentra una operación enlazada a esta celda concreta. La matriz permite combinar módulos y acciones aunque algunas combinaciones no tengan consumidor. No se demuestra el motivo interno del analizador histórico ni que la función comercial no exista.

Evidencia negativa completa: chunk-operations-evidence.json, moduleEvidence.viajes. No se usa ausencia de coincidencia literal aislada como prueba; se examinaron llamadas calculadas y acciones protegidas por otros permisos.

Citas: artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1283] (artifacts/api-server/src/routes/viajes.ts):10; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1283] (artifacts/api-server/src/routes/viajes.ts):91; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1283] (artifacts/api-server/src/routes/viajes.ts):102; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1283] (artifacts/api-server/src/routes/viajes.ts):121; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1283] (artifacts/api-server/src/routes/viajes.ts):160; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1283] (artifacts/api-server/src/routes/viajes.ts):175; chunk-operations-evidence.json#/moduleEvidence/viajes; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[925] (artifacts/api-server/src/app.ts):57-57; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[934] (artifacts/api-server/src/routes/index.ts):68-100.

IDs exactos: TERMINAL:viajes:autorizar, CAJA:viajes:autorizar, SUPERVISOR:viajes:autorizar, BODEGA:viajes:autorizar, SISTEMAS:viajes:autorizar, CONTADOR:viajes:autorizar.


#### Viajes de reparto — Modificar (viajes:editar)

Afectados (5): TERMINAL, CAJA, SUPERVISOR, BODEGA, CONTADOR.

Concedido: SISTEMAS. Denegado: TERMINAL, CAJA, SUPERVISOR, BODEGA, CONTADOR. ADMIN (sólo contexto): concedido.

Viajes sólo expone catálogo/elegibles, creación y consulta con ver/crear. No hay guard viajes:editar/autorizar.

Por qué no se identificó: El inventario histórico dejó esta combinación como NO_OPERATION_FOUND_STATIC y luego OWNER_SEMANTICS_REQUIRED. La revisión actual no encuentra una operación enlazada a esta celda concreta. La matriz permite combinar módulos y acciones aunque algunas combinaciones no tengan consumidor. No se demuestra el motivo interno del analizador histórico ni que la función comercial no exista.

Evidencia negativa completa: chunk-operations-evidence.json, moduleEvidence.viajes. No se usa ausencia de coincidencia literal aislada como prueba; se examinaron llamadas calculadas y acciones protegidas por otros permisos.

Citas: artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1283] (artifacts/api-server/src/routes/viajes.ts):10; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1283] (artifacts/api-server/src/routes/viajes.ts):91; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1283] (artifacts/api-server/src/routes/viajes.ts):102; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1283] (artifacts/api-server/src/routes/viajes.ts):121; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1283] (artifacts/api-server/src/routes/viajes.ts):160; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1283] (artifacts/api-server/src/routes/viajes.ts):175; chunk-operations-evidence.json#/moduleEvidence/viajes; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[925] (artifacts/api-server/src/app.ts):57-57; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[934] (artifacts/api-server/src/routes/index.ts):68-100.

IDs exactos: TERMINAL:viajes:editar, CAJA:viajes:editar, SUPERVISOR:viajes:editar, BODEGA:viajes:editar, CONTADOR:viajes:editar.


### Clientes/crédito/caja


#### Abonos recibidos en caja — Autorizar (caja_abonos:autorizar)

Afectados (6): TERMINAL, CAJA, SUPERVISOR, BODEGA, SISTEMAS, CONTADOR.

Concedido: Ninguno. Denegado: TERMINAL, CAJA, SUPERVISOR, BODEGA, SISTEMAS, CONTADOR. ADMIN (sólo contexto): concedido.

E3 usa crear, incluso para contexto; E5 lee ver/crear. E5 autorizar usa reglas de actor/rol, no caja_abonos.autorizar. Serializar las cuatro banderas en clave de caché no convierte editar/autorizar en permisos de operación.

Por qué no se identificó: El inventario histórico dejó esta combinación como NO_OPERATION_FOUND_STATIC y luego OWNER_SEMANTICS_REQUIRED. La revisión actual no encuentra una operación enlazada a esta celda concreta. La matriz permite combinar módulos y acciones aunque algunas combinaciones no tengan consumidor. No se demuestra el motivo interno del analizador histórico ni que la función comercial no exista.

Evidencia negativa completa: chunk-business-evidence.json, moduleSearch.caja_abonos + guardInventory. No se usa ausencia de coincidencia literal aislada como prueba; se examinaron llamadas calculadas y acciones protegidas por otros permisos.

Citas: API routes/e3-collections.ts:25,45-50; API routes/e5.ts:18-34; UI lib/e5-authorization.ts:5-22.

IDs exactos: TERMINAL:caja_abonos:autorizar, CAJA:caja_abonos:autorizar, SUPERVISOR:caja_abonos:autorizar, BODEGA:caja_abonos:autorizar, SISTEMAS:caja_abonos:autorizar, CONTADOR:caja_abonos:autorizar.


#### Abonos recibidos en caja — Modificar (caja_abonos:editar)

Afectados (6): TERMINAL, CAJA, SUPERVISOR, BODEGA, SISTEMAS, CONTADOR.

Concedido: Ninguno. Denegado: TERMINAL, CAJA, SUPERVISOR, BODEGA, SISTEMAS, CONTADOR. ADMIN (sólo contexto): concedido.

E3 usa crear, incluso para contexto; E5 lee ver/crear. E5 autorizar usa reglas de actor/rol, no caja_abonos.autorizar. Serializar las cuatro banderas en clave de caché no convierte editar/autorizar en permisos de operación.

Por qué no se identificó: El inventario histórico dejó esta combinación como NO_OPERATION_FOUND_STATIC y luego OWNER_SEMANTICS_REQUIRED. La revisión actual no encuentra una operación enlazada a esta celda concreta. La matriz permite combinar módulos y acciones aunque algunas combinaciones no tengan consumidor. No se demuestra el motivo interno del analizador histórico ni que la función comercial no exista.

Evidencia negativa completa: chunk-business-evidence.json, moduleSearch.caja_abonos + guardInventory. No se usa ausencia de coincidencia literal aislada como prueba; se examinaron llamadas calculadas y acciones protegidas por otros permisos.

Citas: API routes/e3-collections.ts:25,45-50; API routes/e5.ts:18-34; UI lib/e5-authorization.ts:5-22.

IDs exactos: TERMINAL:caja_abonos:editar, CAJA:caja_abonos:editar, SUPERVISOR:caja_abonos:editar, BODEGA:caja_abonos:editar, SISTEMAS:caja_abonos:editar, CONTADOR:caja_abonos:editar.


#### Cobros y pagos — Autorizar (cobros_pagos:autorizar)

Afectados (6): TERMINAL, CAJA, SUPERVISOR, BODEGA, SISTEMAS, CONTADOR.

Concedido: Ninguno. Denegado: TERMINAL, CAJA, SUPERVISOR, BODEGA, SISTEMAS, CONTADOR. ADMIN (sólo contexto): concedido.

Wrapper E4 elige cobros_pagos o cortes, pero sólo ver/crear. No deriva editar/autorizar del nombre de la operación. E5 decide autorizaciones por rol, no por esta celda.

Por qué no se identificó: El inventario histórico dejó esta combinación como NO_OPERATION_FOUND_STATIC y luego OWNER_SEMANTICS_REQUIRED. La revisión actual no encuentra una operación enlazada a esta celda concreta. La matriz permite combinar módulos y acciones aunque algunas combinaciones no tengan consumidor. No se demuestra el motivo interno del analizador histórico ni que la función comercial no exista.

Evidencia negativa completa: chunk-business-evidence.json, moduleSearch.cobros_pagos + guardInventory. No se usa ausencia de coincidencia literal aislada como prueba; se examinaron llamadas calculadas y acciones protegidas por otros permisos.

Citas: API lib/e4-cash-out.ts:5-12; API routes/pos.ts:1070-1085,1127; UI App.tsx:559-581.

IDs exactos: TERMINAL:cobros_pagos:autorizar, CAJA:cobros_pagos:autorizar, SUPERVISOR:cobros_pagos:autorizar, BODEGA:cobros_pagos:autorizar, SISTEMAS:cobros_pagos:autorizar, CONTADOR:cobros_pagos:autorizar.


#### Cobros y pagos — Modificar (cobros_pagos:editar)

Afectados (6): TERMINAL, CAJA, SUPERVISOR, BODEGA, SISTEMAS, CONTADOR.

Concedido: Ninguno. Denegado: TERMINAL, CAJA, SUPERVISOR, BODEGA, SISTEMAS, CONTADOR. ADMIN (sólo contexto): concedido.

Wrapper E4 elige cobros_pagos o cortes, pero sólo ver/crear. No deriva editar/autorizar del nombre de la operación. E5 decide autorizaciones por rol, no por esta celda.

Por qué no se identificó: El inventario histórico dejó esta combinación como NO_OPERATION_FOUND_STATIC y luego OWNER_SEMANTICS_REQUIRED. La revisión actual no encuentra una operación enlazada a esta celda concreta. La matriz permite combinar módulos y acciones aunque algunas combinaciones no tengan consumidor. No se demuestra el motivo interno del analizador histórico ni que la función comercial no exista.

Evidencia negativa completa: chunk-business-evidence.json, moduleSearch.cobros_pagos + guardInventory. No se usa ausencia de coincidencia literal aislada como prueba; se examinaron llamadas calculadas y acciones protegidas por otros permisos.

Citas: API lib/e4-cash-out.ts:5-12; API routes/pos.ts:1070-1085,1127; UI App.tsx:559-581.

IDs exactos: TERMINAL:cobros_pagos:editar, CAJA:cobros_pagos:editar, SUPERVISOR:cobros_pagos:editar, BODEGA:cobros_pagos:editar, SISTEMAS:cobros_pagos:editar, CONTADOR:cobros_pagos:editar.


#### Cortes de caja — Autorizar (cortes:autorizar)

Afectados (6): TERMINAL, CAJA, SUPERVISOR, BODEGA, SISTEMAS, CONTADOR.

Concedido: Ninguno. Denegado: TERMINAL, CAJA, SUPERVISOR, BODEGA, SISTEMAS, CONTADOR. ADMIN (sólo contexto): concedido.

Ver/crear controlan cortes. Revisiones y entregas no seleccionan editar/autorizar. El wrapper E4 sólo admite ver|crear y puede elegir otro módulo.

Por qué no se identificó: El inventario histórico dejó esta combinación como NO_OPERATION_FOUND_STATIC y luego OWNER_SEMANTICS_REQUIRED. La revisión actual no encuentra una operación enlazada a esta celda concreta. La matriz permite combinar módulos y acciones aunque algunas combinaciones no tengan consumidor. No se demuestra el motivo interno del analizador histórico ni que la función comercial no exista.

Evidencia negativa completa: chunk-business-evidence.json, moduleSearch.cortes + guardInventory. No se usa ausencia de coincidencia literal aislada como prueba; se examinaron llamadas calculadas y acciones protegidas por otros permisos.

Citas: API routes/pos.ts:1022-1127; API lib/e4-cash-out.ts:5-12; API routes/e9.ts:18-19; UI components/e9-entregas-panel.tsx:26.

IDs exactos: TERMINAL:cortes:autorizar, CAJA:cortes:autorizar, SUPERVISOR:cortes:autorizar, BODEGA:cortes:autorizar, SISTEMAS:cortes:autorizar, CONTADOR:cortes:autorizar.


#### Cortes de caja — Modificar (cortes:editar)

Afectados (6): TERMINAL, CAJA, SUPERVISOR, BODEGA, SISTEMAS, CONTADOR.

Concedido: Ninguno. Denegado: TERMINAL, CAJA, SUPERVISOR, BODEGA, SISTEMAS, CONTADOR. ADMIN (sólo contexto): concedido.

Ver/crear controlan cortes. Revisiones y entregas no seleccionan editar/autorizar. El wrapper E4 sólo admite ver|crear y puede elegir otro módulo.

Por qué no se identificó: El inventario histórico dejó esta combinación como NO_OPERATION_FOUND_STATIC y luego OWNER_SEMANTICS_REQUIRED. La revisión actual no encuentra una operación enlazada a esta celda concreta. La matriz permite combinar módulos y acciones aunque algunas combinaciones no tengan consumidor. No se demuestra el motivo interno del analizador histórico ni que la función comercial no exista.

Evidencia negativa completa: chunk-business-evidence.json, moduleSearch.cortes + guardInventory. No se usa ausencia de coincidencia literal aislada como prueba; se examinaron llamadas calculadas y acciones protegidas por otros permisos.

Citas: API routes/pos.ts:1022-1127; API lib/e4-cash-out.ts:5-12; API routes/e9.ts:18-19; UI components/e9-entregas-panel.tsx:26.

IDs exactos: TERMINAL:cortes:editar, CAJA:cortes:editar, SUPERVISOR:cortes:editar, BODEGA:cortes:editar, SISTEMAS:cortes:editar, CONTADOR:cortes:editar.


#### Crédito de clientes — Autorizar (clientes_credito:autorizar)

Afectados (6): TERMINAL, CAJA, SUPERVISOR, BODEGA, SISTEMAS, CONTADOR.

Concedido: Ninguno. Denegado: TERMINAL, CAJA, SUPERVISOR, BODEGA, SISTEMAS, CONTADOR. ADMIN (sólo contexto): concedido.

Consulta usa ver y cambio de límite usa editar. Crear crédito no selecciona crear/autorizar de esta celda.

Por qué no se identificó: El inventario histórico dejó esta combinación como NO_OPERATION_FOUND_STATIC y luego OWNER_SEMANTICS_REQUIRED. La revisión actual no encuentra una operación enlazada a esta celda concreta. La matriz permite combinar módulos y acciones aunque algunas combinaciones no tengan consumidor. No se demuestra el motivo interno del analizador histórico ni que la función comercial no exista.

Evidencia negativa completa: chunk-business-evidence.json, moduleSearch.clientes_credito + guardInventory. No se usa ausencia de coincidencia literal aislada como prueba; se examinaron llamadas calculadas y acciones protegidas por otros permisos.

Citas: API routes/clientes.ts:1007,1017,1189,1259; UI pages/cliente-detail.tsx:337,343.

IDs exactos: TERMINAL:clientes_credito:autorizar, CAJA:clientes_credito:autorizar, SUPERVISOR:clientes_credito:autorizar, BODEGA:clientes_credito:autorizar, SISTEMAS:clientes_credito:autorizar, CONTADOR:clientes_credito:autorizar.


#### Crédito de clientes — Crear (clientes_credito:crear)

Afectados (6): TERMINAL, CAJA, SUPERVISOR, BODEGA, SISTEMAS, CONTADOR.

Concedido: Ninguno. Denegado: TERMINAL, CAJA, SUPERVISOR, BODEGA, SISTEMAS, CONTADOR. ADMIN (sólo contexto): concedido.

Consulta usa ver y cambio de límite usa editar. Crear crédito no selecciona crear/autorizar de esta celda.

Por qué no se identificó: El inventario histórico dejó esta combinación como NO_OPERATION_FOUND_STATIC y luego OWNER_SEMANTICS_REQUIRED. La revisión actual no encuentra una operación enlazada a esta celda concreta. La matriz permite combinar módulos y acciones aunque algunas combinaciones no tengan consumidor. No se demuestra el motivo interno del analizador histórico ni que la función comercial no exista.

Evidencia negativa completa: chunk-business-evidence.json, moduleSearch.clientes_credito + guardInventory. No se usa ausencia de coincidencia literal aislada como prueba; se examinaron llamadas calculadas y acciones protegidas por otros permisos.

Citas: API routes/clientes.ts:1007,1017,1189,1259; UI pages/cliente-detail.tsx:337,343.

IDs exactos: TERMINAL:clientes_credito:crear, CAJA:clientes_credito:crear, SUPERVISOR:clientes_credito:crear, BODEGA:clientes_credito:crear, SISTEMAS:clientes_credito:crear, CONTADOR:clientes_credito:crear.


#### Directorio de clientes — Autorizar (clientes:autorizar)

Afectados (6): TERMINAL, CAJA, SUPERVISOR, BODEGA, SISTEMAS, CONTADOR.

Concedido: Ninguno. Denegado: TERMINAL, CAJA, SUPERVISOR, BODEGA, SISTEMAS, CONTADOR. ADMIN (sólo contexto): concedido.

El directorio consume ver/crear/editar. Ajustes financieros son clientes_finanzas.autorizar, no clientes.autorizar.

Por qué no se identificó: El inventario histórico dejó esta combinación como NO_OPERATION_FOUND_STATIC y luego OWNER_SEMANTICS_REQUIRED. La revisión actual no encuentra una operación enlazada a esta celda concreta. La matriz permite combinar módulos y acciones aunque algunas combinaciones no tengan consumidor. No se demuestra el motivo interno del analizador histórico ni que la función comercial no exista.

Evidencia negativa completa: chunk-business-evidence.json, moduleSearch.clientes + guardInventory. No se usa ausencia de coincidencia literal aislada como prueba; se examinaron llamadas calculadas y acciones protegidas por otros permisos.

Citas: API routes/clientes.ts:635,683,1079,2372,2472; UI pages/cliente-detail.tsx:337-344.

IDs exactos: TERMINAL:clientes:autorizar, CAJA:clientes:autorizar, SUPERVISOR:clientes:autorizar, BODEGA:clientes:autorizar, SISTEMAS:clientes:autorizar, CONTADOR:clientes:autorizar.


#### Finanzas de clientes — Modificar (clientes_finanzas:editar)

Afectados (6): TERMINAL, CAJA, SUPERVISOR, BODEGA, SISTEMAS, CONTADOR.

Concedido: Ninguno. Denegado: TERMINAL, CAJA, SUPERVISOR, BODEGA, SISTEMAS, CONTADOR. ADMIN (sólo contexto): concedido.

Las operaciones financieras consumen ver, crear o autorizar; ninguna selecciona editar. El nombre editar de una pantalla no acredita esta celda.

Por qué no se identificó: El inventario histórico dejó esta combinación como NO_OPERATION_FOUND_STATIC y luego OWNER_SEMANTICS_REQUIRED. La revisión actual no encuentra una operación enlazada a esta celda concreta. La matriz permite combinar módulos y acciones aunque algunas combinaciones no tengan consumidor. No se demuestra el motivo interno del analizador histórico ni que la función comercial no exista.

Evidencia negativa completa: chunk-business-evidence.json, moduleSearch.clientes_finanzas + guardInventory. No se usa ausencia de coincidencia literal aislada como prueba; se examinaron llamadas calculadas y acciones protegidas por otros permisos.

Citas: API routes/clientes.ts:2109,2166,2372,2472; UI pages/cliente-detail.tsx:339-342.

IDs exactos: TERMINAL:clientes_finanzas:editar, CAJA:clientes_finanzas:editar, SUPERVISOR:clientes_finanzas:editar, BODEGA:clientes_finanzas:editar, SISTEMAS:clientes_finanzas:editar, CONTADOR:clientes_finanzas:editar.


#### Finanzas de proveedores — Modificar (proveedores_finanzas:editar)

Afectados (6): TERMINAL, CAJA, SUPERVISOR, BODEGA, SISTEMAS, CONTADOR.

Concedido: Ninguno. Denegado: TERMINAL, CAJA, SUPERVISOR, BODEGA, SISTEMAS, CONTADOR. ADMIN (sólo contexto): concedido.

Finanzas del proveedor usa ver/crear/autorizar; sus pagos/reversiones no consumen editar. El wrapper de pagos dirigidos escoge cliente/proveedor pero lee puedeCrear.

Por qué no se identificó: El inventario histórico dejó esta combinación como NO_OPERATION_FOUND_STATIC y luego OWNER_SEMANTICS_REQUIRED. La revisión actual no encuentra una operación enlazada a esta celda concreta. La matriz permite combinar módulos y acciones aunque algunas combinaciones no tengan consumidor. No se demuestra el motivo interno del analizador histórico ni que la función comercial no exista.

Evidencia negativa completa: chunk-operations-evidence.json, moduleEvidence.proveedores_finanzas. No se usa ausencia de coincidencia literal aislada como prueba; se examinaron llamadas calculadas y acciones protegidas por otros permisos.

Citas: artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[988] (artifacts/api-server/src/routes/proveedores.ts):46; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[988] (artifacts/api-server/src/routes/proveedores.ts):47; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[988] (artifacts/api-server/src/routes/proveedores.ts):74; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[988] (artifacts/api-server/src/routes/proveedores.ts):132; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[988] (artifacts/api-server/src/routes/proveedores.ts):145; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[988] (artifacts/api-server/src/routes/proveedores.ts):171; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[988] (artifacts/api-server/src/routes/proveedores.ts):183; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[988] (artifacts/api-server/src/routes/proveedores.ts):232; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[988] (artifacts/api-server/src/routes/proveedores.ts):233; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[988] (artifacts/api-server/src/routes/proveedores.ts):280; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[988] (artifacts/api-server/src/routes/proveedores.ts):286; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[988] (artifacts/api-server/src/routes/proveedores.ts):291; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[988] (artifacts/api-server/src/routes/proveedores.ts):342; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[988] (artifacts/api-server/src/routes/proveedores.ts):388; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[988] (artifacts/api-server/src/routes/proveedores.ts):419; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[988] (artifacts/api-server/src/routes/proveedores.ts):502; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[988] (artifacts/api-server/src/routes/proveedores.ts):566; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[988] (artifacts/api-server/src/routes/proveedores.ts):629; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[988] (artifacts/api-server/src/routes/proveedores.ts):672; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[988] (artifacts/api-server/src/routes/proveedores.ts):681; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[988] (artifacts/api-server/src/routes/proveedores.ts):797; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[988] (artifacts/api-server/src/routes/proveedores.ts):868; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[988] (artifacts/api-server/src/routes/proveedores.ts):907; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[988] (artifacts/api-server/src/routes/proveedores.ts):953; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[988] (artifacts/api-server/src/routes/proveedores.ts):993; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[988] (artifacts/api-server/src/routes/proveedores.ts):1052; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[988] (artifacts/api-server/src/routes/proveedores.ts):1157; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1279] (artifacts/api-server/src/routes/pagos-dirigidos.ts):24; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1279] (artifacts/api-server/src/routes/pagos-dirigidos.ts):42; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1279] (artifacts/api-server/src/routes/pagos-dirigidos.ts):275; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1279] (artifacts/api-server/src/routes/pagos-dirigidos.ts):276; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1279] (artifacts/api-server/src/routes/pagos-dirigidos.ts):278; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1279] (artifacts/api-server/src/routes/pagos-dirigidos.ts):316; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1279] (artifacts/api-server/src/routes/pagos-dirigidos.ts):317; chunk-operations-evidence.json#/moduleEvidence/proveedores_finanzas; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[925] (artifacts/api-server/src/app.ts):57-57; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[934] (artifacts/api-server/src/routes/index.ts):68-100.

IDs exactos: TERMINAL:proveedores_finanzas:editar, CAJA:proveedores_finanzas:editar, SUPERVISOR:proveedores_finanzas:editar, BODEGA:proveedores_finanzas:editar, SISTEMAS:proveedores_finanzas:editar, CONTADOR:proveedores_finanzas:editar.


#### Precios consultados por cliente — Autorizar (clientes_precios:autorizar)

Afectados (6): TERMINAL, CAJA, SUPERVISOR, BODEGA, SISTEMAS, CONTADOR.

Concedido: Ninguno. Denegado: TERMINAL, CAJA, SUPERVISOR, BODEGA, SISTEMAS, CONTADOR. ADMIN (sólo contexto): concedido.

Pestaña de precios del cliente es lectura (ver). Los cambios de precios en otro módulo no consumen clientes_precios.crear/editar/autorizar.

Por qué no se identificó: El inventario histórico dejó esta combinación como NO_OPERATION_FOUND_STATIC y luego OWNER_SEMANTICS_REQUIRED. La revisión actual no encuentra una operación enlazada a esta celda concreta. La matriz permite combinar módulos y acciones aunque algunas combinaciones no tengan consumidor. No se demuestra el motivo interno del analizador histórico ni que la función comercial no exista.

Evidencia negativa completa: chunk-business-evidence.json, moduleSearch.clientes_precios + guardInventory. No se usa ausencia de coincidencia literal aislada como prueba; se examinaron llamadas calculadas y acciones protegidas por otros permisos.

Citas: API routes/clientes.ts:1318; UI pages/cliente-detail.tsx:338.

IDs exactos: TERMINAL:clientes_precios:autorizar, CAJA:clientes_precios:autorizar, SUPERVISOR:clientes_precios:autorizar, BODEGA:clientes_precios:autorizar, SISTEMAS:clientes_precios:autorizar, CONTADOR:clientes_precios:autorizar.


#### Precios consultados por cliente — Crear (clientes_precios:crear)

Afectados (6): TERMINAL, CAJA, SUPERVISOR, BODEGA, SISTEMAS, CONTADOR.

Concedido: Ninguno. Denegado: TERMINAL, CAJA, SUPERVISOR, BODEGA, SISTEMAS, CONTADOR. ADMIN (sólo contexto): concedido.

Pestaña de precios del cliente es lectura (ver). Los cambios de precios en otro módulo no consumen clientes_precios.crear/editar/autorizar.

Por qué no se identificó: El inventario histórico dejó esta combinación como NO_OPERATION_FOUND_STATIC y luego OWNER_SEMANTICS_REQUIRED. La revisión actual no encuentra una operación enlazada a esta celda concreta. La matriz permite combinar módulos y acciones aunque algunas combinaciones no tengan consumidor. No se demuestra el motivo interno del analizador histórico ni que la función comercial no exista.

Evidencia negativa completa: chunk-business-evidence.json, moduleSearch.clientes_precios + guardInventory. No se usa ausencia de coincidencia literal aislada como prueba; se examinaron llamadas calculadas y acciones protegidas por otros permisos.

Citas: API routes/clientes.ts:1318; UI pages/cliente-detail.tsx:338.

IDs exactos: TERMINAL:clientes_precios:crear, CAJA:clientes_precios:crear, SUPERVISOR:clientes_precios:crear, BODEGA:clientes_precios:crear, SISTEMAS:clientes_precios:crear, CONTADOR:clientes_precios:crear.


#### Precios consultados por cliente — Modificar (clientes_precios:editar)

Afectados (6): TERMINAL, CAJA, SUPERVISOR, BODEGA, SISTEMAS, CONTADOR.

Concedido: Ninguno. Denegado: TERMINAL, CAJA, SUPERVISOR, BODEGA, SISTEMAS, CONTADOR. ADMIN (sólo contexto): concedido.

Pestaña de precios del cliente es lectura (ver). Los cambios de precios en otro módulo no consumen clientes_precios.crear/editar/autorizar.

Por qué no se identificó: El inventario histórico dejó esta combinación como NO_OPERATION_FOUND_STATIC y luego OWNER_SEMANTICS_REQUIRED. La revisión actual no encuentra una operación enlazada a esta celda concreta. La matriz permite combinar módulos y acciones aunque algunas combinaciones no tengan consumidor. No se demuestra el motivo interno del analizador histórico ni que la función comercial no exista.

Evidencia negativa completa: chunk-business-evidence.json, moduleSearch.clientes_precios + guardInventory. No se usa ausencia de coincidencia literal aislada como prueba; se examinaron llamadas calculadas y acciones protegidas por otros permisos.

Citas: API routes/clientes.ts:1318; UI pages/cliente-detail.tsx:338.

IDs exactos: TERMINAL:clientes_precios:editar, CAJA:clientes_precios:editar, SUPERVISOR:clientes_precios:editar, BODEGA:clientes_precios:editar, SISTEMAS:clientes_precios:editar, CONTADOR:clientes_precios:editar.


#### Recapturas de cobros de clientes — Autorizar (clientes_recapturas:autorizar)

Afectados (6): TERMINAL, CAJA, SUPERVISOR, BODEGA, SISTEMAS, CONTADOR.

Concedido: Ninguno. Denegado: TERMINAL, CAJA, SUPERVISOR, BODEGA, SISTEMAS, CONTADOR. ADMIN (sólo contexto): concedido.

El bucle E3 enlaza module=clientes_recapturas con acción crear en ambas rutas. Recibos exigen ADMIN, no ver/editar/autorizar de recapturas.

Por qué no se identificó: El inventario histórico dejó esta combinación como NO_OPERATION_FOUND_STATIC y luego OWNER_SEMANTICS_REQUIRED. La revisión actual no encuentra una operación enlazada a esta celda concreta. La matriz permite combinar módulos y acciones aunque algunas combinaciones no tengan consumidor. No se demuestra el motivo interno del analizador histórico ni que la función comercial no exista.

Evidencia negativa completa: chunk-business-evidence.json, moduleSearch.clientes_recapturas + guardInventory. No se usa ausencia de coincidencia literal aislada como prueba; se examinaron llamadas calculadas y acciones protegidas por otros permisos.

Citas: API routes/e3-collections.ts:45-50,52-75; UI pages/cliente-detail.tsx:345.

IDs exactos: TERMINAL:clientes_recapturas:autorizar, CAJA:clientes_recapturas:autorizar, SUPERVISOR:clientes_recapturas:autorizar, BODEGA:clientes_recapturas:autorizar, SISTEMAS:clientes_recapturas:autorizar, CONTADOR:clientes_recapturas:autorizar.


#### Recapturas de cobros de clientes — Modificar (clientes_recapturas:editar)

Afectados (6): TERMINAL, CAJA, SUPERVISOR, BODEGA, SISTEMAS, CONTADOR.

Concedido: Ninguno. Denegado: TERMINAL, CAJA, SUPERVISOR, BODEGA, SISTEMAS, CONTADOR. ADMIN (sólo contexto): concedido.

El bucle E3 enlaza module=clientes_recapturas con acción crear en ambas rutas. Recibos exigen ADMIN, no ver/editar/autorizar de recapturas.

Por qué no se identificó: El inventario histórico dejó esta combinación como NO_OPERATION_FOUND_STATIC y luego OWNER_SEMANTICS_REQUIRED. La revisión actual no encuentra una operación enlazada a esta celda concreta. La matriz permite combinar módulos y acciones aunque algunas combinaciones no tengan consumidor. No se demuestra el motivo interno del analizador histórico ni que la función comercial no exista.

Evidencia negativa completa: chunk-business-evidence.json, moduleSearch.clientes_recapturas + guardInventory. No se usa ausencia de coincidencia literal aislada como prueba; se examinaron llamadas calculadas y acciones protegidas por otros permisos.

Citas: API routes/e3-collections.ts:45-50,52-75; UI pages/cliente-detail.tsx:345.

IDs exactos: TERMINAL:clientes_recapturas:editar, CAJA:clientes_recapturas:editar, SUPERVISOR:clientes_recapturas:editar, BODEGA:clientes_recapturas:editar, SISTEMAS:clientes_recapturas:editar, CONTADOR:clientes_recapturas:editar.


#### Recapturas de cobros de clientes — Consultar (clientes_recapturas:ver)

Afectados (6): TERMINAL, CAJA, SUPERVISOR, BODEGA, SISTEMAS, CONTADOR.

Concedido: Ninguno. Denegado: TERMINAL, CAJA, SUPERVISOR, BODEGA, SISTEMAS, CONTADOR. ADMIN (sólo contexto): concedido.

El bucle E3 enlaza module=clientes_recapturas con acción crear en ambas rutas. Recibos exigen ADMIN, no ver/editar/autorizar de recapturas.

Por qué no se identificó: El inventario histórico dejó esta combinación como NO_OPERATION_FOUND_STATIC y luego OWNER_SEMANTICS_REQUIRED. La revisión actual no encuentra una operación enlazada a esta celda concreta. La matriz permite combinar módulos y acciones aunque algunas combinaciones no tengan consumidor. No se demuestra el motivo interno del analizador histórico ni que la función comercial no exista.

Evidencia negativa completa: chunk-business-evidence.json, moduleSearch.clientes_recapturas + guardInventory. No se usa ausencia de coincidencia literal aislada como prueba; se examinaron llamadas calculadas y acciones protegidas por otros permisos.

Citas: API routes/e3-collections.ts:45-50,52-75; UI pages/cliente-detail.tsx:345.

IDs exactos: TERMINAL:clientes_recapturas:ver, CAJA:clientes_recapturas:ver, SUPERVISOR:clientes_recapturas:ver, BODEGA:clientes_recapturas:ver, SISTEMAS:clientes_recapturas:ver, CONTADOR:clientes_recapturas:ver.


#### Resumen de caja — Autorizar (resumen_caja:autorizar)

Afectados (6): TERMINAL, CAJA, SUPERVISOR, BODEGA, SISTEMAS, CONTADOR.

Concedido: Ninguno. Denegado: TERMINAL, CAJA, SUPERVISOR, BODEGA, SISTEMAS, CONTADOR. ADMIN (sólo contexto): concedido.

Resumen y lista de ventas consumen resumen_caja:ver. Escrituras de caja/ventas usan otros módulos; no crear/editar/autorizar de resumen_caja.

Por qué no se identificó: El inventario histórico dejó esta combinación como NO_OPERATION_FOUND_STATIC y luego OWNER_SEMANTICS_REQUIRED. La revisión actual no encuentra una operación enlazada a esta celda concreta. La matriz permite combinar módulos y acciones aunque algunas combinaciones no tengan consumidor. No se demuestra el motivo interno del analizador histórico ni que la función comercial no exista.

Evidencia negativa completa: chunk-operations-evidence.json, moduleEvidence.resumen_caja. No se usa ausencia de coincidencia literal aislada como prueba; se examinaron llamadas calculadas y acciones protegidas por otros permisos.

Citas: artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1290] (artifacts/api-server/src/routes/caja-ventas.ts):17; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1290] (artifacts/api-server/src/routes/caja-ventas.ts):26; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1290] (artifacts/api-server/src/routes/caja-ventas.ts):65; chunk-operations-evidence.json#/moduleEvidence/resumen_caja; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[925] (artifacts/api-server/src/app.ts):57-57; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[934] (artifacts/api-server/src/routes/index.ts):68-100.

IDs exactos: TERMINAL:resumen_caja:autorizar, CAJA:resumen_caja:autorizar, SUPERVISOR:resumen_caja:autorizar, BODEGA:resumen_caja:autorizar, SISTEMAS:resumen_caja:autorizar, CONTADOR:resumen_caja:autorizar.


#### Resumen de caja — Crear (resumen_caja:crear)

Afectados (6): TERMINAL, CAJA, SUPERVISOR, BODEGA, SISTEMAS, CONTADOR.

Concedido: Ninguno. Denegado: TERMINAL, CAJA, SUPERVISOR, BODEGA, SISTEMAS, CONTADOR. ADMIN (sólo contexto): concedido.

Resumen y lista de ventas consumen resumen_caja:ver. Escrituras de caja/ventas usan otros módulos; no crear/editar/autorizar de resumen_caja.

Por qué no se identificó: El inventario histórico dejó esta combinación como NO_OPERATION_FOUND_STATIC y luego OWNER_SEMANTICS_REQUIRED. La revisión actual no encuentra una operación enlazada a esta celda concreta. La matriz permite combinar módulos y acciones aunque algunas combinaciones no tengan consumidor. No se demuestra el motivo interno del analizador histórico ni que la función comercial no exista.

Evidencia negativa completa: chunk-operations-evidence.json, moduleEvidence.resumen_caja. No se usa ausencia de coincidencia literal aislada como prueba; se examinaron llamadas calculadas y acciones protegidas por otros permisos.

Citas: artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1290] (artifacts/api-server/src/routes/caja-ventas.ts):17; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1290] (artifacts/api-server/src/routes/caja-ventas.ts):26; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1290] (artifacts/api-server/src/routes/caja-ventas.ts):65; chunk-operations-evidence.json#/moduleEvidence/resumen_caja; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[925] (artifacts/api-server/src/app.ts):57-57; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[934] (artifacts/api-server/src/routes/index.ts):68-100.

IDs exactos: TERMINAL:resumen_caja:crear, CAJA:resumen_caja:crear, SUPERVISOR:resumen_caja:crear, BODEGA:resumen_caja:crear, SISTEMAS:resumen_caja:crear, CONTADOR:resumen_caja:crear.


#### Resumen de caja — Modificar (resumen_caja:editar)

Afectados (6): TERMINAL, CAJA, SUPERVISOR, BODEGA, SISTEMAS, CONTADOR.

Concedido: Ninguno. Denegado: TERMINAL, CAJA, SUPERVISOR, BODEGA, SISTEMAS, CONTADOR. ADMIN (sólo contexto): concedido.

Resumen y lista de ventas consumen resumen_caja:ver. Escrituras de caja/ventas usan otros módulos; no crear/editar/autorizar de resumen_caja.

Por qué no se identificó: El inventario histórico dejó esta combinación como NO_OPERATION_FOUND_STATIC y luego OWNER_SEMANTICS_REQUIRED. La revisión actual no encuentra una operación enlazada a esta celda concreta. La matriz permite combinar módulos y acciones aunque algunas combinaciones no tengan consumidor. No se demuestra el motivo interno del analizador histórico ni que la función comercial no exista.

Evidencia negativa completa: chunk-operations-evidence.json, moduleEvidence.resumen_caja. No se usa ausencia de coincidencia literal aislada como prueba; se examinaron llamadas calculadas y acciones protegidas por otros permisos.

Citas: artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1290] (artifacts/api-server/src/routes/caja-ventas.ts):17; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1290] (artifacts/api-server/src/routes/caja-ventas.ts):26; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1290] (artifacts/api-server/src/routes/caja-ventas.ts):65; chunk-operations-evidence.json#/moduleEvidence/resumen_caja; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[925] (artifacts/api-server/src/app.ts):57-57; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[934] (artifacts/api-server/src/routes/index.ts):68-100.

IDs exactos: TERMINAL:resumen_caja:editar, CAJA:resumen_caja:editar, SUPERVISOR:resumen_caja:editar, BODEGA:resumen_caja:editar, SISTEMAS:resumen_caja:editar, CONTADOR:resumen_caja:editar.


### Directorios


#### Directorio de camionetas — Autorizar (camionetas:autorizar)

Afectados (6): TERMINAL, CAJA, SUPERVISOR, BODEGA, SISTEMAS, CONTADOR.

Concedido: Ninguno. Denegado: TERMINAL, CAJA, SUPERVISOR, BODEGA, SISTEMAS, CONTADOR. ADMIN (sólo contexto): concedido.

Wrapper requiereGestorCamionetas recibe crear/editar; no autorizar. Roles gestores adicionales no son consumo de autorizar.

Por qué no se identificó: El inventario histórico dejó esta combinación como NO_OPERATION_FOUND_STATIC y luego OWNER_SEMANTICS_REQUIRED. La revisión actual no encuentra una operación enlazada a esta celda concreta. La matriz permite combinar módulos y acciones aunque algunas combinaciones no tengan consumidor. No se demuestra el motivo interno del analizador histórico ni que la función comercial no exista.

Evidencia negativa completa: chunk-business-evidence.json, moduleSearch.camionetas + guardInventory. No se usa ausencia de coincidencia literal aislada como prueba; se examinaron llamadas calculadas y acciones protegidas por otros permisos.

Citas: API routes/camionetas.ts:35-38,65,111; UI pages/configuracion/camionetas.tsx:58.

IDs exactos: TERMINAL:camionetas:autorizar, CAJA:camionetas:autorizar, SUPERVISOR:camionetas:autorizar, BODEGA:camionetas:autorizar, SISTEMAS:camionetas:autorizar, CONTADOR:camionetas:autorizar.


#### Directorio de choferes — Autorizar (choferes:autorizar)

Afectados (6): TERMINAL, CAJA, SUPERVISOR, BODEGA, SISTEMAS, CONTADOR.

Concedido: Ninguno. Denegado: TERMINAL, CAJA, SUPERVISOR, BODEGA, SISTEMAS, CONTADOR. ADMIN (sólo contexto): concedido.

Wrapper de gestores consume crear/editar. No hay llamada con autorizar, aunque existan restricciones por rol.

Por qué no se identificó: El inventario histórico dejó esta combinación como NO_OPERATION_FOUND_STATIC y luego OWNER_SEMANTICS_REQUIRED. La revisión actual no encuentra una operación enlazada a esta celda concreta. La matriz permite combinar módulos y acciones aunque algunas combinaciones no tengan consumidor. No se demuestra el motivo interno del analizador histórico ni que la función comercial no exista.

Evidencia negativa completa: chunk-business-evidence.json, moduleSearch.choferes + guardInventory. No se usa ausencia de coincidencia literal aislada como prueba; se examinaron llamadas calculadas y acciones protegidas por otros permisos.

Citas: API routes/choferes.ts:64-67,87,155; UI pages/configuracion/choferes.tsx:73-75.

IDs exactos: TERMINAL:choferes:autorizar, CAJA:choferes:autorizar, SUPERVISOR:choferes:autorizar, BODEGA:choferes:autorizar, SISTEMAS:choferes:autorizar, CONTADOR:choferes:autorizar.


#### Directorio de proveedores — Autorizar (proveedores:autorizar)

Afectados (6): TERMINAL, CAJA, SUPERVISOR, BODEGA, SISTEMAS, CONTADOR.

Concedido: Ninguno. Denegado: TERMINAL, CAJA, SUPERVISOR, BODEGA, SISTEMAS, CONTADOR. ADMIN (sólo contexto): concedido.

Catálogo usa ver/crear/editar; las autorizaciones financieras consultan proveedores_finanzas:autorizar, no proveedores:autorizar.

Por qué no se identificó: El inventario histórico dejó esta combinación como NO_OPERATION_FOUND_STATIC y luego OWNER_SEMANTICS_REQUIRED. La revisión actual no encuentra una operación enlazada a esta celda concreta. La matriz permite combinar módulos y acciones aunque algunas combinaciones no tengan consumidor. No se demuestra el motivo interno del analizador histórico ni que la función comercial no exista.

Evidencia negativa completa: chunk-operations-evidence.json, moduleEvidence.proveedores. No se usa ausencia de coincidencia literal aislada como prueba; se examinaron llamadas calculadas y acciones protegidas por otros permisos.

Citas: artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[988] (artifacts/api-server/src/routes/proveedores.ts):46; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[988] (artifacts/api-server/src/routes/proveedores.ts):47; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[988] (artifacts/api-server/src/routes/proveedores.ts):74; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[988] (artifacts/api-server/src/routes/proveedores.ts):132; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[988] (artifacts/api-server/src/routes/proveedores.ts):145; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[988] (artifacts/api-server/src/routes/proveedores.ts):171; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[988] (artifacts/api-server/src/routes/proveedores.ts):183; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[988] (artifacts/api-server/src/routes/proveedores.ts):232; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[988] (artifacts/api-server/src/routes/proveedores.ts):233; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[988] (artifacts/api-server/src/routes/proveedores.ts):280; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[988] (artifacts/api-server/src/routes/proveedores.ts):286; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[988] (artifacts/api-server/src/routes/proveedores.ts):291; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[988] (artifacts/api-server/src/routes/proveedores.ts):342; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[988] (artifacts/api-server/src/routes/proveedores.ts):388; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[988] (artifacts/api-server/src/routes/proveedores.ts):419; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[988] (artifacts/api-server/src/routes/proveedores.ts):502; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[988] (artifacts/api-server/src/routes/proveedores.ts):566; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[988] (artifacts/api-server/src/routes/proveedores.ts):629; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[988] (artifacts/api-server/src/routes/proveedores.ts):672; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[988] (artifacts/api-server/src/routes/proveedores.ts):681; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[988] (artifacts/api-server/src/routes/proveedores.ts):797; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[988] (artifacts/api-server/src/routes/proveedores.ts):868; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[988] (artifacts/api-server/src/routes/proveedores.ts):907; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[988] (artifacts/api-server/src/routes/proveedores.ts):953; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[988] (artifacts/api-server/src/routes/proveedores.ts):993; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[988] (artifacts/api-server/src/routes/proveedores.ts):1052; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[988] (artifacts/api-server/src/routes/proveedores.ts):1157; chunk-operations-evidence.json#/moduleEvidence/proveedores; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[925] (artifacts/api-server/src/app.ts):57-57; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[934] (artifacts/api-server/src/routes/index.ts):68-100.

IDs exactos: TERMINAL:proveedores:autorizar, CAJA:proveedores:autorizar, SUPERVISOR:proveedores:autorizar, BODEGA:proveedores:autorizar, SISTEMAS:proveedores:autorizar, CONTADOR:proveedores:autorizar.


#### Equipos de trabajo — Autorizar (equipos:autorizar)

Afectados (6): TERMINAL, CAJA, SUPERVISOR, BODEGA, SISTEMAS, CONTADOR.

Concedido: Ninguno. Denegado: TERMINAL, CAJA, SUPERVISOR, BODEGA, SISTEMAS, CONTADOR. ADMIN (sólo contexto): concedido.

Alta usa crear y cambios/desactivación editar; ninguna operación selecciona equipos.autorizar.

Por qué no se identificó: El inventario histórico dejó esta combinación como NO_OPERATION_FOUND_STATIC y luego OWNER_SEMANTICS_REQUIRED. La revisión actual no encuentra una operación enlazada a esta celda concreta. La matriz permite combinar módulos y acciones aunque algunas combinaciones no tengan consumidor. No se demuestra el motivo interno del analizador histórico ni que la función comercial no exista.

Evidencia negativa completa: chunk-business-evidence.json, moduleSearch.equipos + guardInventory. No se usa ausencia de coincidencia literal aislada como prueba; se examinaron llamadas calculadas y acciones protegidas por otros permisos.

Citas: API routes/equipos.ts:208,242,276,352,470; UI pages/equipos/index.tsx:64-65.

IDs exactos: TERMINAL:equipos:autorizar, CAJA:equipos:autorizar, SUPERVISOR:equipos:autorizar, BODEGA:equipos:autorizar, SISTEMAS:equipos:autorizar, CONTADOR:equipos:autorizar.


#### Tiendas y bodegas — Autorizar (ubicaciones:autorizar)

Afectados (6): TERMINAL, CAJA, SUPERVISOR, BODEGA, SISTEMAS, CONTADOR.

Concedido: Ninguno. Denegado: TERMINAL, CAJA, SUPERVISOR, BODEGA, SISTEMAS, CONTADOR. ADMIN (sólo contexto): concedido.

Sitios y pisos usan ver/crear/editar. No se consume ubicaciones:autorizar.

Por qué no se identificó: El inventario histórico dejó esta combinación como NO_OPERATION_FOUND_STATIC y luego OWNER_SEMANTICS_REQUIRED. La revisión actual no encuentra una operación enlazada a esta celda concreta. La matriz permite combinar módulos y acciones aunque algunas combinaciones no tengan consumidor. No se demuestra el motivo interno del analizador histórico ni que la función comercial no exista.

Evidencia negativa completa: chunk-operations-evidence.json, moduleEvidence.ubicaciones. No se usa ausencia de coincidencia literal aislada como prueba; se examinaron llamadas calculadas y acciones protegidas por otros permisos.

Citas: artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[969] (artifacts/api-server/src/routes/locations.ts):27; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[969] (artifacts/api-server/src/routes/locations.ts):35; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[969] (artifacts/api-server/src/routes/locations.ts):39; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[969] (artifacts/api-server/src/routes/locations.ts):73; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[969] (artifacts/api-server/src/routes/locations.ts):111; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[969] (artifacts/api-server/src/routes/locations.ts):188; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[969] (artifacts/api-server/src/routes/locations.ts):206; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[969] (artifacts/api-server/src/routes/locations.ts):235; chunk-operations-evidence.json#/moduleEvidence/ubicaciones; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[925] (artifacts/api-server/src/app.ts):57-57; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[934] (artifacts/api-server/src/routes/index.ts):68-100.

IDs exactos: TERMINAL:ubicaciones:autorizar, CAJA:ubicaciones:autorizar, SUPERVISOR:ubicaciones:autorizar, BODEGA:ubicaciones:autorizar, SISTEMAS:ubicaciones:autorizar, CONTADOR:ubicaciones:autorizar.


### Administración/reportes


#### Administración de permisos — Autorizar (permisos:autorizar)

Afectados (6): TERMINAL, CAJA, SUPERVISOR, BODEGA, SISTEMAS, CONTADOR.

Concedido: Ninguno. Denegado: TERMINAL, CAJA, SUPERVISOR, BODEGA, SISTEMAS, CONTADOR. ADMIN (sólo contexto): concedido.

El editor administra matrices con permisos:ver/editar. Validar cualquier columna del módulo editado para evitar escalación no constituye una operación permisos:crear/autorizar.

Por qué no se identificó: El inventario histórico dejó esta combinación como NO_OPERATION_FOUND_STATIC y luego OWNER_SEMANTICS_REQUIRED. La revisión actual no encuentra una operación enlazada a esta celda concreta. La matriz permite combinar módulos y acciones aunque algunas combinaciones no tengan consumidor. No se demuestra el motivo interno del analizador histórico ni que la función comercial no exista.

Evidencia negativa completa: chunk-operations-evidence.json, moduleEvidence.permisos. No se usa ausencia de coincidencia literal aislada como prueba; se examinaron llamadas calculadas y acciones protegidas por otros permisos.

Citas: artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1245] (artifacts/api-server/src/routes/permisos.ts):23; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1245] (artifacts/api-server/src/routes/permisos.ts):26; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1245] (artifacts/api-server/src/routes/permisos.ts):33; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1245] (artifacts/api-server/src/routes/permisos.ts):76; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1245] (artifacts/api-server/src/routes/permisos.ts):111; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1245] (artifacts/api-server/src/routes/permisos.ts):117; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1245] (artifacts/api-server/src/routes/permisos.ts):118; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1245] (artifacts/api-server/src/routes/permisos.ts):119; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1245] (artifacts/api-server/src/routes/permisos.ts):120; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1245] (artifacts/api-server/src/routes/permisos.ts):123; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1245] (artifacts/api-server/src/routes/permisos.ts):129; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1245] (artifacts/api-server/src/routes/permisos.ts):137; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1245] (artifacts/api-server/src/routes/permisos.ts):143; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1245] (artifacts/api-server/src/routes/permisos.ts):144; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1245] (artifacts/api-server/src/routes/permisos.ts):145; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1245] (artifacts/api-server/src/routes/permisos.ts):146; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1245] (artifacts/api-server/src/routes/permisos.ts):154; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1245] (artifacts/api-server/src/routes/permisos.ts):165; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1245] (artifacts/api-server/src/routes/permisos.ts):166; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1245] (artifacts/api-server/src/routes/permisos.ts):167; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1245] (artifacts/api-server/src/routes/permisos.ts):168; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1245] (artifacts/api-server/src/routes/permisos.ts):196; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1245] (artifacts/api-server/src/routes/permisos.ts):197; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1245] (artifacts/api-server/src/routes/permisos.ts):200; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1245] (artifacts/api-server/src/routes/permisos.ts):210; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1245] (artifacts/api-server/src/routes/permisos.ts):211; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1245] (artifacts/api-server/src/routes/permisos.ts):212; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1245] (artifacts/api-server/src/routes/permisos.ts):213; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1245] (artifacts/api-server/src/routes/permisos.ts):219; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1245] (artifacts/api-server/src/routes/permisos.ts):220; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1245] (artifacts/api-server/src/routes/permisos.ts):221; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1245] (artifacts/api-server/src/routes/permisos.ts):222; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1245] (artifacts/api-server/src/routes/permisos.ts):236; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1245] (artifacts/api-server/src/routes/permisos.ts):237; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1245] (artifacts/api-server/src/routes/permisos.ts):238; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1245] (artifacts/api-server/src/routes/permisos.ts):239; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1245] (artifacts/api-server/src/routes/permisos.ts):242; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1245] (artifacts/api-server/src/routes/permisos.ts):309; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1245] (artifacts/api-server/src/routes/permisos.ts):366; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1245] (artifacts/api-server/src/routes/permisos.ts):367; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1245] (artifacts/api-server/src/routes/permisos.ts):368; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1245] (artifacts/api-server/src/routes/permisos.ts):369; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1245] (artifacts/api-server/src/routes/permisos.ts):372; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1245] (artifacts/api-server/src/routes/permisos.ts):399; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1245] (artifacts/api-server/src/routes/permisos.ts):400; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1245] (artifacts/api-server/src/routes/permisos.ts):403; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1245] (artifacts/api-server/src/routes/permisos.ts):432; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1245] (artifacts/api-server/src/routes/permisos.ts):433; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1245] (artifacts/api-server/src/routes/permisos.ts):434; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1245] (artifacts/api-server/src/routes/permisos.ts):435; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1245] (artifacts/api-server/src/routes/permisos.ts):441; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1245] (artifacts/api-server/src/routes/permisos.ts):442; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1245] (artifacts/api-server/src/routes/permisos.ts):443; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1245] (artifacts/api-server/src/routes/permisos.ts):444; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1245] (artifacts/api-server/src/routes/permisos.ts):458; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1245] (artifacts/api-server/src/routes/permisos.ts):459; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1245] (artifacts/api-server/src/routes/permisos.ts):460; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1245] (artifacts/api-server/src/routes/permisos.ts):461; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1245] (artifacts/api-server/src/routes/permisos.ts):464; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1245] (artifacts/api-server/src/routes/permisos.ts):486; chunk-operations-evidence.json#/moduleEvidence/permisos; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[925] (artifacts/api-server/src/app.ts):57-57; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[934] (artifacts/api-server/src/routes/index.ts):68-100.

IDs exactos: TERMINAL:permisos:autorizar, CAJA:permisos:autorizar, SUPERVISOR:permisos:autorizar, BODEGA:permisos:autorizar, SISTEMAS:permisos:autorizar, CONTADOR:permisos:autorizar.


#### Administración de permisos — Crear (permisos:crear)

Afectados (6): TERMINAL, CAJA, SUPERVISOR, BODEGA, SISTEMAS, CONTADOR.

Concedido: Ninguno. Denegado: TERMINAL, CAJA, SUPERVISOR, BODEGA, SISTEMAS, CONTADOR. ADMIN (sólo contexto): concedido.

El editor administra matrices con permisos:ver/editar. Validar cualquier columna del módulo editado para evitar escalación no constituye una operación permisos:crear/autorizar.

Por qué no se identificó: El inventario histórico dejó esta combinación como NO_OPERATION_FOUND_STATIC y luego OWNER_SEMANTICS_REQUIRED. La revisión actual no encuentra una operación enlazada a esta celda concreta. La matriz permite combinar módulos y acciones aunque algunas combinaciones no tengan consumidor. No se demuestra el motivo interno del analizador histórico ni que la función comercial no exista.

Evidencia negativa completa: chunk-operations-evidence.json, moduleEvidence.permisos. No se usa ausencia de coincidencia literal aislada como prueba; se examinaron llamadas calculadas y acciones protegidas por otros permisos.

Citas: artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1245] (artifacts/api-server/src/routes/permisos.ts):23; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1245] (artifacts/api-server/src/routes/permisos.ts):26; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1245] (artifacts/api-server/src/routes/permisos.ts):33; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1245] (artifacts/api-server/src/routes/permisos.ts):76; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1245] (artifacts/api-server/src/routes/permisos.ts):111; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1245] (artifacts/api-server/src/routes/permisos.ts):117; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1245] (artifacts/api-server/src/routes/permisos.ts):118; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1245] (artifacts/api-server/src/routes/permisos.ts):119; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1245] (artifacts/api-server/src/routes/permisos.ts):120; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1245] (artifacts/api-server/src/routes/permisos.ts):123; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1245] (artifacts/api-server/src/routes/permisos.ts):129; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1245] (artifacts/api-server/src/routes/permisos.ts):137; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1245] (artifacts/api-server/src/routes/permisos.ts):143; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1245] (artifacts/api-server/src/routes/permisos.ts):144; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1245] (artifacts/api-server/src/routes/permisos.ts):145; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1245] (artifacts/api-server/src/routes/permisos.ts):146; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1245] (artifacts/api-server/src/routes/permisos.ts):154; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1245] (artifacts/api-server/src/routes/permisos.ts):165; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1245] (artifacts/api-server/src/routes/permisos.ts):166; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1245] (artifacts/api-server/src/routes/permisos.ts):167; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1245] (artifacts/api-server/src/routes/permisos.ts):168; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1245] (artifacts/api-server/src/routes/permisos.ts):196; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1245] (artifacts/api-server/src/routes/permisos.ts):197; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1245] (artifacts/api-server/src/routes/permisos.ts):200; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1245] (artifacts/api-server/src/routes/permisos.ts):210; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1245] (artifacts/api-server/src/routes/permisos.ts):211; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1245] (artifacts/api-server/src/routes/permisos.ts):212; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1245] (artifacts/api-server/src/routes/permisos.ts):213; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1245] (artifacts/api-server/src/routes/permisos.ts):219; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1245] (artifacts/api-server/src/routes/permisos.ts):220; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1245] (artifacts/api-server/src/routes/permisos.ts):221; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1245] (artifacts/api-server/src/routes/permisos.ts):222; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1245] (artifacts/api-server/src/routes/permisos.ts):236; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1245] (artifacts/api-server/src/routes/permisos.ts):237; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1245] (artifacts/api-server/src/routes/permisos.ts):238; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1245] (artifacts/api-server/src/routes/permisos.ts):239; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1245] (artifacts/api-server/src/routes/permisos.ts):242; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1245] (artifacts/api-server/src/routes/permisos.ts):309; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1245] (artifacts/api-server/src/routes/permisos.ts):366; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1245] (artifacts/api-server/src/routes/permisos.ts):367; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1245] (artifacts/api-server/src/routes/permisos.ts):368; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1245] (artifacts/api-server/src/routes/permisos.ts):369; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1245] (artifacts/api-server/src/routes/permisos.ts):372; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1245] (artifacts/api-server/src/routes/permisos.ts):399; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1245] (artifacts/api-server/src/routes/permisos.ts):400; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1245] (artifacts/api-server/src/routes/permisos.ts):403; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1245] (artifacts/api-server/src/routes/permisos.ts):432; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1245] (artifacts/api-server/src/routes/permisos.ts):433; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1245] (artifacts/api-server/src/routes/permisos.ts):434; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1245] (artifacts/api-server/src/routes/permisos.ts):435; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1245] (artifacts/api-server/src/routes/permisos.ts):441; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1245] (artifacts/api-server/src/routes/permisos.ts):442; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1245] (artifacts/api-server/src/routes/permisos.ts):443; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1245] (artifacts/api-server/src/routes/permisos.ts):444; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1245] (artifacts/api-server/src/routes/permisos.ts):458; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1245] (artifacts/api-server/src/routes/permisos.ts):459; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1245] (artifacts/api-server/src/routes/permisos.ts):460; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1245] (artifacts/api-server/src/routes/permisos.ts):461; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1245] (artifacts/api-server/src/routes/permisos.ts):464; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1245] (artifacts/api-server/src/routes/permisos.ts):486; chunk-operations-evidence.json#/moduleEvidence/permisos; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[925] (artifacts/api-server/src/app.ts):57-57; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[934] (artifacts/api-server/src/routes/index.ts):68-100.

IDs exactos: TERMINAL:permisos:crear, CAJA:permisos:crear, SUPERVISOR:permisos:crear, BODEGA:permisos:crear, SISTEMAS:permisos:crear, CONTADOR:permisos:crear.


#### Bitácora de auditoría — Autorizar (auditoria:autorizar)

Afectados (6): TERMINAL, CAJA, SUPERVISOR, BODEGA, SISTEMAS, CONTADOR.

Concedido: Ninguno. Denegado: TERMINAL, CAJA, SUPERVISOR, BODEGA, SISTEMAS, CONTADOR. ADMIN (sólo contexto): concedido.

Bitácora sólo consume auditoria.ver. Auditorías de inventario tienen módulo auditoria_inventario; sus crear/editar/autorizar NO son estas celdas.

Por qué no se identificó: El inventario histórico dejó esta combinación como NO_OPERATION_FOUND_STATIC y luego OWNER_SEMANTICS_REQUIRED. La revisión actual no encuentra una operación enlazada a esta celda concreta. La matriz permite combinar módulos y acciones aunque algunas combinaciones no tengan consumidor. No se demuestra el motivo interno del analizador histórico ni que la función comercial no exista.

Evidencia negativa completa: chunk-business-evidence.json, moduleSearch.auditoria + guardInventory. No se usa ausencia de coincidencia literal aislada como prueba; se examinaron llamadas calculadas y acciones protegidas por otros permisos.

Citas: API routes/auditoria.ts:20-26; API routes/auditorias-inventario.ts:172,252,314-315; UI App.tsx:404,709.

IDs exactos: TERMINAL:auditoria:autorizar, CAJA:auditoria:autorizar, SUPERVISOR:auditoria:autorizar, BODEGA:auditoria:autorizar, SISTEMAS:auditoria:autorizar, CONTADOR:auditoria:autorizar.


#### Bitácora de auditoría — Crear (auditoria:crear)

Afectados (6): TERMINAL, CAJA, SUPERVISOR, BODEGA, SISTEMAS, CONTADOR.

Concedido: Ninguno. Denegado: TERMINAL, CAJA, SUPERVISOR, BODEGA, SISTEMAS, CONTADOR. ADMIN (sólo contexto): concedido.

Bitácora sólo consume auditoria.ver. Auditorías de inventario tienen módulo auditoria_inventario; sus crear/editar/autorizar NO son estas celdas.

Por qué no se identificó: El inventario histórico dejó esta combinación como NO_OPERATION_FOUND_STATIC y luego OWNER_SEMANTICS_REQUIRED. La revisión actual no encuentra una operación enlazada a esta celda concreta. La matriz permite combinar módulos y acciones aunque algunas combinaciones no tengan consumidor. No se demuestra el motivo interno del analizador histórico ni que la función comercial no exista.

Evidencia negativa completa: chunk-business-evidence.json, moduleSearch.auditoria + guardInventory. No se usa ausencia de coincidencia literal aislada como prueba; se examinaron llamadas calculadas y acciones protegidas por otros permisos.

Citas: API routes/auditoria.ts:20-26; API routes/auditorias-inventario.ts:172,252,314-315; UI App.tsx:404,709.

IDs exactos: TERMINAL:auditoria:crear, CAJA:auditoria:crear, SUPERVISOR:auditoria:crear, BODEGA:auditoria:crear, SISTEMAS:auditoria:crear, CONTADOR:auditoria:crear.


#### Bitácora de auditoría — Modificar (auditoria:editar)

Afectados (6): TERMINAL, CAJA, SUPERVISOR, BODEGA, SISTEMAS, CONTADOR.

Concedido: Ninguno. Denegado: TERMINAL, CAJA, SUPERVISOR, BODEGA, SISTEMAS, CONTADOR. ADMIN (sólo contexto): concedido.

Bitácora sólo consume auditoria.ver. Auditorías de inventario tienen módulo auditoria_inventario; sus crear/editar/autorizar NO son estas celdas.

Por qué no se identificó: El inventario histórico dejó esta combinación como NO_OPERATION_FOUND_STATIC y luego OWNER_SEMANTICS_REQUIRED. La revisión actual no encuentra una operación enlazada a esta celda concreta. La matriz permite combinar módulos y acciones aunque algunas combinaciones no tengan consumidor. No se demuestra el motivo interno del analizador histórico ni que la función comercial no exista.

Evidencia negativa completa: chunk-business-evidence.json, moduleSearch.auditoria + guardInventory. No se usa ausencia de coincidencia literal aislada como prueba; se examinaron llamadas calculadas y acciones protegidas por otros permisos.

Citas: API routes/auditoria.ts:20-26; API routes/auditorias-inventario.ts:172,252,314-315; UI App.tsx:404,709.

IDs exactos: TERMINAL:auditoria:editar, CAJA:auditoria:editar, SUPERVISOR:auditoria:editar, BODEGA:auditoria:editar, SISTEMAS:auditoria:editar, CONTADOR:auditoria:editar.


#### Conciliación del inventario — Crear (conciliacion:crear)

Afectados (5): TERMINAL, CAJA, SUPERVISOR, BODEGA, CONTADOR.

Concedido: SISTEMAS. Denegado: TERMINAL, CAJA, SUPERVISOR, BODEGA, CONTADOR. ADMIN (sólo contexto): concedido.

Consulta consume ver y reconstrucción autorizar; no crear/editar. Conciliaciones E11 usan FISCAL_CONCILIAR, permiso distinto.

Por qué no se identificó: El inventario histórico dejó esta combinación como NO_OPERATION_FOUND_STATIC y luego OWNER_SEMANTICS_REQUIRED. La revisión actual no encuentra una operación enlazada a esta celda concreta. La matriz permite combinar módulos y acciones aunque algunas combinaciones no tengan consumidor. No se demuestra el motivo interno del analizador histórico ni que la función comercial no exista.

Evidencia negativa completa: chunk-business-evidence.json, moduleSearch.conciliacion + guardInventory. No se usa ausencia de coincidencia literal aislada como prueba; se examinaron llamadas calculadas y acciones protegidas por otros permisos.

Citas: API routes/inventario.ts:2458,2484-2489; API routes/e11.ts:117-131; UI App.tsx:700.

IDs exactos: TERMINAL:conciliacion:crear, CAJA:conciliacion:crear, SUPERVISOR:conciliacion:crear, BODEGA:conciliacion:crear, CONTADOR:conciliacion:crear.


#### Conciliación del inventario — Modificar (conciliacion:editar)

Afectados (6): TERMINAL, CAJA, SUPERVISOR, BODEGA, SISTEMAS, CONTADOR.

Concedido: Ninguno. Denegado: TERMINAL, CAJA, SUPERVISOR, BODEGA, SISTEMAS, CONTADOR. ADMIN (sólo contexto): concedido.

Consulta consume ver y reconstrucción autorizar; no crear/editar. Conciliaciones E11 usan FISCAL_CONCILIAR, permiso distinto.

Por qué no se identificó: El inventario histórico dejó esta combinación como NO_OPERATION_FOUND_STATIC y luego OWNER_SEMANTICS_REQUIRED. La revisión actual no encuentra una operación enlazada a esta celda concreta. La matriz permite combinar módulos y acciones aunque algunas combinaciones no tengan consumidor. No se demuestra el motivo interno del analizador histórico ni que la función comercial no exista.

Evidencia negativa completa: chunk-business-evidence.json, moduleSearch.conciliacion + guardInventory. No se usa ausencia de coincidencia literal aislada como prueba; se examinaron llamadas calculadas y acciones protegidas por otros permisos.

Citas: API routes/inventario.ts:2458,2484-2489; API routes/e11.ts:117-131; UI App.tsx:700.

IDs exactos: TERMINAL:conciliacion:editar, CAJA:conciliacion:editar, SUPERVISOR:conciliacion:editar, BODEGA:conciliacion:editar, SISTEMAS:conciliacion:editar, CONTADOR:conciliacion:editar.


#### Reportes — Autorizar (reportes:autorizar)

Afectados (6): TERMINAL, CAJA, SUPERVISOR, BODEGA, SISTEMAS, CONTADOR.

Concedido: Ninguno. Denegado: TERMINAL, CAJA, SUPERVISOR, BODEGA, SISTEMAS, CONTADOR. ADMIN (sólo contexto): concedido.

Reportes se protege por reportes:ver, con gates de rol ADMIN para operaciones de control. Generar/exportar reporte no consume crear/editar/autorizar.

Por qué no se identificó: El inventario histórico dejó esta combinación como NO_OPERATION_FOUND_STATIC y luego OWNER_SEMANTICS_REQUIRED. La revisión actual no encuentra una operación enlazada a esta celda concreta. La matriz permite combinar módulos y acciones aunque algunas combinaciones no tengan consumidor. No se demuestra el motivo interno del analizador histórico ni que la función comercial no exista.

Evidencia negativa completa: chunk-operations-evidence.json, moduleEvidence.reportes. No se usa ausencia de coincidencia literal aislada como prueba; se examinaron llamadas calculadas y acciones protegidas por otros permisos.

Citas: artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1259] (artifacts/api-server/src/routes/reportes.ts):10; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1259] (artifacts/api-server/src/routes/reportes.ts):23; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1259] (artifacts/api-server/src/routes/reportes.ts):33; chunk-operations-evidence.json#/moduleEvidence/reportes; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[925] (artifacts/api-server/src/app.ts):57-57; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[934] (artifacts/api-server/src/routes/index.ts):68-100.

IDs exactos: TERMINAL:reportes:autorizar, CAJA:reportes:autorizar, SUPERVISOR:reportes:autorizar, BODEGA:reportes:autorizar, SISTEMAS:reportes:autorizar, CONTADOR:reportes:autorizar.


#### Reportes — Crear (reportes:crear)

Afectados (6): TERMINAL, CAJA, SUPERVISOR, BODEGA, SISTEMAS, CONTADOR.

Concedido: Ninguno. Denegado: TERMINAL, CAJA, SUPERVISOR, BODEGA, SISTEMAS, CONTADOR. ADMIN (sólo contexto): concedido.

Reportes se protege por reportes:ver, con gates de rol ADMIN para operaciones de control. Generar/exportar reporte no consume crear/editar/autorizar.

Por qué no se identificó: El inventario histórico dejó esta combinación como NO_OPERATION_FOUND_STATIC y luego OWNER_SEMANTICS_REQUIRED. La revisión actual no encuentra una operación enlazada a esta celda concreta. La matriz permite combinar módulos y acciones aunque algunas combinaciones no tengan consumidor. No se demuestra el motivo interno del analizador histórico ni que la función comercial no exista.

Evidencia negativa completa: chunk-operations-evidence.json, moduleEvidence.reportes. No se usa ausencia de coincidencia literal aislada como prueba; se examinaron llamadas calculadas y acciones protegidas por otros permisos.

Citas: artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1259] (artifacts/api-server/src/routes/reportes.ts):10; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1259] (artifacts/api-server/src/routes/reportes.ts):23; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1259] (artifacts/api-server/src/routes/reportes.ts):33; chunk-operations-evidence.json#/moduleEvidence/reportes; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[925] (artifacts/api-server/src/app.ts):57-57; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[934] (artifacts/api-server/src/routes/index.ts):68-100.

IDs exactos: TERMINAL:reportes:crear, CAJA:reportes:crear, SUPERVISOR:reportes:crear, BODEGA:reportes:crear, SISTEMAS:reportes:crear, CONTADOR:reportes:crear.


#### Reportes — Modificar (reportes:editar)

Afectados (6): TERMINAL, CAJA, SUPERVISOR, BODEGA, SISTEMAS, CONTADOR.

Concedido: Ninguno. Denegado: TERMINAL, CAJA, SUPERVISOR, BODEGA, SISTEMAS, CONTADOR. ADMIN (sólo contexto): concedido.

Reportes se protege por reportes:ver, con gates de rol ADMIN para operaciones de control. Generar/exportar reporte no consume crear/editar/autorizar.

Por qué no se identificó: El inventario histórico dejó esta combinación como NO_OPERATION_FOUND_STATIC y luego OWNER_SEMANTICS_REQUIRED. La revisión actual no encuentra una operación enlazada a esta celda concreta. La matriz permite combinar módulos y acciones aunque algunas combinaciones no tengan consumidor. No se demuestra el motivo interno del analizador histórico ni que la función comercial no exista.

Evidencia negativa completa: chunk-operations-evidence.json, moduleEvidence.reportes. No se usa ausencia de coincidencia literal aislada como prueba; se examinaron llamadas calculadas y acciones protegidas por otros permisos.

Citas: artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1259] (artifacts/api-server/src/routes/reportes.ts):10; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1259] (artifacts/api-server/src/routes/reportes.ts):23; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[1259] (artifacts/api-server/src/routes/reportes.ts):33; chunk-operations-evidence.json#/moduleEvidence/reportes; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[925] (artifacts/api-server/src/app.ts):57-57; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[934] (artifacts/api-server/src/routes/index.ts):68-100.

IDs exactos: TERMINAL:reportes:editar, CAJA:reportes:editar, SUPERVISOR:reportes:editar, BODEGA:reportes:editar, SISTEMAS:reportes:editar, CONTADOR:reportes:editar.


#### Tablero de consulta — Autorizar (dashboard:autorizar)

Afectados (6): TERMINAL, CAJA, SUPERVISOR, BODEGA, SISTEMAS, CONTADOR.

Concedido: Ninguno. Denegado: TERMINAL, CAJA, SUPERVISOR, BODEGA, SISTEMAS, CONTADOR. ADMIN (sólo contexto): concedido.

Sólo lectura del tablero; crear, editar y autorizar no son operaciones de este módulo.

Por qué no se identificó: El inventario histórico dejó esta combinación como NO_OPERATION_FOUND_STATIC y luego OWNER_SEMANTICS_REQUIRED. La revisión actual no encuentra una operación enlazada a esta celda concreta. La matriz permite combinar módulos y acciones aunque algunas combinaciones no tengan consumidor. No se demuestra el motivo interno del analizador histórico ni que la función comercial no exista.

Evidencia negativa completa: chunk-business-evidence.json, moduleSearch.dashboard + guardInventory. No se usa ausencia de coincidencia literal aislada como prueba; se examinaron llamadas calculadas y acciones protegidas por otros permisos.

Citas: API routes/dashboard.ts:12-15; UI App.tsx:260-269.

IDs exactos: TERMINAL:dashboard:autorizar, CAJA:dashboard:autorizar, SUPERVISOR:dashboard:autorizar, BODEGA:dashboard:autorizar, SISTEMAS:dashboard:autorizar, CONTADOR:dashboard:autorizar.


#### Tablero de consulta — Crear (dashboard:crear)

Afectados (6): TERMINAL, CAJA, SUPERVISOR, BODEGA, SISTEMAS, CONTADOR.

Concedido: Ninguno. Denegado: TERMINAL, CAJA, SUPERVISOR, BODEGA, SISTEMAS, CONTADOR. ADMIN (sólo contexto): concedido.

Sólo lectura del tablero; crear, editar y autorizar no son operaciones de este módulo.

Por qué no se identificó: El inventario histórico dejó esta combinación como NO_OPERATION_FOUND_STATIC y luego OWNER_SEMANTICS_REQUIRED. La revisión actual no encuentra una operación enlazada a esta celda concreta. La matriz permite combinar módulos y acciones aunque algunas combinaciones no tengan consumidor. No se demuestra el motivo interno del analizador histórico ni que la función comercial no exista.

Evidencia negativa completa: chunk-business-evidence.json, moduleSearch.dashboard + guardInventory. No se usa ausencia de coincidencia literal aislada como prueba; se examinaron llamadas calculadas y acciones protegidas por otros permisos.

Citas: API routes/dashboard.ts:12-15; UI App.tsx:260-269.

IDs exactos: TERMINAL:dashboard:crear, CAJA:dashboard:crear, SUPERVISOR:dashboard:crear, BODEGA:dashboard:crear, SISTEMAS:dashboard:crear, CONTADOR:dashboard:crear.


#### Tablero de consulta — Modificar (dashboard:editar)

Afectados (6): TERMINAL, CAJA, SUPERVISOR, BODEGA, SISTEMAS, CONTADOR.

Concedido: Ninguno. Denegado: TERMINAL, CAJA, SUPERVISOR, BODEGA, SISTEMAS, CONTADOR. ADMIN (sólo contexto): concedido.

Sólo lectura del tablero; crear, editar y autorizar no son operaciones de este módulo.

Por qué no se identificó: El inventario histórico dejó esta combinación como NO_OPERATION_FOUND_STATIC y luego OWNER_SEMANTICS_REQUIRED. La revisión actual no encuentra una operación enlazada a esta celda concreta. La matriz permite combinar módulos y acciones aunque algunas combinaciones no tengan consumidor. No se demuestra el motivo interno del analizador histórico ni que la función comercial no exista.

Evidencia negativa completa: chunk-business-evidence.json, moduleSearch.dashboard + guardInventory. No se usa ausencia de coincidencia literal aislada como prueba; se examinaron llamadas calculadas y acciones protegidas por otros permisos.

Citas: API routes/dashboard.ts:12-15; UI App.tsx:260-269.

IDs exactos: TERMINAL:dashboard:editar, CAJA:dashboard:editar, SUPERVISOR:dashboard:editar, BODEGA:dashboard:editar, SISTEMAS:dashboard:editar, CONTADOR:dashboard:editar.


#### Usuarios — Autorizar (usuarios:autorizar)

Afectados (6): TERMINAL, CAJA, SUPERVISOR, BODEGA, SISTEMAS, CONTADOR.

Concedido: Ninguno. Denegado: TERMINAL, CAJA, SUPERVISOR, BODEGA, SISTEMAS, CONTADOR. ADMIN (sólo contexto): concedido.

Usuarios usa ver/crear/editar. Invariantes de recuperación ADMIN no son usuarios:autorizar.

Por qué no se identificó: El inventario histórico dejó esta combinación como NO_OPERATION_FOUND_STATIC y luego OWNER_SEMANTICS_REQUIRED. La revisión actual no encuentra una operación enlazada a esta celda concreta. La matriz permite combinar módulos y acciones aunque algunas combinaciones no tengan consumidor. No se demuestra el motivo interno del analizador histórico ni que la función comercial no exista.

Evidencia negativa completa: chunk-operations-evidence.json, moduleEvidence.usuarios. No se usa ausencia de coincidencia literal aislada como prueba; se examinaron llamadas calculadas y acciones protegidas por otros permisos.

Citas: artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[972] (artifacts/api-server/src/routes/users.ts):25; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[972] (artifacts/api-server/src/routes/users.ts):34; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[972] (artifacts/api-server/src/routes/users.ts):120; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[972] (artifacts/api-server/src/routes/users.ts):196; chunk-operations-evidence.json#/moduleEvidence/usuarios; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[925] (artifacts/api-server/src/app.ts):57-57; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[934] (artifacts/api-server/src/routes/index.ts):68-100.

IDs exactos: TERMINAL:usuarios:autorizar, CAJA:usuarios:autorizar, SUPERVISOR:usuarios:autorizar, BODEGA:usuarios:autorizar, SISTEMAS:usuarios:autorizar, CONTADOR:usuarios:autorizar.


## B — API sin interfaz operativa

Sin casos. No se solicita decisión del propietario.


## C — Interfaz operativa no enlazada por el mapeo anterior


### Inventario y productos


#### Ajustes de inventario — Consultar (ajustes:ver)

Afectados (3): TERMINAL, CAJA, CONTADOR.

Concedido: SUPERVISOR, BODEGA, SISTEMAS. Denegado: TERMINAL, CAJA, CONTADOR. ADMIN (sólo contexto): concedido.

La UI activa consume ajustes:ver por ProtectedRoute y navegación, pero ninguna API observada verifica esa celda. Es C por consumidor UI omitido; NO implica que exista prueba API exacta posible hoy. La página carga rollos con inventario:ver, movimiento con movimientos:ver y pendientes con ajustes:autorizar.

Por qué no se identificó: El mapeo no enlazó allowedModule con la acción ver por defecto de ProtectedRoute. Hay consumo UI, pero no una guarda API exacta ajustes.ver.

Consumidor positivo enlazado en las citas. Verificación runtime pendiente; no confundir restricciones externas por rol con la celda.

**Verificación pendiente:** Pantalla: /inventario/ajustes. Endpoints: GET /api/inventario/rollos — inventario:ver, no ajustes:ver; GET /api/inventario/movimientos/:id — movimientos:ver, no ajustes:ver; GET /api/inventario/ajustes/pendientes — ajustes:autorizar, no ajustes:ver. Verificación futura de UI, sin crear una guarda API: sesión de usuario no ADMIN, sitio/equipo válidos y rol admitido; dos variantes idénticas salvo ajustes.puedeVer=true/false, con permisos dependientes constantes. Rollo y movimiento de un fixture aislado accesible. Montar /inventario/ajustes, comprobar menú/ruta permitida o bloqueada y registrar sus consultas. Las APIs dependientes usan inventario.ver, movimientos.ver o ajustes.autorizar; sus resultados no prueban ajustes.ver. No hace falta inventar ni añadir una guarda backend para verificar esta UI. No ejecutado.

Citas: artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):105; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):142; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):538; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):641; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):680; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):770; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):972; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):1111; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):1151; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):1172; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):1237; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):1277; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):1331; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):1390; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):1455; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):1514; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):1597; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):1639; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):1670; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):1715; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):1842; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):1877; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):2010; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):2147; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):2191; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):2231; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):2263; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):2364; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):2403; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):2458; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[976] (artifacts/api-server/src/routes/inventario.ts):2489; chunk-operations-evidence.json#/moduleEvidence/ajustes; reports/sidebar-order-20261001/frozen-root/artifacts/mariana-textil/src/App.tsx:117-133; reports/sidebar-order-20261001/frozen-root/artifacts/mariana-textil/src/App.tsx:201-206; reports/sidebar-order-20261001/frozen-root/artifacts/mariana-textil/src/App.tsx:444-452; reports/sidebar-order-20261001/frozen-root/artifacts/mariana-textil/src/components/layout/app-navigation.ts:66-66; reports/sidebar-order-20261001/frozen-root/artifacts/mariana-textil/src/pages/ajustes.tsx:49-68; reports/sidebar-order-20261001/frozen-root/artifacts/mariana-textil/src/pages/ajustes.tsx:99-120; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[925] (artifacts/api-server/src/app.ts):57-57; artifacts/api-server/dist-driver-phones-20261001/index.mjs.map#sources[934] (artifacts/api-server/src/routes/index.ts):68-100.

IDs exactos: TERMINAL:ajustes:ver, CAJA:ajustes:ver, CONTADOR:ajustes:ver.


### Clientes/crédito/caja


#### Abonos recibidos en caja — Consultar (caja_abonos:ver)

Afectados (6): TERMINAL, CAJA, SUPERVISOR, BODEGA, SISTEMAS, CONTADOR.

Concedido: Ninguno. Denegado: TERMINAL, CAJA, SUPERVISOR, BODEGA, SISTEMAS, CONTADOR. ADMIN (sólo contexto): concedido.

API resolvePermiso(caja_abonos) toma puedeVer y lo combina OR con clientes_finanzas.ver. UI e5CanRead itera E5_READ_MODULES con ver y E5Entry lo aplica. Es consumo real de esta celda, no sólo registro de módulo. Persisten restricciones por rol y alcance.

Por qué no se identificó: El mapeo histórico no enlazó la lectura calculada resolvePermiso/puedeVer ni la iteración E5_READ_MODULES con esta celda. Ahora se identifica consumo API y UI; no una prueba ejecutada.

Consumidor positivo enlazado en las citas. Verificación runtime pendiente; no confundir restricciones externas por rol con la celda.

**Verificación pendiente:** Endpoints: GET /api/e5/disponibilidad; GET /api/e5/cobros; GET /api/e5/contexto; GET /api/e5/cobros/:id. Prueba futura aislada (no ejecutada): usuario activo CAJA/TERMINAL/SUPERVISOR, no ADMIN (bypass), rol permitido por E5, sitio y alcance válidos, sesión autenticada. Permisos efectivos clientes_finanzas.ver=false y caja_abonos.ver=true; para la navegación dar cobros_pagos.ver sin confundirlo con el control interno E5. Cobro E5 válido del sitio/cliente y capacidad/disponibilidad coherentes. Control negativo: cambiar sólo caja_abonos.ver=false manteniendo clientes_finanzas.ver=false, esperar 403 API y bloqueo E5Entry; positivo: true y respuesta/esquema correctos. Control OR: caja_abonos.ver=false/clientes_finanzas.ver=true debe seguir permitido. Montar /cobros, abrir listado E5, observar petición y resultado; listar/detalle deben respetar alcance. También comprobar roles excluidos CONTADOR/SISTEMAS/BODEGA. No se necesita dinero real ni DB real; repositorio fixture o DB aislada autorizada.

Citas: API routes/index.ts:45,61; API routes/e5.ts:18-34,50-77; UI lib/e5-authorization.ts:5,19-22; UI components/e5-pendientes.tsx:48,58,281; UI pages/cobros.tsx:6,282; UI pages/cliente-detail.tsx:636; UI App.tsx:559-581; API lib/e5-feature.ts:2; UI lib/e5-feature-flags.ts:2.

IDs exactos: TERMINAL:caja_abonos:ver, CAJA:caja_abonos:ver, SUPERVISOR:caja_abonos:ver, BODEGA:caja_abonos:ver, SISTEMAS:caja_abonos:ver, CONTADOR:caja_abonos:ver.


## Límites

Clasificación estática, no certificación de seguridad ni prueba runtime. C conserva verificación pendiente. En caja_abonos.ver se debe aislar el OR con clientes_finanzas.ver y respetar los roles excluidos; en ajustes.ver se verifica la UI, sin inventar una guarda backend. Ninguna fila pide decisión del propietario. La evidencia interna no permite descartar contratos o consumidores externos desconocidos.
