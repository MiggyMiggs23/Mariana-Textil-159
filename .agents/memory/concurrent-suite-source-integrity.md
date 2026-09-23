---
name: Integridad global de suites concurrentes
description: Los verificadores que fotografían todo el árbol pueden invalidarse por trabajo paralelo ajeno a los componentes probados.
---

Antes de lanzar una suite con comparación global del árbol, terminar los cambios paralelos o aislar físicamente el árbol de prueba.

**Why:** Una suite DOM completó sus casos verdes, mutantes y restaurados, pero declaró FAIL_SOURCE_CHANGED porque otro trabajador agregó infraestructura de prueba. No era un fallo funcional de los componentes, pero tampoco correspondía presentar la corrida completa como PASS.

**How to apply:** Coordinar el congelamiento de entradas al iniciar estas suites. Si ocurre, distinguir resultados de casos de la integridad global, identificar exactamente el cambio y usar reconfirmación enfocada cuando permita concluir, sin repetir ciclos completos por cada edición.