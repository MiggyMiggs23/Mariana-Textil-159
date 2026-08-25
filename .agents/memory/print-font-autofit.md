---
name: Autoajuste tipográfico de impresión
description: Cuándo recalcular texto autoajustable para evitar desbordamientos tardíos por cambios de fuente.
---

El texto autoajustable en etiquetas y otros documentos debe medirse inicialmente, volver a medirse cuando `document.fonts.ready` se resuelva y recalcularse en `beforeprint`.

**Why:** Una fuente puede terminar de cargar sin cambiar el tamaño del contenedor. En ese caso `ResizeObserver` no se dispara y el texto que cabía con la fuente provisional puede desbordarse con la definitiva.

**How to apply:** Mantener el observador para cambios de geometría, pero no usarlo como único disparador. Verificar después de cargar fuentes que `scrollWidth <= clientWidth` y repetir la medición en el evento de impresión.