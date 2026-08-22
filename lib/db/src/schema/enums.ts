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

export type TipoUbicacion = (typeof tipoUbicacionEnum.enumValues)[number];
export type RolUsuario = (typeof rolUsuarioEnum.enumValues)[number];