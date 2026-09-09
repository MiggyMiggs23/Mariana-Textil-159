---
name: Entorno de procesos desacoplados
description: Diferencias no evidentes entre el workspace y procesos lanzados desde el sandbox de ejecución.
---

Los procesos desacoplados lanzados desde el sandbox de ejecución no deben asumir que heredarán el `PATH` Nix ni los secretos disponibles para los workflows del workspace. Además, respuestas de conectores que contienen credenciales pueden envolver la URI en texto descriptivo en vez de devolverla como valor plano.

**Why:** Un arnés de verificación puede fallar antes de ejecutar pruebas porque no encuentra Node o pnpm, no ve un secreto del workspace o intenta usar como URI toda la respuesta textual del conector.

**How to apply:** Al lanzar verificaciones desacopladas, pasar explícitamente las rutas de runtime necesarias, usar credenciales temporales limitadas a bases desechables cuando proceda y extraer/validar internamente la URI sin imprimirla.