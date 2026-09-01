# Formularios con mensajes de validación genéricos

Fecha: 2026-09-01

Este inventario excluye alta y edición de usuarios, corregidas en la tanda C.
No se modificó ninguno de los flujos siguientes.

| Flujo | Endpoints | Mensaje actual |
| --- | --- | --- |
| Vista previa de pago a proveedor | `POST /proveedores/:id/pagos/preview` | Datos del pago inválidos. |
| Alta y edición de proveedor | `POST /proveedores`, `PATCH /proveedores/:id` | Datos del proveedor inválidos. |
| Alta y edición de producto | `POST /productos`, `PATCH /productos/:id` | Datos del producto inválidos. |
| Importación de productos | `POST /productos/import/preview`, `POST /productos/import/confirm` | Datos de importación inválidos. |
| Alta y edición de ubicación | `POST /locations`, `PATCH /locations/:id` | Datos de ubicación inválidos. |
| Alta y edición de piso | `POST /locations/:id/pisos`, `PATCH /locations/:id/pisos/:pisoId` | Datos de piso inválidos. |
| Alta y edición de camioneta | `POST /camionetas`, `PATCH /camionetas/:id` | Datos de la camioneta inválidos. |
| Alta y edición de chofer | `POST /choferes`, `PATCH /choferes/:id` | Datos del chofer inválidos. |

También se localizaron mensajes menos genéricos, pero todavía agregados, en la
solicitud de pagos dirigidos, el interruptor de venta por metro y el inicio de
sesión. Se reportan para evaluación futura; no forman parte de esta corrección.