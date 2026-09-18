# E1 — ensayo exclusivo en clon desechable

Estado: **PASS**

No se conectó al origen, no se ejecutaron inicializadores/DML/seeds ni se crearon usuarios o sesiones de aplicación.
Los SQL originales permanecen sin cambios; las únicas transformaciones están documentadas en rehearsaldraftpatch.
Las duraciones son mediciones hrtime del cliente (incluyen ida/vuelta), no estimaciones ni garantías de producción.
S08→COMMIT comienza al finalizar la adquisición del bloqueo; no incluye su espera previa. Total incluye cierre del cliente.
Comparación semántica: sólo se omite ordinal_position/attnum de columnas; tamaño físico de base se registra como telemetría.
No se normalizan cuerpos de funciones, índices, restricciones, hashes, estados de triggers o secuencias.
La prueba adicional de cancelación usa pg_sleep(10) antes de COMMIT y watchdog global de 1000 ms; NO mide DDL normal.

Tablas/triggers no internos al baseline: 63/17 (esperados 63/17).

## normal-migration-27

COMMIT confirmado: true. Total: 321.519 ms.
S08 final → COMMIT: 300.927 ms.
Watchdog: {"fired":false}.

| Sentencia | Sintética | Estado | ms |
|---|---|---|---:|
| S01 | false | PASS | 0.289 |
| S02 | false | PASS | 0.384 |
| S03 | false | PASS | 0.160 |
| S04 | false | PASS | 0.130 |
| S05 | false | PASS | 2.669 |
| S06 | false | PASS | 0.190 |
| S07 | false | PASS | 13.482 |
| S08 | false | PASS | 0.355 |
| S09 | false | PASS | 1.332 |
| S10 | false | PASS | 10.571 |
| S11 | false | PASS | 8.336 |
| S12 | false | PASS | 266.674 |
| S13 | false | PASS | 1.723 |
| S14 | false | PASS | 2.832 |
| S15 | false | PASS | 1.141 |
| S16 | false | PASS | 0.324 |
| S17 | false | PASS | 0.390 |
| S18 | false | PASS | 0.507 |
| S19 | false | PASS | 0.238 |
| S20 | false | PASS | 0.281 |
| S21 | false | PASS | 0.135 |
| S22 | false | PASS | 0.304 |
| S23 | false | PASS | 0.123 |
| S24 | false | PASS | 0.200 |
| S25 | false | PASS | 0.119 |
| S26 | false | PASS | 0.115 |
| S27 | false | PASS | 5.481 |

## normal-conditional-reversal-28

COMMIT confirmado: true. Total: 23.049 ms.
S08 final → COMMIT: 16.090 ms.
Watchdog: {"fired":false}.

| Sentencia | Sintética | Estado | ms |
|---|---|---|---:|
| S01 | false | PASS | 0.107 |
| S02 | false | PASS | 0.112 |
| S03 | false | PASS | 0.096 |
| S04 | false | PASS | 0.078 |
| S05 | false | PASS | 0.066 |
| S06 | false | PASS | 0.082 |
| S07 | false | PASS | 4.093 |
| S08 | false | PASS | 0.243 |
| S09 | false | PASS | 1.439 |
| S10 | false | PASS | 2.143 |
| S11 | false | PASS | 0.224 |
| S12 | false | PASS | 0.120 |
| S13 | false | PASS | 0.268 |
| S14 | false | PASS | 0.168 |
| S15 | false | PASS | 0.114 |
| S16 | false | PASS | 0.107 |
| S17 | false | PASS | 0.124 |
| S18 | false | PASS | 0.087 |
| S19 | false | PASS | 0.105 |
| S20 | false | PASS | 0.088 |
| S21 | false | PASS | 0.354 |
| S22 | false | PASS | 0.149 |
| S23 | false | PASS | 1.858 |
| S24 | false | PASS | 1.291 |
| S25 | false | PASS | 1.671 |
| S26 | false | PASS | 0.762 |
| S27 | false | PASS | 0.142 |
| S28 | false | PASS | 4.840 |

## extra-synthetic-cancellation

COMMIT confirmado: false. Total: 1103.604 ms.
S08 final → COMMIT: no hubo COMMIT confirmado.
Watchdog: {"fired":true,"firedAfterBeginMs":1001.052635,"terminateReturned":true,"backendAbsent":true}.

| Sentencia | Sintética | Estado | ms |
|---|---|---|---:|
| S01 | false | PASS | 0.117 |
| S02 | false | PASS | 0.126 |
| S03 | false | PASS | 0.112 |
| S04 | false | PASS | 0.072 |
| S05 | false | PASS | 0.061 |
| S06 | false | PASS | 0.062 |
| S07 | false | PASS | 8.522 |
| S08 | false | PASS | 0.133 |
| S09 | false | PASS | 0.559 |
| S10 | false | PASS | 9.302 |
| S11 | false | PASS | 10.388 |
| S12 | false | PASS | 137.070 |
| S13 | false | PASS | 1.996 |
| S14 | false | PASS | 2.694 |
| S15 | false | PASS | 1.122 |
| S16 | false | PASS | 0.408 |
| S17 | false | PASS | 0.273 |
| S18 | false | PASS | 0.388 |
| S19 | false | PASS | 0.163 |
| S20 | false | PASS | 0.359 |
| S21 | false | PASS | 0.164 |
| S22 | false | PASS | 0.139 |
| S23 | false | PASS | 0.219 |
| S24 | false | PASS | 0.121 |
| S25 | false | PASS | 0.105 |
| S26 | false | PASS | 0.099 |
| SYNTHETIC_BEFORE_COMMIT | true | FAIL | 827.857 |

## Verificaciones

