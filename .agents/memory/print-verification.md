---
name: Verificación de impresión
description: Evita falsos positivos al comprobar vistas PDF basadas en CSS de impresión.
---

Las vistas imprimibles deben verificarse con el mismo estado corporal que activa el flujo real, emulando `media: print` y comprobando estilo computado, geometría y participación en el layout. En formatos físicos, medir todos los elementos críticos y validar el PDF natural completo, sin ocultar páginas mediante rangos.

**Why:** Comprobar solo el DOM o exportar sin el estado real de impresión produjo falsos positivos: contenido supuestamente visible con geometría 0×0, una hoja adicional, tamaños físicos incorrectos y un PDF vacío cuyo QR parecía fallar.

**How to apply:** Activar manualmente el mismo estado que el botón y mantenerlo hasta que `page.pdf` termine; no hacer clic en `window.print`, porque su limpieza puede ejecutarse antes de exportar. Esperar recursos y dos frames, comprobar que el nodo imprimible sea visible y que el raster no esté vacío, y exportar todas las páginas. Confirmar cantidad, tamaño físico, geometría y recortes; renderizar el PDF y decodificar sus QR, no limitarse a verificar que exista un SVG. Si el layout principal contamina la paginación, portar la copia imprimible directamente al `body` y ocultar `#root` durante impresión. Antes de exportar formatos nombrados, comprobar el valor computado de `page`: una regla genérica posterior puede sobrescribir el formato específico aunque ambos contratos existan en el CSS.