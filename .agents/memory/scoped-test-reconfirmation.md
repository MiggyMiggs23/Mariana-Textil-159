---
name: Reconfirmación enfocada después de una pasada global
description: Criterio confirmado para reportar una pasada completa seguida de repetición del archivo corregido.
---

El propietario confirmó que ejecutar todos los casos en una pasada global y después repetir el archivo de una prueba corregida acredita esa cobertura, cuando la corrección no invalida los demás resultados.

**Why:** La precisión importa más que sugerir una segunda pasada inexistente. La aprobación distinguió expresamente «todos los casos fueron ejecutados» de «todos volvieron a ejecutarse juntos después de corregir».

**How to apply:** Informar ambas ejecuciones y el alcance de la corrección por separado. No llamarlo una única pasada global final en verde ni sumar casos repetidos como cobertura distinta. Si cambió código compartido o productivo que invalida otros resultados, este criterio no evita repetir las comprobaciones afectadas.