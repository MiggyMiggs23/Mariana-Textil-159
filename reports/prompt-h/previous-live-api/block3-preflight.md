# Prompt H — Bloque 3: preflight de lectura (purga no autorizada)

## Veredicto

**COMPLETE_READ_ONLY_PREFLIGHT**

- Captura UTC: `2026-09-16T03:21:47.562Z`
- Captura Ciudad de México: `2026-09-15 21:21:47,562`
- Base efectiva de `DATABASE_URL`: `heliumdb`; host/credenciales omitidos.
- Transacción: `BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY`; timeouts de sentencia/bloqueo/inactividad: `3min` / `5s` / `5min`.
- Freshness contra snapshot verificado de Bloque 2: **SOURCE_CHANGED_SINCE_VERIFIED_BACKUP**.
- Gate de triggers actuales (14/14 enabled; estado distinto de `D`): **PASS** (14/14).

### Puertas previas

| Puerta | Estado | Evidencia |
| --- | --- | --- |
| owner_approval_lists_no_purge | PASS | reports/prompt-h/aprobacion-listas-no-purga.md |
| api_pool_effective_identity | PASS | reports/prompt-h/api-pool-identity-2026-09-15.md |
| block2_backup_restore_verified | PASS | reports/prompt-h/block2-restore-metadata.json |
| drive_download_hash | PASS | reports/prompt-h/block2-drive-verification.json |
| verified_backup_snapshot_shape | PASS | .local/backups/prompt-h-block2-20260915211230-4200/source-snapshot.json |

## Alcance y listas vivas

Conjunto descubierto dinámicamente: **60 tablas**; A=35, B=7, C=18.

| Clase | Tabla | Conteo actual | Hash canónico completo |
| --- | --- | --- | --- |
| A | aplicaciones_credito | 2 | cf6e377d1dba97cf15ac29911592d315 |
| A | aplicaciones_pago_proveedor | 4 | d4108672c2110be2819a94eaec08b4bc |
| C | auditoria | 3286 | ebfb27fc49b43dbf3eb4082729d84b0d |
| A | auditoria_inventario_escaneos | 0 | d41d8cd98f00b204e9800998ecf8427e |
| B | auditoria_inventario_folio | 11 | 6e50856eaa1e8d3930a630e7ec415f7d |
| A | auditoria_inventario_participantes | 0 | d41d8cd98f00b204e9800998ecf8427e |
| A | auditoria_inventario_snapshot | 0 | d41d8cd98f00b204e9800998ecf8427e |
| A | auditorias_inventario | 0 | d41d8cd98f00b204e9800998ecf8427e |
| A | autorizaciones_nota | 2 | 800618fe55265528b6224c8abcbcb9b2 |
| C | camionetas | 0 | d41d8cd98f00b204e9800998ecf8427e |
| C | choferes | 0 | d41d8cd98f00b204e9800998ecf8427e |
| C | cliente_documentos | 0 | d41d8cd98f00b204e9800998ecf8427e |
| C | clientes | 7 | 57547451eec364bf428e41924ded0b49 |
| A | contenedor_lineas | 0 | d41d8cd98f00b204e9800998ecf8427e |
| A | contenedores | 0 | d41d8cd98f00b204e9800998ecf8427e |
| A | cuadre_fiscal_registros | 0 | d41d8cd98f00b204e9800998ecf8427e |
| B | entrada_folio | 11 | a44d42b66287e3bf389533df0e1b6787 |
| A | entradas | 6 | 3c7d501269c2f85e2e41b1ac57c23a83 |
| C | equipos | 0 | d41d8cd98f00b204e9800998ecf8427e |
| C | equipos_checklist | 0 | d41d8cd98f00b204e9800998ecf8427e |
| B | existencias | 37 | 0e7a5bd69febababa25152bb222d57b8 |
| A | movimientos | 307 | d2e7b0955020a35d045fa236f21fa700 |
| A | movimientos_credito | 8 | 6ad6ae447d5dbae2c27b119c5172bc9b |
| A | notificaciones_credito | 2 | e5e5ca188a6878f6fd0a73f1e18705c0 |
| A | notificaciones_sistema | 16 | 65fc68b7c8e187e43e7213acfaa4b0ab |
| A | pagos_proveedor | 9 | c1539ae30170fba704a98eb3a043e1da |
| C | permisos_rol | 192 | 4d18bc7f2e1076313bc0ed9cddfffe88 |
| C | permisos_ubicacion | 54 | bc5e55897a9b7e834766d59550c35db1 |
| C | permisos_usuario | 0 | d41d8cd98f00b204e9800998ecf8427e |
| C | pisos | 0 | d41d8cd98f00b204e9800998ecf8427e |
| C | precio_historial | 1016 | 64f5ec3242e70cdfe37e1a242c26b506 |
| C | productos | 1234 | 9b5a7bfb4133c1c700f9d242628c0c46 |
| C | proveedores | 27 | 4a0020d06fb591411ff067f4140e5994 |
| A | reimpresiones_etiqueta | 146 | 8c9c8547595493d1876db686568ee515 |
| A | revisiones_etiqueta | 31 | 3966f263e75fa9cc4a64290d01bfae4c |
| A | rollos | 226 | 42ffdc1dcdaabc1fff06aeec39c963d2 |
| B | salida_folio | 11 | 33cf7f2dd99825ee4431af068c14f673 |
| A | salida_lineas | 2 | 27441b5caa25b1e2896264e957f5fc43 |
| A | salida_rollos | 12 | da5e655bbbbd3c908aaa3f24532708b0 |
| A | salidas | 2 | 0382fb71b8f0972655db2c1cde8fce90 |
| A | salidas_dinero_caja | 0 | d41d8cd98f00b204e9800998ecf8427e |
| B | series_consecutivo | 1 | 2b82431c6ad349fe225084845360f85c |
| A | sesiones | 11 | 4260600c9b1659b48949381ab1a22736 |
| A | sesiones_caja | 2 | b0531b284fc6041a8d7485cbb2f6d82a |
| A | sesiones_caja_dias | 2 | c4db98b31f86add440c557a6bb70b145 |
| A | solicitudes_pago_dirigido | 0 | d41d8cd98f00b204e9800998ecf8427e |
| A | stock_minimo_episodios | 4 | 109a81a6562cf93d2fadbed345fab00f |
| C | stock_minimo_sitios | 1 | 17a13e555dc56c6b9871558bd51ba05c |
| C | stock_minimos | 3 | 60b15edc65d0fa3cbaf651c9427fc0ae |
| B | ticket_folio | 1 | 4f3e6be1959372bcbd014607fe6f4f2a |
| A | ticket_linea_consumos | 20 | a7b8b38b35de9287522e8903f9508704 |
| A | ticket_lineas | 57 | 0c405da8e5ebb97f0464e6105ec3be58 |
| A | ticket_pagos | 4 | 7ca49f8f4ff26f21ca132eeb1943f6d8 |
| A | tickets | 6 | 368939723e40eb004127b723cac19c63 |
| C | ubicaciones | 11 | 024961124e5a29d6f6e1c4053687a948 |
| C | usuarios | 31 | 658b6ca14c31aa1a9eaf3fdeede703f1 |
| B | viaje_folio | 11 | 6e50856eaa1e8d3930a630e7ec415f7d |
| A | viaje_salidas | 0 | d41d8cd98f00b204e9800998ecf8427e |
| A | viaje_tickets | 0 | d41d8cd98f00b204e9800998ecf8427e |
| A | viajes | 0 | d41d8cd98f00b204e9800998ecf8427e |

Las tablas A, B y C anteriores son las 60 tablas exactas de la captura viva. No se sustituyeron por listas históricas.

## Conteos A

| Tabla A | Filas actuales |
| --- | --- |
| aplicaciones_credito | 2 |
| aplicaciones_pago_proveedor | 4 |
| auditoria_inventario_escaneos | 0 |
| auditoria_inventario_participantes | 0 |
| auditoria_inventario_snapshot | 0 |
| auditorias_inventario | 0 |
| autorizaciones_nota | 2 |
| contenedor_lineas | 0 |
| contenedores | 0 |
| cuadre_fiscal_registros | 0 |
| entradas | 6 |
| movimientos | 307 |
| movimientos_credito | 8 |
| notificaciones_credito | 2 |
| notificaciones_sistema | 16 |
| pagos_proveedor | 9 |
| reimpresiones_etiqueta | 146 |
| revisiones_etiqueta | 31 |
| rollos | 226 |
| salida_lineas | 2 |
| salida_rollos | 12 |
| salidas | 2 |
| salidas_dinero_caja | 0 |
| sesiones | 11 |
| sesiones_caja | 2 |
| sesiones_caja_dias | 2 |
| solicitudes_pago_dirigido | 0 |
| stock_minimo_episodios | 4 |
| ticket_linea_consumos | 20 |
| ticket_lineas | 57 |
| ticket_pagos | 4 |
| tickets | 6 |
| viaje_salidas | 0 |
| viaje_tickets | 0 |
| viajes | 0 |

## Filas B: antes y objetivo aprobado

