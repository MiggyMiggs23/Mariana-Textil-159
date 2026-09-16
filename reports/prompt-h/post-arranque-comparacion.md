# Prompt H — comparación post-arranque (solo lectura)

- **Estado:** PASS_READ_ONLY_POST_START_CAPTURE; **comparación:** POST_START_VALUE_DRIFT_REPORTED_NO_REPAIR
- **Fuente:** `heliumdb/public`; transacción `REPEATABLE READ READ ONLY`; writes ejecutados: `false`.
- **API/frontend:** API reiniciada una vez por MAIN antes de esta captura y frontend reiniciado para el servicio limpio; este proceso no reinició API, no autenticó, no creó sesiones, no ejecutó seeds ni inicializadores.
- **Baseline inmutable:** `.local/prompt-h-authorized-purge-status.json`; status `COMMITTED_POSTCOMMIT_READ_PASS`; SHA-256 de lectura `8615138f458daba22096a47bc21f47fbb4ffc3382c146a3bd90c10e6bd20a641`.

## Resultado

| Área | Resultado |
|---|---|
| Todas las 60 tablas (conteo + hash canónico completo) | DIFFERENT |
| A=35 vacías | DIFFERENT |
| B=7 objetivos | MATCH_OBJECTIVES |
| C=18 hash/conteo exactos | DIFFERENT_EXACT_TABLES_LISTED |
| 45 secuencias | DIFFERENT |
| 14 triggers enabled/definición | MATCH |
| Caché/movimientos/rollos | MATCH |

## C — 18 tablas, antes vs después

| Tabla | Count baseline | Count post-arranque | Hash baseline | Hash post-arranque | Estado |
|---|---:|---:|---|---|---|
| `auditoria` | 3286 | 3286 | `ebfb27fc49b43dbf3eb4082729d84b0d` | `ebfb27fc49b43dbf3eb4082729d84b0d` | MATCH |
| `camionetas` | 0 | 0 | `d41d8cd98f00b204e9800998ecf8427e` | `d41d8cd98f00b204e9800998ecf8427e` | MATCH |
| `choferes` | 0 | 0 | `d41d8cd98f00b204e9800998ecf8427e` | `d41d8cd98f00b204e9800998ecf8427e` | MATCH |
| `cliente_documentos` | 0 | 0 | `d41d8cd98f00b204e9800998ecf8427e` | `d41d8cd98f00b204e9800998ecf8427e` | MATCH |
| `clientes` | 7 | 7 | `57547451eec364bf428e41924ded0b49` | `57547451eec364bf428e41924ded0b49` | MATCH |
| `equipos` | 0 | 0 | `d41d8cd98f00b204e9800998ecf8427e` | `d41d8cd98f00b204e9800998ecf8427e` | MATCH |
| `equipos_checklist` | 0 | 0 | `d41d8cd98f00b204e9800998ecf8427e` | `d41d8cd98f00b204e9800998ecf8427e` | MATCH |
| `permisos_rol` | 192 | 192 | `4d18bc7f2e1076313bc0ed9cddfffe88` | `bd230a3eae3bea46826293b828240ca2` | DIFFERENT |
| `permisos_ubicacion` | 54 | 54 | `bc5e55897a9b7e834766d59550c35db1` | `5ce4162b4e1c7c6b9d0e8e1dd5b5473b` | DIFFERENT |
| `permisos_usuario` | 0 | 0 | `d41d8cd98f00b204e9800998ecf8427e` | `d41d8cd98f00b204e9800998ecf8427e` | MATCH |
| `pisos` | 0 | 0 | `d41d8cd98f00b204e9800998ecf8427e` | `d41d8cd98f00b204e9800998ecf8427e` | MATCH |
| `precio_historial` | 1016 | 1016 | `64f5ec3242e70cdfe37e1a242c26b506` | `64f5ec3242e70cdfe37e1a242c26b506` | MATCH |
| `productos` | 1234 | 1234 | `9b5a7bfb4133c1c700f9d242628c0c46` | `9b5a7bfb4133c1c700f9d242628c0c46` | MATCH |
| `proveedores` | 27 | 27 | `4a0020d06fb591411ff067f4140e5994` | `4a0020d06fb591411ff067f4140e5994` | MATCH |
| `stock_minimo_sitios` | 1 | 1 | `17a13e555dc56c6b9871558bd51ba05c` | `17a13e555dc56c6b9871558bd51ba05c` | MATCH |
| `stock_minimos` | 3 | 3 | `60b15edc65d0fa3cbaf651c9427fc0ae` | `60b15edc65d0fa3cbaf651c9427fc0ae` | MATCH |
| `ubicaciones` | 11 | 11 | `024961124e5a29d6f6e1c4053687a948` | `024961124e5a29d6f6e1c4053687a948` | MATCH |
| `usuarios` | 31 | 31 | `658b6ca14c31aa1a9eaf3fdeede703f1` | `658b6ca14c31aa1a9eaf3fdeede703f1` | MATCH |

