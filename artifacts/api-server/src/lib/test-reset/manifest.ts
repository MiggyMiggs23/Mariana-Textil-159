/**
 * TEMPORARY, owner-authorized TEST DATA exception. Remove this directory,
 * route and request barrier when the owner starts real operation.
 * CLOSED until deployment deliberately enables this single feature flag.
 */
export const TEST_RESET_ENABLED = false;
// ONE-LINE SWITCH: set true BEFORE importing the owner's real customer list.
export const PROTECT_CUSTOMERS = false;
export const RESET_CONFIRMATION = "BORRAR";
export const RESET_MESSAGE = "Datos de prueba borrados. Todas las sesiones se cerraron. Vuelve a iniciar sesión.";

export const PRESERVED_TABLES = [
  "usuarios", "permisos_rol", "permisos_usuario", "permisos_ubicacion",
  "ubicaciones", "pisos", "productos", "proveedores", "camionetas", "choferes",
  "equipos", "stock_minimo_sitios", "stock_minimos",
  // Fund identity/site is configuration; balance is entirely derived from its wiped ledger.
  "fondo_mariana", "e11_perfiles", "e11_perfil_eventos", "e11_cambios_usuario",
  "e5_ddl_originales", "e11_e5_definiciones", "test_reset_history",
] as const;

export const CLEARED_TABLES = [
  "aplicaciones_credito", "aplicaciones_pago_proveedor", "atribuciones_credito_e1",
  "auditoria", "auditoria_faltante_reactivaciones", "auditoria_inventario_escaneos",
  "auditoria_inventario_participantes", "auditoria_inventario_snapshot",
  "auditoria_sobrante_contextos", "auditoria_sobrante_decisiones", "auditorias_inventario",
  "autorizaciones_nota", "cliente_documentos", "cobros_credito_pendientes_e1",
  "contenedor_lineas", "contenedores", "cuadre_fiscal_registros", "entradas",
  "equipos_checklist", "existencias", "fondo_arqueos", "fondo_movimientos",
  "movimientos", "movimientos_credito", "notificaciones_credito", "notificaciones_sistema",
  "operaciones_credito_e1", "pagos_proveedor", "precio_historial",
  "reimpresiones_etiqueta", "revisiones_etiqueta", "rollos", "salida_lineas",
  "salida_rollos", "salidas", "salidas_dinero_caja", "sesiones", "sesiones_caja",
  "sesiones_caja_dias", "solicitudes_pago_dirigido", "stock_minimo_episodios",
  "ticket_linea_consumos", "ticket_lineas", "ticket_pagos", "tickets",
  "viaje_salidas", "viaje_tickets", "viajes",
  "vistas_abono_e3", "recibos_abono_e3", "disposiciones_credito_e2", "devoluciones_credito_e2",
  "finalizaciones_abono_e2", "evidencia_no_aplicada_e2",
  "e5_recepciones", "e5_cobros", "e5_aplicaciones", "e5_vinculos_credito",
  "e5_salidas_bancarias", "e5_devoluciones", "e5_documentos", "e5_operaciones",
  "e5_impresiones", "e5_nacimientos", "e9_entregas", "e9_operaciones",
  "e11_conciliaciones", "e11_conciliacion_ventas", "e11_decisiones", "e11_avisos",
  "e11_notificacion_origen", "e11_e5_preparaciones",
  // Installed E4/E12 cash/provider movement evidence and per-roll sale markers.
  "caja_desbloqueos_e12", "caja_retornos_proveedor_e12", "caja_salidas_e4",
  "caja_salidas_e4_operaciones", "proveedor_efectivo_e12", "proveedor_operaciones_e12",
  "proveedor_solicitudes_e12", "tarea4_rollo_remate",
] as const;

export const COUNTER_TABLES = [
  "ticket_folio", "entrada_folio", "salida_folio", "viaje_folio",
  "auditoria_inventario_folio", "recibo_folio_e3", "series_consecutivo",
] as const;
// E11 contains configuration and business idempotency in the same tables:
// retain PERFIL operations/resolutions, delete ONLY the approved business rows.
export const MIXED_TABLES = ["clientes", "e11_operaciones", "e11_resoluciones"] as const;
export const REQUIRED_TABLES = [
  "usuarios", "ubicaciones", "clientes", "productos", "proveedores", "sesiones",
  "rollos", "tickets", "movimientos_credito", "ticket_folio", "series_consecutivo",
] as const;