| Tabla B | Clave de fila (no PII) | Antes | Objetivo report-only |
| --- | --- | --- | --- |
| auditoria_inventario_folio | 1 | 0 | 0 |
| auditoria_inventario_folio | 2 | 0 | 0 |
| auditoria_inventario_folio | 3 | 0 | 0 |
| auditoria_inventario_folio | 4 | 0 | 0 |
| auditoria_inventario_folio | 5 | 0 | 0 |
| auditoria_inventario_folio | 6 | 0 | 0 |
| auditoria_inventario_folio | 7 | 0 | 0 |
| auditoria_inventario_folio | 8 | 0 | 0 |
| auditoria_inventario_folio | 9 | 0 | 0 |
| auditoria_inventario_folio | 458 | 0 | 0 |
| auditoria_inventario_folio | 531 | 0 | 0 |
| entrada_folio | 1 | 0 | 0 |
| entrada_folio | 2 | 5 | 0 |
| entrada_folio | 3 | 0 | 0 |
| entrada_folio | 4 | 0 | 0 |
| entrada_folio | 5 | 1 | 0 |
| entrada_folio | 6 | 0 | 0 |
| entrada_folio | 7 | 0 | 0 |
| entrada_folio | 8 | 0 | 0 |
| entrada_folio | 9 | 0 | 0 |
| entrada_folio | 458 | 0 | 0 |
| entrada_folio | 531 | 0 | 0 |
| existencias | 104:1 | 0.000/0 | REBUILT |
| existencias | 104:2 | 0.000/0 | REBUILT |
| existencias | 104:5 | 0.000/0 | REBUILT |
| existencias | 104:8 | 0.000/0 | REBUILT |
| existencias | 1071:1 | 0.000/0 | REBUILT |
| existencias | 1071:2 | 0.000/0 | REBUILT |
| existencias | 1071:8 | 0.000/0 | REBUILT |
| existencias | 1100:2 | 0.000/0 | REBUILT |
| existencias | 12:5 | 0.000/0 | REBUILT |
| existencias | 13:5 | 0.000/0 | REBUILT |
| existencias | 1328:5 | 15000.000/150 | REBUILT |
| existencias | 1389:2 | 2500.000/10 | REBUILT |
| existencias | 1395:2 | 2000.000/8 | REBUILT |
| existencias | 14:1 | 0.000/0 | REBUILT |
| existencias | 14:5 | 0.000/0 | REBUILT |
| existencias | 14:8 | 0.000/0 | REBUILT |
| existencias | 1415:1 | 0.000/0 | REBUILT |
| existencias | 1415:2 | 0.000/0 | REBUILT |
| existencias | 1415:8 | 0.000/0 | REBUILT |
| existencias | 1417:1 | 0.000/0 | REBUILT |
| existencias | 1417:2 | 0.000/0 | REBUILT |
| existencias | 1417:8 | 0.000/0 | REBUILT |
| existencias | 1419:2 | 97.000/1 | REBUILT |
| existencias | 1426:2 | 0.000/0 | REBUILT |
| existencias | 1427:1 | 0.000/0 | REBUILT |
| existencias | 1427:2 | 0.000/0 | REBUILT |
| existencias | 1427:8 | 0.000/0 | REBUILT |
| existencias | 15:5 | 0.000/0 | REBUILT |
| existencias | 18:5 | 0.000/0 | REBUILT |
| existencias | 19:1 | 0.000/0 | REBUILT |
| existencias | 19:2 | 0.000/0 | REBUILT |
| existencias | 19:3 | 0.000/0 | REBUILT |
| existencias | 19:5 | 0.000/0 | REBUILT |
| existencias | 19:8 | 0.000/0 | REBUILT |
| existencias | 20:5 | 0.000/0 | REBUILT |
| existencias | 32:1 | 0.000/0 | REBUILT |
| existencias | 4:1 | 0.000/0 | REBUILT |
| salida_folio | 1 | 0 | 0 |
| salida_folio | 2 | 1 | 0 |
| salida_folio | 3 | 0 | 0 |
| salida_folio | 4 | 0 | 0 |
| salida_folio | 5 | 1 | 0 |
| salida_folio | 6 | 0 | 0 |
| salida_folio | 7 | 0 | 0 |
| salida_folio | 8 | 0 | 0 |
| salida_folio | 9 | 0 | 0 |
| salida_folio | 458 | 0 | 0 |
| salida_folio | 531 | 0 | 0 |
| series_consecutivo | 1 | 1000226 | 1000000 |
| ticket_folio | 1 | 1005 | 999 |
| viaje_folio | 1 | 0 | 0 |
| viaje_folio | 2 | 0 | 0 |
| viaje_folio | 3 | 0 | 0 |
| viaje_folio | 4 | 0 | 0 |
| viaje_folio | 5 | 0 | 0 |
| viaje_folio | 6 | 0 | 0 |
| viaje_folio | 7 | 0 | 0 |
| viaje_folio | 8 | 0 | 0 |
| viaje_folio | 9 | 0 | 0 |
| viaje_folio | 458 | 0 | 0 |
| viaje_folio | 531 | 0 | 0 |

- `existencias` no tiene objetivo de contador: cada fila se conserva para la reconstrucción mediante la función real; no se reconstruyó en este bloque.
- Defaults actuales de contador (solo reporte): `entrada_folio=99`, `salida_folio=499`. No se modificaron defaults.

## Preservación C: conteo y hash canónico

| Tabla C | Conteo | Hash exacto `to_jsonb(row)::text` ordenado |
| --- | --- | --- |
| auditoria | 3286 | ebfb27fc49b43dbf3eb4082729d84b0d |
| camionetas | 0 | d41d8cd98f00b204e9800998ecf8427e |
| choferes | 0 | d41d8cd98f00b204e9800998ecf8427e |
| cliente_documentos | 0 | d41d8cd98f00b204e9800998ecf8427e |
| clientes | 7 | 57547451eec364bf428e41924ded0b49 |
| equipos | 0 | d41d8cd98f00b204e9800998ecf8427e |
| equipos_checklist | 0 | d41d8cd98f00b204e9800998ecf8427e |
| permisos_rol | 192 | 4d18bc7f2e1076313bc0ed9cddfffe88 |
| permisos_ubicacion | 54 | bc5e55897a9b7e834766d59550c35db1 |
| permisos_usuario | 0 | d41d8cd98f00b204e9800998ecf8427e |
| pisos | 0 | d41d8cd98f00b204e9800998ecf8427e |
| precio_historial | 1016 | 64f5ec3242e70cdfe37e1a242c26b506 |
| productos | 1234 | 9b5a7bfb4133c1c700f9d242628c0c46 |
| proveedores | 27 | 4a0020d06fb591411ff067f4140e5994 |
| stock_minimo_sitios | 1 | 17a13e555dc56c6b9871558bd51ba05c |
| stock_minimos | 3 | 60b15edc65d0fa3cbaf651c9427fc0ae |
| ubicaciones | 11 | 024961124e5a29d6f6e1c4053687a948 |
| usuarios | 31 | 658b6ca14c31aa1a9eaf3fdeede703f1 |

El hash es el mismo método del respaldo: MD5 de la concatenación ordenada de MD5 de cada `to_jsonb(row)::text`; nunca se guardaron filas C.

## FK estáticas y TRUNCATE conceptual

- Referencias A → B/C: **81**.
- Referencias B/C → A que bloquearían `TRUNCATE ... RESTRICT`: **0**.
- Cierre FK entrante desde A fuera de A: **0**.
- Resultado estático de cierre: **CONDITIONALLY_ALLOWED_BY_STATIC_FK_METADATA_ONLY**.
- Las referencias A → C son relaciones normales de tablas operativas hacia catálogos conservados y no bloquean truncar el lado A; el bloqueo relevante para `TRUNCATE A ... RESTRICT` es una referencia entrante desde B/C.

No se ejecutó el siguiente SQL; es solamente la operación conceptual pendiente:

```sql
BEGIN ISOLATION LEVEL REPEATABLE READ READ WRITE; -- conceptual only, not executed
SET LOCAL statement_timeout = '180s';
TRUNCATE TABLE "public"."aplicaciones_credito", "public"."aplicaciones_pago_proveedor", "public"."auditoria_inventario_escaneos", "public"."auditoria_inventario_participantes", "public"."auditoria_inventario_snapshot", "public"."auditorias_inventario", "public"."autorizaciones_nota", "public"."contenedor_lineas", "public"."contenedores", "public"."cuadre_fiscal_registros", "public"."entradas", "public"."movimientos", "public"."movimientos_credito", "public"."notificaciones_credito", "public"."notificaciones_sistema", "public"."pagos_proveedor", "public"."reimpresiones_etiqueta", "public"."revisiones_etiqueta", "public"."rollos", "public"."salida_lineas", "public"."salida_rollos", "public"."salidas", "public"."salidas_dinero_caja", "public"."sesiones", "public"."sesiones_caja", "public"."sesiones_caja_dias", "public"."solicitudes_pago_dirigido", "public"."stock_minimo_episodios", "public"."ticket_linea_consumos", "public"."ticket_lineas", "public"."ticket_pagos", "public"."tickets", "public"."viaje_salidas", "public"."viaje_tickets", "public"."viajes" CONTINUE IDENTITY RESTRICT;
-- UPDATE B counter rows to the approved targets; no sequence reset.
-- UPDATE public.entrada_folio SET ultimo_folio = 0; -- per site
-- UPDATE public.salida_folio SET ultimo_folio = 0; -- per site
-- UPDATE public.viaje_folio SET ultimo_folio = 0; -- per site
-- UPDATE public.auditoria_inventario_folio SET ultimo_folio = 0; -- per site
-- UPDATE public.ticket_folio SET ultimo_folio = 999;
-- UPDATE public.series_consecutivo SET ultimo_numero = 1000000;
await reconstruirCacheExistencias(tx); -- same transaction; not executed
COMMIT; -- conceptual only
```