Tablas C cambiadas exactamente: `permisos_rol`, `permisos_ubicacion`. No se ignoraron timestamps ni se repararon datos; no se clasifica como timestamp-only sin prueba de columnas.

## A — 35 conteos/hash

| Tabla | Count baseline | Count actual | Hash baseline | Hash actual | Estado |
|---|---:|---:|---|---|---|
| `aplicaciones_credito` | 0 | 0 | `d41d8cd98f00b204e9800998ecf8427e` | `d41d8cd98f00b204e9800998ecf8427e` | MATCH |
| `aplicaciones_pago_proveedor` | 0 | 0 | `d41d8cd98f00b204e9800998ecf8427e` | `d41d8cd98f00b204e9800998ecf8427e` | MATCH |
| `auditoria_inventario_escaneos` | 0 | 0 | `d41d8cd98f00b204e9800998ecf8427e` | `d41d8cd98f00b204e9800998ecf8427e` | MATCH |
| `auditoria_inventario_participantes` | 0 | 0 | `d41d8cd98f00b204e9800998ecf8427e` | `d41d8cd98f00b204e9800998ecf8427e` | MATCH |
| `auditoria_inventario_snapshot` | 0 | 0 | `d41d8cd98f00b204e9800998ecf8427e` | `d41d8cd98f00b204e9800998ecf8427e` | MATCH |
| `auditorias_inventario` | 0 | 0 | `d41d8cd98f00b204e9800998ecf8427e` | `d41d8cd98f00b204e9800998ecf8427e` | MATCH |
| `autorizaciones_nota` | 0 | 0 | `d41d8cd98f00b204e9800998ecf8427e` | `d41d8cd98f00b204e9800998ecf8427e` | MATCH |
| `contenedor_lineas` | 0 | 0 | `d41d8cd98f00b204e9800998ecf8427e` | `d41d8cd98f00b204e9800998ecf8427e` | MATCH |
| `contenedores` | 0 | 0 | `d41d8cd98f00b204e9800998ecf8427e` | `d41d8cd98f00b204e9800998ecf8427e` | MATCH |
| `cuadre_fiscal_registros` | 0 | 0 | `d41d8cd98f00b204e9800998ecf8427e` | `d41d8cd98f00b204e9800998ecf8427e` | MATCH |
| `entradas` | 0 | 0 | `d41d8cd98f00b204e9800998ecf8427e` | `d41d8cd98f00b204e9800998ecf8427e` | MATCH |
| `movimientos` | 0 | 0 | `d41d8cd98f00b204e9800998ecf8427e` | `d41d8cd98f00b204e9800998ecf8427e` | MATCH |
| `movimientos_credito` | 0 | 0 | `d41d8cd98f00b204e9800998ecf8427e` | `d41d8cd98f00b204e9800998ecf8427e` | MATCH |
| `notificaciones_credito` | 0 | 0 | `d41d8cd98f00b204e9800998ecf8427e` | `d41d8cd98f00b204e9800998ecf8427e` | MATCH |
| `notificaciones_sistema` | 0 | 12 | `d41d8cd98f00b204e9800998ecf8427e` | `24c477404df84bb09ec8c376c2c7e38f` | DIFFERENT |
| `pagos_proveedor` | 0 | 0 | `d41d8cd98f00b204e9800998ecf8427e` | `d41d8cd98f00b204e9800998ecf8427e` | MATCH |
| `reimpresiones_etiqueta` | 0 | 0 | `d41d8cd98f00b204e9800998ecf8427e` | `d41d8cd98f00b204e9800998ecf8427e` | MATCH |
| `revisiones_etiqueta` | 0 | 0 | `d41d8cd98f00b204e9800998ecf8427e` | `d41d8cd98f00b204e9800998ecf8427e` | MATCH |
| `rollos` | 0 | 0 | `d41d8cd98f00b204e9800998ecf8427e` | `d41d8cd98f00b204e9800998ecf8427e` | MATCH |
| `salida_lineas` | 0 | 0 | `d41d8cd98f00b204e9800998ecf8427e` | `d41d8cd98f00b204e9800998ecf8427e` | MATCH |
| `salida_rollos` | 0 | 0 | `d41d8cd98f00b204e9800998ecf8427e` | `d41d8cd98f00b204e9800998ecf8427e` | MATCH |
| `salidas` | 0 | 0 | `d41d8cd98f00b204e9800998ecf8427e` | `d41d8cd98f00b204e9800998ecf8427e` | MATCH |
| `salidas_dinero_caja` | 0 | 0 | `d41d8cd98f00b204e9800998ecf8427e` | `d41d8cd98f00b204e9800998ecf8427e` | MATCH |
| `sesiones` | 0 | 0 | `d41d8cd98f00b204e9800998ecf8427e` | `d41d8cd98f00b204e9800998ecf8427e` | MATCH |
| `sesiones_caja` | 0 | 0 | `d41d8cd98f00b204e9800998ecf8427e` | `d41d8cd98f00b204e9800998ecf8427e` | MATCH |
| `sesiones_caja_dias` | 0 | 0 | `d41d8cd98f00b204e9800998ecf8427e` | `d41d8cd98f00b204e9800998ecf8427e` | MATCH |
| `solicitudes_pago_dirigido` | 0 | 0 | `d41d8cd98f00b204e9800998ecf8427e` | `d41d8cd98f00b204e9800998ecf8427e` | MATCH |
| `stock_minimo_episodios` | 0 | 3 | `d41d8cd98f00b204e9800998ecf8427e` | `ee466b3b81125f83760eacd3addc2dd4` | DIFFERENT |
| `ticket_linea_consumos` | 0 | 0 | `d41d8cd98f00b204e9800998ecf8427e` | `d41d8cd98f00b204e9800998ecf8427e` | MATCH |
| `ticket_lineas` | 0 | 0 | `d41d8cd98f00b204e9800998ecf8427e` | `d41d8cd98f00b204e9800998ecf8427e` | MATCH |
| `ticket_pagos` | 0 | 0 | `d41d8cd98f00b204e9800998ecf8427e` | `d41d8cd98f00b204e9800998ecf8427e` | MATCH |
| `tickets` | 0 | 0 | `d41d8cd98f00b204e9800998ecf8427e` | `d41d8cd98f00b204e9800998ecf8427e` | MATCH |
| `viaje_salidas` | 0 | 0 | `d41d8cd98f00b204e9800998ecf8427e` | `d41d8cd98f00b204e9800998ecf8427e` | MATCH |
| `viaje_tickets` | 0 | 0 | `d41d8cd98f00b204e9800998ecf8427e` | `d41d8cd98f00b204e9800998ecf8427e` | MATCH |
| `viajes` | 0 | 0 | `d41d8cd98f00b204e9800998ecf8427e` | `d41d8cd98f00b204e9800998ecf8427e` | MATCH |

