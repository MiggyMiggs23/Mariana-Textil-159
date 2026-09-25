# Estado de entrega — candidato, no activado

## Construcción

Se prepararon candidatos separados de la versión activa, con procedencia y hashes en candidate-ready.json. Se conservaron los módulos no autorizados fuera de la composición. No se reiniciaron workflows, aplicó DDL ni modificaron datos de la aplicación.

Los cambios abarcan selectores contextuales de crédito por tipo de sitio, directorios de Clientes y Proveedores, sus periodos y conteos, reutilización de historiales y RFC opcional de proveedor. La migración RFC está preparada y NO aplicada. La API candidata requiere aplicar esa migración antes de activarse, con autorización expresa.

Las pruebas enfocadas y typechecks indicados en los informes de cada componente aprobaron. La revisión independiente reconfirmó las correcciones de permisos del conteo de proveedores, fechas desconocidas al final, comparación por alcance contextual y descarte de resultados anteriores al cambiar de tienda en Cobros.

## Verificación visual parcial — NO cumple toda la aceptación

El navegador utilizó componentes reales de los builds congelados con respuestas sintéticas, sin autenticación ni escrituras reales. Se observaron los cinco selectores operativos antes/después con Bodega Cruces incluida; Cartera la excluyó como BODEGA y la incluyó al cambiar sintéticamente su tipo a TIENDA.

La prueba no incluyó Tomás, Don Nacho ni Lucas Alamán. No se completaron la ficha de cliente/Últimas ventas ni todos los recorridos de búsqueda, ordenamiento e historiales de proveedores. La discrepancia del KPI de proveedores ocurrió bajo respuestas sintéticas incompletas y no se atribuye a la aplicación sin reproducción.

Los identificadores de evidencia del navegador no se pudieron convertir en las imágenes comparativas solicitadas. Los JPEG exportados por el verificador eran observaciones de comprobación de sesión, no capturas válidas de los selectores; NO acreditan aceptación ni se entregan como antes/después.

Por tanto, no se declara completado el pedido, no se recomienda activar todavía y no se presenta una galería como si las capturas estuvieran entregadas. Hace falta completar la verificación con contratos sintéticos correctos y exportar las imágenes efectivas.

## Propuestas

propuestas-sin-aplicar.md contiene ocho propuestas y sus motivos. Ninguna fue aplicada. Se espera la decisión del propietario antes de retirar o plegar información adicional.