- `TRUNCATE`: NO EJECUTADO.
- `RESTART IDENTITY`, `setval`, `ALTER SEQUENCE`, `UPDATE`, `DELETE` e `INSERT`: **no ejecutados**.

## Secuencias

Secuencias dinámicas: **45** (se esperaban 45). Lectura inicial/final dentro del preflight: **sin cambios; las lecturas de secuencia no son MVCC.

| Secuencia | Valor leído | Valor al cerrar lectura | Cambio durante preflight |
| --- | --- | --- | --- |
| aplicaciones_credito_id_seq | 6 | 6 | no |
| aplicaciones_pago_proveedor_id_seq | 18 | 18 | no |
| auditoria_id_seq | 3965 | 3965 | no |
| auditorias_inventario_id_seq | — | — | no |
| autorizaciones_nota_id_seq | 6 | 6 | no |
| camionetas_id_seq | — | — | no |
| choferes_id_seq | — | — | no |
| cliente_documentos_id_seq | 4 | 4 | no |
| clientes_id_seq | 7 | 7 | no |
| contenedor_lineas_id_seq | 2 | 2 | no |
| contenedores_folio_seq | — | — | no |
| contenedores_id_seq | 2 | 2 | no |
| cuadre_fiscal_registros_id_seq | — | — | no |
| entradas_id_seq | 432 | 432 | no |
| equipos_id_seq | — | — | no |
| movimientos_credito_id_seq | 50 | 50 | no |
| movimientos_id_seq | 6522 | 6522 | no |
| notificaciones_credito_id_seq | 8 | 8 | no |
| notificaciones_sistema_id_seq | 28 | 28 | no |
| pagos_proveedor_id_seq | 450 | 450 | no |
| permisos_rol_id_seq | 29041 | 29041 | no |
| permisos_ubicacion_id_seq | 6750 | 6750 | no |
| permisos_usuario_id_seq | 125 | 125 | no |
| pisos_id_seq | — | — | no |
| precio_historial_id_seq | 1016 | 1016 | no |
| productos_id_seq | 2077 | 2077 | no |
| proveedores_id_seq | 225 | 225 | no |
| reimpresiones_etiqueta_id_seq | 170 | 170 | no |
| revisiones_etiqueta_id_seq | 31 | 31 | no |
| rollos_id_seq | 5463 | 5463 | no |
| salida_lineas_id_seq | 26 | 26 | no |
| salida_rollos_id_seq | 113 | 113 | no |
| salidas_dinero_caja_id_seq | — | — | no |
| salidas_id_seq | 24 | 24 | no |
| sesiones_caja_id_seq | 42 | 42 | no |
| solicitudes_pago_dirigido_id_seq | 1 | 1 | no |
| stock_minimo_episodios_id_seq | 7 | 7 | no |
| stock_minimos_id_seq | 3 | 3 | no |
| ticket_linea_consumos_id_seq | 20 | 20 | no |
| ticket_lineas_id_seq | 353 | 353 | no |
| ticket_pagos_id_seq | 89 | 89 | no |
| tickets_id_seq | 105 | 105 | no |
| ubicaciones_id_seq | 834 | 834 | no |
| usuarios_id_seq | 233 | 233 | no |
| viajes_id_seq | — | — | no |

- Política de identidad interna: **CONTINUE IDENTITY**; no se hizo `RESTART IDENTITY`, `setval` ni `ALTER SEQUENCE`, y este bloque no introdujo reutilización de IDs internos.

`public.contenedores_folio_seq` se marca **PENDIENTE** únicamente por la ambigüedad de su folio de negocio. No se inventa un objetivo ni se reinicia.

## Triggers y caché

- Triggers no internos vivos: **14**; enabled (estado distinto de `D`): **14**.
- Guards que escuchan DELETE pero no TRUNCATE: **9**; esto confirma la brecha conceptual de TRUNCATE para roles privilegiados.

| Tabla | Trigger | Enabled | DELETE | TRUNCATE | Función |
| --- | --- | --- | --- | --- | --- |
| aplicaciones_credito | aplicaciones_credito_inmutables | O | true | false | prevent_financial_record_mutation |
| aplicaciones_credito | aplicaciones_credito_validas | O | false | false | validate_credit_application |
| aplicaciones_pago_proveedor | aplicaciones_pago_proveedor_append_only | O | true | false | proteger_aplicaciones_pago_proveedor |
| aplicaciones_pago_proveedor | aplicaciones_pago_proveedor_validar_insert | O | false | false | validar_aplicacion_pago_proveedor |
| auditoria | auditoria_append_only | O | true | false | proteger_auditoria_append_only |
| auditoria | auditoria_enriquecer_insert | O | false | false | enriquecer_auditoria |
| movimientos_credito | movimientos_credito_inmutables | O | true | false | prevent_financial_record_mutation |
| movimientos_credito | movimientos_credito_reversos_validos | O | false | false | validate_credit_reversal |
| pagos_proveedor | pagos_proveedor_inmutables | O | true | false | prevent_pago_proveedor_mutation |
| reimpresiones_etiqueta | reimpresiones_etiqueta_inmutable | O | true | false | bloquear_mutacion_reimpresion_etiqueta |
| revisiones_etiqueta | revisiones_etiqueta_inmutable | O | true | false | bloquear_mutacion_revision_etiqueta |
| revisiones_etiqueta | revisiones_etiqueta_reimpresion_fk_check | O | false | false | validar_revision_etiqueta_reimpresion |
| ticket_linea_consumos | ticket_linea_consumos_append_only | A | true | false | ticket_linea_consumos_guard |
| ticket_pagos | ticket_pagos_inmutables | O | true | false | prevent_financial_record_mutation |

| Inspección estática | Resultado |
| --- | --- |
| source_file | artifacts/api-server/src/lib/inventario.ts |
| source_sha256 | 08859702db62c4f0cce95e08845e64234d49d2556abba4e68bfd6c321552e3b7 |
| function_name | reconstruirCacheExistencias |
| source_line_start | 2832 |
| source_line_end | 2871 |
| accepts_caller_transaction | true |
| uses_caller_transaction_when_supplied | true |
| reads_existencias_movimientos_rollos | true |
| writes_with_conflict_update | true |
| contains_delete_or_truncate | false |
| execution_status | NOT_EXECUTED_BY_BLOCK3 |
| required_future_call | await reconstruirCacheExistencias(tx); |
| required_future_transaction | same owner transaction as conceptual A truncate and B updates |

La función real acepta la transacción llamadora y sería llamada con `tx`; **no se ejecutó ahora**, por lo que `existencias` sigue intacta.

## Evidencia operacional que se perdería si A fuera purgada

### Movimientos de crédito: referencias, folios y tipo exacto

| Movimiento | Tipo | Importe | Referencia | Ticket folio | Documento | Crédito | Origen | Fecha |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 45 | ABONO | -15000.00 | — | — | — | — | — | 2026-09-15 00:00:00+00 |
| 46 | ABONO | -10000.00 | — | — | — | — | — | 2026-09-15 00:00:00+00 |
| 43 | VENTA_CREDITO | 15750.00 | — | 1004 | NOTA | true | — | 2026-09-15 19:29:34.336084+00 |
| 44 | VENTA_CREDITO | 22022.00 | — | 1005 | NOTA | true | — | 2026-09-15 19:32:04.605206+00 |
| 50 | ABONO | -15000.00 | CORRECCION-FECHA-ABONO-45 | — | — | — | — | 2026-09-15 19:34:10.192+00 |
| 49 | ABONO | -10000.00 | CORRECCION-FECHA-ABONO-46 | — | — | — | — | 2026-09-15 19:35:17.006+00 |
| 47 | REVERSO | 10000.00 | — | — | — | — | 46 | 2026-09-15 21:16:51.254+00 |
| 48 | REVERSO | 15000.00 | — | — | — | — | 45 | 2026-09-15 21:16:51.304+00 |

### Tickets y notas de crédito: distinción exacta