## B — seis objetivos

| Tabla | Row key | Objetivo | Actual | Estado |
|---|---|---:|---:|---|
| `auditoria_inventario_folio` | `1` | 0 | 0 | MATCH |
| `auditoria_inventario_folio` | `2` | 0 | 0 | MATCH |
| `auditoria_inventario_folio` | `3` | 0 | 0 | MATCH |
| `auditoria_inventario_folio` | `4` | 0 | 0 | MATCH |
| `auditoria_inventario_folio` | `5` | 0 | 0 | MATCH |
| `auditoria_inventario_folio` | `6` | 0 | 0 | MATCH |
| `auditoria_inventario_folio` | `7` | 0 | 0 | MATCH |
| `auditoria_inventario_folio` | `8` | 0 | 0 | MATCH |
| `auditoria_inventario_folio` | `9` | 0 | 0 | MATCH |
| `auditoria_inventario_folio` | `458` | 0 | 0 | MATCH |
| `auditoria_inventario_folio` | `531` | 0 | 0 | MATCH |
| `entrada_folio` | `1` | 0 | 0 | MATCH |
| `entrada_folio` | `2` | 0 | 0 | MATCH |
| `entrada_folio` | `3` | 0 | 0 | MATCH |
| `entrada_folio` | `4` | 0 | 0 | MATCH |
| `entrada_folio` | `5` | 0 | 0 | MATCH |
| `entrada_folio` | `6` | 0 | 0 | MATCH |
| `entrada_folio` | `7` | 0 | 0 | MATCH |
| `entrada_folio` | `8` | 0 | 0 | MATCH |
| `entrada_folio` | `9` | 0 | 0 | MATCH |
| `entrada_folio` | `458` | 0 | 0 | MATCH |
| `entrada_folio` | `531` | 0 | 0 | MATCH |
| `salida_folio` | `1` | 0 | 0 | MATCH |
| `salida_folio` | `2` | 0 | 0 | MATCH |
| `salida_folio` | `3` | 0 | 0 | MATCH |
| `salida_folio` | `4` | 0 | 0 | MATCH |
| `salida_folio` | `5` | 0 | 0 | MATCH |
| `salida_folio` | `6` | 0 | 0 | MATCH |
| `salida_folio` | `7` | 0 | 0 | MATCH |
| `salida_folio` | `8` | 0 | 0 | MATCH |
| `salida_folio` | `9` | 0 | 0 | MATCH |
| `salida_folio` | `458` | 0 | 0 | MATCH |
| `salida_folio` | `531` | 0 | 0 | MATCH |
| `viaje_folio` | `1` | 0 | 0 | MATCH |
| `viaje_folio` | `2` | 0 | 0 | MATCH |
| `viaje_folio` | `3` | 0 | 0 | MATCH |
| `viaje_folio` | `4` | 0 | 0 | MATCH |
| `viaje_folio` | `5` | 0 | 0 | MATCH |
| `viaje_folio` | `6` | 0 | 0 | MATCH |
| `viaje_folio` | `7` | 0 | 0 | MATCH |
| `viaje_folio` | `8` | 0 | 0 | MATCH |
| `viaje_folio` | `9` | 0 | 0 | MATCH |
| `viaje_folio` | `458` | 0 | 0 | MATCH |
| `viaje_folio` | `531` | 0 | 0 | MATCH |
| `ticket_folio` | `1` | 999 | 999 | MATCH |
| `series_consecutivo` | `1` | 1000000 | 1000000 | MATCH |

