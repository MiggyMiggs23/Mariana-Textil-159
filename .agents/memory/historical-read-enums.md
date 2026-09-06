---
name: Enums históricos de solo lectura
description: Compatibilidad de respuestas cuando un valor antiguo deja de permitirse en nuevas operaciones.
---

Cuando un valor deja de ser seleccionable para operaciones nuevas pero permanece en datos históricos, los contratos de entrada y salida deben separarse: la entrada lo rechaza y la salida lo conserva.

**Why:** Un esquema de respuesta demasiado restrictivo puede convertir una consulta completa en error por una sola fila histórica válida, aunque la interfaz ya no ofrezca crear ese valor.

**How to apply:** Antes de reducir un enum de formulario o query, auditar datos y lecturas históricas. Mantener el valor en esquemas de respuesta y etiquetas de presentación mientras existan registros que puedan devolverlo.