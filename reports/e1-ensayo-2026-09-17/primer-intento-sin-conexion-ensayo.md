# E1 — ensayo exclusivo en clon desechable

Estado: **FAIL**

No se conectó al origen, no se ejecutaron inicializadores/DML/seeds ni se crearon usuarios o sesiones de aplicación.
Los SQL originales permanecen sin cambios; las únicas transformaciones están documentadas en rehearsaldraftpatch.
Las duraciones son mediciones hrtime del cliente (incluyen ida/vuelta), no estimaciones ni garantías de producción.
S08→COMMIT comienza al finalizar la adquisición del bloqueo; no incluye su espera previa. Total incluye cierre del cliente.
Comparación semántica: sólo se omite ordinal_position/attnum de columnas; tamaño físico de base se registra como telemetría.
No se normalizan cuerpos de funciones, índices, restricciones, hashes, estados de triggers o secuencias.
La prueba adicional de cancelación usa pg_sleep(10) antes de COMMIT y watchdog global de 1000 ms; NO mide DDL normal.

Tablas/triggers no internos al baseline: no medido/no medido (esperados 63/17).

## Verificaciones

- migrationVerification: "NOT_RUN"
- rollbackVerification: "NOT_RUN"
- cancellationVerification: "NOT_RUN"
- ledgerUnblocked: "NOT_RUN"
- originalsUnchanged: {"status":"PASS","files":[{"file":"01-propuesta.sql","sha256":"15148edc4555b90a0007dba4536c0a60ecb9904f5885b457ade99b2fe72d931a","expectedSha256":"15148edc4555b90a0007dba4536c0a60ecb9904f5885b457ade99b2fe72d931a"},{"file":"02-reversion-condicionada.sql","sha256":"d2324e980e128f264ea64187df932f48ae8386e1a830c2b958675d1bb3b9b7e7","expectedSha256":"d2324e980e128f264ea64187df932f48ae8386e1a830c2b958675d1bb3b9b7e7"}]}

Error saneado: {"message":"connect ECONNREFUSED /tmp/prompt-h-block2-20260917165108-3655-3655/.s.PGSQL.5432","code":"ECONNREFUSED"}

Evidencia completa y resultados reales: ensayo.json y snapshots privados baseline/migrated/restored/cancelled.
