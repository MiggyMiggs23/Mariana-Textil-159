# Cantidad física y ocho reversos estrictos

Fecha de revisión: 2026-09-24. Estado: correcciones existentes y evidencia histórica verificadas; datos sintéticos autorizados posteriormente por el propietario; nueva ejecución y comprobación operativa detenidas por desconexiones del entorno. No se declara una nueva liberación.

## 1. Cantidad no negativa, incluida NaN

La aplicación anterior de `rollos_physical_quantity_nonnegative_check` está documentada en `reports/tanda-h/application/physical-check-result.json`: COMMIT confirmado, CHECK validado que exige cantidad_actual >= 0 y cantidad_actual <> NaN, con 107 tablas conservadas. Commit `111c347`.

El ensayo desechable conservado aprobó 56/56 comprobaciones. La prueba del productor sin CHECK falló antes (28 expectativas fallidas de 44) y pasó después (44/44), incluyendo METRO, KILO, PIEZA y BOLSA. Evidencia: `reports/tanda-h/tarea-1/{result.txt,producer-red.json,producer-green.json,check-copy.json}`.

Corrección `crearEntrada`: commit `c5ad7db`. La fuente actual de inventario conserva SHA-256 `3e1c06120189811d4140766a6f987f4b7ed5abd15d268ff04682ec5313b1e79f`, igual a la fuente probada. El bundle `artifacts/api-server/dist-tanda-h-entry-guard/index.mjs` conserva SHA-256 `7d5e47f61c1c9b9d78430e0f109d6e8fd4ad33f8ad0fc74c36ed100d601db366`, igual al liberado mediante `c637d33`.

No se reaplicó el CHECK. Esta revisión no consultó el catálogo efectivo: no convertir la confirmación histórica en comprobación actual.

## 2. Agrupación comunicada antes de construir

Las ocho vías reproducidas de Tanda G son los casos 1, 2, 4, 5, 6, 7, 8 y 9; no los números consecutivos 1–8. El caso 3 de cancelación parcial metreada sigue detenido por su puerta.

| Caso | Vía | Bloqueo histórico corregido |
|---|---|---|
| 1 | ALTA/RECEPCIÓN después de traslado | El rollo no conserva sitio, cantidad y estado exactos. |
| 2 | VENTA administrativa después de restitución | Falta evidencia íntegra de la operación completa. |
| 4 | TRANSFERENCIA_SALIDA ya recibida | Falta evidencia íntegra de la operación completa. |
| 5 | TRANSFERENCIA_ENTRADA | Falta evidencia íntegra de la operación completa. |
| 6 | AJUSTE_POSITIVO consumido por baja | El rollo no conserva sitio, cantidad y estado exactos. |
| 7 | AJUSTE_NEGATIVO anterior a otra baja | El rollo no conserva sitio, cantidad y estado exactos. |
| 8 | Baja manual inmediata en tránsito | Falta evidencia íntegra de la operación completa. |
| 9 | Reverso genérico de CANCELACION | Falta evidencia íntegra de la operación completa. |

Los dos grupos comparten la guarda central de `revertirMovimiento`, corregida en `61d8216`: evidencia durable anterior/posterior, correspondencia exacta del estado físico y ausencia de sucesores activos. No son ocho parches separados. Bloquear un tramo compuesto sin evidencia no equivale a habilitar su reversión integral.

Mensaje conservado para falta de evidencia: «No se puede revertir: falta evidencia íntegra del estado anterior y posterior del rollo para este movimiento. Un tramo aislado de traslado o un reverso encadenado no acredita la operación completa. Cancela primero las operaciones posteriores en orden inverso o registra un ajuste nuevo con motivo.»

Las otras causas explican que el rollo ya no conserva exactamente sitio, cantidad y estado, o que existen movimientos posteriores aunque coincida la cantidad.

### Evidencia existente

