# Disposable reset catalog proof

Status: **PASS**. Actual service called directly; no API server launched, no live DB access.

Service/manifest exactly match active bundle embedded source map; bundle SHA-256: ae72cf8da6832f1a5275a2bdba689508ac1ee69639312a246785cb57fe5b44a7.

Full-row catalog/document equality (customer balance excepted), ordered JSONB phones, effective-clear emptiness, installed-FK orphan scans, trigger modes, counters and independent-connection commit assertions are in evidence.json. Cleanup: {"processGone":true,"clusterDirectoryGone":true,"socketGone":true}.

Fixture uses canonical isolated-test SQL patterns, not native creation HTTP flows. Mixed E11 business/profile rows are not seeded in this focused proof. No browser/UI verification is applicable.

## PRESERVED_TABLES
Present: usuarios, permisos_rol, permisos_usuario, permisos_ubicacion, ubicaciones, pisos, productos, proveedores, camionetas, choferes, equipos, stock_minimo_sitios, stock_minimos, fondo_mariana, e11_perfiles, e11_perfil_eventos, e11_cambios_usuario, e5_ddl_originales, e11_e5_definiciones.

Declared optional absent: test_reset_history.

## CLEARED_TABLES
Present: aplicaciones_credito, aplicaciones_pago_proveedor, atribuciones_credito_e1, auditoria, auditoria_faltante_reactivaciones, auditoria_inventario_escaneos, auditoria_inventario_participantes, auditoria_inventario_snapshot, auditoria_sobrante_contextos, auditoria_sobrante_decisiones, auditorias_inventario, autorizaciones_nota, cliente_documentos, cobros_credito_pendientes_e1, contenedor_lineas, contenedores, cuadre_fiscal_registros, entradas, equipos_checklist, existencias, fondo_arqueos, fondo_movimientos, movimientos, movimientos_credito, notificaciones_credito, notificaciones_sistema, operaciones_credito_e1, pagos_proveedor, precio_historial, reimpresiones_etiqueta, revisiones_etiqueta, rollos, salida_lineas, salida_rollos, salidas, salidas_dinero_caja, sesiones, sesiones_caja, sesiones_caja_dias, solicitudes_pago_dirigido, stock_minimo_episodios, ticket_linea_consumos, ticket_lineas, ticket_pagos, tickets, viaje_salidas, viaje_tickets, viajes, vistas_abono_e3, recibos_abono_e3, finalizaciones_abono_e2, evidencia_no_aplicada_e2, e5_recepciones, e5_cobros, e5_aplicaciones, e5_vinculos_credito, e5_salidas_bancarias, e5_devoluciones, e5_documentos, e5_operaciones, e5_impresiones, e5_nacimientos, e9_entregas, e9_operaciones, e11_conciliaciones, e11_conciliacion_ventas, e11_decisiones, e11_avisos, e11_notificacion_origen, e11_e5_preparaciones, caja_desbloqueos_e12, caja_retornos_proveedor_e12, caja_salidas_e4, caja_salidas_e4_operaciones, proveedor_efectivo_e12, proveedor_operaciones_e12, proveedor_solicitudes_e12, tarea4_rollo_remate.

Declared optional absent: disposiciones_credito_e2, devoluciones_credito_e2.

## COUNTER_TABLES
Present: ticket_folio, entrada_folio, salida_folio, viaje_folio, auditoria_inventario_folio, recibo_folio_e3, series_consecutivo.

Declared optional absent: (none).

## MIXED_TABLES
Present: clientes, e11_operaciones, e11_resoluciones.

Declared optional absent: (none).

## Effective clear
aplicaciones_credito, aplicaciones_pago_proveedor, atribuciones_credito_e1, auditoria, auditoria_faltante_reactivaciones, auditoria_inventario_escaneos, auditoria_inventario_participantes, auditoria_inventario_snapshot, auditoria_sobrante_contextos, auditoria_sobrante_decisiones, auditorias_inventario, autorizaciones_nota, cobros_credito_pendientes_e1, contenedor_lineas, contenedores, cuadre_fiscal_registros, entradas, equipos_checklist, existencias, fondo_arqueos, fondo_movimientos, movimientos, movimientos_credito, notificaciones_credito, notificaciones_sistema, operaciones_credito_e1, pagos_proveedor, precio_historial, reimpresiones_etiqueta, revisiones_etiqueta, rollos, salida_lineas, salida_rollos, salidas, salidas_dinero_caja, sesiones, sesiones_caja, sesiones_caja_dias, solicitudes_pago_dirigido, stock_minimo_episodios, ticket_linea_consumos, ticket_lineas, ticket_pagos, tickets, viaje_salidas, viaje_tickets, viajes, vistas_abono_e3, recibos_abono_e3, finalizaciones_abono_e2, evidencia_no_aplicada_e2, e5_recepciones, e5_cobros, e5_aplicaciones, e5_vinculos_credito, e5_salidas_bancarias, e5_devoluciones, e5_documentos, e5_operaciones, e5_impresiones, e5_nacimientos, e9_entregas, e9_operaciones, e11_conciliaciones, e11_conciliacion_ventas, e11_decisiones, e11_avisos, e11_notificacion_origen, e11_e5_preparaciones, caja_desbloqueos_e12, caja_retornos_proveedor_e12, caja_salidas_e4, caja_salidas_e4_operaciones, proveedor_efectivo_e12, proveedor_operaciones_e12, proveedor_solicitudes_e12, tarea4_rollo_remate

## Mixed rules
Customers retained except saldo_credito=0; E11 operations/resolutions retain PERFIL only. cliente_documentos is declared cleared but effectively preserved with PROTECT_CUSTOMERS=true. History is append-only. Counters: folios 0, series 10000000.
