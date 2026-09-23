# Integración offline solicitada por MAIN

Resultado: **API y UI exit 0**, sin arrancar aplicaciones/workflows ni conectar a la base real. No se modificaron bundles anteriores ni se realizó commit.

Los cuatro gates E3 en fuente se sincronizaron con el despliegue ordinary ya ON: API `E3_ENABLED`, `E3_ORDINARY_CASH_ENABLED`, `E3_MATRIX_RELEASED` y UI `E3_ENABLED`. `E3_DIRECTED_ENABLED` permanece false.

Antes del build se verificó por aserciones el inventario: E3 ordinary, remate API/UI/matriz, precio mínimo, borrado individual y E11 lectores/UI/conciliación ON; asignación de perfiles E11 y preparación E5 OFF; E3 dirigido, E4, E5, E7, E9, E12 y gates E1 excluidos OFF. Evidencia `tarea1-build-gates.log`. E11 conserva las modificaciones aprobadas de tarea 2, no se cambió aquí.

Comandos ejecutados desde `/home/runner/workspace`:

```sh
API_BUILD_OUTPUT_DIR="$PWD/artifacts/api-server/dist-tanda-d-20260923" NODE_ENV=production node artifacts/api-server/build.mjs
(cd artifacts/mariana-textil && BASE_PATH=/ NODE_ENV=production PORT=20329 pnpm exec vite build --outDir dist-tanda-d-20260923)
```

Salidas absolutas:

- `/home/runner/workspace/artifacts/api-server/dist-tanda-d-20260923/index.mjs` y archivos auxiliares/assets.
- `/home/runner/workspace/artifacts/mariana-textil/dist-tanda-d-20260923/index.html` y assets.

Logs `tarea1-build-api.log`, `tarea1-build-ui.log`; hashes de entradas `tarea1-build-sha256.txt`. Vite advirtió chunks mayores a 500 kB, sin fallo.

Se reconciliaron en replit.md exclusivamente las declaraciones vigentes de remate, mínimo y excepción individual: fuente ON; retiro ADMIN con motivo, auditoría original y señal histórica conservadas; ninguna purga general autorizada. Los antecedentes históricos fechados se conservan como tales. Build offline no acredita proceso servido.

Cleanup de PostgreSQL propio: se confirmó `pg_ctl status` exit 3, ausencia de proceso PostgreSQL asociado mediante `/proc`, y después se eliminó `/tmp/tarea1-pg.KKZoty`. Comprobación final `exists=false`; evidencia `tarea1-build-cleanup.log`. No se paró ni eliminó instancia ajena.

Esta integración posterior sustituye las notas de tarea1.md que reservaban a MAIN el build y la edición de replit.md. No cambia los límites de cobertura de pruebas allí declarados.