# Comparación de Lista A contra el snapshot anterior

## Resultado

Se compararon las 35 tablas de **Lista A** usando únicamente los artefactos guardados:

- **Anterior:** `.local/backups/prompt-h-block2-20260915211230-4200/source-snapshot.json`, capturado `2026-09-16T03:12:30.012Z` (UTC).
- **Posterior:** `reports/prompt-h/block3-preflight-metadata.json`, preflight capturado `2026-09-16T03:21:47.562Z` (UTC); observación de base de datos registrada en el artefacto: `2026-09-16T03:21:47.810Z`.

No se realizó una consulta a la base de datos para esta comparación. `count` es el conteo guardado y `orderedCanonicalRowHash` es el hash canónico ordenado guardado en cada artefacto.

**Resumen:** 35 tablas revisadas; **34 sin cambio** (mismo conteo y mismo hash) y **1 con cambio**. El único cambio es `sesiones`: el conteo permanece en **11**, pero el hash cambió. `sesiones` permanece incluida en Lista A aunque sea una tabla operacional de sesiones; no se re-clasifica ni se omite por esa razón.

## Detalle de las 35 tablas de Lista A

| Tabla | Conteo anterior | Conteo posterior | ¿Conteo coincide? | Hash anterior | Hash posterior | ¿Hash coincide? | Resultado |
|---|---:|---:|:---:|---|---|:---:|---|
| aplicaciones_credito | 2 | 2 | Sí | cf6e377d1dba97cf15ac29911592d315 | cf6e377d1dba97cf15ac29911592d315 | Sí | Sin cambio |
| aplicaciones_pago_proveedor | 4 | 4 | Sí | d4108672c2110be2819a94eaec08b4bc | d4108672c2110be2819a94eaec08b4bc | Sí | Sin cambio |
| auditoria_inventario_escaneos | 0 | 0 | Sí | d41d8cd98f00b204e9800998ecf8427e | d41d8cd98f00b204e9800998ecf8427e | Sí | Sin cambio |
| auditoria_inventario_participantes | 0 | 0 | Sí | d41d8cd98f00b204e9800998ecf8427e | d41d8cd98f00b204e9800998ecf8427e | Sí | Sin cambio |
| auditoria_inventario_snapshot | 0 | 0 | Sí | d41d8cd98f00b204e9800998ecf8427e | d41d8cd98f00b204e9800998ecf8427e | Sí | Sin cambio |
| auditorias_inventario | 0 | 0 | Sí | d41d8cd98f00b204e9800998ecf8427e | d41d8cd98f00b204e9800998ecf8427e | Sí | Sin cambio |
| autorizaciones_nota | 2 | 2 | Sí | 800618fe55265528b6224c8abcbcb9b2 | 800618fe55265528b6224c8abcbcb9b2 | Sí | Sin cambio |
| contenedor_lineas | 0 | 0 | Sí | d41d8cd98f00b204e9800998ecf8427e | d41d8cd98f00b204e9800998ecf8427e | Sí | Sin cambio |
| contenedores | 0 | 0 | Sí | d41d8cd98f00b204e9800998ecf8427e | d41d8cd98f00b204e9800998ecf8427e | Sí | Sin cambio |
| cuadre_fiscal_registros | 0 | 0 | Sí | d41d8cd98f00b204e9800998ecf8427e | d41d8cd98f00b204e9800998ecf8427e | Sí | Sin cambio |
| entradas | 6 | 6 | Sí | 3c7d501269c2f85e2e41b1ac57c23a83 | 3c7d501269c2f85e2e41b1ac57c23a83 | Sí | Sin cambio |
| movimientos | 307 | 307 | Sí | d2e7b0955020a35d045fa236f21fa700 | d2e7b0955020a35d045fa236f21fa700 | Sí | Sin cambio |
| movimientos_credito | 8 | 8 | Sí | 6ad6ae447d5dbae2c27b119c5172bc9b | 6ad6ae447d5dbae2c27b119c5172bc9b | Sí | Sin cambio |
| notificaciones_credito | 2 | 2 | Sí | e5e5ca188a6878f6fd0a73f1e18705c0 | e5e5ca188a6878f6fd0a73f1e18705c0 | Sí | Sin cambio |
| notificaciones_sistema | 16 | 16 | Sí | 65fc68b7c8e187e43e7213acfaa4b0ab | 65fc68b7c8e187e43e7213acfaa4b0ab | Sí | Sin cambio |
| pagos_proveedor | 9 | 9 | Sí | c1539ae30170fba704a98eb3a043e1da | c1539ae30170fba704a98eb3a043e1da | Sí | Sin cambio |
| reimpresiones_etiqueta | 146 | 146 | Sí | 8c9c8547595493d1876db686568ee515 | 8c9c8547595493d1876db686568ee515 | Sí | Sin cambio |
| revisiones_etiqueta | 31 | 31 | Sí | 3966f263e75fa9cc4a64290d01bfae4c | 3966f263e75fa9cc4a64290d01bfae4c | Sí | Sin cambio |
| rollos | 226 | 226 | Sí | 42ffdc1dcdaabc1fff06aeec39c963d2 | 42ffdc1dcdaabc1fff06aeec39c963d2 | Sí | Sin cambio |
| salida_lineas | 2 | 2 | Sí | 27441b5caa25b1e2896264e957f5fc43 | 27441b5caa25b1e2896264e957f5fc43 | Sí | Sin cambio |
| salida_rollos | 12 | 12 | Sí | da5e655bbbbd3c908aaa3f24532708b0 | da5e655bbbbd3c908aaa3f24532708b0 | Sí | Sin cambio |
| salidas | 2 | 2 | Sí | 0382fb71b8f0972655db2c1cde8fce90 | 0382fb71b8f0972655db2c1cde8fce90 | Sí | Sin cambio |
| salidas_dinero_caja | 0 | 0 | Sí | d41d8cd98f00b204e9800998ecf8427e | d41d8cd98f00b204e9800998ecf8427e | Sí | Sin cambio |
| sesiones | 11 | 11 | Sí | e21ee24fccd9ede3a9db5435697a7ce4 | 4260600c9b1659b48949381ab1a22736 | No | **CAMBIÓ (hash; conteo igual)** |
| sesiones_caja | 2 | 2 | Sí | b0531b284fc6041a8d7485cbb2f6d82a | b0531b284fc6041a8d7485cbb2f6d82a | Sí | Sin cambio |
| sesiones_caja_dias | 2 | 2 | Sí | c4db98b31f86add440c557a6bb70b145 | c4db98b31f86add440c557a6bb70b145 | Sí | Sin cambio |
| solicitudes_pago_dirigido | 0 | 0 | Sí | d41d8cd98f00b204e9800998ecf8427e | d41d8cd98f00b204e9800998ecf8427e | Sí | Sin cambio |
| stock_minimo_episodios | 4 | 4 | Sí | 109a81a6562cf93d2fadbed345fab00f | 109a81a6562cf93d2fadbed345fab00f | Sí | Sin cambio |
| ticket_linea_consumos | 20 | 20 | Sí | a7b8b38b35de9287522e8903f9508704 | a7b8b38b35de9287522e8903f9508704 | Sí | Sin cambio |
| ticket_lineas | 57 | 57 | Sí | 0c405da8e5ebb97f0464e6105ec3be58 | 0c405da8e5ebb97f0464e6105ec3be58 | Sí | Sin cambio |
| ticket_pagos | 4 | 4 | Sí | 7ca49f8f4ff26f21ca132eeb1943f6d8 | 7ca49f8f4ff26f21ca132eeb1943f6d8 | Sí | Sin cambio |
| tickets | 6 | 6 | Sí | 368939723e40eb004127b723cac19c63 | 368939723e40eb004127b723cac19c63 | Sí | Sin cambio |
| viaje_salidas | 0 | 0 | Sí | d41d8cd98f00b204e9800998ecf8427e | d41d8cd98f00b204e9800998ecf8427e | Sí | Sin cambio |
| viaje_tickets | 0 | 0 | Sí | d41d8cd98f00b204e9800998ecf8427e | d41d8cd98f00b204e9800998ecf8427e | Sí | Sin cambio |
| viajes | 0 | 0 | Sí | d41d8cd98f00b204e9800998ecf8427e | d41d8cd98f00b204e9800998ecf8427e | Sí | Sin cambio |

## Cambio detectado

- `sesiones`: **conteo 11 → 11 (coincide)**; **hash `e21ee24fccd9ede3a9db5435697a7ce4` → `4260600c9b1659b48949381ab1a22736` (no coincide)**.

No se afirma que todas las tablas fuera de Lista A estén sin cambios; este documento responde únicamente por las 35 tablas de Lista A.