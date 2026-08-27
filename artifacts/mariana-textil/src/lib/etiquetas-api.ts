import { customFetch } from "@workspace/api-client-react";

export type EtiquetaRollo = {
  id: number;
  serie: string;
  productoId: number;
  producto: string;
  tela?: string;
  color: string;
  sku: string;
  cantidad: string;
  unidad: string;
  sitioId: number;
  sitio: string;
  estado: "DISPONIBLE" | "VENDIDO" | "MOSTRADOR" | "EN_TRANSITO" | "BAJA" | "PROGRAMADO" | string;
  entradaId?: number | null;
  entradaFolio?: string | number | null;
  fechaAlta: string;
  reimpresiones: number;
  ultimaReimpresion?: string | null;
};

export type EtiquetasResultado = {
  items: EtiquetaRollo[];
  total: number;
};

export type ReimpresionRequest = {
  rolloIds: number[];
  motivo: string;
  adminUsuario?: string;
  adminPassword?: string;
};

export type ReimpresionResponse = {
  createdAt: string;
  rollos: EtiquetaRollo[];
};

export type HistorialReimpresion = {
  id: number;
  createdAt: string;
  rolloId?: number;
  serie: string;
  producto: string;
  sitioId: number;
  sitio: string;
  usuarioId: number;
  solicito: string;
  autorizo?: string | null;
  motivo: string;
};

export type HistorialResultado = {
  items: HistorialReimpresion[];
  total: number;
};

export type ResumenReimpresiones = {
  count: number;
  ultimaReimpresion?: string | null;
};

export type AlertasEtiquetas = {
  count: number;
};

type RawRollo = {
  id?: number;
  rolloId?: number;
  serie: string;
  productoId: number;
  producto: string;
  tela?: string;
  color: string;
  sku: string;
  cantidad: string;
  unidad: string;
  sitioId?: number;
  sitio?: string;
  estado?: string;
  entradaId?: number | null;
  folioEntrada?: string | number | null;
  createdAt?: string;
  reimpresionesCount?: number;
  ultimaReimpresion?: string | null;
};

function normalizeRollo(row: RawRollo): EtiquetaRollo {
  return {
    id: Number(row.id ?? row.rolloId),
    serie: row.serie,
    productoId: row.productoId,
    producto: row.producto,
    tela: row.tela,
    color: row.color,
    sku: row.sku,
    cantidad: row.cantidad,
    unidad: row.unidad,
    sitioId: row.sitioId ?? 0,
    sitio: row.sitio ?? "—",
    estado: row.estado ?? "DISPONIBLE",
    entradaId: row.entradaId,
    entradaFolio: row.folioEntrada,
    fechaAlta: row.createdAt ?? "",
    reimpresiones: row.reimpresionesCount ?? 0,
    ultimaReimpresion: row.ultimaReimpresion,
  };
}

function queryString(values: Record<string, string | number | null | undefined>) {
  const params = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") params.set(key, String(value));
  });
  const value = params.toString();
  return value ? `?${value}` : "";
}

export const etiquetasApi = {
  buscar: async (params: Record<string, string | number | null | undefined>) => {
    const result = await customFetch<{ items: RawRollo[]; total?: number }>(`/api/etiquetas/rollos${queryString(params)}`);
    return { items: result.items.map(normalizeRollo), total: result.total ?? result.items.length };
  },
  obtenerRollo: async (rolloId: number) => normalizeRollo(await customFetch<RawRollo>(`/api/etiquetas/rollos/${rolloId}`)),
  reimprimir: async (body: ReimpresionRequest) => {
    const result = await customFetch<{ etiquetas: RawRollo[]; registradoAt: string }>("/api/etiquetas/reimpresiones", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return { createdAt: result.registradoAt, rollos: result.etiquetas.map(normalizeRollo) };
  },
  historial: async (params: Record<string, string | number | null | undefined>) => {
    const result = await customFetch<{ items: Array<Record<string, unknown>>; total: number }>(`/api/etiquetas/historial${queryString(params)}`);
    return {
      total: result.total,
      items: result.items.map((row) => ({
        id: Number(row.id),
        createdAt: String(row.createdAt ?? row.created_at ?? ""),
        rolloId: row.rolloId == null && row.rollo_id == null
          ? undefined
          : Number(row.rolloId ?? row.rollo_id),
        serie: String(row.serie),
        producto: String(row.producto ?? `${String(row.tela ?? "")} ${String(row.color ?? "")}`.trim()),
        sitioId: Number(row.sitioId ?? row.sitio_id ?? 0),
        sitio: String(row.sitio),
        usuarioId: Number(row.usuarioId ?? row.usuario_id ?? 0),
        solicito: String(row.solicito),
        autorizo: row.autorizo == null ? null : String(row.autorizo),
        motivo: String(row.motivo),
      })),
    } satisfies HistorialResultado;
  },
  resumenRollo: async (rolloId: number) => {
    const row = await customFetch<RawRollo>(`/api/etiquetas/rollos/${rolloId}`);
    return { count: row.reimpresionesCount ?? 0, ultimaReimpresion: row.ultimaReimpresion } satisfies ResumenReimpresiones;
  },
  alertas: () => customFetch<AlertasEtiquetas>("/api/etiquetas/alertas/count"),
  exportUrl: (params: Record<string, string | number | null | undefined>) =>
    `/api/etiquetas/historial/export.xlsx${queryString(params)}`,
};