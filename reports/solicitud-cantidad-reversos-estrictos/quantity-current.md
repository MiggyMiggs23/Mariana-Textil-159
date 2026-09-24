# Punto 1: cantidad física, sin reaplicación

**Estado: prueba histórica confirmada; catálogo y conteos actuales no verificados.** A las 2026-09-24 20:41:14 UTC no había un proceso API efectivo disponible; por ello no se infirió la conexión de la aplicación ni se consultó otra base como sustituto. MAIN controla el arranque.

- El productor `crearEntrada` conserva exactamente el SHA-256 de `c5ad7db`: `3e1c06120189811d4140766a6f987f4b7ed5abd15d268ff04682ec5313b1e79f`. La validación rechaza formato decimal inválido, no finitos y negativos físicos; admite cero con signo.
- La configuración de desarrollo apunta al bundle de `c637d33`, SHA-256 `7d5e47f61c1c9b9d78430e0f109d6e8fd4ad33f8ad0fc74c36ed100d601db366`, puerto local 8080 y `API_INSPECTION_BOOT=1`. Esto **no** demuestra que esté corriendo ahora: PID, comando y puerto efectivos quedaron sin verificar.
- Evidencia histórica: RED 16/44 (28 fallos), GREEN 44/44 y CHECK en copia 56/56, calculados de los JSON existentes de `reports/tanda-h/tarea-1/`; no se repitieron ensayos.
- El reporte de aplicación de `111c347` acredita COMMIT y CHECK validado `rollos_physical_quantity_nonnegative_check` con definición exacta `CHECK (((cantidad_actual >= (0)::numeric) AND (cantidad_actual <> 'NaN'::numeric)))`. Los conteos **históricos** previos son 740 rollos y 45 existencias, sin negativos, nulos, NaN ni infinitos en las tres cantidades inspeccionadas. Ni el CHECK actual ni los conteos actuales pueden afirmarse sin la conexión efectiva.

No se ejecutó SQL, login, prueba operativa, DML, DDL, re-aplicación ni modificación de código. Evidencia estructurada y hashes: `quantity-current.json`.