# Estado de entrega — ACTIVO sin RFC nuevo de proveedores

## Activación autorizada (26/09/2026)

Autorización literal: **«Osea activa todo menos ese, ese cambio no lo quiero»**; se excluyó el RFC nuevo de proveedores. MAIN activó `artifacts/api-server/dist-directorios-sitios-20260925-sin-rfc` y `artifacts/mariana-textil/dist-directorios-sitios-20260925-sin-rfc` con configuración TOML validada y un reinicio por workflow administrado. API PID 20373 arrancó en modo inspección sin inicializadores, frontend HTTP 200 con `index.html` SHA-256 `7f7650f603302b32a985eac9fbb64e0fd4e3897c17093f307f912dcede21b926`, y `/healthz` HTTP 200. Evidencia READ ONLY `activation-sin-rfc/before.json` y `activation-sin-rfc/after.json`: 108 tablas, misma base y esquema, ningún conteo ni hash de contenido alterado. **No se ejecutó DDL ni migración**. Ver `activation-sin-rfc/resultado.md` y su manifiesto para hashes/procedencia.

## Actualización posterior: simplificaciones y capturas completadas

El propietario aprobó únicamente las propuestas 1, 2, 6, 7 y 8 y rechazó las 3, 4 y 5. Se incorporaron primero en el candidato frontend `dist-directorios-sitios-20260925-simplificados` y se conservaron en la versión activa sin RFC de proveedor, con pruebas focalizadas y typecheck aislado aprobados. Teléfono y RFC **de clientes** permanecen visibles en el directorio de Clientes; esta simplificación no modifica Últimas ventas ni Estado de cuenta.

Se sustituyó la entrega visual incompleta por imágenes PNG reales obtenidas de Chromium local. La galería autocontenida `capturas-antes-despues.html` contiene 85 imágenes de cuatro escenarios explícitamente identificados: versión activa congelada, candidato anterior a las simplificaciones, candidato final y reclasificación sintética de Bodega Cruces. `capturas-resumen-operativo.html` presenta los cinco selectores operativos y las dos comprobaciones de Cartera.

Los cuatro manifiestos de `browser-local/screenshots/` registran cero endpoints sin respuesta de prueba y cero errores de navegador. Se comprobaron las cuatro bodegas en Inventario, Entradas, Salidas, Viajes y Movimientos; Cartera excluye BODEGA aunque esté activa e incluye Bodega Cruces al cambiar solo su tipo a TIENDA. Se completaron las capturas de ficha, Últimas ventas, Estado de cuenta y navegación del folio de venta sintético a su documento. Las imágenes usan datos sintéticos, no una sesión ni operaciones de producción.

Las galerías documentan candidatos y escenarios sintéticos anteriores a la exclusión final del RFC proveedor; no son una prueba autenticada de la versión hoy activa. La nueva versión sin RFC se activó por separado, sin modificar datos ni esquema según las huellas READ ONLY.

## Construcción

Se prepararon primero candidatos separados de la entonces versión activa, con procedencia y hashes en `candidate-ready.json`. Se conservaron los módulos no autorizados fuera de la composición. Tras el rechazo del RFC proveedor se produjo un candidato final nuevo, con manifiesto y procedencia en `activation-sin-rfc/`, que MAIN activó sin DDL ni cambios de datos/esquema.

La versión activa abarca selectores contextuales de crédito por tipo de sitio, directorios de Clientes y Proveedores, sus periodos y conteos y reutilización de historiales, **sin RFC nuevo de proveedor**. El antiguo SQL candidato RFC fue retirado; no hay DDL pendiente para esta versión.

Las pruebas enfocadas y typechecks indicados en los informes de cada componente aprobaron. La revisión independiente reconfirmó las correcciones de permisos del conteo de proveedores, fechas desconocidas al final, comparación por alcance contextual y descarte de resultados anteriores al cambiar de tienda en Cobros.

## Antecedente sustituido: primera verificación visual parcial

El navegador utilizó componentes reales de los builds congelados con respuestas sintéticas, sin autenticación ni escrituras reales. Se observaron los cinco selectores operativos antes/después con Bodega Cruces incluida; Cartera la excluyó como BODEGA y la incluyó al cambiar sintéticamente su tipo a TIENDA.

La prueba no incluyó Tomás, Don Nacho ni Lucas Alamán. No se completaron la ficha de cliente/Últimas ventas ni todos los recorridos de búsqueda, ordenamiento e historiales de proveedores. La discrepancia del KPI de proveedores ocurrió bajo respuestas sintéticas incompletas y no se atribuye a la aplicación sin reproducción.

Los identificadores de evidencia del navegador no se pudieron convertir en las imágenes comparativas solicitadas. Los JPEG exportados por el verificador eran observaciones de comprobación de sesión, no capturas válidas de los selectores; NO acreditan aceptación ni se entregan como antes/después.

En ese intento no se declaró completado el pedido ni se presentó una galería válida. Los límites visuales de ese intento quedaron superados por las capturas locales descritas arriba; no se convierten retrospectivamente aquellos JPEG en evidencia válida.

## Propuestas

propuestas-sin-aplicar.md conserva el listado original. Únicamente se aplicaron 1, 2, 6, 7 y 8 tras aprobación explícita. Las demás fueron rechazadas. No se autoriza esconder o retirar información adicional.