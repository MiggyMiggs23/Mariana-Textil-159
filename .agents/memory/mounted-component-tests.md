---
name: Pruebas sobre componentes realmente montados
description: Evita falsos positivos cuando existen componentes visuales duplicados.
---

Las pruebas de comportamiento visual deben verificar tanto la propiedad esperada como que la aplicación importe y monte ese componente exacto.

**Why:** Una prueba comprobaba la posición centrada en un Toaster duplicado sin uso, mientras el Toaster activo conservaba la posición predeterminada.

**How to apply:** Antes de confiar en una prueba de componente global, rastrea su importación desde la raíz de la app y cubre esa conexión en la regresión.

Las pruebas de producción también deben arrancar el artefacto construido con su configuración real; compilar un helper aisladamente no verifica el paquete desplegable.

**Why:** Un PDF se generó correctamente desde un bundle de prueba, pero el servidor real no arrancó porque sus reglas de dependencias externas eran distintas. Con pnpm, que una dependencia transitiva exista en disco no implica que el entrypoint final pueda importarla.

**How to apply:** Después de añadir una biblioteca con fuentes o recursos de ejecución, verificar el arranque del bundle real con sus reglas de dependencias externas y rutas de recursos. La prueba aislada del generador es complementaria, no sustituta.