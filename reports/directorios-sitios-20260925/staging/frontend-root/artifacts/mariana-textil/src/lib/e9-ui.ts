import type { E9Evidencia, CurrentUser } from "@workspace/api-client-react";
import type { QueryClient } from "@tanstack/react-query";

export function e9Money(value: string): string | null {
  const text = value.trim();
  if (!/^\d+(?:\.\d{1,2})?$/.test(text)) return null;
  const [whole, decimal = ""] = text.split(".");
  return `${BigInt(whole)}.${decimal.padEnd(2, "0")}`;
}

export function e9Cents(value: string): bigint | null {
  const normalized = e9Money(value);
  return normalized === null ? null : BigInt(normalized.replace(".", ""));
}

export function e9Evidence(descripcion: string, referencias: string): E9Evidencia {
  const result = { descripcion: descripcion.trim(), referencias: referencias.split("\n").map(value => value.trim()).filter(Boolean) };
  if (!result.descripcion || result.descripcion.length > 2000) throw new Error("La descripción debe tener entre 1 y 2000 caracteres.");
  if (result.referencias.length > 20 || result.referencias.some(value => value.length > 500)) throw new Error("Admite hasta 20 referencias de máximo 500 caracteres.");
  // References are documentary text, never uploads or automatically fetched resources.
  return result;
}

export function e9Error(error: unknown): string {
  if (error && typeof error === "object") {
    const outer = error as { data?: { error?: { code?: string; message?: string } }; error?: { code?: string; message?: string }; message?: string };
    const detail = outer.data?.error ?? outer.error;
    if (detail?.message) return `${detail.code ? `${detail.code}: ` : ""}${detail.message}`;
    if (outer.message) return outer.message;
  }
  return "No se pudo completar la operación. Conserva la intención y consulta el detalle o reintenta.";
}

export function e9Site(user: CurrentUser, requested?: number | null): number | null {
  if (user.alcanceConsulta === "PROPIA" || user.rol === "CAJA" || user.rol === "TERMINAL") {
    const own = user.ubicacion?.id;
    return own && (!requested || requested === own) ? own : null;
  }
  return requested && Number.isSafeInteger(requested) && requested > 0 ? requested : null;
}

export function invalidateE9(client: QueryClient) {
  return client.invalidateQueries({ predicate: query => {
    const url = query.queryKey[0];
    return typeof url === "string" && (
      url === "/api/e9/disponibilidad" || url.startsWith("/api/e9/entregas") ||
      url.startsWith("/api/admin/cortes") || url.startsWith("/api/sesiones-caja")
    );
  } });
}