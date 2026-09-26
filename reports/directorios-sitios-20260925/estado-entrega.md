# Estado de entrega — candidato verificado visualmente, no activado

## Actualización posterior: simplificaciones y capturas completadas

El propietario aprobó únicamente las propuestas 1, 2, 6, 7 y 8 y rechazó las 3, 4 y 5. Se incorporaron en el candidato frontend `dist-directorios-sitios-20260925-simplificados`, con pruebas focalizadas e isolated typecheck aprobados. Teléfono y RFC permanecen visibles en el directorio; esta simplificación no modifica Últimas ventas ni Estado de cuenta.

Se sustituyó la entrega visual incompleta por imágenes PNG reales obtenidas de Chromium local. La galería autocontenida `capturas-antes-despues.html` contiene 85 imágenes de cuatro escenarios explícitamente identificados: versión activa congelada, candidato anterior a las simplificaciones, candidato final y reclasificación sintética de Bodega Cruces. `capturas-resumen-operativo.html` presenta los cinco selectores operativos y las dos comprobaciones de Cartera.

Los cuatro manifiestos de `browser-local/screenshots/` registran cero endpoints sin respuesta de prueba y cero errores de navegador. Se comprobaron las cuatro bodegas en Inventario, Entradas, Salidas, Viajes y Movimientos; Cartera excluye BODEGA aunque esté activa e incluye Bodega Cruces al cambiar solo su tipo a TIENDA. Se completaron las capturas de ficha, Últimas ventas, Estado de cuenta y navegación del folio de venta sintético a su documento. Las imágenes usan datos sintéticos, no una sesión ni operaciones de producción.

No se activó el candidato ni se modificó la base. La activación de la API continúa condicionada a autorización expresa para añadir la columna RFC opcional de proveedor y aplicar su migración antes del arranque. La API candidata anterior permanece sin cambios.

## Construcción

Se prepararon candidatos separados de la versión activa, con procedencia y hashes en candidate-ready.json. Se conservaron los módulos no autorizados fuera de la composición. No se reiniciaron workflows, aplicó DDL ni modificaron datos de la aplicación.

Los cambios abarcan selectores contextuales de crédito por tipo de sitio, directorios de Clientes y Proveedores, sus periodos y conteos, reutilización de historiales y RFC opcional de proveedor. La migración RFC está preparada y NO aplicada. La API candidata requiere aplicar esa migración antes de activarse, con autorización expresa.

Las pruebas enfocadas y typechecks indicados en los informes de cada componente aprobaron. La revisión independiente reconfirmó las correcciones de permisos del conteo de proveedores, fechas desconocidas al final, comparación por alcance contextual y descarte de resultados anteriores al cambiar de tienda en Cobros.

## Antecedente sustituido: primera verificación visual parcial

El navegador utilizó componentes reales de los builds congelados con respuestas sintéticas, sin autenticación ni escrituras reales. Se observaron los cinco selectores operativos antes/después con Bodega Cruces incluida; Cartera la excluyó como BODEGA y la incluyó al cambiar sintéticamente su tipo a TIENDA.

La prueba no incluyó Tomás, Don Nacho ni Lucas Alamán. No se completaron la ficha de cliente/Últimas ventas ni todos los recorridos de búsqueda, ordenamiento e historiales de proveedores. La discrepancia del KPI de proveedores ocurrió bajo respuestas sintéticas incompletas y no se atribuye a la aplicación sin reproducción.

Los identificadores de evidencia del navegador no se pudieron convertir en las imágenes comparativas solicitadas. Los JPEG exportados por el verificador eran observaciones de comprobación de sesión, no capturas válidas de los selectores; NO acreditan aceptación ni se entregan como antes/después.

En ese intento no se declaró completado el pedido ni se presentó una galería válida. Los límites visuales de ese intento quedaron superados por las capturas locales descritas arriba; no se convierten retrospectivamente aquellos JPEG en evidencia válida.

## Propuestas

propuestas-sin-aplicar.md conserva el listado original. Únicamente se aplicaron 1, 2, 6, 7 y 8 tras aprobación explícita. Las demás fueron rechazadas. No se autoriza esconder o retirar información adicional.