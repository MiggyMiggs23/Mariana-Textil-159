---
name: Autoajuste tipográfico de impresión
description: Cuándo recalcular texto autoajustable para evitar desbordamientos tardíos por cambios de fuente.
---

El texto autoajustable en etiquetas y otros documentos debe medirse inicialmente, volver a medirse cuando `document.fonts.ready` se resuelva y recalcularse en `beforeprint`.

**Why:** Una fuente puede terminar de cargar sin cambiar el tamaño del contenedor. En ese caso `ResizeObserver` no se dispara y el texto que cabía con la fuente provisional puede desbordarse con la definitiva.

**How to apply:** Mantener el observador para cambios de geometría, pero no usarlo como único disparador. Verificar después de cargar fuentes que `scrollWidth <= clientWidth` y repetir la medición en el evento de impresión.

Un portal de impresión oculto con ancho cero está **pendiente de medición**, no demuestra desbordamiento. Antes de bloquear, medir el portal real fuera de pantalla con sus dimensiones físicas, después de esperar fuentes y recursos; restaurar sus estilos y repetir la medición al imprimir. Si siguen cargando las fuentes o falta una medición válida, informar y no imprimir silenciosamente.

**Why:** `display:none` produce geometría cero incluso para nombres que caben. Convertir esa medida en error, o consultar un error anterior antes de medir todos los campos, puede bloquear una etiqueta válida. Medir un componente diagnóstico visible no verifica el comportamiento del portal oculto del botón real.

Cuando la regla solicitada sea «una línea si cabe; si no, dos», probar primero una línea al tamaño normal aprobado, después dos líneas con saltos únicamente entre palabras y, solo dentro de esa alternativa, los escalones legibles permitidos. No agotar una escalera de reducción de una línea antes de probar dos ni bajar del mínimo para quitar un bloqueo.

**Why:** Que el nombre quepa encogiéndolo no prueba que se haya respetado la prioridad de lectura solicitada. Conservar palabras completas y el mínimo legible permite distinguir un ajuste válido de un desbordamiento auténtico, cuyo valor completo debe seguir comunicado.