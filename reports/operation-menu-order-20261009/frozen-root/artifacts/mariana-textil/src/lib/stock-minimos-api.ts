import { customFetch } from "@workspace/api-client-react";

export type StockMinimoConfig = {
  ubicacionId: number;
  habilitado: boolean;
};

export type StockMinimoProducto = {
  productoId: number;
  sku: string;
  tela: string;
  color: string;
  unidad: string;
  existencia: number | string;
  minimo: number | null;
  updatedAt: string | null;
};

export type StockMinimosResponse = StockMinimoConfig & {
  productos: StockMinimoProducto[];
};

export type StockMinimoValue = {
  minimo: number | null;
};

export type QueComprarEvidence = {
  movimientos?: Array<Record<string, unknown>>;
  eventos?: Array<Record<string, unknown>>;
  entradas?: Array<Record<string, unknown>>;
  ecuacion?: Record<string, unknown>;
  [key: string]: unknown;
};

export type QueComprarReport = {
  [key: string]: unknown;
  ubicacionId?: number | null;
  generatedAt?: string;
  hasEconomicAccess?: boolean;
  kpis?: Array<Record<string, unknown>>;
  warnings?: Array<string | { id?: string; message: string; severity?: string }>;
  rows?: Array<Record<string, unknown>>;
  productos?: Array<Record<string, unknown>>;
  tables?: Array<{
    id?: string;
    columns?: Array<{ key: string; label?: string }>;
    rows?: Array<Record<string, unknown>>;
  }>;
  charts?: Array<{
    id?: string;
    title?: string;
    type?: string;
    categoryKey?: string;
    series?: Array<{ key: string; label?: string }>;
    rows?: Array<Record<string, unknown>>;
  }>;
  heatmap?: Record<string, unknown>;
};

function queryString(params: Record<string, string | number | null | undefined>) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      query.set(key, String(value));
    }
  });
  const encoded = query.toString();
  return encoded ? `?${encoded}` : "";
}

function asApiPath(path: string) {
  return /^https?:\/\//i.test(path)
    ? path
    : path.startsWith("/")
      ? path
      : `/${path}`;
}

export async function getStockMinimoConfig(ubicacionId: number) {
  return customFetch<StockMinimoConfig>(
    `/api/stock-minimos/config${queryString({ ubicacionId })}`,
    { responseType: "json", credentials: "include" },
  );
}

export async function updateStockMinimoConfig(
  ubicacionId: number,
  habilitado: boolean,
) {
  return customFetch<StockMinimoConfig>(
    `/api/stock-minimos/config${queryString({ ubicacionId })}`,
    {
      method: "PATCH",
      body: JSON.stringify({ habilitado }),
      headers: { "content-type": "application/json" },
      responseType: "json",
      credentials: "include",
    },
  );
}

export async function getStockMinimos(
  ubicacionId: number,
  buscar?: string,
) {
  return customFetch<StockMinimosResponse>(
    `/api/stock-minimos${queryString({ ubicacionId, buscar })}`,
    { responseType: "json", credentials: "include" },
  );
}

export async function updateStockMinimo(
  productoId: number,
  ubicacionId: number,
  minimo: number | null,
) {
  return customFetch<StockMinimoConfig>(
    `/api/stock-minimos/${productoId}${queryString({ ubicacionId })}`,
    {
      method: "PUT",
      body: JSON.stringify({ minimo }),
      headers: { "content-type": "application/json" },
      responseType: "json",
      credentials: "include",
    },
  );
}

export type QueComprarParams = Record<
  string,
  string | number | boolean | string[] | number[] | undefined
>;

function appendReportParams(params: QueComprarParams) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    query.set(key, Array.isArray(value) ? value.join(",") : String(value));
  });
  const encoded = query.toString();
  return encoded ? `?${encoded}` : "";
}

function appendMissingParams(
  path: string,
  params: QueComprarParams,
) {
  const separatorIndex = path.indexOf("?");
  const base = separatorIndex < 0 ? path : path.slice(0, separatorIndex);
  const query = new URLSearchParams(
    separatorIndex < 0 ? undefined : path.slice(separatorIndex + 1),
  );
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    if (query.has(key)) return;
    query.set(key, Array.isArray(value) ? value.join(",") : String(value));
  });
  const encoded = query.toString();
  return encoded ? `${base}?${encoded}` : base;
}

export async function getQueComprarReport(params: QueComprarParams) {
  return customFetch<QueComprarReport>(
    `/api/reportes/que-comprar${appendReportParams(params)}`,
    { responseType: "json", credentials: "include" },
  );
}

export async function getQueComprarEvidence({
  productoId,
  ubicacionId,
  params,
  evidenceUrl,
}: {
  productoId: number;
  ubicacionId: number;
  params: QueComprarParams;
  evidenceUrl?: string;
}) {
  const path = evidenceUrl
    ? asApiPath(evidenceUrl)
    : "/api/reportes/que-comprar/evidencia";
  const evidencePath = appendMissingParams(
    path,
    { ...params, productoId, ubicacionId },
  );
  return customFetch<QueComprarEvidence>(
    evidencePath,
    { responseType: "json", credentials: "include" },
  );
}