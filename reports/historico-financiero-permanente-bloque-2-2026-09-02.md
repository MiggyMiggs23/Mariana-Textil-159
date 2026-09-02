# Auditoría de histórico financiero permanente — Bloque 2

Fecha: 2026-09-02

## Resultado

La purga de `clientes` y `proveedores` ahora reconoce expresamente como bloqueo permanente cualquier fila de sus libros mayores. El preflight y la ejecución transaccional comparten la misma evaluación. El rechazo explica en español que existe movimiento en el estado de cuenta y recomienda desactivar en vez de purgar. Los registros inactivos sin movimientos ni otras referencias conservan la conducta anterior.

Los libros cubiertos son:

- Cliente: `movimientos_credito` (`VENTA_CREDITO`, `ABONO`, `AJUSTE`, `REVERSO`) y la tabla legada `pagos_cliente` si existe en una instalación.
- Proveedor: `pagos_proveedor` (`COMPRA`, `PAGO`, `AJUSTE`, `REVERSO`).

El descubrimiento de llaves foráneas sigue siendo dinámico y fail-closed. La fila del catálogo se bloquea antes del segundo conteo transaccional; una inserción concurrente con FK no puede atravesar la eliminación.

## Desactivación e histórico

- Cliente: la baja elimina solamente cuando no hay tickets ni movimientos. Si existe cualquier movimiento y el saldo no requiere el flujo de incobrable, actualiza `activo=false`. `GET /clientes/:id`, `GET /clientes/:id/estado-cuenta` y sus salidas imprimible/XLSX/PDF buscan por ID y no filtran `activo`, por lo que el libro completo continúa consultable.
- Proveedor: `PATCH /proveedores/:id` cambia `activo`; detalle, compras, pagos y estado de cuenta buscan por ID y no filtran `activo`. Las altas financieras sí rechazan al proveedor inactivo. No fue necesario cambiar filtros.

## Riesgo de los demás descriptores de purga (solo auditado)

- `usuarios`: alto. Es actor de movimientos de crédito/proveedor, tickets, caja, kardex, entradas, salidas, precios, inventario y auditoría. Las FKs y referencias genéricas descubiertas bloquean la purga; no se modificó.
- `camionetas`: operativo. Una eliminación alcanzaría la identidad histórica de viajes. La FK de `viajes.camioneta_id` bloquea; no se modificó.
- `choferes`: operativo. Una eliminación alcanzaría la identidad histórica de viajes. La FK de `viajes.chofer_id` bloquea; no se modificó.
- `productos`: financiero y operativo. Tiene líneas históricas de venta, rollos, movimientos de kardex, entradas/contenedores, historial de precios y auditorías de inventario. Las FKs bloquean; no se modificó.
- `clientes` y `proveedores`: corregidos en este bloque. Además de sus libros, sus tickets, documentos, entradas, contenedores, rollos, solicitudes y salidas de caja siguen actuando como referencias independientes.

No se hallaron declaraciones `ON DELETE CASCADE` en el esquema Drizzle ni en los instaladores SQL revisados. Las referencias usan el comportamiento restrictivo predeterminado; por tanto, una eliminación de catálogo no arrastra automáticamente libros.

## Otras rutas y scripts de borrado

- `POST /clientes/:id/baja` contiene un `DELETE FROM clientes`, limitado bajo transacción a saldo no positivo, cero tickets y cero movimientos. Con cualquier movimiento desactiva; conserva el comportamiento requerido para clientes vacíos.
- `DELETE /purga/:entidad/:id` es la ruta administrativa común y delega al preflight transaccional corregido.
- `DELETE /salidas/borrador/rollos/:rolloId`, y los borrados internos de líneas de salidas/contenedores, alcanzan asociaciones editables de borradores, no libros financieros ni kardex.
- Los DELETE de autenticación/permisos eliminan sesiones u overrides, no libros.
- `lib/db/src/scripts/cleanup-bloque-7.mjs` sí puede vaciar explícitamente tablas financieras y operativas y deshabilita temporalmente seis triggers de inmutabilidad. Es un script manual de reinicio piloto, exige `--apply`, frase de confirmación, base llamada `heliumdb`, revisión de esquema y transacción. Sigue siendo una vía destructiva excepcional y debe permanecer fuera de operación ordinaria.
- Los DELETE restantes hallados están en pruebas y limpian fixtures; las integraciones exigen una base de prueba aislada. No son rutas de producción.

## Verificación sin datos de desarrollo

Se añadieron contratos puros para: bloqueo de cliente/proveedor con uno o varios movimientos; mensaje de desactivación; continuidad de purga con cero movimientos/referencias; ausencia de filtro activo en estados de cuenta; y comportamiento de baja de cliente. No se crearon usuarios ni sesiones y no se mutó ninguna base.