---
name: Pruebas sobre componentes realmente montados
description: Evita falsos positivos cuando existen componentes visuales duplicados.
---

Las pruebas de comportamiento visual deben verificar tanto la propiedad esperada como que la aplicación importe y monte ese componente exacto.

**Why:** Una prueba comprobaba la posición centrada en un Toaster duplicado sin uso, mientras el Toaster activo conservaba la posición predeterminada.

**How to apply:** Antes de confiar en una prueba de componente global, rastrea su importación desde la raíz de la app y cubre esa conexión en la regresión.