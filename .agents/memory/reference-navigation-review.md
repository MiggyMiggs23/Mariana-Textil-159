---
name: Referencias convertidas en enlaces
description: Riesgo al reutilizar resolutores existentes para habilitar navegación nueva.
---

Al convertir referencias antes textuales en enlaces, revisar todas las ramas del resolver reutilizado contra los destinos existentes, no solo el tipo documental que motivó el cambio.

**Why:** Un resolver puede conservar rutas obsoletas que no causaban un fallo visible mientras la interfaz mostraba únicamente texto. Reutilizarlo no demuestra por sí solo que todos sus destinos sean navegables.

**How to apply:** Probar sus tipos reconocidos y referencias incompletas; comprobar que cada ruta generada corresponde a un destino existente. No crear pantallas para encubrir un enlace inválido cuando esa ampliación no está autorizada.