## Secuencias — 45 valores

| Secuencia | Antes | Después | Cambió |
|---|---:|---:|---|
| `public.aplicaciones_credito_id_seq` | 6 | 6 | NO |
| `public.aplicaciones_pago_proveedor_id_seq` | 18 | 18 | NO |
| `public.auditoria_id_seq` | 3965 | 3965 | NO |
| `public.auditorias_inventario_id_seq` | null | null | NO |
| `public.autorizaciones_nota_id_seq` | 6 | 6 | NO |
| `public.camionetas_id_seq` | null | null | NO |
| `public.choferes_id_seq` | null | null | NO |
| `public.cliente_documentos_id_seq` | 4 | 4 | NO |
| `public.clientes_id_seq` | 7 | 7 | NO |
| `public.contenedor_lineas_id_seq` | 2 | 2 | NO |
| `public.contenedores_folio_seq` | null | null | NO |
| `public.contenedores_id_seq` | 2 | 2 | NO |
| `public.cuadre_fiscal_registros_id_seq` | null | null | NO |
| `public.entradas_id_seq` | 432 | 432 | NO |
| `public.equipos_id_seq` | null | null | NO |
| `public.movimientos_credito_id_seq` | 50 | 50 | NO |
| `public.movimientos_id_seq` | 6522 | 6522 | NO |
| `public.notificaciones_credito_id_seq` | 8 | 8 | NO |
| `public.notificaciones_sistema_id_seq` | 28 | 40 | YES |
| `public.pagos_proveedor_id_seq` | 450 | 450 | NO |
| `public.permisos_rol_id_seq` | 29041 | 29128 | YES |
| `public.permisos_ubicacion_id_seq` | 6750 | 6804 | YES |
| `public.permisos_usuario_id_seq` | 125 | 125 | NO |
| `public.pisos_id_seq` | null | null | NO |
| `public.precio_historial_id_seq` | 1016 | 1016 | NO |
| `public.productos_id_seq` | 2077 | 2077 | NO |
| `public.proveedores_id_seq` | 225 | 225 | NO |
| `public.reimpresiones_etiqueta_id_seq` | 170 | 170 | NO |
| `public.revisiones_etiqueta_id_seq` | 31 | 31 | NO |
| `public.rollos_id_seq` | 5463 | 5463 | NO |
| `public.salida_lineas_id_seq` | 26 | 26 | NO |
| `public.salida_rollos_id_seq` | 113 | 113 | NO |
| `public.salidas_dinero_caja_id_seq` | null | null | NO |
| `public.salidas_id_seq` | 24 | 24 | NO |
| `public.sesiones_caja_id_seq` | 42 | 42 | NO |
| `public.solicitudes_pago_dirigido_id_seq` | 1 | 1 | NO |
| `public.stock_minimo_episodios_id_seq` | 7 | 10 | YES |
| `public.stock_minimos_id_seq` | 3 | 3 | NO |
| `public.ticket_linea_consumos_id_seq` | 20 | 20 | NO |
| `public.ticket_lineas_id_seq` | 353 | 353 | NO |
| `public.ticket_pagos_id_seq` | 89 | 89 | NO |
| `public.tickets_id_seq` | 105 | 105 | NO |
| `public.ubicaciones_id_seq` | 834 | 834 | NO |
| `public.usuarios_id_seq` | 233 | 233 | NO |
| `public.viajes_id_seq` | null | null | NO |

