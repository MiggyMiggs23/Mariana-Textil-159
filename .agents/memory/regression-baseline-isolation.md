---
name: Aislamiento de versiones para regresiones
description: Cómo comprobar que una prueba falla contra código anterior sin alterar la app en ejecución.
---

Las comprobaciones contra una versión anterior deben ejecutarse desde una copia temporal o mediante una sustitución del módulo exclusiva del proceso de prueba. No sustituir archivos de la aplicación vigilados por workflows, ni siquiera para restaurarlos después.

**Why:** Los workflows recargan los cambios automáticamente; sustituir temporalmente una consulta puede exponer el comportamiento anterior a usuarios activos durante la prueba, aunque la base de pruebas esté aislada.

**How to apply:** Mantener separados tanto los datos como el código de la línea base. Comparar los resultados rojo/verde sin alterar los módulos que sirve la aplicación.