- `reports/tanda-g/baseline/summary.json`: ocho reproducciones defectuosas anteriores.
- `reports/tanda-g/candidate/acceptance-summary.json`: ocho bloqueos corregidos y control legado; cada rechazo conserva las 107 tablas.
- `reports/tanda-g/candidate/extra-acceptance.json`: controles legítimos de restauración cronológica.
- `reports/tanda-g/INFORME.md`: integración 0/4 antes y 4/4 después, aceptación 2/2 y liberación anterior.
- `verification/recheck-status.json`: hashes y revisión de vigencia. El módulo de evidencia y la parte de reversión estricta no cambiaron; el cambio posterior en inventario corresponde a validar crearEntrada.

El archivo genérico `artifacts/api-server/dist/index.mjs` es antiguo. No se usa para afirmar vigencia: el TOML de desarrollo selecciona `dist-tanda-h-entry-guard`, cuyo hash sí coincide con la liberación registrada. No se verificó publicación externa.

## 3. Detenido y decisión necesaria

**Nueva copia de pruebas:** el procedimiento G/F/H anterior restaura datos de la aplicación y añade nueve actores sintéticos. La regla vigente de pruebas en replit.md prohíbe copiar identidades o ampliar seed/fixtures por iniciativa del agente. El seed canónico no contiene los productos METRO/KILO, proveedor y rollos trazados necesarios para el manifiesto de los ocho casos.

El propietario resolvió este límite el 2026-09-24: **autorizó únicamente datos de negocio sintéticos en una base desechable, usando los actores del seed aprobado**. No autoriza copiar identidades, añadir actores, modificar datos de la aplicación ni abrir compuertas. No hace falta volver a solicitar esta misma autorización.

Al continuar con ese permiso, el entorno volvió a interrumpir tanto el arranque como las herramientas de trabajo. Se detuvo ante fallos reiterados, sin una nueva corrida completa. Por tanto, no hay un nuevo resultado verde ni una nueva prueba roja. La evidencia histórica permanece identificada como histórica.

**Runtime y catálogo actuales:** los intentos de arranque tuvieron una desconexión de herramientas y el estado posterior mostró ambos workflows no iniciados, sin proceso API. No se confirma salud actual, catálogo actual ni una nueva liberación. No se modificaron los TOML, bundles ni código del producto en esta revisión.

Errores observados durante la continuación autorizada:

- `WorkflowsRestart`: `SERVER unexpectedly disconnected`.
- Shell: `Failed to spawn shell: SERVER unexpectedly disconnected`.
- Recuperación del resultado del agente: `DurablePTC snapshot blob not found`; el identificador de trabajo dejó de estar disponible después.

No se atribuye una causa de código a estas interrupciones sin evidencia. Comprobación final: no existe `private.local/reversal-recheck` y no se observaron procesos `postgres`, `initdb` ni `pg_ctl`. El estado comunicado por el entorno conserva los dos workflows como no iniciados.

**Para reanudar:** conservar el permiso anterior, preparar la base desechable vacía con el seed aprobado y solo los datos de negocio autorizados, ejecutar los ocho casos y el control positivo, comprobar el catálogo efectivo y confirmar el bundle servido. No repetir DDL confirmado ni confundir integridad de un archivo con liberación en ejecución.

## 4. Alcance y commits

Correcciones previas relevantes: `61d8216` (reversión estricta), `c5ad7db` (crearEntrada), `111c347` (CHECK aplicado), `c637d33` (API de Tanda H liberada). La documentación inicial de esta revisión quedó conservada en `88aa31af`; no es una corrección de producto.

Esta solicitud no produjo un nuevo commit de producto ni repitió un DDL confirmado. Se conserva la evidencia anterior con su fecha y alcance, sin contabilizarla como nueva corrida.

No se abrieron puertas, no se cambió metraje, matriz de permisos ni semántica financiera; no hubo operaciones de prueba ni autenticación en la base de la aplicación, ni nuevas copias privadas que eliminar.