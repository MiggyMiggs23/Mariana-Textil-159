import { E3Error } from "./e3-collection";

export function e3ContextSite(actor: { rol: string; ubicacionId: number | null }, requested?: number): number | null {
  if (actor.rol === "ADMIN") return requested ?? actor.ubicacionId;
  if (!actor.ubicacionId || (requested != null && requested !== actor.ubicacionId)) {
    throw new E3Error("SITE_SCOPE", "Solo puedes cobrar desde tu sitio asignado.", 403);
  }
  return actor.ubicacionId;
}
export type E3Context = {
  sitios: { id: number; nombre: string; sesiones: { id: number; ubicacionId: number; fechaOperativa: string }[] }[];
  clientes: { id: number; nombre: string; telefono: string | null }[];
};