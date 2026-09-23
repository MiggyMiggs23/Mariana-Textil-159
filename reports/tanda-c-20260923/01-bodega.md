# Tanda C — tarea 1: permisos de BODEGA

## Resultado

Corregida la contradicción entre el seed y la actualización repetible de costos pendientes. El default de BODEGA para `contenedores` queda revocado; así no recibe acceso predeterminado a contenedores con costo pendiente. Se preserva la regla existente que no sobrescribe personalizaciones administrativas marcadas con `updated_por`.

## Archivos y líneas

- `lib/db/src/lib/seed-permissions.mjs:76`: matriz `contenedores`; BODEGA cambió de lectura a denegación.
- `lib/db/src/lib/seed-permissions.test.mjs:80-91`: regresión sin DB que exige la denegación en el seed y su concordancia con la lista permitida de `ensurePendingCostsSchema`.
- `artifacts/api-server/src/lib/permisos.test.ts:493-515`: expectativa histórica P-22 alineada; `contenedores` pasa a la lista revocada del baseline BODEGA.
- `replit.md:284`: regla vigente de BODEGA, Contenedores y preservación de personalizaciones.
- `reports/prompt-u-respuestas-2026-09-18.md:201-203`: decisión del propietario registrada sin contradicciones.
- `reports/tanda-c-20260923/01-bodega.md`: este informe.

## Pruebas

- Prueba unitaria/estática sin DB: `node --test lib/db/src/lib/seed-permissions.test.mjs` — 6 aprobadas, 0 fallidas.
- Revisión estática: la celda BODEGA de `MATRIX.contenedores` es `N` y `contenedores` no está en la lista de defaults permitidos por `ensurePendingCostsSchema`.
- `git diff --check` sobre los archivos modificados — aprobado.

No se ejecutó SQL ni se accedió a API, red o base de datos. No se reinició ningún servicio, no se ejecutaron workflows, bundle, gates ni release y no se creó commit.