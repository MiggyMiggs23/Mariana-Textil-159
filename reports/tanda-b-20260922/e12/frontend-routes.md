# E12 Frontend Routes / Hook Dependencies

- `POST /api/proveedores/:id/pagos` -> `useRegistrarPagoProveedor`
- `GET /api/proveedores/:id/pagos/efectivo-opciones` -> `useGetOpcionesPagoEfectivoProveedor`
- `POST /api/proveedores/:id/pagos/preview` -> `usePreviewPagoProveedor`
- `POST /api/solicitudes-pago-dirigido/:id/aprobar` -> `useAprobarSolicitudPagoDirigido`
- `POST /api/salidas-dinero-caja` -> `useCrearSalidaDineroCaja`
- `POST /api/proveedores/:id/pagos/:pagoId/reversar` -> `useReversarPagoProveedor`
