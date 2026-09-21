---
name: Identidad y portabilidad del build
description: Separar reproducción de bytes y seguridad al trasladar un candidato compilado.
---

Ante un hash diferente con fuentes idénticas, comparar los bytes antes de atribuirlo a cambios de código. Reproducir la ruta absoluta original de compilación en un entorno aislado puede ser necesario; nunca normalizar el bundle ni sustituir el hash esperado para declarar éxito.

**Why:** Una preparación aislada produjo hashes distintos únicamente por la ruta temporal incrustada por el empaquetador de Pino. Recompilar en la ruta original reprodujo exactamente los bytes, pero no eliminó la dependencia de los workers de esa ruta temporal.

**How to apply:** Verificar por separado identidad de fuentes, identidad de bytes y resolución de workers al trasladar el artefacto. Un hash reproducido no autoriza declarar instalable un bundle dependiente de una exportación temporal; corregir el empaquetado requiere respetar el alcance de autorización.