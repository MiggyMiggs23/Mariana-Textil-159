# Tanda H — tarea 2, preparación del experimento

## Alcance exacto

Se seleccionaron únicamente los dos candidatos de `reports/tanda-g-ampliada/tarea-4/proposed-indexes.sql` para corte y reporte de crédito:

- `tickets_pendientes_corte_ga_candidate`: ubicación, fecha, ID; predicado de tickets vendidos pendientes o notas pendientes de autorización.
- `tickets_contabilizados_sitio_fecha_ga_candidate`: ubicación y fecha efectiva de contabilización; predicado de tickets cobrados o notas autorizadas.

`approved-indexes.sql` conserva las dos sentencias originales con tabla explícita `public.tickets`. Las declaraciones Drizzle tienen los mismos nombres, claves y predicados. No se ejecutó schema push, DDL, login ni mutación operativa. No se incluyeron los candidatos de caja pendiente, movimientos de crédito ni inventario.

## Ejecución pendiente por MAIN/operador

1. Completar setup y habilitar copia supervisada en puerto **55444**, base `tanda_h_performance`, actor no propietario `h_performance`; entregar `.local/tanda-h/worker-databases.json` con `performance.url`. El manifiesto sintético corresponde a `reports/tanda-h/setup/fixture-manifest-redacted.json`.
2. Ejecutar `node reports/tanda-h/tarea-2/load.mjs`. El script reutiliza el generador anterior, no datos inventados adicionales. **365 × 50 × 3 = 54,750** tickets, no 54,150. Mantiene 25% crédito, 5% pendientes, 35,000 rollos disponibles y concentración en un cliente. Son supuestos hipotéticos, no volumen comercial real ni una simulación de corrección.
3. Ejecutar con tsx `reports/tanda-h/tarea-2/paired.mjs pre`. Captura tres muestras por carga, resultados semánticos y consultas reales con planes ejecutados.
4. El operador debe revisar `preflight.sql` antes de DDL: claves/prefijos, predicados e índices válidos existentes, no sólo nombres. El índice declarado existente `(ubicacion_id, created_at)` comparte un prefijo con corte, pero no el tercer campo ni el predicado parcial; esto no demuestra que el candidato aporte beneficio. La revisión del catálogo efectivo sigue pendiente.
5. Si no hay redundancia efectiva, MAIN aplica solamente `approved-indexes.sql` en COPY. El trabajador no propietario no debe elevar privilegios.
6. Ejecutar `paired.mjs post` sin recargar ni modificar datos. `paired-proof.json` exige igualdad del contenido de todas las tablas públicas y del resultado de ambas operaciones. Conserva orden de arrays y todos los valores comerciales; sólo excluye `generatedAt` del reporte.
7. MAIN decide DDL en vivo únicamente después de prueba COPY y revisión estricta del catálogo/allowlist. No hay resultado ni autorización automática en estos archivos.

## Estado y límites de la evidencia

En esta entrega se validó sintaxis JavaScript y whitespace de cambios. No existen aún mediciones antes/después, prueba de igualdad ni evidencia de beneficio.

Faltan navegación de navegador (tres muestras acotadas), separación de autenticación/selección de sitio, readiness real de crédito (<3 s) y corte (<2 s), captura de estado de cuenta E7 y cobro real de ticket sintético nativo. No se ejecutó login ni escritura desde este trabajador. No se confunde el tiempo del constructor SQL con readiness de navegador. Si el objetivo no se cumple, se deben correlacionar solicitudes, consultas del servidor y CPU/DOM antes de proponer cambios; no se cambió significado de métricas ni implementación de consultas.