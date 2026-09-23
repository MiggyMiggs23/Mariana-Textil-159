---
name: Identidad y preparación en workers de pruebas
description: Diferenciar identidad inmutable de la base y condiciones de seed que los casos pueden modificar legítimamente.
---

Comprobar identidad y aislamiento en los workers no debe volver a exigir que los datos de preparación permanezcan intactos durante una prueba.

**Why:** Los workers de logging pueden heredar los preloads del runner. Forzar allí una importación de DB volvió a verificar el ADMIN inicial mientras una prueba de invariantes lo modificaba legítimamente. La base seguía siendo la desechable correcta; fallaba una condición mutable de preparación, no su aislamiento.

**How to apply:** Verificar esquema/seed antes de ejecutar las suites y conservar la comprobación de identidad en descendientes. No introducir imports DB innecesarios en workers de logging. Mantener la identidad de control separada de los aliases de conexión que selecciona el código legacy.