## Triggers y esquema

Triggers baseline/actual: 14/14; estado y definición exactos: **MATCH**; estados aceptados exactamente como capturados: O/A.

| Trigger | Estado actual | Definición |
|---|---|---|
| `public.aplicaciones_credito.aplicaciones_credito_inmutables` | `O` | CREATE TRIGGER aplicaciones_credito_inmutables BEFORE DELETE OR UPDATE ON aplicaciones_credito FOR EACH ROW EXECUTE FUNCTION prevent_financial_record_mutation() |
| `public.aplicaciones_credito.aplicaciones_credito_validas` | `O` | CREATE TRIGGER aplicaciones_credito_validas BEFORE INSERT ON aplicaciones_credito FOR EACH ROW EXECUTE FUNCTION validate_credit_application() |
| `public.aplicaciones_pago_proveedor.aplicaciones_pago_proveedor_append_only` | `O` | CREATE TRIGGER aplicaciones_pago_proveedor_append_only BEFORE DELETE OR UPDATE ON aplicaciones_pago_proveedor FOR EACH ROW EXECUTE FUNCTION proteger_aplicaciones_pago_proveedor() |
| `public.aplicaciones_pago_proveedor.aplicaciones_pago_proveedor_validar_insert` | `O` | CREATE TRIGGER aplicaciones_pago_proveedor_validar_insert BEFORE INSERT ON aplicaciones_pago_proveedor FOR EACH ROW EXECUTE FUNCTION validar_aplicacion_pago_proveedor() |
| `public.auditoria.auditoria_append_only` | `O` | CREATE TRIGGER auditoria_append_only BEFORE DELETE OR UPDATE ON auditoria FOR EACH ROW EXECUTE FUNCTION proteger_auditoria_append_only() |
| `public.auditoria.auditoria_enriquecer_insert` | `O` | CREATE TRIGGER auditoria_enriquecer_insert BEFORE INSERT ON auditoria FOR EACH ROW EXECUTE FUNCTION enriquecer_auditoria() |
| `public.movimientos_credito.movimientos_credito_inmutables` | `O` | CREATE TRIGGER movimientos_credito_inmutables BEFORE DELETE OR UPDATE ON movimientos_credito FOR EACH ROW EXECUTE FUNCTION prevent_financial_record_mutation() |
| `public.movimientos_credito.movimientos_credito_reversos_validos` | `O` | CREATE TRIGGER movimientos_credito_reversos_validos BEFORE INSERT ON movimientos_credito FOR EACH ROW EXECUTE FUNCTION validate_credit_reversal() |
| `public.pagos_proveedor.pagos_proveedor_inmutables` | `O` | CREATE TRIGGER pagos_proveedor_inmutables BEFORE DELETE OR UPDATE ON pagos_proveedor FOR EACH ROW EXECUTE FUNCTION prevent_pago_proveedor_mutation() |
| `public.reimpresiones_etiqueta.reimpresiones_etiqueta_inmutable` | `O` | CREATE TRIGGER reimpresiones_etiqueta_inmutable BEFORE DELETE OR UPDATE ON reimpresiones_etiqueta FOR EACH ROW EXECUTE FUNCTION bloquear_mutacion_reimpresion_etiqueta() |
| `public.revisiones_etiqueta.revisiones_etiqueta_inmutable` | `O` | CREATE TRIGGER revisiones_etiqueta_inmutable BEFORE DELETE OR UPDATE ON revisiones_etiqueta FOR EACH ROW EXECUTE FUNCTION bloquear_mutacion_revision_etiqueta() |
| `public.revisiones_etiqueta.revisiones_etiqueta_reimpresion_fk_check` | `O` | CREATE TRIGGER revisiones_etiqueta_reimpresion_fk_check BEFORE INSERT OR UPDATE ON revisiones_etiqueta FOR EACH ROW EXECUTE FUNCTION validar_revision_etiqueta_reimpresion() |
| `public.ticket_linea_consumos.ticket_linea_consumos_append_only` | `A` | CREATE TRIGGER ticket_linea_consumos_append_only BEFORE INSERT OR DELETE OR UPDATE ON ticket_linea_consumos FOR EACH ROW EXECUTE FUNCTION ticket_linea_consumos_guard() |
| `public.ticket_pagos.ticket_pagos_inmutables` | `O` | CREATE TRIGGER ticket_pagos_inmutables BEFORE DELETE OR UPDATE ON ticket_pagos FOR EACH ROW EXECUTE FUNCTION prevent_financial_record_mutation() |

