import { pgEnum } from "drizzle-orm/pg-core";

export const tipoUbicacionEnum = pgEnum("tipo_ubicacion", [
  "TIENDA",
  "BODEGA",
  "TRANSITO",
  "EXTERNO",
]);

export const rolUsuarioEnum = pgEnum("rol_usuario", [
  "ADMIN",
  "CAJA",
  "INVENTARIOS",
  "BODEGA",
]);

export const unidadProductoEnum = pgEnum("unidad_producto", ["METRO", "KILO"]);

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
 * ABIERTO     – pulled from shelf, being cut/measured (terminal for returns)
 * VENDIDO     – sold to a customer
 * BAJA        – written off / scrapped
 */
export const estadoRolloEnum = pgEnum("estado_rollo", [
  "PROGRAMADO",
  "DISPONIBLE",
  "EN_TRANSITO",
  "ABIERTO",
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
 * SALIDA_MOSTRADOR    – pulled from shelf (DISPONIBLE → ABIERTO, terminal)
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
