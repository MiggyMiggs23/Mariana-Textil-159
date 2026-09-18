# Esquema: lectura preparatoria anterior a la detención

Mientras se reconstruía el candidato en aislamiento, se comparó por lectura el catálogo actual con la referencia E10 del commit `7cb77f8cfc6287fa51325a25122c48af392a7ada`.

- Transacción: `BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY`.
- Cierre: `ROLLBACK`.
- Catálogo actual: 1,519 filas.
- Referencia: 1,519 filas.
- SHA-256 canónico de ambos: `37f6af5a2e06748a8499b995caeec072770090c36f2ad741d35c65953421bec8`.
- Diferencias: cero.

No hubo DDL/DML, inicializadores ni backfills. Esta comparación no ejecutó el wrapper de arranque ni importó la API. La preparación se detuvo al conocerse que el bundle reconstruido no coincidía con el hash exigido.

La afirmación de `resultado.md` de que la compilación no se conectó a la base se refiere al proceso aislado de compilación; esta lectura preparatoria separada sí se realizó antes de la detención y queda declarada aquí.