# Tarea 4 — preparación inactiva, entrega parcial con bloqueos

## Alcance y estado

No se accedió a bases, ni se ejecutó SQL, HTTP, builds, bundles, migraciones,
reinicios, instalación de dependencias o cambios de entorno. No se modificó
`replit.md`, archivos de A+C/devolución/E1/E2, ventas/POS ni el router de
Inventario compartido con tarea 1. No se creó commit; lo hará el agente principal.
La API servida y el bundle previo permanecen fuera de esta preparación.

Se leyeron las decisiones finales de `prompt-u-respuestas-2026-09-18.md`,
el plan y las reglas pertinentes de `replit.md`. Remate no tiene E asignada;
no es E8 ni la futura purga general de datos de prueba.

### Implementado

- Tres puertas API independientes, literales `false`, y tres puertas UI
  independientes, también `false`; ninguna deriva de variables de entorno.
  La matriz backend tiene además su propio candado literal cerrado.
- **Precios:** la mutación real común individual/masiva comprueba el costo
  canónico de cada modalidad antes de escribir. Rechaza menor al costo,
  admite igualdad y no impone techo. El error tipado llega al middleware
  del router con 409; la transacción existente conserva atomicidad.
  UI individual valida antes de confirmar y otra vez antes de enviar; UI
  masiva valida la selección completa. Todo cerrado: se conserva el
  comportamiento previo con las puertas apagadas.
- **Borrado:** preflight y recuento transaccional exceptúan exclusivamente
  `precio_historial.producto_id` bajo puerta. Después del recuento y de
  credenciales ADMIN, borra ese historial y el producto en la misma transacción.
  No borra `CAMBIAR_PRECIO`, auditoría de purga ni reserva de SKU.
  No exceptúa rollos, kardex, ventas u otras referencias. Conserva existencia
  cero en todos los sitios y bloqueo de cualquier movimiento. El router
  de purga existente exige sesión ADMIN; no se cambió.
  UI existente conserva preflight y diálogo de usuario/contraseña ADMIN;
  el texto complementario queda cerrado por su puerta propia.
- **Marcar remate:** handler real preparado, sin montar, con motivo obligatorio
  y sin campos extra; ADMIN conserva acceso total y otros roles consultan el
  permiso configurable `marcar_remate / autorizar`, sin veto fijo por rol.
  El módulo se incorpora a la matriz solo tras abrir su puerta independiente.
  Ausencia de filas implica denegación para no ADMIN; no se insertaron permisos.
  Adapter transaccional separado: bloqueo del rollo, autorización de alcance
  inyectada por la futura ruta canónica, marca y auditoría en una transacción.
  Componente React preparado, no montado y con puerta cerrada: permiso,
  motivo, estado pendiente y errores explícitos. No contiene fetch ni llama
  una API nueva. Su callback deberá ser una mutación generada al liberar.
- SQL separado preparado y **NO ejecutado**, con reversión que se detiene si
  hay marcas o permisos configurados. No altera esquemas Drizzle, tablas
  globales ni SELECT *. No se registra en startup.

### Detenido, no se presenta como terminado

1. **Venta bajo costo, marca de venta y pérdida en utilidad:** requieren
   integrar ventas/POS y reportes; por la frontera de archivos protegidos
   se detuvo esta subfunción. No se modificó `tickets`, POS, devoluciones,
   analítica de tarea 2 ni contratos generados de A+C. No existe excepción
   activa de venta bajo costo ni se afirma que la pérdida ya aparezca en utilidad.
   Tampoco se preparó una columna global de ticket que exigiría DDL no aplicado.
2. **Contrato/ruta remate:** no se publicó endpoint ni se regeneró OpenAPI
   compartido para evitar tocar fuentes protegidas. Falta registro canónico
   de ruta y alcance por sitio, contrato OpenAPI y generación dirigida revisada,
   además de conexión del componente. El adapter exige un autorizador de
   alcance explícito, no lo inventa ni omite. No es funcionalidad liberable.
3. **Costo desconocido:** decisión de negocio pendiente. El candidato lanza
   `COSTO_PENDIENTE_DECISION` como barrera técnica a su liberación, no como
   regla definitiva para null. No convierte null en cero. Alta de producto
   con precio (sin costo operativo), importación y remoción de precio quedan
   sin nueva regla; tampoco se inventó costo para esos casos.
4. **Edición/retiro de remate:** no hay autorización textual para revocar o
   editar una marca. No se construyeron endpoints ni botones de edición/retiro;
   repetir marca devuelve conflicto y conserva motivo/autor originales.
   No debe confundirse con idempotencia basada en una clave de operación.