- migrationVerification: {"status":"PASS","categories":{"tables":true,"tableEvidence":true,"constraints":true,"indexes":true,"functions":true,"triggers":true,"sequences":true,"columns":true,"database":true,"sequenceState":true,"internalTriggers":true,"views":true,"types":true,"sequenceValues":true},"beforeSemanticSha256":"06aee606e72b54f287e75b61c048aac04b1131c87484701c6e7f695d906d0987","afterSemanticSha256":"06aee606e72b54f287e75b61c048aac04b1131c87484701c6e7f695d906d0987","tableCount":63,"noninternalTriggerCount":17,"columnComparisonOnlyExclusion":"ordinal_position (physical attnum)","physicalDatabaseSizeTelemetry":{"before":"17019363","after":"17183203"},"actualMigratedTableCount":66,"actualMigratedNoninternalTriggerCount":23,"newTables":[{"schema":"public","table":"atribuciones_credito_e1","relkind":"r","count":"0","orderedCanonicalRowHash":"d41d8cd98f00b204e9800998ecf8427e"},{"schema":"public","table":"cobros_credito_pendientes_e1","relkind":"r","count":"0","orderedCanonicalRowHash":"d41d8cd98f00b204e9800998ecf8427e"},{"schema":"public","table":"operaciones_credito_e1","relkind":"r","count":"0","orderedCanonicalRowHash":"d41d8cd98f00b204e9800998ecf8427e"}],"newColumnsAllNull":true,"ledgerExcludedColumns":["sitio_origen_id","sesion_caja_id","naturaleza","operacion_productor","operacion_clave","nota_origen_id","origen_justificacion"],"projectedLedgerHash":{"count":"3","hash":"ba02f7b3e028d90d22d8094d3b716ae1"},"allowedChanges":{"newTables":["operaciones_credito_e1","cobros_credito_pendientes_e1","atribuciones_credito_e1"],"newFunctions":["impedir_mutacion_credito_e1","validar_contexto_credito_e1","validar_movimiento_credito_e1","validar_cobro_pendiente_e1","validar_atribucion_credito_e1"],"newTriggers":["movimientos_credito.movimientos_validos_e1","cobros_credito_pendientes_e1.cobros_validos_e1","atribuciones_credito_e1.atribuciones_validas_e1","operaciones_credito_e1.operaciones_inmutables_e1","cobros_credito_pendientes_e1.cobros_inmutables_e1","atribuciones_credito_e1.atribuciones_inmutables_e1"],"ledgerForeignKeys":["movimientos_sitio_fk_e1","movimientos_sesion_fk_e1","movimientos_nota_fk_e1","movimientos_operacion_fk_e1"],"ledgerIndex":"movimientos_operacion_uq_e1","internalTriggers":"Only FK triggers belonging to the three new tables or four added ledger FKs","view":"saldos_cobros_credito_e1","enum":"naturaleza_credito_e1"}}
- rollbackVerification: {"status":"PASS","categories":{"tables":true,"tableEvidence":true,"constraints":true,"indexes":true,"functions":true,"triggers":true,"sequences":true,"columns":true,"database":true,"sequenceState":true,"internalTriggers":true,"views":true,"types":true,"sequenceValues":true},"beforeSemanticSha256":"06aee606e72b54f287e75b61c048aac04b1131c87484701c6e7f695d906d0987","afterSemanticSha256":"06aee606e72b54f287e75b61c048aac04b1131c87484701c6e7f695d906d0987","tableCount":63,"noninternalTriggerCount":17,"columnComparisonOnlyExclusion":"ordinal_position (physical attnum)","physicalDatabaseSizeTelemetry":{"before":"17019363","after":"17117667"}}
- cancellationVerification: {"status":"PASS","actualTermination":{"fired":true,"firedAfterBeginMs":1001.052635,"terminateReturned":true,"backendAbsent":true},"syntheticSleepReached":true,"syntheticSleepError":{"message":"terminating connection due to administrator command","code":"57P01"},"commitAttempted":false,"baselineComparison":{"status":"PASS","categories":{"tables":true,"tableEvidence":true,"constraints":true,"indexes":true,"functions":true,"triggers":true,"sequences":true,"columns":true,"database":true,"sequenceState":true,"internalTriggers":true,"views":true,"types":true,"sequenceValues":true},"beforeSemanticSha256":"06aee606e72b54f287e75b61c048aac04b1131c87484701c6e7f695d906d0987","afterSemanticSha256":"06aee606e72b54f287e75b61c048aac04b1131c87484701c6e7f695d906d0987","tableCount":63,"noninternalTriggerCount":17,"columnComparisonOnlyExclusion":"ordinal_position (physical attnum)","physicalDatabaseSizeTelemetry":{"before":"17019363","after":"17248739"}},"normalDdlTiming":false}
- ledgerUnblocked: {"status":"PASS","elapsedMs":0.359968,"count":"3","queryTimeoutMs":2500}
- originalsUnchanged: {"status":"PASS","files":[{"file":"01-propuesta.sql","sha256":"15148edc4555b90a0007dba4536c0a60ecb9904f5885b457ade99b2fe72d931a","expectedSha256":"15148edc4555b90a0007dba4536c0a60ecb9904f5885b457ade99b2fe72d931a"},{"file":"02-reversion-condicionada.sql","sha256":"d2324e980e128f264ea64187df932f48ae8386e1a830c2b958675d1bb3b9b7e7","expectedSha256":"d2324e980e128f264ea64187df932f48ae8386e1a830c2b958675d1bb3b9b7e7"}]}

Evidencia completa y resultados reales: ensayo.json y snapshots privados baseline/migrated/restored/cancelled.
