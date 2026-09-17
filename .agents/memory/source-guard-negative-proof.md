---
name: Pruebas negativas de guardias de fuente
description: Demostrar el fallo real del verificador y cubrir las extensiones mantenidas del repositorio.
---

Una guardia de recurrencia debe comprobarse con el proceso real de pruebas: introducir una infracción en un árbol aislado, observar que falla, retirarla y observar que aprueba. Comparar que una función auxiliar devuelve 1 dentro de una prueba verde no acredita que el verificador rechace la infracción.

**Why:** Una comprobación inicialmente presentada como rojo/verde solo había aprobado una aserción sobre un valor calculado. Además, el barrido omitía extensiones de módulos TypeScript ya presentes en las fuentes mantenidas.

**How to apply:** Inventariar las extensiones reales antes de definir el barrido, probar una infracción en ellas y conectar la guardia a un comando habitual de verificación. Hacer la inyección fuera de módulos vigilados; conservar salida y estado terminal del proceso, no solo el resultado de una función.