- tables: **MATCH** (60/60)
- columns: **MATCH** (604/604)
- constraints: **MATCH** (286/286)
- indexes: **MATCH** (218/218)
- functions: **MATCH** (49/49)
- triggers: **MATCH** (14/14)
- sequences: **MATCH** (45/45)

## Caché

- Baseline: `{"badPairs":0,"existencias_rows":37,"movimientos_rows":0,"rollos_rows":0}`
- Post-arranque: `{"badPairs":0,"existencias_rows":37,"movimientos_rows":0,"rollos_rows":0}`
- Pares inconsistentes: 0; movimientos: 0; rollos: 0; existencias: 37.

No se hizo rollback de datos, reset de secuencias, reparación ni limpieza del restore desechable.

## C — delta exacto de columnas contra restore pristine

Comparación adicional solo lectura contra
`restore_disposable_20260915214248-7517` por el socket Unix
`/tmp/prompt-h-block2-20260915214248-7517-7517`, en `REPEATABLE READ READ ONLY`.
No se escribieron valores de permisos ni filas crudas. La clave primaria
confirmada para ambas tablas fue `id`. Los hashes del restore coinciden con el
baseline aprobado de preflight y con `source-snapshot.json`; los hashes fuente
coinciden con la captura post-arranque anterior, por lo que no hubo drift
adicional antes de inferir.

| Tabla | Filas iguales | Filas cambiadas | Columnas cambiadas (conteo de filas) | Columnas business cambiadas | Veredicto |
|---|---:|---:|---|---|---|
| `permisos_rol` | 120 | 72 | `updated_at` (72) | Ninguna | **TIMESTAMP_ONLY_PROVEN** |
| `permisos_ubicacion` | 0 | 54 | `updated_at` (54) | Ninguna | **TIMESTAMP_ONLY_PROVEN** |

No se observó cambio de columnas de negocio/permiso: el delta completo de
ambas tablas está probado como `updated_at` únicamente. No se reparó, limpió,
purgo ni reinició ninguna base de datos; los avances de secuencia reportados
previamente permanecen sin alterar.
