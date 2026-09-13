---
name: Manifiestos explícitos para pruebas restringidas
description: Evitar descubrimiento implícito cuando una selección de suites debe excluir red y bases de datos.
---

Para ejecutar una selección segura, comprobar que la búsqueda terminó correctamente y que el manifiesto contiene rutas antes de invocar el runner. Nunca pasar una expansión vacía a `tsx --test`.

**Why:** Sin rutas, el runner puede descubrir archivos adicionales, incluidos scripts de navegador. Quitar variables de conexión al proceso no bloquea HTTP ni convierte esa ejecución en una prueba sin red.

**How to apply:** Usar un directorio explícito, abortar ante error de selección o lista vacía y conservar el manifiesto exacto. Distinguir los intentos fallidos de la corrida seleccionada; no atribuirles controles o conteos que no se comprobaron.