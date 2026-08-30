---
name: Cursor visual en PDFs automatizados
description: Cómo distinguir una hoja creada por el cursor del controlador de un desbordamiento real del documento.
---

El controlador visual de pruebas puede incrustar su cursor morado como una
imagen rasterizada en una hoja física adicional, aunque no exista un nodo
correspondiente en el DOM.

**Why:** En una verificación de impresión, el documento tenía cajas de altura
correcta, cero desbordamiento y paginación interna coherente, pero el PDF
conservaba una hoja final con una única imagen de cursor y sin texto. Cambios de
saltos, alturas, aislamiento del DOM y plugins no la eliminaron.

**How to apply:** Ante una hoja extra, primero buscar texto o filas huérfanas
con `pdftotext -layout`, revisar el conteo con `pdfinfo`, rasterizar la hoja y
enumerar imágenes con `pdfimages -list`. Solo atribuirla al controlador si la
hoja contiene exclusivamente el cursor y ninguna parte del documento; el
desbordamiento real siempre se corrige en el layout y se vuelve a medir.