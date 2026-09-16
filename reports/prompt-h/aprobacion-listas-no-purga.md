# Aprobación del propietario — listas, respaldo y preflight; NO purga

Recibida el 15 de septiembre de 2026, zona America/Mexico_City, después de presentar el inventario del Bloque 1. No se dispone de la hora exacta del mensaje; no se inventa.

## Cita textual del mensaje del propietario

La cita siguiente conserva la solicitud histórica tal como se recibió; la resolución de identidad que pidió se documenta inmediatamente después.

> Apruebo las listas; continuar con respaldo y preflight
>
> • entrada_folio, salida_folio, viaje_folio, auditoria_inventario_folio → 0 por sitio. Primer folio 1.
> • ticket_folio → 999. Primer ticket 1000.
> • series_consecutivo → 1000000. Primera serie 1000001.
>
> Poner series_consecutivo en 0 daría series de un dígito y rompería la regla de que la serie son los últimos siete dígitos del QR, dejando el escaneo inservible. Son los mismos valores que usó la purga del 13 de septiembre.
>
> El TRUNCATE va SIN RESTART IDENTITY. Los IDs internos continúan donde van, para que la bitácora conservada nunca apunte a un ID que después signifique otra cosa.
>
> Antes del preflight, resuelve el pendiente de identidad: obtén current_database() desde el proceso de la API, no solo la coincidencia de configuración. No se purga una base cuya identidad efectiva no esté confirmada.
>
> Documenta estos tres hallazgos tuyos en reports/ y en replit.md:
>
> 1. Los triggers no internos vivos son 14, no los 11 que dice replit.md. Corrige ese conteo caduco.
> 2. cuadre_fiscal_registros existe en la base y no está declarada en Drizzle. Repórtalo como deriva entre esquema y base. No la crees ni la borres del esquema; es decisión aparte.
> 3. Los triggers append-only bloquean DELETE pero no TRUNCATE. Documéntalo como hallazgo de seguridad: la inmutabilidad de la bitácora y de los movimientos de crédito es evitable por esa vía.
>
> Continúa con el Bloque 2, el respaldo verificado por restauración, y después el preflight. La purga sigue sin autorización.

La cita conserva el estado de la solicitud recibida antes de completar la comprobación de identidad. Ese pendiente ya quedó **RESUELTO**: `current_database()` confirmó `heliumdb` y `current_schema()` confirmó `public` desde el pool existente en proceso de la API. La evidencia de solo lectura es `reports/prompt-h/api-pool-identity-2026-09-15.md`; no se abrió endpoint público, no se reinició la API, no se cambió autenticación/entorno y el inspector de loopback quedó cerrado. El resultado config-only anterior de Bloque 1 es histórico y ya no se presenta como bloqueo vigente de identidad.

## Alcance

Listas aprobadas con estas correcciones obligatorias. Se autorizan respaldo completo, restauración desechable de verificación, verificación de Drive y preflight de lectura. Este archivo **no autoriza ejecutar el Bloque 4**, borrar datos operativos ni reiniciar contadores. El preflight deberá presentarse y esperar una autorización posterior independiente.

Se retiran las propuestas anteriores de poner todos los contadores a cero y reiniciar secuencias: los IDs internos y sus secuencias se conservan. El eventual TRUNCATE de A será sin RESTART IDENTITY; `existencias` se reconstruirá con la transacción, nunca se truncará como parte de A.

## Listas vivas vigentes para aprobación

La captura viva de Prompt H documenta **60 tablas**: **A=35, B=7, C=18**. Esta es la única lista vigente para cualquier revisión posterior; no sustituye una autorización de mutación. Las listas históricas de purgas anteriores no son instrucciones actuales.

