export type CodigoEscaneadoInterpretado = {
  serie: string | null;
  sku: string | null;
  textoOriginal: string;
};

const SERIE_AL_FINAL = /(?:^|\D)(\d{7})$/;

/**
 * Interpreta etiquetas SKU-SERIE sin alterar búsquedas de texto libre.
 * La serie válida son exactamente siete dígitos consecutivos al final.
 */
export function interpretarCodigoEscaneado(
  textoOriginal: string,
): CodigoEscaneadoInterpretado {
  const normalizado = textoOriginal.trim().toUpperCase();
  const coincidencia = normalizado.match(SERIE_AL_FINAL);
  if (!coincidencia) {
    return { serie: null, sku: null, textoOriginal };
  }

  const serie = coincidencia[1]!;
  let prefijo = normalizado.slice(0, -serie.length);
  if (prefijo.endsWith("-")) prefijo = prefijo.slice(0, -1);
  const sku = prefijo.trim() || null;

  return { serie, sku, textoOriginal };
}

export function advertenciaSkuEscaneado(
  codigo: CodigoEscaneadoInterpretado,
  skuRollo: string | null | undefined,
): string | null {
  if (!codigo.serie || !codigo.sku || !skuRollo) return null;
  const skuActual = skuRollo.trim().toUpperCase();
  if (codigo.sku === skuActual) return null;
  return `Esta etiqueta dice ${codigo.sku}, pero el rollo ${codigo.serie} corresponde a ${skuActual}. Verifica la etiqueta.`;
}