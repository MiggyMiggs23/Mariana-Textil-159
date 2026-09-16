---
name: Validación de operadores destructivos contra evidencia real
description: Una revisión estática y pruebas puras no demuestran que las compuertas consuman correctamente los respaldos y preflights guardados.
---

Antes de ejecutar un operador destructivo, validar en modo de solo lectura las mismas compuertas previas que usará la ejecución, contra los archivos reales de respaldo, restauración, autorización y preflight. No basta con pruebas de generación de SQL ni revisión estática.

**Why:** Se detectaron errores de transcripción de hashes, diferencias entre formatos de metadatos y una interpretación demasiado restrictiva de los estados de triggers solo al ejecutar las compuertas. Los bloqueos fueron seguros, pero las pruebas puras habían dado una confianza insuficiente.

**How to apply:** Compartir las comprobaciones previas entre simulación y aplicación, validar explícitamente los contratos de los archivos y comparar hashes contra la evidencia aprobada, sin reescribirla para que pase. Preservar exactamente el estado original de cada trigger: `ENABLE ALWAYS` también está habilitado y no debe convertirse en `ENABLE ORIGIN`. Si falla una compuerta, distinguir un defecto del lector de evidencia de una diferencia real en la fuente; nunca saltar la comparación real para continuar.

Comparar cada conjunto contra una línea base de la misma fase operacional. Un respaldo anterior a una purga autorizada sigue siendo referencia del catálogo conservado y de los nombres de tablas/secuencias, pero no de las filas eliminadas ni de los valores que avanzaron después por operación normal.

**Why:** Un control exclusivo de aplicación conservó una comparación contra filas anteriores a la purga, aunque la simulación ya utilizaba el estado actual. Esto produjo un resultado de simulación aprobada que la aplicación habría rechazado; no era una discrepancia real del catálogo.

**How to apply:** Para una modificación posterior, capturar una nueva línea base actual y comparar antes/después contra ella, conservando las referencias históricas solo para los conjuntos que deben permanecer idénticos. Ejecutar también en modo de solo lectura los validadores de la prueba guardada que normalmente se invocan únicamente al aplicar.