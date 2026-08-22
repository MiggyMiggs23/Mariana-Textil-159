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

export type TipoUbicacion = (typeof tipoUbicacionEnum.enumValues)[number];
export type RolUsuario = (typeof rolUsuarioEnum.enumValues)[number];
export type UnidadProducto = (typeof unidadProductoEnum.enumValues)[number];
export type TipoProveedor = (typeof tipoProveedorEnum.enumValues)[number];
export type Moneda = (typeof monedaEnum.enumValues)[number];