5. **Precios y roles:** se conservaron autorizaciones actuales, no se ampliaron.
   La lectura de `routes/precios.ts` muestra `requireSession` y
   `requierePermiso("precios", ...)`, no el guard directo ADMIN descrito en
   `replit.md`. Se reporta la discrepancia preexistente; este trabajo no cambia
   silenciosamente la política de permisos. Revisarla antes de liberar.

## Comprobación sin DB

`tarea4-inactive.mock.test.mjs` transpila fuentes reales con allowlist de imports.
No importa el paquete DB, no hace HTTP ni crea usuarios/sesiones. Ejecuta el
helper real `mutateLockedPrecio` extraído de la fuente, el handler real de
remate y el servicio real de purga con colaboradores simulados. Para UI ejecuta
el cuerpo real del componente con `createElement` y `useState` simulados:
no monta React real, JSDOM ni navegador.

- Precio: tres modalidades, límite exacto, subida sin techo, rechazo antes de
  escrituras, costo desconocido detenido y comportamiento previo con puerta cerrada.
  Son invocaciones del helper con un executor simulado; no se montan routers,
  no se recorre middleware HTTP ni se prueba el flujo masivo completo.
- Remate: seis roles no ADMIN denegados por defecto y admitidos con permiso,
  ADMIN, ausencia de sesión, motivo vacío, campos inesperados, ID inválido,
  alcance denegado, marca repetida y restauración del estado del store simulado
  ante fallo de auditoría.
- Purga: historial aislado con puerta cerrada/abierta, movimiento y existencia,
  credenciales inválidas, restauración del estado del store simulado ante fallo
  de DELETE y conservación de bitácora simulada. Estas restauraciones prueban
  el comportamiento del arnés, no la atomicidad ni el rollback de PostgreSQL.
- Cuerpo del componente con React simulado: retorno nulo bajo puerta cerrada
  o sin permiso, representación de marca existente, motivo requerido, envío
  normalizado y representación del mensaje de error. No acredita renderizado
  real, interacción DOM ni visibilidad en navegador.

Cada prueba nueva tiene un defecto semántico inyectado **solo en su copia en
memoria**, observado como salida 1 del proceso: `price`, `remate`, `purge`, `ui`.
No se alteraron expectativas para dar verde. Tras las cuatro inyecciones se
ejecutó la fuente intacta y terminó verde. Logs finales y comandos en
`verification.log`; hashes SHA-256 de todas las entradas propias en
`source-manifest.sha256`. Typechecks de ambos proyectos usan `--noEmit
--incremental false`, sin emitir build ni actualizar caché.

Límites: no se ensayó PostgreSQL, concurrencia real, login, autorización de
alcance integrada, E2E, navegador, la pérdida en utilidad, ni una venta remate.
Tampoco se acreditan atomicidad PostgreSQL, routers montados, procesamiento
masivo completo de precios ni montaje con React real/JSDOM.
Las pruebas en memoria no sustituyen esa validación futura. La matriz
existente de permisos se comprobó con su suite no-DB. No se pidió captura
de la app: las solicitudes HTTP están prohibidas en esta tanda.

## Texto exacto propuesto para replit.md (edita solo agente principal)

> **Tarea 4 — autorización posterior de construcción inactiva (2026-09-19).**
> La instrucción actual sustituye exclusivamente el aplazamiento «no construir
> todavía/no ahora» de remate, precio mínimo y borrado individual de producto
> sin movimientos con su precio_historial. Autoriza preparar código cerrado
> y SQL con reversión sin ejecutarlo; no autoriza publicar API/frontend,
> reiniciar, migrar ni tocar datos. Permanecen el permiso configurable
> «Marcar remate», solo ADMIN por defecto, la marca por rollo con motivo,
> venta bajo costo únicamente de rollos marcados, señalización de remate
> y pérdida en utilidad; precio de lista no menor al costo y sin techo;
> cero existencia y cero movimientos para borrar, credenciales ADMIN,
> auditoría permanente y no reutilización de SKU. No autoriza la purga
> general futura ni borrar movimientos #51–#53. La preparación de tarea 4
> permanece parcial e inactiva: integración de venta/utilidad y contrato
> remate detenida por archivos protegidos; costo desconocido, alta sin costo
> y edición/retiro de marca requieren resolución antes de liberar. Véase
> reports/tanda-nocturna-20260919/tarea-4/resultado.md.

## Identidad para integración

El manifiesto delimita únicamente archivos de esta tarea, no los cambios de
otros agentes en el árbol compartido. El agente principal debe vincular estos
hashes al commit y árbol Git exactos de su commit separado; no atribuir estas
pruebas a modificaciones posteriores ni a una revisión completa todavía no
confirmada. `verification.log` registra el HEAD completo de referencia y las
versiones; no reemplaza esa vinculación final pendiente.