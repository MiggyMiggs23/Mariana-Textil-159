# Verificación de salidas extraordinarias — 2026-08-30

## Aislamiento de base de datos

Las pruebas enfocadas se ejecutaron únicamente con `NODE_ENV=test` y una
`TEST_DATABASE_URL` de la rama Neon desechable. Antes de mutar fixtures, la suite
comprobó que `TEST_DATABASE_URL` no coincidía con `DATABASE_URL` y que
`SELECT current_database()` devolvía `test_task71_final2`, mientras
development seguía en `heliumdb`. La base limpia recibió esquema y seed vigentes.
No se crearon usuarios, sesiones ni fixtures temporales en development. Al
terminar la matriz y la revisión arquitectónica, se eliminó la rama Neon
desechable completa.

## Resultados de pruebas

La integración `test:inventory-six-view-integration` aprobó (1/1). Seguridad
aprobó (46/46): ADMIN creó, listó con `fechaDesde`/`fechaHasta` y revirtió;
SUPERVISOR y BODEGA recibieron 403 en las tres rutas aun con overrides de
`salidas` que permiten todas las acciones. Inventario aprobó 25/25, incluido el
caso determinista transferencia-vs-extraordinaria sin deadlock ni par obsoleto;
Salidas aprobó 9/9, POS 35/35, reportes unitarios 51/51 y reportes de integración
4/4. El reverso quedó fuera de pérdidas extraordinarias, y su reintento conserva
un solo movimiento de cancelación y una sola auditoría. Los contratos
de fechas y ciclos aprobaron 3/3. El contrato rechaza formatos inválidos y fechas
calendario imposibles. Typecheck y build raíz aprobaron.

## Seis vistas, interfaz y separación

La integración de seis vistas crea un rollo DISPONIBLE etiquetado, captura
inventario agrupado, Vista Global, Dashboard, catálogo, detalle de producto y
reporte, y ejecuta una sola llamada real a `crearSalidaExtraordinaria`. El rollo
queda BAJA con cantidad cero; cada superficie pierde exactamente 10.000 y un
rollo, y una segunda captura permanece idéntica. La interfaz conserva la pestaña
dentro de Salidas, sin nueva entrada lateral; las comprobaciones de cámara,
escaneo y teléfono siguen siendo aceptación en dispositivo separada de esta
evidencia de API/DB. Reportes mantiene la pérdida extraordinaria separada del
costo, utilidad y margen de ventas.

El API y el frontend reiniciaron sin errores. La automatización de navegador no
pudo entrar al área ADMIN porque la contraseña de development ya no coincide con
las credenciales seed; se evitó deliberadamente cambiar usuarios o sesiones de
development. El intento de servir temporalmente la base aislada terminó antes de
abrir el puerto y se restauró el workflow normal. Por ello, cámara y aceptación
visual móvil permanecen como comprobación manual en dispositivo; las validaciones
de negocio, permisos, contrato y reverso quedaron cubiertas por pruebas aisladas.

## Commits

1. `12120cf` — motor y contrato de salidas extraordinarias.
2. `c989143` — pestaña de Salidas extraordinarias.
3. `8f41c37` — reportes de pérdidas extraordinarias.
4. Este commit — verificación y documentación.