---
name: Integridad del artefacto después de reinicios
description: Una comprobación anterior no garantiza qué archivo ejecutará un workflow después de reiniciarse el entorno.
---

Revalidar el artefacto justo antes de ejecutarlo y poner las precondiciones de autorización en el propio comando de arranque, no únicamente en el procedimiento del agente.

**Why:** Se observó una reconstrucción y actualizaciones de inicialización coincidentes con un reinicio del entorno, aunque el agente no había ordenado build ni restart. El hash comprobado antes del reinicio dejó de describir el archivo disponible después. Los logs no sobrevivieron completos, por lo que las afirmaciones sobre efectos deben limitarse a evidencia persistente.

**How to apply:** Si se autoriza un bundle concreto, el comando debe abortar antes de importarlo cuando no coincida. No confundir ausencia actual de transacciones abiertas con ausencia de commits anteriores, ni ausencia de operaciones financieras nuevas con ausencia de cambios de configuración.

## Procedencia de una reconstrucción

Un commit limpio con pruebas aprobadas y un hash de bundle conocido son evidencias diferentes; no demuestran por sí solos que ese commit generó ese bundle.

**Why:** Una reconstrucción aislada de una revisión verificada terminó correctamente pero no reprodujo los bytes exigidos. La falta de registro de procedencia impidió atribuir la diferencia o recuperar automáticamente el artefacto autorizado.

**How to apply:** Vincular futuras entregas al commit/árbol y posibles cambios locales, entradas de compilación, lockfile, herramientas, comando y hashes de todas las salidas. Antes de reconstruir, distinguir una fuente candidata de una procedencia probada. Una salida distinta exige detenerse si esa fue la condición de autorización, no cambiar el hash esperado ni normalizar el resultado silenciosamente.