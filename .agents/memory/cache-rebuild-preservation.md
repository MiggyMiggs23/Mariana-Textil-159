---
name: Preservación de configuración al reconstruir cachés
description: Criterio de prueba real para configuración que debe sobrevivir reconstrucciones de inventario.
---

La separación de tablas y la lectura del código no prueban que una reconstrucción preserve configuración. Ejecutar la función real sobre PostgreSQL desechable y comparar conteos y filas completas antes/después.

**Why:** El dueño señaló este punto como requisito crítico tras un antecedente de referencias perdidas al reconstruir. Una prueba que solo conserva datos, pero no demuestra que la reconstrucción trabajó, puede dar un falso positivo.

**How to apply:** Preparar movimientos válidos, mínimos numéricos y pares sin mínimo; guardar también autor, fechas y configuración por sitio. Introducir existencias deliberadamente desactualizadas, ejecutar y confirmar tanto su corrección como la igualdad exacta de la configuración. Identificar la base aislada antes de mutar y eliminar únicamente los recursos desechables creados. No sustituir esa evidencia por mocks ni por inspección de esquema.