| Clase | Tabla | Tratamiento propuesto, sin ejecutar |
|---|---|---|
| A | `aplicaciones_credito` | operación A |
| A | `aplicaciones_pago_proveedor` | operación A |
| A | `auditoria_inventario_escaneos` | operación A |
| A | `auditoria_inventario_participantes` | operación A |
| A | `auditoria_inventario_snapshot` | operación A |
| A | `auditorias_inventario` | operación A |
| A | `autorizaciones_nota` | operación A |
| A | `contenedor_lineas` | operación A |
| A | `contenedores` | operación A |
| A | `cuadre_fiscal_registros` | operación A |
| A | `entradas` | operación A |
| A | `movimientos` | operación A |
| A | `movimientos_credito` | operación A |
| A | `notificaciones_credito` | operación A |
| A | `notificaciones_sistema` | operación A |
| A | `pagos_proveedor` | operación A |
| A | `reimpresiones_etiqueta` | operación A |
| A | `revisiones_etiqueta` | operación A |
| A | `rollos` | operación A |
| A | `salida_lineas` | operación A |
| A | `salida_rollos` | operación A |
| A | `salidas` | operación A |
| A | `salidas_dinero_caja` | operación A |
| A | `sesiones` | operación A |
| A | `sesiones_caja` | operación A |
| A | `sesiones_caja_dias` | operación A |
| A | `solicitudes_pago_dirigido` | operación A |
| A | `stock_minimo_episodios` | operación A |
| A | `ticket_linea_consumos` | operación A |
| A | `ticket_lineas` | operación A |
| A | `ticket_pagos` | operación A |
| A | `tickets` | operación A |
| A | `viaje_salidas` | operación A |
| A | `viaje_tickets` | operación A |
| A | `viajes` | operación A |
| B | `auditoria_inventario_folio` | contador: 0 |
| B | `entrada_folio` | contador: 0 |
| B | `existencias` | reconstruir, no truncar |
| B | `salida_folio` | contador: 0 |
| B | `series_consecutivo` | contador: 1000000 |
| B | `ticket_folio` | contador: 999 |
| B | `viaje_folio` | contador: 0 |
| C | `auditoria` | conservar |
| C | `camionetas` | conservar |
| C | `choferes` | conservar |
| C | `cliente_documentos` | conservar |
| C | `clientes` | conservar |
| C | `equipos` | conservar |
| C | `equipos_checklist` | conservar |
| C | `permisos_rol` | conservar |
| C | `permisos_ubicacion` | conservar |
| C | `permisos_usuario` | conservar |
| C | `pisos` | conservar |
| C | `precio_historial` | conservar |
| C | `productos` | conservar |
| C | `proveedores` | conservar |
| C | `stock_minimo_sitios` | conservar |
| C | `stock_minimos` | conservar |
| C | `ubicaciones` | conservar |
| C | `usuarios` | conservar |

## Contadores y secuencias

- `entrada_folio`, `salida_folio`, `viaje_folio` y `auditoria_inventario_folio`: **0** por sitio; el primer folio será **1**.
- `ticket_folio`: **999**; el primer ticket será **1000**.
- `series_consecutivo`: **1000000**; la primera serie será **1000001**.
- Los contadores anteriores son valores de filas B, no reinicios de secuencias. El eventual TRUNCATE será **sin `RESTART IDENTITY`**: se preservan IDs internos y secuencias para evitar reutilizar referencias históricas.
- No se hará `ALTER SEQUENCE`, `setval` ni ningún otro reset de secuencias en este turno. `public.contenedores_folio_seq` alimenta el folio de negocio de `contenedores` y queda **PENDIENTE de una decisión explícita separada**. Pregunta exacta pendiente: **¿debe `public.contenedores_folio_seq` reiniciarse como folio de negocio de `contenedores`, o debe conservarse sin reset para evitar reutilizar folios históricos?** No se resuelve ni se reinicia aquí.

## Deriva y seguridad

- `cuadre_fiscal_registros` está viva en la base y ausente de la declaración Drizzle: es deriva entre esquema y base. Se documenta solamente; **no se crea ni se borra del esquema** en este trabajo.
- Los guards append-only bloquean `DELETE` por filas, pero no impiden `TRUNCATE` a roles privilegiados. Es un hallazgo de seguridad de privilegios de base de datos, **no una afirmación de explotación HTTP**. La remediación de seguridad es separada y los triggers quedan intactos.

## Puerta futura

No se ejecutó respaldo, restauración, preflight, purga, `TRUNCATE`, `UPDATE`, reset de secuencias ni cambio de triggers. Cualquier mutación futura queda **PENDIENTE de nueva autorización textual del propietario después de respaldo verificado y preflight**. Ninguna referencia anterior de respaldo se sustituye aquí ni se declara verificada sin el resultado real correspondiente.