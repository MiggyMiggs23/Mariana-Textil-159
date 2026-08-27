---
name: Contrato matricial de mapas de calor
description: Regla para que ejes, celdas e intensidad representen una matriz real y no filas largas.
---

Un mapa de calor debe recibir datos ya pivotados: cada fila tiene una etiqueta de dimensión, cada serie representa una columna y cada celda contiene únicamente un número finito o ausencia. Los datos largos nunca se entregan directamente al renderer.

**Why:** Aplicar una escala proporcional sobre filas largas hizo que campos de texto se interpretaran como celdas, produjera valores `NaN` y ocultara las etiquetas reales detrás de nombres genéricos.

**How to apply:** Al agregar o cambiar un mapa, probar explícitamente etiquetas de ambos ejes, agregación de duplicados, dos valores distintos, cero y una combinación ausente. La revisión visual debe confirmar que no aparece ninguna fila genérica.