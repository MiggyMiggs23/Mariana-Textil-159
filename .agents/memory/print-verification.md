---
name: Verificación de impresión
description: Evita falsos positivos al comprobar vistas PDF basadas en CSS de impresión.
---

Las vistas imprimibles deben verificarse emulando `media: print` y comprobando el estilo computado, el rectángulo y la participación en el layout de los elementos visibles y ocultos. En etiquetas físicas, medir también cada elemento crítico: un SVG con ancho declarado en milímetros aún puede encogerse dentro de flexbox, y los textos dinámicos pueden existir completos en el DOM pero quedar recortados.

**Why:** Una comprobación basada solo en `textContent` reportó navegación y pestañas como visibles aunque sus ancestros tenían `display: none`, rectángulos de 0×0 y no participaban en la impresión. En otra etiqueta, el QR medía menos de lo declarado y un SKU largo se recortaba pese a conservar todo su texto en el DOM.

**How to apply:** Para flujos de “Imprimir PDF”, confirmar que el contenido imprimible tiene tamaño real y que los elementos `no-print` tienen `display: none`, rectángulo 0×0 y `offsetParent` nulo; medir SVG y textos con rectángulo, `scrollWidth` y `clientWidth`; complementar con una captura en media print.