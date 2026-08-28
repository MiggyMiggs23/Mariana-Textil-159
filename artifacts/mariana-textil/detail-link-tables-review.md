# Revisión de enlaces de detalle en tablas

La revisión cubrió los 33 módulos de página que contienen `Table` del inventario
existente, además de las listas HTML de Salidas, Cobros y Viajes. Un enlace de
identificador sólo se incorporó cuando la ruta ya está declarada en `App.tsx`.
No se agregaron rutas ni pantallas.

| Módulo / tabla | Identificador | Destino o razón para conservar texto |
| --- | --- | --- |
| Ajustes pendientes | Serie del rollo | Sin pantalla de detalle del ajuste; las acciones son aprobar/rechazar. |
| Auditoría administrativa | Evento | El panel `Detalle` abre una hoja contextual, no es una columna “Ver detalle”. |
| Auditorías de inventario | Folio | Se selecciona en el panel maestro-detalle de la misma página; no existe ruta individual. |
| Caja comparativo | Tienda | Agregado comparativo, sin registro individual. |
| Cortes | ID/folio | El renglón selecciona el corte en el detalle contextual de la misma página; no existe ruta individual. |
| Cuenta destino detalle | Documento | Conserva el enlace ya existente al ticket cuando el documento es un ticket. |
| Cuentas destino | Cuenta | Agregado por cuenta; sin entidad de detalle adicional. |
| Diferencias de caja | Cajero / tienda | Agregado de reporte, sin detalle individual. |
| Caja tiempo real | Tienda / último ticket | El último ticket ya enlaza a `/tickets/:id`; los totales por tienda son agregados. |
| Detalle de cliente | Registros relacionados | Tablas de contexto del cliente, sin entidad de detalle adicional. |
| Clientes | Nombre | `/clientes/:id` (existente). |
| Conciliación | Discrepancia | Acción operativa, no entidad con ruta de detalle. |
| Camionetas | Alias / nombre | No hay ruta de detalle; se edita en diálogo. |
| Choferes | Nombre completo | No hay ruta de detalle; se edita en diálogo. |
| Detalle de contenedor | Líneas relacionadas | Contexto del contenedor; sin rutas propias. |
| Contenedores | Folio | `/contenedores/:id` (existente). |
| Nuevo contenedor | Líneas de captura | Borrador operativo, sin registro persistido. |
| Detalle compartido de corte | Movimientos | Contexto del corte, sin ruta propia. |
| Dashboard | Sitio | Resumen agregado, sin detalle de ese renglón. |
| Entradas pendientes de costo | Folio | `/entradas/:id/documento` (ruta existente del documento de entrada). |
| Entradas | Líneas de borrador | Captura antes de crear la entrada; el control Detalle expande la línea. |
| Etiquetas | Rollo | Selección para impresión, sin pantalla de detalle desde esta tabla. |
| Inventario agrupado | Producto / color | Resumen y expansión local; los rollos se muestran como tarjetas enlazables, no tabla. |
| Movimientos | Serie del rollo | `referenciaRolloRuta` (ruta real de `/inventario/rollos/:id`); el documento queda como texto para mantener un enlace por renglón. |
| Detalle de precio | Historial | Contexto de precio, sin ruta individual. |
| Precios | Producto | No se añadió enlace adicional: no hay ruta de detalle distinta de la ficha de precio ya usada por el flujo. |
| Detalle de producto | Serie de rollo | `/inventario/rollos/:id` (existente). |
| Productos | Color (identificador visible de producto agrupado) | `/productos/:id` (existente). |
| Detalle de proveedor | Registros relacionados | Tablas de contexto del proveedor, sin rutas propias. |
| Proveedores | Nombre | `/proveedores/:id` (existente). |
| Detalle de rollo | Movimientos relacionados | Contexto del rollo, sin ruta individual. |
| Ubicaciones | Nombre | No hay ruta de detalle; se edita en diálogo. |
| Usuarios | Nombre de usuario | No hay ruta de detalle; se edita en diálogo. |
| Salidas | Folio | `/salidas/:id` (existente). |
| Cobros / notas pendientes | Folio de nota | Se conserva como texto: el contrato sólo provee `ticketFolio`, mientras `/tickets/:id` requiere el ID interno. Enlazar el folio habría creado una ruta inválida. |
| Viajes | Folio | `/viajes/:id` (existente). |
| Reportes generales y de contenedores | Dimensión del reporte | Tablas agregadas; no representan un registro individual detallable. |