| Ticket ID | Folio | Documento | Crédito | Estado | Autorización | Total | Mov. crédito | Autorización nota | Creado |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 100 | 1000 | TICKET | false | VENDIDO | NO_APLICA | 9376.00 | 0 | 0 | 2026-09-13 18:27:07.379+00 |
| 101 | 1001 | TICKET | false | VENDIDO | NO_APLICA | 17792.00 | 0 | 0 | 2026-09-13 23:06:29.967+00 |
| 102 | 1002 | TICKET | false | VENDIDO | NO_APLICA | 72634.00 | 0 | 0 | 2026-09-13 23:11:37.042+00 |
| 103 | 1003 | TICKET | false | VENDIDO | NO_APLICA | 3500.00 | 0 | 0 | 2026-09-14 18:06:22.541+00 |
| 104 | 1004 | NOTA | true | VENDIDO | AUTORIZADA | 15750.00 | 1 | 1 | 2026-09-15 19:28:48.782+00 |
| 105 | 1005 | NOTA | true | VENDIDO | AUTORIZADA | 22022.00 | 1 | 1 | 2026-09-15 19:31:00.694+00 |

### Series de rollos

Total de rollos: **226**.

| Rollo | Serie | Estado | Cantidad actual | Entrada folio | Creado | Actualizado |
| --- | --- | --- | --- | --- | --- | --- |
| 5238 | 1000001 | VENDIDO | 100.000 | 1 | 2026-09-13 18:03:59.454653+00 | 2026-09-15 19:31:00.79+00 |
| 5239 | 1000002 | VENDIDO | 99.000 | 1 | 2026-09-13 18:03:59.454653+00 | 2026-09-13 18:27:07.395+00 |
| 5240 | 1000003 | VENDIDO | 98.000 | 1 | 2026-09-13 18:03:59.454653+00 | 2026-09-13 18:27:07.405+00 |
| 5241 | 1000004 | VENDIDO | 96.000 | 1 | 2026-09-13 18:03:59.454653+00 | 2026-09-13 18:27:07.413+00 |
| 5242 | 1000005 | VENDIDO | 89.000 | 1 | 2026-09-13 18:03:59.454653+00 | 2026-09-13 23:06:30.114+00 |
| 5243 | 1000006 | VENDIDO | 95.000 | 1 | 2026-09-13 18:03:59.454653+00 | 2026-09-13 23:06:30.16+00 |
| 5244 | 1000007 | VENDIDO | 93.000 | 1 | 2026-09-13 18:03:59.454653+00 | 2026-09-13 23:06:30.125+00 |
| 5245 | 1000008 | VENDIDO | 100.000 | 1 | 2026-09-13 18:03:59.454653+00 | 2026-09-13 23:06:30.133+00 |
| 5246 | 1000009 | VENDIDO | 89.000 | 1 | 2026-09-13 18:03:59.454653+00 | 2026-09-13 23:06:30.141+00 |
| 5247 | 1000010 | VENDIDO | 90.000 | 1 | 2026-09-13 18:03:59.454653+00 | 2026-09-13 23:06:30.151+00 |
| 5248 | 1000011 | VENDIDO | 100.000 | 2 | 2026-09-13 18:14:59.2892+00 | 2026-09-13 23:11:37.267+00 |
| 5249 | 1000012 | VENDIDO | 98.000 | 2 | 2026-09-13 18:14:59.2892+00 | 2026-09-13 23:11:37.26+00 |
| 5250 | 1000013 | VENDIDO | 96.000 | 2 | 2026-09-13 18:14:59.2892+00 | 2026-09-15 19:31:00.798+00 |
| 5251 | 1000014 | VENDIDO | 89.000 | 2 | 2026-09-13 18:14:59.2892+00 | 2026-09-13 23:11:37.253+00 |
| 5252 | 1000015 | VENDIDO | 100.000 | 2 | 2026-09-13 18:14:59.2892+00 | 2026-09-13 23:11:37.247+00 |
| 5253 | 1000016 | VENDIDO | 104.000 | 2 | 2026-09-13 18:14:59.2892+00 | 2026-09-13 23:11:37.24+00 |
| 5254 | 1000017 | VENDIDO | 105.000 | 2 | 2026-09-13 18:14:59.2892+00 | 2026-09-13 23:11:37.231+00 |
| 5255 | 1000018 | VENDIDO | 103.000 | 2 | 2026-09-13 18:14:59.2892+00 | 2026-09-13 23:11:37.221+00 |
| 5256 | 1000019 | VENDIDO | 104.000 | 2 | 2026-09-13 18:14:59.2892+00 | 2026-09-13 23:11:37.21+00 |
| 5257 | 1000020 | VENDIDO | 102.000 | 2 | 2026-09-13 18:14:59.2892+00 | 2026-09-13 23:11:37.2+00 |
| 5258 | 1000021 | VENDIDO | 100.000 | 2 | 2026-09-13 18:14:59.2892+00 | 2026-09-13 23:11:37.185+00 |
| 5259 | 1000022 | VENDIDO | 101.000 | 2 | 2026-09-13 18:14:59.2892+00 | 2026-09-13 23:11:37.177+00 |
| 5260 | 1000023 | VENDIDO | 108.000 | 2 | 2026-09-13 18:14:59.2892+00 | 2026-09-13 23:11:37.169+00 |
| 5261 | 1000024 | VENDIDO | 98.000 | 2 | 2026-09-13 18:14:59.2892+00 | 2026-09-13 23:11:37.158+00 |
| 5262 | 1000025 | VENDIDO | 99.000 | 2 | 2026-09-13 18:14:59.2892+00 | 2026-09-13 23:11:37.149+00 |
| 5263 | 1000026 | VENDIDO | 97.000 | 2 | 2026-09-13 18:14:59.2892+00 | 2026-09-13 23:11:37.142+00 |
| 5264 | 1000027 | VENDIDO | 96.000 | 2 | 2026-09-13 18:14:59.2892+00 | 2026-09-13 23:11:37.134+00 |
| 5265 | 1000028 | VENDIDO | 96.000 | 2 | 2026-09-13 18:14:59.2892+00 | 2026-09-13 23:11:37.125+00 |
| 5266 | 1000029 | VENDIDO | 95.000 | 2 | 2026-09-13 18:14:59.2892+00 | 2026-09-13 23:11:37.117+00 |
| 5267 | 1000030 | VENDIDO | 92.000 | 2 | 2026-09-13 18:14:59.2892+00 | 2026-09-13 23:11:37.11+00 |
| 5268 | 1000031 | DISPONIBLE | 97.000 | 3 | 2026-09-13 18:57:19.70851+00 | 2026-09-13 18:57:19.70851+00 |
| 5269 | 1000032 | DISPONIBLE | 250.000 | 4 | 2026-09-13 19:26:40.263287+00 | 2026-09-13 19:26:40.263287+00 |
| 5270 | 1000033 | VENDIDO | 250.000 | 4 | 2026-09-13 19:26:40.263287+00 | 2026-09-15 19:31:00.775+00 |
| 5271 | 1000034 | VENDIDO | 250.000 | 4 | 2026-09-13 19:26:40.263287+00 | 2026-09-15 19:31:00.782+00 |
| 5272 | 1000035 | DISPONIBLE | 250.000 | 4 | 2026-09-13 19:26:40.263287+00 | 2026-09-13 19:26:40.263287+00 |
| 5273 | 1000036 | DISPONIBLE | 250.000 | 4 | 2026-09-13 19:26:40.263287+00 | 2026-09-13 19:26:40.263287+00 |
| 5274 | 1000037 | DISPONIBLE | 250.000 | 4 | 2026-09-13 19:26:40.263287+00 | 2026-09-13 19:26:40.263287+00 |
| 5275 | 1000038 | VENDIDO | 250.000 | 4 | 2026-09-13 19:26:40.263287+00 | 2026-09-15 19:31:00.765+00 |
| 5276 | 1000039 | DISPONIBLE | 250.000 | 4 | 2026-09-13 19:26:40.263287+00 | 2026-09-13 19:26:40.263287+00 |
| 5277 | 1000040 | VENDIDO | 250.000 | 4 | 2026-09-13 19:26:40.263287+00 | 2026-09-15 19:31:00.755+00 |
| 5278 | 1000041 | VENDIDO | 250.000 | 4 | 2026-09-13 19:26:40.263287+00 | 2026-09-15 19:31:00.747+00 |
| 5279 | 1000042 | DISPONIBLE | 250.000 | 4 | 2026-09-13 19:26:40.263287+00 | 2026-09-13 19:26:40.263287+00 |
| 5280 | 1000043 | DISPONIBLE | 250.000 | 4 | 2026-09-13 19:26:40.263287+00 | 2026-09-13 19:26:40.263287+00 |
| 5281 | 1000044 | DISPONIBLE | 250.000 | 4 | 2026-09-13 19:26:40.263287+00 | 2026-09-13 19:26:40.263287+00 |
| 5282 | 1000045 | DISPONIBLE | 250.000 | 4 | 2026-09-13 19:26:40.263287+00 | 2026-09-13 19:26:40.263287+00 |
| 5283 | 1000046 | DISPONIBLE | 250.000 | 4 | 2026-09-13 19:26:40.263287+00 | 2026-09-13 19:26:40.263287+00 |
| 5284 | 1000047 | VENDIDO | 250.000 | 4 | 2026-09-13 19:26:40.263287+00 | 2026-09-15 19:28:49.581+00 |
| 5285 | 1000048 | VENDIDO | 250.000 | 4 | 2026-09-13 19:26:40.263287+00 | 2026-09-15 19:28:49.574+00 |
| 5286 | 1000049 | VENDIDO | 250.000 | 4 | 2026-09-13 19:26:40.263287+00 | 2026-09-15 19:28:49.566+00 |
| 5287 | 1000050 | VENDIDO | 250.000 | 4 | 2026-09-13 19:26:40.263287+00 | 2026-09-13 23:11:37.1+00 |
| 5288 | 1000051 | VENDIDO | 250.000 | 4 | 2026-09-13 19:26:40.263287+00 | 2026-09-13 23:11:37.092+00 |
| 5289 | 1000052 | VENDIDO | 250.000 | 4 | 2026-09-13 19:26:40.263287+00 | 2026-09-13 23:11:37.083+00 |
| 5290 | 1000053 | VENDIDO | 250.000 | 4 | 2026-09-13 19:26:40.263287+00 | 2026-09-13 23:11:37.074+00 |
| 5291 | 1000054 | VENDIDO | 250.000 | 4 | 2026-09-13 19:26:40.263287+00 | 2026-09-13 23:11:37.066+00 |
| 5292 | 1000055 | VENDIDO | 250.000 | 4 | 2026-09-13 19:26:40.263287+00 | 2026-09-13 23:11:37.058+00 |
| 5293 | 1000056 | VENDIDO | 250.000 | 4 | 2026-09-13 19:26:40.263287+00 | 2026-09-13 23:11:37.048+00 |
| 5294 | 1000057 | DISPONIBLE | 250.000 | 5 | 2026-09-13 20:54:48.19082+00 | 2026-09-13 20:54:48.19082+00 |
| 5295 | 1000058 | DISPONIBLE | 250.000 | 5 | 2026-09-13 20:54:48.19082+00 | 2026-09-13 20:54:48.19082+00 |
| 5296 | 1000059 | VENDIDO | 250.000 | 5 | 2026-09-13 20:54:48.19082+00 | 2026-09-14 18:06:22.645+00 |
| 5297 | 1000060 | VENDIDO | 250.000 | 5 | 2026-09-13 20:54:48.19082+00 | 2026-09-14 18:06:22.843+00 |
| 5298 | 1000061 | DISPONIBLE | 250.000 | 5 | 2026-09-13 20:54:48.19082+00 | 2026-09-13 20:54:48.19082+00 |
| 5299 | 1000062 | DISPONIBLE | 250.000 | 5 | 2026-09-13 20:54:48.19082+00 | 2026-09-13 20:54:48.19082+00 |
| 5300 | 1000063 | VENDIDO | 250.000 | 5 | 2026-09-13 20:54:48.19082+00 | 2026-09-15 19:31:00.727+00 |
| 5301 | 1000064 | DISPONIBLE | 250.000 | 5 | 2026-09-13 20:54:48.19082+00 | 2026-09-13 20:54:48.19082+00 |
| 5302 | 1000065 | VENDIDO | 250.000 | 5 | 2026-09-13 20:54:48.19082+00 | 2026-09-15 19:31:00.736+00 |
| 5303 | 1000066 | VENDIDO | 250.000 | 5 | 2026-09-13 20:54:48.19082+00 | 2026-09-15 19:31:00.716+00 |
| 5304 | 1000067 | VENDIDO | 250.000 | 5 | 2026-09-13 20:54:48.19082+00 | 2026-09-15 19:28:49.558+00 |
| 5305 | 1000068 | DISPONIBLE | 250.000 | 5 | 2026-09-13 20:54:48.19082+00 | 2026-09-13 20:54:48.19082+00 |
| 5306 | 1000069 | DISPONIBLE | 250.000 | 5 | 2026-09-13 20:54:48.19082+00 | 2026-09-13 20:54:48.19082+00 |
| 5307 | 1000070 | VENDIDO | 250.000 | 5 | 2026-09-13 20:54:48.19082+00 | 2026-09-15 19:28:49.548+00 |
| 5308 | 1000071 | DISPONIBLE | 250.000 | 5 | 2026-09-13 20:54:48.19082+00 | 2026-09-13 20:54:48.19082+00 |
| 5309 | 1000072 | VENDIDO | 250.000 | 5 | 2026-09-13 20:54:48.19082+00 | 2026-09-15 19:28:49.529+00 |
| 5310 | 1000073 | VENDIDO | 250.000 | 5 | 2026-09-13 20:54:48.19082+00 | 2026-09-15 19:28:49.538+00 |
| 5311 | 1000074 | VENDIDO | 250.000 | 5 | 2026-09-13 20:54:48.19082+00 | 2026-09-15 19:31:00.706+00 |
| 5312 | 1000075 | VENDIDO | 250.000 | 5 | 2026-09-13 20:54:48.19082+00 | 2026-09-15 19:28:49.517+00 |
| 5313 | 1000076 | VENDIDO | 250.000 | 5 | 2026-09-13 20:54:48.19082+00 | 2026-09-15 19:28:49.256+00 |
| 5314 | 1000077 | DISPONIBLE | 100.000 | 1 | 2026-09-14 19:16:11.560962+00 | 2026-09-14 19:16:11.560962+00 |
| 5315 | 1000078 | DISPONIBLE | 100.000 | 1 | 2026-09-14 19:16:11.560962+00 | 2026-09-14 19:16:11.560962+00 |
| 5316 | 1000079 | DISPONIBLE | 100.000 | 1 | 2026-09-14 19:16:11.560962+00 | 2026-09-14 19:16:11.560962+00 |
| 5317 | 1000080 | DISPONIBLE | 100.000 | 1 | 2026-09-14 19:16:11.560962+00 | 2026-09-14 19:16:11.560962+00 |
| 5318 | 1000081 | DISPONIBLE | 100.000 | 1 | 2026-09-14 19:16:11.560962+00 | 2026-09-14 19:16:11.560962+00 |
| 5319 | 1000082 | DISPONIBLE | 100.000 | 1 | 2026-09-14 19:16:11.560962+00 | 2026-09-14 19:16:11.560962+00 |
| 5320 | 1000083 | DISPONIBLE | 100.000 | 1 | 2026-09-14 19:16:11.560962+00 | 2026-09-14 19:16:11.560962+00 |
| 5321 | 1000084 | DISPONIBLE | 100.000 | 1 | 2026-09-14 19:16:11.560962+00 | 2026-09-14 19:16:11.560962+00 |
| 5322 | 1000085 | DISPONIBLE | 100.000 | 1 | 2026-09-14 19:16:11.560962+00 | 2026-09-14 19:16:11.560962+00 |
| 5323 | 1000086 | DISPONIBLE | 100.000 | 1 | 2026-09-14 19:16:11.560962+00 | 2026-09-14 19:16:11.560962+00 |
| 5324 | 1000087 | DISPONIBLE | 100.000 | 1 | 2026-09-14 19:16:11.560962+00 | 2026-09-14 19:16:11.560962+00 |
| 5325 | 1000088 | DISPONIBLE | 100.000 | 1 | 2026-09-14 19:16:11.560962+00 | 2026-09-14 19:16:11.560962+00 |
| 5326 | 1000089 | DISPONIBLE | 100.000 | 1 | 2026-09-14 19:16:11.560962+00 | 2026-09-14 19:16:11.560962+00 |
| 5327 | 1000090 | DISPONIBLE | 100.000 | 1 | 2026-09-14 19:16:11.560962+00 | 2026-09-14 19:16:11.560962+00 |
| 5328 | 1000091 | DISPONIBLE | 100.000 | 1 | 2026-09-14 19:16:11.560962+00 | 2026-09-14 19:16:11.560962+00 |
| 5329 | 1000092 | DISPONIBLE | 100.000 | 1 | 2026-09-14 19:16:11.560962+00 | 2026-09-14 19:16:11.560962+00 |
| 5330 | 1000093 | DISPONIBLE | 100.000 | 1 | 2026-09-14 19:16:11.560962+00 | 2026-09-14 19:16:11.560962+00 |
| 5331 | 1000094 | DISPONIBLE | 100.000 | 1 | 2026-09-14 19:16:11.560962+00 | 2026-09-14 19:16:11.560962+00 |
| 5332 | 1000095 | DISPONIBLE | 100.000 | 1 | 2026-09-14 19:16:11.560962+00 | 2026-09-14 19:16:11.560962+00 |
| 5333 | 1000096 | DISPONIBLE | 100.000 | 1 | 2026-09-14 19:16:11.560962+00 | 2026-09-14 19:16:11.560962+00 |
| 5334 | 1000097 | DISPONIBLE | 100.000 | 1 | 2026-09-14 19:16:11.560962+00 | 2026-09-14 19:16:11.560962+00 |
| 5335 | 1000098 | DISPONIBLE | 100.000 | 1 | 2026-09-14 19:16:11.560962+00 | 2026-09-14 19:16:11.560962+00 |
| 5336 | 1000099 | DISPONIBLE | 100.000 | 1 | 2026-09-14 19:16:11.560962+00 | 2026-09-14 19:16:11.560962+00 |
| 5337 | 1000100 | DISPONIBLE | 100.000 | 1 | 2026-09-14 19:16:11.560962+00 | 2026-09-14 19:16:11.560962+00 |
| 5338 | 1000101 | DISPONIBLE | 100.000 | 1 | 2026-09-14 19:16:11.560962+00 | 2026-09-14 19:16:11.560962+00 |
| 5339 | 1000102 | DISPONIBLE | 100.000 | 1 | 2026-09-14 19:16:11.560962+00 | 2026-09-14 19:16:11.560962+00 |
| 5340 | 1000103 | DISPONIBLE | 100.000 | 1 | 2026-09-14 19:16:11.560962+00 | 2026-09-14 19:16:11.560962+00 |
| 5341 | 1000104 | DISPONIBLE | 100.000 | 1 | 2026-09-14 19:16:11.560962+00 | 2026-09-14 19:16:11.560962+00 |
| 5342 | 1000105 | DISPONIBLE | 100.000 | 1 | 2026-09-14 19:16:11.560962+00 | 2026-09-14 19:16:11.560962+00 |
| 5343 | 1000106 | DISPONIBLE | 100.000 | 1 | 2026-09-14 19:16:11.560962+00 | 2026-09-14 19:16:11.560962+00 |
| 5344 | 1000107 | DISPONIBLE | 100.000 | 1 | 2026-09-14 19:16:11.560962+00 | 2026-09-14 19:16:11.560962+00 |
| 5345 | 1000108 | DISPONIBLE | 100.000 | 1 | 2026-09-14 19:16:11.560962+00 | 2026-09-14 19:16:11.560962+00 |
| 5346 | 1000109 | DISPONIBLE | 100.000 | 1 | 2026-09-14 19:16:11.560962+00 | 2026-09-14 19:16:11.560962+00 |
| 5347 | 1000110 | DISPONIBLE | 100.000 | 1 | 2026-09-14 19:16:11.560962+00 | 2026-09-14 19:16:11.560962+00 |
| 5348 | 1000111 | DISPONIBLE | 100.000 | 1 | 2026-09-14 19:16:11.560962+00 | 2026-09-14 19:16:11.560962+00 |
| 5349 | 1000112 | DISPONIBLE | 100.000 | 1 | 2026-09-14 19:16:11.560962+00 | 2026-09-14 19:16:11.560962+00 |
| 5350 | 1000113 | DISPONIBLE | 100.000 | 1 | 2026-09-14 19:16:11.560962+00 | 2026-09-14 19:16:11.560962+00 |
| 5351 | 1000114 | DISPONIBLE | 100.000 | 1 | 2026-09-14 19:16:11.560962+00 | 2026-09-14 19:16:11.560962+00 |
| 5352 | 1000115 | DISPONIBLE | 100.000 | 1 | 2026-09-14 19:16:11.560962+00 | 2026-09-14 19:16:11.560962+00 |
| 5353 | 1000116 | DISPONIBLE | 100.000 | 1 | 2026-09-14 19:16:11.560962+00 | 2026-09-14 19:16:11.560962+00 |
| 5354 | 1000117 | DISPONIBLE | 100.000 | 1 | 2026-09-14 19:16:11.560962+00 | 2026-09-14 19:16:11.560962+00 |
| 5355 | 1000118 | DISPONIBLE | 100.000 | 1 | 2026-09-14 19:16:11.560962+00 | 2026-09-14 19:16:11.560962+00 |
| 5356 | 1000119 | DISPONIBLE | 100.000 | 1 | 2026-09-14 19:16:11.560962+00 | 2026-09-14 19:16:11.560962+00 |
| 5357 | 1000120 | DISPONIBLE | 100.000 | 1 | 2026-09-14 19:16:11.560962+00 | 2026-09-14 19:16:11.560962+00 |
| 5358 | 1000121 | DISPONIBLE | 100.000 | 1 | 2026-09-14 19:16:11.560962+00 | 2026-09-14 19:16:11.560962+00 |
| 5359 | 1000122 | DISPONIBLE | 100.000 | 1 | 2026-09-14 19:16:11.560962+00 | 2026-09-14 19:16:11.560962+00 |
| 5360 | 1000123 | DISPONIBLE | 100.000 | 1 | 2026-09-14 19:16:11.560962+00 | 2026-09-14 19:16:11.560962+00 |
| 5361 | 1000124 | DISPONIBLE | 100.000 | 1 | 2026-09-14 19:16:11.560962+00 | 2026-09-14 19:16:11.560962+00 |
| 5362 | 1000125 | DISPONIBLE | 100.000 | 1 | 2026-09-14 19:16:11.560962+00 | 2026-09-14 19:16:11.560962+00 |
| 5363 | 1000126 | DISPONIBLE | 100.000 | 1 | 2026-09-14 19:16:11.560962+00 | 2026-09-14 19:16:11.560962+00 |
| 5364 | 1000127 | DISPONIBLE | 100.000 | 1 | 2026-09-14 19:16:11.560962+00 | 2026-09-14 19:16:11.560962+00 |
| 5365 | 1000128 | DISPONIBLE | 100.000 | 1 | 2026-09-14 19:16:11.560962+00 | 2026-09-14 19:16:11.560962+00 |
| 5366 | 1000129 | DISPONIBLE | 100.000 | 1 | 2026-09-14 19:16:11.560962+00 | 2026-09-14 19:16:11.560962+00 |
| 5367 | 1000130 | DISPONIBLE | 100.000 | 1 | 2026-09-14 19:16:11.560962+00 | 2026-09-14 19:16:11.560962+00 |
| 5368 | 1000131 | DISPONIBLE | 100.000 | 1 | 2026-09-14 19:16:11.560962+00 | 2026-09-14 19:16:11.560962+00 |
| 5369 | 1000132 | DISPONIBLE | 100.000 | 1 | 2026-09-14 19:16:11.560962+00 | 2026-09-14 19:16:11.560962+00 |
| 5370 | 1000133 | DISPONIBLE | 100.000 | 1 | 2026-09-14 19:16:11.560962+00 | 2026-09-14 19:16:11.560962+00 |
| 5371 | 1000134 | DISPONIBLE | 100.000 | 1 | 2026-09-14 19:16:11.560962+00 | 2026-09-14 19:16:11.560962+00 |
| 5372 | 1000135 | DISPONIBLE | 100.000 | 1 | 2026-09-14 19:16:11.560962+00 | 2026-09-14 19:16:11.560962+00 |
| 5373 | 1000136 | DISPONIBLE | 100.000 | 1 | 2026-09-14 19:16:11.560962+00 | 2026-09-14 19:16:11.560962+00 |
| 5374 | 1000137 | DISPONIBLE | 100.000 | 1 | 2026-09-14 19:16:11.560962+00 | 2026-09-14 19:16:11.560962+00 |
| 5375 | 1000138 | DISPONIBLE | 100.000 | 1 | 2026-09-14 19:16:11.560962+00 | 2026-09-14 19:16:11.560962+00 |
| 5376 | 1000139 | DISPONIBLE | 100.000 | 1 | 2026-09-14 19:16:11.560962+00 | 2026-09-14 19:16:11.560962+00 |
| 5377 | 1000140 | DISPONIBLE | 100.000 | 1 | 2026-09-14 19:16:11.560962+00 | 2026-09-14 19:16:11.560962+00 |
| 5378 | 1000141 | DISPONIBLE | 100.000 | 1 | 2026-09-14 19:16:11.560962+00 | 2026-09-14 19:16:11.560962+00 |
| 5379 | 1000142 | DISPONIBLE | 100.000 | 1 | 2026-09-14 19:16:11.560962+00 | 2026-09-14 19:16:11.560962+00 |
| 5380 | 1000143 | DISPONIBLE | 100.000 | 1 | 2026-09-14 19:16:11.560962+00 | 2026-09-14 19:16:11.560962+00 |
| 5381 | 1000144 | DISPONIBLE | 100.000 | 1 | 2026-09-14 19:16:11.560962+00 | 2026-09-14 19:16:11.560962+00 |
| 5382 | 1000145 | DISPONIBLE | 100.000 | 1 | 2026-09-14 19:16:11.560962+00 | 2026-09-14 19:16:11.560962+00 |
| 5383 | 1000146 | DISPONIBLE | 100.000 | 1 | 2026-09-14 19:16:11.560962+00 | 2026-09-14 19:16:11.560962+00 |
| 5384 | 1000147 | DISPONIBLE | 100.000 | 1 | 2026-09-14 19:16:11.560962+00 | 2026-09-14 19:16:11.560962+00 |
| 5385 | 1000148 | DISPONIBLE | 100.000 | 1 | 2026-09-14 19:16:11.560962+00 | 2026-09-14 19:16:11.560962+00 |
| 5386 | 1000149 | DISPONIBLE | 100.000 | 1 | 2026-09-14 19:16:11.560962+00 | 2026-09-14 19:16:11.560962+00 |
| 5387 | 1000150 | DISPONIBLE | 100.000 | 1 | 2026-09-14 19:16:11.560962+00 | 2026-09-14 19:16:11.560962+00 |
| 5388 | 1000151 | DISPONIBLE | 100.000 | 1 | 2026-09-14 19:16:11.560962+00 | 2026-09-14 19:16:11.560962+00 |
| 5389 | 1000152 | DISPONIBLE | 100.000 | 1 | 2026-09-14 19:16:11.560962+00 | 2026-09-14 19:16:11.560962+00 |
| 5390 | 1000153 | DISPONIBLE | 100.000 | 1 | 2026-09-14 19:16:11.560962+00 | 2026-09-14 19:16:11.560962+00 |
| 5391 | 1000154 | DISPONIBLE | 100.000 | 1 | 2026-09-14 19:16:11.560962+00 | 2026-09-14 19:16:11.560962+00 |
| 5392 | 1000155 | DISPONIBLE | 100.000 | 1 | 2026-09-14 19:16:11.560962+00 | 2026-09-14 19:16:11.560962+00 |
| 5393 | 1000156 | DISPONIBLE | 100.000 | 1 | 2026-09-14 19:16:11.560962+00 | 2026-09-14 19:16:11.560962+00 |
| 5394 | 1000157 | DISPONIBLE | 100.000 | 1 | 2026-09-14 19:16:11.560962+00 | 2026-09-14 19:16:11.560962+00 |
| 5395 | 1000158 | DISPONIBLE | 100.000 | 1 | 2026-09-14 19:16:11.560962+00 | 2026-09-14 19:16:11.560962+00 |
| 5396 | 1000159 | DISPONIBLE | 100.000 | 1 | 2026-09-14 19:16:11.560962+00 | 2026-09-14 19:16:11.560962+00 |
| 5397 | 1000160 | DISPONIBLE | 100.000 | 1 | 2026-09-14 19:16:11.560962+00 | 2026-09-14 19:16:11.560962+00 |
| 5398 | 1000161 | DISPONIBLE | 100.000 | 1 | 2026-09-14 19:16:11.560962+00 | 2026-09-14 19:16:11.560962+00 |
| 5399 | 1000162 | DISPONIBLE | 100.000 | 1 | 2026-09-14 19:16:11.560962+00 | 2026-09-14 19:16:11.560962+00 |
| 5400 | 1000163 | DISPONIBLE | 100.000 | 1 | 2026-09-14 19:16:11.560962+00 | 2026-09-14 19:16:11.560962+00 |
| 5401 | 1000164 | DISPONIBLE | 100.000 | 1 | 2026-09-14 19:16:11.560962+00 | 2026-09-14 19:16:11.560962+00 |
| 5402 | 1000165 | DISPONIBLE | 100.000 | 1 | 2026-09-14 19:16:11.560962+00 | 2026-09-14 19:16:11.560962+00 |
| 5403 | 1000166 | DISPONIBLE | 100.000 | 1 | 2026-09-14 19:16:11.560962+00 | 2026-09-14 19:16:11.560962+00 |
| 5404 | 1000167 | DISPONIBLE | 100.000 | 1 | 2026-09-14 19:16:11.560962+00 | 2026-09-14 19:16:11.560962+00 |
| 5405 | 1000168 | DISPONIBLE | 100.000 | 1 | 2026-09-14 19:16:11.560962+00 | 2026-09-14 19:16:11.560962+00 |
| 5406 | 1000169 | DISPONIBLE | 100.000 | 1 | 2026-09-14 19:16:11.560962+00 | 2026-09-14 19:16:11.560962+00 |
| 5407 | 1000170 | DISPONIBLE | 100.000 | 1 | 2026-09-14 19:16:11.560962+00 | 2026-09-14 19:16:11.560962+00 |
| 5408 | 1000171 | DISPONIBLE | 100.000 | 1 | 2026-09-14 19:16:11.560962+00 | 2026-09-14 19:16:11.560962+00 |
| 5409 | 1000172 | DISPONIBLE | 100.000 | 1 | 2026-09-14 19:16:11.560962+00 | 2026-09-14 19:16:11.560962+00 |
| 5410 | 1000173 | DISPONIBLE | 100.000 | 1 | 2026-09-14 19:16:11.560962+00 | 2026-09-14 19:16:11.560962+00 |
| 5411 | 1000174 | DISPONIBLE | 100.000 | 1 | 2026-09-14 19:16:11.560962+00 | 2026-09-14 19:16:11.560962+00 |
| 5412 | 1000175 | DISPONIBLE | 100.000 | 1 | 2026-09-14 19:16:11.560962+00 | 2026-09-14 19:16:11.560962+00 |
| 5413 | 1000176 | DISPONIBLE | 100.000 | 1 | 2026-09-14 19:16:11.560962+00 | 2026-09-14 19:16:11.560962+00 |
| 5414 | 1000177 | DISPONIBLE | 100.000 | 1 | 2026-09-14 19:16:11.560962+00 | 2026-09-14 19:16:11.560962+00 |
| 5415 | 1000178 | DISPONIBLE | 100.000 | 1 | 2026-09-14 19:16:11.560962+00 | 2026-09-14 19:16:11.560962+00 |
| 5416 | 1000179 | DISPONIBLE | 100.000 | 1 | 2026-09-14 19:16:11.560962+00 | 2026-09-14 19:16:11.560962+00 |
| 5417 | 1000180 | DISPONIBLE | 100.000 | 1 | 2026-09-14 19:16:11.560962+00 | 2026-09-14 19:16:11.560962+00 |
| 5418 | 1000181 | DISPONIBLE | 100.000 | 1 | 2026-09-14 19:16:11.560962+00 | 2026-09-14 19:16:11.560962+00 |
| 5419 | 1000182 | DISPONIBLE | 100.000 | 1 | 2026-09-14 19:16:11.560962+00 | 2026-09-14 19:16:11.560962+00 |
| 5420 | 1000183 | DISPONIBLE | 100.000 | 1 | 2026-09-14 19:16:11.560962+00 | 2026-09-14 19:16:11.560962+00 |
| 5421 | 1000184 | DISPONIBLE | 100.000 | 1 | 2026-09-14 19:16:11.560962+00 | 2026-09-14 19:16:11.560962+00 |
| 5422 | 1000185 | DISPONIBLE | 100.000 | 1 | 2026-09-14 19:16:11.560962+00 | 2026-09-14 19:16:11.560962+00 |
| 5423 | 1000186 | DISPONIBLE | 100.000 | 1 | 2026-09-14 19:16:11.560962+00 | 2026-09-14 19:16:11.560962+00 |
| 5424 | 1000187 | DISPONIBLE | 100.000 | 1 | 2026-09-14 19:16:11.560962+00 | 2026-09-14 19:16:11.560962+00 |
| 5425 | 1000188 | DISPONIBLE | 100.000 | 1 | 2026-09-14 19:16:11.560962+00 | 2026-09-14 19:16:11.560962+00 |
| 5426 | 1000189 | DISPONIBLE | 100.000 | 1 | 2026-09-14 19:16:11.560962+00 | 2026-09-14 19:16:11.560962+00 |
| 5427 | 1000190 | DISPONIBLE | 100.000 | 1 | 2026-09-14 19:16:11.560962+00 | 2026-09-14 19:16:11.560962+00 |
| 5428 | 1000191 | DISPONIBLE | 100.000 | 1 | 2026-09-14 19:16:11.560962+00 | 2026-09-14 19:16:11.560962+00 |
| 5429 | 1000192 | DISPONIBLE | 100.000 | 1 | 2026-09-14 19:16:11.560962+00 | 2026-09-14 19:16:11.560962+00 |
| 5430 | 1000193 | DISPONIBLE | 100.000 | 1 | 2026-09-14 19:16:11.560962+00 | 2026-09-14 19:16:11.560962+00 |
| 5431 | 1000194 | DISPONIBLE | 100.000 | 1 | 2026-09-14 19:16:11.560962+00 | 2026-09-14 19:16:11.560962+00 |
| 5432 | 1000195 | DISPONIBLE | 100.000 | 1 | 2026-09-14 19:16:11.560962+00 | 2026-09-14 19:16:11.560962+00 |
| 5433 | 1000196 | DISPONIBLE | 100.000 | 1 | 2026-09-14 19:16:11.560962+00 | 2026-09-14 19:16:11.560962+00 |
| 5434 | 1000197 | DISPONIBLE | 100.000 | 1 | 2026-09-14 19:16:11.560962+00 | 2026-09-14 19:16:11.560962+00 |
| 5435 | 1000198 | DISPONIBLE | 100.000 | 1 | 2026-09-14 19:16:11.560962+00 | 2026-09-14 19:16:11.560962+00 |
| 5436 | 1000199 | DISPONIBLE | 100.000 | 1 | 2026-09-14 19:16:11.560962+00 | 2026-09-14 19:16:11.560962+00 |
| 5437 | 1000200 | DISPONIBLE | 100.000 | 1 | 2026-09-14 19:16:11.560962+00 | 2026-09-14 19:16:11.560962+00 |
| 5438 | 1000201 | DISPONIBLE | 100.000 | 1 | 2026-09-14 19:16:11.560962+00 | 2026-09-14 19:16:11.560962+00 |
| 5439 | 1000202 | DISPONIBLE | 100.000 | 1 | 2026-09-14 19:16:11.560962+00 | 2026-09-14 19:16:11.560962+00 |
| 5440 | 1000203 | DISPONIBLE | 100.000 | 1 | 2026-09-14 19:16:11.560962+00 | 2026-09-14 19:16:11.560962+00 |
| 5441 | 1000204 | DISPONIBLE | 100.000 | 1 | 2026-09-14 19:16:11.560962+00 | 2026-09-14 19:16:11.560962+00 |
| 5442 | 1000205 | DISPONIBLE | 100.000 | 1 | 2026-09-14 19:16:11.560962+00 | 2026-09-14 19:16:11.560962+00 |
| 5443 | 1000206 | DISPONIBLE | 100.000 | 1 | 2026-09-14 19:16:11.560962+00 | 2026-09-14 19:16:11.560962+00 |
| 5444 | 1000207 | DISPONIBLE | 100.000 | 1 | 2026-09-14 19:16:11.560962+00 | 2026-09-14 19:16:11.560962+00 |
| 5445 | 1000208 | DISPONIBLE | 100.000 | 1 | 2026-09-14 19:16:11.560962+00 | 2026-09-14 19:16:11.560962+00 |
| 5446 | 1000209 | DISPONIBLE | 100.000 | 1 | 2026-09-14 19:16:11.560962+00 | 2026-09-14 19:16:11.560962+00 |
| 5447 | 1000210 | DISPONIBLE | 100.000 | 1 | 2026-09-14 19:16:11.560962+00 | 2026-09-14 19:16:11.560962+00 |
| 5448 | 1000211 | DISPONIBLE | 100.000 | 1 | 2026-09-14 19:16:11.560962+00 | 2026-09-14 19:16:11.560962+00 |
| 5449 | 1000212 | DISPONIBLE | 100.000 | 1 | 2026-09-14 19:16:11.560962+00 | 2026-09-14 19:16:11.560962+00 |
| 5450 | 1000213 | DISPONIBLE | 100.000 | 1 | 2026-09-14 19:16:11.560962+00 | 2026-09-14 19:16:11.560962+00 |
| 5451 | 1000214 | DISPONIBLE | 100.000 | 1 | 2026-09-14 19:16:11.560962+00 | 2026-09-14 19:16:11.560962+00 |
| 5452 | 1000215 | DISPONIBLE | 100.000 | 1 | 2026-09-14 19:16:11.560962+00 | 2026-09-14 19:16:11.560962+00 |
| 5453 | 1000216 | DISPONIBLE | 100.000 | 1 | 2026-09-14 19:16:11.560962+00 | 2026-09-14 19:16:11.560962+00 |
| 5454 | 1000217 | DISPONIBLE | 100.000 | 1 | 2026-09-14 19:16:11.560962+00 | 2026-09-14 19:16:11.560962+00 |
| 5455 | 1000218 | DISPONIBLE | 100.000 | 1 | 2026-09-14 19:16:11.560962+00 | 2026-09-14 19:16:11.560962+00 |
| 5456 | 1000219 | DISPONIBLE | 100.000 | 1 | 2026-09-14 19:16:11.560962+00 | 2026-09-14 19:16:11.560962+00 |
| 5457 | 1000220 | DISPONIBLE | 100.000 | 1 | 2026-09-14 19:16:11.560962+00 | 2026-09-14 19:16:11.560962+00 |
| 5458 | 1000221 | DISPONIBLE | 100.000 | 1 | 2026-09-14 19:16:11.560962+00 | 2026-09-14 19:16:11.560962+00 |
| 5459 | 1000222 | DISPONIBLE | 100.000 | 1 | 2026-09-14 19:16:11.560962+00 | 2026-09-14 19:16:11.560962+00 |
| 5460 | 1000223 | DISPONIBLE | 100.000 | 1 | 2026-09-14 19:16:11.560962+00 | 2026-09-14 19:16:11.560962+00 |
| 5461 | 1000224 | DISPONIBLE | 100.000 | 1 | 2026-09-14 19:16:11.560962+00 | 2026-09-14 19:16:11.560962+00 |
| 5462 | 1000225 | DISPONIBLE | 100.000 | 1 | 2026-09-14 19:16:11.560962+00 | 2026-09-14 19:16:11.560962+00 |
| 5463 | 1000226 | DISPONIBLE | 100.000 | 1 | 2026-09-14 19:16:11.560962+00 | 2026-09-14 19:16:11.560962+00 |

