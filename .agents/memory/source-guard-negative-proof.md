---
name: Pruebas negativas de guardias de fuente
description: Demostrar el fallo real del verificador y cubrir las extensiones mantenidas del repositorio.
---

Una guardia de recurrencia debe comprobarse con el proceso real de pruebas: introducir una infracción en un árbol aislado, observar que falla, retirarla y observar que aprueba. Comparar que una función auxiliar devuelve 1 dentro de una prueba verde no acredita que el verificador rechace la infracción.

**Why:** Una comprobación inicialmente presentada como rojo/verde solo había aprobado una aserción sobre un valor calculado. Además, el barrido omitía extensiones de módulos TypeScript ya presentes en las fuentes mantenidas.

**How to apply:** Inventariar las extensiones reales antes de definir el barrido, probar una infracción en ellas y conectar la guardia a un comando habitual de verificación. Hacer la inyección fuera de módulos vigilados; conservar salida y estado terminal del proceso, no solo el resultado de una función.

Un código distinto de cero no basta para acreditar una regresión de comportamiento.

**Why:** Un runner podía declarar `assertionFailure: true` buscando únicamente
la palabra «fail», aunque el montaje o la infraestructura hubieran fallado.

**How to apply:** Exigir el código de fallo de pruebas, la clase de aserción
y el mensaje semántico esperado. Restaurar el original en el mismo árbol
aislado y exigir verde posterior; conservar ambas salidas, no solo un booleano.