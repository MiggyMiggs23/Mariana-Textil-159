import type { Ubicacion, Usuario } from "@workspace/db";

export function presentLocation(location: Ubicacion) {
  return {
    id: location.id,
    nombre: location.nombre,
    tipo: location.tipo,
    activa: location.activa,
    esSistema:
      location.tipo === "TRANSITO" || location.tipo === "EXTERNO",
  };
}

export function presentUser(
  user: Usuario,
  location: Ubicacion | null,
) {
  return {
    id: user.id,
    nombre: user.nombre,
    usuario: user.usuario,
    rol: user.rol,
    ubicacion: location ? presentLocation(location) : null,
    activo: user.activo,
    ultimoAcceso: user.ultimoAcceso,
  };
}

export function sanitizeUserForAudit(user: Usuario) {
  return {
    id: user.id,
    nombre: user.nombre,
    usuario: user.usuario,
    rol: user.rol,
    ubicacionId: user.ubicacionId,
    activo: user.activo,
    ultimoAcceso: user.ultimoAcceso?.toISOString() ?? null,
    createdAt: user.createdAt.toISOString(),
  };
}