### Folios de entradas

| Entrada | Folio | Sitio ID | Total rollos | Total costo | Fecha | Creada |
| --- | --- | --- | --- | --- | --- | --- |
| 427 | 1 | 2 | 10 | 25623.00 | 2026-09-13 18:03:59.463+00 | 2026-09-13 18:03:59.454653+00 |
| 432 | 1 | 5 | 150 | 397500.00 | 2026-09-14 19:16:11.649+00 | 2026-09-14 19:16:11.560962+00 |
| 428 | 2 | 2 | 20 | 53541.00 | 2026-09-13 18:14:59.292+00 | 2026-09-13 18:14:59.2892+00 |
| 429 | 3 | 2 | 1 | 2619.00 | 2026-09-13 18:57:19.713+00 | 2026-09-13 18:57:19.70851+00 |
| 430 | 4 | 2 | 25 | 36250.00 | 2026-09-13 19:26:40.269+00 | 2026-09-13 19:26:40.263287+00 |
| 431 | 5 | 2 | 20 | 28000.00 | 2026-09-13 20:54:48.213+00 | 2026-09-13 20:54:48.19082+00 |

### Salidas

| Salida | Folio | Origen ID | Destino ID | Estado | Modalidad | Ticket ID | Creada |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 23 | 1 | 2 | 1 | RECIBIDA | TRASLADO | — | 2026-09-13 21:07:08.421812+00 |
| 24 | 1 | 5 | 3 | ARMANDO | TRASLADO | — | 2026-09-14 19:24:13.490091+00 |

