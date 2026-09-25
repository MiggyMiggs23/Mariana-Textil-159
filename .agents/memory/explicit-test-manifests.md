---
name: Manifiestos explícitos para pruebas restringidas
description: Evitar descubrimiento implícito cuando una selección de suites debe excluir red y bases de datos.
---

Para ejecutar una selección segura, comprobar que la búsqueda terminó correctamente y que el manifiesto contiene rutas antes de invocar el runner. Nunca pasar una expansión vacía a `tsx --test`.

**Why:** Sin rutas, el runner puede descubrir archivos adicionales, incluidos scripts de navegador. Quitar variables de conexión al proceso no bloquea HTTP ni convierte esa ejecución en una prueba sin red.

**How to apply:** Usar un directorio explícito, abortar ante error de selección o lista vacía y conservar el manifiesto exacto. Distinguir los intentos fallidos de la corrida seleccionada; no atribuirles controles o conteos que no se comprobaron.

Con un bloqueo estricto de sockets, ejecutar TypeScript mediante Node nativo con `--import` apuntando al loader de `tsx`, no mediante su CLI.

**Why:** La CLI de `tsx` abre un servidor IPC incluso para pruebas puras. El bloqueo correcto de sockets puede impedir que arranque antes de ejecutar una sola prueba. Además, el paquete frontend no necesariamente tiene una dependencia directa de `tsx`.

**How to apply:** Resolver el loader desde el paquete de herramientas instalado, preservar el preload de aislamiento en hijos y pasar la configuración JSX mediante `TSX_TSCONFIG_PATH`. Un manifiesto seguro para no tocar datos puede incluir fixtures visuales con HTTP local; no confundir esa clasificación con “cero sockets”.

Las capturas comparativas deben conservar una línea base inmutable y comprobar explícitamente la fase recibida por el proceso hijo.

**Why:** Un runner que limpia variables de entorno puede descartar el selector antes/después y sobrescribir capturas anteriores con la versión nueva, aun cuando el comando termine correctamente.

**How to apply:** Pasar la fase por un mecanismo admitido por el runner, exigir confirmación de fase y directorio antes de guardar, y reconstruir una referencia perdida solo en un árbol aislado, declarándola reconstruida.