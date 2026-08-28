import { pgEnum } from "drizzle-orm/pg-core";

export const tipoUbicacionEnum = pgEnum("tipo_ubicacion", [
  "TIENDA",
  "BODEGA",
  "TRANSITO",
  "EXTERNO",
]);

export const rolUsuarioEnum = pgEnum("rol_usuario", [
  "ADMIN",
  "TERMINAL",
  "CAJA",
  "SUPERVISOR",
  "BODEGA",
  "SISTEMAS",
  "CONTADOR",
]);

export const unidadProductoEnum = pgEnum("unidad_producto", ["METRO", "KILO"]);
export const precioModoEnum = pgEnum("precio_modo", ["ROLLO", "MAYOREO", "MENUDEO"]);

export const tipoProveedorEnum = pgEnum("tipo_proveedor", [
  "NACIONAL",
  "IMPORTACION",
]);

export const monedaEnum = pgEnum("moneda", ["MXN", "USD"]);

/**
 * Life-cycle states for a physical roll.
 * PROGRAMADO  – ordered / not yet received physically
 * DISPONIBLE  – in stock, available for sale
 * EN_TRANSITO – in transit between locations (occupied transit slot)
 * MOSTRADOR   – removed completely from inventory (terminal)
 * VENDIDO     – sold to a customer
 * BAJA        – written off / scrapped
 */
export const estadoRolloEnum = pgEnum("estado_rollo", [
  "PROGRAMADO",
  "DISPONIBLE",
  "EN_TRANSITO",
  "MOSTRADOR",
  "VENDIDO",
  "BAJA",
]);

/**
 * Movement types for the inventory ledger.
 * ALTA                – first entry when a DISPONIBLE roll is created
 * RECEPCION           – physical receipt (activating a PROGRAMADO roll)
 * VENTA               – sold to customer (DISPONIBLE → VENDIDO)
 * DEVOLUCION          – return from customer
 * TRANSFERENCIA_SALIDA  – leaving origin (DISPONIBLE → EN_TRANSITO)
 * TRANSFERENCIA_ENTRADA – arriving at destination (EN_TRANSITO → DISPONIBLE)
 * SALIDA_MOSTRADOR    – removed from inventory (DISPONIBLE → MOSTRADOR, terminal)
 * AJUSTE_POSITIVO     – inventory count found more than recorded
 * AJUSTE_NEGATIVO     – inventory count found less than recorded
 * CANCELACION         – reversal of another movement
 */
export const tipoMovimientoEnum = pgEnum("tipo_movimiento", [
  "ALTA",
  "RECEPCION",
  "VENTA",
  "DEVOLUCION",
  "TRANSFERENCIA_SALIDA",
  "TRANSFERENCIA_ENTRADA",
  "SALIDA_MOSTRADOR",
  "AJUSTE_POSITIVO",
  "AJUSTE_NEGATIVO",
  "CANCELACION",
]);

export const tipoTicketEnum = pgEnum("tipo_ticket", ["NORMAL", "METREADO"]);

export const estadoTicketEnum = pgEnum("estado_ticket", [
  "VENDIDO",
  "CANCELADO",
]);

export const formaPagoTicketEnum = pgEnum("forma_pago_ticket", [
  "EFECTIVO",
  "TRANSFERENCIA",
  "CREDITO",
]);

export const estadoSesionCajaEnum = pgEnum("estado_sesion_caja", [
  "ABIERTA",
  "CERRADA",
]);

/** Workflow states for an inter-location inventory exit. */
export const estadoSalidaEnum = pgEnum("estado_salida", [
  "ARMANDO",
  "EN_TRANSITO",
  "RECIBIDA",
  "CANCELADA",
]);

export const tipoMovimientoCreditoEnum = pgEnum("tipo_movimiento_credito", [
  "VENTA_CREDITO",
  "ABONO",
  "REVERSO",
  "AJUSTE",
]);

export const alcanceConsultaEnum = pgEnum("alcance_consulta", [
  "PROPIA",
  "TODAS",
]);

export type TipoUbicacion = (typeof tipoUbicacionEnum.enumValues)[number];
export type RolUsuario = (typeof rolUsuarioEnum.enumValues)[number];
export type AlcanceConsulta = (typeof alcanceConsultaEnum.enumValues)[number];
export type UnidadProducto = (typeof unidadProductoEnum.enumValues)[number];
export type TipoProveedor = (typeof tipoProveedorEnum.enumValues)[number];
export type Moneda = (typeof monedaEnum.enumValues)[number];
export type EstadoRollo = (typeof estadoRolloEnum.enumValues)[number];
export type TipoMovimiento = (typeof tipoMovimientoEnum.enumValues)[number];
export type TipoTicket = (typeof tipoTicketEnum.enumValues)[number];
export type EstadoTicket = (typeof estadoTicketEnum.enumValues)[number];
export type FormaPagoTicket =
  (typeof formaPagoTicketEnum.enumValues)[number];
export type EstadoSesionCaja =
  (typeof estadoSesionCajaEnum.enumValues)[number];
export type EstadoSalida = (typeof estadoSalidaEnum.enumValues)[number];
export type TipoMovimientoCredito =
  (typeof tipoMovimientoCreditoEnum.enumValues)[number];