## Freshness contra respaldo verificado

Snapshot verificado: `2026-09-16T03:12:30.012Z`; captura actual: `2026-09-16T03:21:47.562Z`.
- Datos por tabla (conteos/huellas): **MISMATCH**.
- Metadatos semánticos: **MATCH**.
- Estado de secuencias contra respaldo: **MISMATCH**.
- Metadatos de base no volátiles: **MATCH**.
- Tamaño actual de base: `20410851` bytes (respaldo `20410851`; valor volátil).

### Diferencias detectadas

| Comparación | Claves diferentes |
| --- | --- |
| Conteos/huellas | public.auditoria, public.sesiones, public.ubicaciones |
| Metadatos |  |
| Secuencias | public.auditoria_id_seq |
| Base |  |

Detalle de diferencias de conteo/huella:

| Tabla | Count snapshot | Count actual | Hash snapshot | Hash actual |
| --- | --- | --- | --- | --- |
| public.auditoria | 3285 | 3286 | fb9751852842fdd504e3971f21ec1275 | ebfb27fc49b43dbf3eb4082729d84b0d |
| public.sesiones | 11 | 11 | e21ee24fccd9ede3a9db5435697a7ce4 | 4260600c9b1659b48949381ab1a22736 |
| public.ubicaciones | 11 | 11 | ee04978537111648a1e72a1e99366813 | 024961124e5a29d6f6e1c4053687a948 |

