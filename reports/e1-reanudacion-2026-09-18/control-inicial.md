# E1 — reanudación y primer recorrido

## Autorización y límites

El propietario dio por cerrada la parte de base de E1 y autorizó reanudar normalmente la API, después de corregir el valor inicial del abono y siguiendo este orden:

1. Arranque normal, sin precarga/inspector/bloqueo HTTP temporal.
2. Salud, inicializadores y backfill completado: comparar las filas reales de compras, no sólo el contador del log.
3. Confirmar las tres guardas instaladas y habilitadas, sin retirarlas ni ejecutar otra migración.
4. Sesión real: navegación y formularios, sin confirmar movimientos.
5. Informar el resultado antes de que el propietario capture operaciones genuinas.

**Condición de parada:** si una operación permitida produce E1C01, E1P01 o E1A01, detener el recorrido y reportar el defecto. No cambiar naturaleza, permisos, flags, datos ni guardas para sortearlo. Ante cambios financieros inesperados del arranque, no liberar uso general.

Se permiten los efectos propios del arranque autorizado y de iniciar sesión. No se autoriza crear usuarios de prueba, cambiar contraseñas/roles, aprobar solicitudes, cobrar, abonar, corregir, autorizar/cancelar notas, modificar inventario ni crear operaciones financieras de prueba. Las escrituras de negocio las hará el propietario mediante operaciones genuinas.

## Valor inicial temporal del abono

El formulario general de abono debe abrir y reabrir con **Transferencia** preseleccionada mientras la captura física de efectivo esté cerrada. La cuenta bancaria debe elegirse explícitamente.

**Pendiente de E2 + E3:** revisar expresamente este valor inicial cuando ambas entregas liberen coordinadamente la captura de efectivo. No dejar Transferencia por olvido ni volver a Efectivo automáticamente sin revisar la captura habilitada.

## Cobertura pendiente abierta

- [ ] Autorización de notas con líneas y rollos reales, con consumo y trazabilidad correctos.
- [ ] Cancelación de esas notas desde Ticket y Salida, incluida restitución de rollos/existencias y reversos relacionados.
- [ ] Concurrencia: doble envío, solicitudes simultáneas y conflictos de idempotencia sobre datos cambiantes.
- [ ] Fallos de red: respuesta perdida, reintento con la misma identidad, ausencia de duplicados y actualización correcta de pantalla.
- [ ] Operaciones con rollos: atomicidad de crédito, inventario, aplicaciones, auditoría y notificaciones ante éxito y fallo.

Las notas del ensayo E1 anterior eran deliberadamente **sin líneas**. La cobertura pendiente no se considera aprobada por aquel ensayo ni por este recorrido de lectura. Las pruebas que crean o revierten movimientos requieren un entorno aislado autorizado; no se harán en la operativa para completar esta revisión.

## Estado del control

**API activa. Control técnico aprobado y recorrido de lectura/formulario ADMIN completado, incluido Cobros filtrado por Mariana.** No se encontraron códigos E1C01/E1P01/E1A01 ni cambios financieros. **No se acredita todavía el recorrido del rol CAJA ni la confirmación de cobros**: son límites explícitos antes de dar por verificado el uso general de Caja. Mariana muestra Apertura de Caja; no se abrió un turno de prueba.

### Arranque normal

- API escuchando desde **2026-09-18 16:29:22.832 UTC**, PID 4719. Todas las fases de inicialización completadas; sin modo de inspección ni precarga temporal.
- `GET /api/healthz`: HTTP 200, `{"status":"ok"}`.
- Backfill completado, **0 compras insertadas**: `pagos_proveedor` mantiene exactamente sus 2 filas, sin modificaciones ni eliminaciones; cero candidatos antes y después. Se contrastaron filas/huellas, no sólo el log.
- Las 66 tablas sólo difieren en `updated_at` de 70 permisos de rol y 54 permisos de ubicación. Ningún cambio financiero ni de stock/notificaciones en la comparación de arranque.
- Catálogo completo coincidente con el estado confirmado de instalación; las tres funciones y tres triggers de guarda conservan definición y habilitación exactas.
- Frontend reiniciado después del cambio; typecheck final del frontend aprobado.

