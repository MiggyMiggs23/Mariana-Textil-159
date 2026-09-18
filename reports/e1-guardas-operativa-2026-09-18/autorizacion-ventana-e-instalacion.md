# Ampliación autorizada: ventana de identidad y guardas operativas E1

Registrada el 18 de septiembre de 2026, **antes de arrancar la API y antes de cualquier escritura operativa de esta intervención**.

## Resolución del propietario

Se autoriza arrancar la API únicamente para confirmar su identidad actual desde su propio pool y volver a pausarla inmediatamente, antes del primer DDL de las guardas.

Secuencia obligatoria:

1. Arrancar con el código E1 adaptado, no el anterior.
2. Obtener `current_database()` desde el pool real del proceso API, como en Prompt H.
3. Detener inmediatamente la API. Nadie debe operar durante la ventana.
4. Con la API pausada, revalidar el inventario E1 aprobado —referido por el propietario como los 27 objetos— y la ausencia de las guardas. No sustituir un inventario de catálogo por el número de sentencias del archivo anterior; conservar la evidencia exacta. Cualquier diferencia exige detenerse.
5. Ejecutar la instalación supervisada de **tres funciones y tres triggers temporales y removibles sobre heliumdb**, sin tocar funciones, triggers ni restricciones permanentes de E1.

Ante fallo o comportamiento inesperado del arranque: **detenerse y reportarlo, sin instalar guardas ni reparar automáticamente**.

## Escrituras del arranque anunciadas previamente

Antes del arranque se informó al propietario:

- El arranque normal ejecuta inicializadores que pueden crear/reafirmar esquema y semillas/configuración de permisos y roles, incluyendo `updated_at` de permisos.
- Tras escuchar, ejecuta el backfill idempotente de compras a proveedores y el evaluador de stock mínimo, que puede escribir episodios y notificaciones.
- Se medirán y registrarán los efectos de esta ventana por separado. No se presentarán como efectos de la instalación de guardas, ni se ocultarán como cambios irrelevantes.

El propietario aclaró que los efectos reproducibles de arranque mencionados no constituyen contaminación, pero deben quedar documentados. Esto no autoriza escrituras financieras inesperadas ni una reparación automática si algo difiere de lo previsto.

## Exclusión de operaciones durante la ventana

Se preparará un bloqueo externo y temporal de peticiones HTTP, antes de Express, limitado al proceso del bundle API: sólo `GET /api/healthz` podrá alcanzar la aplicación. Las demás peticiones serán rechazadas con 503 y las conexiones upgrade serán cerradas. No se modifica el código E1 ni se permite login o uso operativo. El inspector se limita a loopback.

La comparación previa encontró 1,170 archivos API/DB/contratos idénticos al manifiesto del ensayo real E1. El arranque usa build del código actual y se debe contrastar el bundle cargado con su hash en disco.

## Condiciones anteriores que siguen vigentes

Se incorpora `reports/e1-guardas-temporales-2026-09-18/autorizacion-operativa-condicionada.md`:

- Supervisor externo activo con límite de 30 segundos; si se agota antes de COMMIT, interrumpir y revertir. No enviar COMMIT tras agotarlo.
- Ante respuesta perdida después de COMMIT, verificar el resultado real desde una conexión nueva. No presumir rollback ni reinstalar a ciegas.
- Revalidar identidad y estado exacto antes del DDL; mantener la API detenida durante instalación y verificación.
- Instalar juntas las seis sentencias DDL ya presentadas, sin retirar posteriormente las guardas en la operativa.
- Comprobar tres guardas activas, rechazos E1C01/E1P01/E1A01, admisión de contratos permitidos, históricos intactos y tiempo real.
- Las sondas posteriores sólo documentan sus efectos dentro de transacciones revertidas; no se crean usuarios, permisos ni contraseñas de prueba.
- Conservar el clon y el respaldo de Drive hasta cerrar E1.
- No se autoriza reanudar la API para operación normal al terminar; se debe emitir un dictamen de preparación o explicar qué falta.

## Retiro futuro

- Efectivo: E2 y E3 coordinados.
- Pendientes: E3 y E5 con sus dependencias.
- Atribución histórica: no se libera automáticamente con ninguna entrega; requiere decisión explícita del propietario sobre evidencia y sitio.