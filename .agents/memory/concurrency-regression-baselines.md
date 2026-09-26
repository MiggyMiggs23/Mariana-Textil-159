---
name: Regresiones concurrentes deterministas
description: Requisitos de evidencia para pruebas que demuestran defectos de concurrencia.
---

Una regresión concurrente debe coordinar las operaciones con una barrera explícita y tiempo límite, y ejecutarse contra el código anterior antes de implementar la corrección.

**Why:** dos operaciones lanzadas con `Promise.all` pueden ordenarse favorablemente y pasar por casualidad aunque el defecto siga presente. Además, una prueba que nunca falla contra la versión defectuosa no demuestra la regresión.

**How to apply:** mantener la primera operación en el punto crítico, confirmar que la segunda queda bloqueada durante un intervalo acotado, liberar la primera y verificar respuesta y estado final. Registrar con claridad cualquier caso que ya pasaba antes de la corrección.

## SQLSTATE explícito de trigger no prueba aislamiento SERIALIZABLE

Un login READ COMMITTED puede recibir `40001` porque un trigger hace `RAISE ... ERRCODE='40001'`. No atribuirlo automáticamente al serializador de PostgreSQL, a un deadlock ni a saturación del pool.

**Why:** `e5_serialize`, instalado en escrituras de `usuarios`, usa `pg_try_advisory_xact_lock(650005,5)` y rechaza explícitamente la colisión del lock global. Actualizar sólo `ultimo_acceso` también activa ese trigger. Un `INSERT sesiones` previo y sus locks FK no explican por sí solos el fallo.

**How to apply:** cotejar causa anidada, rutina, mensaje/hash, aislamiento efectivo y definición instalada del trigger. Reproducir con barrera que sostenga la clave advisory real y ejecutar el callback transaccional original. Para el orden autorizado de login, adquirir ese mismo lock **como primera sentencia de la transacción, antes de cualquier INSERT/FK/lock de fila**; así puede esperar sin poseer los locks que otro validador necesita. Conservar el trigger NOWAIT para productores que ya podrían tener locks y nunca trasladar una espera global detrás de ellos.

La coordinación estrecha del login no autoriza retries de escritura genéricos ni cambios de orden en otros productores. Mantener sesión/último acceso/auditoría atómicos; verificar rollback sin efectos parciales y, bajo concurrencia del mismo actor y de actores distintos, una sesión y una auditoría por éxito. No confundir una reproducción nueva de causa exacta con recuperación de un error histórico cuyo detalle se perdió.