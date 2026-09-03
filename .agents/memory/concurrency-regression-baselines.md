---
name: Regresiones concurrentes deterministas
description: Requisitos de evidencia para pruebas que demuestran defectos de concurrencia.
---

Una regresión concurrente debe coordinar las operaciones con una barrera explícita y tiempo límite, y ejecutarse contra el código anterior antes de implementar la corrección.

**Why:** dos operaciones lanzadas con `Promise.all` pueden ordenarse favorablemente y pasar por casualidad aunque el defecto siga presente. Además, una prueba que nunca falla contra la versión defectuosa no demuestra la regresión.

**How to apply:** mantener la primera operación en el punto crítico, confirmar que la segunda queda bloqueada durante un intervalo acotado, liberar la primera y verificar respuesta y estado final. Registrar con claridad cualquier caso que ya pasaba antes de la corrección.