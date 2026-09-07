---
name: Límite de history en Safari
description: Evitar el límite estricto de Safari para escrituras repetidas en el historial del navegador.
---

No escribir en `history.replaceState` cuando el estado de página o la posición de scroll sean semánticamente iguales a los ya guardados. Los setters de colecciones deben devolver la referencia anterior cuando no cambie su contenido.

**Why:** Safari limita las llamadas a `replaceState` a 100 por cada 10 segundos. Un restaurador de scroll y un efecto que recreaban un `Set` sin cambios podían generar una escritura por frame; Chromium no mostraba el problema.

**How to apply:** Comparar valores estructuralmente antes de persistirlos, omitir posiciones de scroll sin cambios y evitar devolver nuevos arrays, objetos o `Set` desde efectos cuando representan el mismo estado.