# E1 — resultado del ensayo real en el clon desechable

**Actualización posterior:** las tres brechas encontradas en este ensayo se corrigieron y comprobaron **sólo en el clon**, con 84/84 controles. La operativa no recibió esas guardas. SQL y medición en [resultado-y-propuesta.md](../e1-guardas-temporales-2026-09-18/resultado-y-propuesta.md). Este documento conserva la evidencia del fallo original.

**Resultado: FAIL — 100 controles aprobados y 3 fallos reales, de 103 ejecutados.**

El ensayo solicitado está terminado. Este resultado **no certifica E1 listo para reanudar**: las tres capturas cerradas en la aplicación no están cerradas frente a INSERT SQL directo con contrato válido. La API sigue pausada.

## Ejecución autorizada

- Autorización: `autorizacion-ensayo-clon.md`.
- Presentación anterior a la ejecución: `revision-previa-ensayo-clon.html`, con seis scripts completos, fixtures, alcance, diferencia de identidad y SQL.
- Manifiesto presentado y ejecutado: `0cbd53fc8c57bfc9fabda6caf911a9d9cb1c627fe997918b950abce0d3250e6a`.
- Destino exclusivo: `restore_disposable_20260917165108-3655`, socket local privado `/tmp/prompt-h-block2-20260917165108-3655-3655`.
- Inicio: 17 de septiembre de 2026, 18:09:57, Ciudad de México (`2026-09-18T00:09:57.027Z`).
- Fin: 18:10:07 (`2026-09-18T00:10:07.280Z`).
- Duración: **10.253 segundos**. Salida del proceso: **1**, por los tres controles incumplidos.
- E1 estaba ausente en el clon. Se aplicó el DDL aprobado cambiando únicamente la comprobación de identidad para ese destino. El archivo operativo original no cambió.
- No se conectó a la base operativa. No se arrancó API, bootstrap, inicializadores, login ni listener HTTP. Se ejecutaron funciones y handlers reales contra PostgreSQL real.

## Los siete productores

| Productor | Operación probada | Resultado |
|---|---|---|
| VENTA_CREDITO | Autorizar nota sintética de 100.00 | PASS |
| CANCELACION_VENTA_CREDITO | Cancelar esa venta, incluida salida ligada | PASS |
| ABONO_ORDINARIO | Abono de 100.00 | PASS |
| ABONO_DIRIGIDO | 100.00 inmediato y 100.00 por solicitud/aprobación | PASS |
| REVERSO_ABONO | Reversar íntegramente el abono de 100.00 | PASS |
| AJUSTE_MANUAL | Ajuste de −10.00 con nota y origen explícitos | PASS |
| BAJA_INCOBRABLE | Baja de deuda sintética de 1000.00, con credenciales de prueba válidas | PASS |

Para estos productores pasaron las pruebas de contrato completo, origen ausente, naturaleza ausente, naturaleza incompatible, código antiguo sin metadata E1, reintento con la misma clave y contenido y conflicto con contenido distinto. Los rechazos se comprobaron junto con la ausencia de efectos confirmados adicionales.

También pasaron el replay de autorización tras cerrar la sesión sintética, el rollback por límite de crédito después de intentar escribir el ledger y la reversión de todos los efectos de una cancelación seguida por un aborto deliberado de transacción.

| Grupo | Ejecutados | PASS | FAIL |
|---|---:|---:|---:|
| POS y cancelación ligada | 20 | 20 | 0 |
| Clientes y pagos dirigidos | 59 | 59 | 0 |
| Evidencia, contrato SQL y puertas de captura | 24 | 21 | 3 |
| **Total** | **103** | **100** | **3** |

## Tres fallos demostrados

| Control | Resultado real con triggers intactos |
|---|---|
| `REQUIRE_SQL_GATE_physical_cash_complete_insert` | INSERT de efectivo físico con operación, origen, naturaleza y sesión válidos: **admitido** |
| `REQUIRE_SQL_GATE_pending_receipt_complete_insert` | INSERT de cobro retenido con contrato completo: **admitido** |
| `REQUIRE_SQL_GATE_historical_attribution_complete_insert` | INSERT separado de atribución con actor, sitio, fecha e identidad válidos: **admitido** |

