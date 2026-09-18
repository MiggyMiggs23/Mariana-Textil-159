---
name: Integridad del artefacto después de reinicios
description: Una comprobación anterior no garantiza qué archivo ejecutará un workflow después de reiniciarse el entorno.
---

Revalidar el artefacto justo antes de ejecutarlo y poner las precondiciones de autorización en el propio comando de arranque, no únicamente en el procedimiento del agente.

**Why:** Se observó una reconstrucción y actualizaciones de inicialización coincidentes con un reinicio del entorno, aunque el agente no había ordenado build ni restart. El hash comprobado antes del reinicio dejó de describir el archivo disponible después. Los logs no sobrevivieron completos, por lo que las afirmaciones sobre efectos deben limitarse a evidencia persistente.

**How to apply:** Si se autoriza un bundle concreto, el comando debe abortar antes de importarlo cuando no coincida. No confundir ausencia actual de transacciones abiertas con ausencia de commits anteriores, ni ausencia de operaciones financieras nuevas con ausencia de cambios de configuración.