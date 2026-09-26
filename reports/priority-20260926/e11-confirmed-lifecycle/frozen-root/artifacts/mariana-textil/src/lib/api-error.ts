import { Link } from "wouter";
import { createElement, type ReactNode } from "react";

function stringField(value: unknown, key: string): string | undefined {
  if (!value || typeof value !== "object") return undefined;
  const candidate = (value as Record<string, unknown>)[key];
  if (typeof candidate !== "string") return undefined;
  const trimmed = candidate.trim();
  return trimmed || undefined;
}

function cleanMessage(message: string): string {
  return message
    .replace(/^HTTP\s+\d{3}(?:\s+[^:]+)?:\s*/i, "")
    .trim();
}

function browserHref(value: unknown, fallback: string | null): string | null {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("/api")) {
    return fallback;
  }
  return value;
}

type RelatedInventoryMovement = {
  rolloId: number;
  movimientoId: number;
  href: string;
};

function relatedInventoryMovement(error: unknown): RelatedInventoryMovement | null {
  if (!error || typeof error !== "object") return null;
  const data = (error as { data?: Record<string, unknown> }).data;
  const related = data?.movimientoRelacionado;
  if (!related || typeof related !== "object") return null;
  const record = related as Record<string, unknown>;
  const rolloId = record.rolloId;
  const movimientoId = record.movimientoId;
  if (
    typeof rolloId !== "number" ||
    !Number.isInteger(rolloId) ||
    rolloId <= 0 ||
    typeof movimientoId !== "number" ||
    !Number.isInteger(movimientoId) ||
    movimientoId <= 0
  ) {
    return null;
  }
  const expectedHref = `/inventario/rollos/${rolloId}?movimientoId=${movimientoId}`;
  if (record.href !== expectedHref) return null;
  return { rolloId, movimientoId, href: expectedHref };
}

export function getApiErrorMessage(
  error: unknown,
  fallback = "No se pudo completar la operación.",
): string {
  if (!error || typeof error !== "object") return fallback;

  const record = error as Record<string, unknown>;
  const data = record.data;
  const message =
    stringField(data, "error") ??
    stringField(data, "message") ??
    stringField(error, "error") ??
    stringField(error, "message");

  if (!message || /<!doctype|<html/i.test(message)) return fallback;
  const base = cleanMessage(message) || fallback;
  const details = data && typeof data === "object" && (data as Record<string, unknown>).code === "ROLLO_BLOQUEADO"
    ? (Array.isArray((data as Record<string, unknown>).details) ? (data as Record<string, unknown>).details as Array<Record<string, unknown>> : [])
        .map((item) => `Salida ${item.salidaFolio ?? item.salidaId ?? "desconocida"} · Cliente: ${item.nombreCliente ?? "desconocido"} · Desde: ${item.bloqueadoDesde ?? "desconocido"} · Ver: ${item.salidaHref ?? ""}`)
        .join(" | ")
    : "";
  return details ? `${base} · ${details}` : base;
}

export function ApiErrorDetails({
  error,
  fallback,
}: {
  error: unknown;
  fallback?: string;
}): ReactNode {
  const data = error && typeof error === "object" ? (error as { data?: Record<string, unknown> }).data : undefined;
  const relatedMovement = relatedInventoryMovement(error);
  if (relatedMovement) {
    const linkProps = {
      className: "block font-medium underline",
      href: relatedMovement.href,
      "data-testid": "link-related-inventory-movement",
    };
    return createElement("span", { className: "space-y-1" },
      createElement("span", { className: "block" }, getApiErrorMessage(error, fallback)),
      createElement(Link, linkProps, `Ver movimiento relacionado #${relatedMovement.movimientoId}`),
    );
  }
  if (!Array.isArray(data?.details)) return getApiErrorMessage(error, fallback);
  if (data.code === "ROLLO_BLOQUEADO") {
    return createElement("span", { className: "space-y-1" },
      createElement("strong", { className: "block text-red-700" }, "ROLLO BLOQUEADO"),
      ...(data.details as Array<Record<string, unknown>>).map((item, index) => {
        const salidaId = typeof item.salidaId === "number" ? item.salidaId : null;
        const href = browserHref(item.salidaHref, salidaId ? `/salidas/${salidaId}` : null);
        return createElement("span", { className: "block", key: index },
          `Serie ${String(item.serie ?? "desconocida")} · Salida ${String(item.salidaFolio ?? item.salidaId ?? "desconocida")} · Cliente: ${String(item.nombreCliente ?? "desconocido")} · Desde: ${String(item.bloqueadoDesde ?? "desconocido")} `,
          href ? createElement(Link, { className: "underline", href }, "Abrir salida") : null,
        );
      }),
    );
  }
  if (data.code === "SERIE_ENTREGA_INVALIDA") {
    return createElement("span", { className: "space-y-1" },
      createElement("strong", { className: "block text-red-700" }, "SERIE DE ENTREGA INVÁLIDA"),
      ...(data.details as Array<Record<string, unknown>>).map((item, index) => {
        const salida = item.salida && typeof item.salida === "object" ? item.salida as Record<string, unknown> : null;
        const documento = item.documentoVenta && typeof item.documentoVenta === "object" ? item.documentoVenta as Record<string, unknown> : null;
        const salidaId = typeof salida?.id === "number" ? salida.id : null;
        const documentoId = typeof documento?.id === "number" ? documento.id : null;
        const salidaHref = browserHref(salida?.href, salidaId ? `/salidas/${salidaId}` : null);
        const documentoHref = browserHref(documento?.href, documentoId ? `/tickets/${documentoId}` : null);
        return createElement("span", { className: "block", key: index },
          `Serie ${String(item.serieEscaneada ?? "desconocida")} · ${String(item.razon ?? "inválida")}`,
          item.nombreCliente ? ` · Cliente: ${String(item.nombreCliente)}` : "",
          salidaHref ? createElement(Link, { className: "ml-1 underline", href: salidaHref }, "Abrir salida propietaria") : null,
          documentoHref ? createElement(Link, { className: "ml-1 underline", href: documentoHref }, "Abrir documento") : null,
        );
      }),
    );
  }
  return getApiErrorMessage(error);
}