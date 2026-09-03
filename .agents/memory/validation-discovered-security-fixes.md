---
name: Defectos ajenos detectados en validación
description: Cómo manejar fallas de seguridad o concurrencia fuera del alcance inicial que aparecen durante la verificación.
---

Un defecto de seguridad o concurrencia ajeno al alcance inicial puede corregirse si el usuario lo autoriza explícitamente, pero debe ir en un commit propio y separado del trabajo principal.

**Why:** “No modificar funcionalidades ajenas” evita ampliar el alcance por iniciativa propia; no obliga a dejar un defecto ya identificado y probado cuando el usuario decide incluirlo.

**How to apply:** antes de ampliar una tanda, reportar rutas equivalentes sin modificarlas. Si el usuario autoriza una corrección, aislarla en su propio commit y conservar pruebas específicas.