Evidencia: `antes-arranque.json`, `despues-arranque.json`, `comparacion-arranque.json`, `arranque-api.log`. El comparador entrega `REVIEW` deliberadamente para exigir revisión humana de las diferencias; revisadas aquí, las únicas diferencias son los timestamps de permisos esperados.

### Recorrido real y conservación

- La credencial operativa disponible corresponde a **ADMIN**, confirmado con `GET /api/auth/me` HTTP 200. No se creó, cambió ni suplantó ningún usuario o rol.
- El cuaderno de navegador no heredaba los secretos del workspace. Se usó el endpoint normal de login desde el runtime que sí los tiene y se transfirió la sesión mediante un archivo temporal con permisos 0600 fuera del proyecto, sin imprimir valores. El logout normal terminó con HTTP 204; después se eliminó el archivo temporal.
- Navegación comprobada: Tiempo Real, Cobros en vista global y luego filtrado por Mariana, Clientes, detalle de cliente y estado de cuenta/evidencia histórica. Se completó sólo el tramo de selección de sitio en una segunda sesión ADMIN, sin repetir las verificaciones aprobadas del abono.
- Abono: primera apertura con **Transferencia**, cuenta e importe vacíos; cierre/reapertura conservan ese default. Seleccionar localmente sitio e Ingreso físico permite comprobar que Efectivo está deshabilitado. Sin preview ni confirmación.
- Los históricos mantienen «Sin sitio determinado» y naturaleza histórica no determinada.
- Todas las mutaciones de negocio estaban bloqueadas preventivamente en el navegador; no se intentó ninguna. Los únicos POST observados en los logs de esta ventana fueron login y logout.
- **Cero códigos E1C01/E1P01/E1A01** durante el recorrido y cero errores de servidor encontrados en sus logs. La ausencia de esos códigos en navegación no se presenta como prueba de INSERT financieros.
- La comparación final de ambas sesiones conserva las filas/huellas de datos financieros, inventario y catálogo, incluidas las tres guardas. Las únicas tablas con diferencias fueron `auditoria` y `usuarios`, correspondientes a autenticación: cuatro registros más de auditoría por dos login/logout, 31 usuarios antes/después y 9 sesiones antes/después. Las tablas de sesiones de caja y días de caja también conservaron sus filas/huellas; no se abrió ni cerró un turno.
- En Mariana se vio **Apertura de Caja**, fondo inicial vacío y botón Abrir Turno. No se ingresó fondo ni se confirmó apertura. En Cartera se vio la entrada QR/folio sin cargar un documento: no se interpreta eso como ausencia de notas existentes.

Evidencia: `recorrido-sesion.md`, `despues-recorrido.json`, `comparacion-recorrido.json`, `despues-control-final.json`, `comparacion-control-final.json`, `recorrido-api.log` y las capturas de ADMIN, abono y Cobros filtrado. Ambos archivos temporales de autenticación fueron eliminados tras sus respectivos logout.

### Lo que verifica el propietario

1. Entrar desde la pantalla de login con una cuenta **CAJA real**, seleccionar/comprobar su sitio y revisar sus permisos y formularios sin confirmar movimientos.
2. En Cobros, comprobar el sitio real. Mariana pidió apertura de caja: abrir el turno sólo con el fondo real cuando corresponda operar. Cargar un documento genuino para revisar el formulario normal y sus medios de pago antes de confirmar. No se creó un turno ni un documento para completar la prueba.
3. Una vez revisados esos accesos, usar sólo operaciones genuinas permitidas. En el primer abono real por transferencia: comprobar sitio, naturaleza, cuenta, importe, aplicación, saldo y comprobante.
4. Cuando ocurra una autorización/cancelación genuina de nota con rollos, revisar consumo/restitución y crédito; no inventar cancelaciones o pagos para probar. Esto no sustituye la cobertura aislada pendiente.
5. Ante E1C01, E1P01 o E1A01 en una operación permitida, detenerse y reportar pantalla, acción y folio; no cambiarla a corrección ni crear otra captura para sortear el error.

La API no vuelve a pausarse al terminar este recorrido. Las tres capturas cerradas siguen cerradas; no se retiró ninguna guarda ni se modificó el clon o el respaldo de Drive.