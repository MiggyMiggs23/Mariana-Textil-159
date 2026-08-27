# Parte 5 — Auditoría, confirmaciones y cierre

Fecha de validación: 27 de agosto de 2026
Resultado: **APROBADO**

## Aislamiento de datos

- Las pruebas con usuarios, sesiones y escrituras se ejecutaron en la rama Neon desechable `parte5-auditoria-cierre-20260827` (`br-spring-forest-axijnk2g`).
- La base vacía usada fue `parte5_audit_test_20260827`.
- Antes de las escrituras se confirmó `current_database() = parte5_audit_test_20260827`.
- Se confirmó que la URL temporal era distinta de `DATABASE_URL`.
- Development no se usó para ADMIN temporales, sesiones ni fixtures de estas pruebas.
- La rama completa se eliminó al terminar; no se creó una base de pruebas permanente.

## Auditoría

- La pantalla ADMIN carga bajo CONFIGURACIÓN, después de Conciliación.
- La tabla está ordenada, paginada y ofrece los seis criterios: fechas, usuario, módulo, acción, sitio y búsqueda por entidad o identificador.
- El detalle compara antes y después campo por campo.
- La exportación XLSX respeta los filtros y rechaza resultados superiores a 10,000 filas.
- Solo existen rutas de consulta; POST, PATCH y DELETE responden 404/405.
- PostgreSQL rechaza UPDATE y DELETE sobre la bitácora por defecto.
- Usuario, rol y sitio se congelan al insertar. Los históricos sin evidencia permanecen desconocidos; un renombre posterior no reescribe el nombre histórico.
- La prueba de sitio afectado conserva correctamente una reimpresión realizada por un ADMIN sin ubicación asignada.

### Cobertura de acciones

Ya generaban auditoría: altas, bajas y cambios de usuarios; permisos y roles; precios en sus modalidades; interruptor `se_vende_por_metro`; consultas de INE; ajustes; inversos y correcciones; cancelaciones; salidas a mostrador; recepciones completas e incompletas; cuentas y cortes; configuración de sitios e iniciales; e inicios de sesión fallidos.

Se agregó en esta parte el registro de reimpresiones de etiquetas.

## Confirmaciones exactas

Quedaron activas las confirmaciones para:

1. Desactivar usuario.
2. Cambiar rol.
3. Cancelar ticket cobrado.
4. Ajuste de inventario con cambio absoluto mayor a 10, incluida baja.
5. Borrar cliente.
6. Desactivar sitio.
7. Salida a mostrador de más de cinco rollos.

En todos los casos implementados, el botón inicia deshabilitado, un texto incorrecto no ejecuta la acción y la coincidencia literal lo habilita. El script de reinicio todavía no existe; su confirmación exacta queda pendiente junto con el propio script antes del piloto.

## Protecciones ADMIN

Se rechazaron de forma transaccional y se auditaron los cinco escenarios:

1. Desactivar el último ADMIN activo.
2. Quitarse a sí mismo el rol ADMIN.
3. Modificar los permisos propios.
4. Configurar o vaciar ADMIN desde el catálogo de roles.
5. Guardar usuarios o permisos dejando la instalación sin un ADMIN recuperable.

## SUPERVISOR

- Puede crear y editar clientes y proveedores.
- Solo puede leer productos.
- El ceiling del servidor prevalece sobre concesiones maliciosas en la base.
- Las respuestas no entregan saldos, crédito, plazos, cobros, costos ni INE.
- Las personalizaciones explícitas permanecen; los defaults heredados sin autor se actualizan con el seed.

## Correcciones menores

- PRECIOS aparece en Permisos con acceso denegado por defecto a roles configurables.
- Una ruta inexistente responde 404 incluso con sesión ADMIN.
- El catálogo real tiene **26 módulos**, no 25: el diagnóstico original era anterior a ETIQUETAS. Se conservaron ETIQUETAS y PRECIOS en vez de eliminar funcionalidad para forzar un conteo obsoleto.

## Evidencia automática

- Permisos y políticas de datos sensibles: **29/29**.
- Seguridad HTTP y matriz SUPERVISOR: **45/45**.
- Contrato de auditoría: **4/4**.
- Integración PostgreSQL de auditoría: **1/1**.
- Invariantes ADMIN: **1/1**.
- Confirmaciones exactas y AJUSTE: **13/13**.
- Typecheck API: aprobado.
- Typecheck frontend: aprobado.
- `git diff --check`: aprobado.
- Revisión arquitectónica final: **PASS**, sin violaciones serias pendientes dentro del alcance.

## E2E de navegador

Resultado: **success** contra la base temporal.

- Login ADMIN y menú CONFIGURACIÓN.
- Auditoría con seis filtros, detalle de `LOGIN_EXITOSO`, tabla y paginación.
- Exportación con descarga sugerida `.xlsx` y confirmación visual de éxito.
- PRECIOS visible y 26 módulos en Permisos.
- Diálogo de desactivación: bloqueado con texto vacío o incorrecto y habilitado solo con el usuario exacto; se canceló sin mutar el fixture.
- Ruta inexistente: 404.
- Sin errores funcionales en consola o backend.

## Pendientes antes del piloto

- Salidas extraordinarias.
- Respaldos y prueba de restauración.
- Toma de inventario físico.
- Script de reinicio y su confirmación textual.
- Decisión de impresora.
- Cambio de la contraseña inicial.
- Definición del rol CONTADOR.