Cada INSERT afectó una fila. **Los tres se revirtieron** dentro de sus transacciones de diagnóstico. No se deshabilitaron triggers, no se cambió `session_replication_role`, no se alteró el esquema para conseguir admisión y no se activaron flags.

Las puertas de la aplicación sí rechazaron los intentos correspondientes. La diferencia es importante: el DDL comprueba la integridad de los datos, pero no impone el cierre temporal de estas tres capturas. Por eso el resultado global es FAIL, aunque los productores probados funcionen.

Las sondas SQL usan el rol PostgreSQL del clon. Demuestran la ausencia de rechazo en las guardas instaladas; no demuestran que un usuario final pueda obtener acceso SQL ni que estas capturas se hayan habilitado en la interfaz.

La prueba SQL del productor antiguo y los INSERT incompletos o incompatibles sí fueron rechazados. No se confunde un fallo de FK, sintaxis o fixture con el rechazo de una captura bien formada.

## Escrituras efectivas en la copia

Las ocho intenciones efectivas anteriores —dos dirigidas— más cinco cargos semilla SQL produjeron **13 movimientos nuevos** en el clon. Los cargos semilla no se cuentan como prueba de productores.

| Tabla | Filas nuevas conservadas |
|---|---:|
| aplicaciones_credito | 3 |
| auditoria | 9 |
| autorizaciones_nota | 1 |
| clientes | 6 |
| movimientos_credito | 13 |
| notificaciones_credito | 1 |
| notificaciones_sistema | 2 |
| operaciones_credito_e1 | 13 |
| permisos_usuario | 1 |
| salidas | 1 |
| sesiones_caja | 2 |
| solicitudes_pago_dirigido | 2 |
| tickets | 7 |
| ubicaciones | 2 |
| usuarios | 3 |

También cambiaron campos de filas **sintéticas** durante los flujos: estado de notas/salida, cierre de una sesión, resolución de solicitudes, lectura de notificación y baja del cliente de prueba. Las secuencias locales pueden avanzar aun cuando una transacción se revierta. El script y la presentación conservan los INSERT exactos, IDs, UUIDs y valores usados; no hubo ampliación dinámica de fixtures.

## Conservación y límites

- **Todas las filas originales del clon permanecieron presentes e idénticas**, verificadas mediante sus huellas completas después de instalar E1 y al terminar los casos.
- Los tres movimientos históricos conservaron sus siete campos E1 nulos.
- Cobros retenidos y atribuciones: **cero filas al terminar**.
- Las sondas de evidencia dejaron idénticos los conteos, hash del ledger y definiciones de guardas que tenían antes de ejecutarse.
- El archivo de respaldo y Drive no se modificaron. Se conserva el clon con sus fixtures y resultados para inspección.
- El ensayo fue secuencial: no prueba carreras concurrentes.
- Las notas POS eran deliberadamente sin líneas: no prueba consumo/reverso de rollos, existencias ni trazabilidad de proveedores.
- No se ejecutó una nueva pasada frontend: los 361 casos sí se habían ejecutado todos en la pasada anterior, seguida por la repetición enfocada del archivo corregido; no hubo segunda pasada global.

## Qué falta y qué autorización implicaría

**El ensayo no necesitó ninguna escritura operativa.** El clon reprodujo los tres fallos.

Para garantizar el cierre también frente a SQL directo, haría falta añadir rechazos explícitos a la validación de efectivo físico, al INSERT de cobros retenidos y al INSERT de atribuciones históricas. Se puede preparar y comprobar esa corrección enteramente en el clon.

Aplicarla después a la base operativa sería **otra migración con autorización distinta**, no una extensión implícita de este ensayo. No se aplicó esa corrección ni se solicita aquí una autorización operativa sin presentar antes su SQL exacto.

## Evidencia

- `verificacion-aislada-resultados.json`: los 103 resultados, errores, fuentes, identidad y conservación.
- `ensayo-clon-ejecucion.log`: salida del proceso; termina en FAIL deliberadamente, sin ocultar las tres brechas.
- `ensayo-clon-revision.json`: manifiesto previo y comando exacto.
- `revision-previa-ensayo-clon.html`: alcance y scripts presentados antes de escribir.