Detalle de diferencias de secuencia contra el snapshot:

| Secuencia | Last value snapshot | Last value actual |
| --- | --- | --- |
| public.auditoria_id_seq | 3964 | 3965 |

## Riesgos y aprobaciones siguientes

- **NO AUTHORIZED PURGE / PURGA NO AUTORIZADA:** este preflight no autoriza Bloque 4 ni ninguna mutación.
- Se requiere una autorización textual posterior e independiente del propietario, después de revisar este preflight y sus diferencias de freshness.
- Se requiere decisión explícita para `public.contenedores_folio_seq`: reiniciar el folio de negocio o conservarlo; no se propone valor.
- La purga de `sesiones`/`sesiones_caja` invalidaría las sesiones activas y obligaría a reautenticación; no se reinició API, no se cambió autenticación ni se ejecutó invalidación.
- El hallazgo de seguridad permanece: triggers append-only bloquean DELETE, pero no TRUNCATE para roles privilegiados. Los triggers quedaron intactos.
- `cuadre_fiscal_registros` continúa como deriva viva ausente de Drizzle; no se creó, borró ni modificó.

## Evidencia estructurada

La salida completa de SQL y metadatos está en `reports/prompt-h/block3-preflight-metadata.json`. Los outputs están sanitizados: no contienen nombres de usuarios, credenciales, IDs de sesión ni filas crudas con PII.

