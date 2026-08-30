---
name: Verificación de impresión
description: Evita falsos positivos al comprobar vistas PDF basadas en CSS de impresión.
---

Las vistas imprimibles deben verificarse con el mismo estado corporal que activa el flujo real, emulando `media: print` y comprobando estilo computado, geometría y participación en el layout. En formatos físicos, medir todos los elementos críticos y validar el PDF natural completo, sin ocultar páginas mediante rangos.

**Why:** Comprobar solo el DOM o exportar sin el estado real de impresión produjo falsos positivos: contenido supuestamente visible con geometría 0×0, una hoja adicional y tamaños físicos incorrectos.

**How to apply:** Activar el mismo estado que el botón, esperar recursos y exportar todas las páginas. Confirmar cantidad, tamaño físico, geometría y recortes; renderizar el PDF y decodificar sus QR, no limitarse a verificar que exista un SVG. Antes de exportar formatos nombrados, comprobar el valor computado de `page`: una regla genérica posterior puede sobrescribir el formato específico aunque ambos contratos existan en el CSS.