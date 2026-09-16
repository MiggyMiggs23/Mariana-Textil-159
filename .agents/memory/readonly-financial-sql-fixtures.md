---
name: Pruebas financieras SQL sin escrituras
description: Alternativa para probar la consulta real cuando están prohibidos los usuarios y registros temporales.
---

Cuando no se permiten fixtures persistidos, verificar el SQL real con tablas de prueba expresadas como CTEs VALUES dentro de una transacción READ ONLY. No sustituir la consulta por otra implementación simplificada.

**Why:** Las pruebas de expresiones regulares y de cálculos duplicados pueden aprobar aunque el SQL atribuya cantidades al proveedor equivocado o altere los centavos. Los CTEs permiten ejercitar PostgreSQL sin insertar usuarios ni movimientos.

**How to apply:** Sombrear explícitamente todas las relaciones usadas por la consulta, usar el constructor SQL de producción, incluir cruces de proveedor/sitio/fecha y verificar centavos y exclusiones. Esto no demuestra la corrección de escrituras, triggers ni recorridos completos; comprobarlos por separado dentro de las restricciones autorizadas.

Para subconsultas Drizzle, añadir una prueba que construya realmente cada consulta y llame a `.toSQL()`, además de ejecutar SQL bajo protección de solo lectura.

**Why:** TypeScript y pruebas por regex pueden pasar aunque una proyección SQL sin alias falle al referenciarse desde una subconsulta. Una ejecución contra una base vacía prueba validez de construcción/SQL, pero no agrupación ni enriquecimiento con filas.

**How to apply:** Distinguir explícitamente pruebas de construcción, ejecución vacía y semántica con datos. No presentar una consulta que devolvió cero filas como evidencia de casos positivos.