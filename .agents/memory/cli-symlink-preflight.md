---
name: Entrada CLI bajo symlinks
description: Evitar éxito aparente de preflights invocados mediante enlaces simbólicos.
---

La validación directa de un CLI no demuestra que el wrapper lo ejecute cuando cambia la forma de resolver su ruta. Exigir evidencia positiva de ejecución del preflight, además del código de salida.

**Why:** En un ensayo aislado, comparar la ruta de argv con import.meta.url omitió main al invocar el archivo mediante un enlace simbólico. El proceso terminó con exit 0 sin hacer las comprobaciones, aunque las pruebas directas del mismo preflight habían pasado.

**How to apply:** Probar la invocación real del wrapper, incluidos los enlaces utilizados por el ensayo, y comprobar que se produjo el resultado explícito del preflight. No presentar las pruebas directas como validación de una ejecución omitida.